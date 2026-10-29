# VANTA FREIGHT — Project Specification

> **Status:** Phase 1 (discovery and planning). No application code exists yet.
> **Last updated:** 2026-10-28
> **Fictional brand notice:** VANTA FREIGHT is a fictional company. This website is a creative and technical showcase. It does not represent, advertise, or contact any real logistics operator.

Evidence labels used in this document:

- **[VERIFIED]** — checked directly in this environment (command output, package tarball, or primary source file).
- **[SECONDARY]** — reported by web search results; the primary page could not be opened from this environment.
- **[ASSUMPTION]** — a planning assumption that needs confirmation.
- **[DECISION]** — a proposed decision, pending owner approval at the end of Phase 1.

---

## 1. Vision

A premium, cinematic, multipage website for a fictional transport and cargo company. It should feel like an interactive film. A real-time Three.js truck anchors the home page. Scroll-driven camera choreography, animated routes, and cargo and fleet storytelling carry the narrative. Motion is experimental but controlled. It never blocks content, never traps scroll, and always has a calm alternative.

**Brand line:** WE MOVE WHAT MOVES THE WORLD.

## 2. Brand system

### 2.1 Colour tokens

| Token | Hex | Role |
|---|---|---|
| `--vf-obsidian` | `#090B0A` | Page background, 3D clear colour, fog |
| `--vf-carbon` | `#151916` | Raised surfaces, cards, panels, form fields |
| `--vf-lime` | `#C7FF4A` | Accent, focus rings, route lines, emissive light strips, primary CTA fill |
| `--vf-ice` | `#E9EDE8` | Primary text, headlines |
| `--vf-steel` | `#89958D` | Secondary text, meta, rules, disabled states |

### 2.2 Contrast (WCAG 2.x relative luminance) [VERIFIED by calculation]

| Foreground / background | Ratio | Result |
|---|---|---|
| Ice on Obsidian | 16.68:1 | AAA |
| Ice on Carbon | 15.00:1 | AAA |
| Lime on Obsidian | 16.76:1 | AAA |
| Lime on Carbon | 15.08:1 | AAA |
| Obsidian on Lime (button label) | 16.76:1 | AAA |
| Steel on Obsidian | 6.34:1 | AA (all text sizes) |
| Steel on Carbon | 5.71:1 | AA (all text sizes) |
| **Lime on Ice** | **1.00:1** | **FAIL. Never use.** |
| **Steel on Ice** | **2.63:1** | **FAIL for text. Never use.** |

Rule: the site is dark-only. Ice-coloured backgrounds are not used for text surfaces.

### 2.3 Typography [DECISION]

All fonts are self-hosted from npm (Fontsource). No runtime calls to Google Fonts.

