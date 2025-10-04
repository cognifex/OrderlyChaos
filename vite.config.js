import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'Musik',
  base: './',
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
