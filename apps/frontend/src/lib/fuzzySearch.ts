/**
 * AI-powered Fuzzy Search untuk nama siswa Indonesia (v2)
 *
 * Strategi pencarian (digabung & di-skor):
 *  1. Eksak / prefix / substring (nama & NISN)
 *  2. Token-set scoring (urutan kata bebas)
 *  3. Levenshtein + Damerau (toleransi typo & swap huruf bersebelahan)
 *  4. Jaro-Winkler (bonus untuk kemiripan di awal kata — efektif utk nama)
 *  5. Bigram & Trigram Dice coefficient (typo tolerance struktural)
 *  6. Phonetic key Indonesia (Soundex-like) — "Fauzi" ≈ "Pauzi", "Khoirul" ≈ "Choirul"
 *  7. Transliterasi ejaan lama → baru (oe→u, dj→j, tj→c, j→y, sh/sj→sy, dll)
 *  8. Kamus alias / nickname Indonesia (Muhammad, Ahmad, Rizky, dst.)
 *  9. Keyboard adjacency — typo karena salah tekan tombol QWERTY tetap dikenali
 *
 * Semua perbandingan dilakukan setelah normalisasi:
 *  - lowercase, hapus diakritik, hapus tanda baca, rapikan whitespace.
 */

// ---------- Normalisasi ----------

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str: string): string[] {
  const n = normalize(str);
  return n ? n.split(" ") : [];
}

// ---------- Transliterasi ejaan lama Indonesia → modern ----------
// Membantu mengenali nama-nama dengan ejaan Belanda/lama.
function modernizeIndonesian(token: string): string {
  let t = token;
  // multi-karakter dulu
  t = t.replace(/oe/g, "u");
  t = t.replace(/dj/g, "j");
  t = t.replace(/tj/g, "c");
  t = t.replace(/sj/g, "sy");
  t = t.replace(/sh/g, "sy");
  t = t.replace(/ch/g, "k"); // Chairul → Kairul
  t = t.replace(/kh/g, "k"); // Khoirul → Koirul
  t = t.replace(/ph/g, "f"); // Phauzi → Fauzi
  t = t.replace(/th/g, "t");
  t = t.replace(/gh/g, "g");
  t = t.replace(/dh/g, "d");
  t = t.replace(/aa/g, "a");
  t = t.replace(/ii/g, "i");
  t = t.replace(/uu/g, "u");
  // huruf 'j' lama (= 'y' modern) — hati-hati: hanya jika diikuti vokal di awal
  t = t.replace(/^j([aeiou])/g, "y$1");
  // 'q' → 'k' di akhir/sebelum konsonan
  t = t.replace(/q/g, "k");
  // 'x' → 'ks'
  t = t.replace(/x/g, "ks");
  // 'v' → 'f' (umum di transliterasi Arab-Indonesia: Aviva ≈ Afifa)
  t = t.replace(/v/g, "f");
  // 'z' kadang ditulis 'j' atau sebaliknya — biarkan, ditangani phonetic
  // Hapus huruf vokal ganda yang tersisa
  t = t.replace(/([aeiou])\1+/g, "$1");
  return t;
}

// ---------- Phonetic key (Soundex-style untuk Indonesia) ----------
// Mengelompokkan konsonan yang berbunyi mirip menjadi kode yang sama.
// Tujuan: "Fauzi" → "F200", "Pauzi" → "F200", "Khoirul" ≈ "Choirul" ≈ "Koirul".
const PHONETIC_MAP: Record<string, string> = {
  b: "1", f: "1", p: "1", v: "1", w: "1",
  c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
  d: "3", t: "3",
  l: "4",
  m: "5", n: "5",
  r: "6",
};

function phoneticKey(token: string): string {
  if (!token) return "";
  const mod = modernizeIndonesian(token);
  if (!mod) return "";
  // Huruf pertama di-normalisasi juga (b/p/f/v/w → "F" sebagai grup)
  const first = mod[0];
  const firstCode = PHONETIC_MAP[first] ? `_${PHONETIC_MAP[first]}` : first;
  let prev = "";
  let code = "";
  for (let i = 1; i < mod.length; i++) {
    const ch = mod[i];
    const c = PHONETIC_MAP[ch] || "";
    if (c && c !== prev) code += c;
    prev = c;
  }
  return (firstCode + code + "0000").slice(0, 4);
}

