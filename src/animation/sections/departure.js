// Scene 2 DOM layer: the service statements.
import { gsap } from '../gsap-setup.js';

// Tier 2: statements step forward one by one, scrubbed by the sticky stage.
export function createDepartureFilm() {
  const statements = gsap.utils.toArray('.departure .statement');
  const timeline = gsap.timeline({
    scrollTrigger: { trigger: '.departure', start: 'top 70%', end: 'bottom bottom', scrub: 0.6 },
  });

  timeline.from('.departure .eyebrow, .departure__title', { opacity: 0, y: 32, stagger: 0.15, duration: 0.6 });
  // Each statement arrives from hidden and then stays at full strength:
  // dimming earlier ones would drop their text below AA contrast.
  statements.forEach((statement, index) => {
    timeline.fromTo(statement, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.8 }, 0.8 + index * 1.2);
  });
  timeline.to({}, { duration: 0.6 });
  return timeline;
}

// Tier 1 with motion allowed: gentle one-time reveals as the statements enter.
export function createStaticReveals() {
  gsap.utils.toArray('.departure .eyebrow, .departure__title, .departure .statement').forEach((element) => {
    gsap.from(element, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 88%', once: true },
    });
  });
}
