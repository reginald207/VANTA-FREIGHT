# VANTA FREIGHT

A cinematic, multipage website for a **fictional** freight company: a design and engineering showcase built with Vite, vanilla JavaScript modules, Three.js and GSAP ScrollTrigger.

> VANTA FREIGHT is not a real company. Nothing on this site moves freight or contacts a real logistics operator. Tracking is a simulation and forms are demos.

- **Specification:** [`PROJECT_SPEC.md`](PROJECT_SPEC.md)
- **Plan and milestones:** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- **Licences for every asset and library:** [`ASSET_MANIFEST.md`](ASSET_MANIFEST.md)

## Status

Milestones **M1–M4** and **M6** (hardening) are built: the full home film, Services and the four service pages, Fleet (with a 3D viewer), About (with credits), a **simulated** shipment tracker and a **demo** quote and contact form. Neither the tracker nor the form makes a network request, and the site ships with a strict Content Security Policy. M5 (an optional licensed 3D model) was skipped. Acceptance status: `PROJECT_SPEC.md` §9.1.

## Requirements

Node.js **22.12+** (or 20.19+) and npm.

## Scripts

```bash
npm install
```

```bash
npm run dev          # local dev server
```

```bash
npm run build        # production build into dist/
```

```bash
npm run preview      # serve the production build
```

```bash
npm test             # unit tests (choreography, network, tracking simulator, form validation)
```

```bash
npm run test:smoke   # build, then run unit tests and the Playwright smoke suite
```

```bash
npm run posters      # re-render the posters and the social card from the live scenes
```

`test:smoke` and `posters` use Playwright's Chromium. If it isn't installed on your machine, run `npx playwright install chromium` once.

## How the home page degrades

| Tier | When | What you get |
|---|---|---|
| 0 | JavaScript disabled | Full HTML content and the static poster |
| 1 | Reduced motion (OS setting or the header toggle), Save-Data, low memory or CPU, no WebGL2, 3D load over 3 s, frames far too slow, WebGL context lost | Static poster, static network map and gentle reveals (none with reduced motion) |
| 2 | Capable device | Live WebGL truck and the scroll-driven camera film |

For QA on real devices, add `?tier=1` or `?tier=2` to the URL to force a tier. A forced Tier 2 allows 15 s for the 3D stage to load.

The posters in `public/posters/` are rendered from the scene itself (`npm run posters`), so they stay in sync with the 3D hero. Re-run that command after changing the truck, lighting or hero camera.

## Audits

```bash
npm run audit:lighthouse   # Lighthouse budgets for every page (median of 3 runs)
```

```bash
VF_BROWSER=firefox npm run test:smoke
```

```bash
VF_BROWSER=webkit npm run test:smoke
```

Install those engines once with `npx playwright install firefox webkit`. The suite includes an axe-core WCAG 2.2 A/AA audit of every page.

## Deployment

Vercel deploys a preview for every branch and production from `main`, using the build settings in `vercel.json`. No environment variables are required.

- **Absolute URLs:** canonical links, `og:url`, `og:image` and `sitemap.xml` use Vercel's `VERCEL_PROJECT_PRODUCTION_URL` automatically (the project's "Automatically expose System Environment Variables" setting must stay on, which is Vercel's default). To use a custom domain, set `SITE_URL` (for example `https://vantafreight.example`) in the Vercel project's environment variables.
- **Security headers:** `vercel.json` sets a strict Content Security Policy. If you edit the inline script in `partials/head.html`, update its `sha256-…` hash in `vercel.json`; the test suite fails until you do.
- **Vercel Toolbar on previews:** the toolbar (comments, feedback) loads from `vercel.live`, which the CSP blocks, so it won't appear on preview deployments. The site itself is unaffected. To use the toolbar, add `https://vercel.live` to `script-src`, `connect-src`, `img-src`, `style-src` and a `frame-src` directive, ideally on previews only.

## Project layout

```
index.html, services/ fleet/ about/ tracking/ contact/ 404.html   one HTML file per route
partials/            header, footer and head, included at build time
plugins/             html-partials.js (includes and @render), preload-fonts.js, seo.js
public/              favicon, posters, social card (og/)
src/core/            capability tiers, motion preference, scroll reveals
src/tracking/        the deterministic shipment simulator
src/forms/           demo form validation
src/data/            fictional network, services, fleet and credits data, plus the
                     build-time renderers for the data-driven pages
src/animation/       GSAP setup and section timelines
src/webgl/           stage, procedural truck, floor and lights, camera rig
src/pages/           page entry points
src/styles/          tokens, base, page styles
scripts/             poster and social-card renderer, Lighthouse budgets
tests/               Playwright smoke tests (node:test)
```
