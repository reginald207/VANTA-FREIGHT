// Adaptive resolution: if the average frame time stays over budget, step the
// pixel ratio down (never back up, to avoid oscillating).
export function createAdaptiveResolution(renderer, { maxDpr, minDpr = 1, budgetMs = 20, sampleSize = 90 }) {
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  let samples = [];
  let cooldown = 0;
  renderer.setPixelRatio(dpr);

  return {
    get dpr() {
      return dpr;
    },
    sample(deltaMs) {
      if (cooldown > 0) {
        cooldown -= 1;
        return;
      }
      // Ignore hitches from tab switches or GC pauses.
      if (deltaMs > 250) return;
      samples.push(deltaMs);
      if (samples.length < sampleSize) return;

      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      samples = [];
      if (average > budgetMs && dpr > minDpr) {
        dpr = Math.max(minDpr, Math.round((dpr - 0.25) * 100) / 100);
        renderer.setPixelRatio(dpr);
        cooldown = 60;
      }
    },
  };
}
