// Carga una imagen local, la reduce y la divide en una cuadrícula de celdas.
// Cada celda devuelve su color medio (r, g, b) y estadísticas de luminancia.

export const COLS = 16;
export const ROWS = 9;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen ${src}`));
    img.src = src;
  });
}

// Luminancia relativa aproximada (0–1) a partir de RGB 0–255.
export const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function processImage(img, { width = 512, cols = COLS, rows = ROWS } = {}) {
  const w = width;
  const h = Math.max(rows, Math.round((img.naturalHeight * width) / img.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const cells = [];
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor((row * h) / rows);
    const y1 = Math.floor(((row + 1) * h) / rows);
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col * w) / cols);
      const x1 = Math.floor(((col + 1) * w) / cols);
      let r = 0, g = 0, b = 0, sumL = 0, sumL2 = 0, sumC = 0, n = 0;
      // Color medio de los píxeles "con color" (ponderado por su croma), para que
      // manchas finas de color sobre fondo gris no se diluyan en el promedio.
      let cr = 0, cg = 0, cb = 0, cw = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const L = luminance(R, G, B);
          const C = (Math.max(R, G, B) - Math.min(R, G, B)) / 255;
          r += R; g += G; b += B;
          sumL += L; sumL2 += L * L; sumC += C;
          if (C > 0.15) { cr += R * C; cg += G * C; cb += B * C; cw += C; }
          n++;
        }
      }
      const lumMean = sumL / n;
      cells.push({
        row,
        col,
        r: r / n,
        g: g / n,
        b: b / n,
        hueRgb: cw > 0 ? [cr / cw, cg / cw, cb / cw] : [r / n, g / n, b / n],
        chroma: sumC / n,
        lumMean,
        lumStd: Math.sqrt(Math.max(0, sumL2 / n - lumMean * lumMean)),
      });
    }
  }
  return { cols, rows, width: w, height: h, cells };
}
