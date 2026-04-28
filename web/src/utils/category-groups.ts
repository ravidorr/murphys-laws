export interface GroupableCategory {
  slug: string;
  title: string;
  law_count?: number;
}

export interface CategoryGroup<T extends GroupableCategory> {
  name: string;
  description: string;
  categories: T[];
}

const GROUP_DEFINITIONS: { name: string; description: string; keywords: string[] }[] = [
  {
    name: 'Technology',
    description: 'Computers, software, engineering, printing, photography, and technical systems.',
    keywords: ['computer', 'technology', 'software', 'printing', 'photography', 'microbiology', 'graphic-design']
  },
  {
    name: 'Work',
    description: 'Office, teaching, commerce, healthcare, project, and professional life.',
    keywords: ['office', 'employees', 'teaching', 'commerce', 'nurses', 'emt', 'repairmen', 'mechanics']
  },
  {
    name: 'Transport',
    description: 'Cars, buses, travel, aviation, ships, elevators, and anything that moves.',
    keywords: ['cars', 'bus', 'travel', 'airplanes', 'helicopters', 'marine', 'elevator', 'tanks']
  },
  {
    name: 'Relationships',
    description: 'Love, family, mothers, toddlers, and social life.',
    keywords: ['love', 'mothers', 'toddlers']
  },
  {
    name: 'Everyday Life',
    description: 'Home, hobbies, sport, alarms, lotto, and ordinary trouble.',
    keywords: ['alarm', 'sport', 'golf', 'music', 'sewing', 'lotto', 'rental', 'real-estate', 'horse']
  },
  {
    name: 'Historical and Military',
    description: 'Military, war, scouting, police, and field operations.',
    keywords: ['war', 'military', 'desert', 'fighting', 'police', 'scouting', 'bushfire']
  },
  {
    name: 'Specialized',
    description: 'Games, fandoms, niche hobbies, and specialist collections.',
    keywords: ['role-playing', 'game', 'transformers', 'jagged', 'cowboy', 'martial']
  }
];

function getGroupName(slug: string): string {
  const normalizedSlug = slug.toLowerCase();
  const definition = GROUP_DEFINITIONS.find((group) => group.keywords.some((keyword) => normalizedSlug.includes(keyword)));
  return definition?.name ?? 'Specialized';
}

export function groupCategories<T extends GroupableCategory>(categories: T[]): CategoryGroup<T>[] {
  const byName = new Map<string, T[]>();
  categories.forEach((category) => {
    const groupName = getGroupName(category.slug);
    const groupCategories = byName.get(groupName) ?? [];
    groupCategories.push(category);
    byName.set(groupName, groupCategories);
  });

  return GROUP_DEFINITIONS
    .filter((definition) => byName.has(definition.name))
    .map((definition) => ({
      name: definition.name,
      description: definition.description,
      categories: [...byName.get(definition.name)!].sort((a, b) => a.title.localeCompare(b.title))
    }));
}
