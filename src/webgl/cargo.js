// Scene 4: cargo. Instanced crates packed inside the trailer slide out of the
// rear on lime rails and settle into one cluster per cargo category.
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { PALETTE } from './palette.js';

// Order matches the cargo cards in index.html.
export const CARGO_CATEGORIES = [
  { id: 'palletised', count: 6, size: [1.1, 1.0, 1.0], color: '#3b463f', cluster: [-19.5, -3.6] },
  { id: 'temperature', count: 6, size: [1.2, 1.2, 1.0], color: '#cfd8d3', cluster: [-19.5, 3.6] },
  { id: 'oversized', count: 1, size: [2.6, 1.7, 1.9], color: '#6c7a72', cluster: [-25.5, -3.4] },
  { id: 'time-critical', count: 4, size: [0.8, 0.7, 0.8], color: PALETTE.lime, cluster: [-25.5, 3.6] },
];

const TRAILER_FLOOR = 1.36;
const DOOR_X = -14.3;
const STAGGER = 0.22;

function layoutCrates() {
  const crates = [];
  // Pack two rows from the rear door forwards; the oversized crate spans both.
  let cursor = { left: -13.0, right: -13.0 };
  CARGO_CATEGORIES.forEach((category, categoryIndex) => {
    for (let i = 0; i < category.count; i += 1) {
      const [sx, sy, sz] = category.size;
      let x;
      let z;
      if (sz > 1.2) {
        x = Math.max(cursor.left, cursor.right) + sx / 2;
        z = 0;
        cursor.left = cursor.right = x + sx / 2 + 0.15;
      } else {
        const side = cursor.left <= cursor.right ? 'left' : 'right';
        x = cursor[side] + sx / 2;
        z = side === 'left' ? -0.6 : 0.6;
        cursor[side] = x + sx / 2 + 0.12;
      }
      // Cluster target: a tidy grid around the category's centre.
      const column = i % 3;
      const row = Math.floor(i / 3);
      const [cx, cz] = category.cluster;
      crates.push({
        categoryIndex,
        size: new Vector3(sx, sy, sz),
        start: new Vector3(x, TRAILER_FLOOR + sy / 2, z),
        end: new Vector3(cx + (column - 1) * 1.6, sy / 2, cz + (row - 0.5) * 1.6),
      });
    }
  });
  // Rear-most crates leave first.
  return crates.sort((a, b) => a.start.x - b.start.x);
}

export function createCargo() {
  const crates = layoutCrates();
  const group = new Group();
  group.name = 'cargo';

  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ metalness: 0.3, roughness: 0.55 }),
    crates.length,
  );
  mesh.frustumCulled = false;
  const color = new Color();
  crates.forEach((crate, index) => {
    mesh.setColorAt(index, color.set(CARGO_CATEGORIES[crate.categoryIndex].color));
  });
  group.add(mesh);

  // Lime rails from the rear door to the clusters.
  const railMaterial = new MeshBasicMaterial({ color: PALETTE.lime.clone(), toneMapped: false });
  const rails = [-0.55, 0.55].map((z) => {
    const rail = new Mesh(new BoxGeometry(13, 0.03, 0.05), railMaterial);
    rail.position.set(DOOR_X - 6.5, 0.02, z);
    group.add(rail);
    return rail;
  });

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const total = 1 + (crates.length - 1) * STAGGER;
  let active = -1;

  // `xray` keeps the packed crates visible inside the see-through trailer.
  function setProgress(value, xray = 0) {
    group.visible = value > 0.001 || xray > 0.01;
    rails.forEach((rail) => {
      rail.visible = value > 0.001;
    });
    railMaterial.color.copy(PALETTE.lime).multiplyScalar(Math.min(1, value * 4));
    let latest = -1;

    crates.forEach((crate, index) => {
      const u = Math.min(1, Math.max(0, value * total - index * STAGGER));
      if (u < 0.4) {
        // Slide along the trailer floor to the door.
        const s = u / 0.4;
        position.copy(crate.start);
        position.x += (DOOR_X - crate.start.x) * s * s * (3 - 2 * s);
      } else {
        // Arc down from the door to the cluster.
        const s = (u - 0.4) / 0.6;
        const eased = s * s * (3 - 2 * s);
        position.set(DOOR_X, crate.start.y, crate.start.z).lerp(crate.end, eased);
        position.y += Math.sin(Math.PI * eased) * 0.8;
      }
      if (u > 0.5) latest = crate.categoryIndex;
      mesh.setMatrixAt(index, matrix.compose(position, rotation, crate.size));
    });
    mesh.instanceMatrix.needsUpdate = true;

    active = latest;
  }

  setProgress(0);
  return {
    group,
    setProgress,
    // Index into CARGO_CATEGORIES of the most recently landed cluster, or -1.
    get activeCategory() {
      return active;
    },
  };
}
