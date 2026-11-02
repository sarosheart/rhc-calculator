// The LAD stent: the Blender strut graph (bifurcation/models/stent.glb) wrapped onto the stent's current shape.
// A graph point (θ, z) sits at u = u0 + z on the stent's axis — the LAD route of the wire it rides (wire B), which an
// expanded stent pulls onto the LAD axis — at the radius the pose gives that point: crimped 0.55 → nominal 1.5 as it
// deploys, the POT's 1.875 over the POT balloon's working length (proximal of the carina by ≥ 1 mm, tapering over its
// shoulder and toward the carina), an ellipse (major axis in the bifurcation plane) where the kissing balloons overlap (from
// their proximal ends to the carina), and
// the side cell the kiss opened: every point inside the SB balloon's tube pushed out to its surface.
import { A, axis, CARINA, OSTIUM } from '../scene/anatomy.js';
import { STENT, SIDE, KISS_PROX_X, BALLOON_IDS } from './kinds.js';
import { ladPath, ladRoute, ladFrameAt, stentU0 } from './paths.js';

const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const SB = axis('sb').dir;
const sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];

export { STENT };
export function readGraph(scene) {
  let root = scene.getObjectByName ? scene.getObjectByName('Stent') : null;
  if (!root) scene.traverse?.((o) => { if (!root && o.userData?.graph_json) root = o; });
  return JSON.parse(root.userData.graph_json);
}

// the share of the POT's post-dilation at x: 1 over its working length, tapering over its shoulder and toward the carina
// (the D1 stent's crushed metal follows the same field, sb-stent.js)
export function potWeight(x) {
  const cx = CARINA.cutX;
  return smoothstep((x - (cx - 9.5)) / 1.5) * (1 - smoothstep(x - (cx - 1)));
}
// the radius the pose holds the stent at, at u and θ about its axis
export function stentRadius(u, th, pose) {
  const e = pose.st_exp || 0;
  let r = STENT.crimpR + (STENT.nomR - STENT.crimpR) * e;
  if (e <= 0) return r;
  const x = ladPath(u).p[0], cx = CARINA.cutX;
  r += ((pose.st_potR || STENT.nomR) - STENT.nomR) * potWeight(x) * e;
  const ell = pose.st_ellip || 1;
  if (ell !== 1) {
    const w = smoothstep((x - (KISS_PROX_X - 1.5)) / 1.5) * (1 - smoothstep((x - cx) / 0.5)), q = 1 + (ell - 1) * w;
    const a = Math.sqrt(q), b = 1 / Math.sqrt(q);
    r *= a * b / Math.hypot(b * Math.cos(th), a * Math.sin(th));
  }
  return r;
}
// the stent's axis for this pose (the LAD route of the wire it rides: gold, or teal in the culotte; once it is open it holds
// that wire on the LAD's axis, so the side matters only while it is crimped)
const stentSide = (pose) => (BALLOON_IDS[pose.bA_kind] === 'stentLAD' && pose.bA_wire === 1 ? SIDE.A : SIDE.B);
export const stentAxis = (pose, ctx) => ladRoute(pose, ctx, stentSide(pose));
export const axisFrame = (axisRoute, u, pose) => ladFrameAt(axisRoute, u, pose, stentSide(pose));
function wrapOn(axisRoute, u0, th, z, pose) {
  const ph = th + STENT.rot, u = u0 + z, f = axisFrame(axisRoute, u, pose), r = stentRadius(u, ph, pose), c = Math.cos(ph), s = Math.sin(ph);
  return [f.p[0] + r * (c * f.n[0] + s * f.b[0]), f.p[1] + r * (c * f.n[1] + s * f.b[1]), f.p[2] + r * (c * f.n[2] + s * f.b[2])];
}

// the first `rings` rings of a graph, with the links and cells between them (the D1 stent: kinds.js SBSTENT)
export function subGraph(graph, rings) {
  let i = 0;
  const lines = graph.lines.filter(l => (l.kind === 'ring' ? i++ < rings : l.pair < rings - 1));
  return { ...graph, rings, length: (rings - 1) * graph.pitch + graph.ringH, lines, cells: graph.cells.filter(c => c.pair < rings - 1) };
}