// ---------- Levenshtein + Damerau (transposisi) ----------

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[m][n];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return ((maxLen - damerauLevenshtein(a, b)) / maxLen) * 100;
}

// Backward compatibility export
function levenshteinDistance(a: string, b: string): number {
  return damerauLevenshtein(a, b);
}

// ---------- Jaro-Winkler ----------
// Sangat efektif untuk nama: memberikan bonus pada awalan yang sama.

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;

  const matchDist = Math.max(aLen, bLen) / 2 - 1;
  const aMatches = new Array(aLen).fill(false);
  const bMatches = new Array(bLen).fill(false);
  let matches = 0;

  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, bLen);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / aLen + matches / bLen + (matches - transpositions) / matches) / 3;
}

function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j * 100;
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return (j + prefix * 0.1 * (1 - j)) * 100;
}

// ---------- Bigram & Trigram (Dice coefficient) ----------

function ngrams(str: string, n: number): Map<string, number> {
  const map = new Map<string, number>();
  if (str.length < n) {
    if (str.length > 0) map.set(str, 1);
    return map;
  }
  for (let i = 0; i <= str.length - n; i++) {
    const g = str.slice(i, i + n);
    map.set(g, (map.get(g) || 0) + 1);
  }
  return map;
}

function diceCoefficientN(a: string, b: string, n: number): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const gA = ngrams(a, n);
  const gB = ngrams(b, n);
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;
  gA.forEach((c) => (totalA += c));
  gB.forEach((c) => (totalB += c));
  gA.forEach((countA, key) => {
    const countB = gB.get(key);
    if (countB) intersection += Math.min(countA, countB);
  });
  if (totalA + totalB === 0) return 0;
  return ((2 * intersection) / (totalA + totalB)) * 100;
}

function diceCoefficient(a: string, b: string): number {
  return diceCoefficientN(a, b, 2);
}

// ---------- Keyboard adjacency (QWERTY) ----------
// Memberikan toleransi ekstra untuk typo karena salah tekan tombol bersebelahan.
const KEYBOARD_NEIGHBORS: Record<string, string> = {
  q: "wa", w: "qeas", e: "wrsd", r: "etdf", t: "ryfg", y: "tugh",
  u: "yihj", i: "uojk", o: "ipkl", p: "ol",
  a: "qwsz", s: "awedxz", d: "serfcx", f: "drtgvc", g: "ftyhbv",
  h: "gyujnb", j: "huiknm", k: "jiolm", l: "kop",
  z: "asx", x: "zsdc", c: "xdfv", v: "cfgb", b: "vghn",
  n: "bhjm", m: "njk",
};

function keyboardAdjacencyBonus(a: string, b: string): number {
  // Hanya berarti bila panjang sama / beda 1, dan ada satu beda huruf
  if (Math.abs(a.length - b.length) > 1) return 0;
  const len = Math.min(a.length, b.length);
  let diffs: Array<[string, string]> = [];
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diffs.push([a[i], b[i]]);
    if (diffs.length > 2) return 0;
  }
  let bonus = 0;
  for (const [x, y] of diffs) {
    const neigh = KEYBOARD_NEIGHBORS[x];
    if (neigh && neigh.includes(y)) bonus += 6;
  }
  return Math.min(bonus, 12);
}

// ---------- Nickname / Alias Indonesia (diperluas) ----------

