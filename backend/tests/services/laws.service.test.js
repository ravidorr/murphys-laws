import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { LawService } from '../../src/services/laws.service.mjs';

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
        first_seen_line_number INTEGER
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
});