// Renderer, scene, camera and the render loop (driven by gsap.ticker so GSAP
// tweens and frames share one clock).
import {
  ACESFilmicToneMapping,
  FogExp2,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from '../animation/gsap-setup.js';
import { FOG_DENSITY, PALETTE } from './palette.js';
import { createAdaptiveResolution } from './quality.js';

export function createStage({ canvas, onContextLost, onStruggle, adaptive = true, maxDpr = 2 }) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = PALETTE.obsidian.clone();
  scene.fog = new FogExp2(PALETTE.obsidian.clone(), FOG_DENSITY);

  // Procedural studio reflections: no HDR file to download.
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  // Far plane covers the top-down network view.
  const camera = new PerspectiveCamera(35, 1, 0.1, 500);
  const resolution = createAdaptiveResolution(renderer, { maxDpr, onStruggle });

  const updaters = new Set();
  const resizers = new Set();
  let active = true;
  let lost = false;
  // While the canvas is fully transparent, keep updating but skip the draw.
  let hidden = false;
  // Real frame time for quality decisions (gsap's delta is lag-smoothed).
  let lastFrame = 0;

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resizers.forEach((fn) => fn(width, height));
  }

  function render(time = gsap.ticker.time, deltaMs = 16.7) {
    updaters.forEach((fn) => fn(time, Math.min(deltaMs, 100) / 1000));
    renderer.render(scene, camera);
  }

  function tick(time, deltaMs) {
    if (!active || lost || document.hidden || hidden) {
      lastFrame = 0;
      if (hidden && active && !lost) updaters.forEach((fn) => fn(time, Math.min(deltaMs, 100) / 1000));
      return;
    }
    render(time, deltaMs);
    const now = performance.now();
    if (adaptive && lastFrame) resolution.sample(now - lastFrame);
    lastFrame = now;
  }

  const onLost = (event) => {
    event.preventDefault();
    lost = true;
    onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  gsap.ticker.add(tick);

  return {
    renderer,
    scene,
    camera,
    get dpr() {
      return resolution.dpr;
    },
    addUpdate(fn) {
      updaters.add(fn);
    },
    onResize(fn) {
      resizers.add(fn);
      fn(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    },
    setActive(value) {
      active = value;
    },
    setHidden(value) {
      hidden = value;
    },
    render,
    compile: () => renderer.compileAsync(scene, camera),
    dispose() {
      gsap.ticker.remove(tick);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (!material) return;
          Object.values(material).forEach((value) => value?.isTexture && value.dispose());
          material.dispose();
        });
      });
      envTarget.dispose();
      renderer.dispose();
    },
  };
}
