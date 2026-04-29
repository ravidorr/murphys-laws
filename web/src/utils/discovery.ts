import type { Law } from '../types/app.d.ts';

const DISCOVERY_TERMS: Record<string, { terms: string[]; category: string }> = {
  meeting: { terms: ['work', 'office', 'project'], category: 'murphys-office-laws' },
  meetings: { terms: ['work', 'office', 'project'], category: 'murphys-office-laws' },
  deadline: { terms: ['work', 'office', 'project'], category: 'murphys-office-laws' },
  software: { terms: ['technology', 'computer', 'software'], category: 'murphys-technology-laws' },
  bug: { terms: ['technology', 'computer', 'software'], category: 'murphys-technology-laws' },
  bugs: { terms: ['technology', 'computer', 'software'], category: 'murphys-technology-laws' },
  deployment: { terms: ['technology', 'computer', 'software'], category: 'murphys-technology-laws' },
  flight: { terms: ['travel', 'bus', 'cars'], category: 'murphys-travel-laws' },
  luggage: { terms: ['travel', 'bus', 'cars'], category: 'murphys-travel-laws' },
  toast: { terms: ['everyday', 'gravity', 'funny'], category: 'murphys-gravity-laws' },
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

export function expandDiscoveryQuery(query: string): string[] {
  const terms = new Set<string>([query.trim()]);
  tokenize(query).forEach((token) => {
    DISCOVERY_TERMS[token]?.terms.forEach((term) => terms.add(term));
  });
  return [...terms].filter(Boolean);
}

export function inferDiscoveryCategory(text: string): string | null {
  for (const token of tokenize(text)) {
    const match = DISCOVERY_TERMS[token];
    if (match) return match.category;
  }
  return null;
}

export function rankDuplicateCandidates(text: string, candidates: Pick<Law, 'id' | 'text' | 'title'>[]): Array<Pick<Law, 'id' | 'text' | 'title'> & { score: number }> {
  const terms = new Set(tokenize(text));
  return candidates
    .map((candidate) => {
      const candidateTerms = tokenize(`${candidate.title || ''} ${candidate.text}`);
      const score = candidateTerms.reduce((total, term) => total + (terms.has(term) ? 1 : 0), 0);
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score);
}
