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
    const subject = sodsEmailTemplate.createSodsEmailSubject('42.00%');
    expect(subject).toBe("Your Sod's Law Calculation Result - 42.00%");
  });

  it('builds the plain text email content', () => {
    const text = sodsEmailTemplate.createSodsEmailText({
      taskDescription: 'Ship release',
      urgency: 8,
      complexity: 6,
      importance: 9,
      skill: 5,
      frequency: 2,
      probability: '73.21%',
      interpretation: 'Brace for impact.'
    });

    expect(text).toContain('Task Description: Ship release');
    expect(text).toContain('- Skill (S): 5');
    expect(text).toContain('Probability of things going wrong (P): 73.21%');
    expect(text).toContain('Interpretation: Brace for impact.');
  });

  it('escapes HTML entities in the HTML email', () => {
    const html = sodsEmailTemplate.createSodsEmailHtml({
      taskDescription: '<deploy> & "test"',
      urgency: '<1>',
      complexity: '&2&',
      importance: '"3"',
      skill: "'4'",
      frequency: '<5>',
      probability: '50% & rising',
      interpretation: 'Close <call> & stay "calm"'
    });

    expect(html).toContain('&lt;deploy&gt; &amp; &quot;test&quot;');
    expect(html).toContain('&lt;1&gt;');
    expect(html).toContain('&amp;2&amp;');
    expect(html).toContain('&quot;3&quot;');
    expect(html).toContain('&#39;4&#39;');
    expect(html).toContain('&lt;5&gt;');
    expect(html).toContain('50% &amp; rising');
    expect(html).toContain('Close &lt;call&gt; &amp; stay &quot;calm&quot;');
  });

  it('strips the outer shell when building preview HTML', () => {
    const preview = sodsEmailTemplate.createSodsEmailPreviewHtml({
      taskDescription: 'Preview task',
      urgency: 5,
      complexity: 4,
      importance: 7,
      skill: 6,
      frequency: 3,
      probability: '25%',
      interpretation: 'Looks manageable.'
    });

    expect(preview).not.toMatch(/<!DOCTYPE html>/i);
    expect(preview).not.toMatch(/<html>/i);
    expect(preview).toContain('Preview task');
    expect(preview.trim().startsWith('<table')).toBe(true);
  });

  it('returns the full HTML when the body wrapper is missing', () => {
    const preview = sodsEmailTemplate.createSodsEmailPreviewHtml({
      taskDescription: 'Fallback task',
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

    expect(preview).toBe('<div>No wrapper</div>');
  });

  it('treats nullish values as empty strings when escaping', () => {
    const html = sodsEmailTemplate.createSodsEmailHtml({
      taskDescription: null,
      urgency: undefined,
      complexity: null,
      importance: undefined,
      skill: null,
      frequency: undefined,
      probability: null,
      interpretation: undefined
    });

    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });
});
