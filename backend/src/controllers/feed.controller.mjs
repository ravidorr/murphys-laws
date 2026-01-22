/**
 * Feed Controller - Handles RSS and Atom feed requests
 */
export class FeedController {
  constructor(feedService) {
    this.feedService = feedService;
  }

  /**
   * Send XML response with appropriate headers
   * @param {object} res - HTTP response object
   * @param {string} xml - XML content
   * @param {string} contentType - Content-Type header value
   */
  _sendXml(res, xml, contentType) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    });
    res.end(xml);
  }

  /**
   * Send error response
   * @param {object} res - HTTP response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   */
  _sendError(res, statusCode, message) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Handle RSS feed request
   * GET /api/v1/feed.rss
   * @param {object} req - HTTP request object
   * @param {object} res - HTTP response object
   */
  async getRssFeed(req, res) {
    try {
      const xml = await this.feedService.generateRss();
      this._sendXml(res, xml, 'application/rss+xml; charset=utf-8');
    } catch (error) {
      console.error('Error generating RSS feed:', error);
      this._sendError(res, 500, 'Failed to generate RSS feed');
    }
  }

  /**
   * Handle Atom feed request
   * GET /api/v1/feed.atom
   * @param {object} req - HTTP request object
   * @param {object} res - HTTP response object
   */
  async getAtomFeed(req, res) {
    try {
      const xml = await this.feedService.generateAtom();
      this._sendXml(res, xml, 'application/atom+xml; charset=utf-8');
    } catch (error) {
      console.error('Error generating Atom feed:', error);
      this._sendError(res, 500, 'Failed to generate Atom feed');
    }
  }
}
