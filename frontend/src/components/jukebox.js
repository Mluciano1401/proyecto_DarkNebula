// Interfaz tipo rocola: pantalla con imagen + cuadrícula, anterior / reproducir / siguiente,
// menú de temas que filtra la playlist, modo, volumen, tempo y narración.

import { loadImage, processImage } from '../processing/image-processor.js';
import { computeFeatures } from '../analysis/features.js';
import * as engine from '../audio/audio-engine.js';
import { createGrid } from '../visualization/grid-renderer.js';
import * as narrator from '../accessibility/narrator.js';

const $ = (id) => document.getElementById(id);
const THEME_ORDER = ['clima', 'temperatura', 'océanos', 'hielo', 'vegetación'];
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createJukebox(playlist) {
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
    narration: $('btn-narration'),
    modes: document.querySelectorAll('input[name="mode"]'),
  };

  const state = {
    filter: 'todos',
    items: playlist,
    current: null,
    mode: 'auto',
    cache: new Map(),
    loadToken: 0,
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
    onActivate: (cell) => listenCell(cell),
    onMove: (cell) => {
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
  }

  engine.setHandlers({
    onCell: (cell) => {
      grid.highlight(cell);
      showCell(cell);
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
    const wasPlaying = engine.isPlaying();
    engine.stop();
    grid.highlight(null);
    const token = ++state.loadToken;
    state.current = item;

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
      engine.setAnalysis(analysis, item.theme);
      grid.render(analysis);
      el.summary.textContent = analysis.summary;
      el.cell.textContent = 'Elige una celda con el ratón o con las flechas del teclado.';
      announce(`Imagen cargada: ${item.title}.`);
      if (speak) narrate(`${item.title}. ${analysis.summary}`);
      if (wasPlaying) await play();
      else setPlayingUI(false);
    } catch (err) {
      console.error(err);
      el.summary.textContent = 'No se pudo analizar esta imagen.';
      announce(`No se pudo cargar la imagen ${item.title}.`);
    }
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

  function renderAlbums() {
    el.albums.replaceChildren(
      ...state.items.map((item) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'album';
        if (item === state.current) b.setAttribute('aria-current', 'true');
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        img.width = 96;
        img.height = 54;
        const text = document.createElement('span');
        text.className = 'album-text';
        const title = document.createElement('span');
        title.className = 'album-title';
        title.textContent = item.title;
        const theme = document.createElement('span');
        theme.className = 'theme-chip';
        theme.dataset.theme = item.theme;
        theme.textContent = capitalize(item.theme);
        text.append(title, theme);
        b.append(img, text);
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

  el.volume.addEventListener('input', () => {
    engine.setVolume(el.volume.value / 100);
    el.volumeOut.textContent = `${el.volume.value} %`;
  });
  el.tempo.addEventListener('input', () => {
    engine.setTempo(+el.tempo.value);
    el.tempoOut.textContent = `${el.tempo.value} bpm`;
  });

  function renderNarration() {
    const on = narrator.isEnabled();
    el.narration.setAttribute('aria-pressed', String(on));
    el.narration.textContent = narrator.isSupported()
      ? `Narración: ${on ? 'activada' : 'desactivada'}`
      : 'Narración no disponible';
    el.narration.disabled = !narrator.isSupported();
  }
  el.narration.addEventListener('click', () => {
    narrator.setEnabled(!narrator.isEnabled());
    renderNarration();
    engine.duck(false);
    announce(narrator.isEnabled() ? 'Narración activada.' : 'Narración desactivada.');
  });

  // --- Inicio (sin sonido: el audio solo empieza tras una acción del usuario) ---
  engine.setVolume(el.volume.value / 100);
  engine.setTempo(+el.tempo.value);
  renderNarration();
  renderThemes();
  if (playlist.length) selectItem(playlist[0], { speak: false });
}
