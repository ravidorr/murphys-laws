// ESLint flat config for a Vite vanilla JS/TS project
// More: https://eslint.org/docs/latest/use/configure/configuration-files-new
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import noEmoji from 'eslint-plugin-no-emoji';

export default [
  // Top-level ignores for ESLint 9 flat config
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'backup/**',
      'sods-law-calculator/**',
    ],
  },
  js.configs.recommended,
  noEmoji.configs['flat/recommended'],
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
  // TypeScript files configuration
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Use TypeScript-aware no-unused-vars instead of base rule
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable no-undef for TS files (TypeScript handles this)
      'no-undef': 'off',
    },
  },
  // Test files configuration
  {
    files: ['tests/**/*.ts', 'tests/**/*.test.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        vi: true,
        ...globals.browser,
      },
    },
    rules: {
      // Turn off no-undef as Vitest provides globals
      'no-undef': 'off',
      // Allow unused variables in tests
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
