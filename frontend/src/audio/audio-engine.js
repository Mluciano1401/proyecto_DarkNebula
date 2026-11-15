// Motor de sonido con Tone.js. El audio SOLO arranca tras un gesto del usuario
// (ensureAudio se llama desde manejadores de clic o tecla).

import * as Tone from 'tone';
import { mapCell, tempoFor, bassForBrightness, SOUND_STYLES, DEFAULT_SOUND_STYLE } from './mapping.js';

// Cada celda dura una corchea de tresillo: las 9 celdas de una columna forman un
// arpegio de 3 tiempos. Programar celda a celda permite que la pausa sea inmediata.
const STEP = '8t';

let nodes = null;
const state = {
  analysis: null,
  mapped: [],
  step: 0,
  playing: false,
  repeatId: null,
  baseTempo: 120,
  volume: 0.55,
  ducked: false,
  soundStyle: 'ambiental',
};
const handlers = { onCell: () => {}, onEnd: () => {} };

export function setHandlers({ onCell, onEnd } = {}) {
  if (onCell) handlers.onCell = onCell;
  if (onEnd) handlers.onEnd = onEnd;
}

// +6 dB de ganancia de compensación: con -6 dB la pieza salía con picos de ~-25 dBFS,
// casi inaudible en altavoces de teléfono y portátil. El limitador sigue evitando la saturación.
const volumeToDb = (v) => (v <= 0.001 ? -Infinity : 20 * Math.log10(v) + 6);

async function build() {
  const limiter = new Tone.Limiter(-6).toDestination();
  // Un solo analizador (nivel + espectro) sobre la salida final, para la animación.
  const meter = new Tone.Meter({ smoothing: 0.8 });
  const fft = new Tone.FFT({ size: 64 });
  limiter.fan(meter, fft);
  const duck = new Tone.Gain(state.ducked ? 0.08 : 1).connect(limiter); // prioriza la narración
  const master = new Tone.Volume(volumeToDb(state.volume)).connect(duck);
  const reverb = new Tone.Reverb({ decay: 1.1, wet: 0.1 }).connect(master);
  const panner = new Tone.Panner(0).connect(reverb);
  const filter = new Tone.Filter(DEFAULT_SOUND_STYLE.cutoff, 'lowpass').connect(panner);

  const envelope = { attack: 0.01, decay: 0.15, sustain: 0.5, release: DEFAULT_SOUND_STYLE.release };
  const soft = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8, oscillator: { type: DEFAULT_SOUND_STYLE.soft }, envelope }).connect(panner);
  const bright = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8, oscillator: { type: DEFAULT_SOUND_STYLE.bright }, envelope }).connect(filter);
  soft.volume.value = -9;
  bright.volume.value = -18;

  const bell = new Tone.FMSynth({
    harmonicity: 3.01,
    modulationIndex: 6,
    envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
  }).connect(panner);
  bell.volume.value = -22;

  const bass = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 1.2 },
  }).connect(reverb);
  bass.volume.value = -23;

  const accompaniment = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 8,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.025, decay: 0.25, sustain: 0.2, release: 0.7 },
  }).connect(reverb);
  accompaniment.volume.value = -30;
  const pulse = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
  }).connect(master);
  pulse.volume.value = -30;

  await reverb.ready;
  nodes = { limiter, meter, fft, duck, master, reverb, panner, filter, soft, bright, bell, bass, accompaniment, pulse };
  applySoundStyle();
}

// Desbloquea el audio. Hay que llamarla de forma síncrona dentro de un clic o una
// tecla: Safari (iOS) solo reanuda el AudioContext durante el gesto, no después de
// un `await` (por ejemplo, cuando la reproducción espera a que cargue la imagen).
export function unlockAudio() {
  // iOS: con el interruptor de silencio activado, Web Audio queda mudo (la narración
  // no). El tipo de sesión «playback» hace que suene como un reproductor de música.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    // API no disponible en este navegador
  }
  return Tone.start();
}

