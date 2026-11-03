#!/usr/bin/env node
// Live preview for a scene folder: bundles main.js with esbuild and serves it.
// Every page reload rebuilds, so edits show up immediately.
//
//   node serve.mjs <scene-dir> [port]      -> http://127.0.0.1:<port>/   (default port 5173)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '.');
const port = +(process.argv[3] || 5173);
if (!fs.existsSync(path.join(dir, 'main.js'))) { console.error(`no main.js in ${dir}`); process.exit(1); }

const req = createRequire(path.join(dir, 'x.js'));
let esbuild;
try { esbuild = req('esbuild'); } catch { console.error('esbuild not found: run `npm i three esbuild` in or above the scene folder'); process.exit(1); }

const bundle = () => esbuild.build({ entryPoints: [path.join(dir, 'main.js')], bundle: true, format: 'esm', outfile: path.join(dir, 'build/main.js'), logLevel: 'warning' });
fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
await bundle();
if (!fs.existsSync(path.join(dir, 'index.html'))) {
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${path.basename(dir)}</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><script type="module" src="./build/main.js"></script>`);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.json': 'application/json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream' };
http.createServer(async (q, res) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (url === '/build/main.js') { try { await bundle(); } catch (e) { console.log(e.message); } }
  const p = path.join(dir, url === '/' ? '/index.html' : url);
  if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`live: http://127.0.0.1:${port}/  (reload to rebuild, Space pauses, Ctrl+C stops)`));
