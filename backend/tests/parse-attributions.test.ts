import { describe, it, expect } from 'vitest';
import { canonicalCategorySlug, parseAttributions } from '../scripts/build-sqlite.ts';

describe('parseAttributions', () => {
  it('uses canonical category slugs for renamed archive files', () => {
    expect(canonicalCategorySlug('murphys-cars-4x4-laws')).toBe('murphys-4x4-car-laws');
    expect(canonicalCategorySlug('murphys-cars-open-road-laws')).toBe('murphys-law-of-the-open-road');
    expect(canonicalCategorySlug('murphys-computers-laws')).toBe('murphys-computer-laws');
    expect(canonicalCategorySlug('murphys-cowboy-action-shooting-laws')).toBe('murphys-cowboy-action-shooting-cas-laws');
    expect(canonicalCategorySlug('murphys-helicopters-war-laws')).toBe('murphys-helicopters-warfare-laws');
    expect(canonicalCategorySlug('murphys-marine-corp-laws')).toBe('murphys-marine-corps-laws');
    expect(canonicalCategorySlug('murphys-mechanics-laws')).toBe('murphys-laws-of-mechanics');
    expect(canonicalCategorySlug('murphys-repairmen-laws')).toBe('murphys-repairmans-laws');
    expect(canonicalCategorySlug('murphys-tanks-war-laws')).toBe('murphys-tank-warfare-laws');
    expect(canonicalCategorySlug('murphys-technology-laws')).toBe('murphys-technology-laws');
  });

  it('parses mailto simple', () => {
    const input = 'The alarm will never go off. Sent by [Brad Johnson](mailto:brad42681@yahoo.com).';
    const res = parseAttributions(input);
    expect(res.cleanText).toBe('The alarm will never go off. Sent by Brad Johnson.');
    expect(res.attributions).toHaveLength(1);
    expect(res.attributions[0]).toMatchObject({
      name: 'Brad Johnson',
      contact_type: 'email',
      contact_value: 'brad42681@yahoo.com'
    });
  });

  it('parses mailto with dotty domain', () => {
    const input = 'Sent by [Rene Chenier](mailto:scifihistdata@interactive.rogers.com).';
    const res = parseAttributions(input);
    expect(res.cleanText).toBe('Sent by Rene Chenier.');
    expect(res.attributions[0]).toMatchObject({
      name: 'Rene Chenier',
      contact_type: 'email',
      contact_value: 'scifihistdata@interactive.rogers.com'
    });
  });

  it('parses mailto with trailing note', () => {
    const input = 'Sent by [Name Here](mailto:name@example.com) - Austin, TX, age 42.';
    const res = parseAttributions(input);
    expect(res.attributions).toHaveLength(1);
    expect(res.attributions[0].name).toBe('Name Here');
    expect(res.attributions[0].contact_type).toBe('email');
  });

  it('returns empty attributions for plain text name with metadata', () => {
    const input = 'Sent by Jane Doe, Austin TX.';
    const res = parseAttributions(input);
    expect(res.attributions).toHaveLength(0);
    expect(res.cleanText).toBe('Sent by Jane Doe, Austin TX.');
  });

  it('returns empty attributions for plain text only', () => {
    const input = 'Sent by Someone.';
    const res = parseAttributions(input);
    expect(res.attributions).toHaveLength(0);
    expect(res.cleanText).toBe('Sent by Someone.');
  });
});
