// Prepara fotogramas locales de animaciones 3D NASA para poder analizarlos con Canvas
// en GitHub Pages. Se elige la versión no narrada y se descartan cuadros con texto OCR.
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCallback);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(ROOT, 'public', 'data', 'svs-snapshot.json');
const SAMPLE_COUNT = 24;

const secureUrl = (url = '') => url.replace(/^http:\/\//, 'https://');
const stripHtml = (text = '') => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function mediaFor(details) {
  const groups = details.media_groups ?? [];
  const context = stripHtml(`${details.title ?? ''} ${details.description ?? ''} ${groups.map((g) => g.description ?? '').join(' ')}`);
  if (!/\b3d\b|three-dimensional|three dimensional/i.test(context)) return null;
  const group = groups.find((g) => /non-narrated/i.test(stripHtml(g.description)) &&
    (g.items ?? []).some(({ instance }) => instance?.media_type === 'Movie'));
  const sources = (group?.items ?? []).map(({ instance }) => instance).filter((m) =>
    m?.media_type === 'Movie' && /\.(webm|mp4)$/i.test(m.filename ?? ''),
  );
  sources.sort((a, b) => (a.width === 1920 ? 0 : 1) - (b.width === 1920 ? 0 : 1) ||
    (/\.webm$/i.test(a.filename) ? 0 : 1) - (/\.webm$/i.test(b.filename) ? 0 : 1));
  return sources[0] ? { source: secureUrl(sources[0].url), filename: sources[0].filename } : null;
}

async function extractOne(videoPath, seconds, outPath) {
  await execFile('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-ss', String(seconds), '-i', videoPath,
    '-frames:v', '1', '-vf', 'scale=1024:-2', '-q:v', '4', '-y', outPath,
  ]);
}

async function hasReadableText(imagePath) {
  const { stdout } = await execFile('tesseract', [imagePath, 'stdout', '--psm', '11', 'tsv'], { maxBuffer: 2 * 1024 * 1024 });
  const minArea = 1024 * 576 * 0.001;
  return stdout.split(/\r?\n/).slice(1).some((line) => {
    const columns = line.split('\t');
    if (columns[0] !== '5' || Number(columns[10]) < 30 || !/[A-Za-z]{3,}/.test(columns[11] ?? '')) return false;
    return Number(columns[8]) * Number(columns[9]) >= minArea;
  });
}

async function prepare(details, source) {
  const temp = await mkdtemp(join(tmpdir(), `nasa-video-${details.id}-`));
  const videoPath = join(temp, 'source.webm');
  const outputDir = join(ROOT, 'public', 'video-frames', String(details.id));
  const manifestDir = join(ROOT, 'public', 'data', 'video-frames');
  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(manifestDir, { recursive: true })]);
  try {
    const response = await fetch(source.source, { signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error(`NASA video HTTP ${response.status}`);
    await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));
    const { stdout: durationText } = await execFile('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath,
    ]);
    const duration = Number(durationText.trim());
    if (!(duration > 0)) throw new Error('No se pudo leer la duración del video');

    const frames = [];
    let rejectedText = 0;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const timeSeconds = Math.round((duration - 2) * (i + 1) / (SAMPLE_COUNT + 1));
      const filename = `frame-${String(i + 1).padStart(2, '0')}.jpg`;
      const imagePath = join(outputDir, filename);
      await extractOne(videoPath, timeSeconds, imagePath);
      if (await hasReadableText(imagePath)) {
        rejectedText++;
        continue;
      }
      frames.push({ file: filename, timeSeconds });
    }
    if (frames.length < 5) throw new Error(`Solo quedaron ${frames.length} fotogramas sin texto tras OCR`);

    const manifest = {
      source: source.source,
      sourceFilename: source.filename,
      method: 'visual-features-from-sampled-video-frames',
      textDetection: 'tesseract-ocr; frames with detected text excluded',
      durationSeconds: duration,
      sampledFrameCount: frames.length,
      excludedTextFrameCount: rejectedText,
      frames,
    };
    await writeFile(join(manifestDir, `${details.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`✓ ${details.id}: ${frames.length} fotogramas limpios (${rejectedText} con texto excluidos)`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function main() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  const entries = Object.values(snapshot.items ?? {}).flatMap((details) => {
    const source = mediaFor(details);
    return source ? [{ details, source }] : [];
  });
  if (!entries.length) throw new Error('La copia del API no contiene videos 3D no narrados');
  for (const entry of entries) await prepare(entry.details, entry.source);
}

main().catch((error) => {
  console.error(`No se pudieron preparar los fotogramas NASA: ${error.message}`);
  process.exitCode = 1;
});
