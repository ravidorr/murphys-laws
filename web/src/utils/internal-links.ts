export interface InternalLink {
  href: string;
  label: string;
  description: string;
}

interface LawLinkContext {
  categorySlug?: string | null;
  categoryName?: string | null;
}

const HUB_LINKS: InternalLink[] = [
  { href: '/best-murphys-laws', label: "Best Murphy's Laws", description: 'Start with the strongest archive entries.' },
  { href: '/funniest-murphys-laws', label: "Funniest Murphy's Laws", description: 'Browse the sharpest comic failures.' },
  { href: '/murphys-laws-about-work', label: "Murphy's Laws About Work", description: 'Office, project, and meeting mishaps.' },
  { href: '/murphys-laws-about-technology', label: "Murphy's Laws About Technology", description: 'Software, systems, and technical failures.' },
  { href: '/murphys-law-vs-sods-law', label: "Murphy's Law vs Sod's Law", description: 'Understand the difference between the two maxims.' },
];

const CATEGORY_LINKS: Record<string, InternalLink[]> = {
  'murphys-technology-laws': [
    { href: '/murphys-laws-about-technology', label: 'Technology hub', description: 'A curated technology-focused Murphy hub.' },
    { href: '/examples/tech', label: 'Technology examples', description: 'Real situations where tech goes sideways.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Model task risk with urgency and complexity.' },
  ],
  'murphys-computer-laws': [
    { href: '/murphys-laws-about-technology', label: 'Technology hub', description: 'Software, hardware, and system failures.' },
    { href: '/examples/tech', label: 'Technology examples', description: 'Common tech scenarios with linked laws.' },
    { href: '/category/murphys-technology-laws', label: 'Related technology laws', description: 'A broader technical category.' },
  ],
  'murphys-office-laws': [
    { href: '/murphys-laws-about-work', label: 'Work hub', description: 'Murphy at meetings, email, and planning.' },
    { href: '/examples/work', label: 'Work examples', description: 'Real workplace scenarios.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Estimate risk before the deadline does.' },
  ],
  'murphys-travel-laws': [
    { href: '/examples/travel', label: 'Travel examples', description: 'Flights, luggage, weather, and timing.' },
    { href: '/category/murphys-bus-laws', label: 'Bus laws', description: 'Related transport frustrations.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Model what pressure does to travel plans.' },
  ],
  'murphys-love-laws': [
    { href: '/examples/everyday-life', label: 'Everyday examples', description: 'Life and relationship-adjacent mishaps.' },
    { href: '/funniest-murphys-laws', label: 'Funny laws', description: 'Humor that starts with painful recognition.' },
  ],
};

export function getHubLinks(): InternalLink[] {
  return [...HUB_LINKS];
}

export function getLawDetailInternalLinks(context: LawLinkContext): InternalLink[] {
  if (!context.categorySlug) {
    return [
      { href: '/browse', label: 'Browse all laws', description: 'Search the complete archive.' },
      { href: '/categories', label: 'Browse categories', description: 'Find laws by topic.' },
      HUB_LINKS[0]!,
    ];
  }

  return [
    {
      href: `/category/${context.categorySlug}`,
      label: context.categoryName || 'Same category',
      description: 'Read more laws in this category.',
    },
    ...(CATEGORY_LINKS[context.categorySlug] ?? []),
  ].slice(0, 4);
}

export function getCategoryHubLinks(categorySlug: string): InternalLink[] {
  return CATEGORY_LINKS[categorySlug] ?? [
    { href: '/best-murphys-laws', label: "Best Murphy's Laws", description: 'A curated starting point.' },
    { href: '/categories', label: 'All categories', description: 'Find neighboring topics.' },
  ];
}

export function getCalculatorScenarioLinks(calculator: 'sods-law' | 'buttered-toast'): InternalLink[] {
  if (calculator === 'sods-law') {
    return [
      { href: '/murphys-law-vs-sods-law', label: "Murphy's Law vs Sod's Law", description: 'Why this calculator uses Sod’s framing.' },
      { href: '/examples/work', label: 'Work examples', description: 'Deadline and meeting scenarios.' },
      { href: '/category/murphys-office-laws', label: 'Office laws', description: 'Where pressure tends to break plans.' },
    ];
  }

  return [
    { href: '/examples/everyday-life', label: 'Everyday examples', description: 'Small domestic failures with familiar timing.' },
    { href: '/funniest-murphys-laws', label: 'Funny laws', description: 'More memorable failures.' },
    { href: '/category/murphys-gravity-laws', label: 'Gravity laws', description: 'Related falling-object trouble.' },
  ];
}

export function renderInternalLinkList(links: InternalLink[]): string {
  return `
    <ul class="internal-link-list">
      ${links.map((link) => `
        <li>
          <a href="${link.href}">${link.label}</a>
          <span>${link.description}</span>
        </li>
      `).join('')}
    </ul>`;
}
