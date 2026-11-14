// Catálogo desde NASA SVS. La ficha, imagen y metadatos se leen del API por el
// proxy /svs para servir la imagen desde el mismo origen y poder analizarla.

import sourceSelection from '../data/source-catalog.json';

const BASE = '/svs';
const API_ROOT = sourceSelection.apiBase;
const CURATED_IDS = sourceSelection.sourceIds;
const CACHE_KEY = 'svs-catalog-v3';
// `match`: el título debe contener alguna de estas palabras (la búsqueda de SVS es amplia).
const QUERIES = [
  { q: 'sea surface temperature', match: /temperature/i },
  { q: 'global temperature', match: /temperature/i },
  { q: 'sea ice', match: /\bice\b|glacier|snow/i },
  { q: 'ocean', match: /ocean|\bsea\b|marine/i },
  { q: 'vegetation', match: /vegetation|forest|plant|green|crop/i },
  { q: 'precipitation', match: /precipitation|rain|storm|hurricane|typhoon|cloud/i },
];

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cleanDescription = (s) => stripHtml(s).split(' || ')[0];
const proxied = (url) => url.replace(/^https?:\/\/svs\.gsfc\.nasa\.gov/, BASE);
const secureUrl = (url = '') => url.replace(/^http:\/\//, 'https://');
const asList = (value) => Array.isArray(value) ? value : value ? [String(value)] : [];

const themeFromApi = (details) => asList(details.nasa_science_categories).join(', ');

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

// Copia de las respuestas de la API que guarda scripts/fetch-images.mjs. Se usa cuando
// no hay proxy /svs (GitHub Pages es estático y SVS solo permite CORS a otro dominio).
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

function apiImage(details) {
  const images = [details.main_image, ...(details.media_groups ?? []).flatMap((g) => (g.items ?? []).map((item) => item.instance))];
  return images.find((i) => i?.media_type === 'Image' && i.url && /\.(jpe?g|png)$/i.test(i.filename) && !/legend|color.?bar|_bar/i.test(i.filename)) ?? null;
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
  const extension = image.filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
  const localUrl = new URL(`${import.meta.env.BASE_URL}images/${id}.${extension}`, window.location.href).href;
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
    const image = apiImage(details);
    if (!image) throw new Error(`La API ${id} no contiene una imagen fija`);
    const description = cleanDescription(details.description);
    const apiUrl = `${API_ROOT}${id}/`;
    const item = {
      id: details.id,
      title: details.title,
      theme: themeFromApi(details),
      description,
      altText: stripHtml(image.alt_text) || description || details.title,
      image: await resolveImageUrl(id, image),
      imageApiUrl: secureUrl(image.url),
      nasaUrl: secureUrl(details.url),
      apiUrl,
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
      snapshotDate,
    };
    await confirmImageLoads(item.image);
    return item;
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

// Misma regla que scripts/fetch-images.mjs: imagen apaisada de 800–2048 px.
const isMedium = (i) =>
  i && /\.(jpe?g|png)$/i.test(i.filename) && i.width >= 800 && i.width <= 2048 && i.width / i.height >= 1.3;

function pickImage(details) {
  if (isMedium(details.main_image)) return details.main_image;
  const others = (details.media_groups ?? [])
    .flatMap((g) => g.items ?? [])
    .map((it) => it.instance)
    .filter((i) => i?.media_type === 'Image' && isMedium(i) && !/^legend|colorbar|bar\d|_bar/i.test(i.filename));
  others.sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024));
  return others[0] ?? null;
}

async function searchTheme({ q, match }, exclude, perQuery) {
  const data = await getJson(`/api/search/?search=${encodeURIComponent(q)}&limit=20`);
  const found = [];
  for (const r of data.results ?? []) {
    if (found.length >= perQuery) break;
    if (r.result_type !== 'Visualization' || exclude.has(r.id) || !match.test(r.title)) continue;
    const d = await getJson(`/api/${r.id}/`);
    if (!(d.nasa_science_categories ?? []).includes('Earth')) continue;
    const img = pickImage(d);
    if (!img) continue;
    exclude.add(d.id);
    const description = cleanDescription(d.description);
    found.push({
      id: d.id,
      title: d.title,
      theme: themeFromApi(d),
      description: description || d.title,
      altText: stripHtml(img.alt_text) || description || d.title,
      image: proxied(img.url),
      imageApiUrl: secureUrl(img.url),
      nasaUrl: secureUrl(d.url),
      apiUrl: `${API_ROOT}${d.id}/`,
      pageType: d.page_type ?? '',
      categories: asList(d.nasa_science_categories),
      releaseDate: d.release_date ?? '',
      updateDate: d.update_date ?? '',
      variables: asList(d.variables ?? d.parameters),
      units: d.units ?? d.unit ?? '',
      period: d.date_range ?? d.time_range ?? '',
      keywords: asList(d.keywords),
      credit: creditsFromApi(d),
      datasets: datasetsFromApi(d),
      live: true,
    });
  }
  return found;
}

export async function fetchCatalog({ exclude = [], perQuery = 1 } = {}) {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // sessionStorage puede no estar disponible: seguimos sin caché
  }
  const seen = new Set(exclude);
  // Una búsqueda por consulta en paralelo; dentro de cada una, detalles en serie.
  const results = await Promise.allSettled(QUERIES.map((q) => searchTheme(q, seen, perQuery)));
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const items = [...new Map(all.map((i) => [i.id, i])).values()]; // sin duplicados
  if (!items.length) throw new Error('El catálogo en vivo no devolvió resultados');
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // sin caché
  }
  return items;
}
