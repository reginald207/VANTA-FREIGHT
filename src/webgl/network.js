// Scene 3: the illustrative network, drawn on the yard floor around the truck.
// Lanes reveal outward from Northgate Hub (where the truck's lane starts) in
// breadth-first order; hubs light up and pulse as lanes reach them.
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Mesh,
  QuadraticBezierCurve3,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
  Group,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUBS, LANES, hubById, laneControlPoint } from '../data/network.js';
import { smoothRamp } from './choreography.js';
import { PALETTE } from './palette.js';

const LANE_DURATION = 0.32;
const LANE_Y = 0.06;

// Breadth-first depth of every hub from the origin hub.
function hubDepths(origin) {
  const depth = { [origin]: 0 };
  const queue = [origin];
  while (queue.length) {
    const id = queue.shift();
    LANES.forEach(({ from, to }) => {
      const next = from === id ? to : to === id ? from : null;
      if (next && depth[next] === undefined) {
        depth[next] = depth[id] + 1;
        queue.push(next);
      }
    });
  }
  return depth;
}

function planLanes(lanes) {
  const depth = hubDepths('northgate');
  const maxDepth = Math.max(...Object.values(depth));
  return lanes.map((lane, index) => {
    // Draw each lane away from the origin.
    const forward = depth[lane.from] <= depth[lane.to];
    const near = forward ? lane.from : lane.to;
    const far = forward ? lane.to : lane.from;
    const delay = (depth[near] / Math.max(1, maxDepth)) * (1 - LANE_DURATION);
    return { lane, index, near, far, delay };
  });
}

const laneVertex = /* glsl */ `
  attribute float aDelay;
  attribute float aLength;
  uniform float uDraw;
  varying float vAlong;
  varying float vLocal;
  varying float vLength;
  void main() {
    vAlong = uv.x;
    vLocal = clamp((uDraw - aDelay) / ${LANE_DURATION.toFixed(2)}, 0.0, 1.0);
    vLength = aLength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const laneFragment = /* glsl */ `
  uniform float uTime;
  uniform float uVisible;
  uniform vec3 uColor;
  varying float vAlong;
  varying float vLocal;
  varying float vLength;
  void main() {
    if (vAlong > vLocal || vLocal <= 0.0) discard;
    float head = smoothstep(vLocal - 0.08, vLocal, vAlong) * (1.0 - step(0.999, vLocal));
    float dash = step(0.55, fract(vAlong * vLength / 4.0 - uTime * 0.5));
    float alpha = (0.32 + 0.3 * dash + head * 1.4) * uVisible;
    gl_FragColor = vec4(uColor * alpha, 1.0);
    #include <colorspace_fragment>
  }
