# VANTA FREIGHT — Implementation Plan

> Companion to `PROJECT_SPEC.md` (what and why) and `ASSET_MANIFEST.md` (licences).
> Each phase ends with a demo and an explicit owner approval before the next phase begins.
> Last updated: 2026-10-28.

---

## Phase 1 — Discovery and planning ✅ (this document)

### 1.1 Environment findings [VERIFIED 2026-10-28]

| Item | Finding |
|---|---|
| Working directory | Initially `/home/user`, empty and not a git repository. Repository `reginald207/vanta-freight` was later cloned to `/home/user/vanta-freight`; it was empty (no commits). |
| GitHub | `reginald207/vanta-freight` is attached to the session. Pushing to it works (Phase 1 docs pushed to `main` on 2026-10-28). The GitHub REST API is restricted to repo-scoped endpoints. |
| OS / hardware | Linux x86_64, 4 vCPU, 15 GiB RAM, about 31 GB free disk (per-session allowance) |
| Node / package managers | Node **22.22.0**, npm **10.9.4**, pnpm 10.28.0, yarn 1.22.22, bun 1.4.4 |
| Other tooling | git 2.43.0, gh 2.89.0, Python 3.13.17, Playwright with Chromium 153 (pre-installed). **No Blender**, no gltfpack binary. |
| WebGL in headless Chromium | WebGL1 and WebGL2 available via **SwiftShader (software)**, MAX_TEXTURE_SIZE 8192. **WebGPU unavailable.** Good for screenshots and functional tests. **Frame-rate measurements are meaningless here.** |
| Network reachable | registry.npmjs.org ✔, raw.githubusercontent.com ✔, api.github.com (repo-scoped only) |
| Network blocked | sketchfab.com, poly.pizza, kenney.nl, opengameart.org, quaternius.com, polyhaven.com, gsap.com, threejs.org, vercel.com, fonts.google.com, cdn.jsdelivr.net, unpkg.com, github.com web UI. These are blocked for both shell and web-fetch tools. |

### 1.2 Decisions proposed (need owner approval)

| # | Decision | Rationale |
|---|---|---|
| D1 | Vite 8 multipage, vanilla ES modules, no framework | Matches the brief; small bundles; real HTML per route |
| D2 | Runtime dependencies are only `three`, `gsap`, and two Fontsource font packages | Minimal surface; all licences checked |
| D3 | **Native scroll** plus ScrollTrigger scrub. No Lenis or ScrollSmoother. | Accessibility, mobile reliability |
| D4 | WebGL only on Home (and an optional lazy turntable on Fleet) | Performance budget; simpler fallback matrix |
| D5 | **Procedural hero truck first**, behind a `TruckSource` interface; licensed GLB swap later | Zero licence risk; the only option fully verifiable here |
| D6 | Build-time HTML partials via a tiny in-repo Vite plugin | No runtime header injection; no extra dependency |
| D7 | Dark-only theme; lime never on ice | Contrast calculations (see spec §2.2) |
| D8 | Tracking and forms are 100% client-side, no network calls, clearly labelled as simulation or demo | Honesty constraints |
| D9 | Fictional hubs on an abstract map, not real geography | Avoids implying real operations |
| D10 | Fonts are Archivo Variable (with width axis) and JetBrains Mono Variable, self-hosted | Industrial look, OFL, no third-party font CDN |

---

## Phase 2 — Milestone M1: Foundation and Hero Vertical Slice ✅ (built 2026-10-29, awaiting owner review)

**Goal:** prove the hardest, riskiest part (3D, scroll, fallback, performance) end to end on one page, with the production architecture, before building breadth.

### Scope
1. **Repo hygiene:** `package.json` (scripts: `dev`, `build`, `preview`, `test:smoke`), `.gitignore`, `.editorconfig`, `vite.config.js` with multipage input stubs, `vercel.json` (`cleanUrls`, no deploy yet), and a README with run instructions.
2. **Design tokens:** `tokens.css` (colours, type scale using `clamp()`, spacing, motion durations and easings), base reset, focus ring, skip link, and reduced-motion media rules.
3. **Partials plugin:** header (nav to all future routes; placeholder pages are allowed to 404 for now, or show a "coming in Phase N" stub), footer, and fictional-brand notice.
4. **Home page Scenes 0–2 only:**
   - Scene 0 loader with real progress and a 3 s timeout.
   - Scene 1 hero composition: procedural truck, lights, fog, contact shadow, floor grid, idle drift, and pointer parallax.
   - Scene 2 pinned departure: camera dolly via `CatmullRomCurve3`, headlights, wheel spin, lane-marking UV scroll.
5. **Capability and quality system:** WebGL2 detection, `prefers-reduced-motion`, Save-Data, `deviceMemory` checks, Tier 0/1/2 switch, adaptive DPR, context-loss handling, and render pause when off-screen or the tab is hidden.
6. **Self-rendered poster** (desktop and mobile) generated with Playwright from the Tier 2 scene, exported as AVIF/WebP, used for Tier 0 and Tier 1.
7. **Smoke tests (Playwright):** the page loads with no console errors; the poster shows when WebGL is disabled (`--disable-webgl`); reduced-motion emulation has no pinning; no horizontal overflow at 320 px; the skip link works.

### Out of scope for M1
Scenes 3–7, all secondary pages beyond stubs, tracking, forms, GLB models, and deployment.

