// Shared navigation event handlers
// Eliminates ~40 lines of duplicate [data-nav] click/keyboard handling across 5+ views

import type { OnNavigate } from '../types/app.d.ts';

/**
 * Handles [data-nav] click events via event delegation.
 * Returns true if the event was handled (navigation occurred).
 */
export function handleNavClick(target: Element, onNavigate: OnNavigate): boolean {
  const navBtn = target.closest('[data-nav]');
  if (!navBtn) return false;

  const navTarget = navBtn.getAttribute('data-nav');
  const param = navBtn.getAttribute('data-param');
  if (navTarget) {
    if (param) {
      onNavigate(navTarget, param);
    } else {
      onNavigate(navTarget);
    }
    return true;
  }
  return false;
}

/**
 * Handles keyboard activation (Enter/Space) on .law-card-mini elements.
 * Returns true if the event was handled.
 */
export function handleLawCardKeydown(e: KeyboardEvent, onNavigate: OnNavigate): boolean {
  if (e.key !== 'Enter' && e.key !== ' ') return false;

  const t = e.target;
  if (!(t instanceof Element)) return false;

  const lawCard = t.closest('.law-card-mini') as HTMLElement | null;
  if (lawCard && lawCard.dataset.lawId) {
    // Don't navigate if focus is on a button inside the card
    if (t.closest('button')) return false;
    e.preventDefault();
    onNavigate('law', lawCard.dataset.lawId);
    return true;
  }
  return false;
}

/**
 * Adds standard navigation listeners to a container element.
 * Includes [data-nav] click handler and .law-card-mini keyboard handler.
 */
export function addNavigationListener(el: HTMLElement, onNavigate: OnNavigate): void {
  el.addEventListener('keydown', (e) => {
    handleLawCardKeydown(e, onNavigate);
  });
}
