import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { AttributionService, isEmailLike, sanitizeDisplayName } from '../../src/services/attributions.service.ts';

describe('AttributionService', () => {
    let db: InstanceType<typeof Database>;
    let attributionService: AttributionService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
      CREATE TABLE attributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        law_id INTEGER,
        name TEXT,
        contact_type TEXT,
        contact_value TEXT,
        note TEXT
      );
    `);
        attributionService = new AttributionService(db);
    });

    it('should list unique attribution names', async () => {
        db.prepare("INSERT INTO attributions (name) VALUES ('Author A')").run();
        db.prepare("INSERT INTO attributions (name) VALUES ('Author B')").run();
        db.prepare("INSERT INTO attributions (name) VALUES ('Author A')").run(); // Duplicate

        const attributions = await attributionService.listAttributions();
        expect(attributions).toHaveLength(2);
        expect(attributions.map(a => a.name)).toEqual(['Author A', 'Author B']);
    });

    it('should not expose emails in list (map to Anonymous)', async () => {
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (1, 'user@example.com')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (2, 'other@site.org')").run();

        const attributions = await attributionService.listAttributions();
        expect(attributions.map(a => a.name)).toContain('Anonymous');
        expect(attributions.some(a => a.name.includes('@'))).toBe(false);
    });

    it('should dedupe Anonymous when multiple emails', async () => {
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (1, 'a@b.com')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (2, 'c@d.com')").run();

        const attributions = await attributionService.listAttributions();
        const anonymousCount = attributions.filter(a => a.name === 'Anonymous').length;
        expect(anonymousCount).toBe(1);
    });

    it('searchSubmitters returns matching display-safe names', async () => {
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (1, 'Alice')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (2, 'Bob')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (3, 'Alicia')").run();

        const result = await attributionService.searchSubmitters('Ali', 20);
        expect(result.map(a => a.name)).toEqual(['Alice', 'Alicia']);
    });

    it('searchSubmitters with empty q returns up to limit', async () => {
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (1, 'A')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (2, 'B')").run();
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (3, 'C')").run();

        const result = await attributionService.searchSubmitters('', 2);
        expect(result).toHaveLength(2);
    });

    it('searchSubmitters never returns emails', async () => {
        db.prepare("INSERT INTO attributions (law_id, name) VALUES (1, 'user@example.com')").run();
        const result = await attributionService.searchSubmitters('user', 20);
        expect(result.some(a => a.name.includes('@'))).toBe(false);
        expect(result.map(a => a.name)).toContain('Anonymous');
    });
});

describe('isEmailLike', () => {
    it('returns true for valid-looking email', () => {
        expect(isEmailLike('a@b.com')).toBe(true);
        expect(isEmailLike('user@example.org')).toBe(true);
    });
    it('returns true for string containing @', () => {
        expect(isEmailLike('not an email but has @ sign')).toBe(true);
    });
    it('returns false for display name', () => {
        expect(isEmailLike('Jane Doe')).toBe(false);
        expect(isEmailLike('Murphy')).toBe(false);
    });
    it('returns false for empty or non-string', () => {
        expect(isEmailLike('')).toBe(false);
        expect(isEmailLike('   ')).toBe(false);
    });
});

describe('sanitizeDisplayName', () => {
    it('returns Anonymous for email-like input', () => {
        expect(sanitizeDisplayName('a@b.com')).toBe('Anonymous');
    });
    it('returns trimmed name for display name', () => {
        expect(sanitizeDisplayName('  Jane Doe  ')).toBe('Jane Doe');
    });
    it('returns Anonymous for undefined/null string', () => {
        expect(sanitizeDisplayName('undefined')).toBe('Anonymous');
        expect(sanitizeDisplayName('null')).toBe('Anonymous');
    });
});
