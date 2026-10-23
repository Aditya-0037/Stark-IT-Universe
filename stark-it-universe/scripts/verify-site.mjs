import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'seo-manifest.json'), 'utf8'));
const titles = new Set();
const descriptions = new Set();
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
let checkedLinks = 0;
for (const page of manifest) {
  const html = fs.readFileSync(path.join(root, page.file), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page.path}: one H1`);
  assert(!titles.has(page.title), `${page.path}: unique title`); titles.add(page.title);
  assert(!descriptions.has(page.description), `${page.path}: unique description`); descriptions.add(page.description);
  assert(html.includes(`href="${page.url}"`), `${page.path}: canonical`);
  assert(html.includes(`content="${page.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}"`), `${page.path}: robots`);
  assert.equal(sitemap.includes(`<loc>${page.url}</loc>`), !page.noindex, `${page.path}: sitemap eligibility`);
  assert(!/\[School name|\[Photo:|: confirm\]|Request received|50\+ schools|60,000\+/.test(html), `${page.path}: no unsupported proof or placeholders`);
  const json = html.match(/<script id="siu-schema" type="application\/ld\+json">(.*?)<\/script>/s);
  assert(json, `${page.path}: static structured data`);
  const graph = JSON.parse(json[1]);
  assert(graph['@graph'].some((node) => node['@type'] === 'LocalBusiness'), `${page.path}: business identity`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${page.path}: unique DOM ids`);
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const url = new URL(href, page.url);
    if (url.origin !== new URL(page.url).origin) continue;
    const targetPage = manifest.find((p) => p.path === url.pathname);
    const file = targetPage ? path.join(root, targetPage.file) : path.join(root, url.pathname);
    assert(fs.existsSync(file), `${page.path}: link target exists: ${href}`);
    if (url.hash && targetPage) {
      const target = fs.readFileSync(file, 'utf8');
      assert(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${page.path}: anchor exists: ${href}`);
    }
    checkedLinks++;
  }
}
console.log(`Verified ${manifest.length} documents: unique metadata, one H1, canonical URLs, schema, sitemap, DOM IDs and ${checkedLinks} internal links.`);
