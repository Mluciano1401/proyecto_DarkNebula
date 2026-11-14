// Descarga copias opcionales de las imágenes seleccionadas en NASA SVS.
// Los metadatos no se escriben: la aplicación siempre los consulta desde la API.
// Uso: node scripts/fetch-images.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceSelection from '../src/data/source-catalog.json' with { type: 'json' };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const isImage = (item) => item?.media_type === 'Image' && item.url && /\.(jpe?g|png)$/i.test(item.filename);

function pickImage(details) {
  const all = [details.main_image, ...(details.media_groups ?? []).flatMap((g) => (g.items ?? []).map((item) => item.instance))];
  return all.find((item) => isImage(item) && !/legend|color.?bar|colorbar|_bar/i.test(item.filename)) ?? null;
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
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
      console.log(`✓ ${id}: ${file} (${image.width}×${image.height})`);
    } catch (error) {
      console.error(`✗ ${id}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log('Copias guardadas. No se generó ni modificó ningún archivo de metadatos.');
}

main();
