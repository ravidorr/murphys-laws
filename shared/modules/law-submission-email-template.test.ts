import * as template from './law-submission-email-template.ts';

describe('law submission email template', () => {
  const law = { id: 7, title: 'Start-Stop', text: 'A red light turns green right after you stop.', author: 'Ann', email: 'ann@example.com' };

  it('builds a subject with the escaped law id', () => {
    expect(template.createLawSubmissionEmailSubject(7)).toBe("New Murphy's Law Submitted! (ID: 7)");
    expect(template.createLawSubmissionEmailSubject('<b>')).toBe("New Murphy's Law Submitted! (ID: &lt;b&gt;)");
  });

  it('writes the law, author and email, with placeholders for what was left out', () => {
    const text = template.createLawSubmissionEmailText({ id: 7, text: 'A law long enough to count.' });
    expect(text).toContain('Title: (no title)');
    expect(text).toContain('Author: Anonymous');
    expect(text).toContain('Email: Not provided');
    expect(text).not.toContain('Corollary');
    const html = template.createLawSubmissionEmailHtml({ id: 7, text: 'A law long enough to count.' });
    expect(html).toContain('<em>(no title)</em>');
    expect(html).toContain('Anonymous');
    expect(html).not.toContain('Corollary');
  });

  it('lists the submitted corollaries in order in the text version, with their names when they have one', () => {
    const text = template.createLawSubmissionEmailText({
      ...law,
      corollaries: [{ title: 'The Ignition Corollary', text: 'The engine restarts slowly.' }, { title: null, text: 'The green lasts a moment.' }],
    });
    expect(text).toContain('Text: A red light turns green right after you stop.\nCorollary 1: The Ignition Corollary - The engine restarts slowly.\nCorollary 2: The green lasts a moment.\nAuthor: Ann');
  });

  it('lists the corollaries as table rows in the HTML version and escapes them', () => {
    const html = template.createLawSubmissionEmailHtml({
      ...law,
      corollaries: [{ title: '<i>Name</i>', text: 'Fish & <chips>' }, { text: 'Second one here' }],
    });
    expect(html).toContain('<th scope="row">Corollary 1:</th><td><strong>&lt;i&gt;Name&lt;/i&gt;</strong><br>Fish &amp; &lt;chips&gt;</td>');
    expect(html).toContain('<th scope="row">Corollary 2:</th><td>Second one here</td>');
    expect(html).not.toContain('<chips>');
  });

  it('escapes the law fields too', () => {
    const html = template.createLawSubmissionEmailHtml({ ...law, title: '<x>', author: '<y>', email: '<z>' }, 'http://a/"b');
    expect(html).toContain('&lt;x&gt;');
    expect(html).toContain('&lt;y&gt;');
    expect(html).toContain('&lt;z&gt;');
    expect(html).toContain('http://a/&quot;b');
  });
});
