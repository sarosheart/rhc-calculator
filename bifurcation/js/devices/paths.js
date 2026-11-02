// Where things run: the LAD's path through the window (the pMV and dMV axes joined by a 2 mm fillet at the 20° bend), the
// tree's LM, LAD and D1 in local coordinates, and the LAD route a wire takes from the guide tip at the left main ostium to
// the distal LAD. Inside the window a wire lies at the lumen's centre (the plaque is eccentric, so that is off the axis in
// the bifurcation plane), a little to its own side of the plane; anything expanded round it (a stent, an inflated MV
// balloon) pulls it onto the axis.
import { A, axis } from '../scene/anatomy.js';
import { lumenRadius } from '../scene/vessel.js';
import { STENT, BALLOON_IDS, BALLOONS, SHOULDER } from './kinds.js';

const D = axis('dmv').dir, FIL = 2, PHI = Math.abs(A.DMV_DEG) / 2 * Math.PI / 180, RF = FIL / Math.tan(PHI);
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// the LAD path at u (u = s on the pMV, negative, and on the dMV): { p, t, n }, n the in-plane normal (+90° from t)
export function ladPath(u) {
  if (u <= -FIL) return { p: [u, 0, 0], t: [1, 0, 0], n: [0, 1, 0] };
  if (u >= FIL) return { p: [D[0] * u, D[1] * u, 0], t: [D[0], D[1], 0], n: [-D[1], D[0], 0] };
  const a = (u + FIL) / (2 * FIL) * 2 * PHI;                     // the fillet: centre (−FIL, −RF), turning clockwise
  return { p: [-FIL + RF * Math.sin(a), -RF + RF * Math.cos(a), 0], t: [Math.cos(a), -Math.sin(a), 0], n: [Math.sin(a), Math.cos(a), 0] };
}
// the LAD path's cross-section plane that holds p, in closed form: { u, f } with f = ladPath(u). The straight pMV's planes
// are x = u, the straight dMV's p·D = u, and the fillet's pass through its centre (−FIL, −RF); of the planes that hold p,
// the one whose axis point is nearest.
export function ladFrameOf(p) {
  const cand = [];
  if (p[0] <= -FIL) cand.push(p[0]);
  const ud = p[0] * D[0] + p[1] * D[1]; if (ud >= FIL) cand.push(ud);
  const a = Math.atan2(p[0] + FIL, p[1] + RF);
  if (a >= 0 && a <= 2 * PHI) cand.push(a * FIL / PHI - FIL);
  if (!cand.length) cand.push(p[0] < 0 ? -FIL : FIL);
  let best = null;
  for (const u of cand) { const f = ladPath(u), d = Math.hypot(p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]); if (!best || d < best.d) best = { u, f, d }; }
  return { u: best.u, f: best.f };
}
// The D1 path (Phase 3, the culotte's D1 stent): the proximal LAD's axis to u = −1, a circular fillet, D1's axis from u = +1
// (the LAD path's construction, mirrored to +30° with a 1 mm fillet, so the path keeps to the proximal LAD's axis as far as
// D1's origin). u is the pMV's s before the fillet and D1's s after it.
const DS = axis('sb').dir, FIL_SB = 1, PHI_SB = A.SB_DEG / 2 * Math.PI / 180, RF_SB = FIL_SB / Math.tan(PHI_SB);
export function sbPath(u) {
  if (u <= -FIL_SB) return { p: [u, 0, 0], t: [1, 0, 0], n: [0, 1, 0] };
  if (u >= FIL_SB) return { p: [DS[0] * u, DS[1] * u, 0], t: [DS[0], DS[1], 0], n: [-DS[1], DS[0], 0] };
  const a = (u + FIL_SB) / (2 * FIL_SB) * 2 * PHI_SB;                 // centre (−FIL, +RF), turning counter-clockwise
  return { p: [-FIL_SB + RF_SB * Math.sin(a), RF_SB - RF_SB * Math.cos(a), 0], t: [Math.cos(a), Math.sin(a), 0], n: [-Math.sin(a), Math.cos(a), 0] };
}
// the D1 path's cross-section plane that holds p, in closed form (as ladFrameOf): { u, f }
export function sbFrameOf(p) {
  const cand = [];
  if (p[0] <= -FIL_SB) cand.push(p[0]);
  const ud = p[0] * DS[0] + p[1] * DS[1]; if (ud >= FIL_SB) cand.push(ud);
  const a = Math.atan2(p[0] + FIL_SB, RF_SB - p[1]);
  if (a >= 0 && a <= 2 * PHI_SB) cand.push(a * FIL_SB / PHI_SB - FIL_SB);
  if (!cand.length) cand.push(p[0] < 0 ? -FIL_SB : FIL_SB);
  let best = null;
  for (const u of cand) { const f = sbPath(u), d = Math.hypot(p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]); if (!best || d < best.d) best = { u, f, d }; }
  return { u: best.u, f: best.f };
}
// the radius an inflated MV balloon (balloon A, on the LAD route, where the route's s is u) holds at u — balloon.js's
// radiusAt, without a route
export function mvBalloonRadius(u, pose) {
  const k = BALLOON_IDS[pose.bA_kind];
  if (!k || !(pose.bA_inf > 0)) return 0;
  const sp = BALLOONS[k], s1 = pose.bA_dist, s0 = s1 - sp.len;
  if (u < s0 - SHOULDER || u > s1 + SHOULDER) return 0;
  const t = u < s0 ? (u - (s0 - SHOULDER)) / SHOULDER : u > s1 ? (s1 + SHOULDER - u) / SHOULDER : 1;
  return sp.d / 2 * pose.bA_inf * smoothstep(t);
}
// the stent's proximal end: on its delivery balloon until it is fully deployed, then where it was deployed
export const stentU0 = (pose) => (BALLOON_IDS[pose.bA_kind] === 'stentLAD' && pose.st_exp < 0.999 ? pose.bA_dist - STENT.len : STENT.u0);
// how firmly something expanded holds the LAD's wires on the axis at u: 0 … 1
// (full over the stent or the balloon, easing off over 2 mm beyond either end, so a wire never kinks at an edge)
const over = (u, a, b) => smoothstep((u - (a - 2)) / 2) * smoothstep((b + 2 - u) / 2);
export function holdAt(u, pose) {
  let h = 0;
  if (pose.st_shown && pose.st_exp > 0) { const a = stentU0(pose); h = pose.st_exp * over(u, a, a + STENT.len); }
  const k = BALLOON_IDS[pose.bA_kind];
  if (k && pose.bA_inf > 0) { const sp = BALLOONS[k]; h = Math.max(h, pose.bA_inf * over(u, pose.bA_dist - sp.len - SHOULDER, pose.bA_dist + SHOULDER)); }
  return h;
}
// the in-plane offset of the lumen's centre from the LAD axis at u
export function centreOffset(u, pose) {
  if (u < -A.WIN.pmv || u > A.WIN.dmv) return 0;
  const b = u < 0 ? 'pmv' : 'dmv';
  return (lumenRadius(b, u, 0, pose) - lumenRadius(b, u, Math.PI, pose)) / 2;
}

