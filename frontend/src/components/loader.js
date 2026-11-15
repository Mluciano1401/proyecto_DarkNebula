// Pantalla de carga (marcado y estilos en index.html, para que se vea antes del JS).
// Se cierra cuando la primera imagen está analizada, con un mínimo para que la
// animación no sea solo un parpadeo. Una tecla o un clic la cierran antes: nunca
// tapa el foco ni bloquea la página.

const MIN_MS = 1200; // desde que empezó a cargar la página
const MAX_MS = 10000; // por si algo se queda colgado
const FADE_MS = 500;

function hideLoader() {
  document.documentElement.classList.remove('is-loading');
  const loader = document.getElementById('loader');
  if (!loader || loader.classList.contains('is-done')) return;
  loader.classList.add('is-done');
  setTimeout(() => loader.remove(), FADE_MS);
}

export function finishLoader(ready) {
  const minimum = new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - performance.now())));
  Promise.allSettled([ready, minimum]).then(hideLoader);
  setTimeout(hideLoader, MAX_MS);
  addEventListener('keydown', hideLoader, { once: true });
  addEventListener('pointerdown', hideLoader, { once: true });
}
