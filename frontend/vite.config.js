import { defineConfig } from 'vite';

// base relativa: el build funciona en GitHub Pages (subcarpeta) y en Netlify.
export default defineConfig({
  base: './',
});
