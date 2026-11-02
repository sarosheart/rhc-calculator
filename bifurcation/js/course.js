// The scrub bar's model (Saro: "click and drag where they are to speed up or rewind the sequence"): a technique's actions as
// one run, 0 … N, where each step starts on it, and the pose at any point along it. Within an action the run passes through
// its keyframes in turn, each taking its share of the action by its duration, and the pose there is one frame of the
// animator's own tween between two keyframes (engine/anim.js, with the technique's switches: numbers eased, switches on at
// the start and off at the end), so a drag shows exactly the frames the move plays. Closure's course.js, with keyframes.
// Pure; node-tested.
import { createAnimator } from './engine/anim.js';

// the states along the correct path: path[k] has made the first k actions; the last is done
export function correctPath(M) {
  const path = [M.initialState()];
  for (let a = M.nextAction(path[0]); a; a = M.nextAction(path[path.length - 1])) path.push(M.apply(path[path.length - 1], a));
  return path;
}

// a tick where each step starts (the index of its first action), and a phase name under the bar at the phase's first step
// phases: [{ from: step index, label }]
export function courseMarks(M, path, steps, phases = []) {
  return steps.map((_, i) => ({ at: path.findIndex((s) => M.stepIndex(s) === i),
    group: phases.find((p) => p.from === i)?.label || null })).filter((m) => m.at >= 0);
}

// the pose a fraction t of the way from pose a to pose b, as the animator draws that moment of the move (over a span long
// enough that the few microseconds the animator's clock moves between to() and tick() do not show: the same x, the same pose)
const SPAN = 1e12;
export function blendPose(a, b, t, switches) {
  if (t <= 0) return { ...a };
  if (t >= 1) return { ...b };
  let out = null;
  const A = createAnimator({ onFrame: (p) => { out = p; }, switches });
  A.set(a);
  const t0 = performance.now(); A.to(b, SPAN); A.tick(t0 + t * SPAN);
  return out;
}

// the pose at position x along the path (x = 2.5: half-way through the third action, by time); poseOf(state) → pose,
// duration(action, keyframe index) → ms
export function poseAlong(path, M, poseOf, duration, switches, x) {
  const n = path.length - 1, X = Math.min(Math.max(x, 0), n), k = Math.min(Math.floor(X), n), f = X - k;
  if (f <= 1e-9 || k >= n) return poseOf(path[k]);
  const a = M.nextAction(path[k]), ks = M.keyframes(path[k], a), d = ks.map((_, i) => Math.max(0, duration(a, i))), D = d.reduce((p, q) => p + q, 0);
  let t = f * D, i = 0;
  while (i < ks.length - 1 && t > d[i]) { t -= d[i]; i++; }
  const from = i ? poseOf(ks[i - 1]) : poseOf(path[k]);
  return blendPose(from, poseOf(ks[i]), d[i] > 0 ? t / d[i] : 1, switches);
}
