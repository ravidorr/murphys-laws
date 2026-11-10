import type { Attribution, Corollary, CorollaryParent, Law } from 'murphys-laws-sdk';

function parseAttributions(attributions: Law['attributions']): Attribution[] {
  if (!attributions) return [];
  if (typeof attributions === 'string') {
    try {
      const parsed = JSON.parse(attributions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return attributions;
}

// The same titles the website treats as saying nothing about a law (shared/modules/law-seo.ts)
const GENERIC_TITLES = new Set(['', 'corollary', "murphy's law", 'murphys law', "murphy's laws", 'law', 'untitled']);

/** " Title" for a corollary that has a real title, otherwise nothing: "Corollary" says nothing about it. */
function corollaryLabel(corollary: Corollary): string {
  const title = corollary.title?.trim() ?? '';
  return GENERIC_TITLES.has(title.toLowerCase()) ? '' : ` ${title}`;
}

function describeParent(parent: CorollaryParent): string {
  const title = parent.title?.trim() ?? '';
  if (!GENERIC_TITLES.has(title.toLowerCase())) return title;
  const text = parent.text.replace(/\s+/g, ' ').trim();
  return `"${text.length > 100 ? `${text.slice(0, 97)}...` : text}"`;
}

export function formatLaw(law: Law): string {
  const lines: string[] = [];

  const header = law.title
    ? `Murphy's Law #${law.id}: ${law.title}`
    : `Murphy's Law #${law.id}`;
  lines.push(header);
  lines.push(`"${law.text}"`);

  const attrs = parseAttributions(law.attributions);
  const namedAttrs = attrs.filter(a => a.name && a.name !== 'Anonymous');
  if (namedAttrs.length > 0) {
    lines.push(`Attribution: ${namedAttrs.map(a => a.name).join(', ')}`);
  }

  if (law.category_name) {
    lines.push(`Category: ${law.category_name}`);
  }

  const upvotes = law.upvotes ?? 0;
  const downvotes = law.downvotes ?? 0;
  const score = law.score ?? (upvotes - downvotes);
  const sign = score >= 0 ? '+' : '';
  lines.push(`Score: ${sign}${score} (${upvotes} upvotes, ${downvotes} downvotes)`);

  if (law.corollary_of) {
    lines.push(`Corollary of: #${law.corollary_of.id} ${describeParent(law.corollary_of)}`);
  }

  if (law.corollaries && law.corollaries.length > 0) {
    lines.push(`Corollaries (${law.corollaries.length}):`);
    for (const corollary of law.corollaries) {
      const score = corollary.upvotes - corollary.downvotes;
      lines.push(`- #${corollary.id}${corollaryLabel(corollary)}: ${corollary.text} (${score >= 0 ? '+' : ''}${score})`);
    }
  }

  lines.push(`Source: https://murphys-laws.com/law/${law.id}`);

  return lines.join('\n');
}

export function formatLawList(laws: Law[], total?: number): string {
  if (laws.length === 0) {
    return 'No laws found.';
  }

  const parts = laws.map(formatLaw);

  if (total !== undefined && total > laws.length) {
    parts.push(`\n(Showing ${laws.length} of ${total} results)`);
  }

  return parts.join('\n\n---\n\n');
}
