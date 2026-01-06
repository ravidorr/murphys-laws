import { marked } from 'marked';

// Import markdown files from shared content
import aboutMd from '../../../shared/content/about.md?raw';
import originStoryMd from '../../../shared/content/origin-story.md?raw';
import privacyMd from '../../../shared/content/privacy.md?raw';
import termsMd from '../../../shared/content/terms.md?raw';
import contactMd from '../../../shared/content/contact.md?raw';
import metadata from '../../../shared/content/metadata.json';

// Configure marked for consistent rendering
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false
});

/**
 * Convert markdown content to HTML with proper styling
 * @param {string} markdownContent - Raw markdown content
 * @param {Object} options - Optional configuration
 * @param {string} options.lastUpdated - Last updated date to display
 * @returns {string} - Formatted HTML with card styling
 */
export function markdownToHtml(markdownContent, options = {}) {
  const html = marked.parse(markdownContent);

  // Wrap in card structure consistent with existing templates
  let output = '<article class="card content-card">\n  <div class="card-content">\n';

  // Add last updated date if provided
  if (options.lastUpdated) {
    // Insert before the first header
    const headerMatch = html.match(/<h1[^>]*>/);
    if (headerMatch) {
      const parts = html.split(headerMatch[0]);
      output += `    <header class="content-header">\n`;
      output += `      <p class="small">Last updated: ${options.lastUpdated}</p>\n`;
      output += `      ${headerMatch[0]}${parts[1]}`;
    } else {
      output += html;
    }
  } else {
    output += html;
  }

  output += '\n  </div>\n</article>';

  return output;
}

/**
 * Wrap the first word of a heading with accent-text span
 * @param {string} headingText - The text content of the heading
 * @returns {string} - HTML with first word wrapped in accent-text
 */
