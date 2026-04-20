import type { Category, Law } from 'murphys-laws-sdk';
import type { Colorize } from './colors.js';

interface AttributionLike {
  name?: string;
  note?: string;
}

function parseAttributions(raw: Law['attributions']): AttributionLike[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return raw;
}

export function formatLaw(law: Law, colors: Colorize): string {
  const lines: string[] = [];
  const id = colors.dim(`#${law.id}`);
  const title = law.title ? ` ${colors.bold(law.title)}` : '';
  lines.push(`${colors.cyan("Murphy's Law")} ${id}${title}`);
  lines.push(`"${law.text}"`);

  const attrs = parseAttributions(law.attributions);
  const named = attrs.filter((a) => a.name && a.name !== 'Anonymous').map((a) => a.name);
  if (named.length > 0) {
    lines.push(colors.dim(`Attribution: ${named.join(', ')}`));
  }

  if (law.category_name) {
    lines.push(colors.dim(`Category: ${law.category_name}`));
  }

  const upvotes = law.upvotes ?? 0;
  const downvotes = law.downvotes ?? 0;
  const score = law.score ?? upvotes - downvotes;
  const sign = score >= 0 ? '+' : '';
  lines.push(colors.dim(`Score: ${sign}${score} (${upvotes} up, ${downvotes} down)`));
  lines.push(colors.dim(`Source: https://murphys-laws.com/law/${law.id}`));
  return lines.join('\n');
}

export function formatLawList(laws: Law[], total: number, colors: Colorize): string {
  if (laws.length === 0) {
    return 'No laws found.';
  }
  const parts = laws.map((law) => formatLaw(law, colors));
  if (total > laws.length) {
    parts.push(colors.dim(`(Showing ${laws.length} of ${total} results)`));
  }
  return parts.join('\n\n---\n\n');
}

export function formatCategories(categories: Category[], colors: Colorize): string {
  if (categories.length === 0) {
    return 'No categories available.';
  }
  const lines = categories.map((c) => {
    const desc = c.description ? ` - ${c.description}` : '';
    return `${colors.bold(c.title)} ${colors.dim(`(slug: ${c.slug}, ${c.law_count} laws)`)}${desc}`;
  });
  return `${colors.cyan('Categories')} (${categories.length} total)\n\n${lines.join('\n')}`;
}
