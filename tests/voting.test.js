import { getUserVote } from '../src/utils/voting.js';
import { beforeEach, afterEach } from 'vitest';

describe('Voting utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getUserVote', () => {
    it('returns null when no vote exists', () => {
      expect(getUserVote(123)).toBeNull();
    });

    it('returns vote type when vote exists', () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));
      expect(getUserVote(123)).toBe('up');
    });

    it('handles different law IDs', () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '1': 'up', '2': 'down' }));
      expect(getUserVote(1)).toBe('up');
      expect(getUserVote(2)).toBe('down');
      expect(getUserVote(3)).toBeNull();
    });
  });

  describe('localStorage integration', () => {
    it('stores votes in localStorage with correct key', () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up', '456': 'down' }));

      expect(getUserVote(123)).toBe('up');
      expect(getUserVote(456)).toBe('down');
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem('murphy_votes', 'invalid json');
      expect(getUserVote(123)).toBeNull();
    });

    it('returns null for non-existent votes', () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));
      expect(getUserVote(999)).toBeNull();
    });

    it('can read multiple different votes', () => {
      localStorage.setItem('murphy_votes', JSON.stringify({
        '1': 'up',
        '2': 'down',
        '3': 'up'
      }));

      expect(getUserVote(1)).toBe('up');
      expect(getUserVote(2)).toBe('down');
      expect(getUserVote(3)).toBe('up');
      expect(getUserVote(4)).toBeNull();
    });
  });
});
