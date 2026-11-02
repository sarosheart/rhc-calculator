// The D1 stent (Phase 2): the same strut design's first 12 rings (kinds.js SBSTENT) on D1's axis, its proximal end
// `ss_s0` (pose) protruding into the LAD by the technique's protrusion. Every point goes through one pipeline (the Phase 2
// plan, "the D1 stent's point pipeline"), so the struts, the cells' passages and the sheet agree:
//   1 wrap at the radius the pose gives (crimped → nominal, the PSO flare over its proximal 3 mm);
//   2 hold: while a device is parked in the LAD (ss_hold), nothing comes within ss_hold of the gold wire on the LAD's
//     far side of it;
//   3 crush: toward D1 in the LAD cross-section onto the crushing surface (the lasting ss_crushR field, or a live MV
//     balloon while no LAD stent is in) — pushed struts settle 0.09 mm outside it, struts that lay against the wall 0.18;
//   4 the first kiss's opening through one of its cells (ss_cell, ss_open): every point inside the D1 balloon's working
//     length (as the kiss placed it, on the rewire's route) goes out to its surface, and no farther than the vessel wall;
//   5 re-crush by the LAD stent (and a live MV balloon inside it): struts the kiss raised go back out to it + 0.09;
//   6 the final kiss's opening through the LAD stent's cell (st_cell, st_open; Phase 1's tube), also stopping at the wall.
import { A, axis, OSTIUM } from '../scene/anatomy.js';
import { SBSTENT, SIDE } from './kinds.js';
import { ladFrameOf, ladPoint, mvBalloonRadius } from './paths.js';
import { stentRadius, potWeight, subGraph, polygonsOf, memoKey, openPoint, stOpening, nearestOnPath } from './stent.js';
// (wires.js and balloon.js import this module too; each side uses the other only inside functions, never at load)
import { routePolyline, routeAt } from './wires.js';
import { placeFor } from './balloon.js';
import { BALLOON_IDS, ROUTE } from './kinds.js';
import { balloonPlace } from './balloon.js';
import { pushFn } from './push.js';
import { lumenSDF } from '../scene/vessel.js';
import { cuStentLines, cuPointFn, CUSTENT } from './cu-stent.js';

const SB = axis('sb').dir, N = [-SB[1], SB[0], 0];
const sbProj = (p) => p[0] * SB[0] + p[1] * SB[1], sbAt = (s) => [SB[0] * s, SB[1] * s, 0];
const d1Dist = (p) => { const s = sbProj(p); return Math.hypot(p[0] - SB[0] * s, p[1] - SB[1] * s, p[2]); };
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const PUSHED = 0.09, WALL = 0.18, FLARE = 0.15;              // strut on strut (0.08 mm struts); the PSO's extra radius [ESTIMATE]

export { SBSTENT };
export function sbGraph(graph) {
  if (!graph._sb) Object.defineProperty(graph, '_sb', { value: subGraph(graph, SBSTENT.rings), enumerable: false });
  return graph._sb;
}
// the radius the pose holds the D1 stent at, at s on D1's axis
export function sbStentRadius(s, th, pose) {
  const e = pose.ss_exp || 0;
  let r = SBSTENT.crimpR + (SBSTENT.nomR - SBSTENT.crimpR) * e;
  if ((pose.ss_flare || 0) > 0 && e > 0) r += FLARE * pose.ss_flare * e * (1 - smoothstep((s - pose.ss_s0 - 3) / 2));
  return r;
}
// the surface a crush holds at u: the lasting field once crushed (1.5 → 1.875 under the POT, the stent's own POT
// weighting), an inflated MV balloon, and the LAD stent once it is in
const lasting = (u, f, pose) => (pose.ss_crushR >= 1.5 ? 1.5 + (pose.ss_crushR - 1.5) * potWeight(f.p[0]) : 0);
export function crushSurface(u, pose) {
  const { f } = { f: ladFrameOf([u, 0, 0]).f };
  let S = Math.max(lasting(u, f, pose), mvBalloonRadius(u, pose));
  if (pose.st_shown && pose.st_exp > 0) S = Math.max(S, stentRadius(u, 0, pose));
  return S;
}

