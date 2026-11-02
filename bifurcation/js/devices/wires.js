// The two 0.014″ wires. Each follows a route from the guide tip at the left main ostium (paths.js): `lad` to the distal LAD;
// `d1` into D1 — between the stent and the wall on the pMV's D1 side once a stent is open across it (jailed), and onto the
// D1 stent's axis before its proximal end once a D1 stent is in; `d1cell` inside the LAD stent, out through its cell
// `st_cell`, into D1; `d1ss` from the LAD lumen through the crushed D1 stent's cell `ss_cell` into D1; `d1both` through
// `st_cell`, then `ss_cell` behind it. A wire is its route up to its tip (pose wX_tip, the route's own s). A route through
// cells carries `passS`, the route coordinate of its first passage.
import { A, axis, OSTIUM } from '../scene/anatomy.js';
import { ROUTE, WIRE_R, TIP_LEN, SIDE, BALLOON_IDS, BALLOONS, SHOULDER } from './kinds.js';
import { ladRoute, ladPath, treeLocal, routeAt, stentU0 } from './paths.js';
import { stentRadius, stentAxis, axisFrame, cellsOf, cellPassage } from './stent.js';
import { sbCellPassage } from './sb-stent.js';
import { ladFrameOf, sbPath, sbFrameOf, ladPoint } from './paths.js';
import { cuCellPassage, cuStentRadius, CUSTENT } from './cu-stent.js';

export { ROUTE, WIRE_R, TIP_LEN, routeAt };
const SB = axis('sb').dir, sbAt = (s) => [SB[0] * s, SB[1] * s, 0], sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function routePolyline(route, pose, ctx, which) {
  if (route === ROUTE.lad) return cuJailed(pose) ? jailBehindCu(ladRoute(pose, ctx, SIDE[which]), pose) : ladRoute(pose, ctx, SIDE[which]);
  if (route === ROUTE.d1 && isCu(pose)) return cuRoute(pose, ctx, which);
  if (route === ROUTE.dmvcell) return dmvRoute(pose, ctx, which);
  if (route === ROUTE.d1 || route === ROUTE.d1cell || route === ROUTE.d1ss || route === ROUTE.d1both) return d1Route(route, pose, ctx, which);
  return { pts: [], s: [] };
}

