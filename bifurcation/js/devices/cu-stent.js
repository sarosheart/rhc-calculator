// The culotte's D1 stent (Phase 3): the whole strut graph (kinds.js CUSTENT, 2.5 × 22) on the D1 path (paths.js sbPath:
// the proximal LAD's axis, a 1 mm fillet, D1's axis), from the proximal LAD into D1 across the distal LAD's origin. Every
// point goes through one pipeline (the Phase 3 plan), so struts, cells and the sheet agree:
//   1 wrap at the radius the pose gives: crimped → nominal 1.25, plus the culotte POT (ss_potR) over the POT's working
//     length, tapering off over its last 1 mm (the LAD stent's potWeight convention);
//   2 the opening toward the distal LAD (ss_cell, ss_open): a 3.0 balloon's straight capsule through the cell's passage to
//     14 mm down the distal LAD; points inside go to its surface, never past the vessel wall;
//   3 the overlap: while the LAD stent is open (or an MV balloon inflated inside it), a point within its radius + 0.09 of the
//     LAD path's axis goes radially out to that — the LAD stent is the inner layer, strut on strut;
//   4 the final kiss's opening through the LAD stent's cell (st_cell, st_open), never past the wall.
import { A, axis, CARINA } from '../scene/anatomy.js';
import { CUSTENT, BALLOON_IDS } from './kinds.js';
import { sbPath, sbFrameOf, ladFrameOf, ladPath, mvBalloonRadius, stentU0 } from './paths.js';
import { stentRadius, polygonsOf, memoKey, stOpening, nearestOnPath } from './stent.js';
import { routePolyline, routeAt } from './wires.js';
import { placeFor } from './balloon.js';
// (sb-stent.js imports this module; each uses the other only inside functions)
import { openInside, wallOf } from './sb-stent.js';

const D = axis('dmv').dir;
const dmvProj = (p) => p[0] * D[0] + p[1] * D[1], dmvAt = (s) => [D[0] * s, D[1] * s, 0];
const dmvDist = (p) => { const s = dmvProj(p); return Math.hypot(p[0] - D[0] * s, p[1] - D[1] * s, p[2]); };
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const LAYER = 0.09;                                              // strut on strut (0.08 mm struts) [ESTIMATE], as Phase 2's P4
export const POT_IN = 0.25, POT_LEN = 6;                          // the culotte POT: 3.75 × 6, its proximal end 0.25 inside

export { CUSTENT };
// the culotte POT's working length on the D1 path, and its weight there (1 over it, tapering over its last 1 mm)
export const cuPotSpan = (pose) => ({ u0: pose.ss_s0 + POT_IN, u1: pose.ss_s0 + POT_IN + POT_LEN });
export function cuPotWeight(u, pose) {
  const { u0, u1 } = cuPotSpan(pose);
  return smoothstep((u - (u0 - 1.5)) / 1.5) * (1 - smoothstep(u - (u1 - 1)));
}
// the radius the pose holds the culotte's D1 stent at, u on its path
export function cuStentRadius(u, pose) {
  const e = pose.ss_exp || 0;
  let r = CUSTENT.crimpR + (CUSTENT.nomR - CUSTENT.crimpR) * e;
  if ((pose.ss_potR || 0) > CUSTENT.nomR && e > 0) r += (pose.ss_potR - CUSTENT.nomR) * cuPotWeight(u, pose) * e;
  return r;
}
function wrap(th, z, pose) {
  const u = pose.ss_s0 + z, f = sbPath(u), ph = th + CUSTENT.rot, r = cuStentRadius(u, pose), c = Math.cos(ph), s = Math.sin(ph);
  return [f.p[0] + r * c * f.n[0], f.p[1] + r * c * f.n[1], r * s];
}

