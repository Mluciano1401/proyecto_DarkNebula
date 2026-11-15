// Catálogo desde NASA SVS. La ficha, imagen y metadatos se leen del API por el
// proxy /svs para servir la imagen desde el mismo origen y poder analizarla.
// Sin proxy (GitHub Pages es estático y SVS solo permite CORS a otro dominio) se usa
// la copia de las respuestas de la API que guarda scripts/fetch-images.mjs al desplegar.

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
} from './svs-rules.js';

const BASE = '/svs';
const CACHE_KEY = 'svs-catalog-v4';

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cleanDescription = (s) => stripHtml(s).split(' || ')[0];
const proxied = (url) => url.replace(/^https?:\/\/svs\.gsfc\.nasa\.gov/, BASE);
const secureUrl = (url = '') => url.replace(/^http:\/\//, 'https://');
const asList = (value) => Array.isArray(value) ? value : value ? [String(value)] : [];
const localImageUrl = (id, image) =>
  new URL(`${import.meta.env.BASE_URL}images/${id}.${imageExtension(image)}`, window.location.href).href;

function creditsFromApi(details) {
  return Object.entries(details.main_credits ?? {}).flatMap(([role, people]) =>
    (people ?? []).map((person) => `${person.name}${person.employer ? ` (${person.employer})` : ''} — ${role}`),
  ).join('; ');
}

function datasetsFromApi(details) {
  return (details.datasets ?? []).map((dataset) => ({
    ...dataset,
    url: dataset.url ? secureUrl(dataset.url) : '',
  }));
}

function videoFromApi(details) {
  const groups = details.media_groups ?? [];
  const context = stripHtml(`${details.title ?? ''} ${details.description ?? ''} ${groups.map((group) => group.description ?? '').join(' ')}`);
  if (!/\b3d\b|three-dimensional|three dimensional/i.test(context)) return null;
  const videoGroup = groups.find((group) => /non-narrated/i.test(stripHtml(group.description)) &&
    (group.items ?? []).some(({ instance }) => instance?.media_type === 'Movie'));
  if (!videoGroup) return null;

  const media = (videoGroup.items ?? []).map(({ instance }) => instance).filter((instance) =>
    instance?.media_type === 'Movie' && /\.(mp4|webm)$/i.test(instance.filename ?? ''),
  );
  media.sort((a, b) => {
    const aHd = a.width === 1920 ? 0 : 1;
    const bHd = b.width === 1920 ? 0 : 1;
    const aWebm = /\.webm$/i.test(a.filename) ? 0 : 1;
    const bWebm = /\.webm$/i.test(b.filename) ? 0 : 1;
    return aHd - bHd || aWebm - bWebm;
  });
  if (!media.length) return null;

  const descriptionGroup = groups.find((group) => group.widget === 'Basic text with HTML' &&
    /three-dimensional|water vapor transport|MERRA-2/i.test(stripHtml(group.description)));
  return {
    source: secureUrl(media[0].url),
    filename: media[0].filename,
    description: descriptionGroup ? stripHtml(descriptionGroup.description) : stripHtml(videoGroup.description),
  };
}

// Ficha de NASA → elemento de la playlist.
function toItem(details, image, imageUrl, extra = {}) {
  const description = cleanDescription(details.description);
  return {
    id: details.id,
    title: details.title,
    theme: asList(details.nasa_science_categories).join(', '),
    description: description || details.title,
    altText: stripHtml(image.alt_text) || description || details.title,
    image: imageUrl,
    imageApiUrl: secureUrl(image.url),
    nasaUrl: secureUrl(details.url),
    apiUrl: `${API_BASE}${details.id}/`,
    pageType: details.page_type ?? '',
    categories: asList(details.nasa_science_categories),
    releaseDate: details.release_date ?? '',
    updateDate: details.update_date ?? '',
    variables: asList(details.variables ?? details.parameters),
    units: details.units ?? details.unit ?? '',
    period: details.date_range ?? details.time_range ?? '',
    keywords: asList(details.keywords),
    credit: creditsFromApi(details),
    datasets: datasetsFromApi(details),
    sonificationType: details.page_type ?? 'visual-features',
    originalImage: { filename: image.filename, width: image.width, height: image.height },
    video: videoFromApi(details),
    snapshotDate: null,
    ...extra,
  };
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error('Respuesta no JSON (¿sin proxy?)');
  return res.json();
}

let snapshotRequest = null;
function loadSnapshot() {
  snapshotRequest ??= fetch(`${import.meta.env.BASE_URL}data/svs-snapshot.json`).then((res) => {
    if (!res.ok) throw new Error(`Copia de la API: HTTP ${res.status}`);
    return res.json();
  });
  return snapshotRequest;
}

// Ficha de una pieza: en vivo si hay proxy; si no, la copia guardada.
async function getDetails(id) {
  try {
    return { details: await getJson(`/api/${id}/`), snapshotDate: null };
  } catch (error) {
    const snapshot = await loadSnapshot().catch(() => null);
    const saved = snapshot?.items?.[id];
    if (!saved) throw error;
    return { details: saved, snapshotDate: snapshot.generatedAt };
  }
}

function confirmImageLoads(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => {
      image.src = '';
      reject(new Error(`Tiempo de espera al cargar ${src}`));
    }, 20000);
    image.onload = () => { clearTimeout(timeout); resolve(); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error(`No cargó la imagen ${src}`)); };
    image.decoding = 'async';
    image.src = src;
  });
}

