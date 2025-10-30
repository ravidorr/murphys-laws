import * as sodsEmailTemplate from '@modules/sods-email-template.js';

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('Sod\'s email template helpers', () => {
  const local = createLocalThis();

  it('creates a subject with the probability', () => {
    const self = local();
    const subject = sodsEmailTemplate.createSodsEmailSubject('42.00%', 'Alice');
    self.subject = subject;
    expect(self.subject).toBe("Alice shared a Sod's Law calculation with you (P=42.00%)");
  });

  it('builds the plain text email content', () => {
    const self = local();
    const text = sodsEmailTemplate.createSodsEmailText({
      taskDescription: 'Ship release',
      senderName: 'Bob',
      senderEmail: 'bob@example.com',
      recipientName: 'Alice',
      urgency: 8,
      complexity: 6,
      importance: 9,
      skill: 5,
      frequency: 2,
      probability: '73.21%',
      interpretation: 'Brace for impact.'
    });

    self.text = text;

    expect(self.text).toContain('Hi Alice');
    expect(self.text).toContain('Bob (bob@example.com) has shared with you a calculation for this task: "Ship release"');
    expect(self.text).toContain('- Skill (1-9): 5');
    expect(self.text).toContain('Probability (P): 73.21%');
    expect(self.text).toContain('Brace for impact.');
  });

  it('escapes HTML entities in the HTML email', () => {
    const self = local();
    const html = sodsEmailTemplate.createSodsEmailHtml({
      taskDescription: '<deploy> & "test"',
      senderName: 'Bob',
      senderEmail: 'bob@example.com',
      recipientName: 'Alice',
      urgency: '<1>',
      complexity: '&2&',
      importance: '"3"',
      skill: "'4'",
      frequency: '<5>',
      probability: '50% & rising',
      interpretation: 'Close <call> & stay "calm"'
    });

    self.html = html;

    expect(self.html).toContain('&lt;deploy&gt; &amp; &quot;test&quot;');
    expect(self.html).toContain('&lt;1&gt;');
    expect(self.html).toContain('&amp;2&amp;');
    expect(self.html).toContain('&quot;3&quot;');
    expect(self.html).toContain('&#39;4&#39;');
    expect(self.html).toContain('&lt;5&gt;');
    expect(self.html).toContain('50% &amp; rising');
    expect(self.html).toContain('Close &lt;call&gt; &amp; stay &quot;calm&quot;');
  });

  it('strips the outer shell when building preview HTML', () => {
    const self = local();
    const preview = sodsEmailTemplate.createSodsEmailPreviewHtml({
      taskDescription: 'Preview task',
      senderName: 'Bob',
      senderEmail: 'bob@example.com',
      recipientName: 'Alice',
      urgency: 5,
      complexity: 4,
      importance: 7,
      skill: 6,
      frequency: 3,
      probability: '25%',
      interpretation: 'Looks manageable.'
    });

    self.preview = preview;

    expect(self.preview).not.toMatch(/<!DOCTYPE html>/i);
    expect(self.preview).not.toMatch(/<html>/i);
    expect(self.preview).toContain('Preview task');
    expect(self.preview.trim().startsWith('<table')).toBe(true);
  });

  it('returns the full HTML when the body wrapper is missing', () => {
    const self = local();
    const preview = sodsEmailTemplate.createSodsEmailPreviewHtml({
      taskDescription: 'Fallback task',
      senderName: 'Bob',
      senderEmail: 'bob@example.com',
      recipientName: 'Alice',
      urgency: 3,
      complexity: 3,
      importance: 3,
      skill: 3,
      frequency: 3,
      probability: '10%',
      interpretation: 'Fallback interpretation.'
    }, {
      renderHtml: () => '<div>No wrapper</div>'
    });

    self.preview = preview;

    expect(self.preview).toBe('<div>No wrapper</div>');
  });

  it('treats nullish values as empty strings when escaping', () => {
    const self = local();
    const html = sodsEmailTemplate.createSodsEmailHtml({
      taskDescription: null,
      senderName: undefined,
      senderEmail: null,
      recipientName: undefined,
      urgency: undefined,
      complexity: null,
      importance: undefined,
      skill: null,
      frequency: undefined,
      probability: null,
      interpretation: undefined
    });

    self.html = html;

    expect(self.html).not.toContain('null');
    expect(self.html).not.toContain('undefined');
  });
});
