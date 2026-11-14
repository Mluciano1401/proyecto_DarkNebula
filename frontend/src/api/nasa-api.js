// Catálogo en vivo desde la NASA SVS API (búsqueda + detalles), filtrando la categoría
// "Earth". Va por el proxy /svs (SVS no permite CORS a otros dominios); si falla,
// la app sigue con la playlist local.

const BASE = '/svs';
const CACHE_KEY = 'svs-catalog-v2';
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
