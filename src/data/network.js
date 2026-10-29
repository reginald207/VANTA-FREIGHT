// The illustrative VANTA FREIGHT network. Every hub is fictional and placed on
// an abstract map (metres in scene space: x east, z south). It is not real
// geography and implies no real operations.

export const HUBS = [
  { id: 'northgate', name: 'Northgate Hub', x: -46, z: 0 },
  { id: 'kestrel', name: 'Port Kestrel', x: 52, z: 0 },
  { id: 'ironvale', name: 'Ironvale', x: -24, z: -30 },
  { id: 'halden', name: 'Halden Cross', x: 14, z: -26 },
  { id: 'merrow', name: 'Merrow Basin', x: 40, z: -34 },
  { id: 'ashby', name: 'Ashby Reach', x: -58, z: -26 },
  { id: 'cobalt', name: 'Cobalt Junction', x: 6, z: 22 },
  { id: 'sable', name: 'Sable Point', x: -30, z: 30 },
  { id: 'wren', name: 'Wren Harbour', x: 34, z: 30 },
  { id: 'tolland', name: 'Tolland Gate', x: 60, z: 22 },
  { id: 'greyford', name: 'Greyford', x: -12, z: 44 },
  { id: 'lumen', name: 'Lumen Yard', x: 24, z: -48 },
];

// Lanes between hubs. `core` lanes are kept on small screens (fewer routes).
// The first lane runs straight through the hero truck at the origin.
export const LANES = [
  { from: 'northgate', to: 'kestrel', core: true },
  { from: 'northgate', to: 'ironvale', core: true },
  { from: 'northgate', to: 'sable', core: true },
  { from: 'northgate', to: 'ashby', core: false },
  { from: 'ashby', to: 'ironvale', core: false },
  { from: 'ironvale', to: 'halden', core: true },
  { from: 'halden', to: 'merrow', core: true },
  { from: 'halden', to: 'lumen', core: false },
  { from: 'merrow', to: 'lumen', core: false },
  { from: 'merrow', to: 'kestrel', core: true },
  { from: 'kestrel', to: 'tolland', core: false },
  { from: 'kestrel', to: 'wren', core: true },
  { from: 'wren', to: 'tolland', core: false },
  { from: 'wren', to: 'cobalt', core: true },
  { from: 'cobalt', to: 'greyford', core: false },
  { from: 'cobalt', to: 'halden', core: true },
  { from: 'sable', to: 'greyford', core: true },
  { from: 'sable', to: 'cobalt', core: false },
];

export function hubById(id) {
  const hub = HUBS.find((candidate) => candidate.id === id);
  if (!hub) throw new Error(`Unknown hub: ${id}`);
  return hub;
}

// A lane's gentle bend: the control point is offset sideways from the midpoint
// so routes read as roads rather than straight rulers. Straight when `bend` is 0.
export function laneControlPoint(lane, index) {
  const a = hubById(lane.from);
  const b = hubById(lane.to);
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  if (index === 0) return { x: mx, z: mz };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const bend = (index % 2 === 0 ? 1 : -1) * Math.min(6, length * 0.12);
  return { x: mx + (-dz / length) * bend, z: mz + (dx / length) * bend };
}
