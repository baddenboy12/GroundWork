/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use a flat array for efficiency
  const dp: number[] = Array.from({ length: (m + 1) * (n + 1) }, () => 0);
  const idx = (i: number, j: number) => i * (n + 1) + j;

  for (let i = 0; i <= m; i++) dp[idx(i, 0)] = i;
  for (let j = 0; j <= n; j++) dp[idx(0, j)] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[idx(i, j)] = dp[idx(i - 1, j - 1)];
      } else {
        dp[idx(i, j)] =
          1 +
          Math.min(
            dp[idx(i - 1, j)],   // deletion
            dp[idx(i, j - 1)],   // insertion
            dp[idx(i - 1, j - 1)] // substitution
          );
      }
    }
  }
  return dp[idx(m, n)];
}

/**
 * Similarity score between 0 and 1.
 * 1 = identical, 0 = completely different.
 */
export function stringSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim().replace(/\s+/g, " ");
  const nb = b.toLowerCase().trim().replace(/\s+/g, " ");
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Returns items whose label is "fuzzy similar" to the input
 * but NOT already a substring match (those are shown separately).
 *
 * @param input      - What the user typed
 * @param items      - Candidate items
 * @param getLabel   - Extracts the label string from each item
 * @param threshold  - Minimum similarity score (0–1), default 0.62
 */
export function findFuzzyMatches<T>(
  input: string,
  items: T[],
  getLabel: (item: T) => string,
  threshold = 0.62
): T[] {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, " ");
  if (normalized.length < 2) return [];

  return items.filter((item) => {
    const label = getLabel(item).toLowerCase().trim().replace(/\s+/g, " ");
    // Exclude already-caught substring matches
    const isSubstring =
      label.includes(normalized) || normalized.includes(label);
    if (isSubstring) return false;
    return stringSimilarity(normalized, label) >= threshold;
  });
}
