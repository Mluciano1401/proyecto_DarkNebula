// Narración con Web Speech API. Se usa la voz predeterminada del dispositivo para el
// idioma de la interfaz, se limitan los picos y se dividen textos largos en frases cortas.

import { getLang, onLangChange } from '../i18n/i18n.js';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const FALLBACK_LANG = { en: 'en-US', es: 'es-ES' };
let enabled = supported;
let voice = null;
let requestId = 0;
let activeOnEnd = null;

function pickVoice() {
  if (!supported) return;
  const lang = getLang();
  const matching = window.speechSynthesis.getVoices().filter((item) => item.lang?.toLowerCase().startsWith(lang));
  // Respeta la voz marcada como predeterminada en el teléfono; no fuerza una
  // variante regional que podría no estar instalada o sonar menos natural.
  voice = matching.find((item) => item.default) ?? matching[0] ?? null;
}

if (supported) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  // Al cambiar de idioma se corta la frase en curso y se elige otra voz.
  onLangChange(() => {
    cancel();
    pickVoice();
  });
}

export const isSupported = () => supported;
export const isEnabled = () => enabled;

export function setEnabled(value) {
  enabled = supported && value;
  if (!enabled) cancel();
}

export function cancel() {
  if (!supported) return;
  requestId++;
  const onEnd = activeOnEnd;
  activeOnEnd = null;
  window.speechSynthesis.cancel();
  onEnd?.();
}

function splitText(text, limit = 170) {
  const sentences = String(text).match(/[^.!?]+[.!?]?/g) ?? [String(text)];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      const next = current ? `${current} ${word}` : word;
      if (next.length > limit && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (/[.!?]$/.test(sentence.trim()) && current) {
      chunks.push(current);
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Encadena una frase cada vez: algunos motores móviles reproducen con cortes o
// artefactos si reciben una descripción extensa en un único utterance.
export function speak(text, { onStart, onEnd } = {}) {
  if (!enabled || !text) return;
  cancel();
  pickVoice(); // getVoices() puede haberse completado después de cargar la página.
  const id = requestId;
  const chunks = splitText(text);
  let index = 0;
  let started = false;
  let finished = false;
  activeOnEnd = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };

  const speakNext = () => {
    if (id !== requestId || finished) return;
    if (index >= chunks.length) {
      const finish = activeOnEnd;
      activeOnEnd = null;
      finish?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = voice?.lang ?? FALLBACK_LANG[getLang()];
    if (voice) utterance.voice = voice;
    utterance.rate = 0.94;
    utterance.pitch = 1;
    // Deja margen frente al nivel de salida de las voces nativas del dispositivo.
    utterance.volume = 0.7;
    utterance.onstart = () => {
      if (!started && id === requestId) {
        started = true;
        onStart?.();
      }
    };
    utterance.onend = () => {
      if (id !== requestId) return;
      speakNext();
    };
    utterance.onerror = () => {
      if (id !== requestId) return;
      const finish = activeOnEnd;
      activeOnEnd = null;
      finish?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}
