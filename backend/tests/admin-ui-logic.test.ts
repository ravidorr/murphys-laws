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

  it('sends category_id only when a different single category is chosen', () => {
    const base = { status: 'published', title: 'T', text: 'Original law text', categories: [{ id: 3, name: 'C' }] };
    expect(logic.buildUpdateBody(base, { categoryId: 3 })).toEqual({});
    expect(logic.buildUpdateBody(base, { categoryId: 4 })).toEqual({ category_id: 4 });
    expect(logic.buildUpdateBody(base, {})).toEqual({});
    expect(logic.buildUpdateBody({ ...base, categories: [] }, { categoryId: 3 })).toEqual({ category_id: 3 });
    expect(logic.buildUpdateBody({ ...base, categories: undefined }, { categoryId: 3 })).toEqual({ category_id: 3 });
    expect(logic.buildUpdateBody({ ...base, categories: [{ id: 3, name: 'C' }, { id: 4, name: 'D' }] }, { categoryId: 3 })).toEqual({ category_id: 3 });
  });

  it('preselects only a single category', () => {
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [{ id: 3, name: 'C' }] })).toBe('3');
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [] })).toBe('');
    expect(logic.categorySelectValue({ status: 'published', text: 'x' })).toBe('');
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] })).toBe('');
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
    expect(logic.errorMessage(403)).toContain('refused');
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

  it('treats a deleted law (to = null) as leaving the view in every filter', () => {
    const base = { counts: { in_review: 3, published: 5, rejected: 1 }, total: 9 };
    expect(logic.applyStatusChange({ ...base, filter: 'in_review' }, 'in_review', null)).toEqual({
      counts: { in_review: 2, published: 5, rejected: 1 },
      total: 8,
      removed: true,
    });
    expect(logic.applyStatusChange({ ...base, filter: 'all' }, 'published', null)).toMatchObject({ total: 8, removed: true });
    expect(logic.applyStatusChange({ counts: { in_review: 0 }, total: 0, filter: 'all' }, 'in_review', null).counts.in_review).toBe(0);
  });

  it('validates server replies before they are rendered', () => {
    expect(logic.isListReply({ data: [], total: 0, counts: {} })).toBe(true);
    for (const bad of [null, {}, { data: {}, total: 0, counts: {} }, { data: [], total: 'x', counts: {} }, { data: [], total: 0 }, { data: [], total: 0, counts: 5 }]) {
      expect(logic.isListReply(bad)).toBe(false);
    }
    expect(logic.isLawReply({ data: { status: 'published' } })).toBe(true);
    for (const bad of [null, {}, { data: null }, { data: 5 }, { data: {} }, { data: { status: 3 } }]) {
      expect(logic.isLawReply(bad)).toBe(false);
    }
  });

  it('describes the thank-you email outcome for the admin', () => {
    expect(logic.describeThankYou(undefined)).toBe('');
    expect(logic.describeThankYou(null)).toBe('');
    expect(logic.describeThankYou({ status: 'queued' })).toBe(' Thank-you email is being sent (delivery is not confirmed).');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'no_email' })).toContain('left no email address');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'invalid_email' })).toContain('not valid');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'not_configured' })).toContain('not set up');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'already_sent' })).toContain('already sent');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'error' })).toContain('server logs');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'something-new' })).toBe(' No thank-you email was sent.');
  });
});
