import { defineConfig } from 'vite';

// base './' gör att den byggda sajten fungerar på GitHub Pages oavsett repots namn
// (https://<användare>.github.io/<repo>/) och även om man öppnar dist via en enkel filserver.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
