import { describe, it, expect } from 'vitest';
import * as logic from '../src/admin-ui/admin-logic.js';

const law = { id: 1, status: 'in_review', title: 'T', text: 'Original law text', admin_notes: null };

describe('admin-logic', () => {
  it('builds list URLs', () => {
    expect(logic.buildListUrl({ status: 'in_review', q: '', offset: 0 })).toBe('/api/v1/admin/laws?status=in_review&limit=25&offset=0');
    expect(logic.buildListUrl({ status: 'all', q: 'a b', offset: 25 })).toContain('q=a+b');
  });

  it('sends only changed fields', () => {
    expect(logic.buildUpdateBody(law, { status: 'in_review', title: 'T', text: 'Original law text', notes: '' })).toEqual({});
    expect(logic.buildUpdateBody(law, { status: 'published', title: ' ', text: ' New text of law ', notes: ' n ' })).toEqual({
      status: 'published',
      title: null,
      text: 'New text of law',
      admin_notes: 'n',
    });
    expect(logic.buildUpdateBody({ ...law, title: null }, { title: '' })).toEqual({});
  });

  it('labels pages', () => {
    expect(logic.pageLabel(0, 0, 0)).toBe('No laws');
    expect(logic.pageLabel(60, 25, 25)).toBe('26-50 of 60');
  });

  it('formats dates and submitters', () => {
    expect(logic.formatDate('2026-03-04T10:00:00.000Z')).toBe('2026-03-04');
    expect(logic.formatDate('nope')).toBe('');
    expect(logic.describeSubmitter([])).toBe('Anonymous');
    expect(logic.describeSubmitter([{ name: null, contact_type: 'text' }])).toBe('Anonymous');
    expect(logic.describeSubmitter([{ name: 'Ann', contact_type: 'email', contact_value: 'a@b.c' }])).toBe('Ann <a@b.c>');
    expect(logic.describeSubmitter([{ name: 'Ann', contact_type: 'email', contact_value: null }])).toBe('Ann');
  });

  it('maps error statuses to messages', () => {
    expect(logic.errorMessage(401)).toContain('Token rejected');
    expect(logic.errorMessage(404)).toContain('not enabled');
    expect(logic.errorMessage(404, 'Not Found')).toContain('not enabled');
    expect(logic.errorMessage(404, 'Law not found')).toBe('Law not found');
    expect(logic.errorMessage(429)).toContain('Too many');
    expect(logic.errorMessage(400, 'Invalid status')).toBe('Invalid status');
    expect(logic.errorMessage(500)).toBe('Request failed (500).');
  });

  it('adjusts counts and totals after a status change', () => {
    const base = { counts: { in_review: 3, published: 5, rejected: 1 }, total: 3, filter: 'in_review' };
    expect(logic.applyStatusChange(base, 'in_review', 'published')).toEqual({
      counts: { in_review: 2, published: 6, rejected: 1 },
      total: 2,
      removed: true,
    });
    expect(logic.applyStatusChange({ ...base, filter: 'all', total: 9 }, 'in_review', 'rejected')).toEqual({
      counts: { in_review: 2, published: 5, rejected: 2 },
      total: 9,
      removed: false,
    });
    expect(logic.applyStatusChange(base, 'in_review', 'in_review')).toEqual({ counts: base.counts, total: 3, removed: false });
    expect(logic.applyStatusChange({ counts: {}, total: 0, filter: 'published' }, 'in_review', 'published')).toEqual({
      counts: { in_review: 0, published: 1 },
      total: 0,
      removed: false,
    });
  });
});
