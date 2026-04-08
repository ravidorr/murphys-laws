import { triggerAdSense } from '../utils/ads.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

export function Developers({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  document.title = `Developers | ${SITE_NAME}`;
  updateMetaDescription("REST API, MCP server, and developer tools for Murphy's Laws. Integrate 1,500+ laws into your apps and AI agents.");

  el.innerHTML = developersHtml;
  triggerAdSense(el);

  setExportContent({
    type: ContentType.CONTENT,
    title: 'Developers — Murphy\'s Law Archive',
    data: developersHtml
  });

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) onNavigate(navTarget);
    }
  });

  (el as CleanableElement).cleanup = () => { clearExportContent(); };

  return el;
}

const developersHtml = `
<article class="card content-card">
  <header class="card-header content-header">
    <h1><span class="accent-text">Developers</span></h1>
    <p class="lead">
      Free REST API, MCP server for AI agents, and machine-readable feeds.
      No API key required for reads. Integrate 1,500+ Murphy's Laws into anything.
    </p>
  </header>
  <div class="card-body">

    <section class="content-section">
      <h2><span class="accent-text">MCP</span> Server</h2>
      <p>
        A <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">Model Context Protocol</a>
        server lets AI agents query Murphy's Laws directly. Works with Claude Desktop,
        Cursor, VS Code Copilot, and any MCP-compatible host.
      </p>
      <h3>Quick Start</h3>
      <p>Add to your MCP client config (e.g. <code>claude_desktop_config.json</code>):</p>
      <pre><code>{
  "mcpServers": {
    "murphys-laws": {
      "command": "npx",
      "args": ["-y", "murphys-laws-mcp"]
    }
  }
}</code></pre>
      <p>That's it. No API key, no database, no setup.</p>
      <p>
        <strong>npm:</strong>
        <a href="https://www.npmjs.com/package/murphys-laws-mcp" target="_blank" rel="noopener">murphys-laws-mcp</a>
        &nbsp;|&nbsp;
        <strong>Source:</strong>
        <a href="https://github.com/ravidorr/murphys-laws/tree/main/mcp" target="_blank" rel="noopener">GitHub</a>
      </p>
      <h3>Tools</h3>
      <table>
        <thead><tr><th>Tool</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>search_laws</code></td><td>Search laws by keyword with optional category filter</td></tr>
          <tr><td><code>get_random_law</code></td><td>Get a random Murphy's Law</td></tr>
          <tr><td><code>get_law_of_the_day</code></td><td>Get today's featured law (rotates daily)</td></tr>
          <tr><td><code>get_law</code></td><td>Get a specific law by ID</td></tr>
          <tr><td><code>list_categories</code></td><td>List all 55 categories with slugs and law counts</td></tr>
          <tr><td><code>get_laws_by_category</code></td><td>Browse laws in a specific category</td></tr>
          <tr><td><code>submit_law</code></td><td>Submit a new law for review</td></tr>
        </tbody>
      </table>
    </section>

    <section class="content-section">
      <h2><span class="accent-text">REST</span> API</h2>
      <p>Base URL: <code>https://murphys-laws.com</code></p>
      <table>
        <thead><tr><th>Endpoint</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>GET /api/v1/laws</code></td><td>List and search laws. Params: <code>q</code>, <code>category_slug</code>, <code>limit</code>, <code>offset</code>, <code>sort</code>, <code>order</code></td></tr>
          <tr><td><code>GET /api/v1/laws/:id</code></td><td>Get a single law with attributions and category</td></tr>
          <tr><td><code>GET /api/v1/laws/random</code></td><td>Get a random published law</td></tr>
          <tr><td><code>GET /api/v1/law-of-day</code></td><td>Today's featured law (selected daily by popularity)</td></tr>
          <tr><td><code>GET /api/v1/categories</code></td><td>All 55 categories with law counts</td></tr>
          <tr><td><code>GET /api/v1/categories/:id</code></td><td>Single category details</td></tr>
          <tr><td><code>POST /api/v1/laws</code></td><td>Submit a new law for review</td></tr>
        </tbody>
      </table>
      <h3>Example</h3>
      <pre><code>curl "https://murphys-laws.com/api/v1/laws?q=computer&amp;limit=2"</code></pre>
      <p>
        <strong>Full spec:</strong>
        <a href="/openapi.json" target="_blank">OpenAPI 3.0</a>
      </p>
    </section>

    <section class="content-section">
      <h2><span class="accent-text">Feeds</span></h2>
      <ul>
        <li><a href="/api/v1/feed.rss">RSS 2.0</a> — Recent laws and law of the day</li>
        <li><a href="/api/v1/feed.atom">Atom 1.0</a> — Recent laws and law of the day</li>
      </ul>
    </section>

    <section class="content-section">
      <h2><span class="accent-text">Machine-Readable</span> Resources</h2>
      <ul>
        <li><a href="/llms.txt">llms.txt</a> — Concise reference for AI agents</li>
        <li><a href="/llms-full.txt">llms-full.txt</a> — Full API reference with examples and all category slugs</li>
        <li><a href="/openapi.json">openapi.json</a> — OpenAPI 3.0.3 specification</li>
        <li><a href="/robots.txt">robots.txt</a> — Crawler rules (AI-friendly)</li>
        <li><a href="/sitemap.xml">sitemap.xml</a> — XML sitemap</li>
      </ul>
    </section>

    <section class="content-section">
      <h2><span class="accent-text">Rate</span> Limits</h2>
      <p>
        <strong>Reads:</strong> Unlimited. No authentication required.<br>
        <strong>Writes:</strong> 5 law submissions/hour, 60 votes/hour per IP.
      </p>
    </section>

  </div>
</article>
`;
