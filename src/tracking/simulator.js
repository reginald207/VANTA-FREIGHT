// Simulated shipment tracking. Pure and deterministic: the same ID always
// gives the same result, nothing depends on the real clock, and nothing ever
// leaves the browser. Every hub and lane is on the fictional network.
//
// Times use a story clock ("Day 1 · 06:10"), not real dates, so a result can
// never be mistaken for a real shipment's history.
import { HUBS, LANES, hubById } from '../data/network.js';
import { SERVICES } from '../data/services.js';

export const DEMO_IDS = ['VF-DEMO-0001', 'VF-DEMO-0002', 'VF-DEMO-0003'];

// VF- followed by one to three groups of 2-8 letters or digits.
const ID_PATTERN = /^VF-[A-Z0-9]{2,8}(?:-[A-Z0-9]{2,8}){0,2}$/;

// Minutes of driving per metre of map distance, and stop times.
const MINUTES_PER_METRE = 3;
const DWELL_MINUTES = 25;
const LOAD_MINUTES = 30;
const BOOK_MINUTES = 45;

// Fixed demo shipments, so the IDs offered on the site tell three stories:
// one in transit (matches the home page preview), one delivered, one at a hub.
const FIXTURES = {
  'VF-DEMO-0001': { route: ['northgate', 'kestrel'], service: 'linehaul', vehicle: 'VF-01', departAt: 370, progress: 0.62 },
  'VF-DEMO-0002': { route: ['ironvale', 'halden', 'merrow'], service: 'expedited', vehicle: 'VF-02', departAt: 290, progress: 1 },
  'VF-DEMO-0003': { route: ['sable', 'cobalt', 'wren'], service: 'temperature-controlled', vehicle: 'VF-01', departAt: 410, progress: 0.53 },
};

export function normaliseId(input) {
  return String(input ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidId(input) {
  return ID_PATTERN.test(normaliseId(input));
}

// FNV-1a hash and mulberry32: a small, well-mixed, seeded generator.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shortest route by lane count, following real lanes on the network.
export function findRoute(from, to) {
  const previous = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) break;
    LANES.forEach((lane) => {
      const next = lane.from === id ? lane.to : lane.to === id ? lane.from : null;
      if (next && !(next in previous)) {
        previous[next] = id;
        queue.push(next);
      }
    });
  }
  const route = [];
  for (let id = to; id; id = previous[id]) route.unshift(id);
  return route[0] === from ? route : null;
}

function generate(id) {
  const random = seeded(hash(id));
  const pick = (list) => list[Math.floor(random() * list.length)];
  const origin = pick(HUBS).id;
  let destination = pick(HUBS).id;
  while (destination === origin) destination = pick(HUBS).id;
  const service = pick(SERVICES).slug;
  return {
    route: findRoute(origin, destination),
    service,
    vehicle: service === 'project-cargo' ? 'VF-03' : pick(['VF-01', 'VF-01', 'VF-02']),
    departAt: 300 + Math.floor(random() * 48) * 5, // 05:00 to 08:55
    // A third of generated shipments have already arrived.
    progress: random() < 0.33 ? 1 : 0.05 + random() * 0.9,
  };
}

export function formatClock(minutes) {
  const day = Math.floor(minutes / 1440) + 1;
  const time = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(time / 60)).padStart(2, '0');
  const mm = String(Math.round(time % 60)).padStart(2, '0');
  return `Day ${day} · ${hh}:${mm}`;
}

const legMinutes = (from, to) => {
  const a = hubById(from);
  const b = hubById(to);
  return Math.round(Math.hypot(b.x - a.x, b.z - a.z) * MINUTES_PER_METRE);
};

/**
 * Simulates the shipment with the given ID.
 * @returns {{ok: true, shipment: object} | {ok: false, error: string}}
 */
export function simulate(input) {
  const id = normaliseId(input);
  if (!ID_PATTERN.test(id)) {
    return {
      ok: false,
      error: 'Enter an ID that starts with VF-, followed by letters and numbers, for example VF-DEMO-0001.',
    };
  }

  const plan = FIXTURES[id] ?? generate(id);
  const { route, departAt, progress } = plan;
  const names = route.map((hubId) => hubById(hubId).name);

  // The run as a sequence of segments: drive each leg, dwell at each stop.
  const segments = [];
  route.slice(1).forEach((to, index) => {
    segments.push({ type: 'leg', leg: index, minutes: legMinutes(route[index], to) });
    if (index < route.length - 2) segments.push({ type: 'dwell', hub: index + 1, minutes: DWELL_MINUTES });
  });
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const now = departAt + total * progress;

  const events = [
    { at: departAt - LOAD_MINUTES - BOOK_MINUTES, label: `Booked for ${names.at(-1)}`, hub: route[0] },
    { at: departAt - LOAD_MINUTES, label: `Loaded at ${names[0]}`, hub: route[0] },
    { at: departAt, label: `Departed ${names[0]}`, hub: route[0] },
  ];

  let clock = departAt;
  let status = 'delivered';
  let position = { leg: route.length - 2, t: 1 };
  for (const segment of segments) {
    const end = clock + segment.minutes;
    if (segment.type === 'leg') {
      if (now < end) {
        status = 'in-transit';
        position = { leg: segment.leg, t: (now - clock) / segment.minutes };
        events.push({ at: now, label: `In transit towards ${names[segment.leg + 1]}`, hub: null });
        break;
      }
      const arrivedAt = route[segment.leg + 1];
      const final = segment.leg === route.length - 2;
      events.push({ at: end, label: final ? `Delivered at ${names.at(-1)}` : `Arrived at ${names[segment.leg + 1]}`, hub: arrivedAt });
    } else {
      if (now < end) {
        status = 'at-hub';
        position = { leg: segment.hub - 1, t: 1 };
        break;
      }
      events.push({ at: end, label: `Departed ${names[segment.hub]}`, hub: route[segment.hub] });
    }
    clock = end;
  }

  const service = SERVICES.find((entry) => entry.slug === plan.service);
  const labels = {
    'in-transit': `In transit towards ${names[position.leg + 1]}`,
    'at-hub': `At ${names[position.leg + 1]}`,
    delivered: `Delivered at ${names.at(-1)}`,
  };

  return {
    ok: true,
    shipment: {
      id,
      service: service.name,
      serviceSlug: service.slug,
      vehicle: plan.vehicle,
      route,
      routeNames: names,
      status,
      statusLabel: labels[status],
      progress: Math.round(progress * 100) / 100,
      position,
      events: events.map((event) => ({ ...event, time: formatClock(event.at) })),
      eta: status === 'delivered' ? null : formatClock(departAt + total),
      simulated: true,
    },
  };
}
