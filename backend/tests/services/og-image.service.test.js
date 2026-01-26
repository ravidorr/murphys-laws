import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OgImageService } from '../../src/services/og-image.service.mjs';

describe('OgImageService', () => {
  let ogImageService;
  let mockLawService;

  beforeEach(() => {
    mockLawService = {
      getLaw: vi.fn(),
    };
    ogImageService = new OgImageService(mockLawService);
  });

  describe('generateLawImage', () => {
    it('should return null for non-existent law', async () => {
      mockLawService.getLaw.mockResolvedValue(null);

      const result = await ogImageService.generateLawImage(999);

      expect(result).toBeNull();
      expect(mockLawService.getLaw).toHaveBeenCalledWith(999);
    });

    it('should generate a PNG buffer for valid law', async () => {
      const localThis = {
        law: {
          id: 1,
          title: "Murphy's Law",
          text: 'Anything that can go wrong will go wrong.',
          attributions: [{ name: 'Edward A. Murphy Jr.' }],
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // Check PNG magic bytes
      expect(result[0]).toBe(0x89);
      expect(result[1]).toBe(0x50); // P
      expect(result[2]).toBe(0x4e); // N
      expect(result[3]).toBe(0x47); // G
    });

    it('should cache generated images', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'Test law text',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      // Generate twice
      const result1 = await ogImageService.generateLawImage(1);
      const result2 = await ogImageService.generateLawImage(1);

      // Should only call getLaw once due to caching
      expect(mockLawService.getLaw).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same buffer reference
    });

    it('should handle law without title', async () => {
      const localThis = {
        law: {
          id: 1,
          title: null,
          text: 'A law without a title.',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle law without attributions', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'A law without attribution.',
          attributions: [],
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long law text', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'This is a very long law text that should be truncated when displayed on the OG image. '.repeat(20),
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle law with empty text', async () => {
      const localThis = {
        law: {
          id: 1,
          title: 'Empty Law',
          text: '',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle law with special characters', async () => {
      const localThis = {
        law: {
          id: 1,
          title: "Murphy's Law & Corollaries",
          text: 'If anything can go wrong, it will. <script>alert("xss")</script> "quoted" & ampersand',
          attributions: [{ name: "O'Brien & Sons" }],
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle law with Unicode characters', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'Si quelque chose peut mal tourner, cela arrivera. Das Gesetz von Murphy.',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await ogImageService.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached images', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'Test law',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      // Generate and cache
      await ogImageService.generateLawImage(1);
      expect(mockLawService.getLaw).toHaveBeenCalledTimes(1);

      // Clear cache
      ogImageService.clearCache();

      // Generate again - should call getLaw again
      await ogImageService.generateLawImage(1);
      expect(mockLawService.getLaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const localThis = {
        law: {
          id: 1,
          text: 'Test law',
        },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      // Initial stats
      let stats = ogImageService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // First request (miss)
      await ogImageService.generateLawImage(1);
      stats = ogImageService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);

      // Second request (hit)
      await ogImageService.generateLawImage(1);
      stats = ogImageService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('50.00%');
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest entries when at capacity', async () => {
      // Create service with small cache size
      const localThis = {
        smallCacheService: new OgImageService(mockLawService, { cacheMaxSize: 2 }),
      };

      mockLawService.getLaw.mockImplementation((id) => ({
        id,
        text: `Law ${id}`,
      }));

      // Fill cache
      await localThis.smallCacheService.generateLawImage(1);
      await localThis.smallCacheService.generateLawImage(2);
      
      let stats = localThis.smallCacheService.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.evictions).toBe(0);

      // Add third item - should evict first
      await localThis.smallCacheService.generateLawImage(3);
      
      stats = localThis.smallCacheService.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.evictions).toBe(1);
    });

    it('should implement LRU - accessing an item moves it to the end', async () => {
      const localThis = {
        smallCacheService: new OgImageService(mockLawService, { cacheMaxSize: 2 }),
      };

      mockLawService.getLaw.mockImplementation((id) => ({
        id,
        text: `Law ${id}`,
      }));

      // Fill cache with items 1 and 2
      await localThis.smallCacheService.generateLawImage(1);
      await localThis.smallCacheService.generateLawImage(2);

      // Access item 1 (moves it to end, making 2 the oldest)
      await localThis.smallCacheService.generateLawImage(1);

      // Add item 3 - should evict item 2 (now oldest), not item 1
      await localThis.smallCacheService.generateLawImage(3);

      // Verify: accessing item 2 should be a cache miss (was evicted)
      // while item 1 should still be a hit
      const statsBeforeAccess = localThis.smallCacheService.getCacheStats();
      const hitsBefore = statsBeforeAccess.hits;

      await localThis.smallCacheService.generateLawImage(1);
      const statsAfterAccess1 = localThis.smallCacheService.getCacheStats();
      expect(statsAfterAccess1.hits).toBe(hitsBefore + 1); // Item 1 was a hit

      await localThis.smallCacheService.generateLawImage(2);
      const statsAfterAccess2 = localThis.smallCacheService.getCacheStats();
      expect(statsAfterAccess2.misses).toBe(statsAfterAccess1.misses + 1); // Item 2 was a miss (evicted)
    });
  });

  describe('cleanCache', () => {
    it('should remove expired entries', async () => {
      // Create service with very short cache max age
      const localThis = {
        shortTTLService: new OgImageService(mockLawService, { cacheMaxAge: 1 }), // 1ms TTL
      };

      mockLawService.getLaw.mockResolvedValue({ id: 1, text: 'Test law' });

      // Generate and cache
      await localThis.shortTTLService.generateLawImage(1);
      expect(localThis.shortTTLService.getCacheStats().size).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clean cache
      localThis.shortTTLService.cleanCache();

      // Cache should be empty
      expect(localThis.shortTTLService.getCacheStats().size).toBe(0);
    });
  });

  describe('loadLogo', () => {
    it('should load logo only once (cached)', async () => {
      // First call loads the logo
      const logo1 = await ogImageService.loadLogo();
      const logo2 = await ogImageService.loadLogo();

      // Should return the same cached result
      expect(logo1).toBe(logo2);
      expect(ogImageService.logoLoaded).toBe(true);
    });

    it('should handle missing logo file gracefully', async () => {
      const localThis = {
        serviceWithBadPath: new OgImageService(mockLawService, {
          logoPath: '/nonexistent/path/logo.png',
        }),
      };

      const logo = await localThis.serviceWithBadPath.loadLogo();

      expect(logo).toBeNull();
      expect(localThis.serviceWithBadPath.logoLoaded).toBe(true);
    });

    it('should generate image without logo when logo fails to load', async () => {
      const localThis = {
        serviceWithBadPath: new OgImageService(mockLawService, {
          logoPath: '/nonexistent/path/logo.png',
        }),
        law: { id: 1, text: 'Test law' },
      };

      mockLawService.getLaw.mockResolvedValue(localThis.law);

      const result = await localThis.serviceWithBadPath.generateLawImage(1);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getAttributionName', () => {
    it('should return null for undefined attributions', () => {
      const law = { id: 1 };
      const result = ogImageService.getAttributionName(law);
      expect(result).toBeNull();
    });

    it('should return null for empty attributions array', () => {
      const law = { id: 1, attributions: [] };
      const result = ogImageService.getAttributionName(law);
      expect(result).toBeNull();
    });

    it('should return first attribution name', () => {
      const localThis = {
        law: {
          id: 1,
          attributions: [
            { name: 'First Author' },
            { name: 'Second Author' },
          ],
        },
      };
      const result = ogImageService.getAttributionName(localThis.law);
      expect(result).toBe('First Author');
    });

    it('should return null if first attribution has no name', () => {
      const localThis = {
        law: {
          id: 1,
          attributions: [{ contact_type: 'email', contact_value: 'test@test.com' }],
        },
      };
      const result = ogImageService.getAttributionName(localThis.law);
      expect(result).toBeNull();
    });
  });
});
