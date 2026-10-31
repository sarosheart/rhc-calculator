// Knot 2 locked over a loose knot 1: the strands of the two sutures caught round each other between the knots. A strand
// wound three times round the line from knot 1 up to knot 2, in the tract, outside the vessel.
import { suturePaths } from '../proglide/suture.js';
import { devicePose } from './pose.js';

export function tanglePath(p, geom) {
  if (!(p.tangle >= 0.5)) return null;
  const K1 = suturePaths(devicePose(p, 'a'), geom).knot.at, K2 = suturePaths(devicePose(p, 'b'), geom).knot.at;
  const d = K2.map((v, i) => v - K1[i]), L = Math.hypot(...d), u = d.map(v => v / L);
  // two directions across the line between the knots
  const a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const n1 = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]], m = Math.hypot(...n1);
  for (let i = 0; i < 3; i++) n1[i] /= m;
  const n2 = [u[1] * n1[2] - u[2] * n1[1], u[2] * n1[0] - u[0] * n1[2], u[0] * n1[1] - u[1] * n1[0]];
  const pts = [];
  for (let k = 0; k <= 48; k++) {
    const t = k / 48, r = 0.9 * Math.sin(Math.PI * t), f = 3 * 2 * Math.PI * t;          // three turns, pinched at each knot
    pts.push(K1.map((v, i) => v + d[i] * t + r * (n1[i] * Math.cos(f) + n2[i] * Math.sin(f))));
  }
  return pts;
}
