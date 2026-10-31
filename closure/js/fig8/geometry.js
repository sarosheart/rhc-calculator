// The figure-of-8 in the world frame (mm): the two transverse bites (medial −Z → lateral +Z on this right groin), the
// crossing over the sheath, the free ends, and Saro's knot (cross, twist ×3, one end through the loop, pulled down).
// The sheath leaves the skin at x = 30 (the 45° tract from the venotomy on the anterior wall at x = 0).
import { W } from '../scene/world.js';

// The cranial bite is taken just cranial of the skin entry (Lakshmanadoss 2017: "just superior") and so passes deep to the
// sheath, which there is only ~4 mm under the skin; at 26 mm and 12 mm deep it clears the 24F sheath's wall by ~1.7 mm.
export const BITE = Object.freeze({ depth: 12, half: 12, x: { caudal: 37, cranial: 26 } });
export const SHEATH_R = 4.0;                                       // 24F
export const PUNCTURE = Object.freeze([30, 0, 0]);
export const VENOTOMY = Object.freeze([0, W.WALL_OUT_Y, 0]);
export const HANDS_TOP = Object.freeze({ target: [30, 0, 0], dir: [0.3, 1, 0], radius: 24 });

// a bite: the arc of the curved needle through the tissue, from the medial skin entry, down to `depth`, up to the lateral exit
export function bitePath(which, depth, gather = 0) {
  const x = BITE.x[which] + (which === 'caudal' ? -1 : 1) * 2.5 * gather, half = BITE.half * (1 - 0.3 * gather);
  const d = depth * (1 - 0.15 * gather), R = (half * half + d * d) / (2 * d), cy = -d + R, t0 = Math.asin(Math.min(1, half / R));
  const pts = [];
  for (let k = 0; k <= 40; k++) { const t = -t0 + 2 * t0 * k / 40; pts.push([x, cy - R * Math.cos(t), R * Math.sin(t)]); }
  return pts;
}

// is the screen's right medial in the top view? (camera above and caudal, world up +Y)
export function screenRightIsMedial() {
  const n = Math.hypot(...HANDS_TOP.dir), f = HANDS_TOP.dir.map(v => -v / n), up = [0, 1, 0];
  const right = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  return right[2] < 0;                                     // −Z is medial on a right groin
}

const lift = (q, y) => [q[0], y, q[2]];
// the strand(s) for a pose: { strands: [polyline…], needle: polyline | null }
export function stitchPaths(p) {
  const g = p.gather, out = [];
  const b1 = bitePath('caudal', p.bite1Depth, g), b2 = bitePath('cranial', p.bite2Depth, g);
  const k = Math.round(p.stitch);
  if (k <= 0) return { strands: [], needle: null };
  // end A trails from the caudal bite's medial entry; the needle end runs on
  const tailA = p.knot >= 1 ? knotTail('A', p, b1[0]) : [[b1[0][0] + 10, 0.3, b1[0][2] - 22], lift(b1[0], 0.3)];
  const path = [...tailA, ...b1];
  if (k >= 2) {
    const a = b1[b1.length - 1], b = b2[0], over = p.sheathShown ? 6 : 1.2;   // over the sheath where it leaves the skin
    path.push(lift(a, 0.3), [(a[0] + b[0]) / 2 + 2, over, (a[2] + b[2]) / 2], lift(b, 0.3));
  }
  if (k >= 3) {
    path.push(...b2);
    path.push(...(p.knot >= 1 ? knotTail('B', p, b2[b2.length - 1]) : [lift(b2[b2.length - 1], 0.3), [b2[0][0] - 10, 0.3, 34]]));
  }
  out.push(path);
  // the needle, still on its strand while a bite is being taken (k = 1 after the first bite, k = 3 after the second)
  const needle = k === 1 ? needleOn(b1) : k === 3 && p.knot < 1 && !p.tension ? needleOn(b2) : null;
  if (p.knot >= 3) out.push(...loopStrands(p));
  return { strands: out, needle };
}
function needleOn(b) {      // a ½-circle needle, its point just out of the lateral exit, its body following the same arc back
  const e = b[b.length - 1], n = b[b.length - 2], d = e.map((v, i) => v - n[i]), L = Math.hypot(...d);
  const pts = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([e[0], e[1] + d[1] / L * 18 * t + 4 * Math.sin(Math.PI * t), e[2] + d[2] / L * 18 * t]); }
  return pts;
}
// where the knot is, and the free ends at each stage of Saro's knot, above the puncture
export function knotAt(p) {
  const h = p.knot >= 4 ? 0.6 : p.knot >= 2 ? 5 : 3;
  return [PUNCTURE[0], h + (p.cinchOnSheath ? 6 : 0), 0];
}
function knotTail(end, p, from) {
  const K = knotAt(p), s = end === 'A' ? -1 : 1;
  const pts = [lift(from, 0.4)];
  if (p.knot === 1) pts.push([K[0], 3, -s * 0.6], [K[0] + s * 3, 12, s * 9]);                   // crossed over the puncture
  else {
    const top = p.knot >= 4 ? 2.2 : 10, r = p.knot >= 4 ? 0.35 : 0.7;                           // twisted together ×3
    for (let k = 0; k <= 36; k++) { const t = k / 36, a = t * 3 * 2 * Math.PI + (end === 'A' ? 0 : Math.PI);
      pts.push([K[0] + r * Math.cos(a), K[1] + (top - K[1]) * t, r * Math.sin(a)]); }
    pts.push([K[0] + s * 4, top + 10, s * 6]);
  }
  return end === 'A' ? pts.reverse() : pts;
}
// one end bent round into a loop with the other end through it (from "through the loop" on)
function loopStrands(p) {
  const K = knotAt(p), r = p.knot >= 4 ? 1.1 : 3, top = p.knot >= 4 ? 2.4 : 11, pts = [];
  for (let k = 0; k <= 24; k++) { const a = 2 * Math.PI * k / 24; pts.push([K[0] + 1 + r * Math.cos(a), top + r * Math.sin(a), 0.6]); }
  return [pts];
}
