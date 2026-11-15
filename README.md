-*En*-
# Earth Jukebox · NASA Terra Tones

**Listen to the Earth.** A web-based "jukebox" that converts NASA’s scientific visualizations of Earth into music, allowing blind or low-vision individuals to explore the same data featured in the Earth Information Center.

A project by the **DarkNebula** team for the NASA Space Apps Challenge — *The Earth Information Jukebox* challenge.

> **Demo:** https://mluciano1401.github.io/proyecto_DarkNebula/

## The Problem

NASA’s visualizations of Earth (sea temperature, Arctic ice, rainfall, vegetation, etc.) are almost exclusively visual. Sonification translates their colors and shapes into sound, while an interface—accessible via keyboard and screen reader—allows users to navigate and explore them without needing to see them.

## Features

- **Jukebox:** Select a NASA image as if choosing an album, with controls for Previous, Play/Pause, and Next, plus a menu to filter by topic.
- **Automatic Mode:** The image plays like a musical score, column by column from left to right. Each column consists of a 9-cell arpeggio (from top to bottom), with the active cell highlighted as it plays.
- **Exploration Mode:** Navigate the grid using arrow keys or a mouse; each cell produces a sound instantly, accompanied by a text description.
- **Listening Avatar:** Beside the jukebox, an Earth figure wearing headphones reacts to the audio (displaying levels, bass, mid-range frequencies, and 5 spectral bands via `Tone.Meter` and `Tone.FFT`). The Earth’s rotation follows the tempo, while the aurora borealis shifts color based on the active cell and pulses gently when encountering "unusual" data points.
- **Narration:** When switching images, a voice (in Spanish) reads the title and a summary generated from the data analysis (this feature can be disabled).
- **Musical Genres:** The "Ambient" mode adds sustained notes, "Classical" introduces chords, and "Electronic" incorporates rhythmic pulses. These are synthesized arrangements inspired by those genres; they keep the notes, pitches, positions, and other mappings that convey the image intact.
- **NASA Images**: Upon startup, the jukebox queries the APIs of the nine curated IDs in `source-catalog.json` and preloads their cover images. It uses locally bundled image/API snapshots as a fallback when available. ID 13786 is not currently in this curated list; it should be added explicitly if the project decides to include that already-sonified NASA piece.
- **Live Catalog** (optional): The "Add more from the NASA live catalog" button searches the SVS API for additional visualizations in the *Earth* category and adds them to the jukebox (original text in English). If the API does not respond, the app continues using the curated list.

## How to run it

