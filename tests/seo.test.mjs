// The SEO plugin with a known site URL: builds into a temporary folder.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { build } from 'vite';
import { resolveSiteUrl } from '../plugins/seo.js';

const root = resolve(import.meta.dirname, '..');
const SITE = 'https://vanta.example';

describe('resolveSiteUrl', () => {
  test('prefers SITE_URL, then the Vercel production domain, else none', () => {
    assert.equal(resolveSiteUrl({ SITE_URL: 'https://a.example/', VERCEL_PROJECT_PRODUCTION_URL: 'b.example' }), 'https://a.example');
    assert.equal(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'b.example' }), 'https://b.example');
    assert.equal(resolveSiteUrl({}), null);
  });
});

describe('build with a site URL', () => {
  let outDir;
  const read = (file) => readFileSync(join(outDir, file), 'utf8');

  before(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'vf-seo-'));
    process.env.SITE_URL = SITE;
    try {
      await build({ root, logLevel: 'error', build: { outDir, emptyOutDir: true } });
    } finally {
      delete process.env.SITE_URL;
    }
  });
  after(() => rmSync(outDir, { recursive: true, force: true }));

  test('pages get canonical links and absolute Open Graph URLs', () => {
    const html = read('services/linehaul/index.html');
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/services/linehaul/"`));
    assert.match(html, new RegExp(`property="og:url" content="${SITE}/services/linehaul/"`));
    assert.match(html, new RegExp(`property="og:image" content="${SITE}/og/vanta-freight.jpg"`));
    assert.match(read('index.html'), new RegExp(`<link rel="canonical" href="${SITE}/"`));
  });

  test('the 404 page has no canonical link and is not in the sitemap', () => {
    assert.doesNotMatch(read('404.html'), /rel="canonical"/);
    assert.doesNotMatch(read('sitemap.xml'), /404/);
  });

  test('the sitemap lists every indexable page, and robots.txt points to it', () => {
    const sitemap = read('sitemap.xml');
    assert.equal(sitemap.match(/<url>/g).length, 10);
    assert.match(sitemap, new RegExp(`<loc>${SITE}/services/project-cargo/</loc>`));
    assert.match(read('robots.txt'), new RegExp(`Sitemap: ${SITE}/sitemap.xml`));
  });
});
