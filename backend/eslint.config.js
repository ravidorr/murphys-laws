import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            'dist/**',
            'logs/**',
            'murphys.db',
            'murphys-production.db',
        ],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off', // Backend often uses console for logging
            'eqeqeq': 'error',
            'curly': ['error', 'multi-line'],
            'semi': ['error', 'always'],
        },
    },
    // Test files
    {
        files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                describe: true,
                it: true,
                expect: true,
                beforeEach: true,
                afterEach: true,
                vi: true,
            },
        },
    },
];
