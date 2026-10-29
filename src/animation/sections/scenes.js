// DOM layers for Scenes 3-7: reveals, the network counters and the static map.
import { gsap } from '../gsap-setup.js';

// Tier 2: each scene's copy rises in as its sticky stage arrives.
export function createSceneReveals() {
  gsap.utils.toArray('.scene[data-scene]:not(.scene--departure)').forEach((scene) => {
    const items = scene.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    gsap.from(items, {
      opacity: 0,
      y: 32,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: { trigger: scene, start: 'top 80%', end: 'top 10%', scrub: 0.6 },
    });
  });
}

// Tier 1 with motion allowed: one-time reveals, plus the static map drawing in.
export function createStaticSceneReveals() {
  gsap.utils.toArray('.scene:not(.scene--departure) [data-reveal]').forEach((element) => {
    gsap.from(element, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
    });
  });

  const lanes = gsap.utils.toArray('.network-map__lane');
  if (lanes.length) {
    gsap.fromTo(
      lanes,
      { strokeDasharray: 1, strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        stagger: 0.06,
        scrollTrigger: { trigger: '.network-map', start: 'top 80%', once: true },
      },
    );
  }
}

// Stats count up once from zero. The HTML already holds the final values, so
// without JS (or with reduced motion) nothing changes.
export function createCounters() {
  gsap.utils.toArray('[data-count]').forEach((element) => {
    const target = Number(element.dataset.count);
    const counter = { value: 0 };
    gsap.to(counter, {
      value: target,
      duration: 1.4,
      ease: 'power2.out',
      snap: { value: 1 },
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          element.textContent = '0';
        },
      },
      onUpdate: () => {
        element.textContent = String(counter.value);
      },
    });
  });
}
