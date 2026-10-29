// Scroll-driven camera. Position and target follow centripetal Catmull-Rom
// curves through the choreography keyframes, so motion stays smooth forwards
// and backwards. Idle drift and pointer parallax are layered on top.
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { KEYFRAMES, evenRanges, keyframeTimes } from './choreography.js';

function buildTrack(frames) {
  const toVectors = (key) => frames.map((frame) => new Vector3(...frame[key]));
  return {
    frames,
    at: [],
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

  function setRanges(ranges) {
    Object.values(tracks).forEach((entry) => {
      entry.at = keyframeTimes(entry.frames, ranges);
    });
  }
  setRanges(evenRanges());

  function sample(progress) {
    const { at } = track;
    const last = at.length - 1;
    const t = MathUtils.clamp(progress, at[0], at[last]);
    let index = 0;
    while (index < last - 1 && t > at[index + 1]) index += 1;
    const span = at[index + 1] - at[index];
    const local = span > 0 ? MathUtils.clamp((t - at[index]) / span, 0, 1) : 0;
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
    setRanges,
    setAspect(aspect) {
      track = aspect < 0.85 ? tracks.tall : tracks.wide;
    },
  };
}
