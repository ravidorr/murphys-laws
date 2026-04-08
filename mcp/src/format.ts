interface Attribution {
  name?: string;
  note?: string;
}

export interface LawData {
  id: number;
  title?: string | null;
  text: string;
  attributions?: Attribution[] | string;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  category_name?: string;
  category_slug?: string;
  [key: string]: unknown;
}

function parseAttributions(attributions: Attribution[] | string | undefined): Attribution[] {
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

export function formatLaw(law: LawData): string {
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

  lines.push(`Source: https://murphys-laws.com/law/${law.id}`);

  return lines.join('\n');
}

export function formatLawList(laws: LawData[], total?: number): string {
  if (laws.length === 0) {
    return 'No laws found.';
  }

  const parts = laws.map(formatLaw);

  if (total !== undefined && total > laws.length) {
    parts.push(`\n(Showing ${laws.length} of ${total} results)`);
  }

  return parts.join('\n\n---\n\n');
}
