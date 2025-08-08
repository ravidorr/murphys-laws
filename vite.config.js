import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  server: { port: 5173, open: 'index.html' },
  preview: { port: 5173 },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@views': path.resolve(__dirname, 'src/views'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@data': path.resolve(__dirname, 'src'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
