// Catálogo en vivo desde la NASA SVS API (búsqueda + detalles), filtrando la categoría
// "Earth". Va por el proxy /svs (SVS no permite CORS a otros dominios); si falla,
// la app sigue con la playlist local.

const BASE = '/svs';
const CACHE_KEY = 'svs-catalog-v2';
// Selección curada solicitada para la rocola. API devuelve la carátula oficial;
// el proxy same-origin permite que el canvas lea los píxeles cuando la imagen carga.
const CURATED = [
  { id: 13786, theme: 'espacio', title: 'Caldwell 73: referencia astronómica', altText: 'Imagen de referencia NASA SVS para Caldwell 73. NASA ya publicó una sonificación asociada; esta rocola explora rasgos visuales de la carátula y no representa los datos astronómicos originales.' },
  { id: 5313, theme: 'clima', title: 'Luces nocturnas de la Tierra', altText: 'Mapa de luces nocturnas con cambios entre 2012 y 2023. Los colores de esta imagen renderizada no se interpretan como radiancia calibrada.' },
  { id: 3912, theme: 'océanos', title: 'Corrientes oceánicas y temperatura', altText: 'Mapa global de corrientes superficiales coloreadas según temperatura del mar. Es una imagen renderizada, no los valores numéricos originales.' },
  { id: 5669, theme: 'clima', title: 'Aerosoles GEOS (2025)', altText: 'Visualización de categorías de aerosoles GEOS como sal marina, polvo, humo y sulfatos; los colores no se tratan como concentraciones.' },
  { id: 5533, theme: 'clima', title: 'Calidad del aire: modelos NASA', altText: 'Visualización de capas de calidad del aire. Cada contaminante debe estudiarse por separado y la carátula no aporta sus valores numéricos calibrados.' },
  { id: 5425, theme: 'océanos', title: 'Océano perpetuo: corrientes límite occidentales', altText: 'Visualización de corrientes oceánicas a distintas profundidades. NASA indica que algunos colores se eligieron por apariencia.' },
  { id: 5196, theme: 'clima', title: 'Dióxido de carbono global DYAMOND', altText: 'Representación modelada de dióxido de carbono sobre el globo; no sustituye la cuadrícula numérica original.' },
  { id: 5011, theme: 'clima', title: 'Rayos detectados desde la Estación Espacial', altText: 'Previsualización de eventos de rayos detectados por el sensor LIS desde la Estación Espacial; no es la tabla numérica de eventos.' },
  { id: 4960, theme: 'clima', title: 'Río atmosférico en 3D', altText: 'Visualización tridimensional de humedad, viento, nubes y precipitación. El sombreado no es una escala numérica calibrada.' },
  { id: 4950, theme: 'vegetación', title: 'Altura forestal observada por GEDI', altText: 'Representación de altura relativa GEDI; NASA advierte que la altura está exagerada visualmente.' },
];
// `match`: el título debe contener alguna de estas palabras (la búsqueda de SVS es amplia).
const QUERIES = [
  { q: 'sea surface temperature', theme: 'temperatura', match: /temperature/i },
  { q: 'global temperature', theme: 'temperatura', match: /temperature/i },
  { q: 'sea ice', theme: 'hielo', match: /\bice\b|glacier|snow/i },
  { q: 'ocean', theme: 'océanos', match: /ocean|\bsea\b|marine/i },
  { q: 'vegetation', theme: 'vegetación', match: /vegetation|forest|plant|green|crop/i },
  { q: 'precipitation', theme: 'clima', match: /precipitation|rain|storm|hurricane|typhoon|cloud/i },
];

const stripHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cleanDescription = (s) => stripHtml(s).split(' || ')[0];
const proxied = (url) => url.replace(/^https?:\/\/svs\.gsfc\.nasa\.gov/, BASE);

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

export async function fetchCuratedImages() {
  const results = await Promise.allSettled(CURATED.map(async (entry) => {
    const details = await getJson(`/api/${entry.id}/`);
    const image = apiImage(details);
    if (!image) throw new Error(`La API ${entry.id} no contiene una imagen fija`);
    const description = cleanDescription(details.description);
    const item = {
      id: details.id,
      title: entry.title,
      theme: entry.theme,
      description: `Exploración de características visuales. ${description || details.title} Esta sonificación no representa directamente una medición científica original.`,
      altText: entry.altText,
      image: proxied(image.url),
      nasaUrl: `https://svs.gsfc.nasa.gov/${details.id}/`,
      apiUrl: `https://svs.gsfc.nasa.gov/api/${details.id}/`,
      nasaTitle: details.title,
      credit: 'NASA Scientific Visualization Studio',
      sonificationType: 'visual-features',
      originalImage: { filename: image.filename, width: image.width, height: image.height },
      ...(details.id === 13786 ? { existingNasaSonification: true } : {}),
    };
    await confirmImageLoads(item.image);
    return item;
  }));
  const items = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [result.value];
    console.warn(`No se pudo cargar la API NASA ${CURATED[index].id}:`, result.reason);
    return [];
  });
  if (!items.length) throw new Error('NASA SVS no devolvió ninguna imagen del catálogo curado');
  return {
    items,
    failedIds: results.flatMap((result, index) => result.status === 'rejected' ? [CURATED[index].id] : []),
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

async function searchTheme({ q, theme, match }, exclude, perQuery) {
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
      theme,
      description: description || d.title,
      altText: stripHtml(img.alt_text) || description || d.title,
      image: proxied(img.url),
      nasaUrl: `https://svs.gsfc.nasa.gov/${d.id}/`,
      nasaTitle: d.title,
      credit: 'NASA Scientific Visualization Studio',
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
