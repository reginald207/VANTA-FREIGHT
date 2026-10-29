// VF-01: an original tractor-trailer built from three.js primitives.
// No third-party model, no download. Dimensions are in metres; the truck faces
// +X and stands on y = 0.
//
// Static parts are merged per material (one draw call each). The 12 wheels are
// instanced so they can spin with the scroll for four draw calls in total.
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../palette.js';

const WHEEL_RADIUS = 0.52;
const HALF_WIDTH = 1.27;

// Wheel stations along the truck: x position and tyre width (duals are wider).
const AXLES = [
  { x: 2.2, width: 0.36 },
  { x: -1.0, width: 0.62 },
  { x: -2.35, width: 0.62 },
  { x: -10.0, width: 0.62 },
  { x: -11.3, width: 0.62 },
  { x: -12.6, width: 0.62 },
];

function nonIndexed(geometry) {
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

// Axis-aligned box between two corners.
function slab(x0, x1, y0, y1, z0, z1) {
  const geometry = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return nonIndexed(geometry);
}

// The same slab on both sides of the truck (z mirrored).
function mirrored(x0, x1, y0, y1, zInner, zOuter) {
  return [slab(x0, x1, y0, y1, zInner, zOuter), slab(x0, x1, y0, y1, -zOuter, -zInner)];
}

// A box centred on a point, rotated about Z.
function tiltedBox(width, height, depth, x, y, z, rotationZ) {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateZ(rotationZ);
  geometry.translate(x, y, z);
  return nonIndexed(geometry);
}

function extrudeProfile(points, depth, bevel) {
  const shape = new Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, -depth / 2);
  return nonIndexed(geometry);
}

function createMaterials() {
  return {
    body: new MeshPhysicalMaterial({
      color: '#232a26',
      metalness: 0.5,
      roughness: 0.32,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
    }),
    trailer: new MeshStandardMaterial({ color: '#111412', metalness: 0.35, roughness: 0.5 }),
    rib: new MeshStandardMaterial({ color: '#1d231f', metalness: 0.65, roughness: 0.32 }),
    trim: new MeshStandardMaterial({ color: '#0a0c0b', metalness: 0.2, roughness: 0.8 }),
    glass: new MeshPhysicalMaterial({
      color: '#0a0f0d',
      metalness: 0.9,
      roughness: 0.08,
      clearcoat: 1,
      envMapIntensity: 2.4,
    }),
    steel: new MeshStandardMaterial({ color: PALETTE.steel, metalness: 1, roughness: 0.28 }),
    lime: new MeshBasicMaterial({ color: PALETTE.lime.clone(), toneMapped: false }),
    head: new MeshBasicMaterial({ color: PALETTE.ice.clone(), toneMapped: false }),
    tail: new MeshBasicMaterial({ color: new Color('#ff3324'), toneMapped: false }),
    tyre: new MeshStandardMaterial({ color: '#0a0b0a', metalness: 0, roughness: 0.92 }),
    rim: new MeshStandardMaterial({ color: '#202627', metalness: 0.85, roughness: 0.38 }),
  };
}

function buildTractor(parts) {
  // Cab side profile (x forward, y up), extruded across the width.
  parts.body.push(
    extrudeProfile(
      [
        [0.95, 1.05],
        [3.22, 1.05],
        [3.25, 2.2],
        [3.0, 3.58],
        [2.8, 3.84],
        [1.0, 3.88],
        [0.95, 3.72],
      ],
      2.4,
      0.06,
    ),
  );
  // Roof fairing up to trailer height.
  parts.body.push(
    extrudeProfile(
      [
        [1.0, 3.86],
        [2.55, 3.86],
        [1.6, 4.06],
        [1.0, 4.1],
      ],
      2.2,
      0.04,
    ),
  );

  // Windscreen follows the cab's front slope.
  const slope = new Vector2(-0.25, 1.38);
  const tilt = Math.atan2(-slope.x, slope.y);
  const normal = new Vector2(slope.y, -slope.x).normalize();
  const mid = new Vector2(3.125, 2.89).addScaledVector(normal, 0.075);
  parts.glass.push(tiltedBox(0.02, 1.2, 2.25, mid.x, mid.y, 0, tilt));

  // Lime "eyebrow" light bar on the chamfer above the windscreen.
  parts.lime.push(tiltedBox(0.04, 0.09, 2.3, 2.963, 3.759, 0, Math.atan2(0.2, 0.26)));

  // Side windows and the lime body line.
  parts.glass.push(...mirrored(1.95, 2.8, 2.55, 3.45, HALF_WIDTH - 0.02, HALF_WIDTH + 0.005));
  parts.lime.push(...mirrored(1.0, 3.2, 1.32, 1.355, HALF_WIDTH - 0.01, HALF_WIDTH + 0.004));

  // Grille: recessed panel with steel slats.
  parts.trim.push(slab(3.28, 3.33, 1.3, 2.05, -0.85, 0.85));
  for (let i = 0; i < 5; i += 1) {
    const y = 1.4 + i * 0.14;
    parts.steel.push(slab(3.33, 3.35, y, y + 0.03, -0.8, 0.8));
  }

  // Bumper, headlights and daytime running lines.
  parts.body.push(slab(3.1, 3.42, 0.42, 1.12, -1.25, 1.25));
  parts.head.push(...mirrored(3.42, 3.445, 0.82, 0.95, 0.72, 1.12));
  parts.lime.push(...mirrored(3.42, 3.44, 0.74, 0.765, 0.72, 1.12));

  // Chassis, side skirts, fenders, mudflaps, fifth wheel.
  parts.trim.push(slab(-2.9, 3.1, 0.62, 1.0, -0.5, 0.5));
  parts.body.push(...mirrored(-0.35, 1.62, 0.38, 1.0, 1.12, 1.22));
  parts.trim.push(...mirrored(-2.95, -0.4, 1.08, 1.13, 0.62, 1.28));
  parts.trim.push(...mirrored(-3.0, -2.97, 0.25, 1.0, 0.65, 1.25));
  parts.steel.push(slab(-1.75, -0.6, 1.0, 1.1, -0.6, 0.6));

  // Exhaust stacks behind the cab.
  for (const z of [-1.05, 1.05]) {
    const stack = new CylinderGeometry(0.075, 0.075, 2.3, 16);
    stack.translate(0.78, 2.95, z);
    parts.steel.push(nonIndexed(stack));
  }
}

