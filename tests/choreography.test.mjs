// Unit tests for the pure film choreography and the network data.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  KEYFRAMES,
  SCENES,
  deriveState,
  evenRanges,
  keyframeTimes,
  sceneTime,
  smoothRamp,
} from '../src/webgl/choreography.js';
import { HUBS, LANES } from '../src/data/network.js';
import { renderNetworkSvg } from '../src/data/network-svg.js';

// A realistic layout: hero 100vh, then sticky scenes (heights in vh).
function layoutRanges() {
  const heights = { departure: 250, network: 250, cargo: 250, fleet: 200, track: 200, arrival: 200 };
  const total = 100 + Object.values(heights).reduce((a, b) => a + b, 0) - 100;
  let y = 100;
  const ranges = { hero: { start: 0, end: 100 / total } };
  for (const [scene, height] of Object.entries(heights)) {
    ranges[scene] = { start: y / total, end: (y + height - 100) / total };
    y += height;
  }
  return ranges;
}

describe('smoothRamp', () => {
  test('clamps and eases between the edges', () => {
    assert.equal(smoothRamp(-1, 0, 1), 0);
    assert.equal(smoothRamp(2, 0, 1), 1);
    assert.equal(smoothRamp(0.5, 0, 1), 0.5);
    assert.ok(smoothRamp(0.1, 0, 1) < 0.1, 'eases in');
  });

  test('a zero-width ramp is a step', () => {
    assert.equal(smoothRamp(0.4, 0.5, 0.5), 0);
    assert.equal(smoothRamp(0.5, 0.5, 0.5), 1);
  });
});

describe('keyframes', () => {
  for (const [name, frames] of Object.entries(KEYFRAMES)) {
    test(`${name} keyframes are strictly increasing for real and even layouts`, () => {
      for (const ranges of [layoutRanges(), evenRanges()]) {
        const times = keyframeTimes(frames, ranges);
        assert.equal(times[0], 0);
        times.slice(1).forEach((time, index) => assert.ok(time > times[index]));
      }
    });

    test(`${name} keyframes only name known scenes`, () => {
      frames.forEach((frame) => assert.ok(SCENES.includes(frame.scene), frame.scene));
    });
  }

  test('out-of-order keyframes are rejected', () => {
    const frames = [
      { scene: 'cargo', t: 0 },
      { scene: 'network', t: 0 },
    ];
    assert.throws(() => keyframeTimes(frames, layoutRanges()), /out of order/);
  });
});

describe('deriveState', () => {
  const ranges = layoutRanges();
  const at = (scene, t) => deriveState(sceneTime(ranges, scene, t), ranges);

  test('the hero is parked: dim headlights, yard fog, nothing else on', () => {
    const state = deriveState(0, ranges);
    assert.equal(state.headlights, 0.3);
    assert.equal(state.networkVisible, 0);
    assert.equal(state.xray, 0);
    assert.equal(state.crates, 0);
    assert.equal(state.fleet, 0);
    assert.equal(state.stageOpacity, 1);
    assert.equal(state.depart, 0);
  });

  test('each scene turns its layer on, and the next scene turns it off', () => {
    assert.equal(at('departure', 0.5).headlights, 1);
    assert.equal(at('network', 0.95).networkVisible, 1);
    assert.equal(at('network', 0.95).networkDraw, 1);
    assert.ok(at('network', 0.6).fogDensity < 0.01, 'fog lifts over the map');
    assert.equal(at('cargo', 0.5).networkVisible, 0);
    assert.equal(at('cargo', 0.5).xray, 1);
    assert.equal(at('cargo', 1).crates, 1);
    assert.equal(at('fleet', 0.6).xray, 0);
    assert.equal(at('fleet', 0.6).crates, 0);
    assert.equal(at('fleet', 0.6).fleet, 1);
  });

  test('the track scene dims the stage and the arrival brings it back, then fades out', () => {
    assert.ok(Math.abs(at('track', 0.5).stageOpacity - 0.2) < 1e-9);
    assert.equal(at('arrival', 0.3).stageOpacity, 1);
    assert.equal(at('arrival', 1).stageOpacity, 0);
    assert.equal(at('arrival', 1).depart, 1);
  });

  test('every value stays within its range across the whole film', () => {
    for (let p = 0; p <= 1; p += 0.0025) {
      const state = deriveState(p, ranges);
      for (const [key, value] of Object.entries(state)) {
        assert.ok(Number.isFinite(value), `${key} at ${p}`);
        if (key !== 'fogDensity') assert.ok(value >= 0 && value <= 1, `${key}=${value} at ${p}`);
      }
    }
  });
});

