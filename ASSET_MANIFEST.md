# VANTA FREIGHT — Asset Manifest

> Every third-party file that ships in the site (models, textures, images, video, audio, fonts, libraries) **must** have a row here before it is merged. Rows record the source URL, author, licence, how the licence was verified, the verification date, and any modifications.
>
> **Status values:** `APPROVED`, meaning it may ship; `CANDIDATE`, meaning evaluation is pending; `REJECTED`, meaning it must not ship.
> **Verification levels:** **[VERIFIED]** means the licence text or metadata was read from a primary source. **[SECONDARY]** means it is known only from search-result summaries, because the primary page was blocked from this environment. **[UNVERIFIED]** means it has not been checked.

Last updated: 2026-10-29 (milestone M5).

---

## 1. Licence policy

| Licence | Allowed? | Conditions |
|---|---|---|
| CC0 1.0 / Public Domain | ✅ Preferred | Credit anyway on `/about/#credits` as a courtesy |
| CC BY 4.0 (or 3.0) | ✅ Allowed | Visible credit with author, title, source link, licence link, and "modified" note if changed |
| MIT / Apache-2.0 / BSD (code) | ✅ Allowed | Keep licence notices in the bundle (the build emits legal comments) |
| SIL OFL 1.1 (fonts) | ✅ Allowed | Keep the font licence file. Do not sell the font on its own. |
| GreenSock Standard No-Charge | ✅ Allowed, pending first-hand read of terms (see L3) | — |
| CC BY-SA | ⚠️ Avoid | Share-alike on derivative assets complicates retexturing |
| **CC BY-NC / NC-SA / NC-ND** | ❌ Rejected | The commercial or portfolio status of the site is not guaranteed |
| "Free for personal use", Sketchfab "Standard"/"Editorial", CGTrader or Fab royalty-free (paid or restricted), unknown | ❌ Rejected | — |
| Unsplash / Pexels licences | ⚠️ Avoid by default | Not CC0. They forbid some uses, and identifiable people, brands, or trucks with real liveries would conflict with our honesty rules. |
| Assets containing **real trademarks or logos** | ❌ Unless the mark is removed | — |

---

## 2. Libraries and fonts