async function resolveImageUrl(id, image) {
  const localUrl = localImageUrl(id, image);
  try {
    await confirmImageLoads(localUrl);
    return localUrl;
  } catch {
    const apiAssetUrl = proxied(image.url);
    await confirmImageLoads(apiAssetUrl);
    return apiAssetUrl;
  }
}

export async function fetchCuratedImages() {
  const results = await Promise.allSettled(CURATED_IDS.map(async (id) => {
    const { details, snapshotDate } = await getDetails(id);
    const image = curatedImage(details);
    if (!image) throw new Error(`La API ${id} no contiene una imagen fija`);
    return toItem(details, image, await resolveImageUrl(id, image), { snapshotDate });
  }));
  const items = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [result.value];
    console.warn(`No se pudo cargar la API NASA ${CURATED_IDS[index]}:`, result.reason);
    return [];
  });
  if (!items.length) throw new Error('NASA SVS no devolvió ninguna imagen del catálogo curado');
  return {
    items,
    failedIds: results.flatMap((result, index) => result.status === 'rejected' ? [CURATED_IDS[index]] : []),
    snapshotDate: items.find((item) => item.snapshotDate)?.snapshotDate ?? null,
  };
}

async function searchTheme(query, exclude, perQuery) {
  const data = await getJson(`/api/search/?search=${encodeURIComponent(query.q)}&limit=20`);
  const found = [];
  for (const r of data.results ?? []) {
    if (found.length >= perQuery) break;
    if (!matchesQuery(r, query, exclude)) continue;
    const d = await getJson(`/api/${r.id}/`);
    if (!isEarthScience(d)) continue;
    const img = catalogImage(d);
    if (!img) continue;
    exclude.add(d.id);
    found.push(toItem(d, img, proxied(img.url), { live: true }));
  }
  return found;
}

async function searchLive(exclude, perQuery) {
  const seen = new Set(exclude);
  // Una búsqueda por consulta en paralelo; dentro de cada una, detalles en serie.
  const results = await Promise.allSettled(LIVE_QUERIES.map((q) => searchTheme(q, seen, perQuery)));
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return [...new Map(all.map((i) => [i.id, i])).values()]; // sin duplicados
}

// La misma búsqueda, hecha por scripts/fetch-images.mjs al desplegar, con sus imágenes
// copiadas en public/images (mismo origen: se pueden analizar).
async function catalogFromSnapshot(exclude) {
  const snapshot = await loadSnapshot();
  const ids = (snapshot.catalog ?? []).filter((id) => !exclude.includes(id) && snapshot.items?.[id]);
  const results = await Promise.allSettled(ids.map(async (id) => {
    const details = snapshot.items[id];
    const image = details.main_image;
    const url = localImageUrl(id, image);
    await confirmImageLoads(url);
    return toItem(details, image, url, { live: true, snapshotDate: snapshot.generatedAt });
  }));
  return {
    items: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    snapshotDate: snapshot.generatedAt,
  };
}

// Devuelve { items, snapshotDate }: snapshotDate es null si la búsqueda fue en vivo.
export async function fetchCatalog({ exclude = [], perQuery = LIVE_PER_QUERY } = {}) {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // sessionStorage puede no estar disponible: seguimos sin caché
  }
  let result = { items: await searchLive(exclude, perQuery), snapshotDate: null };
  if (!result.items.length) result = await catalogFromSnapshot(exclude);
  if (!result.items.length) throw new Error('El catálogo en vivo no devolvió resultados');
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // sin caché
  }
  return result;
}
