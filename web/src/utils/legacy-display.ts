// Kindle (e-ink) browser detection. E-ink panels ghost on animation and ad overlays cover the small
// screen, so Kindle gets a static, ad-free page.

export function isKindleBrowser(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Kindle|Silk/i.test(userAgent);
}

/** Adds `legacy-display` to <html> on Kindle so CSS can drop animation and header extras. */
export function applyLegacyDisplayClass(doc: Document = document, userAgent?: string): void {
  if (isKindleBrowser(userAgent)) {
    doc.documentElement.classList.add('legacy-display');
  }
}
