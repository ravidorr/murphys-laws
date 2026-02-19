// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { safeParseJsonArray } from '../../src/utils/helpers.ts';

describe('helpers', () => {
    describe('safeParseJsonArray', () => {
        it('should parse valid JSON array', () => {
            const result = safeParseJsonArray('[{"name":"test"}]');
            expect(result).toEqual([{ name: 'test' }]);
        });

        it('should return empty array for invalid JSON', () => {
            const result = safeParseJsonArray('invalid json');
            expect(result).toEqual([]);
        });

        it('should return empty array for null', () => {
            const result = safeParseJsonArray(null);
            expect(result).toEqual([]);
        });

        it('should return empty array for undefined', () => {
            const result = safeParseJsonArray(undefined);
            expect(result).toEqual([]);
        });

        it('should return empty array for empty string', () => {
            const result = safeParseJsonArray('');
            expect(result).toEqual([]);
        });
    });
});
