// The scrub bar's model (Saro: "click and drag where they are to speed up or rewind the sequence"): a device mode's
// correct moves as one run, 0 … N, where each step starts on it, and the pose at any point along it. Between two states
// the pose is one frame of the animator's own tween from the first to the second (anim.js: numbers eased, switches on
// at the start and off at the end), so a drag shows exactly the frames a move plays. Pure; node-tested.
import { createAnimator } from './anim.js';

// the states along the correct path: path[k] has made the first k correct moves; the last is done
export function correctPath(M, geom) {
  const path = [M.initialState(geom)];
  for (let a = M.nextAction(path[0]); a; a = M.nextAction(path[path.length - 1])) path.push(M.apply(path[path.length - 1], a));
  return path;
}

// a tick where each step starts (the index of its first move), and a phase name under the bar at the phase's first step
// phases: [{ from: step index, label }]
export function courseMarks(M, path, steps, phases = []) {
  return steps.map((_, i) => ({ at: path.findIndex((s) => M.stepIndex(s) === i),
    group: phases.find((p) => p.from === i)?.label || null })).filter((m) => m.at >= 0);
}

// the pose a fraction t of the way from pose a to pose b, as the animator draws that moment of the move
const SPAN = 1e6;
export function blendPose(a, b, t) {
  if (t <= 0) return { ...a };
  if (t >= 1) return { ...b };
  let out = null;
  const A = createAnimator({ onFrame: (p) => { out = p; } });
  A.set(a);
  const t0 = performance.now(); A.to(b, SPAN); A.tick(t0 + t * SPAN);
  return out;
}

// the pose at position x along the path (x = 2.5: half-way through the third move); poseOf(state) → pose
export function poseAlong(path, poseOf, x) {
  const n = path.length - 1, X = Math.min(Math.max(x, 0), n), k = Math.min(Math.floor(X), n);
  const t = X - k;
  return t > 1e-6 && k < n ? blendPose(poseOf(path[k]), poseOf(path[k + 1]), t) : poseOf(path[k]);
}