// ── the culotte (Phase 3): the D1 stent from the proximal LAD into D1 on the D1 path (paths.js sbPath) ──
const isCu = (pose) => pose.ss_kind === 2 && !!pose.ss_shown;
// teal into D1 with the culotte stent in: the LAD route to 2 mm before the stent, onto the D1 path over those 2 mm, then the
// path (the stent's own axis, so the crimped stent in place sits where it deploys and the open stent holds the wire on it)
// and the tree's D1; the route coordinate is the path's u
function cuRoute(pose, ctx, which, uEnd = A.WIN.sb) {
  const lad = ladRoute(pose, ctx, SIDE[which]), T = treeLocal(ctx), s0 = pose.ss_s0, pts = [], s = [];
  for (let i = 0; i < lad.pts.length && lad.s[i] < s0 - 2; i++) { pts.push(lad.pts[i]); s.push(lad.s[i]); }
  for (let u = s0 - 2; u < s0; u += 0.25) { const a = ladPoint(u, pose, SIDE[which]), b = sbPath(u).p, k = smoothstep((u - (s0 - 2)) / 2);
    pts.push([0, 1, 2].map(c => a[c] + (b[c] - a[c]) * k)); s.push(u); }
  for (let u = s0; u <= uEnd + 1e-9; u += 0.25) { pts.push(sbPath(u).p); s.push(u); }
  if (uEnd >= A.WIN.sb) T.d1.pts.forEach((p, i) => { if (T.d1.s[i] > A.WIN.sb + 0.25) { s.push(s[s.length - 1] + dist(p, pts[pts.length - 1])); pts.push(p); } });
  return { pts, s };
}
// teal through the culotte stent's distal cell into the distal LAD: inside the stent on its path to 1.2 mm before the cell,
// 0.5 toward it, the passage, then the LAD route down the distal LAD (route coordinate: arc length)
function dmvRoute(pose, ctx, which) {
  const X = cuCellPassage(pose.ss_cell, ctx.graph, pose, ctx).p, ua = sbFrameOf(X).u - 1.2, out = cuRoute(pose, ctx, which, ua), { pts, s } = out;
  const add = (p) => { s.push(s[s.length - 1] + dist(p, pts[pts.length - 1])); pts.push(p); };
  const c = sbPath(ua).p, v = [X[0] - c[0], X[1] - c[1], X[2] - c[2]], vl = Math.hypot(...v) || 1;
  add([0, 1, 2].map(k => c[k] + v[k] / vl * 0.5)); add(X); out.passS = s[s.length - 1];
  const D = axis('dmv').dir, uOut = X[0] * D[0] + X[1] * D[1] + 2.5, lad = ladRoute(pose, ctx, SIDE[which]);
  lad.pts.forEach((p, i) => { if (lad.s[i] >= uOut) add(p); });
  // the 3.0 balloon through the cell, inflated, lies on the distal LAD's axis (cu-stent.js cuOpening): it holds its wire there
  const k = BALLOON_IDS[pose.bA_kind] === 'openMV' && (pose.bA_wire === 2 ? 'B' : 'A') === which ? pose.bA_inf || 0 : 0;
  if (k > 0) {
    const a = pose.bA_dist - BALLOONS.openMV.len - SHOULDER, b = pose.bA_dist + SHOULDER;
    out.pts = pts.map((p, i) => { const w = k * smoothstep((s[i] - (a - 2)) / 2) * smoothstep((b + 2 - s[i]) / 2); if (!w) return p;
      const q = ladPath(ladFrameOf(p).u).p; return [0, 1, 2].map(c => p[c] + (q[c] - p[c]) * w); });
  }
  return out;
}
// the jailed wire: once the culotte stent is open (and until its cell is opened toward the distal LAD — by then this wire is
// out), the wire left in the LAD runs behind it, between the stent and the wall on the far side of D1
const cuJailed = (pose) => isCu(pose) && pose.ss_exp > 0.02 && !(pose.st_shown && pose.st_exp > 0) && !(pose.ss_open > 0);
function jailBehindCu(route, pose) {
  const s0 = pose.ss_s0, pts = route.pts.map((p) => {
    if (p[0] < -A.WIN.pmv - 1) return p;
    const { u, f } = sbFrameOf(p);
    if (u < s0 - 1 || u > s0 + CUSTENT.len) return p;
    const vn = (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1], w = p[2], R = cuStentRadius(u, pose) + WIRE_R;
    if (Math.hypot(vn, w) >= R) return p;
    const to = -Math.sqrt(Math.max(0, R * R - w * w));
    if (vn <= to) return p;
    const k = smoothstep(u - (s0 - 1)), un = vn + (to - vn) * k;
    return [f.p[0] + f.n[0] * un, f.p[1] + f.n[1] * un, w];
  });
  return { pts, s: route.s };
}

