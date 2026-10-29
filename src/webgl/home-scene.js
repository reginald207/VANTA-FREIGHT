// Home film scene (lazy chunk). Assembles stage, truck, yard, network, cargo
// and fleet, and applies the choreography for the current film progress on
// every frame. The page only writes `film.progress` and a few inputs.
import { Group } from 'three';
import { createCameraRig } from './camera-rig.js';
import { createCargo } from './cargo.js';
import { deriveState, evenRanges } from './choreography.js';
import { createFloor, createHeadlightBeams, createLights } from './environment.js';
import { createFleet } from './fleet.js';
import { createNetwork } from './network.js';
import { createStage } from './stage.js';
import { heroTruckSource } from './truck/hero-truck.js';
import { createTruck } from './truck/truck-source.js';

// Distance the truck travels as it pulls away in Scene 7 (metres).
const DEPART_DISTANCE = 90;

export async function createHomeScene({
  canvas,
  labelsParent,
  onProgress = () => {},
  onContextLost,
  onStruggle,
  signal,
  capture = false,
}) {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const compact = window.matchMedia('(max-width: 40rem)').matches;
  const stage = createStage({
    canvas,
    onContextLost,
    onStruggle,
    adaptive: !capture,
    maxDpr: capture ? 2 : coarsePointer ? 1.5 : 2,
  });

  // Abandoned (load deadline passed): stop before the expensive steps.
  const checkpoint = () => {
    if (signal?.aborted) {
      stage.dispose();
      throw new DOMException('Stage load abandoned', 'AbortError');
    }
  };

  const [truck, fleet] = await Promise.all([heroTruckSource().then(createTruck), createFleet()]);
  checkpoint();
  onProgress(0.75);

  const truckRig = new Group();
  const beams = createHeadlightBeams(truck.headlights);
  truckRig.add(truck.group, beams.group);

  const floor = createFloor(truck.footprint);
  const network = createNetwork({ labelsParent, compact });
  const cargo = createCargo();
  stage.scene.add(truckRig, floor.mesh, network.group, cargo.group, fleet.group, createLights());

  const rig = createCameraRig(stage.camera);
  let viewport = { width: 1, height: 1 };
  stage.onResize((width, height) => {
    viewport = { width, height };
    rig.setAspect(width / height);
  });

  // Inputs written by the page (GSAP + ScrollTrigger and pointer events).
  const film = {
    progress: 0, // 0-1 across the whole film
    strip: 0, // lime light strips, 0-1 (ignition)
    targetSpeed: 0, // m/s, from scroll velocity
    speed: 0,
    distance: 0,
    pointerX: 0,
    pointerY: 0,
    driftScale: 1, // 0 freezes idle drift (poster capture)
  };
  let ranges = evenRanges();
  let state = deriveState(0, ranges);
  let stageOpacity = '';

  stage.addUpdate((time, dt) => {
    state = deriveState(film.progress, ranges);

    // Road speed eases toward the scroll-driven target, which decays when idle.
    film.speed += (film.targetSpeed - film.speed) * Math.min(1, dt * 3);
    film.targetSpeed *= Math.exp(-dt * 2.5);
    film.distance += film.speed * dt;

    // Scene 7: the truck itself pulls away (accelerating) into the fog.
    const travel = DEPART_DISTANCE * state.depart ** 2;
    truckRig.position.x = travel;
    truck.setDistance(film.distance + travel);
    truck.setHeadlights(state.headlights);
    truck.setStrip(film.strip);
    truck.setXray(state.xray);
    beams.setIntensity(state.headlights);

    floor.setOffset(film.distance);
    floor.setLights(state.headlights, film.strip);
    floor.setFog(state.fogDensity);
    floor.setMap(state.map);
    floor.setTruckX(travel);
    stage.scene.fog.density = state.fogDensity;

    network.setState(state.networkVisible, state.networkDraw);
    cargo.setProgress(state.crates, state.xray);
    fleet.setProgress(state.fleet);

    Object.assign(rig.state, {
      progress: film.progress,
      drift: state.drift * film.driftScale,
      pointerX: film.pointerX,
      pointerY: film.pointerY,
    });
    rig.update(time);
    network.update(time, stage.camera, viewport.width, viewport.height);

    const opacity = state.stageOpacity.toFixed(3);
    if (opacity !== stageOpacity) {
      stageOpacity = opacity;
      canvas.style.opacity = opacity;
      stage.setHidden(state.stageOpacity < 0.001);
    }
  });

  // Compile every layer up front, including the ones that start hidden, so
  // no shader compiles mid-scroll.
  const layers = [network.group, cargo.group, fleet.group];
  layers.forEach((layer) => {
    layer.visible = true;
  });
  checkpoint();
  await stage.compile();
  checkpoint();
  stage.render();
  onProgress(0.95);

  return {
    film,
    get state() {
      return state;
    },
    get activeCargo() {
      return cargo.activeCategory;
    },
    // Scene spans in film progress, measured from the page layout.
    setRanges(next) {
      ranges = next;
      rig.setRanges(next);
    },
    setActive: stage.setActive,
    // Renders one frame and reads it back synchronously (poster capture).
    capture(type = 'image/webp', quality = 0.86) {
      stage.render();
      return canvas.toDataURL(type, quality);
    },
    dispose() {
      network.dispose();
      stage.dispose();
    },
  };
}
