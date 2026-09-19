/**
 * Catalog search is tolerant on purpose: shoppers type "stringr tank" or
 * "compresion" and still expect the product. Matching is token-wise — every
 * word the shopper typed has to match some word in the product, by prefix,
 * by substring, or within a small edit distance that grows with the word's
 * length. Short words get no typo budget, because at three characters a
 * single edit reaches half the catalogue.
 */

/** Lowercases, strips accents, and reduces punctuation to word breaks. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function typoBudget(token: string): number {
  if (token.length <= 3) return 0;
  if (token.length <= 6) return 1;
  return 2;
}

/** Levenshtein distance, abandoned as soon as it cannot come in at or under max. */
function withinEditDistance(left: string, right: string, max: number): boolean {
  if (Math.abs(left.length - right.length) > max) return false;
  if (max === 0) return left === right;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const distance = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(distance);
      if (distance < best) best = distance;
    }
    if (best > max) return false;
    previous = current;
  }

  return previous[right.length] <= max;
}

function matchesToken(queryToken: string, haystackTokens: readonly string[]): boolean {
  const budget = typoBudget(queryToken);
  return haystackTokens.some(
    (token) =>
      token.startsWith(queryToken)
      || (queryToken.length >= 3 && token.includes(queryToken))
      || withinEditDistance(queryToken, token, budget),
  );
}

/**
 * True when every word in the query finds a home somewhere in the haystack.
 * Word order does not matter; an empty query matches everything.
 */
export function fuzzyMatches(query: string, haystack: string): boolean {
  const queryTokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (queryTokens.length === 0) return true;

  const normalizedHaystack = normalizeSearchText(haystack);
  if (!normalizedHaystack) return false;

  const haystackTokens = normalizedHaystack.split(" ").filter(Boolean);
  return queryTokens.every((token) => matchesToken(token, haystackTokens));
}
