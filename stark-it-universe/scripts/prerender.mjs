// Injects the server-rendered app into dist/index.html so every heading,
// paragraph, button and the form are real HTML before any JavaScript runs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const distHtml = path.join(root, 'dist', 'index.html');
const ssrDir = path.join(root, 'dist-ssr');
const entry = fs.readdirSync(ssrDir).find((f) => /^entry-server\.(m?js)$/.test(f));
if (!entry) throw new Error('SSR bundle not found in dist-ssr/');

const { render, renderHead, metadata, pagePaths, business } = await import(pathToFileURL(path.join(ssrDir, entry)).href);
const html = fs.readFileSync(distHtml, 'utf8');
if (!html.includes('<!--app-html-->')) throw new Error('Missing <!--app-html--> marker in dist/index.html');

if (!html.includes('<!--page-head-->')) throw new Error('Missing <!--page-head--> marker');
const manifest = [];
for (const route of [...pagePaths, '/404/']) {
  const output = route === '/' ? distHtml : route === '/404/' ? path.join(root, 'dist', '404.html') : path.join(root, 'dist', route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html.replace('<!--page-head-->', renderHead(route)).replace('<!--app-html-->', render(route)));
  manifest.push({ path: route, file: path.relative(path.join(root, 'dist'), output), ...metadata(route) });
}
const xmlEscape = (v) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const urls = manifest.filter((p) => !p.noindex).map((p) => `  <url><loc>${xmlEscape(p.url)}</loc></url>`).join('\n');
fs.writeFileSync(path.join(root, 'dist', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
fs.writeFileSync(path.join(root, 'dist', 'robots.txt'), `User-agent: *\n${business.indexable ? 'Allow: /' : 'Disallow: /'}\n\nSitemap: ${business.origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(root, 'dist', 'seo-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Pre-rendered ${pagePaths.length} pages and 404.html; generated sitemap.xml and robots.txt`);
