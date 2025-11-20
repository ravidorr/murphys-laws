import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { CategoryService } from '../../src/services/categories.service.mjs';

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
    `);
        categoryService = new CategoryService(db);
    });

    it('should list categories', async () => {
        db.prepare("INSERT INTO categories (title, slug) VALUES ('Tech', 'tech')").run();
        db.prepare("INSERT INTO categories (title, slug) VALUES ('Life', 'life')").run();

        const categories = await categoryService.listCategories();
        expect(categories).toHaveLength(2);
        expect(categories[0].title).toBe('Life'); // Ordered by title
        expect(categories[1].title).toBe('Tech');
    });

    it('should get category by id', async () => {
        const info = db.prepare("INSERT INTO categories (title, slug) VALUES ('Tech', 'tech')").run();
        const id = info.lastInsertRowid;

        const category = await categoryService.getCategory(id);
        expect(category.title).toBe('Tech');
    });
});