// Desbloqueo con la primera interacción en cualquier parte de la página.
if (typeof document !== 'undefined') {
  const events = ['pointerdown', 'pointerup', 'keydown'];
  const onGesture = () => {
    unlockAudio().then(() => {
      if (Tone.getContext().state === 'running') {
        for (const type of events) document.removeEventListener(type, onGesture, true);
      }
    });
  };
  for (const type of events) document.addEventListener(type, onGesture, true);
}

export async function ensureAudio() {
  await unlockAudio();
  if (!nodes) {
    Tone.getContext().lookAhead = 0.15;
    await build();
  }
}

function applySoundStyle() {
  if (!nodes) return;
  const inst = SOUND_STYLES[state.soundStyle] ?? DEFAULT_SOUND_STYLE;
  nodes.soft.set({ oscillator: { type: inst.soft }, envelope: { release: inst.release } });
  nodes.bright.set({ oscillator: { type: inst.bright }, envelope: { release: inst.release } });
  nodes.filter.frequency.value = inst.cutoff;
  nodes.accompaniment.set({ oscillator: { type: inst.arrangement === 'chords' ? 'triangle' : 'sine' } });
}

export function setSoundStyle(style) {
  if (!Object.hasOwn(SOUND_STYLES, style)) return;
  state.soundStyle = style;
  applySoundStyle();
}

// Toca una celda ya mapeada dentro de una ranura de tiempo `slot` (segundos).
function playMapped(m, time, slot) {
  const { soft, bright, bell } = nodes;
  const each = slot / m.pulses;
  const dur = m.pulses === 1 ? slot * 0.9 : each * 0.55;
  for (let p = 0; p < m.pulses; p++) {
    const t = time + p * each;
    const vs = m.velocity * m.timbre.soft;
    const vb = m.velocity * m.timbre.bright;
    if (vs > 0.04) soft.triggerAttackRelease(m.note, dur, t, vs);
    if (vb > 0.04) bright.triggerAttackRelease(m.note, dur, t, vb);
  }
  if (m.accent) bell.triggerAttackRelease(Tone.Frequency(m.note).transpose(12).toNote(), 0.2, time, 0.45);
}

const cellAt = (row, col) => state.analysis.cells[row * state.analysis.cols + col];

// Modo automático: columna por columna de izquierda a derecha; dentro de cada
// columna, arpegio de arriba abajo (fila 1 → fila 9), en orden de lectura.
function onStep(time) {
  const { cols, rows } = state.analysis;
  const draw = Tone.getDraw();
  const k = state.step++;
  const col = Math.floor(k / rows);
  const row = k % rows;
  if (col >= cols) {
    draw.schedule(() => {
      stop();
      handlers.onEnd();
    }, time);
    return;
  }
  const noteSlot = Tone.Time(STEP).toSeconds();
  if (row === 0) {
    nodes.panner.pan.setValueAtTime(state.mapped[col].pan, time);
    let avg = 0;
    for (let r = 0; r < rows; r++) avg += cellAt(r, col).brightnessN / rows;
    nodes.bass.triggerAttackRelease(bassForBrightness(avg), noteSlot * rows * 0.9, time, 0.4);
  }
  const cell = cellAt(row, col);
  const mapped = state.mapped[row * cols + col];
  playMapped(mapped, time, noteSlot);
  const arrangement = (SOUND_STYLES[state.soundStyle] ?? DEFAULT_SOUND_STYLE).arrangement;
  // Acompañamiento musical separado del motivo informativo. Sigue las notas ya
  // mapeadas; nunca cambia altura, ritmo ni posición que representan la imagen.
  if (arrangement === 'chords' && row % 3 === 0) {
    nodes.accompaniment.triggerAttackRelease(
      [mapped.note, Tone.Frequency(mapped.note).transpose(7).toNote()],
      noteSlot * 2.2,
      time,
      0.16,
    );
  } else if (arrangement === 'pulse' && row === 0) {
    nodes.pulse.triggerAttackRelease('C3', '16n', time, 0.22);
    nodes.pulse.triggerAttackRelease('C3', '16n', time + noteSlot * 0.5, 0.14);
  }
  draw.schedule(() => handlers.onCell(cell, 'auto'), time);
}

