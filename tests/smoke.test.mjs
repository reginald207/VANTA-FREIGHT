// Smoke tests for milestone M1. Run with `npm run test:smoke` (builds first).
// Uses Playwright against `vite preview` of the production build.
//
// Note: headless Chromium here renders WebGL in software (SwiftShader). It is
// not flagged as a performance caveat, so the default load goes live; tests
// that need a specific tier force it (`?tier=1|2`) or disable WebGL outright.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { HUBS, LANES } from '../src/data/network.js';

const root = resolve(import.meta.dirname, '..');
const ROUTES = ['/', '/services/', '/fleet/', '/about/', '/tracking/', '/contact/', '/404.html'];

let server;
let browser;
let base;

before(async () => {
  server = await preview({ root, logLevel: 'error', preview: { port: 0 } });
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

// Opens a page and records uncaught exceptions and console errors.
async function open(path, { context: contextOptions = {}, browserInstance = browser } = {}) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  return { page, context, errors };
}

// Scrolls to scene-local time t (0-1 across the scene's sticky span) and lets
// the scrubbed film catch up.
async function scrollToScene(page, scene, t) {
  await page.evaluate(
    ([name, local]) => {
      const el = document.querySelector(`[data-scene="${name}"]`);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + local * Math.max(0, el.offsetHeight - window.innerHeight));
    },
    [scene, t],
  );
  await page.waitForTimeout(1800);
}

const stageOpacity = (page) =>
  page.evaluate(() => Number(getComputedStyle(document.querySelector('canvas.vf-stage')).opacity));

const stageSettled = (page, value) =>
  page.waitForFunction((expected) => document.documentElement.dataset.vfStage === expected, value, {
    timeout: 30_000,
  });

describe('every route', () => {
  for (const path of ROUTES) {
    test(`${path} renders with one h1, landmarks and no errors`, async () => {
      const { page, context, errors } = await open(path);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('main#main').count(), 1);
      assert.equal(await page.locator('header.site-header nav[aria-label="Main"]').count(), 1);
      assert.match(await page.locator('.site-footer__notice').innerText(), /fictional company/i);
      assert.deepEqual(errors, []);
      await context.close();
    });

    test(`${path} has no horizontal overflow at 320px`, async () => {
      const { page, context } = await open(path, { context: { viewport: { width: 320, height: 640 } } });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
      await context.close();
    });
  }

  test('section pages mark the current nav link', async () => {
    const { page, context } = await open('/fleet/');
    assert.equal(await page.locator('.site-nav a[aria-current="page"]').getAttribute('href'), '/fleet/');
    await context.close();
  });
});

