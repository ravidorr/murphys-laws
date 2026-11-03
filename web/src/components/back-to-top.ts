/**
 * Back to top: a floating button that appears once the page is scrolled past a threshold.
 * Mounted once on document.body (not per route), so it survives navigation.
 * Skipped on Kindle / e-ink, where fixed overlays and smooth scrolling redraw badly.
 */
import { createIcon } from '@utils/icons.ts';
import { isKindleBrowser } from '@utils/legacy-display.ts';

/** Scroll distance (px) after which the button appears. */
export const BACK_TO_TOP_THRESHOLD = 600;

const BUTTON_CLASS = 'back-to-top';
const VISIBLE_CLASS = 'back-to-top--visible';

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

  // The button hides itself once the page is at the top; hand keyboard focus to the main
  // landmark so it is not lost to <body>.
  const main = document.getElementById('main-content');
  if (main) {
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
    main.focus({ preventScroll: true });
  }
}

/**
 * Create the button and wire the scroll listener.
 * @returns The button, or null on Kindle. Calling it again returns the existing button.
 */
export function initBackToTop(): HTMLButtonElement | null {
  if (isKindleBrowser()) return null;

  const existing = document.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
  if (existing) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.setAttribute('aria-label', 'Back to top');
  const icon = createIcon('chevronUp');
  if (icon) button.appendChild(icon);
  button.addEventListener('click', scrollToTop);
  document.body.appendChild(button);

  const update = () => {
    button.classList.toggle(VISIBLE_CLASS, window.scrollY > BACK_TO_TOP_THRESHOLD);
  };
  window.addEventListener('scroll', update, { passive: true });
  update();

  return button;
}
