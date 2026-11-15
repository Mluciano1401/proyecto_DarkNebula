// Textos de la interfaz en inglés (por defecto) y español. Un valor puede ser una
// cadena o una función que recibe parámetros. Las claves con «html» solo contienen
// marcado propio (<kbd>, enlaces) y se insertan con innerHTML.

const fmtDate = (date, locale) => new Date(date).toLocaleDateString(locale);
const NEW_TAB = {
  en: '<span class="visually-hidden"> (opens in a new tab)</span>',
  es: '<span class="visually-hidden"> (se abre en una pestaña nueva)</span>',
};

const en = {
  'meta.title': 'Earth Jukebox · NASA Terra Tones',
  'meta.description': 'Listen to NASA Earth visualizations: accessible sonification of scientific images.',
  'loader.text': 'Loading Earth Jukebox…',
  skip: 'Skip to content',
  'lang.group': 'Language',
  'lang.changed': 'Language: English.',

  'hero.eyebrow': 'Science · Art · Accessibility',
  'hero.title': 'Earth Jukebox',
  'hero.tagline': 'Listen to the Earth: NASA visualizations turned into sound.',

  'player.title': 'Player',
  'transport.label': 'Playback controls',
  'transport.prev': 'Previous image',
  'transport.next': 'Next image',
  'play.play': 'Play',
  'play.pause': 'Pause',
  'now.selected': 'Selected',
  'now.playing': 'Playing',
  'now.loading': 'Loading…',

  'mode.legend': 'Mode',
  'mode.auto': 'Automatic',
  'mode.explore': 'Explore',
  'style.label': 'Music genre',
  'style.ambiental': 'Ambient',
  'style.clasica': 'Classical',
  'style.electronica': 'Electronic',
  'style.help':
    'Ambient uses long notes; classical adds chords; electronic adds rhythmic pulses. The motif that conveys the image keeps the same notes, pitches and positions in all three genres. These are synthesized arrangements inspired by those genres.',
  'arrangement.ambiental': 'sustained notes',
  'arrangement.clasica': 'accompanying chords',
  'arrangement.electronica': 'rhythmic pulses',
  'volume.label': 'Volume',
  'volume.value': ({ v }) => `${v}%`,
  'tempo.label': 'Base tempo',
  'tempo.value': ({ v }) => `${v} bpm`,
  'narration.name': 'Narration',
  'narration.on': ': on',
  'narration.off': ': off',
  'narration.unavailable': 'Narration unavailable',
  'motion.pause': 'Pause animation',

  'library.title': 'Menu',
  'library.hint': 'NASA images as albums.',
  'library.themes': 'Filter by theme',
  'library.albums': 'Image list',
  'themes.all': 'All',
  'album.live': ' · live',
  'live.button': 'Add more from the NASA live catalog',

  'details.label': 'Information',
  'cell.title': 'Current cell',
  'cell.prompt': 'Pick a cell with the mouse or the arrow keys.',
  'about.title': 'About this image',
  'about.nasaLink.html': `View on NASA SVS${NEW_TAB.en}`,
  'about.apiLink.html': `View the NASA SVS API response${NEW_TAB.en}`,
  'info.videoVisual': ({ n }) => `Sonification summarizes visual features from ${n} sampled frames of the non-narrated 3D video. It does not represent direct MERRA-2 measurements. Frames containing detected text are excluded.`,
  'video.frameAlt': ({ title, time }) => `Representative frame from ${title}, at ${time}. The sonification summarizes multiple frames over time.`,

  'legend.title': 'Legend: what each sound means',
  'legend.style.dt': 'Sound style',
  'legend.style.dd': 'Ambient, classical or electronic changes the synthesized timbre; the sequence keeps its link to the visual features.',
  'legend.brightness.dt': 'Brightness → pitch',
  'legend.brightness.dd': 'Light areas sound high and dark areas sound low (C pentatonic scale over two octaves).',
  'legend.color.dt': 'Color → timbre',
  'legend.color.dd': 'Cool tones (blues) sound soft and round; warm tones (reds, oranges) sound brighter.',
  'legend.saturation.dt': 'Saturation → volume',
  'legend.saturation.dd': 'Intense colors sound louder; grays sound quieter.',
  'legend.texture.dt': 'Texture → rhythm',
  'legend.texture.dd': 'A uniform area gives one long note; an area with lots of variation gives fast repeated notes.',
  'legend.position.dt': 'Position → panning',
  'legend.position.dd': 'The left of the image sounds in the left ear and the right in the right ear.',
  'legend.unusual.dt': 'Unusual area → bell',
  'legend.unusual.dd': 'A short bell marks cells with unusual visual variations (orange dot on the grid).',
  'legend.contrast.dt': 'Contrast → tempo',
  'legend.contrast.dd': 'Images with more contrast play a little faster.',
  'legend.bass.dt': 'Bass',
  'legend.bass.dd': 'A low note holds the average brightness of each column.',
  'legend.route.dt': 'Automatic route',
  'legend.route.dd': 'Columns from left to right; within each column, rows from top to bottom. The selected style changes the synthesized timbre.',
  'legend.note': 'We detect visual variations in the image, not confirmed phenomena.',

  'keys.title': 'Keyboard',
  'keys.tab.html': '<kbd>Tab</kbd> moves through the controls and into the grid.',
  'keys.arrows.html': '<kbd>Arrows</kbd> move the active cell (in explore mode, the cell plays as you move).',
  'keys.homeEnd.html': '<kbd>Home</kbd> / <kbd>End</kbd> go to the start or end of the row.',
  'keys.enter.html': '<kbd>Enter</kbd> plays the active cell and reads its description.',
  'keys.space.html': '<kbd>Space</kbd> in the grid plays or pauses the route.',
  'keys.note': 'If you use a screen reader, you can turn narration off so you don’t hear descriptions twice.',

  'footer.html': `Images and data: <a href="https://svs.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA Scientific Visualization Studio${NEW_TAB.en}</a>. A project for NASA Space Apps · The Earth Information Jukebox challenge. · by Dark Nebula`,

  'grid.label': ({ rows, cols }) =>
    `Image grid: ${rows} rows by ${cols} columns. Arrows to move, Enter to hear a cell, Space to play or pause.`,

  'info.note': 'Current sonification: visual features of the image; it is not the same as NASA’s original numeric data.',
  'info.type': ({ v }) => `Type: ${v}`,
  'info.category': ({ v }) => `NASA category: ${v}`,
  'info.variables': ({ v }) => `Variables recorded by the API: ${v}`,
  'info.units': ({ v }) => `Units in the API: ${v}`,
  'info.period': ({ v }) => `Period given by the API: ${v}`,
  'info.released': ({ v }) => `NASA release: ${v}`,
  'info.updated': ({ v }) => `NASA update: ${v}`,
  'info.datasets': ({ v }) => `Datasets: ${v}`,
  'info.keywords': ({ v }) => `NASA keywords: ${v}`,
  'info.credits': ({ v }) => `Credits: ${v}`,

  'status.preparing': 'Preparing the first visualization…',
  'status.end': 'End of the piece. Press Play to hear it again.',
  'status.queued': 'Loading the image; it will play as soon as it is ready.',
  'status.paused': 'Paused.',
  'status.playing': ({ title }) => `Playing ${title}.`,
  'status.modeExplore': 'Explore mode: enter the grid and move with the arrow keys; each cell plays instantly.',
  'status.modeAuto': 'Automatic mode: press Play to go through the image from left to right.',
  'status.analyzing': 'Analyzing the image…',
  'status.loaded': ({ title }) => `Image loaded: ${title}.`,
  'status.analyzeFailed': 'This image could not be analyzed.',
  'status.framesUnavailable': 'The 3D video frames are not prepared for analysis yet.',
  'status.loadFailed': ({ title }) => `Could not load the image ${title}.`,
  'status.filter': ({ theme, n }) => `${theme}: ${n} ${n === 1 ? 'image' : 'images'}.`,
  'status.style': ({ name, arrangement }) =>
    `${name} genre: ${arrangement}. The motif and the image mapping are kept.`,
  'status.narrationOn': 'Narration on.',
  'status.narrationOff': 'Narration off.',
  'status.animPaused': 'Animation paused.',
  'status.animResumed': 'Animation resumed.',

  'live.searching': 'Searching NASA SVS for visualizations…',
  'live.added': ({ n, date }) =>
    `Added ${n === 1 ? '1 visualization' : `${n} visualizations`} from the NASA SVS catalog` +
    (date ? ` (API copy from ${fmtDate(date, 'en')}).` : ' (live).'),
  'live.unavailable': 'The live catalog is not available right now. Try again when you are online.',
  'curated.loading': 'Loading official NASA SVS images…',
  'curated.loaded': ({ n, date }) =>
    date
      ? `${n} images and their NASA SVS metadata (API copy from ${fmtDate(date, 'en')}).`
      : `${n} images and their metadata loaded from the NASA APIs.`,
  'curated.failed': ({ ids }) => ` Images ${ids} did not load.`,
  'curated.error': 'Could not load the NASA SVS metadata and images. Check the connection and the proxy.',
  'curated.unavailableTitle': 'NASA catalog unavailable',

  // Descripciones generadas a partir del análisis de la imagen.
  'color.black': 'black',
  'color.white': 'white',
  'color.gray': 'gray',
  'color.red': 'red',
  'color.orange': 'orange',
  'color.yellow': 'yellow',
  'color.green': 'green',
  'color.turquoise': 'turquoise',
  'color.blue': 'blue',
  'color.violet': 'violet',
  'color.pink': 'pink',
  pos: ({ v, h }) => {
    if (v === 'middle' && h === 'center') return 'in the center';
    const words = [{ top: 'top', middle: 'center', bottom: 'bottom' }[v], { left: 'left', center: '', right: 'right' }[h]];
    return `at the ${words.filter(Boolean).join(' ')}`;
  },
  cell: ({ row, col, brightness, tone, color, texture, unusual }) => {
    const b = { veryDark: 'very dark area', dark: 'dark area', medium: 'medium-brightness area', light: 'light area', veryLight: 'very light area' }[brightness];
    const tn = { none: `no defined color (${color})`, warm: `warm tones (${color})`, cool: `cool tones (${color})`, mid: `intermediate tones (${color})` }[tone];
    const tx = { uniform: 'uniform', some: 'some variation', lots: 'lots of variation' }[texture];
    return `Row ${row}, column ${col}: ${b}, ${tn}, ${tx}.${unusual ? ' Unusual visual variation.' : ''}`;
  },
  summary: (p) => {
    const light = { dark: 'A dark', light: 'A light', medium: 'A medium-brightness' }[p.light];
    const tone = { warm: 'Warm tones dominate', cool: 'Cool tones dominate', mixed: 'Mixed warm and cool tones' }[p.tone];
    const colors = p.colors.length === 1
      ? `the most frequent color is ${p.colors[0]}`
      : `the most frequent colors are ${p.colors.join(' and ')}`;
    const unusual = !p.unusualCount
      ? 'No areas have unusual visual variations.'
      : p.unusualCount === 1
        ? `1 area has unusual visual variations, ${p.unusualPos}.`
        : `${p.unusualCount} areas have unusual visual variations; the first is ${p.unusualPos}.`;
    return `${light} image with ${p.contrast} contrast. ${tone}; ${colors}. The brightest area is ${p.brightestPos}. ${unusual}`;
  },
};