function d1Route(kind, pose, ctx, which) {
  const route = kind, lad = ladRoute(pose, ctx, SIDE[which]), T = treeLocal(ctx), pts = [], s = [], out = { pts, s };
  const add = (p, ss) => { if (ss === undefined) ss = s[s.length - 1] + dist(p, pts[pts.length - 1]); pts.push(p); s.push(ss); };
  // TAP (Phase 3): once its D1 stent is in, the wire through the LAD stent's opened cell runs as the d1 route does with a D1
  // stent — onto D1's axis at the stent's proximal end — inside the LAD stent (not jailed), out through the opened cell
  const tapIn = route === ROUTE.d1cell && pose.ss_shown && pose.ss_kind === 1;
  if (route === ROUTE.d1 || tapIn) {
    // with a D1 stent in, the bend lands on D1's axis at the stent's proximal end, its control point where the incoming
    // line meets D1's axis, so the wire leaves the LAD along it and enters the stent along D1
    const sbEnd = pose.ss_shown ? Math.min(3.5, pose.ss_s0) : 3.5, bEnd = sbAt(sbEnd);
    const ub = pose.ss_shown ? Math.min(OSTIUM.heel[0] - 1.2, bEnd[0] - 2.4) : OSTIUM.heel[0] - 1.2;
    const u0 = stentU0(pose), e = pose.st_shown ? pose.st_exp : 0, ax = e > 0.02 && !tapIn ? stentAxis(pose, ctx) : null;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ub; i++) {
      let p = lad.pts[i]; const u = lad.s[i];
      if (ax && u > u0 - 1 && u >= -A.WIN.pmv) {          // jailed: pushed out behind the stent on the pMV's D1 side
        const f = ladPath(u), sa = axisFrame(ax, u, pose), rr = stentRadius(u, 0, pose) + WIRE_R;
        const jail = [sa.p[0] + sa.n[0] * rr, sa.p[1] + sa.n[1] * rr, p[2]];
        const on = (q) => (q[0] - f.p[0]) * f.n[0] + (q[1] - f.p[1]) * f.n[1];
        if (on(jail) > on(p)) { const w = smoothstep(u - (u0 - 1)); p = [0, 1, 2].map(c => p[c] + (jail[c] - p[c]) * w); }
      }
      add(p, u);
    }
    // a smooth bend from the pMV into D1: a quadratic curve that leaves along the pMV and arrives on D1's axis
    const a = pts[pts.length - 1], b = bEnd;
    let m = [a[0] + 1.6, a[1], a[2] * 0.5];
    if (pose.ss_shown) { const t30 = SB[1] / SB[0], mx = Math.max(a[0] + 0.3, Math.min(b[0] - 0.3, a[1] / t30)); m = [mx, mx * t30, a[2] * 0.5]; }
    for (let t = 0.1; t <= 1 + 1e-9; t += 0.1) add([0, 1, 2].map(c => (1 - t) ** 2 * a[c] + 2 * t * (1 - t) * m[c] + t * t * b[c]));
    for (let q = sbEnd + 0.5; q <= A.WIN.sb + 1e-9; q += 0.5) add(sbAt(q));
  } else if (route === ROUTE.d1ss) {
    // from the LAD lumen through the crushed D1 stent's cell: no LAD stent in yet, so the wire comes down the LAD's centre
    const X = sbCellPassage(pose.ss_cell, ctx.graph, { ...pose, ss_open: 0, st_open: 0 }, ctx).p, uX = ladFrameOf(X).u, ua = uX - 1.2;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ua; i++) add(lad.pts[i], lad.s[i]);
    const f = ladFrameOf(X).f;
    const c = [f.p[0], f.p[1], 0], v = [X[0] - c[0], X[1] - c[1], X[2] - c[2]], vl = Math.hypot(...v) || 1;
    add([0, 1, 2].map(k => c[k] + v[k] / vl * 0.5));                   // toward the cell, still in the lumen
    const iX = s.length; add(X); out.passS = s[iX];                       // through the cell
    const sOut = Math.max(sbProj(X) + 1.0, sbProj(OSTIUM.centre) + 0.6);
    for (let q2 = sOut; q2 <= A.WIN.sb + 1e-9; q2 += 0.5) add(sbAt(q2));
  } else {
    const base = { ...pose, st_open: 0 }, X = cellPassage(pose.st_cell, ctx.graph, base, ctx);
    const ua = stentU0(pose) + X.z - 1.2;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ua; i++) add(lad.pts[i], lad.s[i]);
    const f = axisFrame(stentAxis(base, ctx), ua, base), c = Math.cos(X.th), sn = Math.sin(X.th);
    add([0, 1, 2].map(k => f.p[k] + 0.5 * (c * f.n[k] + sn * f.b[k])));   // toward the cell, still inside
    const iX = s.length; add(X.p); out.passS = s[iX];                     // through the cell
    let last = X.p;
    if (route === ROUTE.d1both) { last = sbCellPassage(pose.ss_cell, ctx.graph, { ...pose, ss_open: 0, st_open: 0 }, ctx).p; add(last); }  // and the crushed cell
    const sOut = Math.max(sbProj(last) + 1.0, sbProj(OSTIUM.centre) + 0.6);
    for (let q = sOut; q <= A.WIN.sb + 1e-9; q += 0.5) add(sbAt(q));
  }
  T.d1.pts.forEach((p, i) => { if (T.d1.s[i] > A.WIN.sb + 0.25) add(p); });
  return out;
}

// the wire as drawn: its route from the guide tip to its tip
export function wirePath(pose, which, ctx) {
  const route = pose[`w${which}_route`], tip = pose[`w${which}_tip`];
  if (!route) return [];
  const R = routePolyline(route, pose, ctx, which);
  if (!R.pts.length || tip <= R.s[0]) return [];
  const out = [];
  for (let i = 0; i < R.pts.length && R.s[i] < tip; i++) out.push(R.pts[i]);
  out.push(routeAt(R, Math.min(tip, R.s[R.s.length - 1])).p);
  return out;
}
