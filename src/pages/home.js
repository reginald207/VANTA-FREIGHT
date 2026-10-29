// Home: the cinematic film (Scenes 0-2 in milestone M1).
import './base.js';
import '../styles/pages/home.css';
import { gsap, ScrollTrigger } from '../animation/gsap-setup.js';
import { createDepartureFilm, createStaticReveals } from '../animation/sections/departure.js';
import { igniteStrips, playIntro } from '../animation/sections/hero.js';
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
  if (!prefersReducedMotion()) createStaticReveals();
}

// Wires the live scene to scroll. Returns a teardown function.
function startFilm(scene) {
  const { film } = scene;
  const canvas = document.querySelector('.vf-stage');

  const context = gsap.context(() => {
    // Camera choreography across hero + departure.
    gsap.to(film, {
      progress: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.film', start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });

    // Drift calms down as the film moves on.
    gsap.to(film, {
      drift: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: '.film', start: 'top top', end: 'bottom bottom', scrub: true },
    });

    // Headlights come up to full beam on departure.
    gsap.fromTo(
      film,
      { headlights: 0.3 },
      {
        headlights: 1,
        ease: 'power1.inOut',
        immediateRender: false,
        scrollTrigger: { trigger: '.departure', start: 'top 80%', end: 'top top', scrub: true },
      },
    );

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

    // After the film, fade the stage out and stop rendering.
    gsap.to(canvas, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.after-film',
        start: 'top bottom',
        end: 'top 25%',
        scrub: true,
        onLeave: () => scene.setActive(false),
        onEnterBack: () => scene.setActive(true),
      },
    });
  });

  // Pointer parallax on devices with a fine pointer only.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (event) => {
    film.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    film.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
  };
  if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onPointer);
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
        onProgress: progress.set,
        onContextLost: () => downgrade('context-lost'),
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
    Object.assign(scene.film, { strip: 1, headlights: 0.3, drift: 0 });
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

  const { tier, reasons } = capture ? { tier: 2, reasons: [] } : detectTier();
  if (tier < 2) {
    startStaticExperience(reasons);
    return;
  }

  // Start static; upgrade to the live film once the stage is ready.
  applyTier(1, ['pending']);
  root.dataset.vfStage = 'loading';
  bootStage(createLoadProgress());
}

main();