// the pipeline for one graph point (θ, z); stage limits how far it goes (3: crushed, before any opening; 5: no kiss
// openings). Returns the point and whether a crush moved it.
function inPlane(p) {
  const { u, f } = ladFrameOf(p);
  return { u, f, un: (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1], w: p[2] };
}
const fromPlane = (f, un, w) => [f.p[0] + f.n[0] * un, f.p[1] + f.n[1] * un, w];
// an opening pushes a point out of the balloon's way, but never through the vessel wall: if the pushed point would leave
// the lumen it stops where the lumen ends, on the line it was pushed along
export function openInside(p, o, wall) {
  const q = p.slice();
  if (!openPoint(p, o.tube, o.R) || wall(p) <= -0.03) return;
  let lo = 0, hi = 1;
  if (wall(q) > -0.03) { for (let c = 0; c < 3; c++) p[c] = q[c]; return; }
  for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2, r = [0, 1, 2].map(c => q[c] + (p[c] - q[c]) * m); if (wall(r) <= -0.03) lo = m; else hi = m; }
  const out = [0, 1, 2].map(c => q[c] + (p[c] - q[c]) * lo); for (let c = 0; c < 3; c++) p[c] = out[c];
}
// The walls the openings stop at hold no balloon (a pushed strut stays where it went when the balloon is withdrawn); the
// first kiss's wall has no LAD stent either (it is not in yet), so the first four steps depend on the D1 stent alone.
const wallPose4 = (p) => ({ ...p, st_shown: 0, st_exp: 0, bA_kind: 0, bA_inf: 0, bB_kind: 0, bB_inf: 0, wA_route: 0, wB_route: 0 });
const wallPose6 = (p) => ({ ...p, bA_kind: 0, bA_inf: 0, bB_kind: 0, bB_inf: 0 });
export const wallOf = (pose, ctx) => { let push = null; return (q) => { if (!push) push = pushFn(pose, ctx); return lumenSDF(q, pose, push); }; };
// the hold matters only until the crush (which moves every point it held)
const holding = (pose) => (pose.ss_hold || 0) > 0 && !(pose.ss_crushR >= 1.5);
// TAP (ss_kind 1, Phase 3): the D1 stent goes in after the LAD stent, through its opened cell, beside a balloon parked on the
// wire in the LAD (teal there); the kiss's LAD balloon presses the protrusion's carina side toward D1 (step 3 with the live
// balloon, the LAD stent in), and nothing re-crushes it or opens a cell in it afterwards (steps 5 and 6 are the crushes')
const isTap = (pose) => pose.ss_kind === 1;
const ladWireSide = (pose) => (pose.wB_route === ROUTE.lad ? SIDE.B : SIDE.A);
// steps 1–4 for one graph point: { p, crushed }
function basePoint(pose, ctx, tube4, stage) {
  const hold = holding(pose) ? pose.ss_hold : 0, st = pose.st_shown && pose.st_exp > 0, wall = wallOf(wallPose4(pose), ctx);
  return (th, z) => {
    const s = pose.ss_s0 + z, ph = th + SBSTENT.rot, r = sbStentRadius(s, ph, pose), c = Math.cos(ph), sn = Math.sin(ph);
    let p = [SB[0] * s + N[0] * r * c, SB[1] * s + N[1] * r * c, r * sn], crushed = false;
    if (stage <= 1) return { p, crushed };                               // wrapped only (the sheet's rest shape)
    const L = inPlane(p); let un = L.un;
    if (hold > 0 && Math.hypot(un, L.w) < A.PMV_R + 0.3) {            // 2 hold
      const q = ladPoint(L.u, pose, ladWireSide(pose)), qn = (q[0] - L.f.p[0]) * L.f.n[0] + (q[1] - L.f.p[1]) * L.f.n[1];
      if (un < qn + hold) un = qn + hold;
    }
    const S = Math.max(lasting(L.u, L.f, pose), st && !isTap(pose) ? 0 : mvBalloonRadius(L.u, pose));
    if (S > 0 && Math.abs(L.w) < S) {                                     // 3 crush
      const c0 = Math.sqrt(S * S - L.w * L.w);
      if (isTap(pose)) { if (un < c0) { un = (un + c0) / 2; crushed = true; } }   // TAP: the two kissing balloons meet halfway
      else if (un < c0 + WALL) { un = Math.sqrt((S + (un >= c0 - 0.1 ? WALL : PUSHED)) ** 2 - L.w * L.w); crushed = true; }
    }
    p = fromPlane(L.f, un, L.w);
    if (stage >= 4 && tube4) openInside(p, tube4, wall);                 // 4 the first kiss
    return { p, crushed };
  };
}
// steps 5–6 on a point from basePoint (in place); returns whether step 5 crushed it
function finishFn(pose, ctx, tubeSt, stage) {
  const st = pose.st_shown && pose.st_exp > 0, live = (pose.bA_inf || 0) > 0, wall = wallOf(wallPose6(pose), ctx);
  return (p) => {
    let crushed = false;
    if (stage >= 5 && (st || live) && !isTap(pose)) {                    // 5 re-crush by the LAD stent
      const M = inPlane(p), S2 = Math.max(st ? stentRadius(M.u, Math.atan2(M.w, M.un), pose) : 0, live ? mvBalloonRadius(M.u, pose) : 0);
      if (S2 > 0 && Math.abs(M.w) < S2 + PUSHED) {                        // inside S₂ + 0.09 goes out to it
        const c2 = Math.sqrt(Math.max(0, (S2 + PUSHED) ** 2 - M.w * M.w));
        if (M.un < c2 - 1e-9 && Math.hypot(M.un, M.w) < S2 + PUSHED) { const q = fromPlane(M.f, c2, M.w); p[0] = q[0]; p[1] = q[1]; p[2] = q[2]; crushed = true; }
      }
    }
    if (stage >= 6 && tubeSt && !isTap(pose)) openInside(p, tubeSt, wall);  // 6 the final kiss
    return crushed;
  };
}
function makePoint(pose, ctx, tubes, stage) {
  const base = basePoint(pose, ctx, tubes.ss, stage), fin = finishFn(pose, ctx, tubes.st, stage);
  return (th, z) => { const q = base(th, z); if (stage >= 5 && fin(q.p)) q.crushed = true; return q; };
}
// the openings that act on the D1 stent for this pose
function tubesFor(graph, pose, ctx) {
  const t = {};
  if (pose.ss_cell >= 0 && pose.ss_open > 0) t.ss = { tube: firstKissTube(pose, ctx), R: 1.25 * pose.ss_open };
  const o = stOpening(ctx.graph, pose, ctx); if (o) t.st = o;
  return t;
}

