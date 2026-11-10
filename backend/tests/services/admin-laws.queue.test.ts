import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { AdminLawService, type AdminLawStatus } from '../../src/services/admin-laws.service.ts';
import { COROLLARY_RELATION } from '../../src/services/law-relations.service.ts';
import { LawService } from '../../src/services/laws.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

type Db = InstanceType<typeof Database>;

const ONE = 'The engine restarts slowly when someone behind you is honking.';
const TWO = 'The green lasts just long enough for you to miss it.';
const THREE = 'The pedestrian crossing starts as soon as you look away.';

describe('AdminLawService review queue with submitted corollaries (real migrated schema)', () => {
  let db: Db;
  let admin: AdminLawService;
  let laws: LawService;

  const statusOf = (id: number) => (db.prepare('SELECT status FROM laws WHERE id = ?').get(id) as { status: string }).status;
  const updatedAt = (id: number) => (db.prepare('SELECT updated_at FROM laws WHERE id = ?').get(id) as { updated_at: string }).updated_at;
  const list = (status: AdminLawStatus | 'all', q = '', limit = 50, offset = 0) => admin.listLaws({ status, q, limit, offset });
  const ids = (status: AdminLawStatus | 'all', q = '') => list(status, q).data.map((l) => l.id);
  const submit = (text: string, corollaries: { title: string | null; text: string }[], author = 'Ann') =>
    laws.submitLaw({ title: null, text, author, email: null, categoryId: null, corollaries });
  const move = (id: number, status: AdminLawStatus) => {
    const result = admin.updateLaw(id, { status });
    if (result.outcome !== 'updated') throw new Error(`update of ${id} gave ${result.outcome}`);
    return result;
  };

  beforeEach(() => {
    db = createMigratedDb();
    // Start from a clean queue: the migrated database carries the imported archive.
    db.exec('DELETE FROM law_relations');
    db.exec("UPDATE laws SET status = 'published'");
    admin = new AdminLawService(db);
    laws = new LawService(db);
  });

  describe('top-level list', () => {
    it('shows a submission as one card with its corollaries attached in order, and none as cards of their own', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: 'Ignition', text: ONE }, { title: null, text: TWO }]);
      const lone = await submit('Toast always lands on the buttered side down.', []);

      const { data, total } = list('in_review');
      expect(total).toBe(2);
      expect(data.map((l) => l.id)).toEqual([lone.id, a.id]);
      const card = data.find((l) => l.id === a.id)!;
      expect(card.children).toEqual([
        { id: a.corollaries[0].id, title: 'Ignition', text: ONE, status: 'in_review', updated_at: expect.any(String) },
        { id: a.corollaries[1].id, title: null, text: TWO, status: 'in_review', updated_at: expect.any(String) },
      ]);
      expect(data.find((l) => l.id === lone.id)).not.toHaveProperty('children');
    });

    it('attaches children of every status, so a rejected corollary stays visible on its card', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      move(a.corollaries[0].id, 'rejected');

      const card = list('in_review').data[0];
      expect(card.children?.map((c) => [c.id, c.status])).toEqual([[a.corollaries[0].id, 'rejected'], [a.corollaries[1].id, 'in_review']]);
    });

    it('applies the same rule in the all and published views, but not to a corollary whose law is not in the set', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      const child = a.corollaries[0].id;
      const every = (status: AdminLawStatus | 'all') => list(status, '', 500).data.map((l) => l.id);
      expect(every('all')).toContain(a.id);
      expect(every('all')).not.toContain(child);

      move(a.id, 'published');
      expect(every('published')).toContain(a.id);
      expect(every('published')).not.toContain(child);
      expect(list('published', '', 500).data.find((l) => l.id === a.id)?.children?.map((c) => c.id)).toEqual([child]);

      // Reject the corollary alone: its law is not rejected, so the rejected view shows it on its own.
      move(child, 'rejected');
      expect(every('rejected')).toEqual([child]);
      expect(every('published')).toContain(a.id);
    });

    it('lists an in-review corollary whose law is not in review as its own card (nothing to nest it under)', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(a.id);

      expect(ids('in_review')).toEqual([a.corollaries[0].id]);
      expect(list('in_review').counts.in_review).toBe(1);
    });

    it('pages by submissions: limit and offset count cards, never children', async () => {
      const first = await submit('First law about doors that never close properly.', [{ title: null, text: ONE }, { title: null, text: TWO }, { title: null, text: THREE }]);
      const second = await submit('Second law about umbrellas that always flip over.', [{ title: null, text: 'Corollary of the second law, long enough.' }]);
      db.prepare("UPDATE laws SET created_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(first.id);
      db.prepare("UPDATE laws SET created_at = '2030-01-02T00:00:00.000Z' WHERE id = ?").run(second.id);

      const page1 = list('in_review', '', 1, 0);
      const page2 = list('in_review', '', 1, 1);
      expect(page1.total).toBe(2);
      expect(page1.data.map((l) => l.id)).toEqual([second.id]);
      expect(page2.data.map((l) => l.id)).toEqual([first.id]);
      expect(page2.data[0].children).toHaveLength(3);
    });
  });

  describe('counts', () => {
    it('counts In review as submissions and the badge equals the list total', async () => {
      await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      await submit('Toast always lands on the buttered side down.', []);
      await submit('Umbrellas flip over the moment the wind picks up.', [{ title: null, text: THREE }]);

      const view = list('in_review');
      expect(db.prepare("SELECT COUNT(*) AS n FROM laws WHERE status = 'in_review'").get()).toEqual({ n: 6 });
      expect(view.counts.in_review).toBe(3);
      expect(view.total).toBe(view.counts.in_review);
    });

    it('keeps Published and Rejected counting rows', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      const publishedBefore = list('published').counts.published;
      move(a.id, 'published');
      expect(list('published').counts.published).toBe(publishedBefore + 3);
      // Decision D2: Published and Rejected badges count rows, while the list nests corollaries under their law, so the badge
      // is meant to differ from the list total.
      expect(list('published', '', 500).data.filter((l) => l.id === a.id)).toHaveLength(1);

      move(a.corollaries[0].id, 'rejected');
      expect(list('rejected').counts.rejected).toBe(1);
    });
  });

  describe('search', () => {
    it("returns the law's card when a corollary matches, and not the corollary", async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: 'Zebrafish enter the crossing with the light.' }]);
      await submit('Toast always lands on the buttered side down.', []);

      const found = list('in_review', 'zebrafish');
      expect(found.total).toBe(1);
      expect(found.data.map((l) => l.id)).toEqual([a.id]);
      expect(found.data[0].children).toHaveLength(1);
    });

    it('returns a law once, however many of its corollaries match', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [
        { title: null, text: 'Zebrafish enter the crossing with the light.' },
        { title: null, text: 'More zebrafish follow the first one across.' },
      ]);
      const found = list('in_review', 'zebrafish');
      expect(found.total).toBe(1);
      expect(found.data.map((l) => l.id)).toEqual([a.id]);
    });

    it('finds the law from a corollary in the all and published views too, and leaves the corollary out', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: 'Zebrafish enter the crossing with the light.' }]);
      const child = a.corollaries[0].id;
      expect(ids('all', 'zebrafish')).toEqual([a.id]);
      move(a.id, 'published');
      expect(ids('published', 'zebrafish')).toEqual([a.id]);
      expect(ids('all', 'zebrafish')).not.toContain(child);
    });

    it('pages a search by submissions and attaches children only to the laws on the page', async () => {
      const first = await submit('First zebrafish law about doors that never close.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      const second = await submit('Second law about umbrellas that always flip over.', [{ title: null, text: 'A zebrafish corollary of the second law.' }]);
      db.prepare("UPDATE laws SET created_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(first.id);
      db.prepare("UPDATE laws SET created_at = '2030-01-02T00:00:00.000Z' WHERE id = ?").run(second.id);

      const page1 = list('in_review', 'zebrafish', 1, 0);
      const page2 = list('in_review', 'zebrafish', 1, 1);
      expect(page1.total).toBe(2);
      expect(page1.data.map((l) => [l.id, l.children?.length])).toEqual([[second.id, 1]]);
      expect(page2.data.map((l) => [l.id, l.children?.length])).toEqual([[first.id, 2]]);
    });

    it("matches a corollary's title and treats LIKE wildcards literally", async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: '100% Corollary', text: ONE }]);
      expect(ids('in_review', '100%')).toEqual([a.id]);
      expect(ids('in_review', '1_0')).toEqual([]);
    });

    it("still finds the law by its own text and finds a child's own card when its law is not in the set", async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: 'Zebrafish enter the crossing with the light.' }]);
      expect(ids('in_review', 'red light')).toEqual([a.id]);

      db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(a.id);
      expect(ids('in_review', 'zebrafish')).toEqual([a.corollaries[0].id]);
    });
  });

  describe('status cascade for submitted corollaries (matrix of the plan, section 2.2)', () => {
    it('approving the submission publishes the in-review corollaries and leaves rejected ones rejected', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      move(a.corollaries[0].id, 'rejected');

      const result = move(a.id, 'published');
      expect(result.cascaded).toBe(1);
      expect(statusOf(a.id)).toBe('published');
      expect(statusOf(a.corollaries[0].id)).toBe('rejected');
      expect(statusOf(a.corollaries[1].id)).toBe('published');
    });

    it('rejecting the submission rejects its in-review corollaries', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);

      const result = move(a.id, 'rejected');
      expect(result.cascaded).toBe(2);
      expect([a.id, ...a.corollaries.map((c) => c.id)].map(statusOf)).toEqual(['rejected', 'rejected', 'rejected']);
    });

    it('rejecting one corollary leaves the law and its siblings alone', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);

      const result = move(a.corollaries[0].id, 'rejected');
      expect(result.cascaded).toBe(0);
      expect(result.isCorollary).toBe(true);
      expect([a.id, ...a.corollaries.map((c) => c.id)].map(statusOf)).toEqual(['in_review', 'rejected', 'in_review']);
      expect(list('in_review').counts.in_review).toBe(1);
    });

    it('refuses to publish a corollary while its law is still in review, pointing at the law', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);

      expect(admin.updateLaw(a.corollaries[0].id, { status: 'published' })).toEqual({ outcome: 'parent_not_published', parentId: a.id });
      expect(statusOf(a.corollaries[0].id)).toBe('in_review');
    });

    it('moves a published law back to review together with its published corollaries (D1)', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      move(a.id, 'published');
      move(a.corollaries[1].id, 'rejected');

      const result = move(a.id, 'in_review');
      expect(result.cascaded).toBe(1);
      expect([a.id, ...a.corollaries.map((c) => c.id)].map(statusOf)).toEqual(['in_review', 'in_review', 'rejected']);
    });

    it('rejecting a published law rejects its published corollaries', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      move(a.id, 'published');

      move(a.id, 'rejected');
      expect(statusOf(a.corollaries[0].id)).toBe('rejected');
    });

    it('gives each moved corollary a new updated_at, so a page still showing it gets a conflict', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      db.prepare("UPDATE laws SET updated_at = '2030-01-01T00:00:00.000Z' WHERE id = ?").run(a.corollaries[0].id);

      move(a.id, 'published');
      expect(updatedAt(a.corollaries[0].id)).not.toBe('2030-01-01T00:00:00.000Z');
      expect(admin.updateLaw(a.corollaries[0].id, { text: 'Edited text that is long enough here.', expectedUpdatedAt: '2030-01-01T00:00:00.000Z' })).toEqual({ outcome: 'conflict' });
    });

    it('keeps corollaries rejected when their rejected law is approved or sent back to review', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      move(a.id, 'rejected');

      expect(move(a.id, 'published').cascaded).toBe(0);
      expect(a.corollaries.map((c) => statusOf(c.id))).toEqual(['rejected', 'rejected']);
      expect(admin.publishedCorollaries(a.id)).toEqual([]);

      expect(move(a.id, 'in_review').cascaded).toBe(0);
      expect(a.corollaries.map((c) => statusOf(c.id))).toEqual(['rejected', 'rejected']);
      expect(admin.listLaws({ status: 'in_review', q: '', limit: 50, offset: 0 }).counts.in_review).toBeGreaterThanOrEqual(1);
    });

    it('refuses to publish a rejected corollary under a law that is in review', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      move(a.corollaries[0].id, 'rejected');
      expect(admin.updateLaw(a.corollaries[0].id, { status: 'published' })).toEqual({ outcome: 'parent_not_published', parentId: a.id });
      expect(statusOf(a.corollaries[0].id)).toBe('rejected');
    });

    it('lets a corollary be edited in review without touching its law', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      const parentStamp = updatedAt(a.id);

      const edited = admin.updateLaw(a.corollaries[0].id, { title: 'Ignition', text: 'The engine restarts slowly behind a horn.', expectedUpdatedAt: updatedAt(a.corollaries[0].id) });
      expect(edited.outcome).toBe('updated');
      expect(updatedAt(a.id)).toBe(parentStamp);
      expect(db.prepare('SELECT 1 FROM law_relations WHERE from_law_id = ? AND relation_type = ?').get(a.corollaries[0].id, COROLLARY_RELATION)).toBeDefined();
    });
  });

  describe('card data after an update', () => {
    it('returns the children with the statuses the cascade gave them', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }, { title: null, text: TWO }]);
      move(a.corollaries[1].id, 'rejected');
      const result = move(a.id, 'published');
      expect(result.law.children?.map((c) => c.status)).toEqual(['published', 'rejected']);
    });

    it('returns the in-review law with its children so the card can refresh without a reload', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: null, text: ONE }]);
      const result = admin.updateLaw(a.id, { adminNotes: 'check later' });
      expect(result.outcome === 'updated' && result.law.children?.map((c) => c.id)).toEqual([a.corollaries[0].id]);
    });
  });

  describe('publishedCorollaries', () => {
    it('lists only the corollaries that went live with the law, in order', async () => {
      const a = await submit('A red light turns green right after you stop watching it.', [{ title: 'One', text: ONE }, { title: null, text: TWO }, { title: null, text: THREE }]);
      move(a.corollaries[1].id, 'rejected');
      move(a.id, 'published');

      expect(admin.publishedCorollaries(a.id)).toEqual([
        { id: a.corollaries[0].id, title: 'One', text: ONE },
        { id: a.corollaries[2].id, title: null, text: THREE },
      ]);
    });
  });
});
