// Kindle (e-ink) browser detection. E-ink panels ghost on animation and ad overlays cover the small
// screen, so Kindle gets a static, ad-free page. The e-ink Kindle user agent ends in "Kindle/3.0+".
// Fire tablets (colour, "Silk" in the user agent) are deliberately not matched.

export function isKindleBrowser(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Kindle\//i.test(userAgent);
}

/** Adds `legacy-display` to <html> on Kindle so CSS can drop animation and header extras. */
export function applyLegacyDisplayClass(doc: Document = document, userAgent?: string): void {
  if (isKindleBrowser(userAgent)) {
    doc.documentElement.classList.add('legacy-display');
  }
}
