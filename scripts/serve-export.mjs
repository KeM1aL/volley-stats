#!/usr/bin/env node
// Serves the static export like the Capacitor shell will: a path is a file, or a folder's index.html.
// Usage: node scripts/serve-export.mjs [dir=out] [port=3200]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 3200);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function resolveFile(urlPath) {
  const file = path.join(root, decodeURIComponent(urlPath.split('?')[0]));
  if (!file.startsWith(root)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const index = path.join(file, 'index.html');
  return fs.existsSync(index) ? index : null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      fs.createReadStream(path.join(root, '404.html')).on('error', () => res.end()).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
