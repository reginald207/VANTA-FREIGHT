// Ambient yard traffic: Kenney Car Kit vehicles (CC0, assets-src/kenney-car-kit)
// parked around the night yard, recoloured to the brand palette by
// scripts/prepare-kenney.mjs. Background only: they never move, and the film
// runs without them if they fail to load.
import { Group } from 'three';
import { createContactShadow, createShadowTexture } from './fleet.js';
import { createTruck } from './truck/truck-source.js';

// Real-world lengths (m) and parking spots (x, z, heading in radians), picked
// from what the film's cameras actually see past the hero truck: a row parked
// between the two fleet lanes (z -7.6 and -15.2), one across the road, and a
// deeper rear row for depth. All clear the road (|z| < 4), the cargo clusters
// and the camera paths, and none sits close enough to upstage the fleet.
export const PARKED = [
  { model: 'van', length: 5.1, x: -8, z: -11.4, heading: 0 },
  { model: 'delivery', length: 7.2, x: -24, z: -11.4, heading: 0 },
  { model: 'truck-flat', length: 6.2, x: -2, z: -21, heading: 0.35 },
  { model: 'delivery-flat', length: 7.2, x: 5, z: 14, heading: 0.3 },
  { model: 'delivery', length: 7.2, x: 8, z: -20, heading: 0.5 },
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
