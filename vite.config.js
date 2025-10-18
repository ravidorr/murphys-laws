import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  server: {
    host: '127.0.0.1',
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
    host: '127.0.0.1',
    allowedHosts: [
      'murphys-laws.com',
      'www.murphys-laws.com',
      '45.55.124.212'
    ]
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@views': path.resolve(__dirname, 'src/views'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      exclude: [
        'e2e/**',
        'node_modules/**',
        'tests/**',
        'scripts/**',
        'dist/**',
        '**/*.config.js',
        '**/*.config.ts',
        '**/*.config.cjs',
        'src/main.js',        // Entry point - integration tested via e2e
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    },
    exclude: [
      'e2e/**',
      'node_modules/**'
    ]
  }
});
