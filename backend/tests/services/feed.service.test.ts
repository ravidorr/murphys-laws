import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { LawService } from '../../src/services/laws.service.ts';
import { FeedService } from '../../src/services/feed.service.ts';

describe('FeedService', () => {
  let db: InstanceType<typeof Database>;
  let lawService: LawService;
  let feedService: FeedService;

  beforeEach(() => {
    // Use in-memory database for testing
    db = new Database(':memory:');

    // Create schema
    db.exec(`
      CREATE TABLE laws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        text TEXT NOT NULL,
        status TEXT DEFAULT 'published',
        first_seen_file_path TEXT,
        first_seen_line_number INTEGER,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      
      CREATE TABLE attributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        law_id INTEGER,
        name TEXT,
        contact_type TEXT,
        contact_value TEXT,
        note TEXT,
        FOREIGN KEY(law_id) REFERENCES laws(id)
      );
      
      CREATE TABLE votes (
        law_id INTEGER,
        vote_type TEXT,
        voter_identifier TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (law_id, voter_identifier)
      );
      
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        title TEXT,
        description TEXT
      );
      
      CREATE TABLE law_categories (
        law_id INTEGER,
        category_id INTEGER,
        PRIMARY KEY (law_id, category_id)
      );

      CREATE TABLE law_of_the_day_history (
        law_id INTEGER,
        featured_date DATE,
        PRIMARY KEY (law_id, featured_date)
      );
    `);

    lawService = new LawService(db);
    feedService = new FeedService(lawService);
  });

  describe('buildFeedData', () => {
    it('should return empty items when no laws exist', async () => {
      const localThis = { feedService };
      const { lotd, items } = await localThis.feedService.buildFeedData();
      expect(lotd).toBeNull();
      expect(items).toHaveLength(0);
    });

    it('should include LOTD and recent laws', async () => {
      const localThis = { db, feedService };
      // Insert multiple laws
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Law 1', 'published', '2024-01-01T00:00:00Z')").run();
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Law 2', 'published', '2024-01-02T00:00:00Z')").run();
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Law 3', 'published', '2024-01-03T00:00:00Z')").run();

      const { lotd, items } = await localThis.feedService.buildFeedData();
      expect(lotd).toBeDefined();
      expect(items.length).toBeGreaterThan(0);
    });

    it('should deduplicate LOTD from recent laws', async () => {
      const localThis = { db, feedService };
      // Insert a single law (will be both LOTD and only recent law)
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Only Law', 'published', '2024-01-01T00:00:00Z')").run();

      const { lotd, items } = await localThis.feedService.buildFeedData();
      expect(lotd).toBeDefined();
      if (!lotd) return;
      expect(lotd.text).toBe('Only Law');
      // Items should not include the LOTD since it's already featured
      expect(items).toHaveLength(0);
    });

    it('should deduplicate when LOTD is in recent laws list', async () => {
      const localThis = { db, feedService };
      // Insert laws with explicit dates
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Older Law', 'published', '2024-01-01T00:00:00Z')").run();
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Newer Law', 'published', '2024-01-02T00:00:00Z')").run();

      const { lotd, items } = await localThis.feedService.buildFeedData();
      
      // LOTD should be one of the laws
      expect(lotd).toBeDefined();
      if (!lotd) return;
      
      // Items should not contain the LOTD
      const lotdInItems = items.find(item => item.id === lotd.id);
      expect(lotdInItems).toBeUndefined();
    });

    // HIGH PRIORITY: Error propagation tests
    it('should propagate error when lawService.getLawOfTheDay() fails', async () => {
      const localThis = { feedService };
      vi.spyOn((localThis.feedService as unknown as { lawService: LawService }).lawService, 'getLawOfTheDay').mockRejectedValue(new Error('DB error'));
      
      await expect(localThis.feedService.buildFeedData()).rejects.toThrow('DB error');
    });

    it('should propagate error when lawService.listLaws() fails', async () => {
      const localThis = { feedService };
      vi.spyOn((localThis.feedService as unknown as { lawService: LawService }).lawService, 'getLawOfTheDay').mockResolvedValue(null);
      vi.spyOn((localThis.feedService as unknown as { lawService: LawService }).lawService, 'listLaws').mockRejectedValue(new Error('Query failed'));
      
      await expect(localThis.feedService.buildFeedData()).rejects.toThrow('Query failed');
    });

    // LOW PRIORITY: Verify FEED_ITEMS_LIMIT is respected
    it('should respect FEED_ITEMS_LIMIT constant (fetch max 10 items)', async () => {
      const localThis = { db, feedService };
      // Insert 15 laws to exceed the limit
      for (let i = 1; i <= 15; i++) {
        localThis.db.prepare(`INSERT INTO laws (text, status, created_at) VALUES ('Law ${i}', 'published', '2024-01-${String(i).padStart(2, '0')}T00:00:00Z')`).run();
      }

      const { items } = await localThis.feedService.buildFeedData();
      
      // Should have at most 10 items (FEED_ITEMS_LIMIT) minus LOTD if it's in the list
      // The actual count depends on whether LOTD is in the recent 10
      expect(items.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateRss', () => {
    it('should generate valid RSS 2.0 XML structure', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title) VALUES ('Test Law', 'published', 'Test Title')").run();

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
      expect(xml).toContain('<channel>');
      expect(xml).toContain('</channel>');
      expect(xml).toContain('</rss>');
    });

    it('should include site metadata in RSS', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status) VALUES ('Test Law', 'published')").run();

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain("<title>Murphy&apos;s Law Archive</title>");
      expect(xml).toContain('<link>https://murphys-laws.com</link>');
      expect(xml).toContain('<description>');
    });

    it('should mark LOTD in RSS item title', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title) VALUES ('Test Law', 'published', 'Test Title')").run();

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('[Law of the Day]');
    });

    it('should include RSS items with required elements', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title, created_at) VALUES ('Test Law Text', 'published', 'Test Title', '2024-01-15T12:00:00Z')").run();

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('<item>');
      expect(xml).toContain('</item>');
      expect(xml).toContain('<title>');
      expect(xml).toContain('<link>https://murphys-laws.com/#/law:');
      expect(xml).toContain('<description>Test Law Text</description>');
      expect(xml).toContain('<pubDate>');
      expect(xml).toContain('<guid isPermaLink="false">law-');
    });

    it('should include author when attribution exists', async () => {
      const localThis = { db, feedService };
      const lawInfo = localThis.db.prepare("INSERT INTO laws (text, status) VALUES ('Test Law', 'published')").run();
      localThis.db.prepare("INSERT INTO attributions (law_id, name, contact_type) VALUES (?, 'John Doe', 'email')").run(lawInfo.lastInsertRowid);

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('<author>John Doe</author>');
    });

    it('should escape XML special characters', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title) VALUES ('Law with <special> & \"chars\"', 'published', 'Title & <More>')").run();

      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;chars&quot;');
      expect(xml).not.toContain('<special>');
    });

    it('should truncate long text for title when no title exists', async () => {
      const localThis = { db, feedService };
      const longText = 'A'.repeat(100);
      localThis.db.prepare("INSERT INTO laws (text, status) VALUES (?, 'published')").run(longText);

      const xml = await localThis.feedService.generateRss();
      
      // Title should be truncated to 60 chars + '...'
      expect(xml).toContain('A'.repeat(60) + '...');
    });

    // MEDIUM PRIORITY: Valid XML without LOTD
    it('should generate valid RSS without LOTD when no laws exist', async () => {
      const localThis = { feedService };
      // No laws in DB = no LOTD
      const xml = await localThis.feedService.generateRss();
      
      expect(xml).toContain('<channel>');
      expect(xml).toContain('</channel>');
      expect(xml).toContain('</rss>');
      // Should not have any items
      expect(xml).not.toContain('<item>');
      expect(xml).not.toContain('[Law of the Day]');
    });

    // MEDIUM PRIORITY: Handle law with empty text
    it('should handle law with empty text in RSS item', async () => {
      const localThis = { feedService };
      const law = { id: 1, text: '', created_at: '2024-01-01T00:00:00Z' };
      const item = localThis.feedService._generateRssItem(law, false);
      
      expect(item).toContain('<description></description>');
      expect(item).toContain('<item>');
      expect(item).toContain('</item>');
    });

    it('should handle law with null text in RSS item', async () => {
      const localThis = { feedService };
      const law = { id: 1, text: null, created_at: '2024-01-01T00:00:00Z' };
      const item = localThis.feedService._generateRssItem(law, false);
      
      expect(item).toContain('<description></description>');
    });
  });

  describe('generateAtom', () => {
    it('should generate valid Atom 1.0 XML structure', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title) VALUES ('Test Law', 'published', 'Test Title')").run();

      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
      expect(xml).toContain('</feed>');
    });

    it('should include site metadata in Atom', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status) VALUES ('Test Law', 'published')").run();

      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain("<title>Murphy&apos;s Law Archive</title>");
      expect(xml).toContain('<subtitle>');
      expect(xml).toContain('<link href="https://murphys-laws.com" rel="alternate"/>');
      expect(xml).toContain('rel="self" type="application/atom+xml"/>');
      expect(xml).toContain('<id>https://murphys-laws.com/</id>');
      expect(xml).toContain('<updated>');
    });

    it('should mark LOTD in Atom entry title', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title) VALUES ('Test Law', 'published', 'Test Title')").run();

      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain('[Law of the Day]');
    });

    it('should include Atom entries with required elements', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, title, created_at) VALUES ('Test Law Text', 'published', 'Test Title', '2024-01-15T12:00:00Z')").run();

      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain('<entry>');
      expect(xml).toContain('</entry>');
      expect(xml).toContain('<title>');
      expect(xml).toContain('<link href="https://murphys-laws.com/#/law:');
      expect(xml).toContain('<id>https://murphys-laws.com/law/');
      expect(xml).toContain('<updated>');
      expect(xml).toContain('<content type="text">Test Law Text</content>');
    });

    it('should include author element when attribution exists', async () => {
      const localThis = { db, feedService };
      const lawInfo = localThis.db.prepare("INSERT INTO laws (text, status) VALUES ('Test Law', 'published')").run();
      localThis.db.prepare("INSERT INTO attributions (law_id, name, contact_type) VALUES (?, 'Jane Doe', 'email')").run(lawInfo.lastInsertRowid);

      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain('<author>');
      expect(xml).toContain('<name>Jane Doe</name>');
      expect(xml).toContain('</author>');
    });

    it('should format dates as ISO 8601 for Atom', async () => {
      const localThis = { db, feedService };
      localThis.db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Test Law', 'published', '2024-01-15T12:00:00Z')").run();

      const xml = await localThis.feedService.generateAtom();
      
      // ISO 8601 format check
      expect(xml).toMatch(/<updated>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z<\/updated>/);
    });

    // MEDIUM PRIORITY: Valid XML without LOTD
    it('should generate valid Atom without LOTD when no laws exist', async () => {
      const localThis = { feedService };
      // No laws in DB = no LOTD
      const xml = await localThis.feedService.generateAtom();
      
      expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
      expect(xml).toContain('</feed>');
      // Should not have any entries
      expect(xml).not.toContain('<entry>');
      expect(xml).not.toContain('[Law of the Day]');
    });

    // MEDIUM PRIORITY: Handle law with empty text
    it('should handle law with empty text in Atom entry', async () => {
      const localThis = { feedService };
      const law = { id: 1, text: '', created_at: '2024-01-01T00:00:00Z' };
      const entry = localThis.feedService._generateAtomEntry(law, false);
      
      expect(entry).toContain('<content type="text"></content>');
      expect(entry).toContain('<entry>');
      expect(entry).toContain('</entry>');
    });

    it('should handle law with null text in Atom entry', async () => {
      const localThis = { feedService };
      const law = { id: 1, text: null, created_at: '2024-01-01T00:00:00Z' };
      const entry = localThis.feedService._generateAtomEntry(law, false);
      
      expect(entry).toContain('<content type="text"></content>');
    });
  });

  describe('helper methods', () => {
    it('should truncate text correctly', () => {
      const localThis = { feedService };
      const shortText = 'Short';
      const longText = 'A'.repeat(100);

      expect(localThis.feedService._truncateText(shortText, 60)).toBe('Short');
      expect(localThis.feedService._truncateText(longText, 60)).toBe('A'.repeat(60) + '...');
      expect(localThis.feedService._truncateText('', 60)).toBe('');
      expect(localThis.feedService._truncateText(null, 60)).toBe('');
    });

    it('should escape XML special characters', () => {
      const localThis = { feedService };
      expect(localThis.feedService._escapeXml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&apos;');
      expect(localThis.feedService._escapeXml('')).toBe('');
      expect(localThis.feedService._escapeXml(null)).toBe('');
    });

    it('should generate correct law URLs', () => {
      const localThis = { feedService };
      expect(localThis.feedService._getLawUrl(123)).toBe('https://murphys-laws.com/#/law:123');
    });

    it('should get author from attributions', () => {
      const localThis = { feedService };
      const lawWithAttribution = { attributions: [{ name: 'John' }] };
      const lawWithoutAttribution = { attributions: [] };
      const lawNoAttributions = {};

      expect(localThis.feedService._getAuthor(lawWithAttribution)).toBe('John');
      expect(localThis.feedService._getAuthor(lawWithoutAttribution)).toBeNull();
      expect(localThis.feedService._getAuthor(lawNoAttributions)).toBeNull();
    });

    // LOW PRIORITY: Multiple attributions - verify first is used
    it('should return first author when multiple attributions exist', () => {
      const localThis = { feedService };
      const law = { attributions: [{ name: 'First Author' }, { name: 'Second Author' }, { name: 'Third Author' }] };
      
      expect(localThis.feedService._getAuthor(law)).toBe('First Author');
    });

    it('should format RFC-822 dates correctly', () => {
      const localThis = { feedService };
      const date = localThis.feedService._formatRfc822Date('2024-01-15T12:00:00Z');
      expect(date).toContain('Mon, 15 Jan 2024');
      expect(date).toContain('GMT');
    });

    // MEDIUM PRIORITY: Null date handling for RFC-822
    it('should return current date when isoDate is null for RFC-822', () => {
      const localThis = { feedService };
      const now = new Date();
      const result = localThis.feedService._formatRfc822Date(null);
      
      // Should contain current year and GMT
      expect(result).toContain(now.getUTCFullYear().toString());
      expect(result).toContain('GMT');
    });

    // MEDIUM PRIORITY: Invalid date handling for RFC-822
    it('should handle invalid date string in _formatRfc822Date', () => {
      const localThis = { feedService };
      const result = localThis.feedService._formatRfc822Date('invalid-date');
      
      // Invalid Date.toUTCString() returns "Invalid Date"
      expect(result).toBe('Invalid Date');
    });

    it('should format ISO 8601 dates correctly', () => {
      const localThis = { feedService };
      const date = localThis.feedService._formatIso8601Date('2024-01-15T12:00:00Z');
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    // MEDIUM PRIORITY: Null date handling for ISO 8601
    it('should return current date when isoDate is null for ISO-8601', () => {
      const localThis = { feedService };
      const result = localThis.feedService._formatIso8601Date(null);
      
      // Should be valid ISO 8601 format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    // MEDIUM PRIORITY: Invalid date handling for ISO 8601
    it('should handle invalid date string in _formatIso8601Date', () => {
      const localThis = { feedService };
      const result = localThis.feedService._formatIso8601Date('invalid-date');
      
      // Invalid Date.toISOString() throws an error, but our implementation should handle it
      // Since new Date('invalid').toISOString() throws RangeError, this tests error handling
      expect(result).toBe('Invalid Date');
    });

    it('should get law title with LOTD prefix when isLotd is true', () => {
      const localThis = { feedService };
      const law = { title: 'Test Title', text: 'Some text' };
      
      expect(localThis.feedService._getLawTitle(law, false)).toBe('Test Title');
      expect(localThis.feedService._getLawTitle(law, true)).toBe('[Law of the Day] Test Title');
    });

    it('should use truncated text when no title exists', () => {
      const localThis = { feedService };
      const law = { text: 'Some text for the law' };
      
      expect(localThis.feedService._getLawTitle(law, false)).toBe('Some text for the law');
    });
  });
});
