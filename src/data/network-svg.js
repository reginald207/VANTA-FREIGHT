// Static SVG of the illustrative network, rendered into the home page at build
// time. It is what Tier 0/1 and reduced-motion visitors see instead of the 3D
// network, and it shares its data with the 3D scene.
import { HUBS, LANES, hubById, laneControlPoint } from './network.js';

const PAD = 14;
// Extra room on the right for the longest hub label.
const LABEL_ROOM = 26;

export function renderNetworkSvg() {
  const xs = HUBS.map((hub) => hub.x);
  const zs = HUBS.map((hub) => hub.z);
  const minX = Math.min(...xs) - PAD;
  const minZ = Math.min(...zs) - PAD;
  const width = Math.max(...xs) - minX + PAD + LABEL_ROOM;
  const height = Math.max(...zs) - minZ + PAD;
  const names = HUBS.map((hub) => hub.name).join(', ');

  const lanes = LANES.map((lane, index) => {
    const a = hubById(lane.from);
    const b = hubById(lane.to);
    const c = laneControlPoint(lane, index);
    const core = lane.core ? '' : ' network-map__lane--minor';
    return `<path class="network-map__lane${core}" pathLength="1" d="M${a.x} ${a.z} Q${c.x.toFixed(2)} ${c.z.toFixed(2)} ${b.x} ${b.z}"/>`;
  }).join('');

  const hubs = HUBS.map(
    (hub) =>
      `<g class="network-map__hub" transform="translate(${hub.x} ${hub.z})"><circle r="1.6"/><text x="2.8" y="-2.4">${hub.name}</text></g>`,
  ).join('');

  return `<svg class="network-map" viewBox="${minX} ${minZ} ${width} ${height}" role="img" aria-labelledby="network-map-title network-map-desc">
<title id="network-map-title">Illustrative network map</title>
<desc id="network-map-desc">An abstract map of ${HUBS.length} fictional hubs connected by ${LANES.length} lanes: ${names}. Not real geography.</desc>
<g class="network-map__lanes">${lanes}</g>
<g class="network-map__truck" transform="translate(0 0)"><circle r="2.6"/></g>
<g class="network-map__hubs">${hubs}</g>
</svg>`;
}