const NICKNAME_GROUPS: string[][] = [
  ["ahmad", "ahmat", "amat", "achmad", "akhmad", "ahmed"],
  ["muhammad", "muhamad", "mohamad", "mohammed", "moh", "muh", "mhd", "md", "mochammad", "mochamad"],
  ["abdul", "abdoel", "abd", "dul"],
  ["abdurrahman", "abdulrahman", "abdurahman", "abdurochman"],
  ["nur", "noor", "nurul", "noerul", "nuru"],
  ["siti", "sitti", "sitty", "syiti"],
  ["dewi", "dewy", "devi", "devy"],
  ["putri", "putry", "poetri", "putrie"],
  ["rizky", "rizki", "riski", "risky", "rizqi", "rizqy", "rizkie"],
  ["taufik", "taufiq", "tofik", "topik", "taufick", "taupik"],
  ["khairul", "khoirul", "koirul", "choirul", "kairul", "khoerul"],
  ["luthfi", "lutfi", "lutpi", "luthfie", "lutfie"],
  ["fauzi", "fauzy", "fawzi", "pauzi", "pauzy"],
  ["yusuf", "yusup", "yoesoef", "jusuf", "jusup"],
  ["zainal", "zaenal", "zaynal", "zaenul"],
  ["aisyah", "aisha", "aisya", "aishah", "aisyiah"],
  ["fatimah", "fatima", "patimah", "fathimah"],
  ["khadijah", "khadija", "kadijah", "khotijah"],
  ["syamsuddin", "syamsudin", "samsudin", "syam", "syamsuddien"],
  ["umar", "omar", "oemar"],
  ["usman", "utsman", "ustman", "oesman"],
  ["wahyu", "wahyo", "wahyou", "wahju"],
  ["zahra", "zahro", "zara", "zahraa", "zahrah"],
  ["ali", "aly", "alie"],
  ["hasan", "hassan", "hasanudin", "hasanuddin"],
  ["husein", "hussein", "husain", "husain"],
  ["ibrahim", "ibrohim", "ibroheem"],
  ["ismail", "ismael", "isma il"],
  ["jamal", "djamal", "jamil"],
  ["maryam", "mariam", "maryamah"],
  ["nabila", "nabilah", "nabeela"],
  ["salim", "saleem", "salem"],
  ["sulaiman", "suleiman", "soleman", "soliman"],
  ["yahya", "yahya", "jahja"],
  ["zulkifli", "dzulkifli", "djulkifli"],
  ["agus", "aguss", "augustus"],
  ["budi", "boedi", "boedhi"],
  ["dian", "diane"],
  ["eka", "eka", "ekha"],
  ["sri", "srie", "sry"],
  ["yuli", "juli", "yulie", "julie"],
  ["yanti", "janti", "yantie"],
  ["wati", "watie", "wahti"],
  ["andi", "andy", "andhie"],
  ["tono", "tonny", "toni", "tony"],
  ["rini", "riny", "rinie"],
  ["intan", "inten"],
  ["ratna", "ratnah"],
];

const ALIAS_LOOKUP = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of NICKNAME_GROUPS) {
    const set = new Set(group);
    for (const term of group) map.set(term, set);
  }
  return map;
})();

function aliasMatches(token: string, candidate: string): boolean {
  const aliases = ALIAS_LOOKUP.get(token);
  if (aliases && aliases.has(candidate)) return true;
  // Cek juga via bentuk modern (Choirul ↔ Khoirul lewat modernisasi)
  const modT = modernizeIndonesian(token);
  const modC = modernizeIndonesian(candidate);
  if (modT && modC && modT === modC) return true;
  return false;
}

// ---------- Skor pasangan token (gabungan banyak metrik) ----------

function pairScore(qt: string, nt: string): number {
  if (!qt || !nt) return 0;
  if (qt === nt) return 100;
  if (nt.startsWith(qt)) return 95;
  if (qt.length >= 3 && nt.includes(qt)) return 88;
  if (aliasMatches(qt, nt) || aliasMatches(nt, qt)) return 92;

  // Phonetic match (sangat efektif utk nama Indonesia)
  if (qt.length >= 3 && nt.length >= 3) {
    const pq = phoneticKey(qt);
    const pn = phoneticKey(nt);
    if (pq && pn && pq === pn) {
      // Tetap kombinasikan dgn similarity karakter agar tidak over-match
      const lev = levenshteinSimilarity(qt, nt);
      return Math.max(82, lev * 0.5 + 50);
    }
  }

  // Skor karakter
  if (qt.length < 2 || nt.length < 2) return 0;

  const lev = levenshteinSimilarity(qt, nt);
  const jw = jaroWinkler(qt, nt);
  const dice2 = diceCoefficientN(qt, nt, 2);
  const dice3 = diceCoefficientN(qt, nt, 3);
  const kbBonus = keyboardAdjacencyBonus(qt, nt);

  // Kombinasi berbobot — JW unggul utk awalan, dice3 utk struktur, lev utk overall
  const combined = jw * 0.35 + lev * 0.3 + dice2 * 0.2 + dice3 * 0.15 + kbBonus;

  // Penalti bila perbedaan panjang ekstrem
  const lenDiff = Math.abs(qt.length - nt.length);
  const lenPenalty = lenDiff > 4 ? (lenDiff - 4) * 4 : 0;

  return Math.max(0, Math.min(100, combined - lenPenalty));
}

