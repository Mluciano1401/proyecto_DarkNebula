import { defineConfig } from 'vite';

// SVS solo permite CORS a otro dominio: pasamos la API y sus imágenes por /svs
// (en Netlify lo hace la regla de netlify.toml).
const svsProxy = {
  '/svs': {
    target: 'https://svs.gsfc.nasa.gov',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/svs/, ''),
  },
};

// base relativa: el build funciona en GitHub Pages (subcarpeta) y en Netlify.
export default defineConfig({
  base: './',
  server: { proxy: svsProxy },
  preview: { proxy: svsProxy },
});
