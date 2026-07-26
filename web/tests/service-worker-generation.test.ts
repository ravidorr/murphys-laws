import type fs from "node:fs";
import { describe, expect, it } from "vitest";
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
