// Scroll-driven camera choreography. Keyframes are placed at film progress
// values (`at`, 0 to 1); position and target follow centripetal Catmull-Rom
// curves through them, so motion stays smooth forwards and backwards.
// Idle drift and pointer parallax are layered on top.
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

// Truck faces +X; the cab nose is at x ≈ 3.4, the trailer rear at x ≈ -13.5.
// `wide` is for landscape viewports, `tall` for portrait phones.
export const KEYFRAMES = {
  wide: [
    // Scene 1: low three-quarter front, at headlight height
    { at: 0, position: [14.5, 1.45, 7.6], target: [-3.0, 2.3, 1.6], fov: 30 },
    // End of hero scroll: slight push-in
    { at: 0.4, position: [12.4, 1.25, 7.0], target: [-3.0, 2.15, 1.8], fov: 30 },
    // Scene 2: full side profile
    { at: 0.72, position: [-7.5, 2.6, 26], target: [-7.5, 2.3, 0], fov: 34 },
    // Scene 2 end: low tracking shot along the trailer, looking forward
    { at: 1, position: [-17.5, 0.9, 4.8], target: [-3.0, 1.8, 0.4], fov: 40 },
  ],
  tall: [
    { at: 0, position: [12.5, 1.9, 12.5], target: [-0.2, 3.9, -0.6], fov: 50 },
    { at: 0.4, position: [11.0, 1.6, 11.0], target: [-0.4, 3.7, -0.4], fov: 50 },
    { at: 0.72, position: [-3.0, 3.0, 27], target: [-5.5, 3.4, 0], fov: 52 },
    { at: 1, position: [-18.0, 1.2, 5.2], target: [-3.0, 2.4, 0.4], fov: 54 },
  ],
};

function buildTrack(frames) {
  const toVectors = (key) => frames.map((frame) => new Vector3(...frame[key]));
  return {
    at: frames.map((frame) => frame.at),
    fov: frames.map((frame) => frame.fov),
    position: new CatmullRomCurve3(toVectors('position'), false, 'centripetal'),
    target: new CatmullRomCurve3(toVectors('target'), false, 'centripetal'),
  };
}

export function createCameraRig(camera) {
  const tracks = { wide: buildTrack(KEYFRAMES.wide), tall: buildTrack(KEYFRAMES.tall) };
  let track = tracks.wide;

  // Written by the page: progress (0-1), drift (0-1), pointer (-1 to 1).
  const state = { progress: 0, drift: 1, pointerX: 0, pointerY: 0 };
  const pointer = { x: 0, y: 0 };

  const position = new Vector3();
  const target = new Vector3();
  const right = new Vector3();
  const up = new Vector3();

  function sample(progress) {
    const t = MathUtils.clamp(progress, 0, 1);
    const last = track.at.length - 1;
    let index = 0;
    while (index < last - 1 && t > track.at[index + 1]) index += 1;
    const span = track.at[index + 1] - track.at[index];
    const local = span > 0 ? MathUtils.clamp((t - track.at[index]) / span, 0, 1) : 0;
    const u = (index + local) / last;
    track.position.getPoint(u, position);
    track.target.getPoint(u, target);
    return MathUtils.lerp(track.fov[index], track.fov[index + 1], MathUtils.smootherstep(local, 0, 1));
  }

  function update(time) {
    const fov = sample(state.progress);

    // Idle drift: slow, small, never synchronised on all axes.
    const drift = state.drift;
    position.x += Math.sin(time * 0.21) * 0.22 * drift;
    position.y += Math.sin(time * 0.17 + 1.3) * 0.08 * drift;
    position.z += Math.cos(time * 0.19) * 0.22 * drift;

    camera.position.copy(position);
    camera.lookAt(target);

    // Pointer parallax in camera space, eased.
    pointer.x += (state.pointerX - pointer.x) * 0.05;
    pointer.y += (state.pointerY - pointer.y) * 0.05;
    if (Math.abs(pointer.x) + Math.abs(pointer.y) > 1e-4) {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(right, pointer.x * 0.45).addScaledVector(up, pointer.y * 0.2);
      camera.lookAt(target);
    }

    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    state,
    update,
    setAspect(aspect) {
      track = aspect < 0.85 ? tracks.tall : tracks.wide;
    },
  };
}
