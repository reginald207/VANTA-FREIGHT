// A licensed glTF truck behind the same Truck interface as the procedural one
// (milestone M5). Only use models whose licence is APPROVED in
// ASSET_MANIFEST.md, prepared with scripts/optimize-model.mjs.
//
// Everything model-specific lives in a mapping:
//
//   {
//     forward: '+x' | '-x' | '+z' | '-z',  // the model's nose direction
//     length: 17,                          // real length in metres (sets scale)
//     wheels: { nodes: ['Wheel_*'], axis: 'y', spin: 1 },
//     materials: { 'paint': 'body', 'glass': 'glass', '*': 'body' },
//     strip: { y: 1.37 },                  // optional lime line along both sides
//     cargo: ['Trailer*'],                 // optional nodes that fade for the x-ray
//   }
//
// Material names map to the brand materials: body, trailer, rib, trim, glass,
// steel, lime, head, tail, tyre, rim, or 'keep' for the model's own.
import { Box3, BoxGeometry, Group, Mesh, PropertyBinding, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PALETTE } from '../palette.js';
import { createBrandMaterials } from './procedural-truck.js';

// The procedural truck's nose sits here; keeping it lets the camera
// choreography frame any model the same way.
const FRONT_X = 3.45;
const FORWARD_ROTATION = { '+x': 0, '-x': Math.PI, '+z': Math.PI / 2, '-z': -Math.PI / 2 };
const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

// Name patterns: exact names, or a trailing * for a prefix. Written as the
// file names them; three.js sanitises node names on load ("Wheels.001"
// becomes "Wheels001"), so patterns are sanitised the same way.
function matcher(patterns = []) {
  const clean = patterns.map((pattern) => PropertyBinding.sanitizeNodeName(pattern));
  return (name = '') =>
    clean.some((pattern) => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern));
}

function brandMaterialFor(name, mapping, materials) {
  const key = mapping.materials?.[name] ?? mapping.materials?.['*'] ?? 'body';
  if (key === 'keep') return null;
  if (!materials[key]) throw new Error(`gltf-truck: unknown brand material "${key}" for "${name}"`);
  return materials[key];
}

/**
 * @param {{url?: string, data?: ArrayBuffer, mapping: object}} source
 * @returns {Promise<import('./truck-source.js').Truck>}
 */
export async function loadGltfTruck({ url, data, mapping }) {
  if (!(mapping.forward in FORWARD_ROTATION)) throw new Error(`gltf-truck: bad forward "${mapping.forward}"`);
  if (!(mapping.length > 0)) throw new Error('gltf-truck: mapping.length (metres) is required');

  const loader = new GLTFLoader();
  const gltf = data ? await loader.parseAsync(data, '') : await loader.loadAsync(url);
  const model = gltf.scene;

  // Brand materials replace the model's own.
  const materials = createBrandMaterials();
  model.traverse((object) => {
    if (!object.isMesh) return;
    const swap = (material) => brandMaterialFor(material.name, mapping, materials) ?? material;
    object.material = Array.isArray(object.material) ? object.material.map(swap) : swap(object.material);
  });

  // Orient (nose to +X), scale to real length, stand on y = 0, nose at FRONT_X.
  const oriented = new Group();
  oriented.add(model);
  oriented.rotation.y = FORWARD_ROTATION[mapping.forward];
  const box = new Box3();
  oriented.updateMatrixWorld(true);
  box.setFromObject(oriented);
  oriented.scale.setScalar(mapping.length / (box.max.x - box.min.x));
  oriented.updateMatrixWorld(true);
  box.setFromObject(oriented);
  oriented.position.set(FRONT_X - box.max.x, -box.min.y, -(box.min.z + box.max.z) / 2);
  oriented.updateMatrixWorld(true);
  box.setFromObject(oriented);

  const group = new Group();
  group.name = 'VF-gltf';
  group.add(oriented);
  const halfWidth = (box.max.z - box.min.z) / 2;

  // Optional lime light line along both sides, so any model carries the brand.
  if (mapping.strip) {
    const length = box.max.x - box.min.x;
    for (const side of [-1, 1]) {
      const strip = new Mesh(new BoxGeometry(length * 0.96, 0.025, 0.02), materials.lime);
      strip.position.set((box.min.x + box.max.x) / 2, mapping.strip.y, side * (halfWidth + 0.01));
      group.add(strip);
    }
  }

  // Wheels spin about their own axis; radius from their size in metres.
  const isWheel = matcher(mapping.wheels?.nodes);
  const wheels = [];
  model.traverse((object) => {
    if (isWheel(object.name)) wheels.push({ object, rest: object.quaternion.clone() });
  });
  let radius = 0.5;
  if (wheels.length) {
    const wheelBox = new Box3().setFromObject(wheels[0].object);
    radius = (wheelBox.max.y - wheelBox.min.y) / 2 || radius;
  }
  const axis = AXES[mapping.wheels?.axis ?? 'z'];
  const spin = mapping.wheels?.spin ?? 1;
  const turn = new Quaternion();

  // Cargo nodes fade for the x-ray (their materials are cloned first, so the
  // fade doesn't leak into the rest of the truck).
  const isCargo = matcher(mapping.cargo);
  const cargoMaterials = [];
  model.traverse((object) => {
    if (!object.isMesh || !isCargo(object.name)) return;
    object.material = object.material.clone();
    object.material.transparent = true;
    cargoMaterials.push(object.material);
  });

  const headDim = PALETTE.ice.clone().multiplyScalar(0.12);
  const lightY = Math.min(0.9, (box.max.y - box.min.y) * 0.3);

  return {
    group,
    footprint: { minX: box.min.x, maxX: box.max.x, halfWidth, frontX: box.max.x },
    headlights: [new Vector3(box.max.x, lightY, -halfWidth * 0.72), new Vector3(box.max.x, lightY, halfWidth * 0.72)],
    // Exposed for tests and tooling.
    wheelCount: wheels.length,
    wheelRadius: radius,
    setDistance(distance) {
      turn.setFromAxisAngle(axis, (-spin * distance) / radius);
      wheels.forEach(({ object, rest }) => object.quaternion.copy(rest).multiply(turn));
    },
    setHeadlights(value) {
      materials.head.color.copy(headDim).lerp(PALETTE.ice, value);
    },
    setStrip(value) {
      materials.lime.color.copy(PALETTE.lime).multiplyScalar(value);
    },
    setXray(value) {
      cargoMaterials.forEach((material) => {
        material.opacity = 1 - 0.9 * value;
      });
    },
  };
}
