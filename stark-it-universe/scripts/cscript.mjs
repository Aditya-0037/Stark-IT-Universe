// Colour-script captures: one hold frame per scene (FULL, 1920x994), plus the night samples.
// node cscript.mjs <url> <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const [, , url = 'http://localhost:4173/?nosnap', outDir = '../cs'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const W = +(process.env.W || 1920);
const H = +(process.env.H || 994);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('siu-lite', 'off'); sessionStorage.setItem('siu-intro-seen', '1'); });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.world === 'ready', null, { timeout: 40000 });
await page.waitForTimeout(1500);
const go = async (id, p, kind = 'pin', wait = 1800) => {
  await page.evaluate(
    ([id, p, kind]) => {
      const el = document.getElementById(id);
      const top = el.getBoundingClientRect().top + scrollY;
      const y = kind === 'pin' ? top + p * (el.offsetHeight - innerHeight) : top + p * innerHeight;
      window.scrollTo({ top: y, behavior: 'instant' });
    },
    [id, p, kind],
  );
  await page.waitForTimeout(wait);
};
// walk down so the camera path and lazy regions are followed
const shots = [
  ['01-hero', 'space', 0, 'top'],
  ['02-planets', 'planets', 0.1],
  ['03-route', 'route', 0.5],
  ['04-descent', 'descent', 0.3],
  ['05-campus', 'descent', 0.68],
  ['06-window', 'descent', 0.93],
  ['07-room', 'classroom', 0.1],
  ['08-switch-dark', 'switch-on', 0.5],
  ['09-switch-lit', 'switch-on', 0.5],
  ['10-build', 'build', 0, 'top'],
  ['11-proof', 'proof', 0.1, 'top'],
  ['12-contact', 'quote', 0, 'top'],
  ['13-footer', 'quote', 3, 'top'],
];
for (const [name, id, p, kind] of shots) {
  if (name === '02-planets') for (const q of [0.5, 1]) await go('space', q, 'top', 500);
  if (name === '04-descent') for (const q of [0.5, 1]) await go('route', q, 'pin', 700);
  if (name === '09-switch-lit') {
    await page.locator('#switch-on button:has-text("Switch on")').first().click();
    await page.waitForTimeout(4500);
  } else await go(id, p, kind === 'top' ? 'top' : 'pin');
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('shot', name);
}
await browser.close();
