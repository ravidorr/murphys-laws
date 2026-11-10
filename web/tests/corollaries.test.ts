import { describe, it, expect, beforeEach } from 'vitest';
import {
  corollaryCountLabel,
  corollaryDisplayTitle,
  renderCorollaryCards,
  renderCorollarySection,
  renderParentBanner
} from '../src/utils/corollaries.ts';
import { lawDisplayTitle } from '../src/utils/seo.ts';
import type { Corollary } from '../src/types/app.d.ts';

const ignition: Corollary = {
  id: 11,
  title: 'The Ignition Corollary',
  text: 'The restart always feels twice as long when the driver behind you has a horn.',
  upvotes: 4,
  downvotes: 1
};

function render(html: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper;
}

describe('lawDisplayTitle', () => {
  it('keeps a real title', () => {
    expect(lawDisplayTitle({ id: 1, title: 'The Start-Stop Synchronicity', text: 'Anything.' })).toBe('The Start-Stop Synchronicity');
  });

  it('names a generic title from the text without its closing punctuation', () => {
    expect(lawDisplayTitle({ id: 1, title: 'Corollary', text: 'The light stays green just long enough to miss it.' })).toBe(
      'The light stays green just long enough to miss it'
    );
  });

  it('cuts a long text at a word', () => {
    const text = 'The light stays green exactly long enough for you to miss it, and then it turns red again before you reach it';
    const title = lawDisplayTitle({ id: 1, title: null, text }, 40);
    expect(title.length).toBeLessThanOrEqual(40);
    expect(title.endsWith('...')).toBe(true);
  });
});

