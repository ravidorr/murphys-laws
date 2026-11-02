import * as template from './daily-law-email-template.ts';

describe('daily law email template', () => {
  const law = { id: 42, title: 'Murphy & Sons', text: 'Toast <always> lands butter side down.' };
  const unsubscribe = 'https://example.com/subscription/unsubscribe?token=abc&x=1';

  it('writes the confirmation in text and escaped HTML', () => {
    expect(template.createSubscriptionConfirmationSubject()).toContain('Confirm');
    expect(template.createSubscriptionConfirmationText('https://example.com/c?token=a&b=1')).toContain('https://example.com/c?token=a&b=1');
    const html = template.createSubscriptionConfirmationHtml('https://example.com/c?token=a&b=1');
    expect(html).toContain('href="https://example.com/c?token=a&amp;b=1"');
  });

  it('uses the law title in the subject, with a plain fallback', () => {
    expect(template.createDailyLawSubject(law)).toBe('Law of the Day: Murphy & Sons');
    expect(template.createDailyLawSubject({ id: 1, text: 'x' })).toBe('Murphy\'s Law of the Day');
    expect(template.createDailyLawSubject({ id: 1, title: '  ', text: 'x' })).toBe('Murphy\'s Law of the Day');
  });

  it('writes the daily text with the law link and unsubscribe link', () => {
    const text = template.createDailyLawText(law, 'https://example.com/', unsubscribe);
    expect(text).toContain('Murphy & Sons\nToast <always> lands butter side down.');
    expect(text).toContain('https://example.com/law/42');
    expect(text).toContain(`Unsubscribe: ${unsubscribe}`);
  });

  it('escapes every value in the daily HTML and omits an absent title', () => {
    const html = template.createDailyLawHtml(law, 'https://example.com', unsubscribe);
    expect(html).toContain('<h2>Murphy &amp; Sons</h2>');
    expect(html).toContain('Toast &lt;always&gt; lands butter side down.');
    expect(html).toContain('href="https://example.com/law/42"');
    expect(html).toContain('token=abc&amp;x=1');
    const untitled = template.createDailyLawHtml({ id: '7 1', text: 'Plain' }, 'https://example.com', unsubscribe);
    expect(untitled).not.toContain('<h2>');
    expect(untitled).toContain('/law/7%201');
    expect(template.createDailyLawText({ id: 1, text: 'Plain' }, 'https://example.com', unsubscribe)).not.toContain('null');
  });
});