// the tree's centrelines in local coordinates, once per tree
const cache = new WeakMap();
export function treeLocal(ctx) {
  if (cache.has(ctx.tree)) return cache.get(ctx.tree);
  const V = Object.fromEntries(ctx.tree.vessels.map(v => [v.id, v])), L = (pts) => pts.map(ctx.frame.toLocal);
  const lm = L(V.LM.pts), lad = { pts: L(V.LAD.pts), s: V.LAD.s }, d1 = { pts: L(V.D1.pts), s: V.D1.s };
  const arc = [0]; for (let i = 1; i < lm.length; i++) arc.push(arc[i - 1] + Math.hypot(...[0, 1, 2].map(k => lm[i][k] - lm[i - 1][k])));
  const lmS = arc.map(a => lad.s[0] - (arc[arc.length - 1] - a));
  const out = { lm: { pts: lm, s: lmS }, lad, d1 };
  cache.set(ctx.tree, out);
  return out;
}

// the route a wire takes to the distal LAD: { pts, s } with s = u (the LAD's own coordinate) all the way
export function ladRoute(pose, ctx, side = 0) {
  const T = treeLocal(ctx), pts = [], s = [];
  const add = (p, u) => { pts.push(p); s.push(u); };
  T.lm.pts.forEach((p, i) => add(p, T.lm.s[i]));
  T.lad.pts.forEach((p, i) => { if (T.lad.s[i] < -A.WIN.pmv && T.lad.s[i] > T.lm.s[T.lm.s.length - 1]) add(p, T.lad.s[i]); });
  for (let u = -A.WIN.pmv; u <= A.WIN.dmv + 1e-9; u += 0.5) add(ladPoint(u, pose, side), u);
  T.lad.pts.forEach((p, i) => { if (T.lad.s[i] > A.WIN.dmv) add(p, T.lad.s[i]); });
  return { pts, s };
}
export function ladPoint(u, pose, side = 0) {
  const { p, n } = ladPath(u), free = 1 - holdAt(u, pose);
  const off = centreOffset(u, pose) * free, sd = side * free * smoothstep((u + A.WIN.pmv) / 3) * smoothstep((A.WIN.dmv - u) / 3);
  return [p[0] + n[0] * off, p[1] + n[1] * off, sd];
}

// the LAD route's point and frame at u: inside the window the LAD path's own frame (n in plane, b = ẑ) — the wire's small
// offsets from the axis would tilt a frame taken from the polyline; outside it, the route's polyline frame
export function ladFrameAt(route, u, pose, side = 0) {
  if (u < -A.WIN.pmv || u > A.WIN.dmv) return routeAt(route, u);
  const f = ladPath(u);
  return { p: ladPoint(u, pose, side), t: f.t, n: f.n, b: [0, 0, 1] };
}
// a point, tangent and frame on a polyline route at its coordinate s: { p, t, n, b }, n = ẑ × t (the in-plane normal in
// the window), b = t × n
export function routeAt(route, s) {
  const S = route.s, P = route.pts;
  let i = 1; while (i < S.length - 1 && S[i] < s) i++;
  const k = Math.max(0, Math.min(1, (s - S[i - 1]) / ((S[i] - S[i - 1]) || 1)));
  const p = [0, 1, 2].map(c => P[i - 1][c] + k * (P[i][c] - P[i - 1][c]));
  let t = [0, 1, 2].map(c => P[i][c] - P[i - 1][c]); const tl = Math.hypot(...t) || 1; t = t.map(v => v / tl);
  let n = [-t[1], t[0], 0]; const nl = Math.hypot(...n);
  n = nl > 1e-6 ? n.map(v => v / nl) : [1, 0, 0];
  const b = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]];
  return { p, t, n, b };
}
