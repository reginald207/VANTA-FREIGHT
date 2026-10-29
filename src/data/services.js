// VANTA FREIGHT services. The company is fictional: these pages describe how
// a carrier like it could work. They are not offers, and every hub named is
// on the fictional network (src/data/network.js).

export const SERVICES = [
  {
    slug: 'linehaul',
    index: '01',
    name: 'Linehaul',
    tagline: 'Full trailers, planned end to end.',
    summary:
      'Full-truckload runs between hubs on the VANTA network. One trailer, one shipper and one plan, from the dock door to the destination.',
    route: ['northgate', 'kestrel'],
    facts: [
      ['Vehicle', 'VF-01 tractor-trailer'],
      ['Cargo box', '13.6 m trailer'],
      ['Handling', 'Loaded once, unloaded once'],
    ],
    included: [
      'A dedicated trailer for the whole run',
      'Dock appointments booked at both ends',
      'One dispatcher from pickup to proof of delivery',
      'Simulated tracking for every leg',
    ],
    steps: [
      ['Plan', 'Dispatch matches the load to a lane and books both docks.'],
      ['Load', 'The trailer is loaded and sealed at the origin hub.'],
      ['Run', 'The truck runs the lane direct, with planned rest stops.'],
      ['Deliver', 'The trailer is unloaded and the run is closed out.'],
    ],
    fit: [
      'Steady volumes between the same two hubs',
      'Full or near-full trailers',
      'Freight that should not be handled mid-route',
    ],
  },
  {
    slug: 'expedited',
    index: '02',
    name: 'Expedited',
    tagline: 'When the clock is the cargo.',
    summary:
      'Time-critical runs with two drivers sharing the wheel, so the truck keeps moving while one of them rests.',
    route: ['ironvale', 'halden', 'merrow'],
    facts: [
      ['Vehicle', 'VF-02 rigid or VF-01 tractor-trailer'],
      ['Crew', 'Two drivers'],
      ['Handling', 'No stops for other freight'],
    ],
    included: [
      'Team drivers on every expedited run',
      'Direct routing with no pickups for other shippers',
      'Priority dock slots at both hubs',
      'Simulated tracking with an updated arrival estimate',
    ],
    steps: [
      ['Book', 'Tell dispatch what is moving and when it has to arrive.'],
      ['Dispatch', 'A team is assigned and rolls as soon as the freight is ready.'],
      ['Run', 'Drivers swap at the wheel, so the truck only stops for fuel.'],
      ['Hand over', 'The freight is handed over at the dock and signed for.'],
    ],
    fit: [
      'Parts that keep a production line running',
      'Launch and event freight with a fixed date',
      'Anything where arriving late costs more than the run',
    ],
  },
  {
    slug: 'temperature-controlled',
    index: '03',
    name: 'Temperature-controlled',
    tagline: 'A set point, held from dock to dock.',
    summary:
      'Reefer trailers that hold a chosen temperature for the whole run, for food, medicines and anything else that spoils.',
    route: ['sable', 'cobalt', 'wren'],
    facts: [
      ['Vehicle', 'VF-01 with a reefer trailer'],
      ['Range', 'Chilled or frozen'],
      ['Record', 'A temperature log for every run'],
    ],
    included: [
      'The trailer is pre-cooled before loading',
      'The set point is agreed when you book',
      'A temperature log for the whole run (simulated in this demo)',
      'Short waits at every hub',
    ],
    steps: [
      ['Pre-cool', 'The trailer reaches the set point before the doors open.'],
      ['Load', 'Loading is quick, to keep warm air out.'],
      ['Monitor', 'The temperature is logged for the whole run.'],
      ['Deliver', 'The load is handed over together with its log.'],
    ],
    fit: ['Chilled and frozen food', 'Medicines and lab supplies', 'Flowers and plants'],
  },
  {
    slug: 'project-cargo',
    index: '04',
    name: 'Project cargo',
    tagline: 'Big, heavy and one of a kind.',
    summary:
      'Oversized and heavy pieces that need a route survey and a plan, and sometimes an escort, before they move.',
    route: ['ashby', 'northgate', 'kestrel'],
    facts: [
      ['Vehicle', 'Chosen per piece'],
      ['Planning', 'Route survey before booking'],
      ['Handling', 'A securing plan for every piece'],
    ],
    included: [
      'A route survey before anything is booked',
      'A load-securing plan for each piece',
      'Escort and permit planning',
      'One contact for the whole project',
    ],
    steps: [
      ['Survey', 'The route is checked for height, width and weight limits.'],
      ['Engineer', 'Each piece gets a lifting and securing plan.'],
      ['Move', 'The run happens in the planned window, with escorts if needed.'],
      ['Close out', 'The piece is set down and the project is signed off.'],
    ],
    fit: ['Industrial machinery', 'Energy and infrastructure parts', 'Exhibition and stage builds'],
  },
];

export function serviceBySlug(slug) {
  const service = SERVICES.find((candidate) => candidate.slug === slug);
  if (!service) throw new Error(`Unknown service: ${slug}`);
  return service;
}
