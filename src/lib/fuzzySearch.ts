/**
 * AI-powered Fuzzy Search untuk nama siswa Indonesia
 *
 * Strategi pencarian (urutan prioritas):
 *  1. Exact match (nama / NISN)
 *  2. Prefix match
 *  3. Substring match
 *  4. Token-set match (urutan kata bebas, mis. "fauzi ahmad" = "Ahmad Fauzi")
 *  5. Bigram similarity (typo-tolerant)
 *  6. Levenshtein distance (last resort)
 *  7. Nickname / alias mapping (Indonesia)
 *
 * Semua perbandingan dilakukan setelah normalisasi:
 *  - lowercase
 *  - hapus diakritik
 *  - hilangkan tanda baca
 *  - rapikan whitespace
 */

// ---------- Normalisasi ----------

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // hapus diakritik
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // ganti tanda baca dengan spasi
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str: string): string[] {
  const n = normalize(str);
  return n ? n.split(" ") : [];
}

// ---------- Levenshtein ----------

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Optimasi: 2 baris saja
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // delete
        curr[j - 1] + 1,    // insert
        prev[j - 1] + cost  // substitute
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return ((maxLen - levenshteinDistance(a, b)) / maxLen) * 100;
}

// ---------- Bigram similarity (Dice coefficient) ----------

function bigrams(str: string): Map<string, number> {
  const map = new Map<string, number>();
  if (str.length < 2) {
    if (str.length === 1) map.set(str, 1);
    return map;
  }
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str.slice(i, i + 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  return map;
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;
  bgA.forEach((c) => (totalA += c));
  bgB.forEach((c) => (totalB += c));
  bgA.forEach((countA, key) => {
    const countB = bgB.get(key);
    if (countB) intersection += Math.min(countA, countB);
  });
  if (totalA + totalB === 0) return 0;
  return ((2 * intersection) / (totalA + totalB)) * 100;
}

// ---------- Nickname / Alias Indonesia ----------

const NICKNAME_GROUPS: string[][] = [
  ["ahmad", "ahmat", "amat", "achmad", "akhmad"],
  ["muhammad", "muhamad", "mohamad", "mohammed", "moh", "muh", "mhd", "md"],
  ["abdul", "abdoel", "abd", "dul"],
  ["abdurrahman", "abdul rahman", "abdulrahman"],
  ["nur", "noor", "nurul", "noerul"],
  ["siti", "sitti", "sitty"],
  ["dewi", "dewy"],
  ["putri", "putry", "poetri"],
  ["rizky", "rizki", "riski", "risky", "rizqi", "rizqy"],
  ["taufik", "taufiq", "tofik", "topik", "taufick"],
  ["khairul", "khoirul", "koirul", "choirul"],
  ["luthfi", "lutfi", "lutpi", "luthfie"],
  ["fauzi", "fauzy", "fawzi"],
  ["yusuf", "yusup", "yoesoef"],
  ["zainal", "zaenal", "zaynal"],
  ["aisyah", "aisha", "aisya", "aishah"],
  ["fatimah", "fatima", "patimah"],
  ["khadijah", "khadija", "kadijah"],
  ["syamsuddin", "syamsudin", "samsudin", "syam"],
  ["umar", "omar", "oemar"],
  ["usman", "utsman", "ustman"],
  ["wahyu", "wahyo", "wahyou"],
  ["zahra", "zahro", "zara", "zahraa"],
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
  if (!aliases) return false;
  return aliases.has(candidate);
}

// ---------- Token-set scoring ----------

/**
 * Hitung skor token-set: untuk setiap token query, cari skor terbaik
 * di antara token kandidat. Skor akhir = rata-rata skor terbaik per token query.
 */
function tokenSetScore(queryTokens: string[], nameTokens: string[]): number {
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;

  let total = 0;
  let matchedAll = true;

  for (const qt of queryTokens) {
    let best = 0;
    for (const nt of nameTokens) {
      let score = 0;
      if (nt === qt) score = 100;
      else if (nt.startsWith(qt)) score = 95;
      else if (qt.length >= 3 && nt.includes(qt)) score = 88;
      else if (aliasMatches(qt, nt) || aliasMatches(nt, qt)) score = 92;
      else {
        // Hanya gunakan fuzzy jika token cukup panjang
        if (qt.length >= 3 && nt.length >= 3) {
          const lev = levenshteinSimilarity(qt, nt);
          const dice = diceCoefficient(qt, nt);
          score = Math.max(lev * 0.6 + dice * 0.4, 0);
        }
      }
      if (score > best) best = score;
      if (best === 100) break;
    }
    if (best < 60) matchedAll = false;
    total += best;
  }

  const avg = total / queryTokens.length;
  // Penalti bila tidak semua token query ketemu pasangan layak
  return matchedAll ? avg : avg * 0.85;
}

// ---------- Public API ----------

export interface SearchResult<T> {
  item: T;
  score: number;
  matchType: "exact" | "prefix" | "contains" | "fuzzy" | "nickname" | "nisn";
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

    // 1. NISN (numerik) — eksak / prefix / substring
    if (qDigits.length >= 2 && nisnNorm) {
      if (nisnNorm === qDigits) {
        score = 100;
        matchType = "nisn";
      } else if (nisnNorm.startsWith(qDigits)) {
        score = 98;
        matchType = "nisn";
      } else if (nisnNorm.includes(qDigits)) {
        score = 92;
        matchType = "nisn";
      }
    }

    // 2. Nama eksak
    if (score < 100 && nameNorm === qNorm) {
      score = 100;
      matchType = "exact";
    }

    // 3. Prefix nama lengkap
    if (score < 98 && nameNorm.startsWith(qNorm)) {
      const candidate = qNorm.length >= 2 ? 96 : 90;
      if (candidate > score) {
        score = candidate;
        matchType = "prefix";
      }
    }

    // 4. Substring nama lengkap
    if (score < 90 && qNorm.length >= 2 && nameNorm.includes(qNorm)) {
      score = 88;
      matchType = "contains";
    }

    // 5. Token-set scoring (urutan kata bebas + alias + fuzzy)
    if (score < 95) {
      const tokenScore = tokenSetScore(qTokens, nameTokens);
      // Cek apakah ada alias yang berperan
      const usedAlias = qTokens.some((qt) =>
        nameTokens.some((nt) => aliasMatches(qt, nt) || aliasMatches(nt, qt))
      );
      if (tokenScore > score) {
        score = tokenScore;
        matchType = usedAlias ? "nickname" : "fuzzy";
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

export { levenshteinDistance, levenshteinSimilarity, diceCoefficient, normalize };
