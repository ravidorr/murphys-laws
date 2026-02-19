// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { OriginStory } from '../src/views/origin-story.js';
import * as structuredData from '../src/modules/structured-data.js';

// Mock dependencies
vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive"
}));
vi.mock('../src/utils/ads.js', () => ({
  triggerAdSense: vi.fn()
}));

describe('OriginStory view', () => {
  it('renders the origin story content', () => {
    const el = OriginStory({ onNavigate: vi.fn() });
    // Content is now rendered via markdown with accent styling on first word
    expect(el.innerHTML).toContain('True Origin of Murphy');
    expect(el.innerHTML).toContain('Edward A. Murphy Jr.');
  });

  it('sets structured data for the article', () => {
    OriginStory({ onNavigate: vi.fn() });
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('origin-story-article', expect.objectContaining({
      '@type': 'Article',
      'headline': "The True Origin of Murphy's Law"
    }));
  });

  it('renders without onNavigate provided', () => {
    const el = OriginStory();
    expect(el.innerHTML).toContain('True Origin of Murphy');
  });

  it('handles navigation click with data-nav attribute', () => {
    const onNavigate = vi.fn();
    const el = OriginStory({ onNavigate });
    
    // Create and append a navigation button
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    
    navBtn.click();
    
    expect(onNavigate).toHaveBeenCalledWith('about');
  });

  it('ignores click when target has no data-nav', () => {
    const onNavigate = vi.fn();
    const el = OriginStory({ onNavigate });
    
    const regularBtn = document.createElement('button');
    el.appendChild(regularBtn);
    
    regularBtn.click();
    
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores click when onNavigate not provided', () => {
    const el = OriginStory();
    
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    
    // Should not throw
    expect(() => navBtn.click()).not.toThrow();
  });

  it('ignores click on non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    const el = OriginStory({ onNavigate });
    
    // Simulate click event with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);
    
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
