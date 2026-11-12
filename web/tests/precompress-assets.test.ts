import type fs from "node:fs";
import zlib from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  PRECOMPRESS_DIRECTORIES,
  brotliBuffer,
  collectCompressibleFiles,
  gzipBuffer,
  isCompressible,
  precompressFiles,
  runPrecompress,
} from "../scripts/precompress-assets.ts";

function entry(name: string, type: "directory" | "file"): fs.Dirent {
  return {
    name,
    isDirectory: () => type === "directory",
    isFile: () => type === "file",
  } as fs.Dirent;
}

const compressible = Buffer.from("function hello() { return 'hello world'; }\n".repeat(200));
// Random-looking bytes do not shrink, so no .gz or .br copy is written for them.
const incompressible = Buffer.from(
  Array.from({ length: 64 }, (_, index) => (index * 97 + 13) % 251),
);

describe("precompress assets", () => {
  it("only targets the hashed asset directory", () => {
    expect(PRECOMPRESS_DIRECTORIES).toEqual(["assets"]);
  });

  it("recognises compressible text types and skips images, fonts and maps", () => {
    for (const file of ["a.js", "a.css", "a.svg"]) {
      expect(isCompressible(file), file).toBe(true);
    }
    for (const file of ["a.png", "a.woff2", "a.json", "a.js.map", "a.js.gz", "a.js.br", "a"]) {
      expect(isCompressible(file), file).toBe(false);
    }
  });

  it("produces output that decompresses to the original", () => {
    expect(zlib.gunzipSync(gzipBuffer(compressible)).equals(compressible)).toBe(true);
    expect(zlib.brotliDecompressSync(brotliBuffer(compressible)).equals(compressible)).toBe(true);
    expect(brotliBuffer(compressible).length).toBeLessThan(gzipBuffer(compressible).length);
  });

  it("walks directories and returns the compressible files in a stable order", () => {
    const directories = new Map<string, fs.Dirent[]>([
      [
        "/dist/assets",
        [
          entry("z.js", "file"),
          entry("a.css", "file"),
          entry("logo.png", "file"),
          entry("chunks", "directory"),
          entry("a.js.map", "file"),
        ],
      ],
      ["/dist/assets/chunks", [entry("b.js", "file")]],
    ]);
    const readDirectory = vi.fn((directory: string) => directories.get(directory) ?? []);

    expect(collectCompressibleFiles("/dist/assets", readDirectory)).toEqual([
      "/dist/assets/a.css",
      "/dist/assets/chunks/b.js",
      "/dist/assets/z.js",
    ]);
  });

  it("writes a copy only when it is smaller than the original", () => {
    const written = new Map<string, Buffer>();
    const contents = new Map<string, Buffer>([
      ["/dist/assets/big.js", compressible],
      ["/dist/assets/tiny.js", incompressible],
    ]);

    const summary = precompressFiles(["/dist/assets/big.js", "/dist/assets/tiny.js"], {
      readFile: (file) => contents.get(file) as Buffer,
      writeFile: (file, data) => written.set(file, data),
    });

    expect([...written.keys()].sort()).toEqual([
      "/dist/assets/big.js.br",
      "/dist/assets/big.js.gz",
    ]);
    expect(summary).toMatchObject({
      files: 2,
      gzipFiles: 1,
      brotliFiles: 1,
      originalBytes: compressible.length + incompressible.length,
    });
    expect(summary.gzipBytes).toBe(written.get("/dist/assets/big.js.gz")?.length);
    expect(summary.brotliBytes).toBe(written.get("/dist/assets/big.js.br")?.length);
  });

  it("fails clearly when the asset directory is missing", () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const writeFile = vi.fn();

    const code = runPrecompress({
      distRoot: "/dist",
      directories: ["assets"],
      exists: () => false,
      readDirectory: () => [],
      readFile: () => Buffer.alloc(0),
      writeFile,
      logger,
    });

    expect(code).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("/dist/assets not found"));
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("fails when the asset directory holds nothing to compress", () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const writeFile = vi.fn();

    const code = runPrecompress({
      distRoot: "/dist",
      directories: ["assets"],
      exists: () => true,
      readDirectory: () => [entry("logo.png", "file")],
      readFile: () => Buffer.alloc(0),
      writeFile,
      logger,
    });

    expect(code).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("no compressible files under assets"));
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("does not write a copy of an empty file", () => {
    const written: string[] = [];

    const summary = precompressFiles(["/dist/assets/empty.js"], {
      readFile: () => Buffer.alloc(0),
      writeFile: (file) => written.push(file),
    });

    expect(written).toEqual([]);
    expect(summary).toMatchObject({ files: 1, gzipFiles: 0, brotliFiles: 0, originalBytes: 0 });
  });

  it("propagates a write failure instead of reporting success", () => {
    const logger = { log: vi.fn(), error: vi.fn() };

    expect(() =>
      runPrecompress({
        distRoot: "/dist",
        directories: ["assets"],
        exists: () => true,
        readDirectory: () => [entry("a.js", "file")],
        readFile: () => compressible,
        writeFile: () => {
          throw new Error("EACCES");
        },
        logger,
      }),
    ).toThrow("EACCES");
    expect(logger.log).not.toHaveBeenCalled();
  });

  it("precompresses every configured directory and logs a summary", () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const written: string[] = [];
    const directories = new Map<string, fs.Dirent[]>([
      ["/dist/assets", [entry("index-abc.js", "file")]],
      ["/dist/extra", [entry("style-abc.css", "file")]],
    ]);

    const code = runPrecompress({
      distRoot: "/dist",
      directories: ["assets", "extra"],
      exists: () => true,
      readDirectory: (directory) => directories.get(directory) ?? [],
      readFile: () => compressible,
      writeFile: (file) => written.push(file),
      logger,
    });

    expect(code).toBe(0);
    expect(written.sort()).toEqual([
      "/dist/assets/index-abc.js.br",
      "/dist/assets/index-abc.js.gz",
      "/dist/extra/style-abc.css.br",
      "/dist/extra/style-abc.css.gz",
    ]);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/^Precompressed 2 file\(s\): 2 \.gz \(\d+ bytes\) and 2 \.br \(\d+ bytes\) from \d+ bytes\.$/),
    );
  });
});
