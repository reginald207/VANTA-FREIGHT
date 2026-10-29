// Home film scene (lazy chunk). Assembles stage, truck, yard and camera rig and
// exposes a small `film` state object that the page animates with GSAP.
import { createCameraRig } from './camera-rig.js';
import { createFloor, createHeadlightBeams, createLights } from './environment.js';
import { createStage } from './stage.js';
import { createTruck } from './truck/truck-source.js';

export async function createHomeScene({ canvas, onProgress = () => {}, onContextLost, capture = false }) {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const stage = createStage({
    canvas,
    onContextLost,
    adaptive: !capture,
    maxDpr: capture ? 2 : coarsePointer ? 1.5 : 2,
  });

  const truck = await createTruck({ type: 'procedural' });
  onProgress(0.75);

  const floor = createFloor(truck.footprint);
  const beams = createHeadlightBeams(truck.headlights);
  stage.scene.add(truck.group, floor.mesh, beams.group, createLights());

  const rig = createCameraRig(stage.camera);
  stage.onResize((width, height) => rig.setAspect(width / height));

  // Animated by the page (GSAP + ScrollTrigger).
  const film = {
    progress: 0, // 0-1 across Scenes 1-2
    headlights: 0, // 0-1
    strip: 0, // lime light strips, 0-1
    drift: 1, // idle camera drift amount
    targetSpeed: 0, // m/s, set from scroll velocity
    speed: 0,
    distance: 0,
    pointerX: 0,
    pointerY: 0,
  };

  stage.addUpdate((time, dt) => {
    // Speed eases toward the scroll-driven target, which decays when idle.
    film.speed += (film.targetSpeed - film.speed) * Math.min(1, dt * 3);
    film.targetSpeed *= Math.exp(-dt * 2.5);
    film.distance += film.speed * dt;

    truck.setDistance(film.distance);
    truck.setHeadlights(film.headlights);
    truck.setStrip(film.strip);
    floor.setOffset(film.distance);
    floor.setLights(film.headlights, film.strip);
    beams.setIntensity(film.headlights);

    Object.assign(rig.state, {
      progress: film.progress,
      drift: film.drift,
      pointerX: film.pointerX,
      pointerY: film.pointerY,
    });
    rig.update(time);
  });

  await stage.compile();
  stage.render();
  onProgress(0.95);

  return {
    film,
    setActive: stage.setActive,
    get dpr() {
      return stage.dpr;
    },
    // Renders one frame and reads it back synchronously (poster capture).
    capture(type = 'image/webp', quality = 0.86) {
      stage.render();
      return canvas.toDataURL(type, quality);
    },
    dispose: stage.dispose,
  };
}
