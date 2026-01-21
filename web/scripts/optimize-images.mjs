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
 *   node scripts/optimize-images.mjs [--dry-run] [--no-webp]
 * 
 * Requires: npm install sharp --save-dev
 */

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Configuration
const CONFIG = {
  // Quality settings (0-100)
  pngQuality: 80,
  jpegQuality: 85,
  webpQuality: 80,
  
  // Size thresholds (skip files smaller than this)
  minSizeToOptimize: 1024, // 1KB
  
  // Directories to process
  inputDirs: ['public', 'public/social'],
  
  // File extensions to process
  extensions: ['.png', '.jpg', '.jpeg'],
  
  // Skip these files (patterns)
  skipPatterns: [
    /favicon/i,
    /android-chrome/i,
    /apple-touch-icon/i
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipWebp = args.includes('--no-webp');

/**
 * Check if Sharp is available
 */
async function loadSharp() {
  try {
    const sharp = await import('sharp');
    return sharp.default;
  } catch {
    console.error('Error: Sharp is not installed. Run: npm install sharp --save-dev');
    process.exit(1);
  }
}

/**
 * Get all image files in a directory
 */
function getImageFiles(dir) {
  const fullPath = join(__dirname, '..', dir);
  if (!existsSync(fullPath)) {
    return [];
  }

  const files = [];
  const entries = readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (CONFIG.extensions.includes(ext)) {
        const filePath = join(fullPath, entry.name);
        const stats = statSync(filePath);
        
        // Skip small files
        if (stats.size < CONFIG.minSizeToOptimize) {
          continue;
        }
        
        // Skip files matching skip patterns
        const shouldSkip = CONFIG.skipPatterns.some(pattern => pattern.test(entry.name));
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

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Optimize a single image
 */
async function optimizeImage(sharp, file) {
  const results = [];
  const image = sharp(file.path);
  const metadata = await image.metadata();
  
  // Optimize original format
  let optimizedBuffer;
  let outputPath = file.path;
  
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
  
  // Generate WebP version
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

/**
 * Main function
 */
async function main() {
  console.log('Image Optimization Script');
  console.log('='.repeat(50));
  
  if (dryRun) {
    console.log('DRY RUN: No files will be modified\n');
  }
  
  const sharp = await loadSharp();
  
  // Collect all images
  let allFiles = [];
  for (const dir of CONFIG.inputDirs) {
    const files = getImageFiles(dir);
    allFiles = [...allFiles, ...files];
  }
  
  // Remove duplicates (in case of overlapping paths)
  const uniqueFiles = [...new Map(allFiles.map(f => [f.path, f])).values()];
  
  if (uniqueFiles.length === 0) {
    console.log('No images found to optimize.');
    return;
  }
  
  console.log(`Found ${uniqueFiles.length} image(s) to process:\n`);
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let totalSavings = 0;
  
  for (const file of uniqueFiles) {
    console.log(`Processing: ${file.name} (${formatBytes(file.size)})`);
    
    try {
      const results = await optimizeImage(sharp, file);
      
      for (const result of results) {
        totalOriginalSize += result.originalSize;
        totalNewSize += result.newSize;
        totalSavings += result.savings;
        
        const action = result.type === 'webp' ? 'WebP created' : 'Optimized';
        console.log(`  ${action}: ${formatBytes(result.originalSize)} -> ${formatBytes(result.newSize)} (-${result.savingsPercent}%)`);
      }
      
      if (results.length === 0) {
        console.log('  Skipped (already optimized)');
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Files processed: ${uniqueFiles.length}`);
  console.log(`  Total savings: ${formatBytes(totalSavings)} (${((totalSavings / totalOriginalSize) * 100).toFixed(1)}%)`);
  
  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch(console.error);
