import { createLawListSection } from '../src/components/law-list-section.js';

describe('LawListSection component', () => {
  it('creates law list section element', () => {
    const { el } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('card');
  });

  it('renders title with accent and remainder text', () => {
    const { el } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    const title = el.querySelector('.card-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Top');
    expect(title.textContent).toContain('Voted');
  });

  it('shows loading placeholder initially', () => {
    const { el } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    const loadingEl = el.querySelector('.loading-placeholder');
    expect(loadingEl).toBeTruthy();
  });

  it('renders laws when provided', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    const laws = [
      { id: 1, text: 'Law 1', upvotes: 10, downvotes: 0 },
      { id: 2, text: 'Law 2', upvotes: 5, downvotes: 0 }
    ];

    renderLaws(laws);

    const content = el.querySelector('.card-content');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('Law 1');
    expect(content.textContent).toContain('Law 2');
  });

  it('handles empty laws array', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    renderLaws([]);

    const lawCards = el.querySelectorAll('.law-card');
    expect(lawCards.length).toBe(0);
  });

  it('handles non-array input gracefully', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    renderLaws(null);
    renderLaws(undefined);
    renderLaws('not an array');

    // Should not throw
    expect(el).toBeTruthy();
  });

  it('applies skip and limit parameters', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    const laws = [
      { id: 1, text: 'Law 1', upvotes: 0, downvotes: 0 },
      { id: 2, text: 'Law 2', upvotes: 0, downvotes: 0 },
      { id: 3, text: 'Law 3', upvotes: 0, downvotes: 0 },
      { id: 4, text: 'Law 4', upvotes: 0, downvotes: 0 }
    ];

    renderLaws(laws, { skip: 1, limit: 2 });

    // Check that content was rendered
    const content = el.querySelector('.card-content');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('Law 2');
    expect(content.textContent).toContain('Law 3');
    expect(content.textContent).not.toContain('Law 1');
    expect(content.textContent).not.toContain('Law 4');
  });

  it('renders error state', () => {
    const { el, renderError } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    renderError('Something went wrong');

    const errorEl = el.querySelector('.error-state');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Something went wrong');
  });

  it('handles missing content div gracefully', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    // Remove content div
    const contentDiv = el.querySelector('.card-content');
    contentDiv.remove();

    // Should not throw
    expect(() => {
      renderLaws([{ id: 1, content: 'Law 1' }]);
    }).not.toThrow();
  });

  it('handles missing content div in renderError', () => {
    const { el, renderError } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    // Remove content div
    const contentDiv = el.querySelector('.card-content');
    contentDiv.remove();

    // Should not throw
    expect(() => {
      renderError('Error message');
    }).not.toThrow();
  });

  it('only adds voting listeners when laws are present', () => {
    const { el, renderLaws } = createLawListSection({
      accentText: 'Top',
      remainderText: ' Voted'
    });

    // Render with no laws
    renderLaws([]);

    // Should not have voting buttons
    const voteButtons = el.querySelectorAll('[data-vote]');
    expect(voteButtons.length).toBe(0);

    // Render with laws
    renderLaws([{ id: 1, text: 'Law 1', upvotes: 0, downvotes: 0 }]);

    // Should have voting buttons
    const voteButtonsAfter = el.querySelectorAll('[data-vote]');
    expect(voteButtonsAfter.length).toBeGreaterThan(0);
  });
});

