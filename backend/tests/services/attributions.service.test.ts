// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { AttributionService } from '../../src/services/attributions.service.ts';

describe('AttributionService', () => {
    let db;
    let attributionService;

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
});
