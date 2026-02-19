import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../../src/middleware/rate-limit.ts';

describe('RateLimit Middleware', () => {
    beforeEach(() => {
        // We need to reset the module state or mock Date.now
        vi.useFakeTimers();
    });

    it('should allow requests within limit', () => {
        const result = checkRateLimit('user1', 'vote');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests exceeding limit', () => {
        // Vote limit is 30
        for (let i = 0; i < 30; i++) {
            checkRateLimit('user2', 'vote');
        }
        const result = checkRateLimit('user2', 'vote');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should reset after window', () => {
        // Exhaust limit
        for (let i = 0; i < 30; i++) {
            checkRateLimit('user3', 'vote');
        }
        expect(checkRateLimit('user3', 'vote').allowed).toBe(false);

        // Advance time by 1 minute + 1 second
        vi.advanceTimersByTime(61000);

        expect(checkRateLimit('user3', 'vote').allowed).toBe(true);
    });

    it('should handle unknown rate limit type', () => {
        const result = checkRateLimit('user4', 'unknown');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(Infinity);
    });

    it('should enforce submit rate limit', () => {
        // Submit limit is 3
        for (let i = 0; i < 3; i++) {
            checkRateLimit('user5', 'submit');
        }
        const result = checkRateLimit('user5', 'submit');
        expect(result.allowed).toBe(false);
    });

    it('should enforce email rate limit', () => {
        // Email limit is 5
        for (let i = 0; i < 5; i++) {
            checkRateLimit('user6', 'email');
        }
        const result = checkRateLimit('user6', 'email');
        expect(result.allowed).toBe(false);
    });

    it('should track different users separately', () => {
        checkRateLimit('userA', 'vote');
        checkRateLimit('userA', 'vote');

        const resultA = checkRateLimit('userA', 'vote');
        const resultB = checkRateLimit('userB', 'vote');

        expect(resultA.remaining).toBe(27); // 30 - 3
        expect(resultB.remaining).toBe(29); // 30 - 1
    });
});
