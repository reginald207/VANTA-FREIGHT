// Prepares Kenney Car Kit vehicles (CC0, see assets-src/kenney-car-kit/) as
// brand-coloured yard traffic:
//
//   node scripts/prepare-kenney.mjs "<Car Kit>/Models/GLB format" public/models/kenney
//
// Kenney colours each model from one palette texture. Shipping that texture
// would need `blob:` in the Content Security Policy (the glTF loader decodes
// embedded images through blob URLs), so instead the palette is baked into
// per-vertex colours, remapped onto the brand palette, and the texture is
// dropped. Then the usual optimiser runs (dedup, weld, prune, budget check).
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Accessor, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getPixels } from 'ndarray-pixels';
import { optimizeModel } from './optimize-model.mjs';

export const VEHICLES = ['delivery', 'delivery-flat', 'truck-flat', 'van'];

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
// Light bodies on purpose: the yard sits 20-40 m out in a dark, foggy night,
// so steel-to-ice panels and lime livery are what keep it readable behind the
// carbon hero truck.
const BRAND = {
  trimDark: hex('#0a0c0b'),
  trimLight: hex('#1d211f'),
  steelDark: hex('#5b6660'),
  steelLight: hex('#e9ede8'),
  glass: hex('#0b1210'),
  lime: hex('#c7ff4a'),
};
const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * Math.min(1, Math.max(0, t))));

function hsl([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * Maps one Kenney palette colour (sRGB 0-255) onto the brand palette,
 * keeping its relative lightness so the model's shading survives.
 */
export function brandColor(rgb) {
  const { h, l } = hsl(rgb);
  if (l > 0.82 && h >= 185 && h <= 220 && rgb[2] > rgb[0] + 12) return BRAND.glass; // windows
  // Chroma rather than HSL saturation, which runs high for Kenney's pale lilac panels.
  if (Math.max(...rgb) - Math.min(...rgb) > 75) return BRAND.lime; // lamps and paint accents become lime livery
  if (l < 0.3) return mix(BRAND.trimDark, BRAND.trimLight, l / 0.3); // tyres, chassis
  return mix(BRAND.steelDark, BRAND.steelLight, (l - 0.3) / 0.6); // blue-grey bodies, white panels
}

const toLinear = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export async function bakeBrandColors(input, output) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const root = document.getRoot();
  const texture = root.listTextures()[0];
  if (!texture) throw new Error(`${input}: expected a palette texture`);
  const pixels = await getPixels(texture.getImage(), texture.getMimeType());
  const [width, height] = pixels.shape;

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const uv = primitive.getAttribute('TEXCOORD_0');
      const colors = new Float32Array(uv.getCount() * 3);
      const pair = [];
      for (let i = 0; i < uv.getCount(); i += 1) {
        uv.getElement(i, pair);
        const x = Math.min(width - 1, Math.max(0, Math.floor(pair[0] * width)));
        const y = Math.min(height - 1, Math.max(0, Math.floor(pair[1] * height)));
        const brand = brandColor([0, 1, 2].map((c) => pixels.get(x, y, c)));
        colors.set(brand.map(toLinear), i * 3);
      }
      primitive.setAttribute(
        'COLOR_0',
        document.createAccessor().setType(Accessor.Type.VEC3).setArray(colors).setBuffer(uv.getBuffer()),
      );
      primitive.setAttribute('TEXCOORD_0', null);
      primitive.getMaterial()?.setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0.1).setRoughnessFactor(0.6);
    }
  }
  root.listMaterials().forEach((material) => material.setName('kenney-brand'));
  await io.write(output, document);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, outDir] = process.argv.slice(2);
  if (!source || !outDir) {
    console.error('Usage: node scripts/prepare-kenney.mjs "<Car Kit>/Models/GLB format" public/models/kenney');
    process.exit(2);
  }
  await mkdir(outDir, { recursive: true });
  const scratch = join(tmpdir(), `vf-kenney-${process.pid}`);
  await mkdir(scratch, { recursive: true });
  let failed = false;
  try {
    for (const name of VEHICLES) {
      const baked = join(scratch, `${name}.glb`);
      await bakeBrandColors(join(source, `${name}.glb`), baked);
      const result = await optimizeModel(baked, join(outDir, `${name}.glb`));
      failed ||= !result.withinBudget;
      console.log(`${name}.glb: ${(result.bytes / 1024).toFixed(0)} KB, ${Math.round(result.triangles)} triangles`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  if (failed) process.exit(1);
}
