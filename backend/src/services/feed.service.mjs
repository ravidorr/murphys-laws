import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, FEED_ITEMS_LIMIT } from '../utils/constants.js';

/**
 * Feed Service - Generates RSS 2.0 and Atom 1.0 feeds
 * Combines Law of the Day with recent laws
 */
export class FeedService {
  constructor(lawService) {
    this.lawService = lawService;
  }

  /**
   * Build feed data by combining Law of the Day with recent laws
   * @returns {Promise<{lotd: object|null, items: Array}>}
   */
  async buildFeedData() {
    // Fetch Law of the Day
    const lotdResult = await this.lawService.getLawOfTheDay();
    const lotd = lotdResult ? lotdResult.law : null;

    // Fetch recent laws sorted by created_at
    const { data: recentLaws } = await this.lawService.listLaws({
      limit: FEED_ITEMS_LIMIT,
      offset: 0,
      sort: 'created_at',
      order: 'desc'
    });

    // Deduplicate: remove LOTD from recent laws if present
    const items = [];
    const lotdId = lotd ? lotd.id : null;

    for (const law of recentLaws) {
      if (law.id !== lotdId) {
        items.push(law);
      }
    }

    return { lotd, items };
  }

  /**
   * Get the title for a law (use title if available, otherwise truncate text)
   * @param {object} law - The law object
   * @param {boolean} isLotd - Whether this is the Law of the Day
   * @returns {string}
   */
  _getLawTitle(law, isLotd = false) {
    let title = law.title || this._truncateText(law.text, 60);
    if (isLotd) {
      title = `[Law of the Day] ${title}`;
    }
    return title;
  }

  /**
   * Truncate text to a maximum length with ellipsis
   * @param {string} text - The text to truncate
   * @param {number} maxLength - Maximum length before truncation
   * @returns {string}
   */
  _truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Get the author name from a law's attributions
   * @param {object} law - The law object
   * @returns {string|null}
   */
  _getAuthor(law) {
    if (law.attributions && law.attributions.length > 0) {
      return law.attributions[0].name;
    }
    return null;
  }

  /**
   * Format date as RFC-822 (for RSS)
   * @param {string} isoDate - ISO 8601 date string
   * @returns {string}
   */
  _formatRfc822Date(isoDate) {
    if (!isoDate) {
      return new Date().toUTCString();
    }
    return new Date(isoDate).toUTCString();
  }

  /**
   * Format date as ISO 8601 (for Atom)
   * @param {string} isoDate - ISO 8601 date string
   * @returns {string}
   */
  _formatIso8601Date(isoDate) {
    if (!isoDate) {
      return new Date().toISOString();
    }
    // Ensure proper ISO format
    const date = new Date(isoDate);
    // Handle invalid dates gracefully
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toISOString();
  }

  /**
   * Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string}
   */
  _escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate the law URL
   * @param {number} lawId - The law ID
   * @returns {string}
   */
  _getLawUrl(lawId) {
    return `${SITE_URL}/#/law:${lawId}`;
  }

  /**
   * Generate RSS 2.0 feed
   * @returns {Promise<string>} RSS XML string
   */
  async generateRss() {
    const { lotd, items } = await this.buildFeedData();
    const now = this._formatRfc822Date();
    const feedUrl = `${SITE_URL}/api/v1/feed.rss`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this._escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${this._escapeXml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
`;

    // Add Law of the Day first (if available)
    if (lotd) {
      xml += this._generateRssItem(lotd, true);
    }

    // Add recent laws
    for (const law of items) {
      xml += this._generateRssItem(law, false);
    }

    xml += `  </channel>
</rss>`;

    return xml;
  }

  /**
   * Generate a single RSS item
   * @param {object} law - The law object
   * @param {boolean} isLotd - Whether this is the Law of the Day
   * @returns {string}
   */
  _generateRssItem(law, isLotd) {
    const title = this._getLawTitle(law, isLotd);
    const link = this._getLawUrl(law.id);
    const description = law.text || '';
    const pubDate = this._formatRfc822Date(law.created_at);
    const guid = `law-${law.id}`;
    const author = this._getAuthor(law);

    let item = `    <item>
      <title>${this._escapeXml(title)}</title>
      <link>${link}</link>
      <description>${this._escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${guid}</guid>
`;

    if (author) {
      item += `      <author>${this._escapeXml(author)}</author>
`;
    }

    item += `    </item>
`;

    return item;
  }

  /**
   * Generate Atom 1.0 feed
   * @returns {Promise<string>} Atom XML string
   */
  async generateAtom() {
    const { lotd, items } = await this.buildFeedData();
    const now = this._formatIso8601Date();
    const feedUrl = `${SITE_URL}/api/v1/feed.atom`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${this._escapeXml(SITE_NAME)}</title>
  <subtitle>${this._escapeXml(SITE_DESCRIPTION)}</subtitle>
  <link href="${SITE_URL}" rel="alternate"/>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <id>${SITE_URL}/</id>
  <updated>${now}</updated>
`;

    // Add Law of the Day first (if available)
    if (lotd) {
      xml += this._generateAtomEntry(lotd, true);
    }

    // Add recent laws
    for (const law of items) {
      xml += this._generateAtomEntry(law, false);
    }

    xml += `</feed>`;

    return xml;
  }

  /**
   * Generate a single Atom entry
   * @param {object} law - The law object
   * @param {boolean} isLotd - Whether this is the Law of the Day
   * @returns {string}
   */
  _generateAtomEntry(law, isLotd) {
    const title = this._getLawTitle(law, isLotd);
    const link = this._getLawUrl(law.id);
    const content = law.text || '';
    const updated = this._formatIso8601Date(law.created_at);
    const id = `${SITE_URL}/law/${law.id}`;
    const author = this._getAuthor(law);

    let entry = `  <entry>
    <title>${this._escapeXml(title)}</title>
    <link href="${link}" rel="alternate"/>
    <id>${id}</id>
    <updated>${updated}</updated>
    <content type="text">${this._escapeXml(content)}</content>
`;

    if (author) {
      entry += `    <author>
      <name>${this._escapeXml(author)}</name>
    </author>
`;
    }

    entry += `  </entry>
`;

    return entry;
  }
}
