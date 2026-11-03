import * as template from './daily-law-email-template.ts';

describe('daily law email template', () => {
  const law = { id: 42, title: 'Murphy & Sons', text: 'Toast <always> lands butter side down.' };
  const unsubscribe = 'https://example.com/subscription/unsubscribe?token=abc&x=1';

  it('writes the confirmation in text and escaped HTML', () => {
    expect(template.createSubscriptionConfirmationSubject()).toContain('Confirm');
    expect(template.createSubscriptionConfirmationText('https://example.com/c?token=a&b=1')).toContain('https://example.com/c?token=a&b=1');
    const html = template.createSubscriptionConfirmationHtml('https://example.com/c?token=a&b=1', 'https://example.com');
    expect(html).toContain('href="https://example.com/c?token=a&amp;b=1"');
    expect(html).toContain('Confirm and start the daily email');
    expect(html).toContain('If this wasn\'t you, ignore this message.');
  });

  it('uses the law title in the subject, with a plain fallback', () => {
    expect(template.createDailyLawSubject(law)).toBe('Law of the Day: Murphy & Sons');
    expect(template.createDailyLawSubject({ id: 1, text: 'x' })).toBe('Murphy\'s Law of the Day');
    expect(template.createDailyLawSubject({ id: 1, title: '  ', text: 'x' })).toBe('Murphy\'s Law of the Day');
  });

  it('writes the daily text with the law link and unsubscribe link', () => {
    const text = template.createDailyLawText(law, 'https://example.com/', unsubscribe);
    expect(text).toContain('Murphy & Sons\nToast <always> lands butter side down.');
    expect(text).toContain('Read, vote and share: https://example.com/law/42');
    expect(text).toContain('https://example.com/law/42');
    expect(text).toContain(`Unsubscribe: ${unsubscribe}`);
  });

  it('escapes every value in the daily HTML and omits an absent title', () => {
    const html = template.createDailyLawHtml(law, 'https://example.com', unsubscribe);
    expect(html).toContain('>Murphy &amp; Sons</h1>');
    expect(html).toContain('Toast &lt;always&gt; lands butter side down.');
    expect(html).toContain('href="https://example.com/law/42"');
    expect(html).toContain('token=abc&amp;x=1');
    const untitled = template.createDailyLawHtml({ id: '7 1', text: 'Plain' }, 'https://example.com', unsubscribe);
    expect(untitled).not.toContain('<h1');
    expect(untitled).toContain('/law/7%201');
    expect(template.createDailyLawText({ id: 1, text: 'Plain' }, 'https://example.com', unsubscribe)).not.toContain('null');
  });

  it('shows the law as the focus, with a button and a visible unsubscribe link', () => {
    const html = template.createDailyLawHtml(law, 'https://example.com', unsubscribe);
    expect(html).toContain('font-size:26px');
    expect(html).toContain('>Read, vote and share</a>');
    expect(html).toContain('>Unsubscribe</a>');
    expect(html).toContain('>Murphy\'s Law of the Day</p>');
  });

  it('adds the category and attribution when the law has them, and ignores malformed values', () => {
    const rich = {
      ...law,
      category_name: 'Work & Office',
      category_slug: 'work office',
      attributions: [{ name: 'Edward A. Murphy Jr.' }, { name: ' ' }, null, { name: 'Edward A. Murphy Jr.' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
    };
    const html = template.createDailyLawHtml(rich, 'https://example.com/', unsubscribe);
    expect(html).toContain('Attributed to Edward A. Murphy Jr., B, C');
    expect(html).not.toContain(', D');
    expect(html).toContain('href="https://example.com/category/work%20office"');
    expect(html).toContain('>Work &amp; Office</a>');
    const text = template.createDailyLawText(rich, 'https://example.com', unsubscribe);
    expect(text).toContain('Attributed to: Edward A. Murphy Jr., B, C');
    expect(text).toContain('Category: Work & Office');

    const noSlug = template.createDailyLawHtml({ ...law, category_name: 'Misc', category_slug: 7 }, 'https://example.com', unsubscribe);
    expect(noSlug).toContain('Category: Misc');
    expect(noSlug).not.toContain('/category/');

    const bad = template.createDailyLawHtml({ ...law, category_name: 5, attributions: 'x' }, 'https://example.com', unsubscribe);
    expect(bad).not.toContain('Category:');
    expect(bad).not.toContain('Attributed to');
  });

  it('shortens a long law for the inbox preview', () => {
    const long = 'word '.repeat(60);
    const html = template.createDailyLawHtml({ id: 1, text: long }, 'https://example.com', unsubscribe);
    expect(html).toMatch(/opacity:0;mso-hide:all;">word( word)+\u2026<\/div>/);
  });
});
