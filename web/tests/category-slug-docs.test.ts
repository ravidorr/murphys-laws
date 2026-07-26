import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, '../..');
const canonicalCategorySlugs = [
  'murphys-4x4-car-laws',
  'murphys-law-of-the-open-road',
  'murphys-computer-laws',
  'murphys-cowboy-action-shooting-cas-laws',
  'murphys-helicopters-warfare-laws',
  'murphys-marine-corps-laws',
  'murphys-laws-of-mechanics',
  'murphys-repairmans-laws',
  'murphys-tank-warfare-laws',
];
const legacyCategorySlugs = [
  'murphys-cars-4x4-laws',
  'murphys-cars-open-road-laws',
  'murphys-computers-laws',
  'murphys-cowboy-action-shooting-laws',
  'murphys-helicopters-war-laws',
  'murphys-marine-corp-laws',
  'murphys-mechanics-laws',
  'murphys-repairmen-laws',
  'murphys-tanks-war-laws',
];

describe('category slug documentation', () => {
  it('publishes only canonical category_slug values', () => {
    const documents = [
      path.join(repositoryRoot, 'web/public/llms-full.txt'),
      path.join(repositoryRoot, 'shared/docs/API.md'),
    ].map((file) => fs.readFileSync(file, 'utf8'));

    for (const document of documents) {
      for (const slug of legacyCategorySlugs) {
        expect(document).not.toContain(slug);
      }
    }

    const llmsFull = documents[0]!;
    for (const slug of canonicalCategorySlugs) {
      expect(llmsFull).toContain(slug);
    }
  });
});
