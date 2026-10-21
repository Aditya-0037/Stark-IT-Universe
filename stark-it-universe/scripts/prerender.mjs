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

const { render } = await import(pathToFileURL(path.join(ssrDir, entry)).href);
const html = fs.readFileSync(distHtml, 'utf8');
if (!html.includes('<!--app-html-->')) throw new Error('Missing <!--app-html--> marker in dist/index.html');

fs.writeFileSync(distHtml, html.replace('<!--app-html-->', render()));
fs.rmSync(ssrDir, { recursive: true, force: true });
console.log('Pre-rendered dist/index.html');
