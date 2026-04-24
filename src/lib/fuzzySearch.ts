/**
 * AI-powered Fuzzy Search for student names
 * Uses Levenshtein distance for similarity matching
 */

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

// Calculate similarity percentage (0-100)
function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return ((maxLen - distance) / maxLen) * 100;
}

// Check if query matches any word in the name
function wordMatch(name: string, query: string): number {
  const words = name.toLowerCase().split(/\s+/);
  const queryLower = query.toLowerCase();
  
  // Exact word match
  if (words.some(w => w === queryLower)) return 100;
  
  // Word starts with query
  if (words.some(w => w.startsWith(queryLower))) return 95;
  
  // Word contains query
  if (words.some(w => w.includes(queryLower))) return 85;
  
  // Fuzzy match on each word
  let maxSim = 0;
  for (const word of words) {
    const sim = similarity(word, queryLower);
    maxSim = Math.max(maxSim, sim);
  }
  
  return maxSim;
}

// Common Indonesian nickname mappings
const NICKNAME_MAP: Record<string, string[]> = {
  'ahmad': ['ahmat', 'amat', 'mat', 'achmad', 'akhmad'],
  'muhammad': ['muhamad', 'mohamad', 'moh', 'muh', 'muhammad'],
  'ismail': ['isam', 'mail', 'isma'],
  'syamsuddin': ['syamsudin', 'samsudin', 'sam', 'syam'],
  'abdul': ['abdu', 'dul'],
  'rizky': ['rizki', 'riski', 'risky', 'iki'],
  'nur': ['noor', 'nurul'],
  'siti': ['sitti', 'iti'],
  'dewi': ['dew', 'dwi'],
  'putri': ['putry', 'tri'],
  'andi': ['andy', 'andi'],
  'bayu': ['bay'],
  'dian': ['dyan', 'diyan'],
  'eka': ['ecca'],
  'fajar': ['fajar'],
  'gilang': ['gilang', 'gilank'],
  'hendra': ['hen', 'hendrik'],
  'indra': ['indra', 'indro'],
  'joko': ['jok'],
  'khairul': ['khairul', 'khoirul', 'koirul'],
  'luthfi': ['lutfi', 'lutpi'],
  'mega': ['meka'],
  'novi': ['novy', 'nofi'],
  'okta': ['octa', 'okto'],
  'priya': ['prya'],
  'qori': ['kori'],
  'rama': ['ramma'],
  'sari': ['sary', 'saree'],
  'taufik': ['taufiq', 'tofik', 'topik'],
  'umar': ['omar'],
  'vina': ['fina', 'pina'],
  'wahyu': ['wahyo', 'wahu'],
  'yoga': ['yogi'],
  'zahra': ['zahro', 'zara'],
};

// Check nickname matches
function nicknameMatch(name: string, query: string): number {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();
  
  for (const [canonical, aliases] of Object.entries(NICKNAME_MAP)) {
    const allForms = [canonical, ...aliases];
    
    // If query matches any form
    if (allForms.some(form => form.startsWith(queryLower) || queryLower.startsWith(form))) {
      // Check if name contains any form
      if (allForms.some(form => nameLower.includes(form))) {
        return 90;
      }
    }
  }
  
  return 0;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy' | 'nickname';
}

export function fuzzySearchStudents<T extends { name: string; nisn: string }>(
  students: T[],
  query: string,
  options: {
    minScore?: number;
    limit?: number;
  } = {}
): SearchResult<T>[] {
  const { minScore = 40, limit = 50 } = options;
  
  if (!query.trim()) {
    return students.map(item => ({ item, score: 100, matchType: 'exact' as const }));
  }
  
  const queryLower = query.toLowerCase().trim();
  const results: SearchResult<T>[] = [];
  
  for (const student of students) {
    const nameLower = student.name.toLowerCase();
    const nisnLower = student.nisn.toLowerCase();
    
    let score = 0;
    let matchType: SearchResult<T>['matchType'] = 'fuzzy';
    
    // Exact match on full name
    if (nameLower === queryLower) {
      score = 100;
      matchType = 'exact';
    }
    // NISN match
    else if (nisnLower.includes(queryLower)) {
      score = 100;
      matchType = 'exact';
    }
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) {
      score = 98;
      matchType = 'prefix';
    }
    // Name contains query
    else if (nameLower.includes(queryLower)) {
      score = 90;
      matchType = 'contains';
    }
    // Word-level matching
    else {
      const wordScore = wordMatch(student.name, query);
      const nickScore = nicknameMatch(student.name, query);
      
      if (nickScore > wordScore) {
        score = nickScore;
        matchType = 'nickname';
      } else {
        score = wordScore;
        matchType = 'fuzzy';
      }
    }
    
    if (score >= minScore) {
      results.push({ item: student, score, matchType });
    }
  }
  
  // Sort by score (descending) then by name (ascending)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.name.localeCompare(b.item.name);
  });
  
  return results.slice(0, limit);
}

// Export for use in components
export { levenshteinDistance, similarity };
