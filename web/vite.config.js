import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    open: '/',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 5175,
    host: '0.0.0.0',
    allowedHosts: [
      'murphys-laws.com',
      'www.murphys-laws.com',
      '45.55.124.212'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@views': path.resolve(__dirname, 'src/views'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@shared': path.resolve(__dirname, '../shared'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'tests/**/*.test.js',
      '../shared/**/*.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: [
        'src/**/*.js',
        '../shared/**/*.js'
      ],
      exclude: [
        'e2e/**',
        'node_modules/**',
        'tests/**',
        '../shared/**/*.test.js',
        'scripts/**',
        'dist/**',
        '**/*.config.js',
        '**/*.config.ts',
        '**/*.config.cjs',
        'src/main.js', // Entry point - tested via e2e (Playwright) integration tests that exercise routing, navigation, and search
        'src/utils/facebook-signed-request.js', // Server-side utility (uses Node.js crypto, used in scripts/api-server.mjs but not currently tested)
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95
      }
    },
    exclude: [
      'e2e/**',
      'node_modules/**'
    ]
  }
});
