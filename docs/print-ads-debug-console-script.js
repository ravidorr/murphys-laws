/**
 * Run this in the browser Console on PRODUCTION (murphys-laws.com/browse)
 * when ads are visible. Paste the full output for the debug session.
 * No need to run on localhost (ads do not show there).
 */
(function () {
  const sel = [
    '.footer-ad-shell', '.adsbygoogle', '[data-ad-slot]', '[data-ad-client]',
    '[id^="google_ads"]', '[id*="google_ads_iframe"]',
    'iframe[src*="googlesyndication.com"]', 'iframe[src*="doubleclick.net"]',
    '[class*="ads"]', '[id*="google"]'
  ];
  const out = { host: location.host, selectors: {} };
  sel.forEach(s => {
    try {
      const list = document.querySelectorAll(s);
      out.selectors[s] = { count: list.length, nodes: [] };
      for (let i = 0; i < Math.min(list.length, 5); i++) {
        const el = list[i];
        const node = { tag: el.tagName, id: el.id || null, class: (el.className && typeof el.className === 'string') ? el.className : null };
        if (el.tagName === 'IFRAME') node.src = el.getAttribute('src') || null;
        out.selectors[s].nodes.push(node);
      }
    } catch (e) {
      out.selectors[s] = { count: -1, error: e.message };
    }
  });
  console.log(JSON.stringify(out, null, 2));
  return out;
})();
