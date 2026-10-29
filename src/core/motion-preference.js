// Reduced-motion preference: the OS setting, or a stored in-page override
// ('vf-motion' = 'reduce'). The in-page toggle UI arrives in M2.
const QUERY = '(prefers-reduced-motion: reduce)';

function storedPreference() {
  try {
    return localStorage.getItem('vf-motion');
  } catch {
    return null;
  }
}

export function prefersReducedMotion() {
  return storedPreference() === 'reduce' || window.matchMedia(QUERY).matches;
}

// Calls back when the OS preference switches to "reduce" mid-session.
export function onReducedMotion(callback) {
  const media = window.matchMedia(QUERY);
  const listener = (event) => {
    if (event.matches) callback();
  };
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
