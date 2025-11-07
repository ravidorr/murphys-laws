import { marked } from 'marked';

// Import markdown files from shared content
import aboutMd from '../../../shared/content/legal/about.md?raw';
import privacyMd from '../../../shared/content/legal/privacy.md?raw';
import termsMd from '../../../shared/content/legal/terms.md?raw';
import contactMd from '../../../shared/content/legal/contact.md?raw';
import metadata from '../../../shared/content/legal/metadata.json';

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
function markdownToHtml(markdownContent, options = {}) {
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
 * Process markdown HTML to add styling classes
 * @param {string} html - HTML from markdown
 * @returns {string} - HTML with added classes
 */
function enhanceMarkdownHtml(html) {
  // Add styling classes to elements
  html = html.replace(/<h1>/g, '<h1><span class="accent-text">');
  html = html.replace(/<\/h1>/g, '</span></h1>');

  // Wrap sections
  html = html.replace(/<h2>/g, '<section class="content-section">\n      <h2><span class="accent-text">');
  html = html.replace(/<\/h2>/g, '</span></h2>');

  // Add closing section tags (simplified approach - wraps each h2 section)
  const sections = html.split('<section class="content-section">');
  if (sections.length > 1) {
    html = sections[0]; // Content before first section
    for (let i = 1; i < sections.length; i++) {
      // For each section, close it before the next one or at the end
      if (i < sections.length - 1) {
        const nextSectionIndex = sections[i].lastIndexOf('</section>');
        if (nextSectionIndex === -1) {
          html += '<section class="content-section">' + sections[i] + '\n    </section>\n    ';
        } else {
          html += '<section class="content-section">' + sections[i];
        }
      } else {
        html += '<section class="content-section">' + sections[i] + '\n    </section>';
      }
    }
  }

  // Add header styling
  html = html.replace(/<header class="content-header">/, '<header class="content-header">\n      ');

  return html;
}

/**
 * Get content for a specific page
 * @param {'about'|'privacy'|'terms'|'contact'} page - Page identifier
 * @returns {string} - Formatted HTML content
 */
export function getPageContent(page) {
  const contentMap = {
    about: { markdown: aboutMd, meta: metadata.about },
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

  // Add last updated for privacy and terms
  if (meta.lastUpdated && (page === 'privacy' || page === 'terms')) {
    const headerContentMatch = html.match(/<h1><span class="accent-text">([^<]+)<\/span><\/h1>/);
    if (headerContentMatch) {
      const title = headerContentMatch[1];
      html = html.replace(
        headerContentMatch[0],
        `    <header class="content-header">
      <p class="small">Last updated: ${meta.lastUpdated}</p>
      <h1><span class="accent-text">${title}</span></h1>`
      );

      // Find the first paragraph after h1 and close the header
      const afterH1 = html.indexOf('</h1>') + 5;
      const firstPEnd = html.indexOf('</p>', afterH1);
      if (firstPEnd !== -1) {
        const leadText = html.substring(afterH1, firstPEnd + 4);
        html = html.replace(
          headerContentMatch[0] + leadText,
          `    <header class="content-header">
      <p class="small">Last updated: ${meta.lastUpdated}</p>
      <h1><span class="accent-text">${title}</span></h1>
      <p class="lead">${leadText.replace('<p>', '').replace('</p>', '')}</p>
    </header>`
        );
      }
    }
  } else {
    // For about and contact, just add header wrapper
    const headerContentMatch = html.match(/<h1><span class="accent-text">([^<]+)<\/span><\/h1>/);
    if (headerContentMatch) {
      const afterH1 = html.indexOf('</h1>') + 5;
      const firstPEnd = html.indexOf('</p>', afterH1);
      if (firstPEnd !== -1) {
        const title = headerContentMatch[1];
        const leadText = html.substring(afterH1, firstPEnd + 4);
        html = html.replace(
          headerContentMatch[0] + leadText,
          `    <header class="content-header">
      <h1><span class="accent-text">${title}</span></h1>
      <p class="lead">${leadText.replace('<p>', '').replace('</p>', '')}</p>
    </header>`
        );
      }
    }
  }

  output += html;
  output += '\n  </div>\n</article>';

  return output;
}

/**
 * Get metadata for a specific page
 * @param {'about'|'privacy'|'terms'|'contact'} page - Page identifier
 * @returns {Object} - Page metadata
 */
export function getPageMetadata(page) {
  return metadata[page];
}
