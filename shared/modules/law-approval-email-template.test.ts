import * as template from './law-approval-email-template.ts';

describe('law approval email template', () => {
  const law = { id: 42, title: 'Murphy & Sons', text: 'Toast <always> lands "butter" side down.', name: 'Ann' };

  it('has a plain subject', () => {
    expect(template.createLawApprovalEmailSubject()).toBe('Your Murphy\'s Law is now published');
  });

  it('builds law URLs, tolerating trailing slashes and odd ids', () => {
    expect(template.getLawUrl(42)).toBe('https://murphys-laws.com/law/42');
    expect(template.getLawUrl('4 2', 'https://example.com//')).toBe('https://example.com/law/4%202');
  });

  it('writes a text thank-you with the law and its link', () => {
    const text = template.createLawApprovalEmailText(law);
    expect(text).toContain('Hi Ann,');
    expect(text).toContain('Murphy & Sons\nToast <always> lands "butter" side down.');
    expect(text).toContain('https://murphys-laws.com/law/42');
  });

  it('omits the title line when there is none and greets anonymous or unnamed submitters neutrally', () => {
    const text = template.createLawApprovalEmailText({ id: 1, text: 'Plain law text here', name: 'Anonymous' });
    expect(text).toContain('Hi there,');
    expect(text).not.toContain('null');
    expect(template.createLawApprovalEmailText({ id: 1, text: 'x', name: '  ' })).toContain('Hi there,');
    expect(template.createLawApprovalEmailText({ id: 1, text: 'x' })).toContain('Hi there,');
  });

  it('escapes every user supplied value in the HTML version', () => {
    const html = template.createLawApprovalEmailHtml({ ...law, name: '<img src=x onerror=1>' });
    expect(html).toContain('Hi &lt;img src=x onerror=1&gt;,');
    expect(html).toContain('<strong>Murphy &amp; Sons</strong>');
    expect(html).toContain('Toast &lt;always&gt; lands &quot;butter&quot; side down.');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://murphys-laws.com/law/42"');
  });

  it('omits the HTML title block when there is no title and escapes apostrophes', () => {
    const html = template.createLawApprovalEmailHtml({ id: 7, title: null, text: "It's here", name: null });
    expect(html).not.toContain('<strong>');
    expect(html).toContain('It&#39;s here');
    expect(html).toContain('Hi there,');
  });

  it('explains why the email was sent, in both versions, with the escaped law number', () => {
    const note = 'You received this because this email address was given when submitting law #42 to Murphy\'s Laws.';
    expect(template.createLawApprovalEmailText(law)).toContain(note);
    expect(template.createLawApprovalEmailHtml(law)).toContain(note);
    expect(template.createLawApprovalEmailHtml({ ...law, id: '<b>' })).toContain('law #&lt;b&gt; ');
  });

  it('uses a custom site URL', () => {
    expect(template.createLawApprovalEmailHtml(law, 'https://staging.example.com')).toContain('https://staging.example.com/law/42');
  });
});
