import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initBackToTop, BACK_TO_TOP_THRESHOLD } from '../src/components/back-to-top.ts';

vi.mock('@utils/icons.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/icons.ts')>();
  return { ...actual, createIcon: vi.fn(actual.createIcon) };
});

const KINDLE_UA = 'Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ Kindle/3.0+';

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
  window.dispatchEvent(new Event('scroll'));
}

describe('back-to-top', () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<main id="main-content"></main>';
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('renders an accessible button, hidden at the top', () => {
    const button = initBackToTop()!;
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Back to top');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.classList.contains('back-to-top--visible')).toBe(false);
    expect(document.body.contains(button)).toBe(true);
  });

  it('shows after the threshold and hides again when scrolled back up', () => {
    const button = initBackToTop()!;
    setScrollY(BACK_TO_TOP_THRESHOLD);
    expect(button.classList.contains('back-to-top--visible')).toBe(false);
    setScrollY(BACK_TO_TOP_THRESHOLD + 1);
    expect(button.classList.contains('back-to-top--visible')).toBe(true);
    setScrollY(0);
    expect(button.classList.contains('back-to-top--visible')).toBe(false);
  });

  it('is visible immediately when mounted on an already scrolled page', () => {
    setScrollY(2000);
    expect(initBackToTop()!.classList.contains('back-to-top--visible')).toBe(true);
  });

  it('is idempotent', () => {
    const first = initBackToTop();
    expect(initBackToTop()).toBe(first);
    expect(document.querySelectorAll('.back-to-top')).toHaveLength(1);
  });

  it('scrolls smoothly and moves focus to main on click', () => {
    initBackToTop()!.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
    const main = document.getElementById('main-content')!;
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(main);
  });

  it('keeps an existing tabindex on main', () => {
    document.getElementById('main-content')!.setAttribute('tabindex', '0');
    initBackToTop()!.click();
    expect(document.getElementById('main-content')!.getAttribute('tabindex')).toBe('0');
  });

  it('scrolls instantly under prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    initBackToTop()!.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('uses smooth scrolling when matchMedia reports no reduced-motion preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    initBackToTop()!.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  });

  it('still scrolls when there is no main landmark', () => {
    document.body.innerHTML = '';
    initBackToTop()!.click();
    expect(scrollTo).toHaveBeenCalled();
  });

  it('removes the temporary tabindex from main when focus leaves it', () => {
    initBackToTop()!.click();
    const main = document.getElementById('main-content')!;
    main.dispatchEvent(new Event('blur'));
    expect(main.hasAttribute('tabindex')).toBe(false);
  });

  it('still mounts the button if the icon cannot be created', async () => {
    const { createIcon } = await import('../src/utils/icons.ts');
    vi.mocked(createIcon).mockReturnValueOnce(null);
    expect(initBackToTop()!.querySelector('svg')).toBeNull();
  });

  it('is not mounted on Kindle', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(KINDLE_UA);
    expect(initBackToTop()).toBeNull();
    expect(document.querySelector('.back-to-top')).toBeNull();
  });
});