function silence() {
  if (!nodes) return;
  nodes.soft.releaseAll();
  nodes.bright.releaseAll();
  nodes.bass.triggerRelease();
  nodes.accompaniment.releaseAll();
  nodes.pulse.triggerRelease();
}

export function setAnalysis(analysis) {
  stop();
  state.analysis = analysis;
  state.mapped = analysis.cells.map((c) => mapCell(c, analysis.cols));
  applySoundStyle();
  applyTempo();
}

function applyTempo() {
  Tone.getTransport().bpm.value = tempoFor(state.baseTempo, state.analysis?.contrast ?? 0.5);
}

export function setTempo(bpm) {
  state.baseTempo = bpm;
  applyTempo();
}
export const getTempo = () => Math.round(Tone.getTransport().bpm.value);

export function setVolume(v) {
  state.volume = v;
  if (nodes) nodes.master.volume.rampTo(volumeToDb(v), 0.05);
}

export function duck(on) {
  state.ducked = on;
  if (nodes) nodes.duck.gain.rampTo(on ? 0.08 : 1, on ? 0.06 : 0.45);
}

export async function play() {
  if (!state.analysis) return;
  await ensureAudio();
  const transport = Tone.getTransport();
  if (state.repeatId === null) {
    state.step = 0;
    transport.position = 0;
    state.repeatId = transport.scheduleRepeat(onStep, STEP, 0);
  }
  transport.start('+0.05');
  state.playing = true;
}

export function pause() {
  Tone.getTransport().pause();
  state.playing = false;
  silence();
}

export function stop() {
  const transport = Tone.getTransport();
  transport.stop();
  if (state.repeatId !== null) transport.clear(state.repeatId);
  state.repeatId = null;
  state.step = 0;
  state.playing = false;
  silence();
}

export const isPlaying = () => state.playing;

// --- Niveles para la animación ----------------------------------------------------
// 64 bins de ~350–375 Hz (según la frecuencia de muestreo). Bandas en escala
// logarítmica: ~0–375 Hz, 375–750, 750–1500, 1500–3000 y 3000–9000 Hz.
const BAND_BINS = [[0, 1], [1, 2], [2, 4], [4, 8], [8, 24]];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// dB → 0..1 dentro de una ventana perceptiva. La ganancia lineal pura (dbToGain) da
// ~0,01–0,05 con esta música, y la animación casi no se movería.
const fromDb = (db, [floor, ceil]) => clamp01((db - floor) / (ceil - floor));
const LEVEL_DB = [-50, -15];
const BAND_DB = [-85, -35];
const SILENT = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, bands: [0, 0, 0, 0, 0] });

// Devuelve { level, bass, mid, high, bands[5] } normalizados de 0 a 1.
export function getAudioLevels() {
  if (!nodes) return SILENT;
  const level = fromDb(nodes.meter.getValue(), LEVEL_DB);
  const spectrum = nodes.fft.getValue(); // dB por bin
  const bands = BAND_BINS.map(([a, b]) => {
    let sum = 0;
    for (let i = a; i < b; i++) sum += fromDb(spectrum[i], BAND_DB);
    return sum / (b - a);
  });
  return { level, bass: bands[0], mid: (bands[1] + bands[2] + bands[3]) / 3, high: bands[4], bands };
}

// Modo exploración: la celda suena al instante.
export async function playCell(cell) {
  if (!state.analysis) return;
  await ensureAudio();
  const m = state.mapped[cell.row * state.analysis.cols + cell.col];
  const now = Tone.immediate() + 0.01;
  nodes.panner.pan.setValueAtTime(m.pan, now);
  playMapped(m, now, 0.7);
  const arrangement = (SOUND_STYLES[state.soundStyle] ?? DEFAULT_SOUND_STYLE).arrangement;
  if (arrangement === 'chords') {
    nodes.accompaniment.triggerAttackRelease(
      [m.note, Tone.Frequency(m.note).transpose(7).toNote()],
      0.5,
      now,
      0.16,
    );
  } else if (arrangement === 'pulse') {
    nodes.pulse.triggerAttackRelease('C3', '16n', now, 0.22);
  }
}
