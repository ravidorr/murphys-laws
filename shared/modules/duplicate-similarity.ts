export type DuplicateMatchType = 'exact' | 'fuzzy';

export interface DuplicateSimilarity {
  similarity: number;
  match_type: DuplicateMatchType;
  shared_terms: number;
}

export function normalizeDuplicateText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/-/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemToken(token: string): string {
  if (token.length > 7 && token.endsWith('ment')) return token.slice(0, -4);
  if (token.length > 6 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function significantTerms(value: string): Set<string> {
  return new Set(
    normalizeDuplicateText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .map(stemToken)
  );
}

export function scoreDuplicateSimilarity(input: string, candidate: string): DuplicateSimilarity {
  const normalizedInput = normalizeDuplicateText(input);
  const normalizedCandidate = normalizeDuplicateText(candidate);
  if (normalizedInput === normalizedCandidate) {
    return { similarity: 1, match_type: 'exact', shared_terms: significantTerms(input).size };
  }

  const inputTerms = significantTerms(input);
  const candidateTerms = significantTerms(candidate);
  const sharedTerms = [...inputTerms].filter((term) => candidateTerms.has(term)).length;
  const unionSize = new Set([...inputTerms, ...candidateTerms]).size;
  const smallerSize = Math.min(inputTerms.size, candidateTerms.size);
  const jaccard = unionSize > 0 ? sharedTerms / unionSize : 0;
  const containment = smallerSize > 0 ? sharedTerms / smallerSize : 0;
  const similarity = Number(((jaccard + containment) / 2).toFixed(3));
  return { similarity, match_type: 'fuzzy', shared_terms: sharedTerms };
}

export function isUsefulDuplicateMatch(match: DuplicateSimilarity): boolean {
  return match.match_type === 'exact' || (match.shared_terms >= 2 && match.similarity >= 0.45);
}