function buildTrailer(parts) {
  const front = 0.1;
  const rear = -13.5;
  const length = front - rear;

  const box = new RoundedBoxGeometry(length, 2.75, HALF_WIDTH * 2, 2, 0.04);
  box.translate((front + rear) / 2, 1.3 + 2.75 / 2, 0);
  parts.trailer.push(nonIndexed(box));

  // Vertical ribs along both sides.
  for (let x = front - 0.35; x > rear + 0.2; x -= 0.565) {
    parts.rib.push(...mirrored(x - 0.03, x + 0.03, 1.38, 3.98, HALF_WIDTH - 0.01, HALF_WIDTH + 0.02));
  }

  // Rails and the signature lime light line along the lower edge.
  parts.trim.push(slab(rear - 0.05, front + 0.05, 4.02, 4.08, -1.3, 1.3));
  parts.trim.push(...mirrored(rear - 0.05, front + 0.05, 1.26, 1.36, HALF_WIDTH - 0.03, HALF_WIDTH + 0.04));
  parts.lime.push(...mirrored(rear, front, 1.37, 1.395, HALF_WIDTH + 0.01, HALF_WIDTH + 0.035));

  // Underframe, landing gear and aero skirts.
  parts.trim.push(slab(rear, front - 0.1, 1.05, 1.3, -0.55, 0.55));
  parts.steel.push(...mirrored(-2.6, -2.45, 0.28, 1.05, 0.85, 0.95));
  parts.steel.push(...mirrored(-2.7, -2.35, 0.22, 0.28, 0.8, 1.0));
  parts.body.push(...mirrored(-9.6, -3.2, 0.45, 1.22, 1.2, 1.24));
  parts.trim.push(...mirrored(-13.2, -13.17, 0.25, 1.05, 0.65, 1.25));

  // Rear: door seam, tail lights, marker line, underride bar.
  parts.trim.push(slab(rear - 0.03, rear - 0.01, 1.35, 3.98, -0.01, 0.01));
  parts.tail.push(...mirrored(rear - 0.06, rear - 0.02, 0.85, 1.0, 0.8, 1.15));
  parts.lime.push(slab(rear - 0.06, rear - 0.03, 3.92, 3.95, -1.2, 1.2));
  parts.steel.push(slab(-13.45, -13.3, 0.45, 0.6, -1.15, 1.15));
}

