// Scene 5: the fleet line-up. The rigid box truck and the tractor unit drive up
// out of the fog into the lanes beside the hero truck and park nose-to-nose.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createTruck } from './truck/truck-source.js';

const LANES = [
  { variant: 'rigid', z: -7.6 },
  { variant: 'tractor', z: -15.2 },
];
const RUN_IN = 80;

// A soft rounded-rectangle shadow, drawn once on a canvas.
export function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(24, 18, 208, 28);
  return new CanvasTexture(canvas);
}

export function createContactShadow(texture, minX, maxX) {
  const length = maxX - minX + 1.6;
  const mesh = new Mesh(
    new PlaneGeometry(length, 4.2),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, 0.015, 0);
  mesh.renderOrder = 1;
  return mesh;
}

export async function createFleet() {
  const group = new Group();
  group.name = 'fleet';
  const shadowTexture = createShadowTexture();

  const vehicles = await Promise.all(
    LANES.map(async ({ variant, z }) => {
      const truck = await createTruck({ type: 'procedural', variant });
      const rig = new Group();
      rig.add(truck.group, createContactShadow(shadowTexture, truck.footprint.minX, truck.footprint.maxX));
      rig.position.z = z;
      truck.setHeadlights(0.7);
      truck.setStrip(1);
      group.add(rig);
      return { truck, rig };
    }),
  );

  function setProgress(value) {
    group.visible = value > 0.001;
    // Decelerate into position: the offset shrinks as value approaches 1.
    const offset = -RUN_IN * (1 - value) ** 2;
    vehicles.forEach(({ truck, rig }, index) => {
      rig.position.x = offset * (1 + index * 0.25);
      truck.setDistance(rig.position.x);
    });
  }

  setProgress(0);
  return { group, setProgress };
}
