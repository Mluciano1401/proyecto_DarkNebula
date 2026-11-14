import './styles/main.css';
import './styles/accessibility.css';
import playlist from './data/playlist.json';
import { createJukebox } from './components/jukebox.js';

createJukebox(playlist);
