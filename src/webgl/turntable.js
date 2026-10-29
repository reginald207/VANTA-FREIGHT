// Fleet page turntable (lazy chunk): one vehicle class at a time on the yard
// floor, with an orbiting camera. It turns itself gently for at most five
// seconds after loading (WCAG 2.2.2), and stops for good once anyone
// interacts with it.
import { Group, MathUtils } from 'three';
import { createFloor, createHeadlightBeams, createLights } from './environment.js';
import { createStage } from './stage.js';
import { createTruck } from './truck/truck-source.js';

const VARIANTS = ['semi', 'rigid', 'tractor'];
// Orbit distance per class, so each fills the frame.
const RADIUS = { semi: 23, rigid: 15.5, tractor: 12 };
const AUTO_SPEED = 0.12; // radians per second
const AUTO_SECONDS = 5;

export async function createTurntable({ canvas, onContextLost, onStruggle, signal, capture = false }) {
  const stage = createStage({
    canvas,
    onContextLost,
    onStruggle,
    adaptive: !capture,
    maxDpr: capture ? 2 : window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
  });
  const checkpoint = () => {
    if (signal?.aborted) {
      stage.dispose();
      throw new DOMException('Turntable load abandoned', 'AbortError');
    }
  };

  const built = await Promise.all(VARIANTS.map((variant) => createTruck({ type: 'procedural', variant })));
  checkpoint();

  const floor = createFloor(built[0].footprint);
  floor.setFog(0.018);
  stage.scene.fog.density = 0.018;
  stage.scene.add(floor.mesh, createLights());

  // Each class is centred on the origin so the camera orbits its middle.
  const vehicles = Object.fromEntries(
    built.map((truck, index) => {
      const rig = new Group();
      const beams = createHeadlightBeams(truck.headlights);
      rig.add(truck.group, beams.group);
      rig.position.x = -(truck.footprint.minX + truck.footprint.maxX) / 2;
      truck.setHeadlights(0.6);
      truck.setStrip(1);
      beams.setIntensity(0.6);
      stage.scene.add(rig);
      return [VARIANTS[index], { truck, rig }];
    }),
  );

  const view = {
    variant: 'semi',
    angle: MathUtils.degToRad(32),
    target: MathUtils.degToRad(32),
    auto: capture ? 0 : AUTO_SECONDS,
    radius: RADIUS.semi,
  };
  let portrait = false;
  stage.onResize((width, height) => {
    portrait = width / height < 0.85;
  });

  function showVariant(variant) {
    view.variant = variant;
    Object.entries(vehicles).forEach(([name, { rig }]) => {
      rig.visible = name === variant;
    });
    const { truck, rig } = vehicles[variant];
    floor.setFootprint(truck.footprint);
    floor.setTruckX(rig.position.x);
  }
  showVariant('semi');

  stage.addUpdate((time, dt) => {
    if (view.auto > 0) {
      view.auto -= dt;
      view.target += AUTO_SPEED * dt;
    }
    view.angle += (view.target - view.angle) * Math.min(1, dt * 6);
    view.radius += (RADIUS[view.variant] * (portrait ? 1.5 : 1) - view.radius) * Math.min(1, dt * 4);

    const camera = stage.camera;
    camera.position.set(Math.cos(view.angle) * view.radius, 3.4, Math.sin(view.angle) * view.radius);
    camera.lookAt(0, 1.9, 0);
    const fov = portrait ? 48 : 30;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  await stage.compile();
  checkpoint();
  stage.render();

  const normalise = (radians) => ((MathUtils.radToDeg(radians) % 360) + 360) % 360;

  return {
    setVariant: showVariant,
    // Turn by a number of degrees (user input). Stops auto-rotation.
    rotateBy(degrees) {
      view.auto = 0;
      view.target += MathUtils.degToRad(degrees);
    },
    setAngle(degrees) {
      view.auto = 0;
      view.angle = view.target = MathUtils.degToRad(degrees);
    },
    stopAuto() {
      view.auto = 0;
    },
    get angle() {
      return Math.round(normalise(view.target));
    },
    setActive: stage.setActive,
    capture(type = 'image/webp', quality = 0.86) {
      stage.render();
      return canvas.toDataURL(type, quality);
    },
    dispose: stage.dispose,
  };
}
