# Kenney Car Kit (CC0): provenance

- **Work:** Car Kit 2.0 by Kenney (www.kenney.nl), created 2024-05-01.
- **Licence:** Creative Commons Zero (CC0 1.0). See `License.txt` in this folder, copied unchanged from the kit. Verified first-hand from that file on 2026-10-29. Credit is not required; the site credits Kenney anyway on `/about/#credits`.
- **Source file:** `kenney_car-kit.zip` (3,668,013 bytes, SHA-256 `f8a69b83fbf94c9850079bc6e078ea3d8ba4c7393dd9f57f8ba544963d1b1d14`), downloaded from kenney.nl by the project owner and committed on the `models` branch (commit `416d386`). The zip itself is not on `main`.

## Used on the site

`public/models/kenney/delivery.glb`, `delivery-flat.glb`, `truck-flat.glb` and `van.glb` are parked yard traffic in the home film's background.

## Modifications

Made by `scripts/prepare-kenney.mjs`:

- **Recoloured:** the shared palette texture was baked into per-vertex colours remapped onto the VANTA FREIGHT palette. Paint and white panels became carbon, metal became steel grey, tyres and chassis trim black, windows dark glass, and amber lamps lime.
- **Texture removed:** this avoids a `blob:` exception in the Content Security Policy.
- **Optimised:** deduplicated, welded and pruned (`scripts/optimize-model.mjs`). Each file is 78–95 KB with 1.4k–1.7k triangles.

To regenerate them, extract the zip and run:

```bash
node scripts/prepare-kenney.mjs "<Car Kit>/Models/GLB format" public/models/kenney
```
