import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('web/dist');
// Baseline the existing application entry and fail future regressions above it.
const maxInitialJavaScript = 470 * 1024;
const maxPrecache = 1.5 * 1024 * 1024;

const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
const entryScripts = [...indexHtml.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)]
  .map((match) => match[1].replace(/^\//, ''));

if (entryScripts.length === 0) throw new Error('No initial module script found in web/dist/index.html');

let initialJavaScript = 0;
for (const file of entryScripts) initialJavaScript += (await stat(path.join(distDir, file))).size;

const serviceWorker = await readFile(path.join(distDir, 'sw.js'), 'utf8');
const precachedUrls = [...serviceWorker.matchAll(/\{url:"([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^https?:/.test(url));
let precacheBytes = 0;
for (const url of new Set(precachedUrls)) {
  const file = url.replace(/^\//, '').split('?')[0];
  try {
    precacheBytes += (await stat(path.join(distDir, file))).size;
  } catch {
    // Revisioned Workbox URLs can include entries produced outside dist; ignore missing files.
  }
}

console.log(`Initial JavaScript: ${initialJavaScript} bytes (budget ${maxInitialJavaScript})`);
console.log(`Service-worker precache: ${precacheBytes} bytes (budget ${maxPrecache})`);

if (initialJavaScript > maxInitialJavaScript) throw new Error('Initial JavaScript budget exceeded');
if (precacheBytes > maxPrecache) throw new Error('Service-worker precache budget exceeded');