Requirements: Node.js 20.19+ (tested with Node 26).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # generates frontend/dist
npm run preview    # serves the build
```

To download the nine curated NASA images and refresh the local API snapshot used as a fallback:

```bash
cd frontend
node scripts/fetch-images.mjs
```

The script uses the [NASA SVS API](https://svs.gsfc.nasa.gov/help/) (`/api/<id>/`), saves images to `public/images/`, and refreshes the API snapshot in `public/data/`. At runtime, the app tries the API through `/svs`, then its saved snapshot and local images. GitHub Pages cannot provide the proxy, so a fresh API response is unavailable there; the deployment workflow refreshes the snapshot and image files before building. The nine curated sources are: [5313](https://svs.gsfc.nasa.gov/api/5313/), [3912](https://svs.gsfc.nasa.gov/api/3912/), [5669](https://svs.gsfc.nasa.gov/api/5669/), [5533](https://svs.gsfc.nasa.gov/api/5533/), [5425](https://svs.gsfc.nasa.gov/api/5425/), [5196](https://svs.gsfc.nasa.gov/api/5196/), [5011](https://svs.gsfc.nasa.gov/api/5011/), [4960](https://svs.gsfc.nasa.gov/api/4960/), and [4950](https://svs.gsfc.nasa.gov/api/4950/).

## How images are converted into sound

### Source audit and pilot project

The selection of nine curated NASA IDs can be found in [`src/data/source-catalog.json`](frontend/src/data/source-catalog.json). NASA metadata is fetched at runtime or read from a deployment snapshot. ID 13786 is not part of this collection. For IDs whose selected resource is a rendered image or video, the current sound describes visual features; it must not be interpreted as direct sonification of the underlying scientific measurements.

We selected **ID 5011—lightning events recorded by the LIS sensor on the ISS**—as our pilot visualization. For the initial quantitative layer, we will use the NASA product [ISS LIS Annual Thunder Hour](https://data.nasa.gov/dataset/international-space-station-iss-lightning-imaging-sensor-lis-annual-thunder-hour): a NetCDF-4 file with a 0.05° grid, where the measurement is defined in hours per year. This product covers the period from 2017-03-01 to 2023-11-16 and summarizes long-term activity; it does not correspond to the 10-day rolling window used in the SVS animation. It has been cataloged, but it has not yet been downloaded or integrated. If we later reproduce the 10-day windows, we will use the original LIS events and account for observational coverage before interpreting the counts. The initial sonification specification can be found in [`src/data/pilot-5011-sonification.md`](frontend/src/data/pilot-5011-sonification.md).

1. **Canvas** (`processing/image-processor.js`): the image is resized to 512 px and divided into a grid of **16 columns × 9 rows**. For each cell, the average color, average chroma, and the mean and standard deviation of the luminance are calculated.
2. **Analysis** (`analysis/features.js`): for each cell, brightness, hue, saturation, and texture are calculated and normalized from 0 to 1 relative to the entire image. A cell is considered *unusual* if its brightness or texture deviates by more than 2 standard deviations (|z| > 2). A description in Spanish is generated for each cell, along with a summary of the image as a whole.
3. **Sound** (`audio/mapping.js` + `audio/audio-engine.js`, Tone.js): each feature controls **a single** parameter, and all notes are mapped to a pentatonic scale, ensuring the output is musical rather than chaotic.

| Visual Feature | Sound Parameter | Rule |
| --- | --- | --- |
| Brightness | Pitch | C pentatonic scale across 2 octaves (C4–C6): brighter = higher pitch |
| Hue (color tone) | Timbre | Cool colors (blues) = soft waveform (sine/triangle); warm colors (reds) = bright waveform (filtered sawtooth) |
| Saturation (chroma) | Volume | More color = louder (with an audible minimum) |
| Texture (internal variation) | Rhythm | Uniform = 1 long note; high variation = 2–3 repeated short notes |
| Horizontal position | Stereo panning | Left side of the image = left ear |
| Unusual cell (\|z\| > 2) | Accent | Short bell-like sound (FM synthesis) one octave higher |
| Image contrast | Tempo | Up to 25% faster with higher contrast |
| Average column brightness | Bass | Sustained low note per column |
| Musical genre | Accompaniment arrangement | Ambient adds sustained notes, classical uses chords, and electronic features pulses; the motif and the mapping of visual characteristics are preserved |

We use chroma (max − min of RGB values) as a proxy for "saturation," because the S (saturation) component in the HSL color model spikes in near-black pixels, which would cause the background of the space to sound too intense.

**Important:** The app describes *visual variations* within the image; it does not identify specific phenomena (such as hurricanes or fires).

## Accessibility (targeting WCAG 2.2 AA compliance)

- Includes a **Skip to content** link, a consistently visible violet focus indicator, and a tab order that follows the visual layout. The indicator's contrast depends on the adjacent surface; check it against every surface and state before claiming a ratio.
- A **grid** structure using `role="grid"` with a *roving tabindex*: a single Tab key press enters the grid; **arrow keys** are used for navigation, **Home/End** keys jump to the start or end of a row, **Enter** triggers the audio for a specific cell, and the **Spacebar** toggles play/pause. Each cell includes an `aria-label` containing its description (e.g., "Row 5, column 8: dark area, warm tones (red), some variation").
- An `aria-live="polite"` region announces events such as image loading, playback status (play/pause/end), mode changes, filter adjustments, and the specific cell currently being played.
- **Narration** provided via the Web Speech API (in Spanish), with a toggle button (`aria-pressed`) to enable or disable it; the music volume automatically lowers during speech.
- Custom alternative text (in Spanish) for each image, along with a generated summary based on the analysis.
- The avatar is purely decorative (`aria-hidden`). A **Pause animation** button freezes all animations without affecting the audio (WCAG 2.2.2). With `prefers-reduced-motion` enabled, the content remains static, and flashes are limited to one every 400 ms (2.3.1).
- Audio **never** starts without a user action; pause and volume controls are always visible (1.4.2).
- The design uses high-contrast text tokens, visible focus styles, reduced-motion support, and Windows forced-colors support. Contrast and target-size conformance still require checking every component/state and viewport; these implementation notes alone are not proof of WCAG conformance.

**Tests recorded by the project team:** axe-core 4.14 reported no violations, and a keyboard-only walkthrough was performed in Chrome. Automated scans and a single browser walkthrough do not establish WCAG conformance. **Still needed:** manual NVDA and VoiceOver testing, mobile screen-reader testing, user testing with blind/low-vision participants, and contrast/target checks for every state and viewport. The 16 × 9 touch grid is dense and its cells become smaller than 24 CSS px on narrow screens. Document the applicable WCAG 2.5.8 exception or provide larger/alternative touch controls; keyboard access by itself does not resolve target-size concerns.

## Structure

```
frontend/
├── index.html
├── scripts/fetch-images.mjs        downloads images and refreshes the NASA API snapshot
├── scripts/prepare-3d-frames.mjs   samples the 3D video and filters frames with OCR
├── public/images/                  local copies of the visualizations
└── src/
├── main.js
├── assets/earth-avatar.svg         animated avatar (Earth with headphones)
├── data/source-catalog.json        curated NASA IDs and live search rules
├── data/pilot-5011-sonification.md quantitative pilot specification
├── data/video-4960-sonification.md 3D video sampling specification
├── api/nasa-api.js                 live catalog (search + details, caching)
├── processing/image-processor.js   Canvas → 16×9 grid
├── analysis/features.js            brightness, hue, saturation, texture, descriptions
├── audio/mapping.js                image-to-sound rules (pure functions)
├── audio/audio-engine.js           Tone.js: synthesis, Transport, modes
├── visualization/grid-renderer.js  accessible grid using D3
├── accessibility/narrator.js       Web Speech API
├── components/jukebox.js           jukebox interface
├── components/earth-avatar.js      avatar that reacts to audio
├── components/loader.js            loading screen
└── styles/                         main.css, accessibility.css
```

Stack: JavaScript with ES Modules, Vite, Canvas API, D3.js, Tone.js, Web Speech API. No backend.

## Deployment
- **GitHub Pages**: The `.github/workflows/deploy.yml` workflow builds the `frontend/` directory and publishes `frontend/dist` upon every push to the `main` branch. It must be enabled once under *Settings → Pages → Source: GitHub Actions*.
- **Netlify**: Drag and drop the `frontend/dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect your repository (the `netlify.toml` file already specifies the base directory, build command, and publish directory).