### M1 acceptance criteria
- [x] `npm run build` succeeds. `dist/` contains `index.html` plus hashed assets. The lazy 3D chunk is split from the entry chunk.
- [x] Entry JS (gzip) ≤ 60 KB. Measured: home entry **46.9 KB**; lazy 3D chunks **≈ 152 KB** (three.js and scene 148 KB, truck 4.4 KB). Both are enforced by the smoke suite.
- [x] Headline is visible at first paint with JS disabled. The poster is visible at Tier 0 and Tier 1.
- [ ] The Tier 2 truck renders and the camera scrubs smoothly forward **and backward** through Scenes 1–2 **on owner hardware** (owner reports fps on desktop and one phone). Verified functionally here, but frame rate can't be measured in the container (software WebGL).
- [x] `prefers-reduced-motion: reduce` gives no pin, no scrub, and no parallax, with the content intact.
- [x] Forcing WebGL context loss swaps to the poster without errors.
- [x] Keyboard: skip link, nav, and CTAs are reachable with a visible focus ring.
- [x] Playwright smoke suite passes in this environment (27 tests).
- [x] Every new asset (fonts, posters, favicon) is listed in `ASSET_MANIFEST.md`.

### M1 implementation notes
- **CSS sticky instead of a ScrollTrigger pin** for the departure scene. The section becomes a 250 svh track with a `position: sticky` stage, which avoids pin-spacers and iOS resize jumps. ScrollTrigger only scrubs.
- **The tier detector does not reject this container's software WebGL.** Chromium here doesn't treat SwiftShader as a `failIfMajorPerformanceCaveat`, so the default load goes live in the container. Real low-end devices are still caught by the memory and CPU heuristics and the 3 s load deadline. Tests force tiers or disable WebGL to cover each path.
- A forced `?tier=2` gets a 15 s load deadline instead of 3 s, since it is an explicit request for 3D.
- Legibility scrims sit between the live scene and the hero and departure text (left-to-right on desktop, vertical on phones).
- Posters are encoded with the browser's canvas encoder (WebP and JPEG) to avoid an image-processing dependency. AVIF can be added later if a toolchain is approved.

### Pre-requisites (blockers for M1)
- ~~**B1:** A GitHub repository to commit and push to.~~ Resolved: `reginald207/vanta-freight` is attached and pushes work.
- **B2:** Owner approval of decisions D1–D10.
- B3 (non-blocking for M1): read the GSAP Standard License terms page, or allow gsap.com.

---

## Phase 3 — M2: Home film complete
- Scenes 3–7 (network routes shader, cargo x-ray and instanced crates, fleet line-up, track teaser, arrival CTA).
- Mobile choreography set via `gsap.matchMedia()`, with shorter pins.
- "Skip intro sequence" link and in-page motion toggle.
- **Acceptance:** full storyboard in Tier 2; Tier 1 equivalent content; Lighthouse mobile Performance ≥ 85 and Accessibility ≥ 95 on Home.

## Phase 4 — M3: Content pages
- Services index plus four service detail pages from `data/services.js` (one template).
- About (with `#credits`), Fleet (static spec cards plus optional lazy turntable), 404.
- Cross-document View Transitions (progressive).
- **Acceptance:** all routes build; nav complete; secondary-page JS ≤ 40 KB gzip each; keyboard and screen reader smoke tests pass.

## Phase 5 — M4: Simulated tracking and demo forms
- `tracking/simulator.js`: a pure, deterministic function `simulate(id) → { status, hubs[], events[], etaLabel }`, seeded PRNG, fictional hubs only. Unit-tested with Vitest (dev dependency added only in this phase) or `node:test` (zero dependencies, preferred).
- Tracking UI: SIMULATION badge, `aria-live` results, SVG route draw.
- Contact and quote forms: native constraint validation plus custom messages, demo-only submit message, **no network request** (Playwright asserts zero requests on submit).
- **Acceptance:** spec §9 items 4 and 5.

## Phase 6 — M5: Asset upgrade (optional, gated on licence verification)
- If a GLB truck is approved in `ASSET_MANIFEST.md`: optimise with gltf-transform (`dedup`, `prune`, `weld`, `draco` or `meshopt`, `resize --width 2048`, `webp`), map wheel and light nodes, apply the brand material override, and A/B it against the procedural truck.
- **Acceptance:** model ≤ 1.5 MB; no fps regression; credits rendered.

## Phase 7 — M6: Hardening and deployment
- Full accessibility audit, cross-browser and device matrix (Chrome, Firefox, Safari macOS/iOS, Android Chrome), Lighthouse CI budgets, Open Graph images, sitemap, robots.
- Connect the GitHub repo to Vercel (free tier) **only with owner approval**. Use preview deployments first.
- **Acceptance:** spec §9 in full.

---

## Testing strategy summary

| Layer | Tool | Where |
|---|---|---|
| Unit (simulator, validators, choreography maths) | `node:test` (built in) | Container and CI |
| Functional, fallback, a11y smoke | Playwright (pre-installed) with `@axe-core/playwright` (added in M3, MIT) [ASSUMPTION: confirm licence when added] | Container and CI |
| Visual snapshots of posters and layouts | Playwright screenshots (SwiftShader WebGL) | Container |
| Frame rate / GPU | Manual on real devices, `renderer.info`, and Chrome Performance panel | Owner hardware |
| Lighthouse | Lighthouse CLI with Chromium at `/opt/pw-browsers/chromium` [ASSUMPTION: works with this build] | Container (lab scores only) |

## Recommended first milestone

**M1 — Foundation and Hero Vertical Slice** (Phase 2 above). It is the safest first step for these reasons:
1. It retires the biggest technical risks early: 3D performance, scroll scrubbing, and fallback tiers.
2. It does not depend on any blocked network host or any unverified licence, because the procedural truck and self-rendered posters are original work.
3. It establishes the token, partial, and capability architecture that every later page reuses.
4. It is small enough to review in one sitting, and it is fully reversible.
