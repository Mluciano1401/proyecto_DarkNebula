// Avatar decorativo: la Tierra con auriculares, que reacciona al audio mientras suena.
// Es aria-hidden: la información real la dan la cuadrícula y la región aria-live.
// Un solo bucle requestAnimationFrame (~30 fps) que solo corre mientras se reproduce.

import svgRaw from '../assets/earth-avatar.svg?raw';
import { getAudioLevels, getTempo } from '../audio/audio-engine.js';

const FRAME_MS = 1000 / 30 - 4; // ~30 fps (margen para el desfase de rAF a 60 Hz)
const LERP = 0.25; // suavizado para que no tiemble
const BASE_BPM = 120; // a este tempo, continentes y nubes giran a su velocidad original
const FLASH_MS = 300; // destello de la aurora en celdas inusuales…
const FLASH_GAP_MS = 400; // …como mucho uno cada 400 ms (WCAG 2.3.1: < 3 por segundo)
const AURORA_HUE = 160; // tono medio del degradado verde-cian de la aurora (grados)

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const lerp = (a, b) => a + (b - a) * LERP;

let svg = null;
let parts = null;
let raf = 0;
let lastFrame = 0;
let playing = false;
let frozen = false;
let bpm = 0;
let flashUntil = 0;
let lastFlash = -Infinity;
let targetHue = 0;
const smooth = { level: 0, bass: 0, mid: 0, bands: [0, 0, 0, 0, 0], glow: 0, hue: 0 };

export function mountEarthAvatar(container) {
  destroy();
  // innerHTML permitido aquí: es un SVG propio del proyecto (src/assets), de confianza,
  // no datos externos. En el resto de la app se usa textContent.
  container.innerHTML = svgRaw;
  svg = container.querySelector('#earth-avatar-pro');
  parts = {
    container,
    auroras: svg.querySelector('#auroras-container'),
    rings: [svg.querySelector('#aurora-ring-2'), svg.querySelector('#aurora-ring-3')],
    eq: [...svg.querySelectorAll('.eq-line')],
    spinners: [svg.querySelector('#continents-track'), svg.querySelector('#clouds-track')],
  };
  reducedMotion.addEventListener('change', sync);
  sync();
}

// Reproduciendo: modo reactivo + bucle. En pausa: vuelve a la animación automática.
export function setPlaying(on) {
  playing = on;
  sync();
}

// Botón "Pausar animación": congela el avatar tal cual está (el audio sigue).
export function setFrozen(on) {
  frozen = on;
  sync();
}

// Llamado por cada celda que suena en modo automático: tinte con su color y destello
// si es inusual. Solo se ve mientras el bucle está activo.
export function reactToCell(cell) {
  if (!svg) return;
  // Sin color definido (gris, negro, blanco), la aurora vuelve a su verde-cian.
  targetHue = cell.saturation >= 0.12 ? wrapDegrees(cell.hue * 360 - AURORA_HUE) : 0;
  if (cell.unusual) flash();
}

// Aplica unos niveles { level, bass, mid, high, bands[5] } (0–1) al SVG, suavizados.
export function update({ level, bass, mid, bands }) {
  if (!svg) return;
  const s = smooth;
  s.level = lerp(s.level, level);
  s.bass = lerp(s.bass, bass);
  s.mid = lerp(s.mid, mid);
  svg.style.setProperty('--beat', (1 + s.level * 0.06).toFixed(4));
  svg.style.setProperty('--aurora-scale', (1 + s.bass * 0.12).toFixed(4));

  parts.eq.forEach((line, i) => {
    s.bands[i] = lerp(s.bands[i], bands[i] ?? 0);
    line.style.transform = `scaleY(${(0.25 + s.bands[i] * 0.75).toFixed(3)})`;
  });

  // !important porque la animación CSS de esas ondas también anima la opacidad.
  const opacity = (0.4 + s.mid * 0.6).toFixed(3);
  for (const ring of parts.rings) ring.style.setProperty('opacity', opacity, 'important');

  s.glow = lerp(s.glow, performance.now() < flashUntil ? 1 : 0);
  s.hue = lerp(s.hue, targetHue);
  parts.auroras.style.filter =
    `url(#ea-neon-glow) hue-rotate(${s.hue.toFixed(1)}deg) brightness(${(1 + s.glow * 0.6).toFixed(3)})`;
}

export function destroy() {
  if (!svg) return;
  cancelAnimationFrame(raf);
  raf = 0;
  reducedMotion.removeEventListener('change', sync);
  parts.container.replaceChildren();
  svg = parts = null;
  playing = frozen = false;
}

// --- Interno -------------------------------------------------------------------------
function sync() {
  if (!svg) return;
  const reactive = playing && !reducedMotion.matches; // movimiento reducido: imagen estática
  if (reactive) svg.classList.add('audio-reactive');
  else resetReactive();

  const run = reactive && !frozen;
  if (run && !raf) raf = requestAnimationFrame(tick);
  if (!run && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  bpm = reactive ? getTempo() : 0;
  setSpinRate(reactive ? bpm / BASE_BPM : 1);
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  if (now - lastFrame < FRAME_MS) return;
  lastFrame = now;
  update(getAudioLevels());
  const tempo = getTempo();
  if (tempo !== bpm) {
    bpm = tempo;
    setSpinRate(bpm / BASE_BPM);
  }
}

// El giro sigue el tempo del Transport. Cambiar playbackRate de la animación CSS
// equivale a escalar animation-duration, pero sin que los continentes salten.
function setSpinRate(rate) {
  for (const el of parts.spinners) for (const a of el.getAnimations()) a.playbackRate = rate;
}

function flash() {
  const now = performance.now();
  if (now - lastFlash < FLASH_GAP_MS) return;
  lastFlash = now;
  flashUntil = now + FLASH_MS;
}

function resetReactive() {
  svg.classList.remove('audio-reactive');
  svg.style.removeProperty('--beat');
  svg.style.removeProperty('--aurora-scale');
  for (const line of parts.eq) line.style.removeProperty('transform');
  for (const ring of parts.rings) ring.style.removeProperty('opacity');
  parts.auroras.style.removeProperty('filter');
  Object.assign(smooth, { level: 0, bass: 0, mid: 0, bands: [0, 0, 0, 0, 0], glow: 0, hue: 0 });
  flashUntil = 0;
  targetHue = 0;
}

const wrapDegrees = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
