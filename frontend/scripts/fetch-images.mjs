// Descarga visualizaciones de NASA SVS a public/images/ y genera src/data/playlist.json.
// Uso: node scripts/fetch-images.mjs
// Usamos copias locales para que Canvas pueda leer los píxeles sin problemas de CORS.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const PLAYLIST = join(ROOT, 'src', 'data', 'playlist.json');
const API = 'https://svs.gsfc.nasa.gov/api';

// Lista curada: id de SVS + tema + textos en español.
// Si un id falla, se usa `search` para buscar otra pieza de la categoría Earth.
const CURATED = [
  {
    id: 5101,
    theme: 'temperatura',
    search: 'sea surface temperature',
    title: 'Temperatura superficial del mar',
    description:
      'Mapa global de la temperatura de la superficie del océano, actualizado a diario. Los tonos rojos y amarillos indican agua más cálida, cerca del ecuador; los azules y morados, agua más fría hacia los polos.',
    altText:
      'Mapa del mundo en proyección rectangular. Los océanos van del rojo oscuro en la franja ecuatorial, pasando por beige, al azul claro y azul marino cerca de los polos; los continentes y la Antártida aparecen en gris. Abajo a la izquierda se lee la fecha.',
  },
  {
    id: 5677,
    theme: 'hielo',
    search: 'arctic sea ice minimum',
    title: 'Mínimo del hielo marino del Ártico 2026',
    description:
      'Vista del Polo Norte en el momento de menor extensión del hielo marino en 2026. El blanco es hielo marino; la línea amarilla marca la extensión media del mínimo entre 1981 y 2010.',
    altText:
      'El globo terrestre visto desde arriba del Ártico sobre fondo negro. En el centro, una mancha blanca irregular de hielo marino sobre océano azul oscuro, junto a Groenlandia (blanca) y las costas de Norteamérica y Eurasia. Una línea amarilla dibuja un contorno más amplio que el hielo actual. Arriba a la izquierda, el texto: 4,60 millones de km², 12 de septiembre de 2026.',
  },
  {
    id: 5690,
    theme: 'océanos',
    search: 'ocean color PACE',
    title: 'Color del océano visto por PACE',
    description:
      'Color aparente del océano medido por la misión PACE de NASA. Los cambios de color se asocian a patrones del fitoplancton: verdes y amarillos donde hay más, azules intensos en aguas más pobres.',
    altText:
      'Mapa global del océano. Las aguas abiertas de los subtrópicos se ven azul intenso; las costas, las zonas de afloramiento y las latitudes altas se ven verdes y amarillas; la tierra aparece en gris.',
  },
  {
    id: 5548,
    theme: 'vegetación',
    search: 'PACE land vegetation',
    title: 'Vegetación terrestre vista por PACE',
    description:
      'Pigmentos de las plantas medidos por la misión PACE en septiembre de 2024. El verde indica clorofila, el azul carotenoides y el rosa o rojo antocianinas; las zonas grises tienen poca vegetación detectada.',
    altText:
      'Mapa del mundo sobre fondo gris oscuro. La Amazonia, África central, India y el sudeste de Asia brillan en verde; el norte de Eurasia y Norteamérica mezclan verde, azul y rosa; Australia y Siberia tienen manchas rosas intensas. Abajo al centro, un triángulo de color sirve de leyenda.',
  },
  {
    id: 5650,
    theme: 'clima',
    search: 'global precipitation',
    title: 'Precipitación global casi en tiempo real',
    description:
      'Lluvia y nieve en todo el planeta medidas por la constelación de satélites GPM. Los colores marcan la intensidad de la precipitación y muestran los grandes sistemas de tormentas y frentes.',
    altText:
      'Mapa del mundo en proyección ovalada con la Tierra en color natural sobre océano negro. Bandas y remolinos verdes, amarillos y rojos marcan la lluvia, sobre todo en los trópicos y en frentes del Atlántico y el Pacífico sur; manchas azules cerca de los polos marcan la nieve.',
  },
];

const toHttps = (url) => url.replace(/^http:\/\//, 'https://');
const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// Imagen "mediana": jpg/png apaisada con ancho entre 800 y 2048 px.
const isMedium = (i) =>
  i && /\.(jpe?g|png)$/i.test(i.filename) && i.width >= 800 && i.width <= 2048 && i.width / i.height >= 1.3;

// Prefiere main_image si es mediana; si no, busca en media_groups la más cercana
// a 1024 px, descartando leyendas y barras de color sueltas.
function pickImage(details) {
  if (isMedium(details.main_image)) return details.main_image;
  const others = [];
  for (const group of details.media_groups ?? []) {
    for (const item of group.items ?? []) {
      const i = item.instance;
      if (i?.media_type === 'Image' && isMedium(i) && !/^legend|colorbar|bar\d|_bar/i.test(i.filename)) {
        others.push(i);
      }
    }
  }
  others.sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024));
  return others[0] ?? details.main_image ?? null;
}

const isEarth = (d) => (d.nasa_science_categories ?? []).includes('Earth');

async function findBySearch(query, excludeIds) {
  const data = await getJson(`${API}/search/?search=${encodeURIComponent(query)}&limit=10`);
  for (const r of data.results ?? []) {
    if (excludeIds.has(r.id) || r.result_type !== 'Visualization') continue;
    const details = await getJson(`${API}/${r.id}/`);
    if (isEarth(details) && pickImage(details)) return details;
  }
  return null;
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(dirname(PLAYLIST), { recursive: true });

  const playlist = [];
  const usedIds = new Set();

  for (const entry of CURATED) {
    let details = null;
    let custom = true;
    try {
      details = await getJson(`${API}/${entry.id}/`);
      if (!isEarth(details) || !pickImage(details)) details = null;
    } catch (err) {
      console.warn(`  ! ${entry.id}: ${err.message}`);
    }
    if (!details) {
      console.warn(`  ! ${entry.id} no disponible, buscando "${entry.search}"...`);
      details = await findBySearch(entry.search, usedIds);
      custom = false; // los textos curados ya no corresponden a esta pieza
    }
    if (!details) {
      console.warn(`  ✗ Sin resultado para ${entry.theme}`);
      continue;
    }

    const img = pickImage(details);
    const ext = img.filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
    const file = `${details.id}.${ext}`;
    const res = await fetch(toHttps(img.url));
    if (!res.ok) {
      console.warn(`  ✗ No se pudo descargar ${img.url} (HTTP ${res.status})`);
      continue;
    }
    await writeFile(join(IMG_DIR, file), Buffer.from(await res.arrayBuffer()));
    usedIds.add(details.id);

    const nasaDescription = stripHtml(details.description).split(' || ')[0];
    playlist.push({
      id: details.id,
      title: custom ? entry.title : details.title,
      theme: entry.theme,
      description: custom ? entry.description : nasaDescription,
      altText: custom ? entry.altText : stripHtml(img.alt_text || nasaDescription),
      image: `images/${file}`,
      nasaUrl: `https://svs.gsfc.nasa.gov/${details.id}/`,
      nasaTitle: details.title,
      credit: 'NASA Scientific Visualization Studio',
    });
    console.log(`  ✓ ${details.id} ${entry.theme.padEnd(12)} ${img.filename} (${img.width}x${img.height})`);
  }

  await writeFile(PLAYLIST, JSON.stringify(playlist, null, 2) + '\n', 'utf8');
  console.log(`\nplaylist.json: ${playlist.length} piezas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
