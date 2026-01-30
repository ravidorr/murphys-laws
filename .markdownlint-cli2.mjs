import searchReplace from 'markdownlint-rule-search-replace';

export default {
  // Custom rules
  customRules: [searchReplace],

  // Rule configuration
  config: {
    // Default state for all rules
    default: true,

    // MD013 - Line length
    // Disable because many markdown files have long lines that are fine
    MD013: false,

    // MD022 - Headings should be surrounded by blank lines
    // Disable - too strict for most documentation
    MD022: false,

    // MD024 - Multiple headings with the same content
    // Disable - common in structured documentation (Testing, Architecture sections)
    MD024: false,

    // MD025 - Single top-level heading
    // Disable - multiple H1s are acceptable in some documentation styles
    MD025: false,

    // MD026 - Trailing punctuation in heading
    // Allow colons and question marks in headings
    MD026: {
      punctuation: '.,;!',
    },

    // MD029 - Ordered list item prefix
    // Use "ordered" style (1. 2. 3.) which is more common in most projects
    MD029: {
      style: 'ordered',
    },

    // MD031 - Fenced code blocks should be surrounded by blank lines
    // Disable - many valid cases where this is unnecessary
    MD031: false,

    // MD032 - Lists should be surrounded by blank lines
    // Disable - too strict for most documentation
    MD032: false,

    // MD033 - Inline HTML
    // Allow HTML in markdown for flexibility
    MD033: false,

    // MD036 - Emphasis used instead of heading
    // Disable - bold text is sometimes preferred over headings for inline labels
    MD036: false,

    // MD040 - Fenced code blocks should have a language specified
    // Disable - not all code blocks need a language
    MD040: false,

    // MD041 - First line should be a top-level heading
    // Disable for files that may start with frontmatter or other content
    MD041: false,

    // MD051 - Link fragments should be valid
    // Disable - has false positives with complex document structures
    MD051: false,

    // MD060 - Table column style
    // Disable - table formatting preferences vary
    MD060: false,

    // Custom rules for text consistency
    'search-replace': {
      rules: [
        {
          name: 'no-em-dash',
          message: 'Do not use em dashes (—). Use regular dashes (-) or rewrite the sentence.',
          search: '—',
          replace: '-',
        },
        {
          name: 'no-emoji-checkmark',
          message: 'Do not use emojis. Replace ✅ with [x] or text.',
          search: '✅',
        },
        {
          name: 'no-emoji-x',
          message: 'Do not use emojis. Replace ❌ with [ ] or text.',
          search: '❌',
        },
        {
          name: 'no-emoji-warning',
          message: 'Do not use emojis. Replace ⚠️ with WARNING: or **Warning:**',
          search: '⚠️',
        },
        {
          name: 'no-emoji-star',
          message: 'Do not use emojis. Replace ⭐ with text.',
          search: '⭐',
        },
        {
          name: 'no-emoji-rocket',
          message: 'Do not use emojis. Replace 🚀 with text.',
          search: '🚀',
        },
        {
          name: 'no-emoji-party',
          message: 'Do not use emojis. Replace with text.',
          search: '🎉',
        },
        {
          name: 'no-emoji-target',
          message: 'Do not use emojis. Replace 🎯 with text.',
          search: '🎯',
        },
        {
          name: 'no-emoji-bulb',
          message: 'Do not use emojis. Replace 💡 with NOTE: or **Tip:**',
          search: '💡',
        },
        {
          name: 'no-emoji-thumbsup',
          message: 'Do not use emojis. Replace 👍 with text.',
          search: '👍',
        },
        {
          name: 'no-emoji-sparkles',
          message: 'Do not use emojis. Replace ✨ with text.',
          search: '✨',
        },
      ],
    },
  },
};
