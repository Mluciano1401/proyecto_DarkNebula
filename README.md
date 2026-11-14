# Jukebox Terrestre · NASA Earth Sonification

**Escucha la Tierra.** Una rocola web que convierte visualizaciones científicas de la Tierra de NASA en música, para que personas ciegas o con baja visión puedan explorar los mismos datos que se ven en el Earth Information Center.

Proyecto del equipo **DarkNebula** para NASA Space Apps · reto *Earth Jukebox*.

> **Demo:** _(añadir aquí la URL pública de GitHub Pages o Netlify)_

## El problema

Las visualizaciones de la Tierra de NASA (temperatura del mar, hielo ártico, lluvia, vegetación…) son casi solo visuales. La sonificación traduce sus colores y formas a sonido, y una interfaz accesible por teclado y lector de pantalla permite recorrerlas sin verlas.

## Qué hace

- **Rocola**: eliges una imagen de NASA como si fuera un álbum, con Anterior / Reproducir-Pausa / Siguiente y un menú que filtra por tema (clima, temperatura, océanos, hielo, vegetación).
- **Modo automático**: la imagen suena como una partitura, columna por columna de izquierda a derecha; cada columna es un arpegio de 9 celdas (de arriba abajo) y la celda que suena se resalta.
- **Modo exploración**: recorres la cuadrícula con las flechas o el ratón y cada celda suena al instante, con su descripción en texto.
- **Avatar que escucha**: junto a la rocola, una Tierra con auriculares reacciona al audio (nivel, graves, medios y 5 bandas del espectro con `Tone.Meter` y `Tone.FFT`); el giro sigue el tempo, la aurora toma el color de la celda que suena y destella suavemente en las celdas inusuales.
- **Narración**: al cambiar de imagen, una voz en español lee el título y un resumen generado del análisis (se puede desactivar).
- **Catálogo en vivo** (opcional): el botón "Añadir más del catálogo en vivo de NASA" busca en la SVS API más visualizaciones de la categoría *Earth* y las añade a la rocola (textos originales en inglés). Si la API no responde, la app sigue con la lista curada.

## Cómo ejecutarlo

