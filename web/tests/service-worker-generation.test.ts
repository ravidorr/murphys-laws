import type fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  collectPrecacheUrls,
  collectPrecacheManifest,
  renderServiceWorker,
  runGenerateServiceWorker,
} from "../scripts/generate-service-worker.ts";

function entry(name: string, type: "directory" | "file"): fs.Dirent {
  return {
    name,
    isDirectory: () => type === "directory",
    isFile: () => type === "file",
  } as fs.Dirent;
}

describe("service worker generation", () => {
  it("collects deployable assets and canonical route URLs", () => {
    const directoryEntries = new Map<string, fs.Dirent[]>([
      [
        "/dist",
        [
          entry("404.html", "file"),
          entry("assets", "directory"),
          entry("index.html", "file"),
          entry("law", "directory"),
          entry("manifest.webmanifest", "file"),
          entry("source.js.map", "file"),
        ],
      ],
      [
        "/dist/assets",
        [
          entry("main.js", "file"),
          entry("site.css", "file"),
        ],
      ],
      ["/dist/law", [entry("42", "directory")]],
      ["/dist/law/42", [entry("index.html", "file")]],
    ]);

    const urls = collectPrecacheUrls(
      "/dist",
      (directory) => directoryEntries.get(directory) ?? [],
    );

    expect(urls).toEqual([
      "/",
      "/assets/main.js",
      "/assets/site.css",
      "/index.html",
      "/manifest.webmanifest",
    ]);
  });

  it("emits native service-worker caching without Workbox or runtime UI frameworks", () => {
    const source = renderServiceWorker({
      revision: "test-revision",
      urls: ["/", "/index.html"],
    });

    expect(source).toContain("self.addEventListener('fetch'");
    expect(source).toContain("caches.match('/offline.html')");
    expect(source).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(source).toContain("self.location.hostname === 'murphys-laws.com'");
    expect(source).toContain("self.registration.unregister()");
    expect(source).toContain("networkFirst(request, RUNTIME, '/index.html')");
    expect(source).not.toContain("cached || networkFirst(request, RUNTIME");
    expect(source).not.toMatch(/workbox|react|babel/i);
  });

  it("keeps canonical-host updates waiting for the user's Refresh action", () => {
    const source = renderServiceWorker({
      revision: "test-revision",
      urls: ["/", "/index.html"],
    });
    const installHandler = source.slice(
      source.indexOf("self.addEventListener('install'"),
      source.indexOf("self.addEventListener('activate'"),
    );

    expect(installHandler).toContain(
      "if (!IS_CANONICAL_HOST) {\n    event.waitUntil(self.skipWaiting());",
    );
    expect(installHandler).not.toContain(
      ".then(() => self.skipWaiting())",
    );
  });

  it("bypasses cache storage for unlisted same-origin API routes", () => {
    const source = renderServiceWorker({
      revision: "test-revision",
      urls: ["/", "/index.html"],
    });
    const apiBypass = source.indexOf("if (isApi) return;");
    const sameOriginFallback = source.indexOf(
      "if (sameOrigin) {",
      apiBypass,
    );

    expect(source).toContain(
      "const isApi = sameOrigin && url.pathname.startsWith('/api/');",
    );
    expect(apiBypass).toBeGreaterThan(-1);
    expect(sameOriginFallback).toBeGreaterThan(apiBypass);
  });

  it("shows the daily law notification and opens only a path on this site when it is clicked", () => {
    const source = renderServiceWorker({ revision: "test-revision", urls: ["/", "/index.html"] });
    const handlers: Record<string, (event: unknown) => void> = {};
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn().mockResolvedValue(undefined);
    const fakeSelf = {
      location: { hostname: "murphys-laws.com", origin: "https://murphys-laws.com" },
      registration: { showNotification },
      clients: { openWindow },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        handlers[type] = handler;
      },
    };
    new Function("self", "caches", "fetch", source)(fakeSelf, {}, async () => new Response("ok"));

    const push = (data: unknown) => handlers.push!({ data, waitUntil: vi.fn() });
    push({ json: () => ({ title: "Sod's Law", body: "Toast lands butter side down", url: "https://murphys-laws.com/law/7" }) });
    expect(showNotification).toHaveBeenLastCalledWith("Sod's Law", expect.objectContaining({
      body: "Toast lands butter side down",
      tag: "law-of-the-day",
      data: { url: "https://murphys-laws.com/law/7" },
    }));

    push(undefined);
    expect(showNotification).toHaveBeenLastCalledWith("Murphy's Law of the Day", expect.objectContaining({ body: "", data: { url: "/" } }));
    push({ json: () => { throw new Error("not json"); } });
    expect(showNotification).toHaveBeenLastCalledWith("Murphy's Law of the Day", expect.objectContaining({ data: { url: "/" } }));

    const click = (url: unknown) => {
      const close = vi.fn();
      handlers.notificationclick!({ notification: { close, data: url === undefined ? undefined : { url } }, waitUntil: vi.fn() });
      expect(close).toHaveBeenCalled();
    };
    click("https://murphys-laws.com/law/7?utm=1");
    expect(openWindow).toHaveBeenLastCalledWith("/law/7?utm=1");
    click("https://evil.example.com/phish");
    expect(openWindow).toHaveBeenLastCalledWith("/phish");
    click(undefined);
    expect(openWindow).toHaveBeenLastCalledWith("/");
    click("http://[bad");
    expect(openWindow).toHaveBeenLastCalledWith("/");
  });

  it("lets /admin navigations pass through to the backend-served moderation page", () => {
    const source = renderServiceWorker({
      revision: "test-revision",
      urls: ["/", "/index.html"],
    });
    let fetchHandler: ((event: unknown) => void) | undefined;
    const fakeSelf = {
      location: { hostname: "murphys-laws.com", origin: "https://murphys-laws.com" },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        if (type === "fetch") fetchHandler = handler;
      },
    };
    new Function("self", "caches", "fetch", source)(
      fakeSelf,
      { match: async () => undefined, open: async () => ({ put: async () => undefined }) },
      async () => new Response("ok"),
    );

    const handled = (path: string): boolean => {
      let responded = false;
      fetchHandler?.({
        request: {
          method: "GET",
          mode: "navigate",
          url: `https://murphys-laws.com${path}`,
        },
        respondWith: () => {
          responded = true;
        },
      });
      return responded;
    };

    for (const path of ["/admin", "/admin/", "/admin?x=1", "/embed/law/12", "/embed/law-of-day", "/embed/law-of-day/"]) {
      expect(handled(path), path).toBe(false);
    }
    for (const path of ["/", "/favorites", "/adminx", "/admin/other", "/embed/law/abc", "/embed"]) {
      expect(handled(path), path).toBe(true);
    }
  });

  it("changes the cache revision when an excluded SSG page changes content", () => {
    const directoryEntries = new Map<string, fs.Dirent[]>([
      ["/dist", [entry("index.html", "file"), entry("law", "directory")]],
      ["/dist/law", [entry("42", "directory")]],
      ["/dist/law/42", [entry("index.html", "file")]],
    ]);
    const readDirectory = (directory: string): fs.Dirent[] =>
      directoryEntries.get(directory) ?? [];
    const initialContents = new Map([
      ["/dist/index.html", "<h1>Home</h1>"],
      ["/dist/law/42/index.html", "<h1>Original law</h1>"],
    ]);
    const changedContents = new Map(initialContents);
    changedContents.set("/dist/law/42/index.html", "<h1>Updated law</h1>");

    const initial = collectPrecacheManifest(
      "/dist",
      readDirectory,
      (file) => initialContents.get(file) ?? "",
    );
    const changed = collectPrecacheManifest(
      "/dist",
      readDirectory,
      (file) => changedContents.get(file) ?? "",
    );

    expect(changed.urls).toEqual(initial.urls);
    expect(changed.urls).not.toContain("/law/42/");
    expect(changed.revision).not.toBe(initial.revision);
    expect(renderServiceWorker(changed)).not.toBe(renderServiceWorker(initial));
  });

  it("fails clearly when the build output does not exist", () => {
    const errors: string[] = [];
    const code = runGenerateServiceWorker({
      distRoot: "/missing",
      outputPath: "/missing/sw.js",
      exists: () => false,
      write: () => {
        throw new Error("must not write");
      },
      logger: {
        log: () => undefined,
        error: (message) => errors.push(String(message)),
      },
    });

    expect(code).toBe(1);
    expect(errors[0]).toContain("/missing not found");
  });
});
