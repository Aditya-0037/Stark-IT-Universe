import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.PORT = '4175';
const { server } = await import('./serve.mjs');
if (!server.listening) await once(server, 'listening');
const base = 'http://localhost:4175';
const defaultBrowser = chromium.executablePath();
const executablePath = process.env.BROWSER_EXECUTABLE || (fs.existsSync(defaultBrowser) ? defaultBrowser : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await context.addInitScript(() => { localStorage.setItem('siu-lite', 'on'); window.dataLayer = []; });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && /hydration|react error|did not match/i.test(m.text())) errors.push(m.text()); });
const screenshots = path.resolve('docs/seo-preview');
fs.mkdirSync(screenshots, { recursive: true });
const manifest = JSON.parse(fs.readFileSync('dist/seo-manifest.json', 'utf8'));
try {
  for (const item of manifest) {
    const response = await page.goto(`${base}${item.path === '/404/' ? '/missing-page/' : item.path}`);
    assert.equal(response.status(), item.path === '/404/' ? 404 : 200, `${item.path}: status`);
    await page.locator('h1').waitFor();
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.title(), item.title);
    await page.waitForTimeout(50);
  }
  console.log(`PASS ${manifest.length} direct routes and hydration`);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/amc/', '/contact-us/', '/guides/smart-class-cost/']) {
      await page.goto(`${base}${route}`);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 1, `${route} at ${width}: overflow ${overflow}`);
    }
  }
  console.log('PASS responsive widths 1440, 768 and 390');
  await page.goto(`${base}/`);
  await page.locator('#service-smartclass .svc-card__flip').click();
  const card = page.locator('#service-smartclass');
  assert.equal(await card.getAttribute('data-flipped'), 'true');
  assert(await card.locator('.svc-card__details').isVisible());
  const cardBounds = await card.boundingBox();
  const linkBounds = await card.locator('.svc-card__details').boundingBox();
  assert(linkBounds.y + linkBounds.height <= cardBounds.y + cardBounds.height + 1, 'Service detail link fits the flipped card');
  await card.getByRole('button', { name: 'Get a quote for this' }).click();
  assert.equal(await page.locator('#qf-service').inputValue(), 'Smart class setup');
  console.log('PASS service card content and homepage quote prefill');
  await page.goto(`${base}/contact-us/?service=Digital%20board%20repair#quote-form`);
  await page.locator('#qf-service').waitFor();
  assert.equal(await page.locator('#qf-service').inputValue(), 'Digital board repair');
  await page.getByRole('button', { name: 'Prepare WhatsApp enquiry' }).click();
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 4);
  assert.equal(await page.locator(':focus').getAttribute('name'), 'name');
  for (const [key, value] of Object.entries({ name: 'Test Coordinator', school: 'Test School', mobile: '123', city: 'Ghaziabad' })) await page.locator(`#qf-${key}`).fill(value);
  await page.getByRole('button', { name: 'Prepare WhatsApp enquiry' }).click();
  assert.equal(await page.locator(':focus').getAttribute('name'), 'mobile');
  await page.locator('#qf-mobile').fill('+91 98765 43210');
  await page.locator('#qf-source').selectOption('ChatGPT');
  await page.getByRole('button', { name: 'Prepare WhatsApp enquiry' }).click();
  const draft = new URL(await page.getByRole('link', { name: 'Open draft in WhatsApp' }).getAttribute('href')).searchParams.get('text');
  assert(draft.includes('Test School') && draft.includes('Digital board repair') && draft.includes('ChatGPT'));
  assert.equal(await page.locator('#qf-name').inputValue(), 'Test Coordinator');
  const events = await page.evaluate(() => window.dataLayer);
  assert(events.some((e) => e.event === 'quote_draft_prepared'));
  await page.locator('#qf-message').fill('Updated requirement');
  assert.equal(await page.getByRole('link', { name: 'Open draft in WhatsApp' }).count(), 0);
  console.log('PASS validation, focus, source attribution, retained values and WhatsApp draft (no message sent)');
  await page.goto(`${base}/contact-us/?request=visit#quote-form`);
  await page.waitForFunction(() => document.querySelector('#qf-message').value.includes('site visit'));
  console.log('PASS site visit prefill');
  await page.goto(`${base}/guides/smart-class-cost/`);
  for (const [key, value] of Object.entries({ rooms: '2', equipment: '100000', installation: '5000', amc: '10000', tax: '18' })) await page.locator(`#budget-${key}`).fill(value);
  assert((await page.locator('.budget-tool__result').innerText()).includes('2,71,400'));
  await page.locator('#budget-rooms').fill('1.5');
  assert((await page.locator('.budget-tool__result').innerText()).includes('whole number'));
  console.log('PASS budget totals, Indian number formatting and invalid room count');
  const download = await page.request.get(`${base}/downloads/siu-amc-scope-sample.pdf`);
  assert.equal(download.status(), 200); assert((await download.body()).subarray(0, 4).toString() === '%PDF');
  const redirect = await page.request.get(`${base}/about?ref=test`, { maxRedirects: 0 });
  assert.equal(redirect.status(), 301); assert.equal(redirect.headers().location, '/about-us/?ref=test');
  const botContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const bot = await botContext.newPage();
  for (const route of ['/', '/amc/', '/interactive-flat-panel/repair/']) {
    await bot.goto(base + route);
    assert.equal(await bot.locator('h1').count(), 1);
    assert(await bot.locator('main').innerText());
  }
  await botContext.close();
  console.log('PASS PDF, redirects and pages without JavaScript');
  for (const [route, name, width] of [['/', 'home-desktop', 1440], ['/amc/', 'amc-desktop', 1440], ['/contact-us/', 'contact-mobile', 390], ['/guides/smart-class-cost/', 'cost-mobile', 390]]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(base + route); await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(screenshots, `${name}.png`), fullPage: route !== '/' });
  }
  assert.deepEqual(errors, [], 'No runtime or hydration errors');
  console.log(`PASS runtime checks; screenshots saved in ${screenshots}`);
} finally { await browser.close(); server.close(); }
