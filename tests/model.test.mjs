// The glTF truck pipeline (milestone M5), exercised with the test fixture:
// the Khronos Cesium Milk Truck, stripped of its texture (see tests/fixtures).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { Box3 } from 'three';
import { BUDGET, optimizeModel } from '../scripts/optimize-model.mjs';
import { loadGltfTruck } from '../src/webgl/truck/gltf-truck.js';

const fixture = new URL('./fixtures/cesium-milk-truck.glb', import.meta.url);
const mapping = JSON.parse(readFileSync(new URL('./fixtures/cesium-milk-truck.json', import.meta.url), 'utf8'));
// Same rotation (q and -q included). Quaternion.angleTo uses acos, which
// cannot resolve angles below ~1e-4, so compare normalised dot products
// (glTF stores rotations as float32, so they are not exactly unit length).
const sameRotation = (a, b) => 1 - Math.abs(a.dot(b)) / (a.length() * b.length()) < 1e-9;

const load = () => {
  const bytes = readFileSync(fixture);
  return loadGltfTruck({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mapping });
};

describe('optimize-model', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vf-model-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  test('keeps the fixture within budget, with no textures', async () => {
    const result = await optimizeModel(fixture.pathname, join(dir, 'out.glb'));
    assert.ok(result.withinBudget);
    assert.equal(result.textures, 0);
    assert.ok(result.bytes < BUDGET.bytes && result.triangles < BUDGET.triangles);
  });
});

describe('loadGltfTruck', () => {
  test('orients, scales and places the model like the procedural truck', async () => {
    const truck = await load();
    const box = new Box3().setFromObject(truck.group);
    assert.ok(Math.abs(box.min.y) < 1e-6, 'stands on y = 0');
    assert.ok(Math.abs(box.max.x - box.min.x - mapping.length) < 0.25, 'real length along X');
    assert.ok(Math.abs(truck.footprint.frontX - 3.45) < 1e-6, 'nose where the camera expects it');
    assert.ok(Math.abs(box.min.z + box.max.z) < 0.05, 'centred across the lane');
    assert.equal(truck.headlights.length, 2);
  });

  test('wheels roll with distance and come back to rest', async () => {
    const truck = await load();
    assert.equal(truck.wheelCount, 2);
    assert.ok(truck.wheelRadius > 0.2 && truck.wheelRadius < 1, `radius ${truck.wheelRadius}`);
    const wheel = truck.group.getObjectByName('Wheels');
    const rest = wheel.quaternion.clone();
    truck.setDistance(1);
    assert.ok(wheel.quaternion.angleTo(rest) > 0.5, 'turned');
    truck.setDistance(0);
    assert.ok(sameRotation(wheel.quaternion, rest), 'back at rest');
    truck.setDistance(2 * Math.PI * truck.wheelRadius);
    assert.ok(sameRotation(wheel.quaternion, rest), 'one full turn per circumference');
    const other = truck.group.getObjectByName('Wheels001');
    assert.ok(other, 'names from the file ("Wheels.001") match after three.js sanitises them');
  });

  test('every mesh wears a brand material, and the lime strip is added', async () => {
    const truck = await load();
    const names = new Set();
    truck.group.traverse((object) => {
      if (object.isMesh) [object.material].flat().forEach((material) => names.add(material.name || material.type));
    });
    // Brand materials are unnamed three.js materials; the model's own are named.
    for (const original of Object.keys(mapping.materials)) assert.ok(!names.has(original), `${original} replaced`);
    let limeStrips = 0;
    truck.group.traverse((object) => {
      if (object.isMesh && object.geometry.type === 'BoxGeometry') limeStrips += 1;
    });
    assert.equal(limeStrips, 2);
    truck.setStrip(0.5);
    truck.setHeadlights(1);
    truck.setXray(1); // no cargo nodes mapped: a no-op, not an error
  });

  test('a bad mapping is rejected clearly', async () => {
    await assert.rejects(loadGltfTruck({ data: new ArrayBuffer(0), mapping: { forward: 'up', length: 5 } }), /bad forward/);
    await assert.rejects(loadGltfTruck({ data: new ArrayBuffer(0), mapping: { forward: '+x' } }), /length/);
  });
});

