// Descarga desde NASA SVS las imágenes seleccionadas en src/data/source-catalog.json y
// guarda una copia de las respuestas de la API (public/data/svs-snapshot.json).
// También hace las búsquedas del catálogo en vivo (liveQueries) y guarda sus fichas e
// imágenes, para que el botón «catálogo en vivo» funcione sin proxy.
// La app consulta la API en vivo cuando hay proxy /svs (desarrollo, Netlify); en
// alojamientos estáticos sin proxy (GitHub Pages) usa esta copia. Los metadatos siguen
// viniendo de la API: la copia son sus respuestas, no textos escritos a mano.
// Uso: node scripts/fetch-images.mjs  (también lo ejecuta el workflow de despliegue)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_BASE,
  CURATED_IDS,
  LIVE_PER_QUERY,
  LIVE_QUERIES,
  catalogImage,
  curatedImage,
  imageExtension,
  isEarthScience,
  matchesQuery,
} from '../src/api/svs-rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const SNAPSHOT = join(ROOT, 'public', 'data', 'svs-snapshot.json');

// Campos de la ficha que usa src/api/nasa-api.js (el resto de la respuesta no se guarda).
const FIELDS = [
  'id', 'title', 'description', 'url', 'page_type', 'nasa_science_categories', 'release_date',
  'update_date', 'variables', 'parameters', 'units', 'unit', 'date_range', 'time_range', 'keywords',
  'main_credits', 'datasets',
  'media_groups',
];

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  } catch {
    return { items: {} };
  }
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`API HTTP ${response.status}`);
  return response.json();
}

// Descarga la imagen y devuelve la ficha recortada; la imagen elegida va como
// main_image para que la app la seleccione igual que en vivo.
async function saveItem(details, image) {
  const assetResponse = await fetch(image.url.replace(/^http:\/\//, 'https://'));
  if (!assetResponse.ok) throw new Error(`imagen HTTP ${assetResponse.status}`);
  const file = `${details.id}.${imageExtension(image)}`;
  await writeFile(join(IMG_DIR, file), Buffer.from(await assetResponse.arrayBuffer()));
  console.log(`✓ ${details.id}: ${file} (${image.width}×${image.height})`);
  return { ...Object.fromEntries(FIELDS.filter((k) => k in details).map((k) => [k, details[k]])), main_image: image };
}

async function fetchCurated(previous) {
  const items = {};
  for (const id of CURATED_IDS) {
    try {
      const details = await getJson(`${API_BASE}${id}/`);
      const image = curatedImage(details);
      if (!image) throw new Error('API sin imagen fija');
      items[id] = await saveItem(details, image);
    } catch (error) {
      console.error(`✗ ${id}: ${error.message}`);
      if (previous.items?.[id]) {
        items[id] = previous.items[id];
        console.error(`  se mantiene la copia anterior de ${id}`);
      }
      process.exitCode = 1;
    }
  }
  return items;
}

// Misma búsqueda que fetchCatalog() en src/api/nasa-api.js.
async function fetchLiveCatalog() {
  const exclude = new Set(CURATED_IDS);
  const items = {};
  for (const query of LIVE_QUERIES) {
    let found = 0;
    try {
      const data = await getJson(`${API_BASE}search/?search=${encodeURIComponent(query.q)}&limit=20`);
      for (const result of data.results ?? []) {
        if (found >= LIVE_PER_QUERY) break;
        if (!matchesQuery(result, query, exclude)) continue;
        const details = await getJson(`${API_BASE}${result.id}/`);
        if (!isEarthScience(details)) continue;
        const image = catalogImage(details);
        if (!image) continue;
        exclude.add(details.id);
        items[details.id] = await saveItem(details, image);
        found++;
      }
    } catch (error) {
      console.error(`✗ búsqueda «${query.q}»: ${error.message}`);
      process.exitCode = 1;
    }
  }
  return items;
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(dirname(SNAPSHOT), { recursive: true });
  // Si una pieza falla, se conserva su copia anterior.
  const previous = await readSnapshot();
  const items = await fetchCurated(previous);

  console.log('Catálogo en vivo:');
  let catalogItems = await fetchLiveCatalog();
  let catalog = Object.keys(catalogItems).map(Number);
  if (!catalog.length && previous.catalog?.length) {
    console.error('  sin resultados: se mantiene el catálogo anterior');
    catalog = previous.catalog.filter((id) => previous.items?.[id]);
    catalogItems = Object.fromEntries(catalog.map((id) => [id, previous.items[id]]));
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: API_BASE,
    catalog,
    items: { ...catalogItems, ...items },
  };
  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Copia de la API guardada en public/data/svs-snapshot.json (${Object.keys(items).length} piezas curadas, ${catalog.length} del catálogo).`);
}

main();
