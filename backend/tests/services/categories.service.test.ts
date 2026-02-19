// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { CategoryService } from '../../src/services/categories.service.ts';

describe('CategoryService', () => {
    let db;
    let categoryService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        title TEXT,
        description TEXT
      );
      CREATE TABLE laws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        status TEXT DEFAULT 'published'
      );
      CREATE TABLE law_categories (
        law_id INTEGER,
        category_id INTEGER,
        PRIMARY KEY (law_id, category_id)
      );
    `);
        categoryService = new CategoryService(db);
    });

    it('should list categories with law counts', async () => {
        const cat1 = db.prepare("INSERT INTO categories (title, slug) VALUES ('Tech', 'tech')").run();
        const cat2 = db.prepare("INSERT INTO categories (title, slug) VALUES ('Life', 'life')").run();

        // Add laws to Tech
        const law1 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 1', 'published')").run();
        const law2 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 2', 'published')").run();
        const law3 = db.prepare("INSERT INTO laws (text, status) VALUES ('Law 3', 'in_review')").run(); // Should not be counted

        db.prepare("INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)").run(law1.lastInsertRowid, cat1.lastInsertRowid);
        db.prepare("INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)").run(law2.lastInsertRowid, cat1.lastInsertRowid);
        db.prepare("INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)").run(law3.lastInsertRowid, cat1.lastInsertRowid);

        const categories = await categoryService.listCategories();
        expect(categories).toHaveLength(2);
        
        const life = categories.find(c => c.slug === 'life');
        const tech = categories.find(c => c.slug === 'tech');
        
        expect(life.law_count).toBe(0);
        expect(tech.law_count).toBe(2);
    });

    it('should list categories with descriptions', async () => {
        db.prepare("INSERT INTO categories (title, slug, description) VALUES ('Tech', 'tech', 'Technology related laws')").run();
        db.prepare("INSERT INTO categories (title, slug, description) VALUES ('Life', 'life', NULL)").run();

        const categories = await categoryService.listCategories();
        expect(categories).toHaveLength(2);
        
        const tech = categories.find(c => c.slug === 'tech');
        const life = categories.find(c => c.slug === 'life');
        
        expect(tech.description).toBe('Technology related laws');
        expect(life.description).toBeNull();
    });

    it('should get category by id', async () => {
        const info = db.prepare("INSERT INTO categories (title, slug) VALUES ('Tech', 'tech')").run();
        const id = info.lastInsertRowid;

        const category = await categoryService.getCategory(id);
        expect(category.title).toBe('Tech');
    });

    it('should get category by id with description', async () => {
        const info = db.prepare("INSERT INTO categories (title, slug, description) VALUES ('Tech', 'tech', 'Technology related laws')").run();
        const id = info.lastInsertRowid;

        const category = await categoryService.getCategory(id);
        expect(category.title).toBe('Tech');
        expect(category.description).toBe('Technology related laws');
    });

    it('should get category with null description', async () => {
        const info = db.prepare("INSERT INTO categories (title, slug, description) VALUES ('Life', 'life', NULL)").run();
        const id = info.lastInsertRowid;

        const category = await categoryService.getCategory(id);
        expect(category.title).toBe('Life');
        expect(category.description).toBeNull();
    });
});
