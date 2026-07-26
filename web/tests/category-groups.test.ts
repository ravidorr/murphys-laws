import { describe, expect, it } from 'vitest';
import { groupCategories } from '../src/utils/category-groups.ts';

describe('category groups', () => {
  it('returns no groups for an empty category list', () => {
    expect(groupCategories([])).toEqual([]);
  });

  it('groups known category slugs into editorial clusters', () => {
    const groups = groupCategories([
      { slug: 'murphys-computer-laws', title: "Murphy's Computer Laws" },
      { slug: 'murphys-office-laws', title: "Murphy's Office Laws" },
      { slug: 'murphys-travel-laws', title: "Murphy's Travel Laws" },
      { slug: 'murphys-love-laws', title: "Murphy's Love Laws" },
      { slug: 'murphys-alarm-clock-laws', title: "Murphy's Alarm Clock Laws" },
      { slug: 'murphys-war-laws', title: "Murphy's War Laws" },
      { slug: 'murphys-game-mastering-laws', title: "Murphy's Game Mastering Laws" },
    ]);

    expect(groups.map((group) => group.name)).toEqual([
      'Technology',
      'Work',
      'Transport',
      'Relationships',
      'Everyday Life',
      'Historical and Military',
      'Specialized',
    ]);
  });

  it('sorts categories within groups and falls back to Specialized', () => {
    const groups = groupCategories([
      { slug: 'uncategorized-mishaps', title: 'Zebra Mishaps' },
      { slug: 'another-uncategorized-mishaps', title: 'Alpha Mishaps' },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('Specialized');
    expect(groups[0]!.categories.map((category) => category.title)).toEqual([
      'Alpha Mishaps',
      'Zebra Mishaps',
    ]);
  });
});
