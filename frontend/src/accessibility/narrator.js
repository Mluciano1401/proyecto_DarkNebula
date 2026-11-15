// Narración con Web Speech API. Se usa la voz española predeterminada del
// dispositivo, se limitan los picos y se dividen textos largos en frases cortas.

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let enabled = supported;
let voice = null;
let requestId = 0;
let activeOnEnd = null;

function pickVoice() {
  if (!supported) return;
  const spanish = window.speechSynthesis.getVoices().filter((item) => item.lang?.toLowerCase().startsWith('es'));
  // Respeta la voz española marcada como predeterminada en el teléfono; no fuerza
  // una variante regional que podría no estar instalada o sonar menos natural.
  voice = spanish.find((item) => item.default) ?? spanish[0] ?? null;
}

if (supported) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
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
    utterance.lang = voice?.lang ?? 'es-ES';
    if (voice) utterance.voice = voice;
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 0.82;
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
