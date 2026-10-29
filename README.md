# VANTA FREIGHT

A cinematic, multipage website for a **fictional** freight company: a design and engineering showcase built with Vite, vanilla JavaScript modules, Three.js and GSAP ScrollTrigger.

> VANTA FREIGHT is not a real company. Nothing on this site moves freight or contacts a real logistics operator. Tracking is a simulation and forms are demos.

- **Specification:** [`PROJECT_SPEC.md`](PROJECT_SPEC.md)
- **Plan and milestones:** [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- **Licences for every asset and library:** [`ASSET_MANIFEST.md`](ASSET_MANIFEST.md)

## Status

Milestones **M1** (foundation and hero), **M2** (the full home film) and **M3** (content pages) are built. The home page runs all eight storyboard scenes. Services, the four service pages, Fleet (with a 3D viewer), About (with credits) and 404 are complete. Tracking and Contact are placeholders until M4.

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
npm test             # unit tests (choreography, network data, adaptive resolution)
```

```bash
npm run test:smoke   # build, then run unit tests and the Playwright smoke suite
```

```bash
npm run posters      # re-render the static hero posters from the live scene
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

## Project layout

```
index.html, services/ fleet/ about/ tracking/ contact/ 404.html   one HTML file per route
partials/            header, footer and head, included at build time
plugins/             html-partials.js (includes and @render), preload-fonts.js
public/              favicon, posters
src/core/            capability tiers, motion preference
src/data/            fictional network, services, fleet and credits data, plus the
                     build-time renderers for the data-driven pages
src/animation/       GSAP setup and section timelines
src/webgl/           stage, procedural truck, floor and lights, camera rig
src/pages/           page entry points
src/styles/          tokens, base, page styles
scripts/             poster renderer
tests/               Playwright smoke tests (node:test)
```
