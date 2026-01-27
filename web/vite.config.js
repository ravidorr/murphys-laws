import { defineConfig } from 'vite';
import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    // PWA plugin for service worker and manifest generation
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'android-chrome-*.png'],
      manifest: {
        name: "Murphy's Law Archive",
        short_name: "Murphy's Laws",
        description: "Explore the complete archive of Murphy's Laws and corollaries. Try interactive Sod's Law and Buttered Toast calculators.",
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['entertainment', 'education', 'utilities'],
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/social/home.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide',
            label: "Murphy's Law Archive home page with Law of the Day"
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Offline fallback page
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // Categories API - rarely changes, use StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/murphys-laws\.com\/api\/v1\/categories/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-categories',
              expiration: {
                maxAgeSeconds: 3600 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Attributions API - rarely changes, use StaleWhileRevalidate
          {
            urlPattern: /^https:\/\/murphys-laws\.com\/api\/v1\/attributions/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-attributions',
              expiration: {
                maxAgeSeconds: 3600 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Law of the day - changes daily, use NetworkFirst with 24h cache
          {
            urlPattern: /^https:\/\/murphys-laws\.com\/api\/v1\/law-of-day/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-law-of-day',
              expiration: {
                maxAgeSeconds: 86400 // 24 hours
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Laws list and individual laws - user browsing data, NetworkFirst
          {
            urlPattern: /^https:\/\/murphys-laws\.com\/api\/v1\/laws/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-laws',
              expiration: {
                maxAgeSeconds: 3600, // 1 hour
                maxEntries: 100
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google Fonts webfont files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                maxEntries: 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images - CacheFirst with 30 day expiration
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                maxEntries: 100
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Disable in development to avoid caching issues
      }
    }),
    // Sentry plugin for source map uploads (only in production builds)
    process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'], // Don't serve source maps publicly
      },
      release: {
        name: process.env.VITE_APP_VERSION || `murphys-laws-web@${Date.now()}`,
      },
    }),
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