// ── cells ──
// each cell's outline in graph coordinates (θ, z): the ring pair's distal side from one connector to the next, then the
// next ring's proximal side back
export function polygonsOf(graph) {
  if (graph._polygons) return graph._polygons;
  const rings = graph.lines.filter(l => l.kind === 'ring');
  const out = graph.cells.map((c, id) => {
    const ra = rings[c.pair].pts, rb = rings[c.pair + 1].pts, n = ra.length - 1;
    const a = c.th0, b = c.th1 > c.th0 ? c.th1 : c.th1 + 2 * Math.PI;
    const side = (pts) => { const o = []; for (let k = 0; k <= 2 * n; k++) { const i = k % n, th = pts[i][0] + Math.floor(k / n) * 2 * Math.PI;
      if (th >= a - 1e-9 && th <= b + 1e-9) o.push([th, pts[i][1]]); } return o; };
    const polygon = [...side(ra), ...side(rb).reverse()];
    return { id, pair: c.pair, polygon, th: polygon.reduce((s, p) => s + p[0], 0) / polygon.length, z: polygon.reduce((s, p) => s + p[1], 0) / polygon.length };
  });
  Object.defineProperty(graph, '_polygons', { value: out, enumerable: false });
  return out;
}
export function cellsOf(graph) {
  if (graph._cells) return graph._cells;
  const cells = polygonsOf(graph).map(({ id, pair, polygon, th: cth, z: cz }) => {
    return {
      id, pair, polygon, th: cth, z: cz,
      centroid(pose, ctx) { return wrapOn(stentAxis(pose, ctx), stentU0(pose), cth, cz, pose); },
      // at least a tenth of the cell's outline lies over the D1 ostium (within D1's radius of its axis, on the D1 side): the
      // cells in front of it here are 14 (proximal), 15 and 17 (central, either side of a connector) and 20 (distal, at the carina)
      facesOstium(pose, ctx) {
        const ax = stentAxis(pose, ctx), u0 = stentU0(pose);
        let n = 0;
        for (const [th, z] of polygon) { const p = wrapOn(ax, u0, th, z, pose), s = sbProj(p);
          if (s > 0 && p[1] > 0 && Math.hypot(p[0] - SB[0] * s, p[1] - SB[1] * s, p[2]) < A.SB_R) n++; }
        return n >= 0.1 * polygon.length;
      },
    };
  });
  Object.defineProperty(graph, '_cells', { value: cells, enumerable: false });
  return cells;
}
// the distal cell: of the cells over the D1 ostium, the one whose centre is nearest the carina
export function distalCell(graph, pose, ctx) {
  let best = -1, bd = Infinity;
  for (const c of cellsOf(graph)) {
    if (!c.facesOstium(pose, ctx)) continue;
    const p = c.centroid(pose, ctx), d = Math.hypot(p[0] - CARINA.tip[0], p[1] - CARINA.tip[1], p[2] - CARINA.tip[2]);
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}
// a named cell over the ostium: 'distal' (Phase 1's), or 'central' — of the cells facing the ostium, the one whose centre
// along the LAD is nearest the ostium centre's
export function pickCell(graph, pose, ctx, which) {
  if (which === 'distal') return distalCell(graph, pose, ctx);
  let best = -1, bd = Infinity;
  for (const c of cellsOf(graph)) {
    if (!c.facesOstium(pose, ctx)) continue;
    const d = Math.abs(c.centroid(pose, ctx)[0] - OSTIUM.centre[0]);
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}
// where a wire or balloon going to D1 passes through a cell: of the points inside the cell at least 0.25 mm from its
// struts, the one nearest D1's axis — { p (3D), th, z }
const passCache = new Map();
export function cellPassage(cell, graph, pose, ctx) {
  const key = `${cell}|${(pose.st_exp || 0).toFixed(3)}|${(pose.st_potR || 1.5).toFixed(3)}|${(pose.st_ellip || 1).toFixed(3)}`;
  if (passCache.has(key)) return passCache.get(key);
  const c = cellsOf(graph)[cell], P = c.polygon, R = STENT.nomR, ax = stentAxis(pose, ctx), u0 = stentU0(pose);
  const ths = P.map(q => q[0]), zs = P.map(q => q[1]);
  const inside = (x, y) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
  const edge = (x, y) => { let m = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
    const ax_ = (b[0] - a[0]) * R, ay = b[1] - a[1], px = (x - a[0]) * R, py = y - a[1];
    const t = Math.max(0, Math.min(1, (px * ax_ + py * ay) / (ax_ * ax_ + ay * ay || 1))); m = Math.min(m, Math.hypot(px - t * ax_, py - t * ay)); } return m; };
  let best = null;
  for (let th = Math.min(...ths); th <= Math.max(...ths); th += 0.02) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.05) {
    if (!inside(th, z) || edge(th, z) < 0.25) continue;
    const p = wrapOn(ax, u0, th, z, pose), s = sbProj(p), d = Math.hypot(p[0] - SB[0] * s, p[1] - SB[1] * s, p[2]);
    if (!best || d < best.d) best = { d, p, th, z };
  }
  // th: the passage's angle about the stent's axis in the vessel (the graph's angle turned by the stent's rotation)
  const out = best ? { p: best.p, th: best.th + STENT.rot, z: best.z } : { p: c.centroid(pose, ctx), th: c.th + STENT.rot, z: c.z };
  if (passCache.size > 64) passCache.clear();
  passCache.set(key, out);
  return out;
}
// the tube the SB balloon opens through a cell: a straight capsule from just inside the stent, through the cell's passage,
// to 14 mm down D1. Straight, so every point has one nearest point on it and no strut is torn across the opening; its axis
// meets the stent only at the passage, inside the cell.
export function sbOpening(cell, graph, pose, ctx) {
  const X = cellPassage(cell, graph, { ...pose, st_open: 0 }, ctx).p, B = [SB[0] * 14, SB[1] * 14, 0];
  const v = [B[0] - X[0], B[1] - X[1], B[2] - X[2]], vl = Math.hypot(...v);
  return { path: [[X[0] - v[0] / vl * 1.2, X[1] - v[1] / vl * 1.2, X[2] - v[2] / vl * 1.2], B], r: 1.25 };
}
export function nearestOnPath(p, path) {
  let best = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    const q = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (!best || d < best.d) best = { q, d, ab };
  }
  return best;
}

