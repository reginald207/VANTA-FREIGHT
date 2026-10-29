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
import { SERVICES } from '../src/data/services.js';

const root = resolve(import.meta.dirname, '..');
const ROUTES = [
  '/',
  '/services/',
  ...SERVICES.map(({ slug }) => `/services/${slug}/`),
  '/fleet/',
  '/about/',
  '/tracking/',
  '/contact/',
  '/404.html',
];

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

  for (const path of ROUTES) {
    test(`${path} has a heading outline without skipped levels`, async () => {
      const { page, context } = await open(path, { context: { javaScriptEnabled: false } });
      const levels = await page.$$eval('main h1, main h2, main h3, main h4, main h5, main h6', (els) =>
        els.map((el) => Number(el.tagName[1])),
      );
      assert.equal(levels[0], 1, 'starts with the h1');
      levels.slice(1).forEach((level, index) => {
        assert.ok(level <= levels[index] + 1, `h${levels[index]} is followed by h${level}`);
      });
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

// Gzipped size of every script a page loads, as a browser actually fetches it.
async function loadedScriptKb(path, browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const bodies = [];
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    bodies.push(response.body().then((body) => gzipSync(body).length).catch(() => 0));
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const sizes = await Promise.all(bodies);
  await context.close();
  return sizes.reduce((sum, size) => sum + size, 0) / 1024;
}

describe('bundle budgets (gzipped JS actually loaded)', () => {
  let noGpu;
  before(async () => {
    noGpu = await chromium.launch({ args: ['--disable-3d-apis'] });
  });
  after(async () => {
    await noGpu?.close();
  });

  test('home, without the 3D stage, stays under 60 KB', async () => {
    const kb = await loadedScriptKb('/', noGpu);
    assert.ok(kb <= 60, `home loads ${kb.toFixed(1)} KB`);
  });

  for (const path of ROUTES.filter((route) => route !== '/')) {
    test(`${path} stays under 40 KB`, async () => {
      const kb = await loadedScriptKb(path, noGpu);
      assert.ok(kb <= 40, `${path} loads ${kb.toFixed(1)} KB`);
    });
  }

  test('the home 3D stage adds at most 220 KB', async () => {
    const [withStage, without] = await Promise.all([loadedScriptKb('/?tier=2', browser), loadedScriptKb('/', noGpu)]);
    assert.ok(withStage - without <= 220, `3D adds ${(withStage - without).toFixed(1)} KB`);
  });
});

describe('content and honesty', () => {
  const dist = resolve(root, 'dist');
  const htmlFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? htmlFiles(resolve(dir, entry.name))
        : entry.name.endsWith('.html')
          ? [resolve(dir, entry.name)]
          : [],
    );

  test('no page makes claims a fictional company cannot back up', () => {
    const banned = /\b(ISO ?\d{3,}|certified|award[- ]winning|guaranteed?|trusted by|industry[- ]leading|market[- ]leading|#1|number one|years of experience)\b/i;
    for (const file of htmlFiles(dist)) {
      const text = readFileSync(file, 'utf8')
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<[^>]+>/g, ' ');
      const match = text.match(banned);
      assert.equal(match, null, `${file.replace(dist, '')} says "${match?.[0]}"`);
    }
  });

  test('every page carries the fictional-company notice', () => {
    for (const file of htmlFiles(dist)) {
      assert.match(readFileSync(file, 'utf8'), /VANTA FREIGHT is a fictional company/, file.replace(dist, ''));
    }
  });

  test('every service has a built page with its own title', () => {
    for (const service of SERVICES) {
      const html = readFileSync(resolve(dist, 'services', service.slug, 'index.html'), 'utf8');
      assert.match(html, new RegExp(`<title>${service.name} · Services`));
      assert.match(html, /class="route-map__leg"/);
    }
  });

  test('every third-party credit on /about/ is listed in ASSET_MANIFEST.md', async () => {
    const { CREDITS } = await import('../src/data/credits.js');
    const manifest = readFileSync(resolve(root, 'ASSET_MANIFEST.md'), 'utf8').toLowerCase();
    const about = readFileSync(resolve(dist, 'about/index.html'), 'utf8');
    CREDITS.forEach((credit) => {
      assert.ok(about.includes(credit.name.replace(/"/g, '&quot;')), `${credit.name} on /about/`);
      if (credit.manifest) assert.ok(manifest.includes(credit.manifest), `${credit.manifest} in the manifest`);
    });
  });
});

describe('fleet viewer', () => {
  test('without WebGL the class buttons swap the poster', async () => {
    const noGpu = await chromium.launch({ args: ['--disable-3d-apis'] });
    const { page, context, errors } = await open('/fleet/', { browserInstance: noGpu });
    await stageSettled(page, 'poster');
    await page.click('[data-variant="rigid"]');
    assert.equal(await page.getAttribute('[data-variant="rigid"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('[data-variant="semi"]', 'aria-pressed'), 'false');
    assert.match(await page.getAttribute('.turntable__poster img', 'src'), /fleet-rigid\.jpg$/);
    assert.match(await page.getAttribute('.turntable__poster img', 'alt'), /VF-02/);
    assert.equal(await page.locator('.turntable__viewport[role="slider"]').count(), 0);
    assert.ok(!(await page.locator('.turntable__hint').isVisible()), 'no drag hint without the 3D viewer');
    assert.deepEqual(errors, []);
    await context.close();
    await noGpu.close();
  });

  test('live, the viewer is a keyboard slider and switches classes', async () => {
    const { page, context, errors } = await open('/fleet/?tier=2');
    await stageSettled(page, 'live');
    const slider = page.locator('.turntable__viewport');
    assert.equal(await slider.getAttribute('role'), 'slider');
    await slider.focus();
    const before = Number(await slider.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight');
    const after = Number(await slider.getAttribute('aria-valuenow'));
    assert.equal((after - before + 360) % 360, 15);
    assert.match(await slider.getAttribute('aria-valuetext'), /degrees/);
    // Focus stopped the auto-rotation: the value holds still.
    await page.waitForTimeout(1500);
    await page.keyboard.press('ArrowLeft');
    assert.equal(Number(await slider.getAttribute('aria-valuenow')), before);
    await page.click('[data-variant="tractor"]');
    assert.match(await slider.getAttribute('aria-label'), /VF-03/);
    assert.ok(await page.locator('.turntable__hint').isVisible());
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('content pages without motion', () => {
  test('reveal items are visible without JavaScript and with reduced motion', async () => {
    for (const options of [{ javaScriptEnabled: false }, { reducedMotion: 'reduce' }]) {
      const { page, context } = await open('/services/linehaul/', { context: options });
      const hidden = await page.$$eval('[data-reveal]', (els) =>
        els.filter((el) => getComputedStyle(el).opacity !== '1').length,
      );
      assert.equal(hidden, 0, JSON.stringify(options));
      await context.close();
    }
  });
});
