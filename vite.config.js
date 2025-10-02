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
  preview: { port: 5175, host: '127.0.0.1' },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@views': path.resolve(__dirname, 'src/views'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@data': path.resolve(__dirname, 'src'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
    exclude: [
      'e2e/**',
      'node_modules/**' 
    ]
  }
});
