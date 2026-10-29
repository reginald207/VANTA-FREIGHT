# VANTA FREIGHT — Asset Manifest

> Every third-party file that ships in the site (models, textures, images, video, audio, fonts, libraries) **must** have a row here before it is merged. Rows record the source URL, author, licence, how the licence was verified, the verification date, and any modifications.
>
> **Status values:** `APPROVED`, meaning it may ship; `CANDIDATE`, meaning evaluation is pending; `REJECTED`, meaning it must not ship.
> **Verification levels:** **[VERIFIED]** means the licence text or metadata was read from a primary source. **[SECONDARY]** means it is known only from search-result summaries, because the primary page was blocked from this environment. **[UNVERIFIED]** means it has not been checked.

Last updated: 2026-10-29 (milestone M3).

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
| L10 | lighthouse (audit tool, run ad hoc via a scratch install; not a project dependency) | 13.6.0 | npm `lighthouse` | Apache-2.0 | **[VERIFIED]** npm metadata, 2026-10-29 | APPROVED (tooling) |
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
| M1 | Cesium Milk Truck | Cesium (via Khronos glTF-Sample-Assets) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck | **CC BY 4.0** (© 2017 Cesium). The Cesium **logo** is covered separately by `LicenseRef-LegalMark-Cesium`, which grants **no** right to use the mark outside that model's usage. | **[VERIFIED]** `metadata.json`, `README.md`, and `LICENSES/LicenseRef-LegalMark-Cesium.txt` read from raw.githubusercontent.com, 2026-10-28 | **[VERIFIED by gltf-transform inspect]** GLB 369,980 bytes. ~3.6k triangles (10,872 render verts). 2 meshes (body, wheels ×2 instances). 4 materials. 1 × 2048² JPEG (219 KB, ≈22 MB GPU). Has an animation (wheels). No extensions. | **Low** for the hero: toy-like proportions, and the logo baked into the texture means the texture must be replaced. **Useful as a pipeline test fixture** (loader, material override, wheel rotation) without the original texture. | CANDIDATE (test fixture only; must not ship with original texture) |
| M2 | Kenney "Car Kit" (contains truck, delivery and van models) | Kenney (kenney.nl) | https://www.kenney.nl/assets/car-kit · https://kenney-assets.itch.io/car-kit | **CC0 1.0** | **[SECONDARY]** Search results quote the itch.io page: "CC0 1.0 Universal … any project including commercial ones". kenney.nl and itch.io pages were blocked here. | **[SECONDARY]** 45 assets, OBJ/FBX/glTF, about 3.4 MB zip, v2.0 "completely remade". Truck filenames and triangle counts are not confirmed. Likely very low-poly and stylised. | Medium-low: the stylised toy aesthetic needs a heavy material override. It is a good source of **background traffic and fleet silhouettes**. | CANDIDATE: needs first-hand check of zip contents and License.txt |
| M3 | "Vehicles" low-poly pack (van, hot rod, pickup, **semi-truck**) | Per OpenGameArt listing (author not captured) | https://opengameart.org/content/vehicles-0 | **CC0** | **[SECONDARY]** search summary. opengameart.org was blocked here. | **[SECONDARY]** single GIMP-made texture, low poly. Format not confirmed. | Medium for a fleet silhouette, low for the hero. | CANDIDATE: needs first-hand check |
| M4 | "Low Poly Truck" | Arifido._ (Sketchfab) | https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216 | **CC BY** (per search summary) | **[SECONDARY]**. sketchfab.com was blocked here. Downloading needs a free Sketchfab account. | **[SECONDARY]** about 11.3k triangles. Trailer and glTF availability are not confirmed. Truck type is not confirmed. | Unknown until inspected | CANDIDATE: needs first-hand check |
| M5 | Quaternius "LowPoly Public Transport" | Quaternius | https://opengameart.org/node/83020 | **CC0** | **[SECONDARY]** | Blend/OBJ/FBX, **no semi or box truck** (buses, ambulance, taxi, and so on) | Low: no suitable truck | REJECTED for the hero (possible background traffic) |
| M6 | "White Low Poly Semi Truck" | Polyjo (Sketchfab) | https://sketchfab.com/3d-models/white-low-poly-semi-truck-bb4cf0f9d2054ed0ab78eba03f56a5d7 | **CC BY-NC** (per search summary) | **[SECONDARY]** | about 676 triangles | n/a | **REJECTED**: NonCommercial |
| M7 | "Free Lowpoly Semi Truck" | craigsnedeker (itch.io) | https://craigsnedeker.itch.io/lowpoly-semi-truck | **CC BY-NC-SA 4.0** (per search summary) | **[SECONDARY]** | .blend only, includes a trailer | n/a | **REJECTED**: NonCommercial and ShareAlike |
| M8 | CGTrader / Fab "royalty-free" semi trucks | various | cgtrader.com, fab.com | Royalty Free (paid or restricted) | **[SECONDARY]** | n/a | n/a | **REJECTED**: not free, or the licence is not open |

### Recommendation

1. **Ship M0 (procedural truck) for the first milestone.** It carries zero licence risk, adds no download weight, and keeps full brand control. It is also the only option fully verifiable from this environment.
2. Put the truck behind a `TruckSource` interface (`createProceduralTruck()` and `loadGltfTruck(url, mapping)`). A licensed GLB (M2, M3, or M4) can then replace it later without touching the choreography.
3. Use **M1 only as a local test fixture**, to exercise GLTFLoader, wheel-node mapping, and material overrides. Never ship its original texture.
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
| I3 | Favicon: `public/favicon.svg` | Self-made SVG ("V" monogram in lime on obsidian) | Original work | **APPROVED** (M1) |
| — | Stock photography / video | **None planned.** The cinematic look comes from real-time 3D, SVG, and typography. Any future stock asset needs a row here with its licence verified first-hand. | — | — |
| — | Audio | **None planned.** If added, it must be opt-in, muted by default, and CC0. | — | — |

## 5. Attribution block

Rendered on `/about/#credits` from `src/data/credits.js`. The smoke suite fails if a third-party credit is missing from this manifest. Current credits: three.js (MIT), GSAP and ScrollTrigger (GreenSock Standard License), Archivo and JetBrains Mono (OFL-1.1), Vite (MIT, build only) and Playwright (Apache-2.0, tests only). The trucks, posters, network map and favicon are original work.
