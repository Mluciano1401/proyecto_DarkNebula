// Convierte las celdas de color en características visuales (0–1), detecta celdas
// inusuales y genera descripciones en español.
// Importante: describimos VARIACIONES VISUALES, nunca fenómenos (huracanes, incendios...).

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

// Nombre de color a partir del tono (grados) cuando hay color suficiente.
export function colorName(hue, saturation, brightness) {
  if (saturation < 0.12) {
    if (brightness < 0.15) return 'negro';
    if (brightness > 0.8) return 'blanco';
    return 'gris';
  }
  if (hue < 15 || hue >= 345) return 'rojo';
  if (hue < 40) return 'naranja';
  if (hue < 65) return 'amarillo';
  if (hue < 160) return 'verde';
  if (hue < 195) return 'turquesa';
  if (hue < 255) return 'azul';
  if (hue < 290) return 'violeta';
  return 'rosa';
}

const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
const std = (xs, m = mean(xs)) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));

function brightnessWord(l) {
  if (l < 0.2) return 'zona muy oscura';
  if (l < 0.4) return 'zona oscura';
  if (l < 0.6) return 'zona de brillo medio';
  if (l < 0.8) return 'zona clara';
  return 'zona muy clara';
}

function toneWord(cell) {
  if (cell.saturation < 0.12) return `sin color definido (${cell.color})`;
  if (cell.warmth > 0.6) return `tonos cálidos (${cell.color})`;
  if (cell.warmth < 0.4) return `tonos fríos (${cell.color})`;
  return `tonos intermedios (${cell.color})`;
}

function textureWord(t) {
  if (t < 0.03) return 'uniforme';
  if (t < 0.08) return 'algo de variación';
  return 'mucha variación';
}

export function describeCell(cell) {
  const base = `Fila ${cell.row + 1}, columna ${cell.col + 1}: ${brightnessWord(cell.brightness)}, ${toneWord(cell)}, ${textureWord(cell.texture)}`;
  return cell.unusual ? `${base}. Variación visual inusual.` : `${base}.`;
}

// Posición aproximada en palabras: "arriba a la izquierda", "en el centro"...
export function positionWords(row, col, rows, cols) {
  const v = row < rows / 3 ? 'arriba' : row >= (2 * rows) / 3 ? 'abajo' : 'al centro';
  const hz = col < cols / 3 ? 'a la izquierda' : col >= (2 * cols) / 3 ? 'a la derecha' : '';
  if (v === 'al centro' && !hz) return 'en el centro';
  return hz ? `${v} ${hz}` : v;
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
    c.description = describeCell(c);
  }

  // Contraste de la imagen: dispersión del brillo entre celdas, llevado a 0–1.
  const contrast = Math.min(1, bStd / 0.25);
  const analysis = { cols: grid.cols, rows: grid.rows, cells, contrast, meanBrightness: bMean };
  analysis.summary = summarize(analysis);
  return analysis;
}

// Resumen en lenguaje natural para la narración y el lector de pantalla.
export function summarize({ cells, rows, cols, contrast, meanBrightness }) {
  const counts = {};
  for (const c of cells) counts[c.color] = (counts[c.color] ?? 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const colors = ranked.slice(0, 2).map(([name]) => name);

  const colorful = cells.filter((c) => c.saturation >= 0.12);
  const avgWarmth = colorful.length ? mean(colorful.map((c) => c.warmth)) : 0.5;
  const tone = avgWarmth > 0.58 ? 'cálidos' : avgWarmth < 0.42 ? 'fríos' : 'mezclados, cálidos y fríos';

  const light = meanBrightness < 0.3 ? 'oscura' : meanBrightness > 0.6 ? 'clara' : 'de brillo medio';
  const contrastWord = contrast > 0.6 ? 'alto' : contrast > 0.3 ? 'medio' : 'bajo';

  const brightest = cells.reduce((a, c) => (c.brightness > a.brightness ? c : a));
  const unusual = cells.filter((c) => c.unusual);
  const unusualText = unusual.length
    ? `${unusual.length} ${unusual.length === 1 ? 'zona tiene' : 'zonas tienen'} variaciones visuales inusuales, la primera ${positionWords(unusual[0].row, unusual[0].col, rows, cols)}.`
    : 'No hay zonas con variaciones visuales inusuales.';

  return (
    `Imagen ${light}, con contraste ${contrastWord}. ` +
    `Predominan los tonos ${tone}; los colores más frecuentes son ${colors.join(' y ')}. ` +
    `La zona más clara está ${positionWords(brightest.row, brightest.col, rows, cols)}. ` +
    unusualText
  );
}
