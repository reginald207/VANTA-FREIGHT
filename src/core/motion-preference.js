// Reduced-motion preference. A choice made with the in-page toggle
// (localStorage 'vf-motion' = 'reduce' | 'allow') overrides the OS setting;
// without one, the OS `prefers-reduced-motion` setting applies.
const QUERY = '(prefers-reduced-motion: reduce)';
const KEY = 'vf-motion';

function storedPreference() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function prefersReducedMotion() {
  const stored = storedPreference();
  if (stored === 'reduce') return true;
  if (stored === 'allow') return false;
  return window.matchMedia(QUERY).matches;
}

export function setReducedMotion(reduce) {
  try {
    localStorage.setItem(KEY, reduce ? 'reduce' : 'allow');
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  const root = document.documentElement;
  root.classList.toggle('vf-reduced-motion', reduce);
  if (reduce) root.classList.remove('vf-intro');
  window.dispatchEvent(new CustomEvent('vf:motionchange', { detail: { reduce } }));
}

// Calls back when the effective preference switches to "reduce" mid-session,
// from the OS setting (unless overridden) or the in-page toggle.
export function onReducedMotion(callback) {
  const media = window.matchMedia(QUERY);
  const fromMedia = (event) => {
    if (event.matches && storedPreference() !== 'allow') callback();
  };
  const fromToggle = (event) => {
    if (event.detail.reduce) callback();
  };
  media.addEventListener('change', fromMedia);
  window.addEventListener('vf:motionchange', fromToggle);
  return () => {
    media.removeEventListener('change', fromMedia);
    window.removeEventListener('vf:motionchange', fromToggle);
  };
}