export const SB_FIELDS = ['ss_shown', 'ss_exp', 'ss_s0', 'ss_flare', 'ss_hold', 'ss_crushR', 'ss_cell', 'ss_open', 'st_shown', 'st_exp',
  'st_potR', 'st_ellip', 'st_cell', 'st_open', 'bA_kind', 'bA_dist', 'bA_inf', 'bB_kind', 'bB_dist', 'wA_route', 'v_predLAD',
  'ss_kind', 'ss_potR', 'v_diss', 'bB_wire', 'wB_route'];
// the D1 stent's length (Phase 2's 12 rings, or the culotte's whole graph)
export const sbLength = (pose) => (pose.ss_kind === 2 ? CUSTENT.len : SBSTENT.len);
const isCu = (pose) => pose.ss_kind === 2;
// on its way in, crimped on its delivery balloon (before it reaches its place), the stent rides the balloon's route
const mayRide = (pose) => BALLOON_IDS[pose.bB_kind] === 'stentSB' && !((pose.ss_exp || 0) > 0);
function riding(pose, ctx) {
  if (!mayRide(pose)) return null;
  if (Math.abs(pose.bB_dist - placeFor('stentSB', pose, ctx)) < 1e-6) return null;
  const w = pose.bB_wire === 2 ? 'B' : 'A', route = routePolyline(pose[`w${w}_route`], pose, ctx, w), u0 = pose.bB_dist - SBSTENT.len;
  return (th, z) => { const f = routeAt(route, u0 + z), ph = th + SBSTENT.rot, r = SBSTENT.crimpR, c = Math.cos(ph), s = Math.sin(ph);
    return { p: [0, 1, 2].map(k => f.p[k] + r * (c * f.n[k] + s * f.b[k])), crushed: false }; };
}
// The keys: steps 1–4 read the D1 stent's own fields, and the gold wire's place (only while it holds) or an inflated MV
// balloon (only before the LAD stent); steps 5–6 add the LAD stent, the routes and an inflated MV balloon. A balloon that
// slides by uninflated changes neither, so the struts are not computed again for it.
const D1_FIELDS = ['ss_shown', 'ss_exp', 'ss_s0', 'ss_flare', 'ss_hold', 'ss_crushR', 'ss_cell', 'ss_open', 'v_predLAD', 'v_predD1', 'ss_kind'];
function key4(p) {
  let k = D1_FIELDS.map(f => p[f]).join('|');
  if (holding(p)) k += `|h${p.st_shown},${p.st_exp},${p.bA_kind},${p.bA_dist},${p.bA_inf},${ladWireSide(p)}`;
  if ((isTap(p) || !(p.st_shown && p.st_exp > 0)) && p.bA_inf > 0) k += `|c${p.bA_kind},${p.bA_dist},${p.bA_inf}`;
  return k;
}
function key6(p) {
  let k = `${key4(p)}|${p.st_shown},${p.st_exp},${p.st_potR},${p.st_ellip},${p.st_cell},${p.st_open},${p.wA_route},${p.wB_route}`;
  if (p.bA_inf > 0) k += `|a${p.bA_kind},${p.bA_dist},${p.bA_inf}`;
  if (mayRide(p)) k += `|r${p.bB_kind},${p.bB_dist},${p.bB_wire},${p.wA_route}`;
  return k;
}
function stage4(graph, pose, ctx) {
  return memoKey(ctx, 'sb4', key4(pose), () => {
    const pt = basePoint(pose, ctx, tubesFor(graph, pose, ctx).ss, 4);
    return sbGraph(graph).lines.map(l => l.pts.map(([th, z]) => pt(th, z)));
  });
}
function build(graph, pose, ctx) {
  return memoKey(ctx, 'sb', key6(pose), () => {
    const g = sbGraph(graph), ride = riding(pose, ctx), lines = [], mask = [];
    if (ride) { for (const l of g.lines) { lines.push(l.pts.map(([th, z]) => ride(th, z).p)); mask.push(new Uint8Array(l.pts.length)); } return { lines, mask }; }
    const base = stage4(graph, pose, ctx), fin = finishFn(pose, ctx, tubesFor(graph, pose, ctx).st, 6);
    for (const l of base) { const out = [], m = new Uint8Array(l.length);
      l.forEach((q, k) => { const p = q.p.slice(); m[k] = fin(p) || q.crushed ? 1 : 0; out.push(p); }); lines.push(out); mask.push(m); }
    return { lines, mask };
  });
}
// every strut line of the D1 stent in local coordinates (memoised; callers only read them), and which points a crush moved
// (the culotte's D1 stent, ss_kind 2: cu-stent.js, nothing crushed)
export const sbStentLines = (graph, pose, ctx) => (isCu(pose) ? cuStentLines(graph, pose, ctx) : build(graph, pose, ctx).lines);
export const sbCrushedMask = (graph, pose, ctx) => (isCu(pose) ? sbStentLines(graph, pose, ctx).map(l => new Uint8Array(l.length)) : build(graph, pose, ctx).mask);
// a graph point through the pipeline (the sheet, Task 4)
export const sbPointFn = (graph, pose, ctx, stage = 6) => (isCu(pose) ? cuPointFn(graph, pose, ctx, stage)
  : riding(pose, ctx) || makePoint(pose, ctx, stage >= 4 ? tubesFor(graph, pose, ctx) : {}, stage));

