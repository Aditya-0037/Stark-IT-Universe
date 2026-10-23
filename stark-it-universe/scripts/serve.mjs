import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.pdf': 'application/pdf' };
const legacy = new Map([['/about/', '/about-us/'], ['/contact/', '/contact-us/']]);
export const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, `http://localhost:${port}`); decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  const pathname = decodeURIComponent(url.pathname);
  const pretty = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (legacy.has(pretty)) { res.writeHead(301, { Location: legacy.get(pretty) + url.search }); res.end(); return; }
  let file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) { res.writeHead(403); res.end(); return; }
  let status = 200;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/${url.search}` }); res.end(); return; }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { file = path.join(root, '404.html'); status = 404; }
  res.writeHead(status, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log(`SIU production preview: http://localhost:${port}`));