describe('production hero', () => {
  test('ships the procedural truck until a model is approved', async () => {
    const source = readFileSync(new URL('../src/webgl/truck/hero-truck.js', import.meta.url), 'utf8');
    assert.match(source, /export const HERO_TRUCK = \{ type: 'procedural' \};/);
  });
});

describe('Kenney yard traffic (CC0)', async () => {
  const { NodeIO } = await import('@gltf-transform/core');
  const { brandColor, VEHICLES } = await import('../scripts/prepare-kenney.mjs');
  const { PARKED } = await import('../src/webgl/yard-traffic.js');
  const { countTriangles } = await import('../scripts/optimize-model.mjs');
  const file = (name) => new URL(`../public/models/kenney/${name}.glb`, import.meta.url);
  const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const toSrgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

  test('the palette maps onto brand tones: paint and lamps lime, windows glass, bodies light steel', () => {
    assert.equal(hex(brandColor([0xd3, 0xec, 0xff])), '#0b1210');
    for (const accent of [[0xff, 0xc7, 0x1d], [0x28, 0x92, 0x6f], [0xe5, 0x5f, 0x48], [0x5f, 0x74, 0xca]]) {
      assert.equal(hex(brandColor(accent)), '#c7ff4a', `${hex(accent)} became lime livery`);
    }
    // Pale lilac panels and blue-grey bodies: neutral, and light enough to read in the fog.
    for (const body of [[0xb5, 0xbd, 0xe3], [0x88, 0x8e, 0xaa], [0xda, 0xda, 0xe8]]) {
      const [r, g, b] = brandColor(body);
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 24, `${hex(body)} became a neutral`);
      assert.ok(g > 0x90, `${hex(body)} stays light`);
    }
  });

  for (const name of VEHICLES) {
    test(`${name}.glb is textureless, vertex-coloured in brand tones and within budget`, async () => {
      const document = await new NodeIO().read(file(name).pathname);
      const root = document.getRoot();
      assert.equal(root.listTextures().length, 0);
      assert.ok(countTriangles(document) < 5000);
      for (const mesh of root.listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
          const colors = primitive.getAttribute('COLOR_0');
          assert.ok(colors, `${name}: every primitive has vertex colours`);
          assert.equal(primitive.getAttribute('TEXCOORD_0'), null);
          const rgb = [];
          for (let i = 0; i < colors.getCount(); i += 1) {
            const srgb = colors.getElement(i, rgb).map(toSrgb);
            const spread = Math.max(...srgb) - Math.min(...srgb);
            assert.ok(hex(srgb) === '#c7ff4a' || spread < 24, `${name}: off-brand colour ${hex(srgb)}`);
          }
        }
      }
    });
  }

  test('every parked vehicle loads, and every spot is clear of the fleet lanes and cargo', async () => {
    for (const { model, length, x, z } of PARKED) {
      const bytes = readFileSync(file(model));
      const truck = await loadGltfTruck({
        data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        mapping: { forward: '+z', length, materials: { '*': 'keep' } },
      });
      assert.ok(Math.abs(truck.footprint.maxX - truck.footprint.minX - length) < 0.2, `${model} is ${length} m`);
      // Clear of the road, the fleet lanes (z -7.6 and -15.2, trucks ±1.3 m,
      // running in from far -x to a nose at x ≈ 3.5) and the cargo clusters.
      assert.ok(Math.abs(z) >= 4, `${model} at z=${z} clears the road`);
      if (x < 6) {
        for (const lane of [-7.6, -15.2]) assert.ok(Math.abs(z - lane) >= 3.5, `${model} at z=${z} clears the lane at ${lane}`);
      }
      assert.ok(!(x > -29 && x < -15 && Math.abs(z) < 7), `${model} at (${x}, ${z}) clears the cargo clusters`);
      assert.ok(Math.abs(x) < 40, `${model} at x=${x} stays inside the yard`);
    }
  });
});
