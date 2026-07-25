import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    // Sentry plugin for source map uploads (only when all required env vars are set)
    // If any of org/project/authToken are missing, the plugin can throw in normalizeIncludeEntry (reading 'ignore' of undefined)
    (process.env.SENTRY_UPLOAD === 'true' && process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)
      ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        include: ['./dist'],
        sourcemaps: {
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
        release: {
          name: process.env.VITE_APP_VERSION || `murphys-laws-web@${Date.now()}`,
        },
      })
      : undefined,
  ].filter(Boolean),
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
      '@scripts/ssg': path.resolve(__dirname, 'scripts/ssg.ts'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'tests/**/*.test.{js,ts}',
      '../shared/**/*.test.{js,ts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: [
        'src/**/*.{js,ts}',
        '../shared/**/*.{js,ts}'
      ],
      exclude: [
        'e2e/**',
        'node_modules/**',
        'tests/**',
        '../shared/**/*.test.{js,ts}',
        'scripts/**',
        'dist/**',
        '**/*.config.js',
        '**/*.config.ts',
        '**/*.config.cjs',
        'src/main.{js,ts}', // Entry point - tested via e2e (Playwright) integration tests that exercise routing, navigation, and search
        'src/utils/facebook-signed-request.js', // Server-side utility (uses Node.js crypto, used in scripts/api-server.mjs but not currently tested)
        'src/types/**', // Type declaration files - no runtime code
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