// a balloon's opening through a cell: every point inside the tube (radius R) goes out to its surface; true if it moved
export function openPoint(p, tube, R) {
  const nb = nearestOnPath(p, tube.path);
  if (nb.d >= R) return false;
  let v = [p[0] - nb.q[0], p[1] - nb.q[1], p[2] - nb.q[2]], vl = Math.hypot(...v);
  if (vl < 1e-6) { const al = Math.hypot(...nb.ab); v = [-nb.ab[1] / al, nb.ab[0] / al, 0]; vl = 1; }
  for (let c = 0; c < 3; c++) p[c] = nb.q[c] + v[c] / vl * R;
  return true;
}
// the kiss's opening through the LAD stent's cell st_cell (it acts on both stents): { tube, R } or null
export function stOpening(graph, pose, ctx) {
  return pose.st_cell >= 0 && pose.st_open > 0 ? { tube: sbOpening(pose.st_cell, graph, pose, ctx), R: 1.25 * pose.st_open } : null;
}

// a small memo per ctx: the last few poses' lines, keyed on every pose field the lines read (cut and fluoro draw the same
// pose; a tween changes a field every frame, so an old entry is never served for a new pose)
export const memo = (ctx, name, fields, pose, make) => memoKey(ctx, name, fields.map(k => pose[k]).join('|'), make);
export function memoKey(ctx, name, key, make) {
  let m = ctx[`_memo_${name}`];
  if (!m) { m = new Map(); Object.defineProperty(ctx, `_memo_${name}`, { value: m, enumerable: false }); }
  if (m.has(key)) return m.get(key);
  const v = make();
  if (m.size >= 8) m.delete(m.keys().next().value);
  m.set(key, v);
  return v;
}
export const MV_FIELDS = ['st_shown', 'st_exp', 'st_potR', 'st_ellip', 'st_cell', 'st_open', 'bA_kind', 'bA_dist', 'bA_inf', 'v_predLAD'];
// the lines' key: the LAD stent's fields and the predilation; an MV balloon only while it is inflated (it holds the wire the
// stent's axis follows) or carries the stent (stentU0) — one sliding past uninflated changes nothing
const mvKey = (p) => [p.st_shown, p.st_exp, p.st_potR, p.st_ellip, p.st_cell, p.st_open, p.v_predLAD,
  ...(p.bA_inf > 0 || (BALLOON_IDS[p.bA_kind] === 'stentLAD' && p.st_exp < 0.999) ? [p.bA_kind, p.bA_dist, p.bA_inf, p.bA_wire] : [])].join('|');
