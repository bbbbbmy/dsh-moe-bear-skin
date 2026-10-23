// tools/inline-assets.mjs — bake a media file into lib/client.js as a data URI.
//
// The client bundle is served by `dsh-client-modules`, which only hands out
// `client*.js` chunks from a package — it will never serve a .mp4 out of
// assets/. So when the host-side asset route is unavailable (a shell loading the
// UI over file://, or a composition without a web server), the only channel the
// renderer is guaranteed to have is the bundle itself.
//
//   node tools/inline-assets.mjs --file assets/bear-loop.mp4
//   node tools/inline-assets.mjs --clear
//
// The generated block is delimited by INLINE_BEGIN / INLINE_END, so re-running
// this is idempotent.

import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientPath = join(root, 'lib', 'client.js');

const BEGIN = '    // >>> INLINE_BEGIN（tools/inline-assets.mjs 生成，勿手改）';
const END = '    // <<< INLINE_END';

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const fileIndex = args.indexOf('--file');
const mediaPath = resolve(root, fileIndex >= 0 ? args[fileIndex + 1] : 'assets/bear-loop.mp4');

const source = await readFile(clientPath, 'utf8');
const start = source.indexOf(BEGIN);
const finish = source.indexOf(END);
if (start < 0 || finish < 0) {
  console.error('INLINE_BEGIN / INLINE_END markers not found in lib/client.js');
  process.exit(1);
}

let block;
if (clear) {
  block = `${BEGIN}\n    const INLINE_WALLPAPER = '';\n${END}`;
} else {
  const bytes = readFileSync(mediaPath);
  const type = mediaPath.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
  block = `${BEGIN}\n    const INLINE_WALLPAPER = 'data:${type};base64,${bytes.toString('base64')}';\n${END}`;
  console.log(`source: ${mediaPath} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
}

const next = source.slice(0, start) + block + source.slice(finish + END.length);
await writeFile(clientPath, next);
console.log(`${clear ? 'cleared' : 'baked'} inline wallpaper; lib/client.js is ${(Buffer.byteLength(next) / 1024 / 1024).toFixed(2)} MB`);
