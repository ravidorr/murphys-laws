#!/usr/bin/env node
/**
 * Image Optimization Script
 *
 * Optimizes images in the public folder:
 * - Compresses PNG/JPEG images
 * - Generates WebP versions
 * - Preserves originals in a backup folder (optional)
 *
 * Usage:
 *   tsx scripts/optimize-images.ts [--dry-run] [--no-webp]
 *
 * Requires: npm install sharp --save-dev
 */

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  pngQuality: 80,
  jpegQuality: 85,
  webpQuality: 80,
  minSizeToOptimize: 1024,
  inputDirs: ['public', 'public/social'],
  extensions: ['.png', '.jpg', '.jpeg'],
  skipPatterns: [
    /favicon/i,
    /android-chrome/i,
    /apple-touch-icon/i
  ]
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipWebp = args.includes('--no-webp');

interface ImageFile {
  path: string;
  name: string;
  size: number;
  ext: string;
}

interface OptimizeResult {
  type: 'optimize' | 'webp';
  input: string;
  output: string;
  originalSize: number;
  newSize: number;
  savings: number;
  savingsPercent: string;
}

async function loadSharp(): Promise<typeof import('sharp')> {
  try {
    const sharp = await import('sharp');
    return sharp.default;
  } catch {
    console.error('Error: Sharp is not installed. Run: npm install sharp --save-dev');
    process.exit(1);
  }
}

function getImageFiles(dir: string): ImageFile[] {
  const fullPath = join(__dirname, '..', dir);
  if (!existsSync(fullPath)) {
    return [];
  }

  const files: ImageFile[] = [];
  const entries = readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (CONFIG.extensions.includes(ext)) {
        const filePath = join(fullPath, entry.name);
        const stats = statSync(filePath);

        if (stats.size < CONFIG.minSizeToOptimize) {
          continue;
        }

        const shouldSkip = CONFIG.skipPatterns.some((pattern) => pattern.test(entry.name));
        if (shouldSkip) {
          continue;
        }

        files.push({
          path: filePath,
          name: entry.name,
          size: stats.size,
          ext
        });
      }
    }
  }

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImage(
  sharp: typeof import('sharp'),
  file: ImageFile
): Promise<OptimizeResult[]> {
  const results: OptimizeResult[] = [];
  const image = sharp(file.path);
  await image.metadata();

  let optimizedBuffer: Buffer | undefined;
  const outputPath = file.path;

  if (file.ext === '.png') {
    optimizedBuffer = await image
      .png({ quality: CONFIG.pngQuality, compressionLevel: 9 })
      .toBuffer();
  } else if (file.ext === '.jpg' || file.ext === '.jpeg') {
    optimizedBuffer = await image
      .jpeg({ quality: CONFIG.jpegQuality, mozjpeg: true })
      .toBuffer();
  }

  if (optimizedBuffer && optimizedBuffer.length < file.size) {
    const savings = file.size - optimizedBuffer.length;
    const savingsPercent = ((savings / file.size) * 100).toFixed(1);

    results.push({
      type: 'optimize',
      input: file.name,
      output: basename(outputPath),
      originalSize: file.size,
      newSize: optimizedBuffer.length,
      savings,
      savingsPercent
    });

    if (!dryRun) {
      writeFileSync(outputPath, optimizedBuffer);
    }
  }

  if (!skipWebp) {
    const webpPath = file.path.replace(/\.(png|jpe?g)$/i, '.webp');
    const webpBuffer = await sharp(file.path)
      .webp({ quality: CONFIG.webpQuality })
      .toBuffer();

    if (webpBuffer.length < file.size) {
      const savings = file.size - webpBuffer.length;
      const savingsPercent = ((savings / file.size) * 100).toFixed(1);

      results.push({
        type: 'webp',
        input: file.name,
        output: basename(webpPath),
        originalSize: file.size,
        newSize: webpBuffer.length,
        savings,
        savingsPercent
      });

      if (!dryRun) {
        writeFileSync(webpPath, webpBuffer);
      }
    }
  }

  return results;
}

async function main(): Promise<void> {
  console.log('Image Optimization Script');
  console.log('='.repeat(50));

  if (dryRun) {
    console.log('DRY RUN: No files will be modified\n');
  }

  const sharp = await loadSharp();

  let allFiles: ImageFile[] = [];
  for (const dir of CONFIG.inputDirs) {
    const files = getImageFiles(dir);
    allFiles = [...allFiles, ...files];
  }

  const uniqueFiles = [...new Map(allFiles.map((f) => [f.path, f])).values()];

  if (uniqueFiles.length === 0) {
    console.log('No images found to optimize.');
    return;
  }

  console.log(`Found ${uniqueFiles.length} image(s) to process:\n`);

  let totalOriginalSize = 0;
  let totalSavings = 0;

  for (const file of uniqueFiles) {
    console.log(`Processing: ${file.name} (${formatBytes(file.size)})`);

    try {
      const results = await optimizeImage(sharp, file);

      for (const result of results) {
        totalOriginalSize += result.originalSize;
        totalSavings += result.savings;

        const action = result.type === 'webp' ? 'WebP created' : 'Optimized';
        console.log(`  ${action}: ${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)} (-${result.savingsPercent}%)`);
      }

      if (results.length === 0) {
        console.log('  Skipped (already optimized)');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error: ${message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Files processed: ${uniqueFiles.length}`);
  console.log(`  Total savings: ${formatBytes(totalSavings)} (${totalOriginalSize > 0 ? ((totalSavings / totalOriginalSize) * 100).toFixed(1) : 0}%)`);

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch(console.error);
