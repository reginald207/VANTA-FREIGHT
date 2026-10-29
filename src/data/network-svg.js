// Static SVGs of the illustrative network, rendered into pages at build time.
// The home page uses the full map (what Tier 0/1 and reduced-motion visitors
// see instead of the 3D network); service pages use a route map that
// highlights one example run. Both share their data with the 3D scene.
import { HUBS, LANES, hubById, laneControlPoint } from './network.js';

const PAD = 14;
// Extra room on the right for the longest hub label.
const LABEL_ROOM = 26;

function viewBox() {
  const xs = HUBS.map((hub) => hub.x);
  const zs = HUBS.map((hub) => hub.z);
  const minX = Math.min(...xs) - PAD;
  const minZ = Math.min(...zs) - PAD;
  const width = Math.max(...xs) - minX + PAD + LABEL_ROOM;
  const height = Math.max(...zs) - minZ + PAD;
  return `${minX} ${minZ} ${width} ${height}`;
}

function lanePath(lane, index, reverse = false) {
  const a = hubById(reverse ? lane.to : lane.from);
  const b = hubById(reverse ? lane.from : lane.to);
  const c = laneControlPoint(lane, index);
  return `M${a.x} ${a.z} Q${c.x.toFixed(2)} ${c.z.toFixed(2)} ${b.x} ${b.z}`;
}

function hubMarkup(hub, labelled = true) {
  const label = labelled ? `<text x="2.8" y="-2.4">${hub.name}</text>` : '';
  return `<g class="network-map__hub" transform="translate(${hub.x} ${hub.z})"><circle r="1.6"/>${label}</g>`;
}

// The lane joining two hubs (in either direction), with its index.
export function findLane(from, to) {
  const index = LANES.findIndex(
    (lane) => (lane.from === from && lane.to === to) || (lane.from === to && lane.to === from),
  );
  if (index < 0) throw new Error(`No lane between ${from} and ${to}`);
  return { lane: LANES[index], index, reverse: LANES[index].from !== from };
}

export function renderNetworkSvg() {
  const names = HUBS.map((hub) => hub.name).join(', ');
  const lanes = LANES.map((lane, index) => {
    const minor = lane.core ? '' : ' network-map__lane--minor';
    return `<path class="network-map__lane${minor}" pathLength="1" d="${lanePath(lane, index)}"/>`;
  }).join('');

  return `<svg class="network-map" viewBox="${viewBox()}" role="img" aria-labelledby="network-map-title network-map-desc">
<title id="network-map-title">Illustrative network map</title>
<desc id="network-map-desc">An abstract map of ${HUBS.length} fictional hubs connected by ${LANES.length} lanes: ${names}. Not real geography.</desc>
<g class="network-map__lanes">${lanes}</g>
<g class="network-map__truck" transform="translate(0 0)"><circle r="2.6"/></g>
<g class="network-map__hubs">${HUBS.map((hub) => hubMarkup(hub)).join('')}</g>
</svg>`;
}

// A route map: the whole network faint, one run highlighted hub by hub.
export function renderRouteSvg(route, { id = 'route' } = {}) {
  const stops = route.map(hubById);
  const legs = route.slice(1).map((to, i) => findLane(route[i], to));
  const faint = LANES.map((lane, index) => `<path d="${lanePath(lane, index)}"/>`).join('');
  const highlighted = legs
    .map(({ lane, index, reverse }) => `<path class="route-map__leg" pathLength="1" d="${lanePath(lane, index, reverse)}"/>`)
    .join('');
  const onRoute = new Set(route);
  const hubs = HUBS.map((hub) => hubMarkup(hub, onRoute.has(hub.id)).replace(
    'class="network-map__hub"',
    `class="network-map__hub${onRoute.has(hub.id) ? ' route-map__stop' : ' route-map__off'}"`,
  )).join('');
  const description = `Example run on the illustrative network: ${stops.map((hub) => hub.name).join(' to ')}. Fictional hubs, not real geography.`;

  return `<svg class="network-map route-map" viewBox="${viewBox()}" role="img" aria-labelledby="${id}-title ${id}-desc">
<title id="${id}-title">Example route</title>
<desc id="${id}-desc">${description}</desc>
<g class="route-map__faint">${faint}</g>
<g class="route-map__legs">${highlighted}</g>
<g class="network-map__hubs">${hubs}</g>
</svg>`;
}
