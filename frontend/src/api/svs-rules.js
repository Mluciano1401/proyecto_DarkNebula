// Reglas de selección de NASA SVS compartidas por la app (src/api/nasa-api.js) y por
// el script de despliegue (scripts/fetch-images.mjs), para que la copia guardada en
// GitHub Pages elija las mismas piezas e imágenes que la consulta en vivo.
// Funciones puras: sin DOM ni fetch, para poder importarlas desde Node.

import sourceSelection from '../data/source-catalog.json' with { type: 'json' };

export const API_BASE = sourceSelection.apiBase;
export const CURATED_IDS = sourceSelection.sourceIds;
export const LIVE_PER_QUERY = sourceSelection.livePerQuery ?? 1;
// `match`: el título debe contener alguna de estas palabras (la búsqueda de SVS es amplia).
export const LIVE_QUERIES = sourceSelection.liveQueries.map(({ q, match }) => ({ q, match: new RegExp(match, 'i') }));

const isImage = (i) => i?.media_type === 'Image' && i.url && /\.(jpe?g|png)$/i.test(i.filename);
const instances = (details) => (details.media_groups ?? []).flatMap((g) => (g.items ?? []).map((item) => item.instance));

// Colección curada: la primera imagen fija que no sea una leyenda o barra de color.
export function curatedImage(details) {
  return [details.main_image, ...instances(details)]
    .find((i) => isImage(i) && !/legend|color.?bar|_bar/i.test(i.filename)) ?? null;
}

// Catálogo en vivo: imagen apaisada de 800–2048 px, la más cercana a 1024 px de ancho.
const isMedium = (i) => isImage(i) && i.width >= 800 && i.width <= 2048 && i.width / i.height >= 1.3;
export function catalogImage(details) {
  if (isMedium(details.main_image)) return details.main_image;
  const others = instances(details).filter((i) => isMedium(i) && !/^legend|colorbar|bar\d|_bar/i.test(i.filename));
  others.sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024));
  return others[0] ?? null;
}

// ¿Este resultado de búsqueda sirve para la consulta? (antes de pedir su ficha)
export const matchesQuery = (result, { match }, exclude) =>
  result.result_type === 'Visualization' && !exclude.has(result.id) && match.test(result.title);

// ¿La ficha es de ciencias de la Tierra?
export const isEarthScience = (details) => (details.nasa_science_categories ?? []).includes('Earth');

export const imageExtension = (image) => image.filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