`;

function createLanes(plan) {
  const geometries = plan.map(({ lane, index, near, far, delay }) => {
    const a = hubById(near);
    const b = hubById(far);
    const c = laneControlPoint(lane, index);
    const curve = new QuadraticBezierCurve3(
      new Vector3(a.x, LANE_Y, a.z),
      new Vector3(c.x, LANE_Y, c.z),
      new Vector3(b.x, LANE_Y, b.z),
    );
    const geometry = new TubeGeometry(curve, 64, 0.3, 6, false);
    const count = geometry.attributes.position.count;
    geometry.setAttribute('aDelay', new BufferAttribute(new Float32Array(count).fill(delay), 1));
    geometry.setAttribute('aLength', new BufferAttribute(new Float32Array(count).fill(curve.getLength()), 1));
    return geometry;
  });

  const material = new ShaderMaterial({
    vertexShader: laneVertex,
    fragmentShader: laneFragment,
    uniforms: {
      uDraw: { value: 0 },
      uTime: { value: 0 },
      uVisible: { value: 0 },
      uColor: { value: PALETTE.lime },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

  const mesh = new Mesh(mergeGeometries(geometries), material);
  mesh.name = 'network-lanes';
  mesh.renderOrder = 2;
  return { mesh, material };
}

// When does each hub light up? The origin at once; others when a lane arrives.
function hubActivations(plan) {
  const activation = Object.fromEntries(HUBS.map((hub) => [hub.id, Infinity]));
  activation.northgate = 0;
  plan.forEach(({ far, delay }) => {
    activation[far] = Math.min(activation[far], delay + LANE_DURATION);
  });
  return HUBS.map((hub) => (Number.isFinite(activation[hub.id]) ? activation[hub.id] : 1));
}

export function createNetwork({ labelsParent, compact = false } = {}) {
  const lanes = compact ? LANES.filter((lane) => lane.core) : LANES;
  const plan = planLanes(lanes);
  const activations = hubActivations(plan);
  const group = new Group();
  group.name = 'network';

  const lanesLayer = createLanes(plan);
  group.add(lanesLayer.mesh);

  // Hub discs plus one pulse ring per hub; the extra ring marks the truck.
  const discGeometry = new CylinderGeometry(1.1, 1.1, 0.12, 32);
  const discs = new InstancedMesh(
    discGeometry,
    new MeshBasicMaterial({ color: PALETTE.lime, toneMapped: false }),
    HUBS.length,
  );
  const ringGeometry = new RingGeometry(1.5, 1.85, 48);
  ringGeometry.rotateX(-Math.PI / 2);
  const rings = new InstancedMesh(
    ringGeometry,
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
    HUBS.length + 1,
  );
  discs.frustumCulled = false;
  rings.frustumCulled = false;
  // Allocate instance colours now so the shader is compiled with them.
  for (let i = 0; i <= HUBS.length; i += 1) rings.setColorAt(i, new Color(0, 0, 0));
  group.add(discs, rings);

  // Screen-space hub labels (decorative; the HTML holds the real content).
  const labels = document.createElement('div');
  labels.className = 'network-labels';
  labels.setAttribute('aria-hidden', 'true');
  const labelEls = HUBS.map((hub) => {
    const el = document.createElement('span');
    el.className = 'network-labels__hub';
    el.textContent = hub.name;
    labels.append(el);
    return el;
  });
  labelsParent?.append(labels);

  const matrix = new Matrix4();
  const identity = new Quaternion();
  const scale = new Vector3();
  const position = new Vector3();
  const color = new Color();
  const projected = new Vector3();
  let visible = 0;
  let draw = 0;

  function setState(nextVisible, nextDraw) {
    visible = nextVisible;
    draw = nextDraw;
    lanesLayer.material.uniforms.uVisible.value = visible;
    lanesLayer.material.uniforms.uDraw.value = draw;
    group.visible = visible > 0.001;
  }

  function update(time, camera, width, height) {
    if (!group.visible) {
      if (labels.style.opacity !== '0') labels.style.opacity = '0';
      return;
    }
    lanesLayer.material.uniforms.uTime.value = time;

    HUBS.forEach((hub, index) => {
      const lit = smoothRamp(draw, activations[index] - 0.04, activations[index]);
      position.set(hub.x, 0.06, hub.z);
      scale.setScalar(Math.max(lit * visible, 1e-4));
      discs.setMatrixAt(index, matrix.compose(position, identity, scale));

      const phase = (time * 0.45 + index * 0.137) % 1;
      scale.setScalar(1 + phase * 2.4);
      rings.setMatrixAt(index, matrix.compose(position, identity, scale));
      rings.setColorAt(index, color.copy(PALETTE.lime).multiplyScalar((1 - phase) * lit * visible * 0.9));

      // Labels follow their hubs on screen.
      projected.set(hub.x, 0.06, hub.z).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const el = labelEls[index];
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(lit);
    });

    // Fast pulse on the truck itself, at the origin.
    const truckPhase = (time * 0.9) % 1;
    position.set(0, 0.06, 0);
    scale.setScalar(1.6 + truckPhase * 3);
    rings.setMatrixAt(HUBS.length, matrix.compose(position, identity, scale));
    rings.setColorAt(HUBS.length, color.copy(PALETTE.ice).multiplyScalar((1 - truckPhase) * visible));

    discs.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    rings.instanceColor.needsUpdate = true;
    labels.style.opacity = visible.toFixed(3);
  }

  setState(0, 0);
  return {
    group,
    lanes: lanes.length,
    setState,
    update,
    dispose() {
      labels.remove();
    },
  };
}
