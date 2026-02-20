/**
 * Generates a rich description for a category based on its title and law count.
 * Used for SSG and dynamic rendering to provide context.
 */
export function generateCategoryDescription(title: string, lawCount: number): string {
  const templates = [
    `Explore ${lawCount} laws about ${title}. From specific cases to general principles, this collection covers the inevitable mishaps.`,
    `Discover why things go wrong in ${title}. A comprehensive archive of ${lawCount} Murphy's Laws and corollaries.`,
    `The ultimate collection of ${lawCount} laws regarding ${title}. If it can go wrong, it will, and usually at the worst time.`,
    `Dive into the pessimism of ${title}. Here are ${lawCount} reasons why you should always have a backup plan.`,
    `Everything you need to know about ${title} and why it fails. A curated list of ${lawCount} observations.`
  ];

  // Deterministic selection based on title char code sum to be stable
  const sum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = sum % templates.length;

  // Index is always valid: computed via modulo on non-empty const array
  return templates[index] as string;
}
