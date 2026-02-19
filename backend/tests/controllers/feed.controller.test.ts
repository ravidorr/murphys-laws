// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedController } from '../../src/controllers/feed.controller.ts';

describe('FeedController', () => {
  /** @type {object} */
  let feedService;
  /** @type {FeedController} */
  let feedController;
  /** @type {object} */
  let req;
  /** @type {object} */
  let res;

  beforeEach(() => {
    const localThis = {};
    localThis.feedService = {
      generateRss: vi.fn(),
      generateAtom: vi.fn(),
    };
    feedService = localThis.feedService;
    localThis.feedController = new FeedController(feedService);
    feedController = localThis.feedController;

    localThis.req = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };
    req = localThis.req;
    localThis.res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    res = localThis.res;

    vi.clearAllMocks();
  });

  describe('getRssFeed', () => {
    it('should return RSS feed with correct Content-Type', async () => {
      const localThis = { feedService, feedController, req, res };
      const rssXml = '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>';
      localThis.feedService.generateRss.mockResolvedValue(rssXml);

      await localThis.feedController.getRssFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(rssXml);
    });

    it('should set cache headers for RSS feed', async () => {
      const localThis = { feedService, feedController, req, res };
      localThis.feedService.generateRss.mockResolvedValue('<rss></rss>');

      await localThis.feedController.getRssFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Cache-Control': 'public, max-age=3600'
      }));
    });

    it('should return 500 on RSS generation error', async () => {
      const localThis = { feedService, feedController, req, res };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localThis.feedService.generateRss.mockRejectedValue(new Error('Generation failed'));

      await localThis.feedController.getRssFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Failed to generate RSS feed' }));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getAtomFeed', () => {
    it('should return Atom feed with correct Content-Type', async () => {
      const localThis = { feedService, feedController, req, res };
      const atomXml = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';
      localThis.feedService.generateAtom.mockResolvedValue(atomXml);

      await localThis.feedController.getAtomFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(atomXml);
    });

    it('should set cache headers for Atom feed', async () => {
      const localThis = { feedService, feedController, req, res };
      localThis.feedService.generateAtom.mockResolvedValue('<feed></feed>');

      await localThis.feedController.getAtomFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Cache-Control': 'public, max-age=3600'
      }));
    });

    it('should return 500 on Atom generation error', async () => {
      const localThis = { feedService, feedController, req, res };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localThis.feedService.generateAtom.mockRejectedValue(new Error('Generation failed'));

      await localThis.feedController.getAtomFeed(localThis.req, localThis.res);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Failed to generate Atom feed' }));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('_sendXml', () => {
    it('should send XML response with correct headers', () => {
      const localThis = { feedController, res };
      const xml = '<test>content</test>';
      const contentType = 'application/xml';

      localThis.feedController._sendXml(localThis.res, xml, contentType);

      expect(localThis.res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(xml);
    });
  });

  describe('_sendError', () => {
    it('should send error response with JSON content type', () => {
      const localThis = { feedController, res };
      
      localThis.feedController._sendError(localThis.res, 500, 'Test error');

      expect(localThis.res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      expect(localThis.res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Test error' }));
    });

    it('should send error with custom status code', () => {
      const localThis = { feedController, res };
      
      localThis.feedController._sendError(localThis.res, 404, 'Not found');

      expect(localThis.res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});
