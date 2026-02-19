// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { LawService } from '../../src/services/laws.service.ts';

describe('LawService', () => {
  let db;
  let lawService;

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
  });

  it('should list published laws', async () => {
    db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'in_review')").run();

    const result = await lawService.listLaws({ limit: 10, offset: 0 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Law 1');
    expect(result.total).toBe(1);
  });

  it('should filter laws by search query', async () => {
    db.prepare("INSERT INTO laws (text, status) VALUES ('Apple', 'published')").run();
    db.prepare("INSERT INTO laws (text, status) VALUES ('Banana', 'published')").run();

    const result = await lawService.listLaws({ limit: 10, offset: 0, q: 'App' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Apple');
  });

  it('should get a single law by id', async () => {
    const info = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    const id = info.lastInsertRowid;

    const law = await lawService.getLaw(id);
    expect(law).toBeDefined();
    expect(law.text).toBe('Law 1');
  });

  it('should submit a new law', async () => {
    const lawId = await lawService.submitLaw({
      title: 'New Law',
      text: 'Everything that can go wrong...',
      author: 'Murphy',
      email: 'murphy@example.com',
      categoryId: null
    });

    const law = db.prepare('SELECT * FROM laws WHERE id = ?').get(lawId);
    expect(law).toBeDefined();
    expect(law.status).toBe('in_review');
    expect(law.text).toBe('Everything that can go wrong...');

    const attribution = db.prepare('SELECT * FROM attributions WHERE law_id = ?').get(lawId);
    expect(attribution.name).toBe('Murphy');
    expect(attribution.contact_value).toBe('murphy@example.com');
  });

  it('should filter laws by category', async () => {
    const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
    const categoryId = catInfo.lastInsertRowid;

    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Tech Law', 'published')").run();
    db.prepare("INSERT INTO laws (text, status) VALUES ('Other Law', 'published')").run();

    db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);

    const result = await lawService.listLaws({ limit: 10, offset: 0, categoryId });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Tech Law');
  });

  it('should filter laws by attribution', async () => {
    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'published')").run();

    db.prepare("INSERT INTO attributions (law_id, name) VALUES (?, 'Murphy')").run(law1.lastInsertRowid);
    db.prepare("INSERT INTO attributions (law_id, name) VALUES (?, 'Einstein')").run(law2.lastInsertRowid);

    const result = await lawService.listLaws({ limit: 10, offset: 0, attribution: 'Mur' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Law 1');
  });

  it('should get law of the day (first time)', async () => {
    db.prepare("INSERT INTO laws (text, status) VALUES ('Daily Law', 'published')").run();

    const result = await lawService.getLawOfTheDay();
    expect(result).toBeDefined();
    expect(result.law).toBeDefined();
    expect(result.featured_date).toBeDefined();
  });

  it('should get law of the day (from history)', async () => {
    const lawInfo = db.prepare("INSERT INTO laws (text, status) VALUES ('Historical Law', 'published')").run();
    const today = new Date().toISOString().split('T')[0];

    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(lawInfo.lastInsertRowid, today);

    const result = await lawService.getLawOfTheDay();
    expect(result.law.text).toBe('Historical Law');
  });

  it('should filter laws by category slug', async () => {
    const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
    const categoryId = catInfo.lastInsertRowid;

    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Tech Law', 'published')").run();
    db.prepare("INSERT INTO laws (text, status) VALUES ('Other Law', 'published')").run();

    db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);

    const result = await lawService.listLaws({ limit: 10, offset: 0, categorySlug: 'tech' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Tech Law');
  });

  it('should submit law with category', async () => {
    const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
    const categoryId = catInfo.lastInsertRowid;

    const lawId = await lawService.submitLaw({
      title: 'Categorized Law',
      text: 'Text',
      categoryId
    });

    const rel = db.prepare('SELECT * FROM law_categories WHERE law_id = ?').get(lawId);
    expect(rel.category_id).toBe(categoryId);
  });

  it('should submit law without author', async () => {
    const lawId = await lawService.submitLaw({
      text: 'Anon Law'
    });
    
    const law = db.prepare('SELECT * FROM laws WHERE id = ?').get(lawId);
    expect(law.text).toBe('Anon Law');
    
    const attribution = db.prepare('SELECT * FROM attributions WHERE law_id = ?').get(lawId);
    expect(attribution).toBeUndefined();
  });

  it('should fallback to recently featured law if no fresh laws available', async () => {
    // 1. Insert a law
    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    
    // 2. Mark it as featured yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(law1.lastInsertRowid, yesterday);
    
    // 3. Try to get law of day (candidates query will fail, fallback should run)
    const result = await lawService.getLawOfTheDay();
    expect(result.law.id).toBe(law1.lastInsertRowid);
  });

  it('should return null if no published laws at all', async () => {
    const result = await lawService.getLawOfTheDay();
    expect(result).toBeNull();
  });

  it('should return null for getLaw when law not found', async () => {
    const law = await lawService.getLaw(999);
    expect(law).toBeUndefined();
  });

  it('should sort laws by score (default)', async () => {
    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'published')").run();
    const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 3', 'published')").run();

    // Law 2 gets 3 upvotes, Law 1 gets 1 upvote, Law 3 gets 0
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter2')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter3')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law1.lastInsertRowid);

    const result = await lawService.listLaws({ limit: 10, offset: 0, sort: 'score', order: 'desc' });
    expect(result.data[0].text).toBe('Law 2'); // 3 upvotes
    expect(result.data[1].text).toBe('Law 1'); // 1 upvote
    expect(result.data[2].text).toBe('Law 3'); // 0 upvotes
  });

  it('should sort laws by upvotes descending', async () => {
    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
    const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'published')").run();

    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter2')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law1.lastInsertRowid);

    const result = await lawService.listLaws({ limit: 10, offset: 0, sort: 'upvotes', order: 'desc' });
    expect(result.data[0].text).toBe('Law 2'); // 2 upvotes
    expect(result.data[1].text).toBe('Law 1'); // 1 upvote
  });

  it('should sort laws by created_at ascending (oldest first)', async () => {
    // Insert with explicit timestamps
    db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Oldest', 'published', '2020-01-01T00:00:00Z')").run();
    db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Middle', 'published', '2022-01-01T00:00:00Z')").run();
    db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Newest', 'published', '2024-01-01T00:00:00Z')").run();

    const result = await lawService.listLaws({ limit: 10, offset: 0, sort: 'created_at', order: 'asc' });
    expect(result.data[0].text).toBe('Oldest');
    expect(result.data[1].text).toBe('Middle');
    expect(result.data[2].text).toBe('Newest');
  });

  it('should sort laws by created_at descending (newest first)', async () => {
    db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Oldest', 'published', '2020-01-01T00:00:00Z')").run();
    db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Newest', 'published', '2024-01-01T00:00:00Z')").run();

    const result = await lawService.listLaws({ limit: 10, offset: 0, sort: 'created_at', order: 'desc' });
    expect(result.data[0].text).toBe('Newest');
    expect(result.data[1].text).toBe('Oldest');
  });

  it('should sort laws by last_voted_at descending', async () => {
    const law1 = db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Law 1', 'published', '2020-01-01T00:00:00Z')").run();
    const law2 = db.prepare("INSERT INTO laws (text, status, created_at) VALUES ('Law 2', 'published', '2020-01-01T00:00:00Z')").run();

    // Law 1 was voted on more recently
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier, created_at) VALUES (?, 'up', 'voter1', '2024-01-01T00:00:00Z')").run(law1.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier, created_at) VALUES (?, 'up', 'voter1', '2022-01-01T00:00:00Z')").run(law2.lastInsertRowid);

    const result = await lawService.listLaws({ limit: 10, offset: 0, sort: 'last_voted_at', order: 'desc' });
    expect(result.data[0].text).toBe('Law 1'); // More recent vote
    expect(result.data[1].text).toBe('Law 2');
  });

  it('should default to score desc when no sort specified', async () => {
    const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Low Score', 'published')").run();
    const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('High Score', 'published')").run();

    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law2.lastInsertRowid);
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter2')").run(law2.lastInsertRowid);

    // No sort parameter
    const result = await lawService.listLaws({ limit: 10, offset: 0 });
    expect(result.data[0].text).toBe('High Score');
  });

  it('should throw error when law insert fails', async () => {
    // Mock db.prepare to return a statement that returns null from get()
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql) => {
      if (sql.includes('INSERT INTO laws')) {
        return {
          get: () => null, // Simulate insert failure
          run: () => ({ changes: 0 }),
        };
      }
      return originalPrepare(sql);
    });

    await expect(lawService.submitLaw({
      title: 'Test',
      text: 'Test text'
    })).rejects.toThrow('Failed to insert law');
  });

  describe('suggestions', () => {
    beforeEach(() => {
      // Insert test laws
      db.prepare("INSERT INTO laws (text, title, status) VALUES ('Test law about computers', 'Computer Law', 'published')").run();
      db.prepare("INSERT INTO laws (text, status) VALUES ('Another test law', 'published')").run();
      db.prepare("INSERT INTO laws (text, status) VALUES ('Computer programming tips', 'published')").run();
      db.prepare("INSERT INTO laws (text, status) VALUES ('Unrelated law', 'published')").run();
      db.prepare("INSERT INTO laws (text, status) VALUES ('Draft law', 'draft')").run();
    });

    it('should return suggestions for matching query', async () => {
      const result = await lawService.suggestions({ q: 'test', limit: 10 });
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('text');
    });

    it('should prioritize text matches over title matches', async () => {
      const result = await lawService.suggestions({ q: 'computer', limit: 10 });
      expect(result.data.length).toBeGreaterThan(0);
      // First result should be the one with "computer" in text, not just title
      const firstLaw = result.data[0];
      expect(firstLaw.text.toLowerCase()).toContain('computer');
    });

    it('should respect limit parameter', async () => {
      const result = await lawService.suggestions({ q: 'law', limit: 2 });
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should cap limit at 20', async () => {
      const result = await lawService.suggestions({ q: 'law', limit: 100 });
      expect(result.data.length).toBeLessThanOrEqual(20);
    });

    it('should return empty array for query shorter than 2 characters', async () => {
      const result = await lawService.suggestions({ q: 'a', limit: 10 });
      expect(result.data).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      const result = await lawService.suggestions({ q: '', limit: 10 });
      expect(result.data).toEqual([]);
    });

    it('should return empty array for no matches', async () => {
      const result = await lawService.suggestions({ q: 'nonexistentquery12345', limit: 10 });
      expect(result.data).toEqual([]);
    });

    it('should only return published laws', async () => {
      const result = await lawService.suggestions({ q: 'draft', limit: 10 });
      // Should not include the draft law
      const draftLaw = result.data.find(law => law.text.includes('Draft'));
      expect(draftLaw).toBeUndefined();
    });

    it('should handle special characters in query', async () => {
      db.prepare("INSERT INTO laws (text, status) VALUES ('Law with % special chars', 'published')").run();
      const result = await lawService.suggestions({ q: '% special', limit: 10 });
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should sort by score when multiple matches', async () => {
      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('High score law', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Low score law', 'published')").run();
      
      // Add votes to law1
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter1')").run(law1.lastInsertRowid);
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'voter2')").run(law1.lastInsertRowid);

      const result = await lawService.suggestions({ q: 'score', limit: 10 });
      expect(result.data.length).toBeGreaterThan(0);
      // Higher scored law should appear first
      expect(result.data[0].text).toBe('High score law');
    });
  });

  describe('getLaw with categories', () => {
    it('should return category_id and category_ids for law with categories', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const lawInfo = db.prepare("INSERT INTO laws (text, status) VALUES ('Tech Law', 'published')").run();
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(lawInfo.lastInsertRowid, categoryId);

      const law = await lawService.getLaw(lawInfo.lastInsertRowid);
      expect(law.category_id).toBe(categoryId);
      expect(law.category_ids).toEqual([categoryId]);
    });

    it('should return multiple category_ids for law with multiple categories', async () => {
      const cat1 = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const cat2 = db.prepare("INSERT INTO categories (slug, title) VALUES ('humor', 'Humor')").run();

      const lawInfo = db.prepare("INSERT INTO laws (text, status) VALUES ('Multi-Category Law', 'published')").run();
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(lawInfo.lastInsertRowid, cat1.lastInsertRowid);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(lawInfo.lastInsertRowid, cat2.lastInsertRowid);

      const law = await lawService.getLaw(lawInfo.lastInsertRowid);
      expect(law.category_id).toBe(cat1.lastInsertRowid); // First category
      expect(law.category_ids).toHaveLength(2);
      expect(law.category_ids).toContain(cat1.lastInsertRowid);
      expect(law.category_ids).toContain(cat2.lastInsertRowid);
    });

    it('should return null category_id and empty category_ids for law without categories', async () => {
      const lawInfo = db.prepare("INSERT INTO laws (text, status) VALUES ('No Category Law', 'published')").run();

      const law = await lawService.getLaw(lawInfo.lastInsertRowid);
      expect(law.category_id).toBeNull();
      expect(law.category_ids).toEqual([]);
    });
  });

  describe('getRelatedLaws', () => {
    it('should return empty array when law has no categories', async () => {
      const lawInfo = db.prepare("INSERT INTO laws (text, status) VALUES ('No Category Law', 'published')").run();

      const related = await lawService.getRelatedLaws(lawInfo.lastInsertRowid);
      expect(related).toEqual([]);
    });

    it('should return related laws from same category', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'published')").run();
      const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 3', 'published')").run();

      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law3.lastInsertRowid, categoryId);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(2);
      expect(related.map(r => r.text)).toContain('Law 2');
      expect(related.map(r => r.text)).toContain('Law 3');
    });

    it('should exclude the current law from results', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current Law', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Related Law', 'published')").run();

      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, categoryId);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(1);
      expect(related[0].text).toBe('Related Law');
      expect(related.map(r => r.id)).not.toContain(law1.lastInsertRowid);
    });

    it('should respect limit parameter', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      for (let i = 2; i <= 10; i++) {
        const lawN = db.prepare(`INSERT INTO laws (text, status) VALUES ('Law ${i}', 'published')`).run();
        db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(lawN.lastInsertRowid, categoryId);
      }
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid, { limit: 3 });
      expect(related).toHaveLength(3);
    });

    it('should sort by score descending', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Low Score', 'published')").run();
      const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('High Score', 'published')").run();

      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law3.lastInsertRowid, categoryId);

      // High Score gets 3 upvotes, Low Score gets 1
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'v1')").run(law3.lastInsertRowid);
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'v2')").run(law3.lastInsertRowid);
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'v3')").run(law3.lastInsertRowid);
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'v1')").run(law2.lastInsertRowid);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related[0].text).toBe('High Score');
      expect(related[1].text).toBe('Low Score');
    });

    it('should only return published laws', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Published', 'published')").run();
      const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('In Review', 'in_review')").run();

      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law3.lastInsertRowid, categoryId);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(1);
      expect(related[0].text).toBe('Published');
    });

    it('should handle laws with multiple categories', async () => {
      const cat1 = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const cat2 = db.prepare("INSERT INTO categories (slug, title) VALUES ('humor', 'Humor')").run();

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Tech Only', 'published')").run();
      const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('Humor Only', 'published')").run();

      // Current law is in both categories
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, cat1.lastInsertRowid);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, cat2.lastInsertRowid);
      // Tech Only in tech category
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, cat1.lastInsertRowid);
      // Humor Only in humor category
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law3.lastInsertRowid, cat2.lastInsertRowid);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(2);
      expect(related.map(r => r.text)).toContain('Tech Only');
      expect(related.map(r => r.text)).toContain('Humor Only');
    });

    it('should return laws with upvotes and downvotes fields', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      const law2 = db.prepare("INSERT INTO laws (title, text, status) VALUES ('Related Title', 'Related Text', 'published')").run();

      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law2.lastInsertRowid, categoryId);

      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'v1')").run(law2.lastInsertRowid);
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'down', 'v2')").run(law2.lastInsertRowid);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(1);
      expect(related[0].id).toBe(law2.lastInsertRowid);
      expect(related[0].title).toBe('Related Title');
      expect(related[0].text).toBe('Related Text');
      expect(related[0].upvotes).toBe(1);
      expect(related[0].downvotes).toBe(1);
      expect(related[0].score).toBe(0);
    });

    it('should use default limit of 5', async () => {
      const catInfo = db.prepare("INSERT INTO categories (slug, title) VALUES ('tech', 'Technology')").run();
      const categoryId = catInfo.lastInsertRowid;

      const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Current', 'published')").run();
      for (let i = 2; i <= 10; i++) {
        const lawN = db.prepare(`INSERT INTO laws (text, status) VALUES ('Law ${i}', 'published')`).run();
        db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(lawN.lastInsertRowid, categoryId);
      }
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(law1.lastInsertRowid, categoryId);

      const related = await lawService.getRelatedLaws(law1.lastInsertRowid);
      expect(related).toHaveLength(5);
    });
  });
});
