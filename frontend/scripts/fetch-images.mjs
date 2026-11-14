// Descarga desde NASA SVS las imágenes seleccionadas en src/data/source-catalog.json y
// guarda una copia de las respuestas de la API (public/data/svs-snapshot.json).
// La app consulta la API en vivo cuando hay proxy /svs (desarrollo, Netlify); en
// alojamientos estáticos sin proxy (GitHub Pages) usa esta copia. Los metadatos siguen
// viniendo de la API: la copia son sus respuestas, no textos escritos a mano.
// Uso: node scripts/fetch-images.mjs  (también lo ejecuta el workflow de despliegue)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceSelection from '../src/data/source-catalog.json' with { type: 'json' };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const SNAPSHOT = join(ROOT, 'public', 'data', 'svs-snapshot.json');
const isImage = (item) => item?.media_type === 'Image' && item.url && /\.(jpe?g|png)$/i.test(item.filename);

// Campos de la ficha que usa src/api/nasa-api.js (el resto de la respuesta no se guarda).
const FIELDS = [
  'id', 'title', 'description', 'url', 'page_type', 'nasa_science_categories', 'release_date',
  'update_date', 'variables', 'parameters', 'units', 'unit', 'date_range', 'time_range', 'keywords',
  'main_credits', 'datasets',
];

function pickImage(details) {
  const all = [details.main_image, ...(details.media_groups ?? []).flatMap((g) => (g.items ?? []).map((item) => item.instance))];
  return all.find((item) => isImage(item) && !/legend|color.?bar|colorbar|_bar/i.test(item.filename)) ?? null;
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  } catch {
    return { items: {} };
  }
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(dirname(SNAPSHOT), { recursive: true });
  // Si una pieza falla, se conserva su copia anterior.
  const previous = await readSnapshot();
  const items = {};
  for (const id of sourceSelection.sourceIds) {
    try {
      const response = await fetch(`${sourceSelection.apiBase}${id}/`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`API HTTP ${response.status}`);
      const details = await response.json();
      const image = pickImage(details);
      if (!image) throw new Error('API sin imagen fija');
      const assetResponse = await fetch(image.url.replace(/^http:\/\//, 'https://'));
      if (!assetResponse.ok) throw new Error(`imagen HTTP ${assetResponse.status}`);
      const ext = image.filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
      const file = `${id}.${ext}`;
      await writeFile(join(IMG_DIR, file), Buffer.from(await assetResponse.arrayBuffer()));
      // La imagen elegida va como main_image: la app la seleccionará igual que en vivo.
      items[id] = { ...Object.fromEntries(FIELDS.filter((k) => k in details).map((k) => [k, details[k]])), main_image: image };
      console.log(`✓ ${id}: ${file} (${image.width}×${image.height})`);
    } catch (error) {
      console.error(`✗ ${id}: ${error.message}`);
      if (previous.items?.[id]) {
        items[id] = previous.items[id];
        console.error(`  se mantiene la copia anterior de ${id}`);
      }
      process.exitCode = 1;
    }
  }
  const snapshot = { generatedAt: new Date().toISOString(), source: sourceSelection.apiBase, items };
  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Copia de la API guardada en public/data/svs-snapshot.json (${Object.keys(items).length} piezas).`);
}

main();
