import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

// The text types of the hashed build output that nginx serves with gzip_static (the extension list of the hashed
// /assets/ location in nginx.conf; a test keeps the two in step). Raster images and woff/woff2 fonts are already
// compressed, and source maps are never requested by visitors.
export const COMPRESSIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".css",
  ".js",
  ".svg",
]);

// Only the content-hashed build output is precompressed. nginx serves it with gzip_static (see nginx.conf), and the
// files never change under one name. Pages and other root files are small and compressed on the fly.
export const PRECOMPRESS_DIRECTORIES: readonly string[] = ["assets"];

export interface PrecompressOptions {
  distRoot: string;
  directories: readonly string[];
  exists: (file: string) => boolean;
  readDirectory: (directory: string) => fs.Dirent[];
  readFile: (file: string) => Buffer;
  writeFile: (file: string, contents: Buffer) => void;
  logger: Pick<Console, "log" | "error">;
}

export interface PrecompressSummary {
  files: number;
  gzipFiles: number;
  brotliFiles: number;
  originalBytes: number;
  gzipBytes: number;
  brotliBytes: number;
}

export function isCompressible(file: string): boolean {
  return COMPRESSIBLE_EXTENSIONS.has(path.extname(file));
}

export function gzipBuffer(contents: Buffer): Buffer {
  return zlib.gzipSync(contents, { level: zlib.constants.Z_BEST_COMPRESSION });
}

export function brotliBuffer(contents: Buffer): Buffer {
  return zlib.brotliCompressSync(contents, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]:
        zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: contents.length,
    },
  });
}

export function collectCompressibleFiles(
  directory: string,
  readDirectory: (directory: string) => fs.Dirent[],
): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readDirectory(current)) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() && isCompressible(entry.name)) {
        files.push(absolute);
      }
    }
  }

  walk(directory);
  return files.sort();
}

export function precompressFiles(
  files: readonly string[],
  options: Pick<PrecompressOptions, "readFile" | "writeFile">,
): PrecompressSummary {
  const summary: PrecompressSummary = {
    files: files.length,
    gzipFiles: 0,
    brotliFiles: 0,
    originalBytes: 0,
    gzipBytes: 0,
    brotliBytes: 0,
  };

  for (const file of files) {
    const original = options.readFile(file);
    summary.originalBytes += original.length;

    // A copy is written only when it is smaller than the original; nginx then falls back to the plain file.
    const gzipped = gzipBuffer(original);
    if (gzipped.length < original.length) {
      options.writeFile(`${file}.gz`, gzipped);
      summary.gzipFiles += 1;
      summary.gzipBytes += gzipped.length;
    }

    const brotlied = brotliBuffer(original);
    if (brotlied.length < original.length) {
      options.writeFile(`${file}.br`, brotlied);
      summary.brotliFiles += 1;
      summary.brotliBytes += brotlied.length;
    }
  }

  return summary;
}

export function runPrecompress(options: PrecompressOptions): 0 | 1 {
  const files: string[] = [];

  for (const directory of options.directories) {
    const absolute = path.join(options.distRoot, directory);
    if (!options.exists(absolute)) {
      options.logger.error(
        `Precompression failed: ${absolute} not found. Run the build first.`,
      );
      return 1;
    }
    files.push(...collectCompressibleFiles(absolute, options.readDirectory));
  }

  // Vite always emits scripts and styles under assets/, so none at all means the build went wrong.
  if (files.length === 0) {
    options.logger.error(
      `Precompression failed: no compressible files under ${options.directories.join(", ")}.`,
    );
    return 1;
  }

  const summary = precompressFiles(files, options);
  options.logger.log(
    `Precompressed ${summary.files} file(s): ${summary.gzipFiles} .gz (${summary.gzipBytes} bytes) and ` +
      `${summary.brotliFiles} .br (${summary.brotliBytes} bytes) from ${summary.originalBytes} bytes.`,
  );
  return 0;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === new URL(`file://${entry}`).href);
}

/* v8 ignore start -- command-line entry point; runPrecompress is covered through its injected dependencies */
if (isMain()) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  process.exit(
    runPrecompress({
      distRoot: path.resolve(scriptDirectory, "../dist"),
      directories: PRECOMPRESS_DIRECTORIES,
      exists: fs.existsSync,
      readDirectory: (directory) =>
        fs.readdirSync(directory, { withFileTypes: true }),
      readFile: (file) => fs.readFileSync(file),
      writeFile: (file, contents) => fs.writeFileSync(file, contents),
      logger: console,
    }),
  );
}
/* v8 ignore stop */
