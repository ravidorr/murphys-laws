import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, peekRateLimit } from '../../src/middleware/rate-limit.ts';

describe('RateLimit Middleware', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: false });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should allow requests within limit', () => {
        const result = checkRateLimit('user1', 'vote');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
        expect(result.limit).toBe(30);
    });

    it('should block requests exceeding limit', () => {
        // Vote limit is 30
        for (let i = 0; i < 30; i++) {
            checkRateLimit('user2', 'vote');
        }
        const result = checkRateLimit('user2', 'vote');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(30);
    });

    it('should reset after window', () => {
        const now = Date.now();

        // Exhaust limit
        for (let i = 0; i < 30; i++) {
            checkRateLimit('user3', 'vote');
        }
        expect(checkRateLimit('user3', 'vote').allowed).toBe(false);

        // Advance system time by 1 minute + 1 second
        vi.setSystemTime(now + 61000);

        expect(checkRateLimit('user3', 'vote').allowed).toBe(true);
    });

    it('should handle unknown rate limit type', () => {
        const result = checkRateLimit('user4', 'unknown');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(Infinity);
        expect(result.limit).toBe(Infinity);
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

    it('limits failed admin logins to 10 per minute without affecting other buckets', () => {
        for (let i = 0; i < 10; i++) {
            expect(checkRateLimit('admin-user', 'admin-fail').allowed).toBe(true);
        }
        const blocked = checkRateLimit('admin-user', 'admin-fail');
        expect(blocked.allowed).toBe(false);
        expect(blocked.limit).toBe(10);
        expect(checkRateLimit('admin-user', 'vote').allowed).toBe(true);
    });
    describe('peekRateLimit', () => {
        it('reports a fresh full quota without using any of it up', () => {
            const first = peekRateLimit('peek-fresh', 'admin-fail');
            expect(first).toMatchObject({ allowed: true, limit: 10, remaining: 10 });
            expect(peekRateLimit('peek-fresh', 'admin-fail').remaining).toBe(10);
            expect(checkRateLimit('peek-fresh', 'admin-fail').remaining).toBe(9);
        });

        it('shows what is left and stays allowed until the limit is reached', () => {
            for (let i = 0; i < 9; i++) {
                checkRateLimit('peek-partial', 'admin-fail');
            }
            expect(peekRateLimit('peek-partial', 'admin-fail')).toMatchObject({ allowed: true, remaining: 1 });
            checkRateLimit('peek-partial', 'admin-fail');
            const blocked = peekRateLimit('peek-partial', 'admin-fail');
            expect(blocked).toMatchObject({ allowed: false, limit: 10, remaining: 0 });
            expect(blocked.resetTime).toBeGreaterThan(Date.now());
        });

        it('does not count the check itself, even when blocked', () => {
            for (let i = 0; i < 10; i++) {
                checkRateLimit('peek-blocked', 'admin-fail');
            }
            for (let i = 0; i < 5; i++) {
                expect(peekRateLimit('peek-blocked', 'admin-fail').allowed).toBe(false);
            }
            vi.advanceTimersByTime(60 * 1000 + 1);
            expect(peekRateLimit('peek-blocked', 'admin-fail').allowed).toBe(true);
        });

        it('allows everything for an unknown limit type', () => {
            expect(peekRateLimit('anyone', 'unknown-type')).toEqual({ allowed: true, limit: Infinity, remaining: Infinity, resetTime: 0 });
        });
    });
});
