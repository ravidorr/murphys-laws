import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'scripts/**',
        'coverage/**',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 73,
        branches: 79,
        statements: 80,
      },
    },
    exclude: ['node_modules/**'],
  },
});
