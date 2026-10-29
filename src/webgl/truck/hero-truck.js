// Which truck stars in the home film.
//
// To use a licensed model (milestone M5):
//   1. Its licence must be APPROVED in ASSET_MANIFEST.md, with any credit
//      added to src/data/credits.js.
//   2. Prepare it: node scripts/optimize-model.mjs input.glb public/models/<name>.glb
//   3. Point HERO_TRUCK at it with a mapping (see gltf-truck.js), e.g.
//      { type: 'gltf', url: '/models/<name>.glb', mapping: { forward: '+z', length: 17, ... } }
//   4. Run `npm run posters` so the static posters match.
export const HERO_TRUCK = { type: 'procedural' };

// Dev-only A/B: `?truck=fixture` swaps in the glTF test fixture (stripped
// from production builds, where the fixture is not served).
export async function heroTruckSource() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('truck') === 'fixture') {
    const mapping = await (await fetch('/tests/fixtures/cesium-milk-truck.json')).json();
    return { type: 'gltf', url: '/tests/fixtures/cesium-milk-truck.glb', mapping };
  }
  return HERO_TRUCK;
}