| Use | Family | Package | Licence |
|---|---|---|---|
| Display and UI | Archivo Variable (weight and **width** axes, for condensed industrial headlines) | `@fontsource-variable/archivo@5.3.0` | OFL-1.1 [VERIFIED: package.json and LICENSE file] |
| Data, tracking IDs, telemetry | JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono@5.3.0` | OFL-1.1 [VERIFIED] |

We only ship latin subsets (`*-latin-wght-normal.woff2`) and preload the display face. Inter (`@fontsource-variable/inter`, OFL-1.1 [VERIFIED]) is a fallback alternative if Archivo body copy tests poorly.

### 2.4 Voice

The voice is short, declarative, and industrial. No fabricated statistics are presented as real. Every number on the site is labelled as illustrative, for example "Illustrative network figures", or is attached to the fictional brand in an obviously fictional context.

## 3. Scope

### 3.1 Pages (information architecture)

| Route | Page | 3D / motion level |
|---|---|---|
| `/` | Home: cinematic scroll film (see storyboard, section 6) | Full WebGL hero, scroll choreography |
| `/services/` | Services index | DOM motion, small route SVG animations |
| `/services/linehaul/` | Service detail: Linehaul (full truckload) | DOM motion |
| `/services/expedited/` | Service detail: Expedited and time-critical | DOM motion |
| `/services/temperature-controlled/` | Service detail: Temperature-controlled | DOM motion |
| `/services/project-cargo/` | Service detail: Project and heavy cargo | DOM motion |
| `/fleet/` | Fleet: vehicle classes, specs (fictional), optional turntable | Optional lazy WebGL turntable, poster fallback |
| `/about/` | About: fictional story, values, design principles | DOM motion |
| `/tracking/` | **Simulated** shipment tracking | SVG or Canvas2D route map; no WebGL needed |
| `/contact/` | Contact and quote request (**demo form**) | Minimal motion |
| `/404` | Not found | Minimal |

The final service list is a [DECISION] and can change. Each service page uses one shared template and is driven from a single data module.

### 3.2 Explicitly out of scope

- Real backend, database, CRM, email delivery, or analytics with personal data.
- Real shipment data, real carrier APIs, real customer names, or real certifications.
- Paid assets, paid APIs, or paid hosting tiers.
- CMS integration.

## 4. Honesty and content constraints (mandatory)

1. **Fictional brand.** A site-wide footer notice says: "VANTA FREIGHT is a fictional company created for a design and engineering showcase."
2. **Tracking is simulated.** The tracking page has a persistent, visible "SIMULATION" badge and explanatory copy. Results come from a deterministic, client-side generator seeded by the entered ID. No network request is made. Sample IDs are offered, for example `VF-DEMO-0001`.
3. **Forms are demos.** Contact and quote forms validate client-side. On submit, they show: "Demo only. This form did not send your message anywhere." **No network request is made and nothing is stored.** The page tells users not to enter sensitive personal data.
4. **No invented real-world claims.** There are no claims of real certifications (ISO, SmartWay, and so on), real partners, real awards, real fleet sizes, or real customers. Hubs and lanes use **fictional place names**, for example "Northgate Hub" and "Port Kestrel", on an abstract map. They are not drawn on real geography.
5. **No real brand marks** on any vehicle texture or image.

## 5. Technical architecture [DECISION, verified against current package versions]

### 5.1 Stack

| Layer | Choice | Version checked | Licence | Notes |
|---|---|---|---|---|
| Build / dev server | Vite | 8.3.5 [VERIFIED npm] | MIT | Engines `^20.19.0 \|\| >=22.12.0`; environment has Node 22.22.0 ✔ |
| 3D | three | 0.186.1 [VERIFIED npm] | MIT | `three/addons/*` export map present; GLTFLoader, DRACOLoader, KTX2Loader, RoundedBoxGeometry, and Draco and Basis decoders all ship in the package [VERIFIED] |
| Animation | gsap (core + ScrollTrigger) | 3.15.0 [VERIFIED npm] | GreenSock "Standard No-Charge License" | README in the tarball confirms the licence name and URL [VERIFIED]. The claim that all plugins are free for commercial use after the Webflow acquisition is [SECONDARY]. gsap.com could not be opened from this environment, so the full terms must be read once (see risks). |
| Fonts | Fontsource variable packages | 5.3.0 | OFL-1.1 [VERIFIED] | Self-hosted |
| Hosting (later) | Vercel, static output | n/a | Hobby tier is free [ASSUMPTION: confirm current terms when deploying] | No serverless functions needed |

**Not adopted:** Lenis or ScrollSmoother smooth-scroll hijacking, because native scroll is better for accessibility, keyboard and assistive tech, and mobile. We also do not adopt React or any other framework, Tailwind, postprocessing libraries, or WebGPU. `navigator.gpu` is absent in the test browser, and WebGL2 is sufficient.

**Dev-only tooling (not committed as dependencies unless needed):** `@gltf-transform/cli@4.5.1` (MIT) [VERIFIED working here] for model inspection and optimisation, run via `npx`. Playwright and Chromium are pre-installed in the environment for smoke tests and screenshots.

### 5.2 Multipage build

- Each route is a real HTML file, which gives good SEO and no-JS content. Inputs are declared in `vite.config.js` under `build.rolldownOptions.input`. [VERIFIED: in Vite 8 type definitions, `rollupOptions` is marked `@deprecated Use rolldownOptions instead`.]
- Shared header, footer, and fictional-brand notice are injected **at build time** by a small in-repo Vite plugin (`transformIndexHtml` with `<!-- @include partials/header.html -->` markers). There is no extra dependency, and the markup is not injected at runtime by JS.
- Each page gets its own JS entry. Only `/` (and optionally `/fleet/`) imports Three.js, and it does so via dynamic `import()` after capability checks.
- Vercel: static `dist/`, `vercel.json` with `cleanUrls: true` and a custom 404.

### 5.3 Proposed source layout

```
/
├─ index.html, services/…/index.html, fleet/, about/, tracking/, contact/, 404.html
├─ partials/            header.html, footer.html, notice.html
├─ public/
│  ├─ models/           optimised .glb (only after licence sign-off)
│  ├─ posters/          static hero posters (self-rendered from our scene)
│  └─ draco/ basis/     decoders copied from three/examples/jsm/libs (only if used)
├─ src/
│  ├─ styles/           tokens.css, base.css, components/*.css, pages/*.css
│  ├─ core/             capabilities.js, motion-preference.js, page-transitions.js
│  ├─ webgl/            stage.js (renderer/loop), truck/ (loader + procedural), camera-rig.js,
│  │                    choreography.js (scroll→camera keyframes), routes.js, quality.js
│  ├─ animation/        gsap-setup.js (registerPlugin, matchMedia), sections/*.js
│  ├─ data/             services.js, fleet.js, hubs.js (all fictional)
│  ├─ tracking/         simulator.js (pure, deterministic), view.js
│  ├─ forms/            validate.js, demo-submit.js
│  └─ pages/            home.js, services.js, fleet.js, tracking.js, contact.js …
└─ docs/                PROJECT_SPEC.md, IMPLEMENTATION_PLAN.md, ASSET_MANIFEST.md (may stay at root)
```

### 5.4 Rendering and animation architecture

- **One renderer, one canvas, home page only.** The canvas is fixed behind the content (`position: fixed; inset: 0; z-index: 0`), with `aria-hidden="true"`. All meaningful content lives in the DOM.
- **Single clock.** `gsap.ticker` drives `renderer.render()`. Rendering pauses when the hero is fully scrolled past, when `document.hidden` is true, or when nothing has changed (render-on-demand when idle).
- **Scroll → camera.** Each storyboard scene defines a camera keyframe (`position`, `target`, `fov`) and scene-state values (headlight intensity, wheel speed, route reveal). Pinned or scrubbed `ScrollTrigger`s map progress to a parameter `t`. The camera position and target follow `THREE.CatmullRomCurve3` paths, so motion stays smooth and reversible. A light `scrub` value (about 0.6–1 s) adds damping.
- **Responsive choreography.** `gsap.matchMedia()` defines separate keyframe sets for desktop, mobile portrait, and `prefers-reduced-motion`.
- **Quality tiers** (`quality.js`):
  - **Tier 0:** no JS. Full HTML content plus a static `<picture>` poster.
  - **Tier 1:** no WebGL2, WebGL context failure, `prefers-reduced-motion: reduce`, `Save-Data`, or a low `deviceMemory` / `hardwareConcurrency` value. The page shows the static poster plus gentle CSS and GSAP opacity and transform transitions, with no scrubbed camera.
  - **Tier 2:** full experience. DPR is clamped to 1.5 on mobile and 2 on desktop. Adaptive DPR drops if the frame-time average exceeds 20 ms. Shadows use a single baked contact-shadow plane, not real-time shadow maps.
- **Context loss.** `webglcontextlost` swaps to the poster.
- **Page transitions.** Use cross-document View Transitions (`@view-transition { navigation: auto; }`) as progressive enhancement, with no JS dependency. Browsers without support simply navigate normally.

## 6. Cinematic storyboard — Home (`/`)

Conventions: **Cam** means camera move. **3D** means scene state. **DOM** means HTML layer. **RM** means reduced-motion and Tier 1 behaviour. **Mob** means mobile changes. Scroll length is given in viewport heights (vh).

### Scene 0 — Ignition (pre-roll, 0 vh, time-based, ≤ 1.8 s)
- **Purpose:** brand imprint while assets load, without hiding content.
- **DOM:** The wordmark "VANTA FREIGHT" reveals per character (CSS clip, no SplitText needed). A single lime hairline acts as a real progress bar driven by `LoadingManager`. No fake progress.
- **3D:** Black void. The lime light strip on the truck's cab flickers on.
- **Rules:** The loader never blocks reading. The headline is in the DOM from first paint, so LCP is text. There is a hard timeout (3 s): if the model has not loaded, show the poster and continue.
- **RM:** Static wordmark, no flicker.

### Scene 1 — Night Yard / Hero (0–100 vh, not pinned)
- **Cam:** Low three-quarter front view at headlight height, slow idle drift (±2°) and subtle pointer parallax (desktop only, clamped).
- **3D:** Truck centred in an obsidian void with exponential fog, a lime rim light from behind and to the left, a cool ice key light, and a contact shadow. Faint floor grid lines recede into the fog.
- **DOM:** H1 "WE MOVE WHAT MOVES THE WORLD." in condensed Archivo, with primary CTA "Request a quote" (demo) and secondary CTA "Track a shipment (simulated)". A scroll cue sits at the bottom.
- **GSAP:** The headline lines rise and fade on load (timeline, not scroll).
- **Mob:** Camera pulls back (fov +8) so the full cab fits in portrait. Headline sits above the truck.
- **RM / Tier 1:** Poster image of the same composition.

### Scene 2 — Departure (100–250 vh, pinned)
- **Cam:** Dolly arc from the three-quarter front view to a full side profile, then a low tracking shot along the trailer.
- **3D:** Headlights ramp up (emissive plus spotlights). Wheels rotate in proportion to scroll velocity. Floor lane markings stream backwards (UV offset), so the truck "drives" without moving in world space.
- **DOM:** Three short statements pin in sequence on the left: "Linehaul." "Expedited." "Temperature-controlled." Each links to its service page.
- **RM:** Statements are shown as a plain list. The poster stays.

### Scene 3 — The Network (250–400 vh, pinned)
- **Cam:** Crane up to near top-down (≈ 75°). The truck shrinks to a glowing lime marker.
- **3D:** An abstract network of **fictional hubs** draws itself. Route tubes use animated dash offset (shader uniform `uProgress`), and nodes pulse when a route reaches them.
- **DOM:** Counter tiles labelled "Illustrative network" (for example, "12 hubs · fictional"). Numbers count up once.
- **RM:** A static SVG version of the same network is drawn fully.
- **Mob:** Fewer routes (LOD) and a shorter pin (100 vh).

### Scene 4 — Cargo / X-Ray (400–550 vh, pinned)
- **Cam:** Descend to the trailer's rear three-quarter view and push in.
- **3D:** The trailer shell fades to a wireframe or fresnel "x-ray" material. Instanced cargo crates slide out on rails into a labelled grid, one cluster per cargo type (palletised, temperature-controlled, oversized, time-critical).
- **DOM:** Cargo category cards sync to the crate clusters. Cards are focusable and link to services.
- **RM:** Cards only, no 3D motion.

### Scene 5 — Fleet Line-up (550–650 vh)
- **Cam:** Pull back to a wide shot. Lateral truck through a row of 3 vehicle silhouettes (instanced variants: tractor-only, rigid box truck, tractor and trailer).
- **3D:** Material swaps per variant (carbon body, lime accent position changes).
- **DOM:** "Meet the fleet" CTA to `/fleet/`. Specs are clearly fictional.

### Scene 6 — Track Teaser (650–750 vh)
- **Cam:** Static. The 3D canvas fades and dims to 20%.
- **DOM:** A compact simulated tracking widget mock with a prominent **SIMULATION** badge and a "Try a demo ID" button that links to `/tracking/?id=VF-DEMO-0001`.

### Scene 7 — Arrival / CTA (750–850 vh)
- **Cam:** Low rear view. The truck pulls away into the fog, tail lights in lime-tinted red. Fade to obsidian.
- **DOM:** The final CTA, "Request a quote (demo)", is followed by the footer with the fictional-brand notice.
- **RM:** Static CTA block.

**Total scroll length:** about 850 vh on desktop and about 600 vh on mobile. Every pinned section has a keyboard-accessible "Skip intro sequence" link at the top of the page.

### Secondary-page motion (lighter)
- **Services:** Section reveals (opacity and y), and SVG route lines that draw on enter. Service detail pages share one hero template with an SVG route diagram.
- **Fleet:** Optional lazy WebGL turntable (dragging rotates the truck, keyboard arrows also rotate it), with a poster fallback.
- **Tracking:** The route path draws to the simulated current position, and timeline events stagger in.
- **About and Contact:** Minimal reveals only.

## 7. Accessibility requirements (WCAG 2.2 AA target)

- Semantic landmarks and one `h1` per page. Skip-to-content link. A visible lime focus ring (2px plus offset) on every interactive element.
- The canvas is `aria-hidden`. Every story beat exists as readable DOM text.
- `prefers-reduced-motion: reduce` removes scrubbed camera moves, pinning, parallax, and count-ups. The user can also set an in-page "Reduce motion" toggle, persisted in `localStorage` with try/catch.
- No content is reachable only by scrolling animation. Pinned sections never trap focus, and Tab order follows DOM order.
- Forms use real `<label>` elements, inline error messages linked with `aria-describedby`, and an `aria-live="polite"` region for submit status and tracking results.
- No flashing above 3 Hz (the Scene 0 flicker is limited to two slow pulses).
- Target sizes are at least 24×24 CSS px (WCAG 2.2 2.5.8).

## 8. Performance budgets

| Metric | Budget |
|---|---|
| LCP (mobile, mid-tier, 4G) | ≤ 2.5 s. The LCP element is the DOM headline or poster, never the canvas. |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| Home JS (gzip), excluding the lazy 3D chunk | ≤ 60 KB |
| Lazy 3D chunk (three + scene code, gzip) | ≤ 220 KB [ASSUMPTION: to be measured] |
| GSAP core and ScrollTrigger (gzip) | ≈ 45 KB [ASSUMPTION: to be measured] |
| Hero model (GLB, compressed) | Target ≤ 800 KB, hard cap 1.5 MB |
| Textures | ≤ 2K, WebP or KTX2, total GPU memory ≤ 64 MB |
| Frame rate | 60 fps desktop with an integrated GPU, ≥ 30 fps on a mid-range phone |
| Secondary pages JS (gzip) | ≤ 40 KB each |

**Note:** frame rates **cannot be measured in this cloud environment**, because Chromium renders WebGL here with SwiftShader (software). Frame-rate checks must happen on real hardware.

## 9. Acceptance criteria (whole project)

1. All required pages exist as real HTML routes and build with `vite build` with no errors or warnings that matter.
2. Home storyboard scenes 0–7 are implemented in Tier 2 and degrade correctly to Tier 1 and Tier 0, verified by: disabling WebGL, emulating `prefers-reduced-motion`, and disabling JS.
3. Every asset in production is listed in `ASSET_MANIFEST.md` with source URL, author, licence, verification date, and modifications. Required attributions appear on an `/about/#credits` section.
4. Tracking shows the SIMULATION badge, makes zero network requests (checked in DevTools or Playwright request log), and is deterministic for the same ID.
5. Forms make zero network requests on submit and display the demo-only message.
6. Lighthouse (mobile) scores Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, and Performance ≥ 85 on the home page. Secondary pages score Performance ≥ 90.
7. Keyboard-only walkthrough of every page passes. A screen reader smoke test (VoiceOver or NVDA) passes on Home, Tracking, and Contact.
8. Layout works from 320 px to 2560 px wide with no horizontal scroll.
9. No real company marks, real customer names, or unlabelled statistics appear anywhere.
10. Deployed on Vercel free tier from GitHub, using no paid services.

## 10. Risks and unknowns

| # | Risk / unknown | Impact | Mitigation |
|---|---|---|---|
| R1 | Cloud container is ephemeral. | Low: unpushed work is lost when the container is reclaimed. | Push to `reginald207/vanta-freight` at the end of each working step (push access confirmed 2026-10-28). |
| R2 | **Asset hosts are blocked** by the environment network policy (sketchfab.com, poly.pizza, kenney.nl, opengameart.org, quaternius.com, polyhaven.com, gsap.com, threejs.org, jsdelivr, unpkg). | High: model licences cannot be verified first-hand, and models cannot be downloaded into the container. | Either allow those domains in the environment network settings, or the owner downloads chosen files and commits them with licence screenshots or texts. The procedural truck path (M1) does not depend on this. |
| R3 | No truly suitable *semi-truck* model with a verified permissive licence was confirmed. | Medium | Build the hero truck procedurally first (zero licence risk), and swap to a licensed GLB later behind the same interface. |
| R4 | The full GSAP Standard No-Charge License text was not read first-hand. | Low–Medium | The owner (or a session with gsap.com allowed) reads https://gsap.com/standard-license before launch and records the result in the manifest. |
| R5 | Scroll-scrubbed WebGL performance on low-end Android. | Medium | Quality tiers, adaptive DPR, a shorter mobile pin, and a hard Tier 1 fallback. |
| R6 | iOS Safari specifics: address-bar resize causing ScrollTrigger refresh jumps, and WebGL memory limits. | Medium | Use `ScrollTrigger.config({ ignoreMobileResize: true })`, `svh`/`lvh` units, and texture caps. Test on a real device. |
| R7 | Cross-document View Transitions are not supported in every browser. | Low | Progressive enhancement only. |
| R8 | Vercel free-tier terms may change. | Low | The output is plain static files, so any static host works. |
| R9 | No Blender in the environment, so models cannot be edited here. | Low–Medium | Use gltf-transform for optimisation, and runtime material overrides for rebranding. Any mesh edits are done by the owner locally. |
| R10 | Software WebGL in CI or the container. Chromium does not report SwiftShader as a major performance caveat, so `failIfMajorPerformanceCaveat` alone does not catch software rendering (found in M1). | Low–Medium | Use Playwright for functional and screenshot tests only. Measure performance on real hardware. The memory and CPU heuristics and the 3 s load deadline remain the guard; consider an adaptive downgrade to Tier 1 if frame time stays high at the minimum DPR (M2). |
