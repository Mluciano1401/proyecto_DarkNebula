// Reglas de sonificación: cada característica visual controla UN parámetro de sonido.
// Funciones puras (sin Tone.js) para poder probarlas y documentarlas fácilmente.

// Escala pentatónica de Do en 2 octavas: cualquier combinación de notas suena consonante.
export const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
export const BASS_SCALE = ['C2', 'D2', 'E2', 'G2', 'A2', 'C3'];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const pick = (scale, x) => scale[Math.round(clamp01(x) * (scale.length - 1))];

// Brillo → altura: más claro = más agudo.
export const noteForBrightness = (b) => pick(SCALE, b);
export const bassForBrightness = (b) => pick(BASS_SCALE, b);

// Saturación → volumen (velocity 0–1), con un mínimo audible.
export const velocityForSaturation = (s) => 0.3 + 0.6 * clamp01(s);

// Textura → ritmo: uniforme = 1 nota larga; mucha variación = 3 notas cortas.
export const pulsesForTexture = (t) => (t < 0.33 ? 1 : t < 0.66 ? 2 : 3);

// Columna → paneo estéreo (izquierda −0,8 a derecha +0,8).
export const panForColumn = (col, cols) => (cols > 1 ? -0.8 + (1.6 * col) / (cols - 1) : 0);

// Contraste medio de la imagen → tempo (hasta un 25 % más rápido con mucho contraste).
export const tempoFor = (baseBpm, contrast) => Math.round(baseBpm * (0.9 + 0.25 * clamp01(contrast)));

// Tono de color → timbre: mezcla entre onda suave (fríos) y onda brillante (cálidos).
export const timbreMix = (warmth) => ({ soft: 1 - clamp01(warmth), bright: clamp01(warmth) });

export function mapCell(cell, cols) {
  return {
    note: noteForBrightness(cell.brightnessN),
    velocity: velocityForSaturation(cell.saturationN),
    pulses: pulsesForTexture(cell.textureN),
    pan: panForColumn(cell.col, cols),
    timbre: timbreMix(cell.warmth),
    accent: cell.unusual,
  };
}

// Arreglos inspirados en géneros: el motivo principal y su mapeo de datos nunca
// cambian. Solo varían el timbre y un acompañamiento opcional, de volumen bajo.
// No son interpretaciones auténticas de instrumentos acústicos.
export const SOUND_STYLES = {
  ambiental: { soft: 'sine', bright: 'triangle', cutoff: 1400, release: 1.5, arrangement: 'pad' },
  clasica: { soft: 'triangle', bright: 'sawtooth', cutoff: 2200, release: 0.85, arrangement: 'chords' },
  electronica: { soft: 'square', bright: 'sawtooth', cutoff: 3600, release: 0.18, arrangement: 'pulse' },
};
export const DEFAULT_SOUND_STYLE = SOUND_STYLES.ambiental;