// ── cells over the distal LAD's origin, the distal one, its passage ──
// cells with ≥ 10 % of the outline within the distal LAD's radius of its axis, past the bifurcation (on the stent wrapped
// with the POT, before any opening), sorted by the centroid's x
export function cuCellsOverDmv(graph, pose, ctx) {
  const out = [];
  for (const c of polygonsOf(graph)) {
    let n = 0, x = 0;
    for (const [th, z] of c.polygon) { const p = wrap(th, z, pose); x += p[0]; if (dmvProj(p) > 0 && dmvDist(p) < A.DMV_R) n++; }
    if (n >= 0.1 * c.polygon.length) out.push({ id: c.id, pair: c.pair, x: x / c.polygon.length });
  }
  return out.sort((a, b) => a.x - b.x);
}
// distal: of those, the one whose centre is nearest the carina tip
export function pickCuCell(graph, pose, ctx, which) {
  if (which !== 'distal') return -1;
  let best = -1, bd = Infinity; const t = CARINA.tip;
  for (const c of cuCellsOverDmv(graph, pose, ctx)) {
    const P = polygonsOf(graph)[c.id].polygon, m = [0, 0, 0];
    for (const [th, z] of P) { const p = wrap(th, z, pose); for (let k = 0; k < 3; k++) m[k] += p[k] / P.length; }
    const d = Math.hypot(m[0] - t[0], m[1] - t[1], m[2] - t[2]);
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}
// where a wire or balloon going to the distal LAD passes through a cell: of the points inside it ≥ 0.25 mm from its struts
// (measured on the stent at nominal), the one nearest the distal LAD's axis — { p, th, z }
const passCache = new Map();
export function cuCellPassage(cell, graph, pose, ctx) {
  const key = [cell, pose.ss_s0, pose.ss_exp, pose.ss_potR].join('|');
  if (passCache.has(key)) return passCache.get(key);
  const P = polygonsOf(graph)[cell].polygon, R = CUSTENT.nomR, ths = P.map(q => q[0]), zs = P.map(q => q[1]);
  const inside = (x, y) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
  const edge = (x, y) => { let m = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
    const ax = (b[0] - a[0]) * R, ay = b[1] - a[1], px = (x - a[0]) * R, py = y - a[1];
    const t = Math.max(0, Math.min(1, (px * ax + py * ay) / (ax * ax + ay * ay || 1))); m = Math.min(m, Math.hypot(px - t * ax, py - t * ay)); } return m; };
  let best = null;
  for (let th = Math.min(...ths); th <= Math.max(...ths); th += 0.02) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.05) {
    if (!inside(th, z) || edge(th, z) < 0.25) continue;
    const p = wrap(th, z, pose), d = dmvDist(p);
    if (!best || d < best.d) best = { d, p, th, z };
  }
  const out = best ? { p: best.p, th: best.th + CUSTENT.rot, z: best.z } : null;
  if (passCache.size > 64) passCache.clear();
  passCache.set(key, out);
  return out;
}
// the 3.0 balloon's tube through the cell toward the distal LAD: inflated, a 3.0 balloon in the 3.0 distal LAD lies on its
// axis (the LAD path), so the tube is its working length there — from 2 mm before the cell's passage (inside the D1 stent)
// to 10 mm past it; the passage, 1.06 mm off that axis next to the carina, lies inside it
export function cuOpening(cell, graph, pose, ctx) {
  const uX = ladFrameOf(cuCellPassage(cell, graph, pose, ctx).p).u, path = [];
  for (let u = uX - 2; u <= uX + 10 + 1e-9; u += 0.25) path.push(ladPath(u).p);
  return { path, r: 1.5 };
}

