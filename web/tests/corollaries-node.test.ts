// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderCorollarySection, renderParentBanner } from '../src/utils/corollaries.ts';

// The static site generator runs the markup functions in Node, where there is no document or window.
describe('corollary markup without a DOM', () => {
  it('renders the static section and banner', () => {
    expect(typeof document).toBe('undefined');
    const section = renderCorollarySection(
      [{ id: 1, title: 'A <b>title</b>', text: 'Some & text that is long enough.', upvotes: 2, downvotes: 0 }],
      { interactive: false }
    );
    expect(section).toContain('A &lt;b&gt;title&lt;/b&gt;');
    expect(section).toContain('Some &amp; text');
    expect(section).toContain('2 up, 0 down');
    // The static page links to the submit form too, with a plain href that works without scripts
    expect(section).toContain('Corollaries are added when you <a href="/submit" data-submit-link>submit a law</a>');
    expect(renderParentBanner({ id: 9, title: 'Parent', text: 'Parent text.' })).toContain('href="/law/9"');
  });
});
