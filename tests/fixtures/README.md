# Test fixtures

## `cesium-milk-truck.glb`

Used only by the tests (`tests/model.test.mjs`) and the dev-only A/B switch (`?truck=fixture` on the dev server). It is **not part of the site**: it isn't in `public/`, the production build does not reference it, and a smoke test checks that it never reaches `dist/`.

- **Work:** Cesium Milk Truck, from the Khronos glTF Sample Assets:
  <https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck>
- **Author and copyright:** © 2017 Cesium.
- **Licence:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode) (CC BY 4.0). Verified from the asset's `metadata.json` on 2026-10-28 and again on 2026-10-29.
- **Trademark:** the original texture carries the Cesium logo, which is covered by separate terms (`LicenseRef-LegalMark-Cesium`) that grant no use beyond the original model. **This copy has no textures, so the logo is not present.**
- **Modifications** (made with `scripts/optimize-model.mjs`): the texture and image were removed; the wheel animation was removed; and the geometry was deduplicated, welded and pruned. The size went from 361 KB to 113 KB, with 2,856 triangles.

`cesium-milk-truck.json` is the mapping that tells `src/webgl/truck/gltf-truck.js` how to orient, scale, re-skin and animate this model.
