// The home film's choreography as pure functions of film progress p (0-1).
//
// Each scene is a <section> in the .film track; `ranges[scene]` holds where its
// sticky span starts and ends in progress units (measured from the DOM, see
// pages/home.js). Scene-local times t are mapped onto those spans, so negative
// t lands in the transition before a scene and t > 1 in the one after it.
//
// Because every value derives from p alone, scrubbing backwards retraces the
// film exactly and no two tweens ever fight over the same property.
// No three.js imports here: this module is unit-tested in Node.

export const SCENES = ['hero', 'departure', 'network', 'cargo', 'fleet', 'track', 'arrival'];

export const FOG = { yard: 0.03, map: 0.0035 };

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (a, b, t) => a + (b - a) * t;

export function smoothRamp(x, a, b) {
  if (b === a) return x >= b ? 1 : 0;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function sceneTime(ranges, scene, t) {
  const range = ranges[scene];
  return range.start + t * (range.end - range.start);
}

export function deriveState(p, ranges) {
  const r = (scene, t0, t1) => smoothRamp(p, sceneTime(ranges, scene, t0), sceneTime(ranges, scene, t1));
  const mapMix = r('network', 0.05, 0.4) * (1 - r('cargo', -0.3, 0.05));

  return {
    headlights: 0.3 + 0.7 * r('departure', -0.15, 0.25),
    drift: 1 - 0.65 * r('departure', 0, 1),
    fogDensity: lerp(FOG.yard, FOG.map, mapMix),
    map: mapMix,
    networkVisible: r('network', 0.1, 0.3) * (1 - r('cargo', -0.3, 0)),
    networkDraw: r('network', 0.3, 0.9),
    xray: r('cargo', 0.1, 0.35) * (1 - r('fleet', -0.25, 0.05)),
    crates: r('cargo', 0.35, 0.95) * (1 - r('fleet', -0.3, 0)),
    fleet: r('fleet', -0.1, 0.55),
    stageOpacity: (1 - 0.8 * r('track', -0.1, 0.25) * (1 - r('arrival', -0.4, 0.05))) * (1 - r('arrival', 0.75, 1)),
    depart: r('arrival', 0.2, 1),
  };
}

// Camera keyframes, anchored to scenes. `wide` is for landscape viewports,
// `tall` for portrait phones. The truck faces +X; its nose is at x ≈ 3.4 and
// the trailer rear at x ≈ -13.5. Fleet variants park in lanes at z < 0.
export const KEYFRAMES = {
  wide: [
    // Scene 1: night yard, low three-quarter front
    { scene: 'hero', t: 0, position: [14.5, 1.45, 7.6], target: [-3.0, 2.3, 1.6], fov: 30 },
    { scene: 'hero', t: 1, position: [12.4, 1.25, 7.0], target: [-3.0, 2.15, 1.8], fov: 30 },
    // Scene 2: side profile, then a low tracking shot along the trailer
    { scene: 'departure', t: 0.45, position: [-7.5, 2.6, 26], target: [-7.5, 2.3, 0], fov: 34 },
    { scene: 'departure', t: 1, position: [-17.5, 0.9, 4.8], target: [-3.0, 1.8, 0.4], fov: 40 },
    // Scene 3: crane up to the network map, then hold
    { scene: 'network', t: 0.3, position: [-6, 48, 40], target: [0, 0, 0], fov: 40 },
    { scene: 'network', t: 0.85, position: [-20, 132, 40], target: [-20, 0, -2], fov: 42 },
    { scene: 'network', t: 1.05, position: [-21, 126, 38], target: [-21, 0, -2], fov: 42 },
    // Scene 4: dive to the trailer's rear three-quarter, then rise over the crates
    { scene: 'cargo', t: 0.25, position: [-26, 3.2, 8.5], target: [-12, 2.2, 0], fov: 38 },
    { scene: 'cargo', t: 1, position: [-6, 15, 21], target: [-27, 0.5, 4], fov: 40 },
    // Scene 5: three noses in a row, then a lateral track across them
    { scene: 'fleet', t: 0.3, position: [26, 5, 19], target: [-5, 2.0, -1.5], fov: 36 },
    { scene: 'fleet', t: 1, position: [25, 4.5, 9], target: [-5, 2.0, -5.5], fov: 36 },
    // Scene 6: the stage dims; swing wide around the +Z side for the arrival
    { scene: 'track', t: 0.9, position: [14, 6, 20], target: [-6, 2, 0], fov: 36 },
    // Scene 7: low rear view as the truck pulls away into the fog
    { scene: 'arrival', t: 0.15, position: [-30, 1.1, 3.6], target: [-8, 1.8, 0.2], fov: 38 },
    { scene: 'arrival', t: 1, position: [-30, 1.2, 3.4], target: [10, 1.9, 0], fov: 34 },
  ],
  tall: [
    { scene: 'hero', t: 0, position: [12.5, 1.9, 12.5], target: [-0.2, 3.9, -0.6], fov: 50 },
    { scene: 'hero', t: 1, position: [11.0, 1.6, 11.0], target: [-0.4, 3.7, -0.4], fov: 50 },
    { scene: 'departure', t: 0.45, position: [-3.0, 3.0, 27], target: [-5.5, 3.4, 0], fov: 52 },
    { scene: 'departure', t: 1, position: [-18.0, 1.2, 5.2], target: [-3.0, 2.4, 0.4], fov: 54 },
    { scene: 'network', t: 0.3, position: [-4, 70, 46], target: [0, 0, 0], fov: 55 },
    { scene: 'network', t: 0.85, position: [2, 165, 64], target: [2, 0, 30], fov: 68 },
    { scene: 'network', t: 1.05, position: [2, 158, 62], target: [2, 0, 29], fov: 68 },
    { scene: 'cargo', t: 0.25, position: [-28, 3.6, 11], target: [-12, -1.5, 0], fov: 52 },
    { scene: 'cargo', t: 1, position: [-12, 16, 22], target: [-22, -6, 6], fov: 56 },
    { scene: 'fleet', t: 0.3, position: [30, 6, 22], target: [-1, -4.5, -7], fov: 52 },
    { scene: 'fleet', t: 1, position: [27, 4.5, 8], target: [-4, -4.5, -6], fov: 52 },
    { scene: 'track', t: 0.9, position: [18, 8, 26], target: [-6, 2.5, 0], fov: 50 },
    { scene: 'arrival', t: 0.15, position: [-34, 1.6, 4.6], target: [-8, 0.6, 0.2], fov: 52 },
    { scene: 'arrival', t: 1, position: [-34, 1.7, 4.2], target: [10, 0.9, 0], fov: 48 },
  ],
};

// Film-progress times for a keyframe list; throws if they are not increasing.
export function keyframeTimes(keyframes, ranges) {
  const times = keyframes.map((frame) => sceneTime(ranges, frame.scene, frame.t));
  times.forEach((time, index) => {
    if (index > 0 && time <= times[index - 1]) {
      throw new Error(`Keyframe ${index} (${keyframes[index].scene} ${keyframes[index].t}) is out of order`);
    }
  });
  return times;
}

// Even ranges for when no layout has been measured yet (and for tests).
export function evenRanges(scenes = SCENES) {
  const step = 1 / scenes.length;
  return Object.fromEntries(
    scenes.map((scene, index) => [scene, { start: index * step, end: index * step + step * 0.6 }]),
  );
}
