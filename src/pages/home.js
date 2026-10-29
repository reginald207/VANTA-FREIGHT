// Home: the cinematic film (Scenes 0-7).
import './base.js';
import '../styles/pages/home.css';
import { gsap, ScrollTrigger } from '../animation/gsap-setup.js';
import { createDepartureFilm, createStaticReveals } from '../animation/sections/departure.js';
import { igniteStrips, playIntro } from '../animation/sections/hero.js';
import { createCounters, createSceneReveals, createStaticSceneReveals } from '../animation/sections/scenes.js';
import { applyTier, detectTier } from '../core/capabilities.js';
import { onReducedMotion, prefersReducedMotion } from '../core/motion-preference.js';

const root = document.documentElement;
const forcedTier = new URLSearchParams(window.location.search).get('tier');
// A forced `?tier=2` is an explicit request for 3D, so allow slow devices longer.
const READY_TIMEOUT_MS = forcedTier === '2' ? 15000 : 3000;

// Dev-only poster capture (`?capture=1`), stripped from production builds.
const capture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('capture');

function createLoadProgress() {
  const element = document.querySelector('.load-progress');
  element?.classList.add('is-active');
  return {
    set(value) {
      element?.style.setProperty('--progress', String(value));
    },
    done() {
      this.set(1);
      setTimeout(() => element?.classList.remove('is-active'), 450);
    },
  };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('stage-timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function startStaticExperience(reasons) {
  applyTier(1, reasons);
  root.dataset.vfStage = 'poster';
  if (prefersReducedMotion()) return;
  createStaticReveals();
  createStaticSceneReveals();
  createCounters();
}

// Where each scene's sticky span starts and ends, in film progress (0-1).
function measureSceneRanges() {
  const film = document.querySelector('.film');
  const top = film.getBoundingClientRect().top + window.scrollY;
  const length = Math.max(1, film.offsetHeight - window.innerHeight);
  const toProgress = (y) => (y - top) / length;

  const sections = gsap.utils.toArray('.film [data-scene]');
  const ranges = {
    hero: { start: 0, end: toProgress(sections[0].getBoundingClientRect().top + window.scrollY) },
  };
  sections.forEach((section) => {
    const start = section.getBoundingClientRect().top + window.scrollY;
    ranges[section.dataset.scene] = {
      start: toProgress(start),
      end: toProgress(start + section.offsetHeight - window.innerHeight),
    };
  });
  return ranges;
}

// Wires the live scene to scroll. Returns a teardown function.
function startFilm(scene) {
  const { film } = scene;
  const cargoItems = gsap.utils.toArray('.cargo-item');

  const applyRanges = () => scene.setRanges(measureSceneRanges());
  ScrollTrigger.addEventListener('refresh', applyRanges);
  applyRanges();

  const context = gsap.context(() => {
    // One scrubbed progress value drives the whole film (see choreography.js).
    gsap.to(film, {
      progress: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.film', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });

    // Scroll velocity drives the wheels and the road.
    ScrollTrigger.create({
      trigger: '.film',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        film.targetSpeed = gsap.utils.clamp(-14, 14, self.getVelocity() / 120);
      },
    });

    createDepartureFilm();
    createSceneReveals();
    createCounters();
  });

  // Highlight the cargo card whose crates have just landed.
  let activeCargo = -2;
  const syncCargo = () => {
    const next = scene.activeCargo;
    if (next === activeCargo) return;
    activeCargo = next;
    cargoItems.forEach((item, index) => item.classList.toggle('is-active', index === next));
  };
  gsap.ticker.add(syncCargo);

  // Pointer parallax on devices with a fine pointer only.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (event) => {
    film.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    film.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
  };
  if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onPointer);
    gsap.ticker.remove(syncCargo);
    ScrollTrigger.removeEventListener('refresh', applyRanges);
    cargoItems.forEach((item) => item.classList.remove('is-active'));
    context.revert();
  };
}

async function bootStage(progress) {
  const canvas = document.createElement('canvas');
  canvas.className = 'vf-stage';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  let scene = null;
  let teardown = null;
  let settled = false;
  const abandon = new AbortController();

  const downgrade = (reason) => {
    if (root.dataset.vfStage === 'poster') return;
    teardown?.();
    scene?.dispose();
    canvas.remove();
    root.classList.remove('vf-stage-live');
    startStaticExperience([reason]);
    ScrollTrigger.refresh();
  };

  try {
    progress.set(0.2);
    const loading = (async () => {
      const { createHomeScene } = await import('../webgl/home-scene.js');
      progress.set(0.5);
      const created = await createHomeScene({
        canvas,
        capture,
        signal: abandon.signal,
        labelsParent: document.body,
        onProgress: progress.set,
        onContextLost: () => downgrade('context-lost'),
        // Frames still far too slow at the lowest resolution: use the poster.
        onStruggle: () => {
          if (forcedTier !== '2') downgrade('low-fps');
        },
      });
      // If the deadline already passed, release the late scene.
      if (settled) created.dispose();
      return created;
    })();
    // A late failure after the deadline is already handled by the fallback.
    loading.catch(() => {});
    scene = await (capture ? loading : withTimeout(loading, READY_TIMEOUT_MS));
    settled = true;
  } catch (error) {
    settled = true;
    abandon.abort();
    progress.done();
    downgrade(error?.message === 'stage-timeout' ? 'stage-timeout' : 'stage-error');
    if (error?.message !== 'stage-timeout') console.warn('[vf] 3D stage unavailable:', error);
    return;
  }

  // Don't restructure the page under a reader who has already scrolled on.
  if (!capture && window.scrollY > window.innerHeight * 0.5) {
    progress.done();
    downgrade('scrolled-before-ready');
    return;
  }

  applyTier(2, capture ? ['capture'] : forcedTier === '2' ? ['forced:2'] : []);
  root.classList.add('vf-stage-live');
  root.dataset.vfStage = 'live';
  progress.done();

  if (capture) {
    root.classList.add('vf-capture');
    Object.assign(scene.film, { strip: 1, driftScale: 0 });
    window.__vfCapture = (type, quality) => scene.capture(type, quality);
    return;
  }

  ScrollTrigger.refresh();
  teardown = startFilm(scene);
  igniteStrips(scene.film);
  onReducedMotion(() => downgrade('reduced-motion'));
}

function main() {
  playIntro();

  // Turning reduced motion off again: reload into the full experience.
  window.addEventListener('vf:motionchange', (event) => {
    if (!event.detail.reduce && root.dataset.vfStage === 'poster') window.location.reload();
  });

  const { tier, reasons } = capture ? { tier: 2, reasons: [] } : detectTier();
  if (tier < 2) {
    startStaticExperience(reasons);
    return;
  }

  // Start static; upgrade to the live film once the stage is ready. The 3D
  // boot waits for the page to load and the browser to idle, so first paint
  // and the intro never compete with shader compilation.
  applyTier(1, ['pending']);
  root.dataset.vfStage = 'loading';
  const progress = createLoadProgress();
  const boot = () => bootStage(progress);
  const whenIdle = () =>
    'requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 1200 }) : setTimeout(boot, 200);
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

main();
