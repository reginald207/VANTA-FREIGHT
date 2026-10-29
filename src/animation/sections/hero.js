// Scene 0/1 intro: the header wordmark ignites letter by letter, then the hero
// support copy rises in. The H1 and the lede are never hidden: they are the
// largest text on first paint (the LCP candidates).
import { gsap } from '../gsap-setup.js';

export function playIntro() {
  const root = document.documentElement;
  if (!root.classList.contains('vf-intro')) return null;

  const chars = gsap.utils.toArray('.wordmark__char');
  const items = gsap.utils.toArray('.page-home [data-intro]');
  // Take over from the CSS fallback reveal.
  [...chars, ...items].forEach((el) => {
    el.style.animation = 'none';
    el.style.opacity = '0';
  });

  return gsap
    .timeline({ onComplete: () => root.classList.remove('vf-intro') })
    .to(chars, { opacity: 1, duration: 0.35, ease: 'steps(2)', stagger: 0.045 })
    .fromTo(
      items,
      { y: 18 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 },
      0.3,
    );
}

// Lime strips flicker on: two slow pulses (well under 3 Hz), then steady.
export function igniteStrips(film) {
  return gsap
    .timeline()
    .to(film, { strip: 0.9, duration: 0.25, ease: 'power1.in' })
    .to(film, { strip: 0.15, duration: 0.3 })
    .to(film, { strip: 1, duration: 0.35, ease: 'power2.out' });
}
