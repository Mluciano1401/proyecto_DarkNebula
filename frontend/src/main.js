import './styles/tokens.css';
// Fuentes autoalojadas (funcionan sin internet): Inter variable para cuerpo y UI,
// Inter Tight como sustituto de Roobert en títulos y Roboto Mono para etiquetas y datos.
import '@fontsource-variable/inter';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/roboto-mono/400.css';
import './styles/main.css';
import './styles/accessibility.css';
import playlist from './data/playlist.json';
import { createJukebox } from './components/jukebox.js';
import { finishLoader } from './components/loader.js';

finishLoader(createJukebox(playlist));
