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
    expect(logic.errorMessage(429)).toContain('Too many');
    expect(logic.errorMessage(400, 'Invalid status')).toBe('Invalid status');
    expect(logic.errorMessage(500)).toBe('Request failed (500).');
  });
});
