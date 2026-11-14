// Narración con Web Speech API (voz del sistema en español). Se puede desactivar.

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let enabled = supported;
let voice = null;

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith('es'));
  voice = es.find((v) => /es-(es|mx|us|419)/i.test(v.lang)) ?? es[0] ?? null;
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
  if (supported) window.speechSynthesis.cancel();
}

// Lee un texto; onStart/onEnd permiten bajar la música mientras habla.
export function speak(text, { onStart, onEnd } = {}) {
  if (!enabled || !text) return;
  cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'es-ES';
  if (voice) u.voice = voice;
  u.rate = 1;
  u.onstart = () => onStart?.();
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}