describe('home tiers', () => {
  test('no WebGL2: the detector picks the poster (Tier 1)', async () => {
    const noGpu = await chromium.launch({ args: ['--disable-3d-apis'] });
    const { page, context, errors } = await open('/', { browserInstance: noGpu });
    await stageSettled(page, 'poster');
    assert.equal(await page.getAttribute('html', 'data-vf-tier'), '1');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /no-webgl2/);
    assert.equal(await page.locator('canvas.vf-stage').count(), 0);
    assert.ok(await page.locator('.hero__poster img').evaluate((img) => img.complete && img.naturalWidth > 0));
    assert.deepEqual(errors, []);
    await context.close();
    await noGpu.close();
  });

  test('?tier=1 forces the poster for QA', async () => {
    const { page, context } = await open('/?tier=1');
    await stageSettled(page, 'poster');
    assert.equal(await page.locator('canvas.vf-stage').count(), 0);
    await context.close();
  });

  test('forced Tier 2 runs the live film', async () => {
    const { page, context, errors } = await open('/?tier=2');
    await stageSettled(page, 'live');
    assert.equal(await page.getAttribute('html', 'data-vf-tier'), '2');
    assert.equal(await page.locator('canvas.vf-stage').count(), 1);
    const departure = await page.locator('.departure').evaluate((el) => el.offsetHeight / window.innerHeight);
    assert.ok(departure > 2, 'departure becomes a tall sticky track');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero__poster')).opacity === '0');
    // Scrub to the end of the film and back without errors.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.5));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('the film plays through every scene and back', async () => {
    const { page, context, errors } = await open('/?tier=2');
    await stageSettled(page, 'live');

    await scrollToScene(page, 'network', 0.95);
    const labels = await page.evaluate(() => Number(document.querySelector('.network-labels').style.opacity));
    assert.ok(labels > 0.5, `network labels visible (${labels})`);

    await scrollToScene(page, 'cargo', 1);
    assert.equal(await page.locator('.cargo-item.is-active').count(), 1);

    await scrollToScene(page, 'track', 0.5);
    assert.ok((await stageOpacity(page)) < 0.5, 'stage dims behind the tracking preview');

    await scrollToScene(page, 'arrival', 0.4);
    assert.ok((await stageOpacity(page)) > 0.9, 'stage returns for the arrival');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1800);
    assert.ok((await stageOpacity(page)) < 0.05, 'stage fades out before the footer');

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1800);
    assert.ok((await stageOpacity(page)) > 0.95, 'stage is back for the hero');
    assert.equal(await page.locator('.network-labels').evaluate((el) => el.style.opacity), '0');
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('Tier 1 shows the static network map, and the stats match the data', async () => {
    const { page, context, errors } = await open('/?tier=1');
    await stageSettled(page, 'poster');
    assert.ok(await page.locator('.network-map').isVisible());
    assert.equal(await page.locator('.network-map__hub').count(), HUBS.length);
    assert.equal(await page.locator('.network-map__lane').count(), LANES.length);
    const counts = await page.$$eval('[data-count]', (els) => els.map((el) => Number(el.dataset.count)));
    assert.deepEqual(counts.slice(0, 2), [HUBS.length, LANES.length]);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('the Reduce motion toggle switches to the poster and persists', async () => {
    const { page, context, errors } = await open('/?tier=2');
    await stageSettled(page, 'live');
    const toggle = page.locator('.motion-toggle');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await toggle.click();
    await stageSettled(page, 'poster');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /reduced-motion/);

    // Persists across a reload (an unforced load honours the stored choice).
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await stageSettled(page, 'poster');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /reduced-motion/);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('vf-reduced-motion')));

    // Turning it off reloads into the full experience.
    await Promise.all([page.waitForEvent('load'), page.locator('.motion-toggle').click()]);
    assert.equal(await page.evaluate(() => localStorage.getItem('vf-motion')), 'allow');
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('losing the WebGL context swaps back to the poster', async () => {
    const { page, context, errors } = await open('/?tier=2');
    await stageSettled(page, 'live');
    await page.evaluate(() =>
      document.querySelector('canvas.vf-stage').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(),
    );
    await stageSettled(page, 'poster');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /context-lost/);
    assert.equal(await page.locator('canvas.vf-stage').count(), 0);
    assert.ok(await page.locator('.hero__poster').isVisible());
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('WebGL disabled entirely still yields the poster, even when Tier 2 is forced', async () => {
    const noGpu = await chromium.launch({ args: ['--disable-3d-apis'] });
    const { page, context } = await open('/?tier=2', { browserInstance: noGpu });
    await stageSettled(page, 'poster');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /stage-error/);
    assert.ok(await page.locator('.hero__poster').isVisible());
    await context.close();
    await noGpu.close();
  });

  test('reduced motion: no film, no pinning, content visible immediately', async () => {
    const { page, context, errors } = await open('/', { context: { reducedMotion: 'reduce' } });
    await stageSettled(page, 'poster');
    assert.match(await page.getAttribute('html', 'data-vf-tier-reason'), /reduced-motion/);
    const departure = await page.locator('.departure').evaluate((el) => el.offsetHeight / window.innerHeight);
    assert.ok(departure < 1.6, `departure is ${departure.toFixed(2)} viewports tall`);
    const hidden = await page.$$eval('[data-intro], .statement', (els) =>
      els.filter((el) => getComputedStyle(el).opacity !== '1').length,
    );
    assert.equal(hidden, 0);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('without JavaScript the full story is still readable', async () => {
    const { page, context } = await open('/', { context: { javaScriptEnabled: false } });
    assert.ok(await page.locator('h1').isVisible());
    assert.equal(await page.locator('.statement').count(), 3);
    assert.ok(await page.locator('.statement').first().isVisible());
    assert.ok(await page.locator('.hero__poster img').evaluate((img) => img.complete && img.naturalWidth > 0));
    await context.close();
  });
});

describe('keyboard and navigation', () => {
  test('first Tab reveals the skip link, which moves focus to main', async () => {
    const { page, context } = await open('/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link').first();
    assert.ok(await skip.evaluate((el) => el === document.activeElement));
    await page.waitForTimeout(250);
    const top = await skip.evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(top >= 0, 'skip link is on screen when focused');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main');
    await context.close();
  });

  test('"Skip the film" jumps straight to the final chapter', async () => {
    const { page, context } = await open('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Skip the film');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'arrival');
    await context.close();
  });

  test('skip links are fully off screen until focused', async () => {
    const { page, context } = await open('/');
    const bottoms = await page.$$eval('.skip-link', (els) => els.map((el) => el.getBoundingClientRect().bottom));
    bottoms.forEach((bottom) => assert.ok(bottom <= 0, `skip link visible (bottom ${bottom}px)`));
    await context.close();
  });

  test('mobile menu opens, closes with Escape and returns focus', async () => {
    const { page, context } = await open('/about/', { context: { viewport: { width: 390, height: 844 } } });
    const toggle = page.locator('.nav-toggle');
    assert.ok(!(await page.locator('#site-nav').isVisible()));
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(await page.locator('#site-nav').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(await toggle.evaluate((el) => el === document.activeElement));
    await context.close();
  });
});

describe('bundle budgets', () => {
  const assets = resolve(root, 'dist/assets');
  const files = readdirSync(assets);
  const gzipKb = (file) => gzipSync(readFileSync(resolve(assets, file))).length / 1024;

  test('home entry stays under 60 KB gzip and excludes three.js', () => {
    const entry = files.find((file) => /^home-.*\.js$/.test(file));
    assert.ok(entry, 'home entry chunk exists');
    assert.ok(gzipKb(entry) <= 60, `home entry is ${gzipKb(entry).toFixed(1)} KB`);
    assert.ok(!readFileSync(resolve(assets, entry), 'utf8').includes('WebGLRenderer'));
  });

  test('lazy 3D chunks stay under 220 KB gzip', () => {
    const chunks = files.filter((file) => /^(home-scene|procedural-truck)-.*\.js$/.test(file));
    const total = chunks.reduce((sum, file) => sum + gzipKb(file), 0);
    assert.ok(chunks.length >= 1);
    assert.ok(total <= 220, `3D chunks total ${total.toFixed(1)} KB`);
  });
});
