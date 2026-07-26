import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATED_HEADER =
  '/* Generated from styles/partials/variables.css. Do not edit this build artifact. */\n';

export interface GenerateFallbackTokensOptions {
  sourcePath: string;
  outputPath: string;
  exists: (file: string) => boolean;
  read: (file: string) => string;
  makeDirectory: (directory: string) => void;
  write: (file: string, contents: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function renderFallbackTokens(source: string): string {
  return `${GENERATED_HEADER}${source}`;
}

export function runGenerateFallbackTokens(
  options: GenerateFallbackTokensOptions,
): 0 | 1 {
  if (!options.exists(options.sourcePath)) {
    options.logger.error(
      `Fallback token generation failed: ${options.sourcePath} not found.`,
    );
    return 1;
  }

  options.makeDirectory(path.dirname(options.outputPath));
  options.write(
    options.outputPath,
    renderFallbackTokens(options.read(options.sourcePath)),
  );
  options.logger.log(`Generated ${options.outputPath}.`);
  return 0;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === new URL(`file://${entry}`).href);
}

if (isMain()) {
  const webRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  process.exit(
    runGenerateFallbackTokens({
      sourcePath: path.join(webRoot, 'styles/partials/variables.css'),
      outputPath: path.join(
        webRoot,
        'dist/styles/partials/variables.css',
      ),
      exists: fs.existsSync,
      read: (file) => fs.readFileSync(file, 'utf8'),
      makeDirectory: (directory) => fs.mkdirSync(directory, { recursive: true }),
      write: (file, contents) => fs.writeFileSync(file, contents, 'utf8'),
      logger: console,
    }),
  );
}
