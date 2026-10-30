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

describe('fleet liveries', async () => {
  const { LIVERIES } = await import('../src/webgl/truck/procedural-truck.js');
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  test('each class has its own cab paint', () => {
    const colors = ['semi', 'rigid', 'tractor'].map((variant) => LIVERIES[variant].body.color);
    assert.equal(new Set(colors).size, 3);
  });

  test('side lettering contrasts with the box paint it sits on', () => {
    for (const [variant, livery] of Object.entries(LIVERIES)) {
      if (!livery.text) continue;
      const box = luminance(livery.trailer.color);
      const text = luminance(livery.text.name);
      assert.ok(Math.abs(text - box) > 0.5, `${variant}: lettering reads on its box`);
    }
  });
});
