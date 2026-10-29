// Ambient yard traffic: Kenney Car Kit vehicles (CC0, assets-src/kenney-car-kit)
// parked around the night yard, recoloured to the brand palette by
// scripts/prepare-kenney.mjs. Background only: they never move, and the film
// runs without them if they fail to load.
import { Group } from 'three';
import { createContactShadow, createShadowTexture } from './fleet.js';
import { createTruck } from './truck/truck-source.js';

// Real-world lengths (m) and parking spots (x, z, heading in radians). The
// row sits just behind the fleet's tractor lane (z ≈ -15, edges to -16.5) and
// clear of the cargo clusters, so it reads as a backdrop through the fog.
export const PARKED = [
  { model: 'delivery', length: 7.2, x: 8, z: -20, heading: 0.5 },
  { model: 'truck-flat', length: 6.2, x: -2, z: -21.5, heading: 0.35 },
  { model: 'van', length: 5.1, x: -10, z: -19.5, heading: -0.25 },
  { model: 'delivery-flat', length: 7.2, x: -19, z: -22, heading: 0.15 },
  { model: 'delivery', length: 7.2, x: -29, z: -20, heading: -0.4 },
  { model: 'van', length: 5.1, x: 17, z: -23, heading: 0.9 },
];

export async function createYardTraffic() {
  const group = new Group();
  group.name = 'yard-traffic';
  const shadowTexture = createShadowTexture();

  const vehicles = await Promise.all(
    PARKED.map(({ model, length }) =>
      createTruck({
        type: 'gltf',
        url: `/models/kenney/${model}.glb`,
        mapping: { forward: '+z', length, materials: { '*': 'keep' } },
      }),
    ),
  );

  vehicles.forEach((truck, index) => {
    const { x, z, heading } = PARKED[index];
    const spot = new Group();
    spot.add(truck.group, createContactShadow(shadowTexture, truck.footprint.minX, truck.footprint.maxX));
    // Centre each vehicle on its spot before turning it.
    truck.group.position.x = -(truck.footprint.minX + truck.footprint.maxX) / 2;
    spot.children[1].position.x = 0;
    spot.position.set(x, 0, z);
    spot.rotation.y = heading;
    group.add(spot);
  });

  return {
    group,
    count: vehicles.length,
    setVisible(visible) {
      group.visible = visible;
    },
  };
}
