// Lightweight scroll reveals for content pages: IntersectionObserver plus a
// CSS transition, no animation library. Content is only hidden once this
// module has run (the `vf-reveal-ready` class), so it shows without JS, and
// nothing animates with reduced motion.
import { prefersReducedMotion } from './motion-preference.js';

export function initReveals(scope = document) {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  const items = scope.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  items.forEach((item) => observer.observe(item));
  document.documentElement.classList.add('vf-reveal-ready');

  // Switching reduced motion on mid-page shows everything at once.
  window.addEventListener('vf:motionchange', (event) => {
    if (!event.detail.reduce) return;
    observer.disconnect();
    items.forEach((item) => item.classList.add('is-visible'));
  });
}
