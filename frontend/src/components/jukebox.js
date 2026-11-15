// Interfaz tipo rocola: pantalla con imagen + cuadrícula, anterior / reproducir / siguiente,
// menú de temas que filtra la playlist, modo, volumen, tempo, narración e idioma.

import { loadImage, processImage, processVideoFrames } from '../processing/image-processor.js';
import { computeFeatures, describeCell, relabel } from '../analysis/features.js';
import * as engine from '../audio/audio-engine.js';
import { createGrid } from '../visualization/grid-renderer.js';
import * as narrator from '../accessibility/narrator.js';
import { fetchCatalog, fetchCuratedImages } from '../api/nasa-api.js';
import { getLang, onLangChange, setLang, setPlainText, setText, t } from '../i18n/i18n.js';
import * as avatar from './earth-avatar.js';

const $ = (id) => document.getElementById(id);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Los textos de NASA llegan en inglés; las etiquetas, en el idioma de la interfaz.
const nasaInfoText = (item) => [
  t('info.note'),
  item.description,
  item.pageType && t('info.type', { v: item.pageType }),
  item.categories?.length && t('info.category', { v: item.categories.join(', ') }),
  item.variables?.length && t('info.variables', { v: item.variables.join(', ') }),
  item.units && t('info.units', { v: item.units }),
  item.period && t('info.period', { v: item.period }),
  item.releaseDate && t('info.released', { v: item.releaseDate }),
  item.updateDate && t('info.updated', { v: item.updateDate }),
  item.datasets?.length && t('info.datasets', { v: item.datasets.map((dataset) => [dataset.name, dataset.common_name, dataset.platform, dataset.sensor, dataset.description, dataset.date_range].filter(Boolean).join(' — ')).join('; ') }),
  item.video?.frameCount && t('info.videoVisual', { n: item.video.frameCount }),
  item.keywords?.length && t('info.keywords', { v: item.keywords.join(', ') }),
  item.credit && t('info.credits', { v: item.credit }),
].filter(Boolean).join('\n\n');

