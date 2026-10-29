// Experience tiers (PROJECT_SPEC §5.4):
//   Tier 0: no JS (pure HTML + poster; never reaches this code)
//   Tier 1: static poster + gentle DOM motion
//   Tier 2: live WebGL scroll film
// `?tier=1` or `?tier=2` forces a tier for QA on real devices.
import { prefersReducedMotion } from './motion-preference.js';

function hasCapableWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    // failIfMajorPerformanceCaveat rejects software rasterisers (e.g. SwiftShader),
    // where a scroll-scrubbed 3D scene would be unusably slow.
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectTier() {
  const forced = new URLSearchParams(window.location.search).get('tier');
  if (forced === '1' || forced === '2') {
    return { tier: Number(forced), reasons: [`forced:${forced}`] };
  }

  const reasons = [];
  if (prefersReducedMotion()) reasons.push('reduced-motion');
  if (navigator.connection?.saveData) reasons.push('save-data');
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) reasons.push('low-memory');
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) reasons.push('low-cpu');
  if (!reasons.length && !hasCapableWebGL2()) reasons.push('no-webgl2');

  return { tier: reasons.length ? 1 : 2, reasons };
}

export function applyTier(tier, reasons = []) {
  const root = document.documentElement;
  root.classList.remove('vf-tier-1', 'vf-tier-2');
  root.classList.add(`vf-tier-${tier}`);
  root.dataset.vfTier = String(tier);
  root.dataset.vfTierReason = reasons.join(' ') || 'capable';
}
