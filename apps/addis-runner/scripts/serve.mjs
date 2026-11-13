// Tiny static server (ES modules do not load from file://). `npm start`, then open http://localhost:5173
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('..', import.meta.url).pathname, types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const f = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'text/html' }); res.end(f); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(5173, () => console.log('Addis Runner on http://localhost:5173'));