export function createJukebox(initialPlaylist = []) {
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
    apiLink: $('api-link'),
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
    langButtons: document.querySelectorAll('#lang-switch [data-lang]'),
    modes: document.querySelectorAll('.mode-button[data-mode]'),
  };

  const state = {
    filter: 'todos',
    items: playlist,
    current: null,
    analysis: null,
    mode: 'auto',
    cache: new Map(),
    loadToken: 0,
    loading: false,
    playWhenReady: false,
    uiPlaying: false,
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
    setText(el.cell, () => describeCell(cell));
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
      announce(t('status.end'));
    },
  });

  // --- Reproducción ----------------------------------------------------------
  function setPlayingUI(playing) {
    state.uiPlaying = playing;
    el.play.classList.toggle('is-playing', playing);
    el.albums.classList.toggle('is-playing', playing); // el vinilo del álbum actual gira
    avatar.setPlaying(playing);
    el.play.setAttribute('aria-label', t(playing ? 'play.pause' : 'play.play'));
    setText(el.label, playing ? 'now.playing' : 'now.selected');
  }

  async function play() {
    if (state.mode !== 'auto') setMode('auto', { silent: true });
    await engine.play();
    setPlayingUI(true);
  }

  async function togglePlay() {
    // Dentro del gesto: si la música arranca después de cargar, el audio ya está desbloqueado.
    engine.unlockAudio();
    if (!state.current || state.loading) {
      // Aún se analiza la imagen: arrancará en cuanto esté lista.
      state.playWhenReady = !state.playWhenReady;
      setPlayingUI(state.playWhenReady);
      announce(t(state.playWhenReady ? 'status.queued' : 'status.paused'));
      return;
    }
    if (engine.isPlaying()) {
      engine.pause();
      setPlayingUI(false);
      announce(t('status.paused'));
    } else {
      // Pulsar Reproducir corta la narración en curso; si no, la música sonaría atenuada
      // (bajada para dejar oír la voz) durante toda la lectura de la descripción.
      narrator.cancel();
      await play();
      announce(t('status.playing', { title: state.current.title }));
    }
  }

  function setMode(mode, { silent = false } = {}) {
    state.mode = mode;
    for (const button of el.modes) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    if (mode === 'explore' && engine.isPlaying()) {
      engine.pause();
      setPlayingUI(false);
    }
    grid.highlight(null);
    // Entrar al modo exploración debe llevar directamente a la cuadrícula.
    // Desde la celda activa, las flechas recorren la imagen y Tab sale de ella.
    if (mode === 'explore') grid.focusActive();
    if (silent) return;
    announce(t(mode === 'explore' ? 'status.modeExplore' : 'status.modeAuto'));
  }

  // --- Selección de imagen ---------------------------------------------------
  async function analyze(item) {
    if (state.cache.has(item.id)) {
      const cached = state.cache.get(item.id);
      cached.analysis = relabel(cached.analysis);
      return cached;
    }

    if (item.video) {
      const manifestUrl = new URL(`${import.meta.env.BASE_URL}data/video-frames/${item.id}.json`, window.location.href);
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`No se encontraron los fotogramas sonificables del video NASA ${item.id}`);
      const manifest = await response.json();
      if (!Array.isArray(manifest.frames) || !manifest.frames.length) throw new Error('La secuencia no contiene fotogramas sin texto');
      const frames = await Promise.all(manifest.frames.map(async (frame) => ({
        image: await loadImage(new URL(`${import.meta.env.BASE_URL}video-frames/${item.id}/${frame.file}`, window.location.href).href),
        time: frame.timeSeconds,
      })));
      const analysis = computeFeatures(processVideoFrames(frames.map(({ image }) => image)));
      analysis.videoFrameCount = frames.length;
      item.video.frameCount = frames.length;
      const middle = frames[Math.floor(frames.length / 2)];
      const result = {
        analysis,
        previewUrl: middle.image.src,
        previewAlt: t('video.frameAlt', { title: item.title, time: formatVideoTime(middle.time) }),
      };
      state.cache.set(item.id, result);
      return result;
    }

    const result = {
      analysis: computeFeatures(processImage(await loadImage(item.image))),
      previewUrl: item.image,
      previewAlt: item.altText,
    };
    state.cache.set(item.id, result);
    return result;
  }

  function formatVideoTime(seconds) {
    const value = Math.round(seconds);
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  async function selectItem(item, { speak = true } = {}) {
    state.playWhenReady = state.playWhenReady || engine.isPlaying();
    engine.stop();
    grid.highlight(null);
    const token = ++state.loadToken;
    state.current = item;
    state.analysis = null;
    state.loading = true;
    $('grid').setAttribute('aria-busy', 'true');

    setPlainText(el.title, item.title);
    el.title.lang = 'en'; // título original de NASA
    el.theme.textContent = item.theme ? capitalize(item.theme) : '';
    el.theme.dataset.theme = item.theme;
    el.art.src = item.image;
    el.art.alt = item.altText;
    setText(el.desc, () => nasaInfoText(item));
    setText(el.summary, 'status.analyzing');
    el.link.href = item.nasaUrl;
    el.apiLink.href = item.apiUrl;
    renderAlbums();

    try {
      const result = await analyze(item);
      if (token !== state.loadToken) return; // el usuario ya eligió otra
      const analysis = result.analysis;
      state.analysis = analysis;
      el.art.src = result.previewUrl;
      el.art.alt = result.previewAlt;
      if (item.video) setText(el.desc, () => nasaInfoText(item));
      engine.setAnalysis(analysis);
      grid.render(analysis);
      setText(el.summary, () => relabel(analysis).summary);
      setText(el.cell, 'cell.prompt');
      announce(t('status.loaded', { title: item.title }));
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
      setText(el.summary, item.video ? 'status.framesUnavailable' : 'status.analyzeFailed');
      announce(item.video ? t('status.framesUnavailable') : t('status.loadFailed', { title: item.title }));
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
    // Siguiente/Anterior cambian de pieza; no reanudan la música anterior.
    state.playWhenReady = false;
    engine.stop();
    setPlayingUI(false);
    selectItem(list[next]);
  }

  // --- Menú: temas y álbumes -------------------------------------------------
  const themeLabel = (theme) => (theme === 'todos' ? t('themes.all') : capitalize(theme));

  function renderThemes() {
    const present = [...new Set(playlist.map((item) => item.theme).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const options = ['todos', ...present];
    el.themes.replaceChildren(
      ...options.map((theme) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-btn';
        b.dataset.theme = theme;
        b.textContent = themeLabel(theme);
        b.setAttribute('aria-pressed', String(theme === state.filter));
        b.addEventListener('click', () => setFilter(theme));
        return b;
      }),
    );
  }

  function setFilter(theme) {
    state.filter = theme;
    state.items = theme === 'todos' ? playlist : playlist.filter((p) => p.theme === theme);
    for (const b of el.themes.children) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    renderAlbums();
    announce(t('status.filter', { theme: themeLabel(theme), n: state.items.length }));
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
    const restoreAlbumFocus = el.albums.contains(document.activeElement);
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
        const title = span('album-title', item.title);
        title.lang = 'en'; // título original de NASA
        text.append(
          title,
          span('album-artist', item.credit || ''),
          item.theme ? span('theme-chip', capitalize(item.theme) + (item.live ? t('album.live') : '')) : document.createTextNode(''),
        );
        b.append(art, text);
        b.addEventListener('click', () => selectItem(item));
        li.append(b);
        return li;
      }),
    );
    // selectItem vuelve a dibujar la lista. Si la acción partió de un álbum,
    // conserva el foco en el álbum seleccionado en vez de devolverlo al documento.
    if (restoreAlbumFocus) el.albums.querySelector('[aria-current="true"]')?.focus();
  }

  // --- Controles ---------------------------------------------------------------
  el.play.addEventListener('click', togglePlay);
  el.prev.addEventListener('click', () => step(-1));
  el.next.addEventListener('click', () => step(1));
  for (const button of el.modes) button.addEventListener('click', () => setMode(button.dataset.mode));

  // Solo estilo: la parte rellena del deslizador (variable --fill en main.css).
  const paintRange = (input) =>
    input.style.setProperty('--fill', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);

  el.volume.addEventListener('input', () => {
    engine.setVolume(el.volume.value / 100);
    setText(el.volumeOut, 'volume.value', { v: el.volume.value });
    paintRange(el.volume);
  });
  el.tempo.addEventListener('input', () => {
    engine.setTempo(+el.tempo.value);
    setText(el.tempoOut, 'tempo.value', { v: el.tempo.value });
    paintRange(el.tempo);
  });
  paintRange(el.volume);
  paintRange(el.tempo);

  el.soundStyle.addEventListener('change', () => {
    const style = el.soundStyle.value;
    engine.setSoundStyle(style);
    announce(t('status.style', { name: t(`style.${style}`), arrangement: t(`arrangement.${style}`) }));
  });

  // Nombre accesible fijo ("Narration") + aria-pressed; el estado visible va en un
  // span oculto al lector para que no se anuncie dos veces.
  function renderNarration() {
    if (!narrator.isSupported()) {
      el.narration.textContent = t('narration.unavailable');
      el.narration.disabled = true;
      el.narration.removeAttribute('aria-pressed');
      return;
    }
    const on = narrator.isEnabled();
    el.narration.setAttribute('aria-pressed', String(on));
    const state = document.createElement('span');
    state.setAttribute('aria-hidden', 'true');
    state.textContent = t(on ? 'narration.on' : 'narration.off');
    el.narration.replaceChildren(t('narration.name'), state);
  }
  el.narration.addEventListener('click', () => {
    narrator.setEnabled(!narrator.isEnabled());
    renderNarration();
    engine.duck(false);
    announce(t(narrator.isEnabled() ? 'status.narrationOn' : 'status.narrationOff'));
  });

  // "Pausar animación" (WCAG 2.2.2): congela el avatar y las demás animaciones
  // decorativas sin tocar el audio. Nombre fijo + aria-pressed, como Narración.
  el.motion.addEventListener('click', () => {
    const paused = el.motion.getAttribute('aria-pressed') !== 'true';
    el.motion.setAttribute('aria-pressed', String(paused));
    document.documentElement.classList.toggle('motion-paused', paused);
    avatar.setFrozen(paused);
    announce(t(paused ? 'status.animPaused' : 'status.animResumed'));
  });

  // --- Idioma --------------------------------------------------------------------
  function renderLangSwitch() {
    for (const b of el.langButtons) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  }
  for (const b of el.langButtons) b.addEventListener('click', () => setLang(b.dataset.lang));
  // Lo que se construye en JS se vuelve a generar; los textos ligados con setText y
  // los del HTML (data-i18n) los traduce translateDom().
  onLangChange(() => {
    renderLangSwitch();
    renderThemes();
    renderAlbums();
    renderNarration();
    setPlayingUI(state.uiPlaying);
    if (state.analysis) grid.render(relabel(state.analysis));
    announce(t('lang.changed'));
  });

  // --- Catálogo en vivo (opcional) ------------------------------------------------
  el.live.addEventListener('click', async () => {
    el.live.disabled = true;
    setText(el.liveStatus, 'live.searching');
    announce(t('live.searching'));
    try {
      const { items, snapshotDate } = await fetchCatalog({ exclude: playlist.map((p) => p.id) });
      const fresh = items.filter((i) => !playlist.some((p) => p.id === i.id));
      playlist.push(...fresh);
      renderThemes();
      setFilter(state.filter);
      setText(el.liveStatus, 'live.added', { n: fresh.length, date: snapshotDate });
      announce(t('live.added', { n: fresh.length, date: snapshotDate }));
      el.live.hidden = true;
    } catch (err) {
      console.warn('Catálogo en vivo no disponible:', err);
      setText(el.liveStatus, 'live.unavailable');
      announce(t('live.unavailable'));
      el.live.disabled = false;
    }
  });

  // --- Inicio (sin sonido: el audio solo empieza tras una acción del usuario) ---
  avatar.mountEarthAvatar($('earth-avatar'));
  engine.setVolume(el.volume.value / 100);
  engine.setTempo(+el.tempo.value);
  setText(el.volumeOut, 'volume.value', { v: el.volume.value });
  setText(el.tempoOut, 'tempo.value', { v: el.tempo.value });
  setPlayingUI(false);
  renderLangSwitch();
  renderNarration();
  renderThemes();
  // Los metadatos e imágenes de la colección curada se consultan desde NASA SVS;
  // el proyecto solo conserva la selección de identificadores.
  return (async () => {
    try {
      setText(el.liveStatus, 'curated.loading');
      const { items: images, failedIds, snapshotDate } = await fetchCuratedImages();
      const fresh = images.filter((item) => !playlist.some((existing) => existing.id === item.id));
      playlist.push(...fresh);
      setFilter(state.filter);
      renderThemes();
      // Sin proxy (GitHub Pages) los metadatos vienen de la copia de la API guardada al desplegar.
      const message = () =>
        t('curated.loaded', { n: fresh.length, date: snapshotDate }) +
        (failedIds.length ? t('curated.failed', { ids: failedIds.join(', ') }) : '');
      setText(el.liveStatus, message);
      if (fresh.length) await selectItem(fresh[0], { speak: false });
      announce(message());
    } catch (err) {
      console.warn('No se pudo cargar el catálogo curado NASA:', err);
      state.playWhenReady = false;
      setPlayingUI(false);
      setText(el.liveStatus, 'curated.error');
      setText(el.title, 'curated.unavailableTitle');
      el.title.removeAttribute('lang');
      setText(el.summary, 'curated.error');
      announce(t('curated.error'));
    }
  })();
}