const es = {
  'meta.title': 'Jukebox Terrestre · NASA Terra Tones',
  'meta.description': 'Escucha visualizaciones de la Tierra de NASA: sonificación accesible de imágenes científicas.',
  'loader.text': 'Cargando Jukebox Terrestre…',
  skip: 'Saltar al contenido',
  'lang.group': 'Idioma',
  'lang.changed': 'Idioma: español.',

  'hero.eyebrow': 'Ciencia · Arte · Accesibilidad',
  'hero.title': 'Jukebox Terrestre',
  'hero.tagline': 'Escucha la Tierra: visualizaciones de NASA convertidas en sonido.',

  'player.title': 'Reproductor',
  'transport.label': 'Controles de reproducción',
  'transport.prev': 'Imagen anterior',
  'transport.next': 'Imagen siguiente',
  'play.play': 'Reproducir',
  'play.pause': 'Pausar',
  'now.selected': 'Seleccionada',
  'now.playing': 'Sonando',
  'now.loading': 'Cargando…',

  'mode.legend': 'Modo',
  'mode.auto': 'Automático',
  'mode.explore': 'Exploración',
  'style.label': 'Género musical',
  'style.ambiental': 'Ambiental',
  'style.clasica': 'Clásica',
  'style.electronica': 'Electrónica',
  'style.help':
    'Ambiental usa notas largas; clásica añade acordes; electrónica añade pulsos rítmicos. El motivo que comunica la imagen mantiene las mismas notas, alturas y posiciones en los tres géneros. Son arreglos sintetizados inspirados en esos géneros.',
  'arrangement.ambiental': 'notas sostenidas',
  'arrangement.clasica': 'acordes de acompañamiento',
  'arrangement.electronica': 'pulsos rítmicos',
  'volume.label': 'Volumen',
  'volume.value': ({ v }) => `${v} %`,
  'tempo.label': 'Tempo base',
  'tempo.value': ({ v }) => `${v} bpm`,
  'narration.name': 'Narración',
  'narration.on': ': activada',
  'narration.off': ': desactivada',
  'narration.unavailable': 'Narración no disponible',
  'motion.pause': 'Pausar animación',

  'library.title': 'Menú',
  'library.hint': 'Imágenes de la NASA como álbumes.',
  'library.themes': 'Filtrar por tema',
  'library.albums': 'Lista de imágenes',
  'themes.all': 'Todos',
  'album.live': ' · en vivo',
  'live.button': 'Añadir más del catálogo en vivo de NASA',

  'details.label': 'Información',
  'cell.title': 'Celda actual',
  'cell.prompt': 'Elige una celda con el ratón o con las flechas del teclado.',
  'about.title': 'Sobre esta imagen',
  'about.nasaLink.html': `Ver en NASA SVS${NEW_TAB.es}`,
  'about.apiLink.html': `Ver respuesta de la API NASA SVS${NEW_TAB.es}`,
  'info.videoVisual': ({ n }) => `La sonificación resume características visuales de ${n} fotogramas muestreados del video 3D sin narración. No representa mediciones directas de MERRA-2. Se excluyen los fotogramas donde se detecta texto.`,
  'video.frameAlt': ({ title, time }) => `Fotograma representativo de ${title}, en el instante ${time}. La sonificación resume varios fotogramas a lo largo del video.`,

  'legend.title': 'Leyenda: qué significa cada sonido',
  'legend.style.dt': 'Estilo sonoro',
  'legend.style.dd': 'Ambiental, clásica o electrónica cambia el timbre sintetizado; la secuencia conserva su relación con las características visuales.',
  'legend.brightness.dt': 'Brillo → altura',
  'legend.brightness.dd': 'Las zonas claras suenan agudas y las oscuras graves (escala pentatónica de Do en dos octavas).',
  'legend.color.dt': 'Color → timbre',
  'legend.color.dd': 'Los tonos fríos (azules) suenan suaves y redondos; los cálidos (rojos, naranjas) suenan más brillantes.',
  'legend.saturation.dt': 'Saturación → volumen',
  'legend.saturation.dd': 'Los colores intensos suenan más fuerte; los grises, más bajo.',
  'legend.texture.dt': 'Textura → ritmo',
  'legend.texture.dd': 'Una zona uniforme da una nota larga; una zona con mucha variación da notas rápidas repetidas.',
  'legend.position.dt': 'Posición → paneo',
  'legend.position.dd': 'La izquierda de la imagen suena en el oído izquierdo y la derecha en el derecho.',
  'legend.unusual.dt': 'Zona inusual → campana',
  'legend.unusual.dd': 'Una campana breve marca las celdas con variaciones visuales inusuales (punto naranja en la cuadrícula).',
  'legend.contrast.dt': 'Contraste → tempo',
  'legend.contrast.dd': 'Las imágenes con más contraste suenan algo más rápido.',
  'legend.bass.dt': 'Bajo',
  'legend.bass.dd': 'Una nota grave sostiene el brillo medio de cada columna.',
  'legend.route.dt': 'Recorrido automático',
  'legend.route.dd': 'Columnas de izquierda a derecha; en cada columna, filas de arriba abajo. El estilo seleccionado cambia el timbre sintetizado.',
  'legend.note': 'Detectamos variaciones visuales en la imagen, no fenómenos confirmados.',

  'keys.title': 'Teclado',
  'keys.tab.html': '<kbd>Tab</kbd> recorre los controles y entra en la cuadrícula.',
  'keys.arrows.html': '<kbd>Flechas</kbd> mueven la celda activa (en modo exploración, la celda suena al moverte).',
  'keys.homeEnd.html': '<kbd>Inicio</kbd> / <kbd>Fin</kbd> van al principio o al final de la fila.',
  'keys.enter.html': '<kbd>Enter</kbd> escucha la celda activa y lee su descripción.',
  'keys.space.html': '<kbd>Espacio</kbd> en la cuadrícula reproduce o pausa el recorrido.',
  'keys.note': 'Si usas un lector de pantalla, puedes desactivar la narración para no oír las descripciones dos veces.',

  'footer.html': `Imágenes y datos: <a href="https://svs.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA Scientific Visualization Studio${NEW_TAB.es}</a>. Proyecto para NASA Space Apps · reto The Earth Information Jukebox. · by Dark Nebula`,

  'grid.label': ({ rows, cols }) =>
    `Cuadrícula de la imagen: ${rows} filas por ${cols} columnas. Flechas para moverte, Enter para escuchar una celda, Espacio para reproducir o pausar.`,

  'info.note': 'Sonificación actual: rasgos visuales de la imagen; no equivale a los datos numéricos originales de NASA.',
  'info.type': ({ v }) => `Tipo: ${v}`,
  'info.category': ({ v }) => `Categoría NASA: ${v}`,
  'info.variables': ({ v }) => `Variables registradas por la API: ${v}`,
  'info.units': ({ v }) => `Unidades en la API: ${v}`,
  'info.period': ({ v }) => `Periodo indicado por la API: ${v}`,
  'info.released': ({ v }) => `Publicación NASA: ${v}`,
  'info.updated': ({ v }) => `Actualización NASA: ${v}`,
  'info.datasets': ({ v }) => `Conjuntos de datos: ${v}`,
  'info.keywords': ({ v }) => `Palabras clave NASA: ${v}`,
  'info.credits': ({ v }) => `Créditos: ${v}`,

  'status.preparing': 'Preparando la primera visualización…',
  'status.end': 'Fin de la pieza. Pulsa Reproducir para escucharla otra vez.',
  'status.queued': 'Cargando la imagen; sonará en cuanto esté lista.',
  'status.paused': 'Pausado.',
  'status.playing': ({ title }) => `Reproduciendo ${title}.`,
  'status.modeExplore': 'Modo exploración: entra en la cuadrícula y muévete con las flechas; cada celda suena al instante.',
  'status.modeAuto': 'Modo automático: pulsa Reproducir para recorrer la imagen de izquierda a derecha.',
  'status.analyzing': 'Analizando la imagen…',
  'status.loaded': ({ title }) => `Imagen cargada: ${title}.`,
  'status.analyzeFailed': 'No se pudo analizar esta imagen.',
  'status.framesUnavailable': 'Los fotogramas del video 3D todavía no están preparados para el análisis.',
  'status.loadFailed': ({ title }) => `No se pudo cargar la imagen ${title}.`,
  'status.filter': ({ theme, n }) => `${theme}: ${n} ${n === 1 ? 'imagen' : 'imágenes'}.`,
  'status.style': ({ name, arrangement }) =>
    `Género ${name}: ${arrangement}. Se conserva el motivo y el mapeo de la imagen.`,
  'status.narrationOn': 'Narración activada.',
  'status.narrationOff': 'Narración desactivada.',
  'status.animPaused': 'Animación pausada.',
  'status.animResumed': 'Animación reanudada.',

  'live.searching': 'Buscando visualizaciones en NASA SVS…',
  'live.added': ({ n, date }) =>
    `Se ${n === 1 ? 'añadió 1 visualización' : `añadieron ${n} visualizaciones`} del catálogo de NASA SVS` +
    (date ? ` (copia de la API del ${fmtDate(date, 'es')}; textos originales en inglés).` : ' (en vivo; textos originales en inglés).'),
  'live.unavailable': 'El catálogo en vivo no está disponible ahora. Inténtalo de nuevo cuando haya conexión.',
  'curated.loading': 'Cargando imágenes oficiales de NASA SVS…',
  'curated.loaded': ({ n, date }) =>
    date
      ? `${n} imágenes y sus metadatos de NASA SVS (copia de la API del ${fmtDate(date, 'es')}).`
      : `${n} imágenes y sus metadatos cargados desde las API de NASA.`,
  'curated.failed': ({ ids }) => ` No cargaron las imágenes ${ids}.`,
  'curated.error': 'No se pudieron cargar los metadatos e imágenes de NASA SVS. Comprueba la conexión y el proxy.',
  'curated.unavailableTitle': 'Catálogo de NASA no disponible',

  'color.black': 'negro',
  'color.white': 'blanco',
  'color.gray': 'gris',
  'color.red': 'rojo',
  'color.orange': 'naranja',
  'color.yellow': 'amarillo',
  'color.green': 'verde',
  'color.turquoise': 'turquesa',
  'color.blue': 'azul',
  'color.violet': 'violeta',
  'color.pink': 'rosa',
  pos: ({ v, h }) => {
    if (v === 'middle' && h === 'center') return 'en el centro';
    const vw = { top: 'arriba', middle: 'al centro', bottom: 'abajo' }[v];
    const hw = { left: 'a la izquierda', center: '', right: 'a la derecha' }[h];
    return hw ? `${vw} ${hw}` : vw;
  },
  cell: ({ row, col, brightness, tone, color, texture, unusual }) => {
    const b = { veryDark: 'zona muy oscura', dark: 'zona oscura', medium: 'zona de brillo medio', light: 'zona clara', veryLight: 'zona muy clara' }[brightness];
    const tn = { none: `sin color definido (${color})`, warm: `tonos cálidos (${color})`, cool: `tonos fríos (${color})`, mid: `tonos intermedios (${color})` }[tone];
    const tx = { uniform: 'uniforme', some: 'algo de variación', lots: 'mucha variación' }[texture];
    return `Fila ${row}, columna ${col}: ${b}, ${tn}, ${tx}.${unusual ? ' Variación visual inusual.' : ''}`;
  },
  summary: (p) => {
    const light = { dark: 'oscura', light: 'clara', medium: 'de brillo medio' }[p.light];
    const contrast = { high: 'alto', medium: 'medio', low: 'bajo' }[p.contrast];
    const tone = { warm: 'cálidos', cool: 'fríos', mixed: 'mezclados, cálidos y fríos' }[p.tone];
    const colors = p.colors.length === 1
      ? `el color más frecuente es ${p.colors[0]}`
      : `los colores más frecuentes son ${p.colors.join(' y ')}`;
    const unusual = !p.unusualCount
      ? 'No hay zonas con variaciones visuales inusuales.'
      : p.unusualCount === 1
        ? `1 zona tiene variaciones visuales inusuales, ${p.unusualPos}.`
        : `${p.unusualCount} zonas tienen variaciones visuales inusuales, la primera ${p.unusualPos}.`;
    return `Imagen ${light}, con contraste ${contrast}. Predominan los tonos ${tone}; ${colors}. La zona más clara está ${p.brightestPos}. ${unusual}`;
  },
};

export const STRINGS = { en, es };
