import * as lawSubmissionTemplate from '../../shared/modules/law-submission-email-template.js';

describe('Law submission email template', () => {
  describe('createLawSubmissionEmailSubject', () => {
    it('creates subject with law ID', () => {
      const subject = lawSubmissionTemplate.createLawSubmissionEmailSubject(123);
      expect(subject).toBe("New Murphy's Law Submitted! (ID: 123)");
    });

    it('escapes HTML in law ID', () => {
      const subject = lawSubmissionTemplate.createLawSubmissionEmailSubject('<script>alert("xss")</script>');
      expect(subject).toContain('&lt;script&gt;');
      expect(subject).not.toContain('<script>');
    });

    it('handles string law IDs', () => {
      const subject = lawSubmissionTemplate.createLawSubmissionEmailSubject('LAW-456');
      expect(subject).toContain('LAW-456');
    });
  });

  describe('createLawSubmissionEmailText', () => {
    it('creates plain text email with all fields', () => {
      const lawData = {
        id: 123,
        title: 'Murphy\'s First Law',
        text: 'Anything that can go wrong will go wrong.',
        author: 'Edward Murphy',
        email: 'murphy@example.com'
      };

      const text = lawSubmissionTemplate.createLawSubmissionEmailText(lawData);

      expect(text).toContain('Law ID: 123');
      expect(text).toContain('Title: Murphy\'s First Law');
      expect(text).toContain('Text: Anything that can go wrong will go wrong.');
      expect(text).toContain('Author: Edward Murphy');
      expect(text).toContain('Email: murphy@example.com');
      expect(text).toContain('http://murphys-laws.com/admin');
    });

    it('handles missing optional fields', () => {
      const lawData = {
        id: 456,
        text: 'The law text only.'
      };

      const text = lawSubmissionTemplate.createLawSubmissionEmailText(lawData);

      expect(text).toContain('Law ID: 456');
      expect(text).toContain('Title: (no title)');
      expect(text).toContain('Text: The law text only.');
      expect(text).toContain('Author: Anonymous');
      expect(text).toContain('Email: Not provided');
    });

    it('accepts custom review URL', () => {
      const lawData = {
        id: 789,
        text: 'Test law'
      };

      const text = lawSubmissionTemplate.createLawSubmissionEmailText(
        lawData,
        'https://custom-domain.com/review'
      );

      expect(text).toContain('https://custom-domain.com/review');
      expect(text).not.toContain('murphys-laws.com');
    });

    it('does not escape content in plain text', () => {
      const lawData = {
        id: 999,
        title: 'Law with <special> & "chars"',
        text: 'Text with <html> tags',
        author: 'Author & Co',
        email: 'test@example.com'
      };

      const text = lawSubmissionTemplate.createLawSubmissionEmailText(lawData);

      // Plain text should not be escaped
      expect(text).toContain('Law with <special> & "chars"');
      expect(text).toContain('Text with <html> tags');
      expect(text).toContain('Author & Co');
    });
  });

  describe('createLawSubmissionEmailHtml', () => {
    it('creates HTML email with all fields', () => {
      const lawData = {
        id: 123,
        title: 'Murphy\'s First Law',
        text: 'Anything that can go wrong will go wrong.',
        author: 'Edward Murphy',
        email: 'murphy@example.com'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('<h2>New Murphy\'s Law Submitted!</h2>');
      expect(html).toContain('Law ID:</td><td style="padding: 8px;">123');
      expect(html).toContain('Title:</td><td style="padding: 8px;">Murphy&#39;s First Law');
      expect(html).toContain('Text:</td><td style="padding: 8px;">Anything that can go wrong will go wrong.');
      expect(html).toContain('Author:</td><td style="padding: 8px;">Edward Murphy');
      expect(html).toContain('Email:</td><td style="padding: 8px;">murphy@example.com');
      expect(html).toContain('<a href="http://murphys-laws.com/admin">Review submissions</a>');
    });

    it('handles missing optional fields with defaults', () => {
      const lawData = {
        id: 456,
        text: 'The law text only.'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('Law ID:</td><td style="padding: 8px;">456');
      expect(html).toContain('<em>(no title)</em>');
      expect(html).toContain('Text:</td><td style="padding: 8px;">The law text only.');
      expect(html).toContain('Author:</td><td style="padding: 8px;">Anonymous');
      expect(html).toContain('Email:</td><td style="padding: 8px;">Not provided');
    });

    it('escapes HTML to prevent XSS attacks', () => {
      const lawData = {
        id: '<script>alert("xss")</script>',
        title: '<img src=x onerror=alert(1)>',
        text: '<script>document.cookie</script>',
        author: '<iframe src="evil.com">',
        email: 'test@example.com"><script>alert("xss")</script>'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      // Verify all HTML is escaped
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;script&gt;document.cookie&lt;/script&gt;');
      expect(html).toContain('&lt;iframe src=&quot;evil.com&quot;&gt;');
      expect(html).toContain('test@example.com&quot;&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

      // Verify no unescaped HTML tags from user input
      expect(html).not.toMatch(/<script>alert/);
      expect(html).not.toMatch(/<iframe/);
      expect(html).not.toMatch(/<img.*onerror/);
    });

    it('escapes special HTML characters', () => {
      const lawData = {
        id: 789,
        title: 'Law with & < > " \' characters',
        text: 'Text with all special chars: & < > " \'',
        author: 'Author & Partners',
        email: 'test@example.com'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('Law with &amp; &lt; &gt; &quot; &#39; characters');
      expect(html).toContain('Text with all special chars: &amp; &lt; &gt; &quot; &#39;');
      expect(html).toContain('Author &amp; Partners');
    });

    it('accepts custom review URL', () => {
      const lawData = {
        id: 999,
        text: 'Test law'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(
        lawData,
        'https://custom-domain.com/review'
      );

      expect(html).toContain('href="https://custom-domain.com/review"');
      expect(html).not.toContain('murphys-laws.com');
    });

    it('escapes special characters in custom review URL', () => {
      const lawData = {
        id: 111,
        text: 'Test law'
      };

      const urlWithSpecialChars = 'http://example.com/review?param=<test>&value="quoted"';
      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData, urlWithSpecialChars);

      expect(html).toContain('href="http://example.com/review?param=&lt;test&gt;&amp;value=&quot;quoted&quot;"');
      expect(html).not.toContain('href="http://example.com/review?param=<test>');
    });

    it('accepts review URL without validation (application-controlled)', () => {
      // Note: The review URL is typically application-controlled, not user input.
      // For user-provided URLs in href attributes, additional protocol validation
      // (blocking javascript:, data:, vbscript:) would be needed beyond HTML escaping.
      const lawData = {
        id: 222,
        text: 'Test law'
      };

      const url = 'https://production.murphys-laws.com/admin';
      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData, url);

      expect(html).toContain(`href="${url}"`);
    });

    it('preserves table structure in HTML', () => {
      const lawData = {
        id: 222,
        text: 'Test law'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('<table style="border-collapse: collapse; margin: 20px 0;">');
      expect(html).toContain('<tr><td style="padding: 8px; font-weight: bold;">');
      expect(html).toMatch(/<\/table>/);
    });

    it('includes npm run review instruction', () => {
      const lawData = {
        id: 333,
        text: 'Test law'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('npm run review');
      expect(html).toContain('<code>npm run review</code>');
    });
  });

  describe('Edge cases', () => {
    it('handles null and undefined values gracefully', () => {
      const lawData = {
        id: 444,
        title: null,
        text: 'Test law',
        author: undefined,
        email: null
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).not.toContain('null');
      expect(html).not.toContain('undefined');
      expect(html).toContain('<em>(no title)</em>');
      expect(html).toContain('Anonymous');
      expect(html).toContain('Not provided');
    });

    it('handles empty strings', () => {
      const lawData = {
        id: 555,
        title: '',
        text: 'Test law',
        author: '',
        email: ''
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('<em>(no title)</em>');
      expect(html).toContain('Anonymous');
      expect(html).toContain('Not provided');
    });

    it('handles very long text content', () => {
      const longText = 'A'.repeat(2000);
      const lawData = {
        id: 666,
        text: longText
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('A'.repeat(2000));
      expect(html.length).toBeGreaterThan(2000);
    });

    it('handles unicode and emoji characters', () => {
      const lawData = {
        id: 777,
        title: 'Murphy\'s Law 😀',
        text: 'Текст на русском 中文',
        author: 'Müller',
        email: 'test@example.com'
      };

      const html = lawSubmissionTemplate.createLawSubmissionEmailHtml(lawData);

      expect(html).toContain('Murphy&#39;s Law 😀');
      expect(html).toContain('Текст на русском 中文');
      expect(html).toContain('Müller');
    });
  });
});
