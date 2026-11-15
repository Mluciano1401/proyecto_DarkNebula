// Convierte las celdas de color en características visuales (0–1), detecta celdas
// inusuales y genera descripciones en el idioma de la interfaz (src/i18n).
// Importante: describimos VARIACIONES VISUALES, nunca fenómenos (huracanes, incendios...).

import { getLang, t } from '../i18n/i18n.js';

export function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// Clave de color a partir del tono (grados) cuando hay color suficiente; el nombre
// visible sale de t('color.<clave>').
export function colorName(hue, saturation, brightness) {
  if (saturation < 0.12) {
    if (brightness < 0.15) return 'black';
    if (brightness > 0.8) return 'white';
    return 'gray';
  }
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 40) return 'orange';
  if (hue < 65) return 'yellow';
  if (hue < 160) return 'green';
  if (hue < 195) return 'turquoise';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'violet';
  return 'pink';
}

const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
const std = (xs, m = mean(xs)) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));

function brightnessLevel(l) {
  if (l < 0.2) return 'veryDark';
  if (l < 0.4) return 'dark';
  if (l < 0.6) return 'medium';
  if (l < 0.8) return 'light';
  return 'veryLight';
}

function toneLevel(cell) {
  if (cell.saturation < 0.12) return 'none';
  if (cell.warmth > 0.6) return 'warm';
  if (cell.warmth < 0.4) return 'cool';
  return 'mid';
}

function textureLevel(texture) {
  if (texture < 0.03) return 'uniform';
  if (texture < 0.08) return 'some';
  return 'lots';
}

export function describeCell(cell) {
  return t('cell', {
    row: cell.row + 1,
    col: cell.col + 1,
    brightness: brightnessLevel(cell.brightness),
    tone: toneLevel(cell),
    color: t(`color.${cell.color}`),
    texture: textureLevel(cell.texture),
    unusual: cell.unusual,
  });
}

// Posición aproximada en palabras: "at the top left" / "arriba a la izquierda"...
export function positionWords(row, col, rows, cols) {
  const v = row < rows / 3 ? 'top' : row >= (2 * rows) / 3 ? 'bottom' : 'middle';
  const h = col < cols / 3 ? 'left' : col >= (2 * cols) / 3 ? 'right' : 'center';
  return t('pos', { v, h });
}

// Vuelve a generar las descripciones y el resumen en el idioma actual (al crear el
// análisis, al cambiar de idioma o al reutilizar un análisis guardado en caché).
export function relabel(analysis) {
  if (analysis.lang === getLang()) return analysis;
  for (const c of analysis.cells) c.description = describeCell(c);
  analysis.summary = summarize(analysis);
  analysis.lang = getLang();
  return analysis;
}

export function computeFeatures(grid) {
  const cells = grid.cells.map((c) => {
    const hue = rgbToHue(...c.hueRgb);
    // "Saturación" como croma medio por píxel (máx − mín): la S de HSL se dispara
    // en píxeles casi negros y haría sonar fuerte el espacio oscuro.
    const saturation = c.chroma;
    const brightness = c.lumMean;
    const chromaWeight = Math.min(1, saturation * 3);
    // Calidez: rojo/naranja ≈ 1, cian/azul ≈ 0; los grises quedan en 0,5.
    const warmth = 0.5 + 0.5 * Math.cos((hue * Math.PI) / 180) * chromaWeight;
    return {
      ...c,
      hue: hue / 360,
      saturation,
      brightness,
      texture: c.lumStd,
      warmth,
      color: colorName(hue, saturation, brightness),
    };
  });

  // Normalización 0–1 respecto a la imagen (para el sonido: aprovecha todo el rango).
  for (const key of ['brightness', 'saturation', 'texture']) {
    const vals = cells.map((c) => c[key]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    for (const c of cells) c[`${key}N`] = hi > lo ? (c[key] - lo) / (hi - lo) : 0.5;
  }

  // Celdas inusuales: |z| > 2 en brillo o textura.
  const bVals = cells.map((c) => c.brightness);
  const tVals = cells.map((c) => c.texture);
  const bMean = mean(bVals), bStd = std(bVals, bMean);
  const tMean = mean(tVals), tStd = std(tVals, tMean);
  for (const c of cells) {
    c.zBrightness = bStd > 0 ? (c.brightness - bMean) / bStd : 0;
    c.zTexture = tStd > 0 ? (c.texture - tMean) / tStd : 0;
    c.unusual = Math.abs(c.zBrightness) > 2 || Math.abs(c.zTexture) > 2;
  }

  // Contraste de la imagen: dispersión del brillo entre celdas, llevado a 0–1.
  const contrast = Math.min(1, bStd / 0.25);
  return relabel({ cols: grid.cols, rows: grid.rows, cells, contrast, meanBrightness: bMean, lang: null });
}

// Resumen en lenguaje natural para la narración y el lector de pantalla.
export function summarize({ cells, rows, cols, contrast, meanBrightness }) {
  const counts = {};
  for (const c of cells) counts[c.color] = (counts[c.color] ?? 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const colors = ranked.slice(0, 2).map(([name]) => name);

  const colorful = cells.filter((c) => c.saturation >= 0.12);
  const avgWarmth = colorful.length ? mean(colorful.map((c) => c.warmth)) : 0.5;
  const brightest = cells.reduce((a, c) => (c.brightness > a.brightness ? c : a));
  const unusual = cells.filter((c) => c.unusual);

  return t('summary', {
    light: meanBrightness < 0.3 ? 'dark' : meanBrightness > 0.6 ? 'light' : 'medium',
    contrast: contrast > 0.6 ? 'high' : contrast > 0.3 ? 'medium' : 'low',
    tone: avgWarmth > 0.58 ? 'warm' : avgWarmth < 0.42 ? 'cool' : 'mixed',
    colors: colors.map((name) => t(`color.${name}`)),
    brightestPos: positionWords(brightest.row, brightest.col, rows, cols),
    unusualCount: unusual.length,
    unusualPos: unusual.length ? positionWords(unusual[0].row, unusual[0].col, rows, cols) : '',
  });
}
