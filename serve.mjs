import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4317);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer((req, res) => {
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (relative.endsWith('/')) relative += 'index.html';
  const file = path.resolve(root, '.' + relative);
  const allowed = new Set(['index.html', 'style.css', 'app.js', 'data.json', 'images.json']);
  const within = path.relative(root, file);
  if (!allowed.has(within) && !/^images[\\/][0-9]{3}\.jpg$/.test(within)) {
    res.writeHead(404).end('Not found'); return;
  }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  });
}).listen(port, '127.0.0.1', () => console.log(`FlexLab: http://127.0.0.1:${port}`));
