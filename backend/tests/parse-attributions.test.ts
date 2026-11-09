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

  describe('contact details never reach public fields', () => {
    it('masks an address used as the link text and records the target as an email contact', () => {
      const res = parseAttributions('One college student in a hot rod car has half a brain. Sent by [Wildmoongurl69@aol.com](http://Wildmoongurl69@aol.com)');
      expect(res.cleanText).toBe('One college student in a hot rod car has half a brain. Sent by Anonymous');
      expect(res.attributions).toEqual([
        {
          name: 'Anonymous',
          contact_type: 'email',
          contact_value: 'Wildmoongurl69@aol.com',
          source_fragment: '[Wildmoongurl69@aol.com](http://Wildmoongurl69@aol.com)'
        }
      ]);
    });

    it('masks an address used as the link text of a mailto link', () => {
      const res = parseAttributions('It is late. Sent by [pjwmail@ntlworld.com](mailto:pjwmail@ntlworld.com), a commuter.');
      expect(res.cleanText).toBe('It is late. Sent by Anonymous, a commuter.');
      expect(res.attributions[0]).toMatchObject({ name: 'Anonymous', contact_type: 'email', contact_value: 'pjwmail@ntlworld.com' });
    });

    it('drops the leading "by" from an attribution name but keeps the sentence intact', () => {
      const res = parseAttributions('The difference between love and the common cold is a vaccine. Sent [by Takura Razemba](mailto:tamzanzw@yahoo.com).');
      expect(res.cleanText).toBe('The difference between love and the common cold is a vaccine. Sent by Takura Razemba.');
      expect(res.attributions[0]).toMatchObject({ name: 'Takura Razemba', contact_type: 'email', contact_value: 'tamzanzw@yahoo.com' });
    });

    it('falls back to the anonymous label when a name is only "by"', () => {
      const res = parseAttributions('A law. Sent [by](mailto:someone@example.com).');
      expect(res.attributions[0]).toMatchObject({ name: 'Anonymous', contact_type: 'email' });
    });

    it('keeps a web link as a url contact', () => {
      const res = parseAttributions('A law. Sent by [Jane](http://example.com/jane).');
      expect(res.attributions[0]).toMatchObject({ name: 'Jane', contact_type: 'url', contact_value: 'http://example.com/jane' });
    });

    it('keeps a web link whose path holds an address as a url contact', () => {
      const res = parseAttributions('A law. Sent by [Safwan Aumari](http://murphys-laws.com/old/inc/safwanan@yahoo.com).');
      expect(res.attributions[0]).toMatchObject({ name: 'Safwan Aumari', contact_type: 'url' });
      expect(res.cleanText).toBe('A law. Sent by Safwan Aumari.');
    });

    it('removes a truncated mailto link whose closing parenthesis was lost', () => {
      const res = parseAttributions('A law. Sent [by Takura Razemba](mailto:tamzanzw@yahoo.com');
      expect(res.cleanText).toBe('A law. Sent by Takura Razemba');
      expect(res.attributions).toHaveLength(0);
    });

    it('masks an address inside a truncated mailto link name', () => {
      const res = parseAttributions('A law. Sent [a@b.com](mailto:a@b.com');
      expect(res.cleanText).toBe('A law. Sent Anonymous');
    });

    it('removes a leftover mailto target', () => {
      expect(parseAttributions('A law. Sent by mailto:someone').cleanText).toBe('A law. Sent by');
    });

    it('masks a bare address in the text', () => {
      expect(parseAttributions('A law. Sent by Karacourt@aol.com.').cleanText).toBe('A law. Sent by Anonymous.');
    });

    it('leaves a symbol-laden word that is not an address alone', () => {
      const text = 'Do not call him a mother@#?!&* in public.';
      expect(parseAttributions(text).cleanText).toBe(text);
    });
  });
});
