import { voteLaw, unvoteLaw, toggleVote, getUserVote } from '../src/utils/voting.js';
import { beforeEach, afterEach, vi } from 'vitest';

describe('Voting API integration', () => {
  let originalFetch;

  beforeEach(() => {
    localStorage.clear();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  describe('voteLaw', () => {
    it('sends POST request to vote endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, upvotes: 10, downvotes: 2 })
      });

      const result = await voteLaw(123, 'up');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/laws/123/vote'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ vote_type: 'up' })
        })
      );

      expect(result.success).toBe(true);
      expect(getUserVote(123)).toBe('up');
    });

    it('saves vote to localStorage on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await voteLaw(456, 'down');

      expect(getUserVote(456)).toBe('down');
    });

    it('throws error for invalid vote type', async () => {
      await expect(voteLaw(123, 'invalid')).rejects.toThrow('voteType must be "up" or "down"');
    });

    it('handles API error responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid vote' })
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow();
    });

    it('uses fallback URL on primary failure', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      await voteLaw(123, 'up');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(getUserVote(123)).toBe('up');
    });
  });

  describe('unvoteLaw', () => {
    it('sends DELETE request to vote endpoint', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await unvoteLaw(123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/laws/123/vote'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );

      expect(getUserVote(123)).toBeNull();
    });

    it('removes vote from localStorage on success', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up', '456': 'down' }));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await unvoteLaw(123);

      expect(getUserVote(123)).toBeNull();
      expect(getUserVote(456)).toBe('down');
    });

    it('handles API error responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Vote not found' })
      });

      await expect(unvoteLaw(123)).rejects.toThrow();
    });

    it('uses fallback URL on primary failure', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      await unvoteLaw(123);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleVote', () => {
    it('adds vote when none exists', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await toggleVote(123, 'up');

      expect(getUserVote(123)).toBe('up');
    });

    it('removes vote when same type clicked', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await toggleVote(123, 'up');

      expect(getUserVote(123)).toBeNull();
    });

    it('changes vote when different type clicked', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await toggleVote(123, 'down');

      expect(getUserVote(123)).toBe('down');
    });
  });
});