// ---------- Token-set scoring ----------

function tokenSetScore(queryTokens: string[], nameTokens: string[]): number {
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;

  let total = 0;
  let matchedAll = true;

  for (const qt of queryTokens) {
    let best = 0;
    for (const nt of nameTokens) {
      const s = pairScore(qt, nt);
      if (s > best) best = s;
      if (best === 100) break;
    }
    if (best < 60) matchedAll = false;
    total += best;
  }

  const avg = total / queryTokens.length;
  return matchedAll ? avg : avg * 0.85;
}

// ---------- Public API ----------

export interface SearchResult<T> {
  item: T;
  score: number;
  matchType: "exact" | "prefix" | "contains" | "fuzzy" | "nickname" | "nisn" | "phonetic";
}

export function fuzzySearchStudents<T extends { name: string; nisn: string }>(
  students: T[],
  query: string,
  options: { minScore?: number; limit?: number } = {}
): SearchResult<T>[] {
  const { minScore = 55, limit = 50 } = options;

  if (!query.trim()) {
    return students.map((item) => ({
      item,
      score: 100,
      matchType: "exact" as const,
    }));
  }

  const qNorm = normalize(query);
  const qTokens = tokenize(query);
  const qDigits = query.replace(/\D/g, "");
  const results: SearchResult<T>[] = [];

  for (const student of students) {
    const nameNorm = normalize(student.name);
    const nameTokens = tokenize(student.name);
    const nisnNorm = student.nisn ? student.nisn.toLowerCase() : "";

    let score = 0;
    let matchType: SearchResult<T>["matchType"] = "fuzzy";

    // 1. NISN
    if (qDigits.length >= 2 && nisnNorm) {
      if (nisnNorm === qDigits) { score = 100; matchType = "nisn"; }
      else if (nisnNorm.startsWith(qDigits)) { score = 98; matchType = "nisn"; }
      else if (nisnNorm.includes(qDigits)) { score = 92; matchType = "nisn"; }
    }

    // 2. Nama eksak
    if (score < 100 && nameNorm === qNorm) {
      score = 100; matchType = "exact";
    }

    // 3. Prefix nama lengkap
    if (score < 98 && nameNorm.startsWith(qNorm)) {
      const candidate = qNorm.length >= 2 ? 96 : 90;
      if (candidate > score) { score = candidate; matchType = "prefix"; }
    }

    // 4. Substring nama lengkap
    if (score < 90 && qNorm.length >= 2 && nameNorm.includes(qNorm)) {
      score = 88; matchType = "contains";
    }

    // 5. Token-set scoring (urutan kata bebas + alias + fuzzy + phonetic)
    if (score < 95) {
      const tokenScore = tokenSetScore(qTokens, nameTokens);

      const usedAlias = qTokens.some((qt) =>
        nameTokens.some((nt) => aliasMatches(qt, nt) || aliasMatches(nt, qt))
      );
      const usedPhonetic = qTokens.some((qt) =>
        nameTokens.some((nt) => {
          if (qt.length < 3 || nt.length < 3) return false;
          const pq = phoneticKey(qt);
          const pn = phoneticKey(nt);
          return pq && pn && pq === pn && qt !== nt;
        })
      );

      if (tokenScore > score) {
        score = tokenScore;
        if (usedAlias) matchType = "nickname";
        else if (usedPhonetic) matchType = "phonetic";
        else matchType = "fuzzy";
      }
    }

    // 6. Bonus kecil bila full-string Jaro-Winkler tinggi (menangkap nama tanpa spasi)
    if (score < 90 && qNorm.length >= 4 && nameNorm.length >= 4) {
      const jw = jaroWinkler(qNorm, nameNorm);
      if (jw > score) {
        score = jw * 0.9; // sedikit di-discount karena belum melalui token logic
        if (score > 80 && matchType === "fuzzy") matchType = "fuzzy";
      }
    }

    if (score >= minScore) {
      results.push({ item: student, score, matchType });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.name.localeCompare(b.item.name);
  });

  return results.slice(0, limit);
}

export {
  levenshteinDistance,
  levenshteinSimilarity,
  diceCoefficient,
  jaroWinkler,
  phoneticKey,
  normalize,
};
