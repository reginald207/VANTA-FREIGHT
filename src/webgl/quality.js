// Adaptive resolution: if the average frame time stays over budget, step the
// pixel ratio down (never back up, to avoid oscillating). If frames are still
// far too slow at the minimum ratio, call `onStruggle` so the page can fall
// back to the static poster.
export function createAdaptiveResolution(
  renderer,
  {
    maxDpr,
    minDpr = 1,
    budgetMs = 20,
    struggleMs = 34,
    sampleSize = 90,
    windowMs = 1500,
    cooldownMs = 1000,
    onStruggle,
  },
) {
  let dpr = Math.min(globalThis.devicePixelRatio || 1, maxDpr);
  let samples = [];
  let total = 0; // clamped frame times, for the average
  let elapsed = 0; // real time, to close the window
  let cooldown = 0;
  let strikes = 0;
  renderer.setPixelRatio(dpr);

  return {
    get dpr() {
      return dpr;
    },
    // `deltaMs` must be real wall-clock frame time (not a lag-smoothed delta).
    sample(deltaMs) {
      // After a change, give the new ratio a moment before judging it.
      if (cooldown > 0) {
        cooldown -= deltaMs;
        return;
      }
      // Clamp single hitches (GC, a busy tab) so one bad frame can't decide;
      // consistently slow frames still count as slow.
      samples.push(Math.min(deltaMs, 250));
      total += samples.at(-1);
      elapsed += deltaMs;
      // A window closes after `sampleSize` frames or `windowMs`, whichever is
      // first, so very slow devices are judged within seconds.
      if (samples.length < sampleSize && elapsed < windowMs) return;

      const average = total / samples.length;
      samples = [];
      total = 0;
      elapsed = 0;
      if (average > budgetMs && dpr > minDpr) {
        // Step down gently, or straight to the minimum if far too slow.
        const step = average > struggleMs * 2 ? dpr : 0.25;
        dpr = Math.max(minDpr, Math.round((dpr - step) * 100) / 100);
        renderer.setPixelRatio(dpr);
        cooldown = cooldownMs;
        return;
      }
      // Two slow windows in a row at the minimum ratio: give up on 3D.
      strikes = dpr <= minDpr && average > struggleMs ? strikes + 1 : 0;
      if (strikes >= 2) onStruggle?.(average);
    },
  };
}
