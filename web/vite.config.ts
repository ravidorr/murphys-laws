import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import legacy from '@vitejs/plugin-legacy';
import { earlyApiBasePlugin } from './scripts/early-api-base.ts';
import { resolveAppRelease } from './scripts/app-release.ts';
import rootPackage from '../package.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// One release name for the whole build, derived from the commit and never from the clock: it is compiled into the
// bundle (Sentry.init in src/main.ts) and names the release the Sentry plugin uploads the source maps to. A
// timestamp would give the entry chunk a new content hash on every build.
// A build that uploads source maps must know its commit: a shared `-dev` release would mix the maps of different builds.
const APP_RELEASE = resolveAppRelease({
  env: process.env,
  packageVersion: rootPackage.version,
  requireCommit: process.env.SENTRY_UPLOAD === 'true',
});

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_RELEASE),
  },
  build: {
    // Required for Sentry source maps. 'hidden' still emits the .map files for the upload but leaves out the
    // //# sourceMappingURL comment: the upload deletes the maps from dist, so the comment pointed at a 404.
    sourcemap: 'hidden',
    // Emit CSS as a file in every pass; the legacy (SystemJS) pass otherwise injects it at runtime
    cssCodeSplit: false,
  },
  plugins: [
    // The inline early Law of the Day request in index.html must target the API the app is built for
    earlyApiBasePlugin(),
    // Older embedded browsers (Kindle) cannot run the modern module bundle; emit a
    // transpiled nomodule bundle with polyfills for them. Modern browsers are unaffected.
    legacy({
      targets: ['defaults', 'chrome >= 49', 'safari >= 10', 'android >= 5'],
    }),
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
          name: APP_RELEASE,
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
      },
      '/admin': {
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
      },
      '/admin': {
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
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
    exclude: [
      'e2e/**',
      'node_modules/**'
    ]
  }
});
