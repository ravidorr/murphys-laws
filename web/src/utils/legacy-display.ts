// Kindle (e-ink) browser detection. E-ink panels ghost on animation and ad overlays cover the small
// screen, so Kindle gets a static, ad-free page. Older e-ink Kindles end their user agent in
// "Kindle/3.0+"; newer ones (Scribe) send "Android 9; Kindle Build/1.0 ... Silk/80". Fire tablets
// (colour, "KF<model> Build/" plus "Silk") are deliberately not matched.

export function isKindleBrowser(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Kindle(\/| Build\/)/i.test(userAgent);
}

/** Adds `legacy-display` to <html> on Kindle so CSS can drop animation and header extras. */
export function applyLegacyDisplayClass(doc: Document = document, userAgent?: string): void {
  if (isKindleBrowser(userAgent)) {
    doc.documentElement.classList.add('legacy-display');
  }
}
