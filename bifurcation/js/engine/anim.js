// Tweens a pose (numbers) from where it is to a target. Fields named in `switches` (discrete: on/off, a route, a device kind,
// which wire a balloon rides) take a new value at the start of the move, and turn off at its end, so a part never vanishes
// mid-move and never rides its old wire or route there. `switches` is a Set (a value above 0 is on) or a Map of each
// field's "none" value (any other value is on — a cell id 0 is a cell).
// With prefers-reduced-motion every move lands at once. (Closure's animator, with the switches passed in.)

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export function createAnimator({ onFrame, reduced = () => false, switches: SWITCHES = new Set() }) {
  let cur = null, job = null;
  function set(pose) { const r = job?.resolve; cur = { ...pose }; job = null; onFrame(cur); r?.(); }     // a move cut short still settles
  function to(target, ms = 1200) {
    if (!cur || reduced() || ms <= 0) { set(target); return Promise.resolve(); }
    const from = { ...cur };
    const on = (k, v) => (SWITCHES instanceof Map ? v !== SWITCHES.get(k) : v > 0);
    for (const k of SWITCHES.keys()) if (on(k, target[k]) && target[k] !== from[k]) from[k] = target[k];   // on, or changed, at the start; off at the end
    return new Promise((resolve) => { job = { from, target, t0: performance.now(), ms, resolve }; });
  }
  function tick(now = performance.now()) {
    if (!job) return false;
    const t = Math.min(1, (now - job.t0) / job.ms), e = ease(t), { from, target } = job;
    const p = {};
    for (const k of Object.keys(target)) {
      if (SWITCHES.has(k)) p[k] = t < 1 ? from[k] : target[k];
      else p[k] = from[k] + (target[k] - from[k]) * e;
    }
    cur = p; onFrame(cur);
    if (t >= 1) { const r = job.resolve; job = null; r(); }
    return true;
  }
  function finish() { if (job) { const { target, resolve } = job; job = null; cur = { ...target }; onFrame(cur); resolve(); } }
  return { set, to, tick, finish, busy: () => job !== null, get pose() { return cur; } };
}
