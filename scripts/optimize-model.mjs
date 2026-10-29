// Prepares a licensed glTF truck for the site (milestone M5):
//
//   node scripts/optimize-model.mjs <input.glb> <output.glb> [--keep-textures]
//
// By default textures are stripped (the brand materials replace them, which
// also removes any third-party logos) and animations are dropped (the site
// drives the wheels itself). Geometry is deduplicated, pruned and welded.
// No Draco or Meshopt compression: their decoders need WebAssembly, which the
// Content Security Policy does not allow.
//
// Fails if the result is over budget (ASSET_MANIFEST.md): 1.5 MB, 50k triangles.
import { stat } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';

export const BUDGET = { bytes: 1.5 * 1024 * 1024, triangles: 50_000 };

export function countTriangles(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount();
      triangles += count / 3;
    }
  }
  return triangles;
}

export async function optimizeModel(input, output, { keepTextures = false } = {}) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const root = document.getRoot();

  if (!keepTextures) {
    for (const material of root.listMaterials()) {
      material
        .setBaseColorTexture(null)
        .setNormalTexture(null)
        .setOcclusionTexture(null)
        .setEmissiveTexture(null)
        .setMetallicRoughnessTexture(null);
    }
    root.listTextures().forEach((texture) => texture.dispose());
  }
  root.listAnimations().forEach((animation) => animation.dispose());

  await document.transform(dedup(), weld(), prune());
  await io.write(output, document);

  const bytes = (await stat(output)).size;
  const triangles = countTriangles(document);
  return {
    bytes,
    triangles,
    textures: root.listTextures().length,
    withinBudget: bytes <= BUDGET.bytes && triangles <= BUDGET.triangles,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!input || !output) {
    console.error('Usage: node scripts/optimize-model.mjs <input.glb> <output.glb> [--keep-textures]');
    process.exit(2);
  }
  const before = (await stat(input)).size;
  const result = await optimizeModel(input, output, { keepTextures: process.argv.includes('--keep-textures') });
  console.log(
    `${output}: ${(before / 1024).toFixed(0)} KB → ${(result.bytes / 1024).toFixed(0)} KB, ` +
      `${Math.round(result.triangles).toLocaleString('en')} triangles, ${result.textures} textures`,
  );
  if (!result.withinBudget) {
    console.error(`Over budget: max ${(BUDGET.bytes / 1024 / 1024).toFixed(1)} MB and ${BUDGET.triangles.toLocaleString('en')} triangles.`);
    process.exit(1);
  }
}