The build uses `base: './'`, ensuring it works whether hosted at the root of a domain or within a subfolder.

**Live Catalog and CORS:** The SVS API and its associated images only allow CORS requests from specific domains. Therefore, the live catalog is routed through a proxy at `/svs`—configured via Vite’s `server.proxy` for development and preview modes, and via a rule in `netlify.toml` for Netlify deployments. Since GitHub Pages does not support proxies, the interface will indicate that the live catalog is unavailable, and the application will default to the curated list instead. For a demonstration featuring the live catalog, please use Netlify.

## Credits

Images and data: **NASA Scientific Visualization Studio (SVS)**, in the public domain.

| Item | Topic | Source |
| --- | --- | --- |
| Night Lights | Climate | [SVS 5313](https://svs.gsfc.nasa.gov/5313/) |
| Surface Currents and Temperature | Oceans | [SVS 3912](https://svs.gsfc.nasa.gov/3912/) |
| GEOS Aerosols | Climate | [SVS 5669](https://svs.gsfc.nasa.gov/5669/) |
| Air Quality Model | Climate | [SVS 5533](https://svs.gsfc.nasa.gov/5533/) |
| Western boundary currents | Oceans | [SVS 5425](https://svs.gsfc.nasa.gov/5425/) |
| DYAMOND carbon dioxide | Climate | [SVS 5196](https://svs.gsfc.nasa.gov/5196/) |
| LIS rays from the ISS | Climate | [SVS 5011](https://svs.gsfc.nasa.gov/5011/) |
| Atmospheric river | Climate | [SVS 4960](https://svs.gsfc.nasa.gov/4960/) |
| GEDI forest height | Vegetation | [SVS 4950](https://svs.gsfc.nasa.gov/4950/) |

Libraries: [Tone.js](https://tonejs.github.io/) and [D3.js](https://d3js.org/).
----------------------------------------------------------------------------------------------------------------------------------
-*Es*-
# Jukebox Terrestre · NASA Terra Tones

**Escucha la Tierra.** Una rocola web que convierte visualizaciones científicas de la Tierra de NASA en música, para que personas ciegas o con baja visión puedan explorar los mismos datos que se ven en el Earth Information Center.

Proyecto del equipo **DarkNebula** para NASA Space Apps · reto _The Earth Information Jukebox_.

> **Demo:** https://mluciano1401.github.io/proyecto_DarkNebula/

## El problema

Las visualizaciones de la Tierra de NASA (temperatura del mar, hielo ártico, lluvia, vegetación…) son casi solo visuales. La sonificación traduce sus colores y formas a sonido, y una interfaz accesible por teclado y lector de pantalla permite recorrerlas sin verlas.

## Qué hace

- **Rocola**: eliges una imagen de NASA como si fuera un álbum, con Anterior / Reproducir-Pausa / Siguiente y un menú que filtra por tema.
- **Modo automático**: la imagen suena como una partitura, columna por columna de izquierda a derecha; cada columna es un arpegio de 9 celdas (de arriba abajo) y la celda que suena se resalta.
- **Modo exploración**: recorres la cuadrícula con las flechas o el ratón y cada celda suena al instante, con su descripción en texto.
- **Avatar que escucha**: junto a la rocola, una Tierra con auriculares reacciona al audio (nivel, graves, medios y 5 bandas del espectro con `Tone.Meter` y `Tone.FFT`); el giro sigue el tempo, la aurora toma el color de la celda que suena y destella suavemente en las celdas inusuales.
- **Narración**: al cambiar de imagen, una voz en español lee el título y un resumen generado del análisis (se puede desactivar).
- **Género musical**: ambiental añade notas sostenidas, clásica acordes y electrónica pulsos rítmicos. Son arreglos sintetizados inspirados en esos géneros; mantienen intactas las notas, alturas, posiciones y demás mapeos que comunican la imagen.
- **Imágenes NASA**: al iniciar, la rocola consulta las API de los nueve ID curados de `source-catalog.json` y precarga sus carátulas. Si falla la API, usa las copias locales de metadatos e imágenes cuando están disponibles. El ID 13786 no forma parte actualmente de esa colección; agréguenlo explícitamente si deciden incluir esa pieza NASA ya sonificada.
- **Catálogo en vivo** (opcional): el botón "Añadir más del catálogo en vivo de NASA" busca en la SVS API más visualizaciones de la categoría _Earth_ y las añade a la rocola (textos originales en inglés). Si la API no responde, la app sigue con la lista curada.

## Cómo ejecutarlo

Requisitos: Node.js 20.19+ (probado con Node 26).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # genera frontend/dist
npm run preview    # sirve el build
```

Para descargar las nueve imágenes curadas de NASA y actualizar la copia local de las respuestas de API:

```bash
cd frontend
node scripts/fetch-images.mjs
```

El script usa la [NASA SVS API](https://svs.gsfc.nasa.gov/help/) (`/api/<id>/`), guarda imágenes en `public/images/` y actualiza la copia de las respuestas en `public/data/`. Al ejecutarse, la app intenta consultar la API por `/svs` y luego usa la copia guardada y las imágenes locales. GitHub Pages no permite el proxy; el workflow actualiza las copias antes de compilar, por lo que allí los datos no son una consulta en vivo.

Las nueve fuentes curadas son: [5313](https://svs.gsfc.nasa.gov/api/5313/), [3912](https://svs.gsfc.nasa.gov/api/3912/), [5669](https://svs.gsfc.nasa.gov/api/5669/), [5533](https://svs.gsfc.nasa.gov/api/5533/), [5425](https://svs.gsfc.nasa.gov/api/5425/), [5196](https://svs.gsfc.nasa.gov/api/5196/), [5011](https://svs.gsfc.nasa.gov/api/5011/), [4960](https://svs.gsfc.nasa.gov/api/4960/) y [4950](https://svs.gsfc.nasa.gov/api/4950/). El ID 13786 no está en esta lista curada.

La animación 3D SVS 4960 se analiza a partir de fotogramas de la versión no narrada. Para prepararlos localmente se necesitan `ffmpeg` y `tesseract-ocr`; luego ejecuten `npm run prepare:3d`. El proceso muestrea 24 instantes y excluye con OCR los cuadros donde detecta texto. La sonificación resultante representa características visuales del render, no mediciones numéricas de MERRA-2.

## Cómo se convierte la imagen en sonido

### Auditoría de fuentes y piloto

La selección de nueve ID curados está en [`src/data/source-catalog.json`](frontend/src/data/source-catalog.json). Los metadatos NASA se consultan al ejecutar la app o se leen de la copia guardada para el despliegue. El ID 13786 no está incluido. Cuando el recurso elegido es una imagen o un video renderizado, el sonido actual describe características visuales; no es sonificación directa de las mediciones científicas subyacentes.

Elegimos el **ID 5011, eventos de rayos del sensor LIS en la ISS**, como visualización piloto. Para la primera capa cuantitativa usaremos el producto NASA [ISS LIS Annual Thunder Hour](https://data.nasa.gov/dataset/international-space-station-iss-lightning-imaging-sensor-lis-annual-thunder-hour): un NetCDF-4 con una grilla de 0,05° y una medida definida en horas por año. Este producto cubre 2017-03-01 a 2023-11-16 y resume actividad de largo plazo; no es la misma ventana móvil de 10 días de la animación SVS. Está catalogado, pero todavía no está descargado ni integrado. Si después reproducimos las ventanas de 10 días, usaremos los eventos LIS originales y controlaremos la cobertura de observación antes de interpretar conteos. La especificación inicial de sonificación está en [`src/data/pilot-5011-sonification.md`](frontend/src/data/pilot-5011-sonification.md).

1. **Canvas** (`processing/image-processor.js`): la imagen se reduce a 512 px y se divide en una cuadrícula de **16 columnas × 9 filas**. Por celda se calcula el color medio, el croma medio y la media y desviación de la luminancia.
2. **Análisis** (`analysis/features.js`): por celda, brillo, tono, saturación y textura, normalizados de 0 a 1 respecto a la imagen. Una celda es _inusual_ si su brillo o su textura se alejan más de 2 desviaciones típicas (|z| > 2). Se genera una descripción en español por celda y un resumen de la imagen.
3. **Sonido** (`audio/mapping.js` + `audio/audio-engine.js`, Tone.js): cada característica controla **un solo** parámetro y todas las notas caen en una escala pentatónica, así que suena musical y no caótico.

| Característica visual       | Parámetro de sonido       | Regla                                                                                                                                     |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Brillo                      | Altura                    | Pentatónica de Do en 2 octavas (C4–C6): más claro = más agudo                                                                             |
| Tono de color               | Timbre                    | Fríos (azules) = onda suave (seno/triángulo); cálidos (rojos) = onda brillante (diente de sierra filtrada)                                |
| Saturación (croma)          | Volumen                   | Más color = más fuerte, con un mínimo audible                                                                                             |
| Textura (variación interna) | Ritmo                     | Uniforme = 1 nota larga; mucha variación = 2–3 notas cortas repetidas                                                                     |
| Posición horizontal         | Paneo estéreo             | Izquierda de la imagen = oído izquierdo                                                                                                   |
| Celda inusual (\|z\| > 2)   | Acento                    | Campana breve (FM) una octava arriba                                                                                                      |
| Contraste de la imagen      | Tempo                     | Hasta un 25 % más rápido con más contraste                                                                                                |
| Brillo medio de la columna  | Bajo                      | Nota grave sostenida por columna                                                                                                          |
| Género musical              | Arreglo de acompañamiento | Ambiental añade notas sostenidas, clásica acordes y electrónica pulsos; el motivo y el mapeo de las características visuales se conservan |

Usamos el croma (máx − mín de RGB) como "saturación" porque la S de HSL se dispara en píxeles casi negros y haría sonar fuerte el fondo del espacio.

**Importante:** la app describe _variaciones visuales_ de la imagen; no identifica fenómenos (huracanes, incendios…).

## Accesibilidad (objetivo WCAG 2.2 AA)

- Enlace **Saltar al contenido**, foco violeta siempre visible y orden de tabulación que sigue el orden visual. El contraste del indicador depende de la superficie adyacente; compruébenlo en todas las superficies y estados antes de afirmar una proporción.
- **Cuadrícula** con `role="grid"` y _roving tabindex_: un solo Tab entra en la cuadrícula; **flechas** para moverse, **Inicio/Fin** para ir al borde de la fila, **Enter** para escuchar la celda, **Espacio** para reproducir o pausar. Cada celda tiene como `aria-label` su descripción (por ejemplo, "Fila 5, columna 8: zona oscura, tonos cálidos (rojo), algo de variación").
- Región `aria-live="polite"` que anuncia la imagen cargada, reproducción, pausa, fin, cambio de modo, filtros y la celda escuchada.
- **Narración** con Web Speech API en español, con botón para activarla o desactivarla (`aria-pressed`); la música baja de volumen mientras habla.
- Texto alternativo propio en español para cada imagen y resumen generado del análisis.
- El avatar es decorativo (`aria-hidden`). El botón **Pausar animación** congela todas las animaciones sin tocar el audio (2.2.2); con `prefers-reduced-motion` queda estático, y los destellos están limitados a uno cada 400 ms (2.3.1).
- El audio **nunca** empieza sin una acción del usuario; pausa y volumen siempre visibles (1.4.2).
- El diseño usa colores de texto de alto contraste, foco visible, soporte para movimiento reducido y colores forzados de Windows. Hay que comprobar contraste y tamaño de objetivos en cada componente, estado y tamaño de pantalla; estas notas de implementación no demuestran por sí solas conformidad WCAG.

**Pruebas registradas por el equipo:** axe-core 4.14 no reportó violaciones y se hizo un recorrido solo con teclado en Chrome. Un análisis automático y un recorrido en un navegador no demuestran conformidad WCAG. **Pendiente:** pruebas manuales con NVDA y VoiceOver, lector de pantalla móvil, personas ciegas o con baja visión, y revisión de contraste y tamaño de objetivos en cada estado y tamaño de pantalla. La cuadrícula táctil de 16 × 9 es densa y sus celdas miden menos de 24 px en móviles estrechos. Documenten la excepción aplicable de WCAG 2.5.8 o añadan controles táctiles alternativos de mayor tamaño; el acceso por teclado por sí solo no resuelve el tamaño de los objetivos.

## Estructura

```
frontend/
├── index.html
├── scripts/fetch-images.mjs        descarga imágenes y actualiza copia de API NASA
├── scripts/prepare-3d-frames.mjs   muestrea video 3D y filtra cuadros con OCR
├── public/images/                  copias locales de las visualizaciones
└── src/
    ├── main.js
    ├── assets/earth-avatar.svg         avatar animado (Tierra con auriculares)
    ├── data/source-catalog.json        IDs NASA curados y reglas del catálogo en vivo
    ├── data/pilot-5011-sonification.md especificación del piloto cuantitativo
    ├── data/video-4960-sonification.md especificación de muestreo del video 3D
    ├── api/nasa-api.js                 catálogo en vivo (búsqueda + detalles, caché)
    ├── processing/image-processor.js   Canvas → cuadrícula 16 × 9
    ├── analysis/features.js            brillo, tono, saturación, textura, descripciones
    ├── audio/mapping.js                reglas imagen → sonido (funciones puras)
    ├── audio/audio-engine.js           Tone.js: síntesis, Transport, modos
    ├── visualization/grid-renderer.js  cuadrícula accesible con D3
    ├── accessibility/narrator.js       Web Speech API
    ├── components/jukebox.js           interfaz de la rocola
    ├── components/earth-avatar.js      avatar que reacciona al audio
    ├── components/loader.js            pantalla de carga
    └── styles/                         main.css, accessibility.css
```

Stack: JavaScript con ES Modules, Vite, Canvas API, D3.js, Tone.js, Web Speech API. Sin backend.

## Despliegue

- **GitHub Pages**: el workflow `.github/workflows/deploy.yml` compila `frontend/` y publica `frontend/dist` en cada push a `main`. Hay que activarlo una vez en _Settings → Pages → Source: GitHub Actions_.
- **Netlify**: arrastra la carpeta `frontend/dist` a [app.netlify.com/drop](https://app.netlify.com/drop), o conecta el repositorio (el archivo `netlify.toml` ya indica la carpeta base, el comando y la de publicación).

El build usa `base: './'`, así que funciona en la raíz de un dominio o dentro de una subcarpeta.

**Catálogo en vivo y CORS:** la SVS API y sus imágenes solo permiten CORS a otro dominio, así que el catálogo en vivo pasa por un proxy en `/svs`: `server.proxy` de Vite en desarrollo y vista previa, y una regla de `netlify.toml` en Netlify. GitHub Pages no admite proxy, así que allí el botón avisa de que el catálogo no está disponible y la app sigue con la lista curada. Para la demo con catálogo en vivo, usa Netlify.

## Créditos

Imágenes y datos: **NASA Scientific Visualization Studio (SVS)**, de dominio público.

| Pieza                                | Tema       | Fuente                                      |
| ------------------------------------ | ---------- | ------------------------------------------- |
| Luces nocturnas                      | Clima      | [SVS 5313](https://svs.gsfc.nasa.gov/5313/) |
| Corrientes y temperatura superficial | Océanos    | [SVS 3912](https://svs.gsfc.nasa.gov/3912/) |
| Aerosoles GEOS                       | Clima      | [SVS 5669](https://svs.gsfc.nasa.gov/5669/) |
| Modelo de calidad del aire           | Clima      | [SVS 5533](https://svs.gsfc.nasa.gov/5533/) |
| Corrientes límite occidentales       | Océanos    | [SVS 5425](https://svs.gsfc.nasa.gov/5425/) |
| Dióxido de carbono DYAMOND           | Clima      | [SVS 5196](https://svs.gsfc.nasa.gov/5196/) |
| Rayos LIS desde la ISS               | Clima      | [SVS 5011](https://svs.gsfc.nasa.gov/5011/) |
| Río atmosférico                      | Clima      | [SVS 4960](https://svs.gsfc.nasa.gov/4960/) |
| Altura forestal GEDI                 | Vegetación | [SVS 4950](https://svs.gsfc.nasa.gov/4950/) |

Bibliotecas: [Tone.js](https://tonejs.github.io/) y [D3.js](https://d3js.org/).