// a graph point (θ, z) of the LAD stent for this pose: stage 1 wrapped only, 6 with the kiss's opening (the sheet uses it)
export function mvPointFn(graph, pose, ctx, stage = 6) {
  const ax = stentAxis(pose, ctx), u0 = stentU0(pose), o = stage >= 6 ? stOpening(graph, pose, ctx) : null;
  return (th, z) => { const p = wrapOn(ax, u0, th, z, pose); if (o) openPoint(p, o.tube, o.R); return p; };
}
// every strut line in local coordinates for this pose (memoised; callers only read them)
export function stentLines(graph, pose, ctx) {
  return memoKey(ctx, `mv${graph === ctx.graph ? '' : '?'}`, mvKey(pose), () => {
    const ax = stentAxis(pose, ctx), u0 = stentU0(pose);
    const lines = graph.lines.map(l => l.pts.map(([th, z]) => wrapOn(ax, u0, th, z, pose)));
    const o = stOpening(graph, pose, ctx);
    if (o) for (const l of lines) for (const p of l) openPoint(p, o.tube, o.R);
    return lines;
  });
}
// a point's place about the stent's axis: u (the axis point whose cross-section plane holds the point — the inverse of the
// wrap), θ, its radius r, the stent's radius there, z along the stent and x of the axis point
export function stentFrameAt(p, pose, ctx) {
  const ax = stentAxis(pose, ctx);
  let best = null;
  for (let i = 1; i < ax.pts.length; i++) {
    const a = ax.pts[i - 1], b = ax.pts[i], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    const q = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (!best || d < best.d) best = { d, u: ax.s[i - 1] + t * (ax.s[i] - ax.s[i - 1]) };
  }
  // refine: the u whose cross-section plane holds p
  const g = (u) => { const f = axisFrame(ax, u, pose); return (p[0] - f.p[0]) * f.t[0] + (p[1] - f.p[1]) * f.t[1] + (p[2] - f.p[2]) * f.t[2]; };
  let lo = best.u - 1.5, hi = best.u + 1.5, glo = g(lo);
  if ((glo > 0) !== (g(hi) > 0)) for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2, gm = g(m); if ((gm > 0) === (glo > 0)) { lo = m; glo = gm; } else hi = m; }
  const u = (glo > 0) !== (g(hi) > 0) ? (lo + hi) / 2 : best.u;
  const f = axisFrame(ax, u, pose), v = [p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]];
  const th = Math.atan2(v[0] * f.b[0] + v[1] * f.b[1] + v[2] * f.b[2], v[0] * f.n[0] + v[1] * f.n[1] + v[2] * f.n[2]);
  return { u, th, r: Math.hypot(...v), stentR: stentRadius(u, th, pose), z: u - stentU0(pose), x: ladPath(u).p[0] };
}
// which cell contains graph coordinates (θ, z)
export function cellAt(graph, th, z) {
  for (const c of cellsOf(graph)) for (const w of [-2 * Math.PI, 0, 2 * Math.PI]) {
    const x = th + w, P = c.polygon; let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
    if (inside) return c.id;
  }
  return -1;
}
// which cell a point at angle th (about the stent's axis, in the vessel) and z along the stent lies in
export const cellAtVessel = (graph, th, z) => cellAt(graph, th - STENT.rot, z);