// ── the pipeline ──
// the walls the openings stop at hold no balloon; the opening toward the distal LAD comes before the LAD stent
const wallPoseA = (p) => ({ ...p, st_shown: 0, st_exp: 0, bA_kind: 0, bA_inf: 0, bB_kind: 0, bB_inf: 0, wA_route: 0, wB_route: 0 });
const wallPoseB = (p) => ({ ...p, bA_kind: 0, bA_inf: 0, bB_kind: 0, bB_inf: 0 });
function pointFn(graph, pose, ctx, stage) {
  const open = stage >= 4 && pose.ss_cell >= 0 && pose.ss_open > 0 ? { tube: cuOpening(pose.ss_cell, graph, pose, ctx), R: 1.5 * pose.ss_open } : null;
  const st = pose.st_shown && pose.st_exp > 0, live = (pose.bA_inf || 0) > 0, u0 = stentU0(pose);
  const fin = stage >= 6 ? stOpening(ctx.graph, pose, ctx) : null;
  const wA = open ? wallOf(wallPoseA(pose), ctx) : null, wB = fin ? wallOf(wallPoseB(pose), ctx) : null;
  return (th, z) => {
    const p = wrap(th, z, pose);
    if (stage <= 1) return { p, crushed: false };
    if (open) openInside(p, open, wA);                                       // 2 toward the distal LAD
    if (stage >= 5 && st) {                                                   // 3 the overlap: the LAD stent inside
      const { u, f } = ladFrameOf(p), un = (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1], w = p[2], r = Math.hypot(un, w);
      if (u >= u0 - 0.5 && u <= u0 + 22.5) {
        const phi = Math.atan2(w, un), S = Math.max(st ? stentRadius(u, phi, pose) : 0, live ? mvBalloonRadius(u, pose) : 0) + LAYER;
        if (r < S) { const c = Math.cos(phi), s = Math.sin(phi); p[0] = f.p[0] + S * c * f.n[0]; p[1] = f.p[1] + S * c * f.n[1]; p[2] = S * s; }
      }
    }
    if (fin) openInside(p, fin, wB);                                          // 4 the final kiss
    return { p, crushed: false };
  };
}
export const CU_FIELDS = ['ss_shown', 'ss_exp', 'ss_s0', 'ss_potR', 'ss_cell', 'ss_open', 'st_shown', 'st_exp', 'st_potR', 'st_ellip', 'st_cell',
  'st_open', 'v_predLAD', 'v_predD1'];
const cuKey = (p) => CU_FIELDS.map(f => p[f]).join('|') + ((p.bA_inf || 0) > 0 ? `|a${p.bA_kind},${p.bA_dist},${p.bA_inf}` : '');
// on its way in, crimped on its delivery balloon (before it reaches its place), it rides the balloon's route
function riding(pose, ctx) {
  if (BALLOON_IDS[pose.bB_kind] !== 'stentCu' || (pose.ss_exp || 0) > 0) return null;
  if (Math.abs(pose.bB_dist - placeFor('stentCu', pose, ctx)) < 1e-6) return null;
  const w = pose.bB_wire === 2 ? 'B' : 'A', route = routePolyline(pose[`w${w}_route`], pose, ctx, w), u0 = pose.bB_dist - CUSTENT.len;
  return (th, z) => { const f = routeAt(route, u0 + z), ph = th + CUSTENT.rot, r = CUSTENT.crimpR, c = Math.cos(ph), s = Math.sin(ph);
    return { p: [0, 1, 2].map(k => f.p[k] + r * (c * f.n[k] + s * f.b[k])), crushed: false }; };
}
export const cuPointFn = (graph, pose, ctx, stage = 6) => riding(pose, ctx) || pointFn(graph, pose, ctx, stage);
export function cuStentLines(graph, pose, ctx) {
  const ride = riding(pose, ctx);
  return memoKey(ctx, 'cu', ride ? `r${pose.bB_dist},${pose.bB_wire},${pose.wA_route},${pose.wB_route},${pose.ss_s0}` : cuKey(pose), () => {
    const pt = ride || pointFn(graph, pose, ctx, 6);
    return graph.lines.map(l => l.pts.map(([th, z]) => pt(th, z).p));
  });
}
export { nearestOnPath, BALLOON_IDS };
