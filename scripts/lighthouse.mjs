// Lighthouse budgets for every page (mobile, lab). Builds are served with
// `vite preview`, so pages are audited under the production headers.
//
//   npm run audit:lighthouse
//
// The live WebGL pages (home and fleet) are audited as their static tier for
// the budget, because lab CPUs (and this project's CI container, which has no
// GPU) make live-3D scores meaningless. Their live scores are still printed
// for reference: measure those on real devices.
//
// Each page runs RUNS times and the median score counts (as Lighthouse CI
// does), because single lab runs swing with CPU contention.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
import { preview } from 'vite';

const BUDGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 95 };
const RUNS = Number(process.env.VF_LH_RUNS ?? 3);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const PAGES = [
  { path: '/?tier=1', label: 'home (static)' },
  { path: '/services/' },
  { path: '/services/linehaul/' },
  { path: '/fleet/?tier=1', label: 'fleet (static)' },
  { path: '/about/' },
  { path: '/tracking/?id=VF-DEMO-0001' },
  { path: '/contact/' },
  // 404 is noindex by design, so its SEO score is not budgeted.
  { path: '/404.html', skip: ['seo'] },
  { path: '/?tier=2', label: 'home (live 3D)', report: true },
  { path: '/fleet/?tier=2', label: 'fleet (live 3D)', report: true },
];

const server = await preview({ root: import.meta.dirname + '/..', logLevel: 'error', preview: { port: 0 } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});

let failures = 0;
try {
  for (const { path, label = path, skip = [], report = false } of PAGES) {
    const runs = [];
    for (let run = 0; run < RUNS; run += 1) {
      const { lhr } = await lighthouse(`${base}${path}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: Object.keys(BUDGETS),
      });
      runs.push(lhr);
    }
    const scores = Object.fromEntries(
      Object.keys(BUDGETS).map((key) => [key, median(runs.map((r) => Math.round((r.categories[key]?.score ?? 0) * 100)))]),
    );
    // Metrics from the run with the median performance score.
    const lhr = runs.find((r) => Math.round(r.categories.performance.score * 100) === scores.performance);
    const misses = report
      ? []
      : Object.entries(BUDGETS).filter(([key, min]) => !skip.includes(key) && scores[key] < min);
    failures += misses.length;
    if (process.env.VF_LH_DEBUG) {
      const metric = (id) => lhr.audits[id].displayValue;
      console.log('   ', ['first-contentful-paint', 'speed-index', 'total-blocking-time', 'interactive'].map((id) => `${id} ${metric(id)}`).join(' | '));
    }
    const cls = lhr.audits['cumulative-layout-shift'].displayValue;
    const lcp = lhr.audits['largest-contentful-paint'].displayValue;
    const verdict = report ? 'report only' : misses.length ? `FAIL ${misses.map(([key]) => key).join(', ')}` : 'ok';
    console.log(
      `${label.padEnd(30)} ${Object.values(scores).map((s) => String(s).padStart(3)).join(' ')}   LCP ${lcp}  CLS ${cls}   ${verdict}`,
    );
  }
} finally {
  await chrome.kill();
  await server.close();
}

console.log(`\nBudgets (perf / a11y / best practices / SEO): ${Object.values(BUDGETS).join(' / ')}`);
if (failures) {
  console.error(`${failures} budget(s) missed.`);
  process.exit(1);
}