// ── cells ──
// cells of the crushed D1 stent that lie over the D1 ostium: ≥ 10 % of the outline within D1's radius of its axis and on
// the LAD side (within the crushing surface + 0.3, or the LAD lumen before a crush), sorted by the centroid's x
export function sbCellsOverOstium(graph, pose, ctx) {
  const g = sbGraph(graph), pt = makePoint(pose, ctx, {}, 5), out = [];
  for (const c of polygonsOf(g)) {
    let n = 0, x = 0;
    for (const [th, z] of c.polygon) {
      const { p } = pt(th, z), L = inPlane(p); x += p[0];
      if (sbProj(p) > 0 && d1Dist(p) < A.SB_R && Math.hypot(L.un, L.w) <= Math.max(crushSurface(L.u, pose), A.PMV_R) + 0.3) n++;
    }
    if (n >= 0.1 * c.polygon.length) out.push({ id: c.id, pair: c.pair, x: x / c.polygon.length });
  }
  return out.sort((a, b) => a.x - b.x);
}
// proximal: of the cells over the ostium from the stent's most proximal ring pair (crushed nearest the heel, against the
// distal pair at the carina), the one whose passage is nearest D1's axis — a balloon through it then sits in D1; central:
// the cell whose centre is nearest the ostium centre along the LAD; behind: the cell whose passage is nearest the line
// from `from` to 14 mm down D1 (the one a wire through `from` meets next)
export function pickSbCell(graph, pose, ctx, which, from = null) {
  const cells = sbCellsOverOstium(graph, pose, ctx);
  if (!cells.length) return -1;
  const pass = (id) => sbCellPassage(id, graph, pose, ctx);
  const best = (list, score) => list.reduce((a, b) => (score(b) < score(a) ? b : a)).id;
  if (which === 'proximal') { const p0 = Math.min(...cells.map(c => c.pair)); return best(cells.filter(c => c.pair === p0 && pass(c.id)), (c) => d1Dist(pass(c.id).p)); }
  if (which === 'central') return best(cells, (c) => Math.abs(c.x - OSTIUM.centre[0]));
  if (which === 'behind' && from) {
    const B = sbAt(14), ahead = cells.filter(c => { const q = pass(c.id)?.p; return q && (q[0] - from[0]) * (B[0] - from[0]) + (q[1] - from[1]) * (B[1] - from[1]) + (q[2] - from[2]) * (B[2] - from[2]) > 0; });
    return ahead.length ? best(ahead, (c) => nearestOnPath(pass(c.id).p, [from, B]).d) : -1;
  }
  return -1;
}
// where a wire or balloon passes through a D1-stent cell: of the points inside it ≥ 0.25 mm from its struts (measured on
// the stent at nominal), the one nearest D1's axis, through the pipeline without the kiss openings — { p, th, z }
const passCache = new Map();
export function sbCellPassage(cell, graph, pose, ctx) {
  const key = [cell, ...SB_FIELDS.map(k => pose[k])].join('|');
  if (passCache.has(key)) return passCache.get(key);
  const P = polygonsOf(sbGraph(graph))[cell].polygon, R = SBSTENT.nomR, pt = makePoint(pose, ctx, {}, 5);
  const ths = P.map(q => q[0]), zs = P.map(q => q[1]);
  const inside = (x, y) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
  const edge = (x, y) => { let m = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
    const ax = (b[0] - a[0]) * R, ay = b[1] - a[1], px = (x - a[0]) * R, py = y - a[1];
    const t = Math.max(0, Math.min(1, (px * ax + py * ay) / (ax * ax + ay * ay || 1))); m = Math.min(m, Math.hypot(px - t * ax, py - t * ay)); } return m; };
  let best = null;
  for (let th = Math.min(...ths); th <= Math.max(...ths); th += 0.03) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.05) {
    if (!inside(th, z) || edge(th, z) < 0.25) continue;
    const { p } = pt(th, z), d = d1Dist(p);
    if (!best || d < best.d) best = { d, p, th, z };
  }
  const out = best ? { p: best.p, th: best.th + SBSTENT.rot, z: best.z } : null;
  if (passCache.size > 64) passCache.clear();
  passCache.set(key, out);
  return out;
}
// the first kiss's D1 balloon, where the kiss placed it on the rewire's route through ss_cell (before the LAD stent, so
// the opening stays where it was made): its working length as a polyline
function firstKissTube(pose, ctx) {
  return memoKey(ctx, 'kiss1', [pose.ss_cell, pose.ss_s0, pose.ss_crushR, pose.v_predLAD, pose.v_predD1, pose.ss_hold].join('|'), () => firstKissTubeOf(pose, ctx));
}
function firstKissTubeOf(pose, ctx) {
  const ref = { ...pose, wA_route: ROUTE.d1ss, st_shown: 0, st_exp: 0, st_cell: -1, st_open: 0, bA_kind: 0, bA_inf: 0,
    bB_kind: BALLOON_IDS.indexOf('kissSB'), bB_wire: 1, bB_inf: 0, ss_open: 0 };
  ref.bB_dist = placeFor('kissSB', ref, ctx);
  const b = balloonPlace(ref, 'B', ctx);
  return { path: b.path.filter((_, i) => b.s[i] >= b.s0 - 1e-9 && b.s[i] <= b.s1 + 1e-9), r: 1.25 };
}
// the tube a balloon opens through a D1-stent cell: a straight capsule from 1.2 mm on the LAD side of the passage to
// 14 mm down D1 (Phase 1's rule)
export function sbCellOpening(cell, graph, pose, ctx) {
  const X = sbCellPassage(cell, graph, { ...pose, ss_open: 0, st_open: 0 }, ctx).p, B = sbAt(14);
  const v = [B[0] - X[0], B[1] - X[1], B[2] - X[2]], vl = Math.hypot(...v);
  return { path: [[X[0] - v[0] / vl * 1.2, X[1] - v[1] / vl * 1.2, X[2] - v[2] / vl * 1.2], B], r: 1.25 };
}
