// Interfaz tipo rocola: pantalla con imagen + cuadrícula, anterior / reproducir / siguiente,
// menú de temas que filtra la playlist, modo, volumen, tempo y narración.

import { loadImage, processImage } from '../processing/image-processor.js';
import { computeFeatures } from '../analysis/features.js';
import * as engine from '../audio/audio-engine.js';
import { createGrid } from '../visualization/grid-renderer.js';
import * as narrator from '../accessibility/narrator.js';
import { fetchCatalog, fetchCuratedImages } from '../api/nasa-api.js';
import * as avatar from './earth-avatar.js';

const $ = (id) => document.getElementById(id);
const THEME_ORDER = ['clima', 'temperatura', 'océanos', 'hielo', 'vegetación', 'espacio'];
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createJukebox(initialPlaylist) {
  const playlist = [...initialPlaylist]; // crece si se carga el catálogo en vivo
  const el = {
    art: $('art'),
    label: $('now-label'),
    title: $('now-title'),
    theme: $('now-theme'),
    status: $('status'),
    play: $('btn-play'),
    prev: $('btn-prev'),
    next: $('btn-next'),
    themes: $('theme-filter'),
    albums: $('album-list'),
    desc: $('image-desc'),
    summary: $('image-summary'),
    link: $('nasa-link'),
    cell: $('cell-info'),
    volume: $('volume'),
    volumeOut: $('volume-out'),
    tempo: $('tempo'),
    tempoOut: $('tempo-out'),
    soundStyle: $('sound-style'),
    narration: $('btn-narration'),
    motion: $('btn-motion'),
    live: $('btn-live'),
    liveStatus: $('live-status'),
    modes: document.querySelectorAll('input[name="mode"]'),
  };

  const state = {
    filter: 'todos',
    items: playlist,
    current: null,
    mode: 'auto',
    cache: new Map(),
    loadToken: 0,
    loading: false,
    playWhenReady: false,
  };

  // --- Anuncios (aria-live) y narración ------------------------------------
  let statusTimer = null;
  function announce(text) {
    // Vaciar y reescribir asegura que el lector repita mensajes iguales.
    clearTimeout(statusTimer);
    el.status.textContent = '';
    statusTimer = setTimeout(() => (el.status.textContent = text), 50);
  }

  function narrate(text) {
    narrator.speak(text, { onStart: () => engine.duck(true), onEnd: () => engine.duck(false) });
  }

  // --- Cuadrícula ------------------------------------------------------------
  const grid = createGrid($('grid'), {
    onActivate: (cell) => {
      if (!state.loading) listenCell(cell);
    },
    onMove: (cell) => {
      if (state.loading) return;
      showCell(cell);
      if (state.mode === 'explore') engine.playCell(cell);
    },
    onToggle: () => togglePlay(),
  });

  function showCell(cell) {
    el.cell.textContent = cell.description;
  }

  function listenCell(cell) {
    engine.playCell(cell);
    showCell(cell);
    announce(cell.description);
    // Con narración activa, también se lee en voz alta (útil sin lector de pantalla).
    if (!engine.isPlaying()) narrate(cell.description);
  }

  engine.setHandlers({
    onCell: (cell) => {
      grid.highlight(cell);
      showCell(cell);
      avatar.reactToCell(cell);
    },
    onEnd: () => {
      grid.highlight(null);
      setPlayingUI(false);
      announce('Fin de la pieza. Pulsa Reproducir para escucharla otra vez.');
    },
  });

  // --- Reproducción ----------------------------------------------------------
  function setPlayingUI(playing) {
    el.play.classList.toggle('is-playing', playing);
    el.albums.classList.toggle('is-playing', playing); // el vinilo del álbum actual gira
    avatar.setPlaying(playing);
    el.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    el.label.textContent = playing ? 'Sonando' : 'Seleccionada';
  }

  async function play() {
    if (state.mode !== 'auto') setMode('auto', { silent: true });
    await engine.play();
    setPlayingUI(true);
  }

  async function togglePlay() {
    if (!state.current) return;
    if (state.loading) {
      // Aún se analiza la imagen: arrancará en cuanto esté lista.
      state.playWhenReady = !state.playWhenReady;
      setPlayingUI(state.playWhenReady);
      announce(state.playWhenReady ? 'Cargando la imagen; sonará en cuanto esté lista.' : 'Pausado.');
      return;
    }
    if (engine.isPlaying()) {
      engine.pause();
      setPlayingUI(false);
      announce('Pausado.');
    } else {
      await play();
      announce(`Reproduciendo ${state.current.title}.`);
    }
  }

  function setMode(mode, { silent = false } = {}) {
    state.mode = mode;
    for (const input of el.modes) input.checked = input.value === mode;
    if (mode === 'explore' && engine.isPlaying()) {
      engine.pause();
      setPlayingUI(false);
    }
    grid.highlight(null);
    if (silent) return;
    announce(
      mode === 'explore'
        ? 'Modo exploración: entra en la cuadrícula y muévete con las flechas; cada celda suena al instante.'
        : 'Modo automático: pulsa Reproducir para recorrer la imagen de izquierda a derecha.',
    );
  }

  // --- Selección de imagen ---------------------------------------------------
  async function analyze(item) {
    if (state.cache.has(item.id)) return state.cache.get(item.id);
    const analysis = computeFeatures(processImage(await loadImage(item.image)));
    state.cache.set(item.id, analysis);
    return analysis;
  }

  async function selectItem(item, { speak = true } = {}) {
    state.playWhenReady = state.playWhenReady || engine.isPlaying();
    engine.stop();
    grid.highlight(null);
    const token = ++state.loadToken;
    state.current = item;
    state.loading = true;
    $('grid').setAttribute('aria-busy', 'true');

    el.title.textContent = item.title;
    el.theme.textContent = capitalize(item.theme);
    el.theme.dataset.theme = item.theme;
    el.art.src = item.image;
    el.art.alt = item.altText;
    el.desc.textContent = item.description;
    el.summary.textContent = 'Analizando la imagen…';
    el.link.href = item.nasaUrl;
    renderAlbums();

    try {
      const analysis = await analyze(item);
      if (token !== state.loadToken) return; // el usuario ya eligió otra
      engine.setAnalysis(analysis);
      grid.render(analysis);
      el.summary.textContent = analysis.summary;
      el.cell.textContent = 'Elige una celda con el ratón o con las flechas del teclado.';
      announce(`Imagen cargada: ${item.title}.`);
      if (speak) narrate(`${item.title}. ${analysis.summary}`);
      finishLoading();
      if (state.playWhenReady) await play();
      else setPlayingUI(false);
      state.playWhenReady = false;
    } catch (err) {
      console.error(err);
      if (token !== state.loadToken) return;
      finishLoading();
      state.playWhenReady = false;
      setPlayingUI(false);
      el.summary.textContent = 'No se pudo analizar esta imagen.';
      announce(`No se pudo cargar la imagen ${item.title}.`);
    }
  }

  function finishLoading() {
    state.loading = false;
    $('grid').removeAttribute('aria-busy');
  }

  function step(delta) {
    const list = state.items;
    if (!list.length) return;
    const i = list.indexOf(state.current);
    const next = i === -1 ? (delta > 0 ? 0 : list.length - 1) : (i + delta + list.length) % list.length;
    selectItem(list[next]);
  }

  // --- Menú: temas y álbumes -------------------------------------------------
  function renderThemes() {
    const present = THEME_ORDER.filter((t) => playlist.some((p) => p.theme === t));
    const options = ['todos', ...present];
    el.themes.replaceChildren(
      ...options.map((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-btn';
        b.dataset.theme = t;
        b.textContent = capitalize(t);
        b.setAttribute('aria-pressed', String(t === state.filter));
        b.addEventListener('click', () => setFilter(t));
        return b;
      }),
    );
  }

  function setFilter(theme) {
    state.filter = theme;
    state.items = theme === 'todos' ? playlist : playlist.filter((p) => p.theme === theme);
    for (const b of el.themes.children) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    renderAlbums();
    const n = state.items.length;
    announce(`${capitalize(theme)}: ${n} ${n === 1 ? 'imagen' : 'imágenes'}.`);
  }

  const span = (className, text) => {
    const s = document.createElement('span');
    s.className = className;
    if (text) s.textContent = text;
    return s;
  };

  // Cada opción es un "álbum": carátula cuadrada con un vinilo que asoma detrás,
  // número de pista, título, "artista" y tema.
  function renderAlbums() {
    el.albums.replaceChildren(
      ...state.items.map((item, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'album';
        b.dataset.theme = item.theme;
        if (item === state.current) b.setAttribute('aria-current', 'true');

        const art = span('album-art');
        art.setAttribute('aria-hidden', 'true'); // decorativo: la info está en el texto
        const cover = span('album-cover');
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 160;
        img.height = 160;
        cover.append(img, span('album-track', String(i + 1).padStart(2, '0')));
        art.append(span('vinyl'), cover);

        const text = span('album-text');
        text.append(
          span('album-title', item.title),
          span('album-artist', 'NASA SVS'),
          span('theme-chip', capitalize(item.theme) + (item.live ? ' · en vivo' : '')),
        );
        b.append(art, text);
        b.addEventListener('click', () => selectItem(item));
        li.append(b);
        return li;
      }),
    );
  }

  // --- Controles ---------------------------------------------------------------
  el.play.addEventListener('click', togglePlay);
  el.prev.addEventListener('click', () => step(-1));
  el.next.addEventListener('click', () => step(1));
  for (const input of el.modes) input.addEventListener('change', () => setMode(input.value));

  // Solo estilo: la parte rellena del deslizador (variable --fill en main.css).
  const paintRange = (input) =>
    input.style.setProperty('--fill', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);

  el.volume.addEventListener('input', () => {
    engine.setVolume(el.volume.value / 100);
    el.volumeOut.textContent = `${el.volume.value} %`;
    paintRange(el.volume);
  });
  el.tempo.addEventListener('input', () => {
    engine.setTempo(+el.tempo.value);
    el.tempoOut.textContent = `${el.tempo.value} bpm`;
    paintRange(el.tempo);
  });
  paintRange(el.volume);
  paintRange(el.tempo);

  el.soundStyle.addEventListener('change', () => {
    engine.setSoundStyle(el.soundStyle.value);
    const styleName = el.soundStyle.selectedOptions[0].textContent;
    const arrangements = {
      ambiental: 'notas sostenidas',
      clasica: 'acordes de acompañamiento',
      electronica: 'pulsos rítmicos',
    };
    announce(`Género ${styleName}: ${arrangements[el.soundStyle.value]}. Se conserva el motivo y el mapeo de la imagen.`);
  });

  // Nombre accesible fijo ("Narración") + aria-pressed; el estado visible va en un
  // span oculto al lector para que no se anuncie dos veces.
  function renderNarration() {
    if (!narrator.isSupported()) {
      el.narration.textContent = 'Narración no disponible';
      el.narration.disabled = true;
      el.narration.removeAttribute('aria-pressed');
      return;
    }
    const on = narrator.isEnabled();
    el.narration.setAttribute('aria-pressed', String(on));
    const state = document.createElement('span');
    state.setAttribute('aria-hidden', 'true');
    state.textContent = on ? ': activada' : ': desactivada';
    el.narration.replaceChildren('Narración', state);
  }
  el.narration.addEventListener('click', () => {
    narrator.setEnabled(!narrator.isEnabled());
    renderNarration();
    engine.duck(false);
    announce(narrator.isEnabled() ? 'Narración activada.' : 'Narración desactivada.');
  });

  // "Pausar animación" (WCAG 2.2.2): congela el avatar y las demás animaciones
  // decorativas sin tocar el audio. Nombre fijo + aria-pressed, como Narración.
  el.motion.addEventListener('click', () => {
    const paused = el.motion.getAttribute('aria-pressed') !== 'true';
    el.motion.setAttribute('aria-pressed', String(paused));
    document.documentElement.classList.toggle('motion-paused', paused);
    avatar.setFrozen(paused);
    announce(paused ? 'Animación pausada.' : 'Animación reanudada.');
  });

  // --- Catálogo en vivo (opcional) ------------------------------------------------
  el.live.addEventListener('click', async () => {
    el.live.disabled = true;
    el.liveStatus.textContent = 'Buscando visualizaciones en NASA SVS…';
    announce('Buscando visualizaciones en NASA SVS.');
    try {
      const items = await fetchCatalog({ exclude: playlist.map((p) => p.id) });
      const fresh = items.filter((i) => !playlist.some((p) => p.id === i.id));
      playlist.push(...fresh);
      setFilter(state.filter);
      const msg = `Se ${fresh.length === 1 ? 'añadió 1 visualización' : `añadieron ${fresh.length} visualizaciones`} del catálogo en vivo (textos originales en inglés).`;
      el.liveStatus.textContent = msg;
      announce(msg);
      el.live.hidden = true;
    } catch (err) {
      console.warn('Catálogo en vivo no disponible:', err);
      const msg = 'El catálogo en vivo no está disponible ahora; seguimos con la lista curada.';
      el.liveStatus.textContent = msg;
      announce(msg);
      el.live.disabled = false;
    }
  });

  // --- Inicio (sin sonido: el audio solo empieza tras una acción del usuario) ---
  avatar.mountEarthAvatar($('earth-avatar'));
  engine.setVolume(el.volume.value / 100);
  engine.setTempo(+el.tempo.value);
  renderNarration();
  renderThemes();
  // Primero deja utilizable la playlist local. Después intenta añadir las diez
  // carátulas oficiales desde sus API; si la red falla, la rocola local continúa.
  return (async () => {
    if (playlist.length) await selectItem(playlist[0], { speak: false });
    try {
      el.liveStatus.textContent = 'Cargando imágenes oficiales de NASA SVS…';
      const { items: images, failedIds } = await fetchCuratedImages();
      const fresh = images.filter((item) => !playlist.some((existing) => existing.id === item.id));
      playlist.push(...fresh);
      setFilter(state.filter);
      renderThemes();
      const loadedMessage = `${fresh.length} imágenes de las API de NASA cargadas y añadidas a la rocola.`;
      const message = failedIds.length
        ? `${loadedMessage} No cargaron las imágenes ${failedIds.join(', ')}.`
        : loadedMessage;
      el.liveStatus.textContent = message;
      if (fresh.length) await selectItem(fresh[0], { speak: false });
      announce(message);
    } catch (err) {
      console.warn('No se pudo cargar el catálogo curado NASA:', err);
      el.liveStatus.textContent = 'Las imágenes de NASA no están disponibles ahora; seguimos con las imágenes locales.';
      announce('No se pudieron cargar las imágenes NASA. Sigue disponible la colección local.');
    }
  })();
}
