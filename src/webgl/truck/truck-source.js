// The hero truck behind one interface, so a licensed glTF model can replace the
// procedural one later (milestone M5) without touching the choreography.

/**
 * @typedef {object} Truck
 * @property {import('three').Group} group      Root object; faces +X, stands on y = 0.
 * @property {{minX: number, maxX: number, halfWidth: number, frontX: number}} footprint
 *           Ground footprint in metres, used for the contact shadow and light pools.
 * @property {import('three').Vector3[]} headlights  Headlight positions (truck space).
 * @property {(distance: number) => void} setDistance  Rolls the wheels to a travelled distance.
 * @property {(value: number) => void} setHeadlights   0 = parked, 1 = full beam.
 * @property {(value: number) => void} setStrip        Lime light-strip intensity, 0 to 1.
 */

/**
 * @param {{type: 'procedural'}} [source]
 * @returns {Promise<Truck>}
 */
export async function createTruck(source = { type: 'procedural' }) {
  switch (source.type) {
    case 'procedural': {
      const { createProceduralTruck } = await import('./procedural-truck.js');
      return createProceduralTruck();
    }
    default:
      throw new Error(`Unknown truck source: ${source.type}`);
  }
}
