// Renders the static hero posters (Tier 0/1 fallback) from the live scene.
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
  { name: 'hero-desktop', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  { name: 'hero-mobile', viewport: { width: 450, height: 800 }, deviceScaleFactor: 2 },
];

function decode(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
  for (const { name, viewport, deviceScaleFactor } of variants) {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.on('pageerror', (error) => console.error(`[${name}]`, error.message));
    await page.goto(`${base}?capture=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__vfCapture === 'function', null, { timeout: 60_000 });

    const webp = await page.evaluate(() => window.__vfCapture('image/webp', 0.86));
    const jpeg = await page.evaluate(() => window.__vfCapture('image/jpeg', 0.84));
    if (!webp.startsWith('data:image/webp')) throw new Error('This browser cannot encode WebP');

    await writeFile(resolve(outDir, `${name}.webp`), decode(webp));
    await writeFile(resolve(outDir, `${name}.jpg`), decode(jpeg));
    console.log(`✓ ${name}: ${viewport.width * deviceScaleFactor}×${viewport.height * deviceScaleFactor}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
