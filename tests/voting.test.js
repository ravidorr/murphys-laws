import { getUserVote, voteLaw, unvoteLaw, toggleVote } from '../src/utils/voting.js';

// Mock constants to test fallback URL branches
vi.mock('../src/utils/constants.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    API_FALLBACK_URL: '' // Empty string to test the fallback
  };
});

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

    it('handles localStorage.setItem errors gracefully', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 11, downvotes: 2 })
      });

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw even if localStorage fails
      const result = await voteLaw(123, 'up');
      expect(result).toEqual({ upvotes: 11, downvotes: 2 });

      setItemSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe('voteLaw', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('throws error for invalid vote type', async () => {
      await expect(voteLaw(1, 'invalid')).rejects.toThrow('voteType must be "up" or "down"');
    });

    it('successfully votes up', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 11, downvotes: 2 })
      });

      const result = await voteLaw(123, 'up');
      expect(result).toEqual({ upvotes: 11, downvotes: 2 });
      expect(getUserVote(123)).toBe('up');
    });

    it('successfully votes down', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 10, downvotes: 3 })
      });

      const result = await voteLaw(123, 'down');
      expect(result).toEqual({ upvotes: 10, downvotes: 3 });
      expect(getUserVote(123)).toBe('down');
    });

    it('handles error response with error property', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid vote' })
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow('Invalid vote');
    });

    it('handles error response without error property', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' })
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow();
    });

    it('handles error response with invalid JSON', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow();
    });

    it('uses fallback URL on primary failure', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback succeeds
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ upvotes: 11, downvotes: 2 })
      });

      const result = await voteLaw(123, 'up');
      expect(result).toEqual({ upvotes: 11, downvotes: 2 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

    });

    it('handles fallback error with error property', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback also fails with error property
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Fallback error' })
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow('Fallback error');

    });

    it('handles fallback error with invalid JSON', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback fails with invalid JSON
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(voteLaw(123, 'up')).rejects.toThrow();

    });
  });

  describe('unvoteLaw', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
      // Set up initial vote
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('successfully removes vote', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 10, downvotes: 2 })
      });

      const result = await unvoteLaw(123);
      expect(result).toEqual({ upvotes: 10, downvotes: 2 });
      expect(getUserVote(123)).toBeNull();
    });

    it('handles error response with error property', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Cannot remove vote' })
      });

      await expect(unvoteLaw(123)).rejects.toThrow('Cannot remove vote');
    });

    it('handles error response with invalid JSON', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(unvoteLaw(123)).rejects.toThrow();
    });

    it('uses fallback URL on primary failure', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback succeeds
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ upvotes: 10, downvotes: 2 })
      });

      const result = await unvoteLaw(123);
      expect(result).toEqual({ upvotes: 10, downvotes: 2 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);

    });

    it('handles fallback error with error property', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback also fails with error property
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Fallback error' })
      });

      await expect(unvoteLaw(123)).rejects.toThrow('Fallback error');

    });

    it('handles fallback error with invalid JSON', async () => {

      // Primary fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      // Fallback fails with invalid JSON
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(unvoteLaw(123)).rejects.toThrow();

    });
  });

  describe('toggleVote', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('adds vote when no existing vote', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 11, downvotes: 2 })
      });

      const result = await toggleVote(123, 'up');
      expect(result).toEqual({ upvotes: 11, downvotes: 2 });
      expect(getUserVote(123)).toBe('up');
    });

    it('removes vote when clicking same vote type', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 10, downvotes: 2 })
      });

      const result = await toggleVote(123, 'up');
      expect(result).toEqual({ upvotes: 10, downvotes: 2 });
      expect(getUserVote(123)).toBeNull();
    });

    it('changes vote when clicking different vote type', async () => {
      localStorage.setItem('murphy_votes', JSON.stringify({ '123': 'up' }));

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ upvotes: 10, downvotes: 3 })
      });

      const result = await toggleVote(123, 'down');
      expect(result).toEqual({ upvotes: 10, downvotes: 3 });
      expect(getUserVote(123)).toBe('down');
    });
  });
});
