import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'
};

const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  const requested = path.resolve(root, `.${pathname}`);
  const filePath = requested === root || !requested.startsWith(`${root}${path.sep}`)
    ? path.join(root, 'index.html')
    : requested;
  const resolved = filePath === root ? path.join(root, 'index.html') : filePath;
  fs.stat(resolved, (error, stats) => {
    const actual = !error && stats.isFile() ? resolved : path.join(root, 'index.html');
    fs.readFile(actual, (readError, data) => {
      if (readError) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, {
        'Content-Type': types[path.extname(actual)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      response.end(data);
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`EduVideo Studio: http://127.0.0.1:${port}/`);
  console.log('Cross-origin isolation enabled for FFmpeg WASM.');
});
