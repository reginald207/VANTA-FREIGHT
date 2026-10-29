// Renders the static posters (Tier 0/1 fallbacks) from the live scenes: the
// home hero, and one image per vehicle class for the fleet turntable. Then
// composes the 1200x630 social card (scripts/og-card.html) over the hero.
// Starts a Vite dev server, opens the home page in capture mode with
// Playwright, and encodes WebP + JPEG with the browser's own canvas encoder.
//
//   npm run posters
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'public/posters');

const variants = [
  { name: 'hero-desktop', path: '?capture=1', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  { name: 'hero-mobile', path: '?capture=1', viewport: { width: 450, height: 800 }, deviceScaleFactor: 2 },
  ...['semi', 'rigid', 'tractor'].map((variant) => ({
    name: `fleet-${variant}`,
    path: `fleet/?capture=${variant}`,
    // The fleet viewport is 16:9 inside the content column.
    viewport: { width: 1000, height: 900 },
    deviceScaleFactor: 2,
  })),
];

function decode(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
  for (const { name, path, viewport, deviceScaleFactor } of variants) {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.on('pageerror', (error) => console.error(`[${name}]`, error.message));
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__vfCapture === 'function', null, { timeout: 60_000 });

    const webp = await page.evaluate(() => window.__vfCapture('image/webp', 0.86));
    const jpeg = await page.evaluate(() => window.__vfCapture('image/jpeg', 0.84));
    if (!webp.startsWith('data:image/webp')) throw new Error('This browser cannot encode WebP');

    await writeFile(resolve(outDir, `${name}.webp`), decode(webp));
    await writeFile(resolve(outDir, `${name}.jpg`), decode(jpeg));
    const size = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return `${canvas.width}×${canvas.height}`;
    });
    console.log(`✓ ${name}: ${size}`);
    await page.close();
  }
  // Social card: screenshot the template once fonts and the new poster load.
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await card.goto(`${base}scripts/og-card.html`, { waitUntil: 'networkidle' });
  await card.evaluate(() => document.fonts.ready);
  await card.locator('.card').screenshot({ path: resolve(root, 'public/og/vanta-freight.jpg'), type: 'jpeg', quality: 86 });
  console.log('✓ og/vanta-freight.jpg: 1200×630');
} finally {
  await browser.close();
  await server.close();
}