describe('corollary markup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('labels the count in singular and plural', () => {
    expect(corollaryCountLabel(1)).toBe('1 consequence of this law');
    expect(corollaryCountLabel(2)).toBe('2 consequences of this law');
  });

  it('names a corollary by its own title when it has one', () => {
    expect(corollaryDisplayTitle(ignition)).toBe('The Ignition Corollary');
  });

  it('renders a linked title, the text and vote buttons for an interactive card', () => {
    const card = render(renderCorollaryCards([ignition], { interactive: true })).querySelector('.corollary-card') as HTMLElement;
    expect(card.dataset.lawId).toBe('11');
    const link = card.querySelector('h3 a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/law/11');
    expect(link.textContent).toBe('The Ignition Corollary');
    expect(card.querySelector('.corollary-card-text')?.textContent).toBe(ignition.text);
    const up = card.querySelector('button[data-vote="up"]') as HTMLElement;
    const down = card.querySelector('button[data-vote="down"]') as HTMLElement;
    expect(up.getAttribute('data-law-id')).toBe('11');
    expect(up.getAttribute('aria-label')).toBe('Upvote corollary: The Ignition Corollary');
    expect(down.getAttribute('aria-label')).toBe('Downvote corollary: The Ignition Corollary');
    expect(up.querySelector('.count-num')?.textContent).toBe('4');
    expect(down.querySelector('.count-num')?.textContent).toBe('1');
  });

  it('marks the vote the visitor already cast', () => {
    localStorage.setItem('murphy_votes', JSON.stringify({ 11: 'up' }));
    const wrapper = render(renderCorollaryCards([ignition], { interactive: true }));
    expect(wrapper.querySelector('[data-vote="up"]')?.classList.contains('voted')).toBe(true);
    expect(wrapper.querySelector('[data-vote="down"]')?.classList.contains('voted')).toBe(false);

    localStorage.setItem('murphy_votes', JSON.stringify({ 11: 'down' }));
    const second = render(renderCorollaryCards([ignition], { interactive: true }));
    expect(second.querySelector('[data-vote="down"]')?.classList.contains('voted')).toBe(true);
  });

  it('shows plain vote counts instead of buttons for the static site', () => {
    const wrapper = render(renderCorollaryCards([ignition], { interactive: false }));
    expect(wrapper.querySelector('button')).toBeNull();
    expect(wrapper.querySelector('.corollary-card-count')?.textContent).toBe('4 up, 1 down');
  });

  it('treats missing vote counts as zero', () => {
    const odd = { ...ignition, upvotes: Number.NaN, downvotes: undefined as unknown as number };
    const interactive = render(renderCorollaryCards([odd], { interactive: true }));
    expect(interactive.querySelector('[data-vote="up"] .count-num')?.textContent).toBe('0');
    expect(interactive.querySelector('[data-vote="down"] .count-num')?.textContent).toBe('0');
    const staticHtml = render(renderCorollaryCards([odd], { interactive: false }));
    expect(staticHtml.querySelector('.corollary-card-count')?.textContent).toBe('0 up, 0 down');
  });

  it('names a card titled just "Corollary" from its text, without repeating a short text', () => {
    const wrapper = render(renderCorollaryCards(
      [{ id: 12, title: 'Corollary', text: 'The light stays green just long enough to miss it.', upvotes: 0, downvotes: 0 }],
      { interactive: true }
    ));
    expect(wrapper.querySelector('h3 a')?.textContent).toBe('The light stays green just long enough to miss it');
    expect(wrapper.querySelector('.corollary-card-text')).toBeNull();
  });

  it('keeps the full text under a name cut from a long text', () => {
    const text = 'The light stays green exactly long enough for you to miss it, and then it turns red again before you ever reach it.';
    const wrapper = render(renderCorollaryCards([{ id: 13, title: null, text, upvotes: 0, downvotes: 0 }], { interactive: false }));
    expect(wrapper.querySelector('h3 a')?.textContent?.endsWith('...')).toBe(true);
    expect(wrapper.querySelector('.corollary-card-text')?.textContent).toBe(text);
  });

  it('escapes titles and text', () => {
    const wrapper = render(renderCorollaryCards(
      [{ id: 14, title: '<img src=x onerror=alert(1)>', text: '<b>bold</b> corollary text here', upvotes: 0, downvotes: 0 }],
      { interactive: true }
    ));
    expect(wrapper.querySelector('img')).toBeNull();
    expect(wrapper.querySelector('b')).toBeNull();
    expect(wrapper.querySelector('h3 a')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('escapes quotes in the vote button labels and leaves apostrophes single-escaped', () => {
    const wrapper = render(renderCorollaryCards(
      [{ id: 15, title: 'x" onmouseover="alert(1)', text: 'A long enough corollary text here.', upvotes: 0, downvotes: 0 }],
      { interactive: true }
    ));
    const up = wrapper.querySelector('[data-vote="up"]') as HTMLElement;
    expect(up.hasAttribute('onmouseover')).toBe(false);
    expect(up.getAttribute('aria-label')).toBe('Upvote corollary: x" onmouseover="alert(1)');

    const apostrophe = render(renderCorollaryCards(
      [{ id: 16, title: "Murphy's Corollary", text: 'A long enough corollary text here.', upvotes: 0, downvotes: 0 }],
      { interactive: true }
    ));
    expect(apostrophe.querySelector('[data-vote="up"]')?.getAttribute('aria-label')).toBe("Upvote corollary: Murphy's Corollary");
  });

  it('renders the section with a heading, a count and the cards', () => {
    const wrapper = render(renderCorollarySection([ignition, { ...ignition, id: 12, title: 'The Green-Light Corollary' }], { interactive: true }));
    const section = wrapper.querySelector('section.corollary-list') as HTMLElement;
    expect(section.getAttribute('aria-labelledby')).toBe('corollaries-heading');
    expect(section.querySelector('#corollaries-heading')?.textContent).toBe('Corollaries');
    expect(section.querySelector('.corollary-list-count')?.textContent).toBe('2 consequences of this law');
    expect(section.querySelectorAll('.corollary-card')).toHaveLength(2);
  });

  it('renders nothing when there are no corollaries', () => {
    expect(renderCorollarySection([], { interactive: true })).toBe('');
  });

  it('renders the parent banner with its name and an excerpt of its text', () => {
    const banner = render(renderParentBanner({
      id: 5,
      title: 'The Start-Stop Synchronicity',
      text: 'A red traffic light will inevitably turn green exactly one second after you switch to neutral and trigger the automatic start-stop system.'
    })).querySelector('a.parent-banner') as HTMLAnchorElement;
    expect(banner.getAttribute('href')).toBe('/law/5');
    expect(banner.dataset.lawId).toBe('5');
    expect(banner.querySelector('.parent-banner-label')?.textContent).toBe('Corollary of');
    expect(banner.querySelector('.parent-banner-title')?.textContent).toBe('The Start-Stop Synchronicity');
    expect(banner.querySelector('.parent-banner-excerpt')?.textContent?.endsWith('...')).toBe(true);
  });

  it('escapes the parent title and excerpt in the banner', () => {
    const wrapper = render(renderParentBanner({ id: 5, title: '<script>x</script> & "q"', text: 'a < b & c <img src=x onerror=alert(1)>' }));
    expect(wrapper.querySelector('script')).toBeNull();
    expect(wrapper.querySelector('img')).toBeNull();
    expect(wrapper.querySelector('.parent-banner-title')?.textContent).toBe('<script>x</script> & "q"');
    expect(wrapper.querySelector('.parent-banner-excerpt')?.textContent).toBe('a < b & c <img src=x onerror=alert(1)>');
  });

  it('leaves out the excerpt when a generic parent title already came from the whole text', () => {
    const wrapper = render(renderParentBanner({ id: 6, title: "Murphy's Law", text: 'Anything that can go wrong will go wrong.' }));
    expect(wrapper.querySelector('.parent-banner-title')?.textContent).toBe('Anything that can go wrong will go wrong');
    expect(wrapper.querySelector('.parent-banner-excerpt')).toBeNull();
  });
});