function wrapFirstWordWithAccent(headingText) {
  // If the heading contains nested HTML tags (like <code>, <em>, etc.),
  // return it unchanged to preserve the formatting
  if (/<[^>]+>/.test(headingText)) {
    return headingText;
  }

  const textOnly = headingText.trim();

  if (!textOnly) {
    return headingText;
  }

  // Find leading punctuation/entities, first word, and rest
  // Leading punctuation: quotes, brackets, HTML entities (like &quot;), etc.
  // First word: word characters, hyphens, and apostrophes
  // IMPORTANT: Check HTML entities BEFORE single non-word chars to match &quot; as one unit
  // Supports named entities (&quot;), decimal (&#34;), and hexadecimal (&#x22;) numeric entities
  const match = textOnly.match(/^((?:&[a-z]+;|&#x[\da-f]+;|&#\d+;|[^\w])*)?([\w'-]+)(.*)/i);

  if (match) {
    const leadingPunctuation = match[1] || '';
    const firstWord = match[2];
    const rest = match[3] || '';

    // If there's rest (after trimming for check), wrap first word and add rest with preserved spacing
    if (rest.trim() || leadingPunctuation) {
      return `${leadingPunctuation}<span class="accent-text">${firstWord}</span>${rest}`;
    } else {
      // Only one word, wrap it
      return `<span class="accent-text">${firstWord}</span>`;
    }
  }

  // Fallback: wrap entire text if no word match (e.g., only punctuation)
  return `<span class="accent-text">${textOnly}</span>`;
}

/**
 * Process markdown HTML to add styling classes
 * @param {string} html - HTML from markdown
 * @returns {string} - HTML with added classes
 */
function enhanceMarkdownHtml(html) {
  // Process h1 tags - wrap first word with accent-text
  html = html.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/g, (match, open, content, close) => {
    return `${open}${wrapFirstWordWithAccent(content)}${close}`;
  });

  // Process h3 tags first (before h2 processing) - wrap first word with accent-text
  html = html.replace(/(<h3[^>]*>)([\s\S]*?)(<\/h3>)/g, (match, open, content, close) => {
    return `${open}${wrapFirstWordWithAccent(content)}${close}`;
  });

  // Process h2 tags - wrap first word with accent-text and add section wrapper
  // We need to process from end to start to avoid index issues
  const h2Matches = [];
  let h2Regex = /(<h2[^>]*>)([\s\S]*?)(<\/h2>)/g;
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    h2Matches.push({
      index: match.index,
      fullMatch: match[0],
      open: match[1],
      content: match[2],
      close: match[3]
    });
  }

  // Replace h2 tags from end to start to preserve indices
  for (let i = h2Matches.length - 1; i >= 0; i--) {
    const h2Match = h2Matches[i];
    const replacement = `<section class="content-section">\n      ${h2Match.open}${wrapFirstWordWithAccent(h2Match.content)}${h2Match.close}`;
    html = html.substring(0, h2Match.index) + replacement + html.substring(h2Match.index + h2Match.fullMatch.length);
  }

  // Close sections properly - find each section and close it before the next section or at the end
  const sections = html.split('<section class="content-section">');
  if (sections.length > 1) {
    html = sections[0]; // Content before first section
    for (let i = 1; i < sections.length; i++) {
      const sectionContent = sections[i];
      // Find where this section should end (before next section or at end)
      const nextSectionIndex = sectionContent.indexOf('<section class="content-section">');

      if (nextSectionIndex !== -1) {
        // Next section starts within this content - close before it
        html += '<section class="content-section">' +
          sectionContent.substring(0, nextSectionIndex) +
          '\n    </section>\n    ' +
          sectionContent.substring(nextSectionIndex);
      } else {
        // This is the last section - close at the end
        html += '<section class="content-section">' + sectionContent + '\n    </section>';
      }
    }
  }

  return html;
}

/**
 * Get content for a specific page
 * @param {'about'|'origin-story'|'privacy'|'terms'|'contact'} page - Page identifier
 * @returns {string} - Formatted HTML content
 */
export function getPageContent(page) {
  const contentMap = {
    about: { markdown: aboutMd, meta: metadata.about },
    'origin-story': { markdown: originStoryMd, meta: metadata['origin-story'] },
    privacy: { markdown: privacyMd, meta: metadata.privacy },
    terms: { markdown: termsMd, meta: metadata.terms },
    contact: { markdown: contactMd, meta: metadata.contact }
  };

  const { markdown, meta } = contentMap[page];
  if (!markdown) {
    throw new Error(`Unknown page: ${page}`);
  }

  let html = marked.parse(markdown);

  // Apply styling enhancements
  html = enhanceMarkdownHtml(html);

  // Wrap in card structure
  let output = '<article class="card content-card">\n  <div class="card-content">\n';

  // Extract h1 and first paragraph to create header section
  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/);
  if (h1Match) {
    const h1Content = h1Match[0];
    const h1Index = html.indexOf(h1Content);
    const afterH1 = h1Index + h1Content.length;

    // Find the first paragraph after h1
    const firstPMatch = html.substring(afterH1).match(/<p>([\s\S]*?)<\/p>/);

    if (firstPMatch) {
      const firstPContent = firstPMatch[0];
      const firstPText = firstPMatch[1];
      const headerEnd = afterH1 + html.substring(afterH1).indexOf(firstPContent) + firstPContent.length;

      // Build header section
      let headerHtml = '    <header class="content-header">\n';

      // Add last updated for privacy and terms only
      if (meta.lastUpdated && (page === 'privacy' || page === 'terms')) {
        headerHtml += `      <p class="small">Last updated: ${meta.lastUpdated}</p>\n`;
      }

      headerHtml += `      ${h1Content}\n`;
      headerHtml += `      <p class="lead">${firstPText}</p>\n`;
      headerHtml += '    </header>';

      // Replace h1 and first paragraph with header section
      html = html.substring(0, h1Index) + headerHtml + html.substring(headerEnd);
    } else {
      // No paragraph after h1, just wrap h1 in header
      let headerHtml = '    <header class="content-header">\n';

      // Add last updated for privacy and terms only
      if (meta.lastUpdated && (page === 'privacy' || page === 'terms')) {
        headerHtml += `      <p class="small">Last updated: ${meta.lastUpdated}</p>\n`;
      }

      headerHtml += `      ${h1Content}\n`;
      headerHtml += '    </header>';

      html = html.substring(0, h1Index) + headerHtml + html.substring(afterH1);
    }
  }

  output += html;
  output += '\n  </div>\n</article>';

  return output;
}

/**
 * Get metadata for a specific page
 * @param {'about'|'origin-story'|'privacy'|'terms'|'contact'} page - Page identifier
 * @returns {Object} - Page metadata
 */
export function getPageMetadata(page) {
  return metadata[page];
}
