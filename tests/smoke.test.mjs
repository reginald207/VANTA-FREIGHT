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
import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'vite';
import { HUBS, LANES } from '../src/data/network.js';
import { SERVICES } from '../src/data/services.js';

const root = resolve(import.meta.dirname, '..');

// Run against another engine with VF_BROWSER=firefox or VF_BROWSER=webkit.
const ENGINE = process.env.VF_BROWSER ?? 'chromium';
const engine = { chromium, firefox, webkit }[ENGINE];
if (!engine) throw new Error(`Unknown VF_BROWSER "${ENGINE}" (use chromium, firefox or webkit)`);

// A browser with WebGL switched off, or null where the engine has no switch.
function launchWithoutWebGL() {
  if (ENGINE === 'chromium') return chromium.launch({ args: ['--disable-3d-apis'] });
  if (ENGINE === 'firefox') return firefox.launch({ firefoxUserPrefs: { 'webgl.disabled': true } });
  return null;
}
const NO_WEBGL_SWITCH = `${ENGINE} has no setting to switch WebGL off`;
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
  browser = await engine.launch();
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

    for (const width of [320, 2560]) {
      test(`${path} has no horizontal overflow at ${width}px`, async () => {
        const { page, context } = await open(path, { context: { viewport: { width, height: width === 320 ? 640 : 1440 } } });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
        await context.close();
      });
    }
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
  test('no WebGL2: the detector picks the poster (Tier 1)', async (t) => {
    const noGpu = await launchWithoutWebGL();
    if (!noGpu) return t.skip(NO_WEBGL_SWITCH);
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

  test('yard traffic loads after the film goes live, without errors', async () => {
    const { page, context, errors } = await open('/?tier=2');
    const models = new Set();
    const warnings = [];
    page.on('response', (response) => {
      if (/\/models\/kenney\/[\w-]+\.glb$/.test(response.url()) && response.ok()) models.add(response.url());
    });
    page.on('console', (message) => {
      if (message.type() === 'warning' && /yard traffic/.test(message.text())) warnings.push(message.text());
    });
    await stageSettled(page, 'live');
    await page.waitForFunction(() => performance.getEntriesByType('resource').filter((e) => /models\/kenney/.test(e.name)).length >= 4, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    assert.equal(models.size, 4, 'four distinct vehicle models');
    assert.deepEqual(warnings, []);
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

  test('WebGL disabled entirely still yields the poster, even when Tier 2 is forced', async (t) => {
    const noGpu = await launchWithoutWebGL();
    if (!noGpu) return t.skip(NO_WEBGL_SWITCH);
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
  // Measured with WebGL off (no lazy 3D), or with ?tier=1 where WebGL can't
  // be switched off.
  let noGpu;
  let suffix = '';
  before(async () => {
    noGpu = await launchWithoutWebGL();
    if (!noGpu) {
      noGpu = browser;
      suffix = '?tier=1';
    }
  });
  after(async () => {
    if (noGpu !== browser) await noGpu?.close();
  });

  test('home, without the 3D stage, stays under 60 KB', async () => {
    const kb = await loadedScriptKb(`/${suffix}`, noGpu);
    assert.ok(kb <= 60, `home loads ${kb.toFixed(1)} KB`);
  });

  for (const path of ROUTES.filter((route) => route !== '/')) {
    test(`${path} stays under 40 KB`, async () => {
      const kb = await loadedScriptKb(`${path}${suffix}`, noGpu);
      assert.ok(kb <= 40, `${path} loads ${kb.toFixed(1)} KB`);
    });
  }

  test('the home 3D stage adds at most 220 KB', async () => {
    const [withStage, without] = await Promise.all([
      loadedScriptKb('/?tier=2', browser),
      loadedScriptKb(`/${suffix}`, noGpu),
    ]);
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

  test('the test-only model fixture never reaches the production build', () => {
    const walk = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)],
      );
    for (const file of walk(dist)) {
      assert.doesNotMatch(file, /cesium|fixtures/i, file);
      if (/\.(js|html)$/.test(file)) assert.doesNotMatch(readFileSync(file, 'utf8'), /cesium-milk-truck|truck=fixture/i, file);
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
  test('without WebGL the class buttons swap the poster', async (t) => {
    const noGpu = await launchWithoutWebGL();
    if (!noGpu) return t.skip(NO_WEBGL_SWITCH);
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

// Records every request a page makes from now on.
function recordRequests(page) {
  const requests = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
  return requests;
}

describe('simulated tracking', () => {
  test('a deep link shows a clearly labelled simulated result', async () => {
    const { page, context, errors } = await open('/tracking/?id=VF-DEMO-0001');
    assert.ok(await page.locator('.sim-banner').isVisible());
    const result = page.locator('.tracker__result');
    assert.ok(await result.isVisible());
    assert.match(await result.locator('.sim-banner__badge').innerText(), /^simulation$/i);
    assert.equal(await result.locator('.sim-banner__badge').evaluate((el) => getComputedStyle(el).textTransform), 'uppercase');
    assert.match(await result.locator('.shipment__status').innerText(), /in transit towards port kestrel/i);
    assert.equal(await result.locator('progress').getAttribute('value'), '62');
    assert.equal(await result.locator('.route-map__marker').count(), 1);
    assert.equal(await result.locator('[aria-current="step"]').count(), 1);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('tracking makes no network requests and is deterministic', async () => {
    const { page, context } = await open('/tracking/');
    const requests = recordRequests(page);
    const read = async (id) => {
      await page.fill('#shipment-id', id);
      await page.press('#shipment-id', 'Enter');
      return page.locator('.tracker__result').innerText();
    };
    const first = await read('vf-test-42');
    for (const id of ['VF-DEMO-0002', 'VF-DEMO-0003', 'VF-ANOTHER-1']) await read(id);
    const again = await read('VF-TEST-42');
    assert.equal(again, first, 'same ID, same story');
    assert.match(page.url(), /\?id=VF-TEST-42$/);
    await page.click('[data-demo-id="VF-DEMO-0002"]');
    assert.match(await page.locator('.tracker__status').innerText(), /Simulated result for VF-DEMO-0002/);
    assert.deepEqual(requests, []);
    await context.close();
  });

  test('an invalid ID is explained and focus returns to the field', async () => {
    const { page, context } = await open('/tracking/');
    await page.fill('#shipment-id', 'ABC');
    await page.press('#shipment-id', 'Enter');
    const input = page.locator('#shipment-id');
    assert.equal(await input.getAttribute('aria-invalid'), 'true');
    assert.match(await input.getAttribute('aria-describedby'), /shipment-id-error/);
    assert.ok(await page.locator('#shipment-id-error').isVisible());
    assert.ok(await input.evaluate((el) => el === document.activeElement));
    assert.ok(!(await page.locator('.tracker__result').isVisible()));
    await context.close();
  });

  test('without JavaScript the tracker is switched off and says why', async () => {
    const { page, context } = await open('/tracking/', { context: { javaScriptEnabled: false } });
    assert.ok(await page.locator('.tracker__fieldset').evaluate((el) => el.disabled));
    assert.match(await page.locator('noscript').first().innerHTML(), /needs JavaScript/);
    await context.close();
  });
});

describe('demo request form', () => {
  const fillQuote = async (page) => {
    await page.selectOption('#service', 'linehaul');
    await page.selectOption('#origin', 'northgate');
    await page.selectOption('#destination', 'kestrel');
    await page.fill('#readyDate', '2099-01-15');
    await page.fill('#pallets', '10');
    await page.fill('#name', 'Ada Example');
    await page.fill('#email', 'ada@example.com');
  };

  test('errors are summarised, linked and announced by focus', async () => {
    const { page, context, errors } = await open('/contact/');
    await page.click('.request__submit');
    const summary = page.locator('.error-summary');
    assert.ok(await summary.isVisible());
    assert.ok(await summary.evaluate((el) => el === document.activeElement), 'focus moves to the summary');
    assert.ok(!(await page.locator('.request__done').isVisible()));
    const links = summary.locator('a');
    assert.ok((await links.count()) >= 5);
    await links.first().click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'service');
    assert.equal(await page.getAttribute('#email', 'aria-invalid'), 'true');
    assert.match(await page.getAttribute('#email', 'aria-describedby'), /email-error/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('a valid request sends nothing, stores nothing and says so', async () => {
    const { page, context } = await open('/contact/');
    const requests = recordRequests(page);
    await page.click('.request__submit');
    await fillQuote(page);
    await page.click('.request__submit');
    const done = page.locator('.request__done');
    assert.ok(await done.isVisible());
    assert.ok(await done.evaluate((el) => el === document.activeElement));
    assert.match(await done.innerText(), /Nothing was sent/i);
    assert.ok(!(await page.locator('.request__form').isVisible()));
    assert.ok(!(await page.locator('.error-summary').isVisible()));
    assert.deepEqual(requests, [], 'no network requests');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.doesNotMatch(page.url(), /ada|example/i, 'nothing in the URL');

    await page.click('[data-restart]');
    assert.equal(await page.inputValue('#name'), '', 'the form was cleared');
    await context.close();
  });

  test('a question hides the load fields and needs a message', async () => {
    const { page, context } = await open('/contact/');
    await page.check('#type-question');
    assert.ok(!(await page.locator('.request__quote').isVisible()));
    await page.fill('#name', 'Ada');
    await page.fill('#email', 'ada@example.com');
    await page.click('.request__submit');
    assert.deepEqual(
      await page.$$eval('.error-summary a', (links) => links.map((link) => link.textContent)),
      ['Enter your question.'],
    );
    await context.close();
  });

  test('a service page link prefills the service', async () => {
    const { page, context } = await open('/contact/?service=expedited');
    assert.equal(await page.inputValue('#service'), 'expedited');
    await context.close();
  });

  test('without JavaScript the form is switched off, so nothing can be sent', async () => {
    const { page, context } = await open('/contact/', { context: { javaScriptEnabled: false } });
    assert.ok(await page.locator('.request__all').evaluate((el) => el.disabled));
    assert.match(await page.locator('noscript').first().innerHTML(), /nothing you type can be sent/);
    await context.close();
  });

  test('there are no real-looking contact details anywhere on the page', async () => {
    const { page, context } = await open('/contact/');
    const text = await page.locator('main').innerText();
    assert.doesNotMatch(text, /@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s()-]{8,}\d/i);
    await context.close();
  });
});

describe('accessibility audit (axe-core, WCAG 2.2 A and AA)', async () => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

  const audit = async (page, label) => {
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`,
    );
    assert.deepEqual(summary, [], `${label}:\n${summary.join('\n')}`);
  };

  // Audit what a reader sees: scroll through so reveals run, return to the
  // top, and let entrance animations finish.
  const settle = async (page) => {
    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1600);
  };

  for (const path of ROUTES) {
    test(`${path} has no WCAG A/AA violations`, async () => {
      // The home page is audited with its live film (forced: the container's
      // software WebGL may fall back), and separately as the static version.
      const { page, context } = await open(path === '/' ? '/?tier=2' : path);
      if (path === '/') await stageSettled(page, 'live');
      await settle(page);
      await audit(page, path);
      await context.close();
    });
  }

  test('interactive states have no violations', async () => {
    const { page, context } = await open('/tracking/?id=VF-DEMO-0001');
    await audit(page, 'tracking result');
    await page.fill('#shipment-id', 'bad');
    await page.press('#shipment-id', 'Enter');
    await audit(page, 'tracking error');
    await page.goto(`${base}/contact/`, { waitUntil: 'networkidle' });
    await page.click('.request__submit');
    await audit(page, 'form errors');
    await page.goto(`${base}/fleet/?tier=2`, { waitUntil: 'networkidle' });
    await stageSettled(page, 'live');
    await audit(page, 'fleet viewer live');
    await page.goto(`${base}/?tier=1`, { waitUntil: 'networkidle' });
    await settle(page);
    await audit(page, 'home static');
    await context.close();
  });
});

describe('security headers', () => {
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const site = Object.fromEntries(
    vercel.headers.find(({ source }) => source === '/(.*)').headers.map(({ key, value }) => [key, value]),
  );
  const csp = site['Content-Security-Policy'];
  const dist = resolve(root, 'dist');
  const pages = ROUTES.map((route) => resolve(dist, route === '/' ? 'index.html' : route.endsWith('/') ? `${route.slice(1)}index.html` : route.slice(1)));

  test('the CSP is strict: no unsafe-inline, unsafe-eval or wildcards; forms cannot submit', () => {
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
    assert.match(csp, /form-action 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  });

  test("the CSP's script hash matches the inline script on every page", async () => {
    const { createHash } = await import('node:crypto');
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      assert.ok(inline.length <= 1, `${file}: one inline script at most`);
      for (const script of inline) {
        const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
        assert.ok(csp.includes(hash), `${file}: inline script hash ${hash} is not in vercel.json`);
      }
      assert.doesNotMatch(html, /\sstyle="|<style[\s>]/, `${file} has inline styles`);
    }
  });

  test('the preview serves the production headers', async () => {
    const response = await fetch(`${base}/`);
    for (const [key, value] of Object.entries(site)) assert.equal(response.headers.get(key), value, key);
  });
});

describe('search and social metadata', () => {
  test('every page has Open Graph basics; robots.txt exists; 404 stays out', () => {
    const dist = resolve(root, 'dist');
    for (const route of ROUTES) {
      const file = route === '/' ? 'index.html' : route.endsWith('/') ? `${route.slice(1)}index.html` : route.slice(1);
      const html = readFileSync(resolve(dist, file), 'utf8');
      for (const property of ['og:title', 'og:description', 'og:site_name']) {
        assert.match(html, new RegExp(`property="${property}" content="[^"]+"`), `${file} ${property}`);
      }
      assert.match(html, /name="twitter:card" content="summary_large_image"/);
    }
    assert.match(readFileSync(resolve(dist, 'robots.txt'), 'utf8'), /User-agent: \*/);
    assert.match(readFileSync(resolve(dist, '404.html'), 'utf8'), /name="robots" content="noindex"/);
  });
});
