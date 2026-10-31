// Tweens a pose (numbers) from where it is to a target. Fields that switch on do so at the start, fields that switch off
// at the end, so a part never vanishes mid-move. With prefers-reduced-motion every move lands at once.

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const SWITCHES = new Set(['deviceShown', 'wireShown', 'sheathShown', 'plungerShown', 'pusherShown', 'cut', 'trimmed', 'flushed', 'mark']);

export function createAnimator({ onFrame, reduced = () => false }) {
  let cur = null, job = null;
  function set(pose) { const r = job?.resolve; cur = { ...pose }; job = null; onFrame(cur); r?.(); }     // a move cut short still settles
  function to(target, ms = 1200) {
    if (!cur || reduced() || ms <= 0) { set(target); return Promise.resolve(); }
    const from = { ...cur };
    for (const k of SWITCHES) if (target[k] > from[k]) from[k] = target[k];            // on at the start
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
