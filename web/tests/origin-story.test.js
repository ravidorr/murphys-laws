import { describe, it, expect, vi } from 'vitest';
import { OriginStory } from '../src/views/origin-story.js';
import * as structuredData from '../src/modules/structured-data.js';

// Mock dependencies
vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com'
}));

describe('OriginStory view', () => {
  it('renders the origin story content', () => {
    const el = OriginStory({ onNavigate: vi.fn() });
    expect(el.innerHTML).toContain("The True Origin of Murphy's Law");
    expect(el.innerHTML).toContain('Edward A. Murphy Jr.');
  });

  it('sets structured data for the article', () => {
    OriginStory({ onNavigate: vi.fn() });
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('origin-story-article', expect.objectContaining({
      '@type': 'Article',
      'headline': "The True Origin of Murphy's Law"
    }));
  });
});