| ID | Asset | Version | Source | Licence | Verification | Status |
|---|---|---|---|---|---|---|
| L1 | three | 0.186.1 | npm `three` | MIT | **[VERIFIED]** `npm view three license`, 2026-10-28 | APPROVED |
| L2 | vite (dev) | 8.3.5 | npm `vite` | MIT | **[VERIFIED]** npm metadata, 2026-10-28 | APPROVED |
| L3 | gsap (core + ScrollTrigger) | 3.15.0 | npm `gsap` | GreenSock Standard "No Charge" License, https://gsap.com/standard-license | **[VERIFIED]** that the package declares this licence (npm `license` field plus README §License in the tarball). **[SECONDARY]** that the licence permits free commercial use of all plugins (README text and search results). The full terms page could not be opened, because gsap.com is blocked. | CANDIDATE: approve after the owner reads the terms page |
| L4 | @fontsource-variable/archivo | 5.3.0 | npm | OFL-1.1 | **[VERIFIED]** package.json `license` and the bundled LICENSE file ("Copyright 2020 The Archivo Project Authors … SIL Open Font License, Version 1.1"), 2026-10-28 | APPROVED |
| L5 | @fontsource-variable/jetbrains-mono | 5.3.0 | npm | OFL-1.1 | **[VERIFIED]** package.json plus LICENSE file, 2026-10-28 | APPROVED |
| L6 | @fontsource-variable/inter (alternate only) | 5.3.0 | npm | OFL-1.1 | **[VERIFIED]** package.json plus LICENSE file, 2026-10-28 | CANDIDATE (not planned) |
| L7 | @gltf-transform/cli (dev tool, not shipped) | 4.5.1 | npm | MIT | **[VERIFIED]** npm metadata; ran successfully here | APPROVED (tooling, not installed in the project) |
| L10 | lighthouse (dev only, `npm run audit:lighthouse`; not shipped) | 13.6.0 | npm `lighthouse` | Apache-2.0 | **[VERIFIED]** npm metadata, 2026-10-29 | APPROVED (tooling) |
| L12 | @gltf-transform/core, /functions, /extensions (dev only, `scripts/optimize-model.mjs`; not shipped) | 4.5.1 | npm | MIT | **[VERIFIED]** npm metadata, 2026-10-29. Transitive: `sharp` (Apache-2.0) with its prebuilt `libvips` binary (LGPL-3.0), plus MIT packages. All are build tooling only, never shipped or modified. | APPROVED (tooling) |
| L11 | @axe-core/playwright and axe-core (dev only, accessibility tests; not shipped) | 4.14.0 | npm | MPL-2.0 | **[VERIFIED]** npm metadata, 2026-10-29. MPL-2.0 is file-level copyleft; it only matters if these files are modified or distributed, and neither happens: test tooling only. | APPROVED (tooling) |
| L9 | playwright (dev only, not shipped) | 1.63.0 | npm `playwright` | Apache-2.0 | **[VERIFIED]** package.json `license` and bundled LICENSE file, 2026-10-29. Pinned to the version pre-installed in the cloud environment. | APPROVED (tooling) |
| L8 | Draco / Basis decoders | bundled with three 0.186.1 | `three/examples/jsm/libs/{draco,basis}` | Apache-2.0 (Draco, Basis Universal) [ASSUMPTION: confirm from each folder's README at time of use] | Files present in the package **[VERIFIED]**. Licence not yet read. | CANDIDATE: only if compression is used |

---

## 3. Hero truck: 3D model candidates

### Evaluation criteria

1. **Licence:** CC0 or CC BY, verified first-hand.
2. **Form:** a tractor unit plus trailer (semi) is ideal. A rigid box truck is acceptable.
3. **Format:** glTF 2.0 / GLB, or a cleanly convertible format.
4. **Budget:** ≤ 50k triangles and ≤ 1.5 MB after compression. Separable wheel nodes so they can rotate.
5. **Look:** must be able to take an obsidian/carbon/lime material override. No baked-in real logos.

### Candidates

| ID | Model | Author | Source | Licence | Verification | Measured / reported specs | Fit for VANTA hero | Status |
|---|---|---|---|---|---|---|---|---|
| M0 | **Procedural "VF-01" tractor and trailer** (`src/webgl/truck/procedural-truck.js`) (built in code from Three.js primitives: `RoundedBoxGeometry`, `ExtrudeGeometry`, `LatheGeometry`, `CylinderGeometry`) | VANTA FREIGHT project (original work) | This repository | Original work (project licence) | n/a. No third-party rights. | Target < 15k triangles, 0 KB download (code only), wheels and lights are separate meshes by construction | **High** for brand control and performance. Medium for realism. A stylised, monolithic "stealth freight" look suits the obsidian palette. | **APPROVED: shipped in M1** |
| M1 | Cesium Milk Truck | Cesium (via Khronos glTF-Sample-Assets) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck | **CC BY 4.0** (© 2017 Cesium). The Cesium **logo** is covered separately by `LicenseRef-LegalMark-Cesium`, which grants **no** right to use the mark outside that model's usage. | **[VERIFIED]** `metadata.json`, `README.md`, and `LICENSES/LicenseRef-LegalMark-Cesium.txt` read from raw.githubusercontent.com on 2026-10-28; `metadata.json` re-checked 2026-10-29 | Original: GLB 369,980 bytes, about 3.6k triangles, one 2048² JPEG with the logo. **Committed copy** (`tests/fixtures/cesium-milk-truck.glb`): textures and animation removed, deduplicated, welded and pruned; 113 KB, 2,856 triangles, **no logo**. | Pipeline test fixture for M5. Toy proportions; not suitable as the hero. | **APPROVED as a test fixture only** (credited in `tests/fixtures/README.md`). Never shipped: a test checks that the production build doesn't contain it. |
| M2 | Kenney "Car Kit" 2.0 (45 models: cars, pickup, flatbed, box truck, van; **no semi**) | Kenney (kenney.nl) | https://www.kenney.nl/assets/car-kit (zip supplied by the owner on the `models` branch, commit `416d386`; SHA-256 `f8a69b83…1d14`) | **CC0 1.0** | **[VERIFIED]** from `License.txt` inside the kit on 2026-10-29 ("Creative Commons Zero, CC0 … personal, educational, and commercial purposes"). Copy in `assets-src/kenney-car-kit/License.txt`. | GLB files 172–235 KB, about 2–2.5k triangles each, one shared palette texture (`colormap.png`). Toy-style proportions. | Wrong shape for the hero (no tractor-trailer). A good fit as **background yard traffic**. | **APPROVED: shipped as yard traffic** (`public/models/kenney/`: delivery, delivery-flat, truck-flat, van). Recoloured to the brand palette with vertex colours, texture removed, optimised; see `assets-src/kenney-car-kit/README.md`. Credited on `/about/#credits`. |
| M3 | "Vehicles" low-poly pack (van, hot rod, pickup, **semi-truck**) | Per OpenGameArt listing (author not captured) | https://opengameart.org/content/vehicles-0 | **CC0** | **[SECONDARY]** search summary. opengameart.org was blocked here. | **[SECONDARY]** single GIMP-made texture, low poly. Format not confirmed. | Medium for a fleet silhouette, low for the hero. | CANDIDATE: needs first-hand check |
| M4 | "Low Poly Truck" | Arifido._ (Sketchfab) | https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216 | **CC BY** (per search summary) | **[SECONDARY]**. sketchfab.com was blocked here. Downloading needs a free Sketchfab account. | **[SECONDARY]** about 11.3k triangles. Trailer and glTF availability are not confirmed. Truck type is not confirmed. | Unknown until inspected | CANDIDATE: needs first-hand check |
| M5 | Quaternius "LowPoly Public Transport" | Quaternius | https://opengameart.org/node/83020 | **CC0** | **[SECONDARY]** | Blend/OBJ/FBX, **no semi or box truck** (buses, ambulance, taxi, and so on) | Low: no suitable truck | REJECTED for the hero (possible background traffic) |
| M6 | "White Low Poly Semi Truck" | Polyjo (Sketchfab) | https://sketchfab.com/3d-models/white-low-poly-semi-truck-bb4cf0f9d2054ed0ab78eba03f56a5d7 | **CC BY-NC** (per search summary) | **[SECONDARY]** | about 676 triangles | n/a | **REJECTED**: NonCommercial |
| M7 | "Free Lowpoly Semi Truck" | craigsnedeker (itch.io) | https://craigsnedeker.itch.io/lowpoly-semi-truck | **CC BY-NC-SA 4.0** (per search summary) | **[SECONDARY]** | .blend only, includes a trailer | n/a | **REJECTED**: NonCommercial and ShareAlike |
| M8 | CGTrader / Fab "royalty-free" semi trucks | various | cgtrader.com, fab.com | Royalty Free (paid or restricted) | **[SECONDARY]** | n/a | n/a | **REJECTED**: not free, or the licence is not open |

### Recommendation

1. ✅ **Ship M0 (procedural truck).** Done in M1–M3. It carries zero licence risk, adds no download weight, and keeps full brand control.
2. ✅ **Put the truck behind one interface.** Done in M5: `createTruck()` in `src/webgl/truck/truck-source.js` takes either the procedural truck or `loadGltfTruck({ url, mapping })`. A licensed GLB (M2, M3 or M4) can replace it by changing `src/webgl/truck/hero-truck.js`, without touching the choreography.
3. ✅ **Use M1 only as a test fixture.** Done in M5: committed without its logo texture in `tests/fixtures/`, credited, and checked never to reach the production build.
4. To verify M2, M3, or M4 first-hand, choose one:
   - **(a)** allow `kenney.nl`, `itch.io`, `opengameart.org`, `sketchfab.com`, and `poly.pizza` in the environment's network settings, or
   - **(b)** the owner downloads the file and commits it to `assets-src/` along with the licence text or a screenshot of the licence panel.

---

## 4. Images, posters, video, audio

| ID | Asset | Source | Licence | Status |
|---|---|---|---|---|
| I1 | Hero posters: `public/posters/hero-desktop.{webp,jpg}` (1920×1080), `hero-mobile.{webp,jpg}` (900×1600) | **Self-rendered** from the M1 scene by `npm run posters` (browser canvas encoder, WebP and JPEG; AVIF is not available from the canvas encoder) | Original work | **APPROVED** (M1) |
| I2 | Open Graph / social images | Self-rendered | Original work | Planned |
| I4 | Network map, crates, fleet variants, x-ray outline (M2) | Generated in code from `src/data/network.js` and the procedural truck; no external files | Original work | **APPROVED** (M2) |
| I5 | Fleet posters: `public/posters/fleet-{semi,rigid,tractor}.{webp,jpg}` (1864×1046) | Self-rendered from the fleet turntable by `npm run posters` | Original work | **APPROVED** (M3) |
| I6 | Service route maps | Generated at build time from `src/data/network.js` | Original work | **APPROVED** (M3) |
| I7 | Social card: `public/og/vanta-freight.jpg` (1200×630) | Composed by `npm run posters` from the self-rendered hero poster and the site's own fonts (`scripts/og-card.html`) | Original work | **APPROVED** (M6) |
| I8 | Yard traffic: `public/models/kenney/{delivery,delivery-flat,truck-flat,van}.glb` | Kenney Car Kit (CC0), modified by `scripts/prepare-kenney.mjs` | CC0 1.0 | **APPROVED** (M5) |
| I3 | Favicon: `public/favicon.svg` | Self-made SVG ("V" monogram in lime on obsidian) | Original work | **APPROVED** (M1) |
| — | Stock photography / video | **None planned.** The cinematic look comes from real-time 3D, SVG, and typography. Any future stock asset needs a row here with its licence verified first-hand. | — | — |
| — | Audio | **None planned.** If added, it must be opt-in, muted by default, and CC0. | — | — |

## 5. Attribution block

Rendered on `/about/#credits` from `src/data/credits.js`. The smoke suite fails if a third-party credit is missing from this manifest. Current credits: three.js (MIT), Kenney's Car Kit (CC0, courtesy credit), GSAP and ScrollTrigger (GreenSock Standard License), Archivo and JetBrains Mono (OFL-1.1), Vite (MIT, build only) and Playwright (Apache-2.0, tests only). The trucks, posters, network map and favicon are original work.
