// ESLint flat config specifically for Vitest test files
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
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
        ...globals.browser, // Include browser globals as tests often interact with DOM
      },
    },
    rules: {
      // Turn off no-undef as Vitest provides globals
      'no-undef': 'off',
      // Allow unused variables in tests, e.g., for mock functions that are merely declared
      'no-unused-vars': 'off',
    },
  },
];