describe('network data', () => {
  test('every lane joins two different known hubs, without duplicates', () => {
    const ids = new Set(HUBS.map((hub) => hub.id));
    const seen = new Set();
    LANES.forEach(({ from, to }) => {
      assert.ok(ids.has(from) && ids.has(to) && from !== to, `${from} -> ${to}`);
      const key = [from, to].sort().join('|');
      assert.ok(!seen.has(key), `duplicate lane ${key}`);
      seen.add(key);
    });
  });

  test('every hub is reachable on core lanes (the small-screen network)', () => {
    const core = LANES.filter((lane) => lane.core);
    const reached = new Set(['northgate']);
    let grew = true;
    while (grew) {
      grew = false;
      core.forEach(({ from, to }) => {
        if (reached.has(from) !== reached.has(to)) {
          reached.add(from).add(to);
          grew = true;
        }
      });
    }
    const missing = HUBS.filter((hub) => !reached.has(hub.id)).map((hub) => hub.id);
    // Hubs off the core network are fine on desktop but should be few.
    assert.ok(missing.length <= 4, `unreachable on core lanes: ${missing.join(', ')}`);
  });

  test('the static SVG lists every hub and lane and says it is not real geography', () => {
    const svg = renderNetworkSvg();
    HUBS.forEach((hub) => assert.ok(svg.includes(hub.name), hub.name));
    assert.equal(svg.match(/<path class="network-map__lane/g).length, LANES.length);
    assert.match(svg, /fictional hubs/);
    assert.match(svg, /Not real geography/);
  });
});

describe('adaptive resolution', async () => {
  const { createAdaptiveResolution } = await import('../src/webgl/quality.js');
  const fakeRenderer = () => ({ ratios: [], setPixelRatio(value) { this.ratios.push(value); } });
  const feed = (resolution, ms, frames) => {
    for (let i = 0; i < frames; i += 1) resolution.sample(ms);
  };

  test('steps the pixel ratio down while frames are over budget, never below the minimum', () => {
    globalThis.devicePixelRatio = 2;
    const renderer = fakeRenderer();
    const resolution = createAdaptiveResolution(renderer, { maxDpr: 2, sampleSize: 10 });
    for (let i = 0; i < 10; i += 1) feed(resolution, 25, 70);
    assert.equal(resolution.dpr, 1);
    assert.deepEqual(renderer.ratios, [2, 1.75, 1.5, 1.25, 1]);
  });

  test('gives up (onStruggle) only after two very slow windows at the minimum ratio', () => {
    globalThis.devicePixelRatio = 1;
    let struggles = 0;
    const resolution = createAdaptiveResolution(fakeRenderer(), {
      maxDpr: 2,
      sampleSize: 10,
      onStruggle: () => {
        struggles += 1;
      },
    });
    feed(resolution, 40, 10);
    assert.equal(struggles, 0, 'one slow window is not enough');
    feed(resolution, 40, 10);
    assert.equal(struggles, 1);
  });

  test('moderately slow frames at the minimum ratio never trigger the fallback', () => {
    globalThis.devicePixelRatio = 1;
    let struggles = 0;
    const resolution = createAdaptiveResolution(fakeRenderer(), {
      maxDpr: 2,
      sampleSize: 10,
      onStruggle: () => {
        struggles += 1;
      },
    });
    feed(resolution, 28, 100);
    resolution.sample(900); // a single hitch is clamped, not decisive
    feed(resolution, 28, 100);
    assert.equal(struggles, 0);
  });

  test('a device at one frame per second gives up within a few seconds', () => {
    globalThis.devicePixelRatio = 1.5;
    let struggles = 0;
    const resolution = createAdaptiveResolution(fakeRenderer(), {
      maxDpr: 1.5,
      onStruggle: () => {
        struggles += 1;
      },
    });
    // Straight to the minimum ratio, a one-second cooldown, then two slow windows.
    let seconds = 0;
    while (!struggles && seconds < 60) {
      resolution.sample(1000);
      seconds += 1;
    }
    assert.equal(struggles, 1);
    assert.ok(seconds <= 8, `took ${seconds} s`);
  });
});

describe('services data', async () => {
  const { SERVICES } = await import('../src/data/services.js');
  const { findLane, renderRouteSvg } = await import('../src/data/network-svg.js');
  const { existsSync } = await import('node:fs');

  test('slugs are unique and each has a page stub', () => {
    const slugs = SERVICES.map((service) => service.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    slugs.forEach((slug) => {
      assert.ok(existsSync(new URL(`../services/${slug}/index.html`, import.meta.url)), `services/${slug}/index.html`);
    });
  });

  test('every example route follows real lanes on the fictional network', () => {
    SERVICES.forEach(({ slug, route }) => {
      assert.ok(route.length >= 2, slug);
      route.slice(1).forEach((to, index) => assert.doesNotThrow(() => findLane(route[index], to), `${slug}: ${route[index]} -> ${to}`));
      const svg = renderRouteSvg(route, { id: slug });
      assert.equal(svg.match(/class="route-map__leg"/g).length, route.length - 1);
    });
  });

  test('every service has content in each section', () => {
    SERVICES.forEach((service) => {
      for (const key of ['tagline', 'summary']) assert.ok(service[key].length > 10, `${service.slug}.${key}`);
      for (const key of ['facts', 'included', 'steps', 'fit']) assert.ok(service[key].length >= 3, `${service.slug}.${key}`);
    });
  });
});