Requisitos: Node.js 20.19+ (probado con Node 26).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # genera frontend/dist
npm run preview    # sirve el build
```

Para volver a descargar las imágenes de NASA y regenerar `src/data/playlist.json`:

```bash
cd frontend
node scripts/fetch-images.mjs
```

El script usa la [NASA SVS API](https://svs.gsfc.nasa.gov/help/) (`/api/<id>/` y `/api/search/`) y guarda copias medianas en `public/images/`. Trabajamos con copias locales para que Canvas pueda leer los píxeles sin problemas de CORS.

## Cómo se convierte la imagen en sonido

1. **Canvas** (`processing/image-processor.js`): la imagen se reduce a 512 px y se divide en una cuadrícula de **16 columnas × 9 filas**. Por celda se calcula el color medio, el croma medio y la media y desviación de la luminancia.
2. **Análisis** (`analysis/features.js`): por celda, brillo, tono, saturación y textura, normalizados de 0 a 1 respecto a la imagen. Una celda es *inusual* si su brillo o su textura se alejan más de 2 desviaciones típicas (|z| > 2). Se genera una descripción en español por celda y un resumen de la imagen.
3. **Sonido** (`audio/mapping.js` + `audio/audio-engine.js`, Tone.js): cada característica controla **un solo** parámetro y todas las notas caen en una escala pentatónica, así que suena musical y no caótico.

| Característica visual | Parámetro de sonido | Regla |
| --- | --- | --- |
| Brillo | Altura | Pentatónica de Do en 2 octavas (C4–C6): más claro = más agudo |
| Tono de color | Timbre | Fríos (azules) = onda suave (seno/triángulo); cálidos (rojos) = onda brillante (diente de sierra filtrada) |
| Saturación (croma) | Volumen | Más color = más fuerte, con un mínimo audible |
| Textura (variación interna) | Ritmo | Uniforme = 1 nota larga; mucha variación = 2–3 notas cortas repetidas |
| Posición horizontal | Paneo estéreo | Izquierda de la imagen = oído izquierdo |
| Celda inusual (\|z\| > 2) | Acento | Campana breve (FM) una octava arriba |
| Contraste de la imagen | Tempo | Hasta un 25 % más rápido con más contraste |
| Brillo medio de la columna | Bajo | Nota grave sostenida por columna |
| Tema | Instrumento | Cada tema cambia las formas de onda y el filtro, no las reglas |

Usamos el croma (máx − mín de RGB) como "saturación" porque la S de HSL se dispara en píxeles casi negros y haría sonar fuerte el fondo del espacio.

**Importante:** la app describe *variaciones visuales* de la imagen; no identifica fenómenos (huracanes, incendios…).

## Accesibilidad (objetivo WCAG 2.2 AA)

- Enlace **Saltar al contenido**, foco siempre visible (amarillo, contraste 12:1) y orden de tabulación que sigue el orden visual.
- **Cuadrícula** con `role="grid"` y *roving tabindex*: un solo Tab entra en la cuadrícula; **flechas** para moverse, **Inicio/Fin** para ir al borde de la fila, **Enter** para escuchar la celda, **Espacio** para reproducir o pausar. Cada celda tiene como `aria-label` su descripción (por ejemplo, "Fila 5, columna 8: zona oscura, tonos cálidos (rojo), algo de variación").
- Región `aria-live="polite"` que anuncia la imagen cargada, reproducción, pausa, fin, cambio de modo, filtros y la celda escuchada.
- **Narración** con Web Speech API en español, con botón para activarla o desactivarla (`aria-pressed`); la música baja de volumen mientras habla.
- Texto alternativo propio en español para cada imagen y resumen generado del análisis.
- El avatar es decorativo (`aria-hidden`). El botón **Pausar animación** congela todas las animaciones sin tocar el audio (2.2.2); con `prefers-reduced-motion` queda estático, y los destellos están limitados a uno cada 400 ms (2.3.1).
- El audio **nunca** empieza sin una acción del usuario; pausa y volumen siempre visibles (1.4.2).
- Contraste de texto ≥ 7:1 en el peor caso; bordes de controles ≥ 3:1; objetivos ≥ 24 × 24 px; respeta `prefers-reduced-motion` y el modo de alto contraste de Windows.

**Pruebas realizadas:** axe-core 4.14 sin violaciones (WCAG 2.0/2.1/2.2 A y AA + buenas prácticas); recorrido completo solo con teclado en Chrome.
**Pendiente:** prueba manual con NVDA y Lighthouse.
**Limitación conocida:** en pantallas de móvil estrechas las celdas de la cuadrícula miden menos de 24 px. La posición de cada celda es la información misma (excepción "esencial" de 2.5.8) y el teclado ofrece navegación completa.

## Estructura

```
frontend/
├── index.html
├── scripts/fetch-images.mjs        descarga desde NASA SVS API
├── public/images/                  copias locales de las visualizaciones
└── src/
    ├── main.js
    ├── assets/earth-avatar.svg         avatar animado (Tierra con auriculares)
    ├── data/playlist.json
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

- **GitHub Pages**: el workflow `.github/workflows/deploy.yml` compila `frontend/` y publica `frontend/dist` en cada push a `main`. Hay que activarlo una vez en *Settings → Pages → Source: GitHub Actions*.
- **Netlify**: arrastra la carpeta `frontend/dist` a [app.netlify.com/drop](https://app.netlify.com/drop), o conecta el repositorio (el archivo `netlify.toml` ya indica la carpeta base, el comando y la de publicación).

El build usa `base: './'`, así que funciona en la raíz de un dominio o dentro de una subcarpeta.

**Catálogo en vivo y CORS:** la SVS API y sus imágenes solo permiten CORS a otro dominio, así que el catálogo en vivo pasa por un proxy en `/svs`: `server.proxy` de Vite en desarrollo y vista previa, y una regla de `netlify.toml` en Netlify. GitHub Pages no admite proxy, así que allí el botón avisa de que el catálogo no está disponible y la app sigue con la lista curada. Para la demo con catálogo en vivo, usa Netlify.

## Créditos

Imágenes y datos: **NASA Scientific Visualization Studio (SVS)**, de dominio público.

| Pieza | Tema | Fuente |
| --- | --- | --- |
| Sea Surface Temperature (SST) – Near Real Time | Temperatura | [SVS 5101](https://svs.gsfc.nasa.gov/5101/) |
| Arctic Sea Ice Minimum 2026 | Hielo | [SVS 5677](https://svs.gsfc.nasa.gov/5677/) |
| Global Ocean Color from PACE: Apparent Visible Wavelength | Océanos | [SVS 5690](https://svs.gsfc.nasa.gov/5690/) |
| Global Views of PACE Land Vegetation Data | Vegetación | [SVS 5548](https://svs.gsfc.nasa.gov/5548/) |
| Near Real-Time Global Precipitation (GPM) | Clima | [SVS 5650](https://svs.gsfc.nasa.gov/5650/) |

Bibliotecas: [Tone.js](https://tonejs.github.io/) y [D3.js](https://d3js.org/).
