#!/usr/bin/env node
/**
 * Converts the WAV sound effects into compressed web formats.
 *
 * Input:  public/assets/sounds/*.wav (original assets, kept as source of truth)
 * Output: public/assets/generated/sounds/<name>.ogg (Vorbis) and <name>.m4a (AAC)
 *
 * The runtime picks the first format the browser can play (`canPlayType`).
 * Uses the ffmpeg binary from the `ffmpeg-static` dev dependency, so no system-wide
 * install is required. Outputs are committed: a clean checkout never needs this script.
 *
 * Usage: npm run assets:audio [-- --force]
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputDir = path.join(root, 'public/assets/sounds');
const outputDir = path.join(root, 'public/assets/generated/sounds');
const force = process.argv.includes('--force');

const FORMATS = [
  { ext: 'ogg', args: ['-c:a', 'libvorbis', '-q:a', '4'] },
  { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'] },
];

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}\n${stderr}`)),
    );
  });
}

async function isUpToDate(source, target) {
  try {
    const [s, t] = await Promise.all([stat(source), stat(target)]);
    return t.mtimeMs >= s.mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary for this platform.');
  await mkdir(outputDir, { recursive: true });

  const files = (await readdir(inputDir)).filter((f) => f.endsWith('.wav')).sort();
  let inputBytes = 0;
  let outputBytes = { ogg: 0, m4a: 0 };

  for (const file of files) {
    const source = path.join(inputDir, file);
    const name = path.basename(file, '.wav');
    inputBytes += (await stat(source)).size;

    for (const format of FORMATS) {
      const target = path.join(outputDir, `${name}.${format.ext}`);
      if (force || !(await isUpToDate(source, target))) {
        await run([
          '-y',
          '-loglevel',
          'error',
          '-i',
          source,
          '-map_metadata',
          '-1',
          ...format.args,
          target,
        ]);
      }
      outputBytes[format.ext] += (await stat(target)).size;
    }
    console.log(`  ${name}`);
  }

  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
  console.log(
    `Converted ${files.length} files. WAV ${kb(inputBytes)} -> OGG ${kb(outputBytes.ogg)} / M4A ${kb(outputBytes.m4a)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
