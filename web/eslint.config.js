// ESLint flat config for a Vite vanilla JS project
// More: https://eslint.org/docs/latest/use/configure/configuration-files-new
import js from '@eslint/js';
import globals from 'globals';

export default [
  // Top-level ignores for ESLint 9 flat config
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backup/**',
      'sods-law-calculator/**',
      'tests/**', // Ignore test files, they have their own config
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Code quality
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: 'error',
      curly: ['error', 'multi-line'],

      // Style preferences
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: 'off',
      semi: ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },

];
