// Descarga las imágenes oficiales seleccionadas de NASA SVS a public/images/ y
// genera la playlist local. Usamos copias locales para analizar píxeles sin CORS.
// Uso: node scripts/fetch-images.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const PLAYLIST = join(ROOT, 'src', 'data', 'playlist.json');
const API = 'https://svs.gsfc.nasa.gov/api';

// Las descripciones distinguen explícitamente una imagen renderizada de un dato.
const CURATED = [
  { id: 13786, theme: 'espacio', title: 'Caldwell 73: sonificación astronómica de referencia', altText: 'Imagen de referencia de NASA SVS para Caldwell 73. La sonificación original pertenece a NASA; esta rocola explora características visuales de la imagen y no reproduce ni valida los datos astronómicos originales.' },
  { id: 5313, theme: 'clima', title: 'Luces nocturnas de la Tierra', altText: 'Visualización global de luces nocturnas. El brillo visible es una representación cartográfica; los valores de píxel no se interpretan como radiancia calibrada en esta experiencia.' },
  { id: 3912, theme: 'océanos', title: 'Corrientes oceánicas y temperatura', altText: 'Visualización de NASA SVS que combina movimiento de corrientes oceánicas con color para representar temperatura. El color de esta imagen renderizada no se trata como medición numérica original.' },
  { id: 5669, theme: 'clima', title: 'Aerosoles GEOS (2025)', altText: 'Visualización de aerosoles GEOS. Los colores distinguen categorías como sal marina, polvo, humo y sulfatos; aquí se exploran rasgos visuales, no concentraciones numéricas.' },
  { id: 5533, theme: 'clima', title: 'Calidad del aire: modelos NASA', altText: 'Visualización del modelo de calidad del aire de NASA. El registro incluye capas de contaminantes distintos; esta imagen por sí sola no proporciona sus valores numéricos calibrados.' },
  { id: 5425, theme: 'océanos', title: 'Océano perpetuo: corrientes límite occidentales', altText: 'Visualización artística de corrientes oceánicas a distintas profundidades. NASA indica que parte de los colores se eligió por apariencia; la sonificación de esta carátula describe características visuales.' },
  { id: 5196, theme: 'clima', title: 'Dióxido de carbono global DYAMOND', altText: 'Visualización de NASA de dióxido de carbono global modelado. La imagen muestra una representación sobre el globo y no se usa como sustituto de la cuadrícula numérica original.' },
  { id: 5011, theme: 'clima', title: 'Rayos detectados desde la Estación Espacial', altText: 'Previsualización de eventos de rayos detectados por el sensor LIS desde la Estación Espacial. Esta carátula no contiene la tabla numérica de eventos.' },
  { id: 4960, theme: 'clima', title: 'Río atmosférico en 3D', altText: 'Visualización tridimensional de un río atmosférico con varias capas de humedad, viento, nubes y precipitación. El sombreado no es una escala numérica calibrada.' },
  { id: 4950, theme: 'vegetación', title: 'Altura forestal observada por GEDI', altText: 'Visualización de altura relativa de vegetación GEDI. La altura está exagerada en la representación de NASA; esta carátula se analiza como rasgo visual, no como altura medida.' },
];

const toHttps = (url) => url.replace(/^http:\/\//, 'https://');
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const isImage = (i) => i?.media_type === 'Image' && /\.(jpe?g|png)$/i.test(i.filename);
const isLegend = (i) => /legend|colorbar|color.?bar|bar\d|_bar/i.test(i.filename);

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

function pickImage(details) {
  const all = [details.main_image, ...(details.media_groups ?? []).flatMap((g) => (g.items ?? []).map((x) => x.instance))]
    .filter(isImage);
  // Prefer a real, reasonably large still image; never choose a detached legend.
  const usable = all.filter((i) => !isLegend(i));
  usable.sort((a, b) => {
    const score = (i) => (i.width >= 800 ? 0 : 10000) + Math.abs(i.width - 1200) + (i.height > 0 ? 0 : 50000);
    return score(a) - score(b);
  });
  return usable[0] ?? all[0] ?? null;
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(dirname(PLAYLIST), { recursive: true });
  const playlist = [];

  for (const entry of CURATED) {
    try {
      const details = await getJson(`${API}/${entry.id}/`);
      const img = pickImage(details);
      if (!img?.url) throw new Error('La API no contiene imagen utilizable');
      const response = await fetch(toHttps(img.url), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`imagen HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get('content-type') ?? '';
      if (!bytes.length || (type && !type.startsWith('image/'))) throw new Error(`respuesta de imagen inválida (${type || 'sin MIME'})`);
      const ext = img.filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
      const file = `${details.id}.${ext}`;
      await writeFile(join(IMG_DIR, file), bytes);
      const nasaDescription = stripHtml(details.description).split(' || ')[0];
      playlist.push({
        id: details.id,
        title: entry.title,
        theme: entry.theme,
        description: `Exploración de características visuales de una imagen de NASA SVS. ${nasaDescription || details.title} La sonificación no representa directamente una medición científica original.`,
        altText: entry.altText,
        image: `images/${file}`,
        nasaUrl: `https://svs.gsfc.nasa.gov/${details.id}/`,
        apiUrl: `https://svs.gsfc.nasa.gov/api/${details.id}/`,
        nasaTitle: details.title,
        credit: 'NASA Scientific Visualization Studio',
        sonificationType: 'visual-features',
        originalImage: { filename: img.filename, width: img.width, height: img.height },
        ...(details.id === 13786 ? { existingNasaSonification: true } : {}),
      });
      console.log(`✓ ${details.id}: ${img.filename} (${img.width}x${img.height}, ${bytes.length} bytes)`);
    } catch (err) {
      console.error(`✗ ${entry.id}: ${err.message}`);
    }
  }

  if (playlist.length !== CURATED.length) throw new Error(`Solo se descargaron ${playlist.length} de ${CURATED.length} imágenes; playlist no actualizada.`);
  await writeFile(PLAYLIST, JSON.stringify(playlist, null, 2) + '\n', 'utf8');
  console.log(`\nplaylist.json: ${playlist.length} imágenes descargadas y listas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