function createWheels(materials) {
  // Tyre: a lathe profile with rounded shoulders, unit width along Z.
  const profile = [
    [0.3, -0.5],
    [0.44, -0.5],
    [0.5, -0.46],
    [WHEEL_RADIUS, -0.36],
    [WHEEL_RADIUS, 0.36],
    [0.5, 0.46],
    [0.44, 0.5],
    [0.3, 0.5],
  ].map(([x, y]) => new Vector2(x, y));
  const tyre = new LatheGeometry(profile, 40);
  tyre.rotateX(Math.PI / 2);

  const rim = new CylinderGeometry(0.31, 0.31, 0.96, 32);
  rim.rotateX(Math.PI / 2);

  // Spokes on both faces make the rotation readable.
  const spokes = [];
  for (const face of [-0.49, 0.49]) {
    for (let i = 0; i < 5; i += 1) {
      const spoke = new BoxGeometry(0.06, 0.24, 0.03);
      spoke.translate(0, 0.16, face);
      spoke.rotateZ((i / 5) * Math.PI * 2);
      spokes.push(nonIndexed(spoke));
    }
    const hub = new CylinderGeometry(0.07, 0.07, 0.04, 16);
    hub.rotateX(Math.PI / 2);
    hub.translate(0, 0, face);
    spokes.push(nonIndexed(hub));
  }
  const spokeGeometry = mergeGeometries(spokes);

  // Lime hub rings on both faces.
  const rings = [-0.5, 0.5].map((face) => {
    const ring = new TorusGeometry(0.24, 0.012, 6, 48);
    ring.translate(0, 0, face);
    return nonIndexed(ring);
  });
  const ringGeometry = mergeGeometries(rings);

  const stations = AXLES.flatMap(({ x, width }) =>
    [-1, 1].map((side) => ({
      position: new Vector3(x, WHEEL_RADIUS, side * (HALF_WIDTH - width / 2 + 0.02)),
      scale: new Vector3(1, 1, width),
    })),
  );

  const meshes = [
    new InstancedMesh(tyre, materials.tyre, stations.length),
    new InstancedMesh(rim, materials.rim, stations.length),
    new InstancedMesh(spokeGeometry, materials.steel, stations.length),
    new InstancedMesh(ringGeometry, materials.lime, stations.length),
  ];

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const axis = new Vector3(0, 0, 1);

  function setDistance(distance) {
    rotation.setFromAxisAngle(axis, -distance / WHEEL_RADIUS);
    stations.forEach((station, index) => {
      matrix.compose(station.position, rotation, station.scale);
      meshes.forEach((mesh) => mesh.setMatrixAt(index, matrix));
    });
    meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  setDistance(0);
  meshes.forEach((mesh) => mesh.computeBoundingSphere());
  return { meshes, setDistance };
}

async function createLiveryTexture() {
  try {
    await Promise.all([
      document.fonts.load("800 160px 'Archivo Variable'"),
      document.fonts.load("500 40px 'JetBrains Mono Variable'"),
    ]);
  } catch {
    // Fall back to system fonts; the livery still renders.
  }

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e9ede8';
  ctx.textBaseline = 'alphabetic';
  if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
  let size = 250;
  ctx.font = `800 ${size}px 'Archivo Variable', 'Arial Narrow', sans-serif`;
  const width = ctx.measureText('VANTA FREIGHT').width;
  if (width > 1960) {
    size = Math.floor((size * 1960) / width);
    ctx.font = `800 ${size}px 'Archivo Variable', 'Arial Narrow', sans-serif`;
  }
  ctx.fillText('VANTA FREIGHT', 40, 250);

  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
  ctx.fillStyle = '#c7ff4a';
  ctx.font = "500 46px 'JetBrains Mono Variable', ui-monospace, monospace";
  ctx.fillText('WE MOVE WHAT MOVES THE WORLD.', 48, 345);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createLivery(texture) {
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    color: new Color(0.5, 0.5, 0.5),
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(10.6, (10.6 * 400) / 2048);
  const right = new Mesh(geometry, material);
  right.position.set(-6.75, 2.72, HALF_WIDTH + 0.03);
  const left = new Mesh(geometry, material);
  left.rotation.y = Math.PI;
  left.position.set(-6.75, 2.72, -HALF_WIDTH - 0.03);
  return [right, left];
}

/**
 * @returns {Promise<import('./truck-source.js').Truck>}
 */
export async function createProceduralTruck() {
  const materials = createMaterials();
  const parts = Object.fromEntries(Object.keys(materials).map((key) => [key, []]));

  buildTractor(parts);
  buildTrailer(parts);

  const group = new Group();
  group.name = 'VF-01';

  Object.entries(parts).forEach(([key, geometries]) => {
    if (!geometries.length) return;
    const mesh = new Mesh(mergeGeometries(geometries), materials[key]);
    mesh.name = `vf01-${key}`;
    group.add(mesh);
  });

  const wheels = createWheels(materials);
  wheels.meshes.forEach((mesh) => group.add(mesh));

  const livery = createLivery(await createLiveryTexture());
  livery.forEach((mesh) => group.add(mesh));

  const headDim = PALETTE.ice.clone().multiplyScalar(0.12);

  return {
    group,
    footprint: { minX: -13.56, maxX: 3.44, halfWidth: 1.3, frontX: 3.45 },
    headlights: [new Vector3(3.45, 0.88, -0.92), new Vector3(3.45, 0.88, 0.92)],
    setDistance: wheels.setDistance,
    setHeadlights(value) {
      materials.head.color.copy(headDim).lerp(PALETTE.ice, value);
    },
    setStrip(value) {
      materials.lime.color.copy(PALETTE.lime).multiplyScalar(value);
    },
  };
}
