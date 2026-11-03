// The two 0.014″ wires. Each follows a route from the guide tip at the left main ostium (paths.js): `lad` to the distal LAD;
// `d1` into D1 — between the stent and the wall on the pMV's D1 side once a stent is open across it (jailed), and onto the
// D1 stent's axis before its proximal end once a D1 stent is in; `d1cell` inside the LAD stent, out through its cell
// `st_cell`, into D1; `d1ss` from the LAD lumen through the crushed D1 stent's cell `ss_cell` into D1; `d1both` through
// `st_cell`, then `ss_cell` behind it. A wire is its route up to its tip (pose wX_tip, the route's own s). A route through
// cells carries `passS`, the route coordinate of its first passage.
import { A, axis, OSTIUM } from '../scene/anatomy.js';
import { ROUTE, WIRE_R, TIP_LEN, SIDE, BALLOON_IDS, BALLOONS, SHOULDER, STENT } from './kinds.js';
import { ladRoute, ladPath, treeLocal, routeAt, stentU0 } from './paths.js';
import { stentRadius, stentAxis, axisFrame, cellsOf, cellPassage } from './stent.js';
import { sbCellPassage } from './sb-stent.js';
import { ladFrameOf, sbPath, sbFrameOf, ladPoint } from './paths.js';
import { cuCellPassage, cuStentRadius, CUSTENT } from './cu-stent.js';
import { balloonPlace } from './balloon.js';

export { ROUTE, WIRE_R, TIP_LEN, routeAt };
const SB = axis('sb').dir, sbAt = (s) => [SB[0] * s, SB[1] * s, 0], sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// a wire left beside a stent (crimped on its balloon or open) lies outside it from the moment it is in, and comes to it
// over this many mm before its proximal end — not a step at the edge (fixes 2026-11-02, Saro: "the wire in the branch has
// the stent going over it. then the stent gets kicked out outside of the lumen of the stent to the outside")
const JAIL_RAMP = 4;
// a balloon on the other wire pushes this one aside (and a stent jails it), and the wire bends round it over this many mm
// either way
const BESIDE_RAMP = 4, OWN_FADE = 1.5;
// a rewire's curve through a cell starts CELL_LEAD mm before the cell along the vessel and reaches the branch's axis where
// the old path did (was 1.2 mm and a corner either side; past the cell it keeps short, so a balloon on it stays clear of
// TAP's flap at D1's ostium); through two cells (mini-crush's LAD stent and the crushed D1 stent behind it) it reaches the
// axis BOTH_EXIT mm later, as the two crossings would otherwise fold it
const CELL_LEAD = 2.5, CELL_EXIT = 0, BOTH_EXIT = 2.5;
// how far the jailed wire lies off D1's axis, toward its upper wall, mm
const JAIL_D1 = 0.4;
const D1_ROUTES = new Set([ROUTE.d1, ROUTE.d1cell, ROUTE.d1ss, ROUTE.d1both]);
// a wire bends, it does not corner: from the last point of `pts` leaving along t0, through each cell in `via` and on to `to`,
// arriving along t1, as cubic Hermite pieces (tangent at a cell: the chords either side, the outgoing one weighted
// EXIT_PULL to 1, so past the cell the wire heads for the branch's axis without overshooting it; scaled by the chord)
// sampled about every 0.25 mm; add(p) appends a point. Returns the index in pts of each cell.
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const EXIT_PULL = 2;
function curveThrough(pts, add, t0, via, to, t1, pull = EXIT_PULL) {
  const nodes = [pts[pts.length - 1], ...via, to], at = [];
  const tan = nodes.map((p, i) => (i === 0 ? unit(t0) : i === nodes.length - 1 ? unit(t1)
    : unit(unit(p.map((v, k) => v - nodes[i - 1][k])).map((v, k) => v + pull * unit(nodes[i + 1].map((w, j) => w - p[j]))[k]))));
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1], L = dist(a, b), n = Math.max(2, Math.ceil(L / 0.25));
    for (let k = 1; k <= n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      add(k === n ? b : [0, 1, 2].map((c) => a[c] * h00 + tan[i][c] * L * h10 + b[c] * h01 + tan[i + 1][c] * L * h11));
    }
    if (i < via.length) at.push(pts.length - 1);
  }
  return at;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// per pose, what a frame asks for more than once — a wire's route, a balloon's place, a wire's path — is worked out once: the
// cut window, the fluoro and the balloons all ask for them. Keyed by the pose object AND its values: a pose being built is
// written field by field (technique/pose.js places a balloon on the half-built pose), so a change of any value drops what
// was kept for it. Results are frozen: a caller that tried to change one would throw.
const memo = new WeakMap();
const valuesOf = (pose) => { let v = ''; for (const k in pose) v += pose[k] + ','; return v; };
export function perPose(pose, ctx, key, make) {
  const v = valuesOf(pose); let e = memo.get(pose);
  if (!e || e.v !== v) { e = { v, byCtx: new WeakMap() }; memo.set(pose, e); }
  let m = e.byCtx.get(ctx); if (!m) { m = new Map(); e.byCtx.set(ctx, m); }
  if (!m.has(key)) m.set(key, make());
  return m.get(key);
}
export function routePolyline(route, pose, ctx, which) {
  return perPose(pose, ctx, `r${route}${which}`, () => { const R = routeOf(route, pose, ctx, which);
    Object.freeze(R.pts); Object.freeze(R.s); return Object.freeze(R); });
}
function routeOf(route, pose, ctx, which) {
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
  const X = cuCellPassage(pose.ss_cell, ctx.graph, pose, ctx).p, ua = sbFrameOf(X).u - CELL_LEAD, out = cuRoute(pose, ctx, which, ua), { pts, s } = out;
  const add = (p) => { s.push(s[s.length - 1] + dist(p, pts[pts.length - 1])); pts.push(p); };
  // a curve from inside the stent on its path through the cell to the distal LAD's route
  const D = axis('dmv').dir, uOut = X[0] * D[0] + X[1] * D[1] + 2.5 + CELL_LEAD, lad = ladRoute(pose, ctx, SIDE[which]);
  const j = lad.s.findIndex((u) => u >= uOut);
  out.passS = s[curveThrough(pts, add, sbPath(ua).t, [X], lad.pts[j], D)[0]];
  lad.pts.forEach((p, i) => { if (i > j) add(p); });
  // the 3.0 balloon through the cell, inflated, lies on the distal LAD's axis (cu-stent.js cuOpening): it holds its wire there
  const k = BALLOON_IDS[pose.bA_kind] === 'openMV' && (pose.bA_wire === 2 ? 'B' : 'A') === which ? pose.bA_inf || 0 : 0;
  if (k > 0) {
    const a = pose.bA_dist - BALLOONS.openMV.len - SHOULDER, b = pose.bA_dist + SHOULDER;
    out.pts = pts.map((p, i) => { const w = k * smoothstep((s[i] - (a - 2)) / 2) * smoothstep((b + 2 - s[i]) / 2); if (!w) return p;
      const q = ladPath(ladFrameOf(p).u).p; return [0, 1, 2].map(c => p[c] + (q[c] - p[c]) * w); });
  }
  return out;
}
// the jailed wire: from the moment the culotte stent is in (crimped beside it, then open — and until its cell is opened toward
// the distal LAD; by then this wire is out), the wire left in the LAD runs behind it, between the stent and the wall on the
// far side of D1
const cuJailed = (pose) => isCu(pose) && !(pose.st_shown && pose.st_exp > 0) && !(pose.ss_open > 0);
function jailBehindCu(route, pose) {
  const s0 = pose.ss_s0, push = route.pts.map((p) => {
    if (p[0] < -A.WIN.pmv - 1) return null;
    const { u, f } = sbFrameOf(p);
    if (u < s0 - JAIL_RAMP || u > s0 + CUSTENT.len) return null;
    const vn = (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1], w = p[2], R = cuStentRadius(u, pose) + WIRE_R;
    if (Math.hypot(vn, w) >= R) return null;
    const to = -Math.sqrt(Math.max(0, R * R - w * w));
    if (vn <= to) return null;   // (outside already)
    const k = smoothstep((u - (s0 - JAIL_RAMP)) / JAIL_RAMP), m = (to - vn) * k;
    return { d: [f.n[0] * m, f.n[1] * m, 0], m: Math.abs(m), u };
  });
  // inside the stent's span the push is spread (one smooth bump: where it leaves the struts across the distal LAD's origin,
  // as the stent turns into D1, the wire comes off them smoothly); in front of it, point by point (spread there, the
  // stent-edge push reached ahead of the stent and out of the vessel)
  const spreadOut = spread(route.pts, route.s, push.map((p) => (p && p.u >= s0 ? p : null)), () => false);
  return { pts: route.pts.map((p, i) => (push[i] && push[i].u < s0 ? [p[0] + push[i].d[0], p[1] + push[i].d[1], p[2]]
    : push[i] || spreadOut[i] !== p ? spreadOut[i] : p)), s: route.s };
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
    const u0 = stentU0(pose), ax = pose.st_shown && !tapIn ? stentAxis(pose, ctx) : null;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ub; i++) {
      let p = lad.pts[i]; const u = lad.s[i];
      // beside the stent from the moment it is in (crimped on its balloon, then open: jailed), on the pMV's D1 side
      if (ax && u > u0 - JAIL_RAMP && u >= -A.WIN.pmv) {
        const f = ladPath(u), sa = axisFrame(ax, u, pose), rr = stentRadius(u, 0, pose) + WIRE_R;
        const jail = [sa.p[0] + sa.n[0] * rr, sa.p[1] + sa.n[1] * rr, p[2]];
        const on = (q) => (q[0] - f.p[0]) * f.n[0] + (q[1] - f.p[1]) * f.n[1];
        if (on(jail) > on(p)) { const w = smoothstep((u - (u0 - JAIL_RAMP)) / JAIL_RAMP); p = [0, 1, 2].map(c => p[c] + (jail[c] - p[c]) * w); }
      }
      add(p, u);
    }
    // a smooth bend from the pMV into D1: a quadratic curve that leaves along the pMV and arrives on D1's axis
    // jailed (the LAD stent opening over it), the wire lies off D1's axis toward its upper wall, so a wire rewired into D1
    // beside it runs alongside, not through it (it carries no balloon: nothing rides on where it is)
    const off = ax && !tapIn ? JAIL_D1 * smoothstep(pose.st_exp || 0) : 0, nS = [-SB[1], SB[0], 0];
    const inD1 = (q) => { const p = sbAt(q), k = off * smoothstep((q - sbEnd + 1) / 1.5) * smoothstep((A.WIN.sb - q) / 2); return [p[0] + nS[0] * k, p[1] + nS[1] * k, 0]; };
    const b = inD1(sbEnd);
    // the bend's first stretch still runs beside the stent: kept clear of it on the D1 side, as the jailed stretch is
    const clear = (p) => {
      if (!ax) return p;
      const u = ladFrameOf(p).u; if (u < u0 || u > u0 + STENT.len) return p;
      const sa = axisFrame(ax, u, pose), r = [p[0] - sa.p[0], p[1] - sa.p[1], p[2] - sa.p[2]];
      const rn = r[0] * sa.n[0] + r[1] * sa.n[1] + r[2] * sa.n[2], rb = r[0] * sa.b[0] + r[1] * sa.b[1] + r[2] * sa.b[2];
      const R = stentRadius(u, Math.atan2(rb, rn), pose) + WIRE_R + 0.005;
      if (rn < 0 || Math.hypot(rn, rb) >= R) return p;
      const k = Math.sqrt(Math.max(0, R * R - rb * rb)) - rn;
      return [p[0] + sa.n[0] * k, p[1] + sa.n[1] * k, p[2] + sa.n[2] * k];
    };
    curveThrough(pts, (p) => add(clear(p)), ladPath(ub).t, [], b, SB);
    for (let q = sbEnd + 0.5; q <= A.WIN.sb + 1e-9; q += 0.5) add(inD1(q));
  } else if (route === ROUTE.d1ss) {
    // from the LAD lumen through the crushed D1 stent's cell: no LAD stent in yet, so the wire comes down the LAD's centre
    const X = sbCellPassage(pose.ss_cell, ctx.graph, { ...pose, ss_open: 0, st_open: 0 }, ctx).p, uX = ladFrameOf(X).u, ua = uX - CELL_LEAD;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ua; i++) add(lad.pts[i], lad.s[i]);
    // a curve from the LAD's centre through the cell to D1's axis (no LAD stent in yet)
    const sOut = Math.max(sbProj(X) + 1.0, sbProj(OSTIUM.centre) + 0.6) + CELL_EXIT;
    out.passS = s[curveThrough(pts, add, ladPath(Math.min(ua, s[s.length - 1])).t, [X], sbAt(sOut), SB)[0]];
    for (let q2 = sOut + 0.5; q2 <= A.WIN.sb + 1e-9; q2 += 0.5) add(sbAt(q2));
  } else {
    const base = { ...pose, st_open: 0 }, X = cellPassage(pose.st_cell, ctx.graph, base, ctx);
    const ua = stentU0(pose) + X.z - CELL_LEAD;
    for (let i = 0; i < lad.pts.length && lad.s[i] <= ua; i++) add(lad.pts[i], lad.s[i]);
    // a curve from inside the stent through its cell (and the crushed D1 stent's cell behind it) to D1's axis
    const via = [X.p];
    if (route === ROUTE.d1both) via.push(sbCellPassage(pose.ss_cell, ctx.graph, { ...pose, ss_open: 0, st_open: 0 }, ctx).p);
    const both = route === ROUTE.d1both, sOut = Math.max(sbProj(via[via.length - 1]) + 1.0, sbProj(OSTIUM.centre) + 0.6) + (both ? BOTH_EXIT : CELL_EXIT);
    out.passS = s[curveThrough(pts, add, ladPath(Math.min(ua, s[s.length - 1])).t, via, sbAt(sOut), SB, both ? 1 : EXIT_PULL)[0]];
    for (let q = sOut + 0.5; q <= A.WIN.sb + 1e-9; q += 0.5) add(sbAt(q));
  }
  T.d1.pts.forEach((p, i) => { if (T.d1.s[i] > A.WIN.sb + 0.25) add(p); });
  return out;
}

// the wire as drawn: its route from the guide tip to its tip, outside the balloons on the other wire
export function wirePath(pose, which, ctx) {
  return perPose(pose, ctx, `w${which}`, () => Object.freeze(wirePathOf(pose, which, ctx)));
}
function wirePathOf(pose, which, ctx) {
  const route = pose[`w${which}_route`], tip = pose[`w${which}_tip`];
  if (!route) return [];
  const R = routePolyline(route, pose, ctx, which);
  if (!R.pts.length || tip <= R.s[0]) return [];
  const out = [];
  for (let i = 0; i < R.pts.length && R.s[i] < tip; i++) out.push(R.pts[i]);
  out.push(routeAt(R, Math.min(tip, R.s[R.s.length - 1])).p);
  return besideBalloons(out, pose, which, ctx);
}
// a balloon's reach: the box round its path grown by its widest outline (and the wire), so a point outside it is passed
// over at once — most of a wire is nowhere near a balloon (final review: the push had halved the frame rate on a phone)
function reachOf(b) {
  const r = b.spec.d * 0.5 + WIRE_R + 0.06, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const q of b.path) for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; }
  return { b, r, lo: lo.map((v) => v - r), hi: hi.map((v) => v + r) };
}
const within = (q, R) => q[0] >= R.lo[0] && q[0] <= R.hi[0] && q[1] >= R.lo[1] && q[1] <= R.hi[1] && q[2] >= R.lo[2] && q[2] <= R.hi[2];
// q's cross-section of a balloon — the foot of q on its axis — { d, c, t, s }, or null if no stretch of the axis is within
// reach: a balloon is a surface of revolution, so q is inside it when it is nearer its axis there than the outline's
// radius at that s (never by the distance to a full-width section further along: that would bulge every shoulder)
function footOn(R, q) {
  const P = R.b.path, S = R.b.s; let best = null;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], z = P[i], dx = q[0] - a[0], dy = q[1] - a[1], dz = q[2] - a[2];
    const e0 = z[0] - a[0], e1 = z[1] - a[1], e2 = z[2] - a[2], L2 = e0 * e0 + e1 * e1 + e2 * e2 || 1e-12;
    const far = R.r + Math.sqrt(L2); if (dx * dx + dy * dy + dz * dz > far * far) continue;      // this stretch is out of reach
    const t = Math.max(0, Math.min(1, (dx * e0 + dy * e1 + dz * e2) / L2));
    const c = [a[0] + e0 * t, a[1] + e1 * t, a[2] + e2 * t], d = dist(c, q);
    if (!best || d < best.d) { const L = Math.sqrt(L2); best = { d, c, t: [e0 / L, e1 / L, e2 / L], s: S[i - 1] + (S[i] - S[i - 1]) * t }; }
  }
  return best;
}

// a balloon riding the other wire, folded or inflated, pushes this wire aside: wherever the wire is not inside a balloon of
// its own (kissing balloons share the proximal LAD), it lies outside that balloon's outline, on the side of the branch it
// goes to, and bends round it over BESIDE_RAMP mm. The balloons stay where their own routes put them (balloon.js), so a
// wire carrying one is never moved inside it.
function besideBalloons(pts, pose, which, ctx) {
  const own = [], other = [];
  for (const o of ['A', 'B']) {
    const b = balloonPlace(pose, o, ctx); if (!b) continue;
    ((pose[`b${o}_wire`] === 2 ? 'B' : 'A') === which ? own : other).push(reachOf(b));
  }
  if (!other.length || pts.length < 2) return pts;
  // the side: D1 leaves the LAD on its left (anticlockwise in the plane), the LAD leaves D1 on its right, so a wire going to
  // D1 lies on a device's left, one going down the LAD on its right — fixed, never read from the local tangent (by the
  // carina the LAD's axis bows toward D1 and a local reading flips from point to point)
  const sg = D1_ROUTES.has(pose[`w${which}_route`]) ? 1 : -1;
  const inside = (q, R) => { if (!within(q, R)) return false; const f = footOn(R, q); return !!f && f.d < R.b.outerAt(f.s) + 0.05; };
  const mine = pts.map((q) => own.some((R) => inside(q, R)));        // inside its own balloon: where that balloon is
  // a wire inside the LAD stent beside a balloon that fills it is pinned between them: it goes no further out than the
  // stent's inner surface (the balloon gives round it), never out through the struts
  const ax = pose.st_shown && pose.st_exp > 0.5 ? stentAxis(pose, ctx) : null, u0 = stentU0(pose);
  const stentCap = (q) => {
    if (!ax) return Infinity;
    const u = ladFrameOf(q).u; if (u < u0 || u > u0 + STENT.len) return Infinity;
    const f = axisFrame(ax, u, pose), r = [q[0] - f.p[0], q[1] - f.p[1], q[2] - f.p[2]];
    const rn = r[0] * f.n[0] + r[1] * f.n[1] + r[2] * f.n[2], rb = r[0] * f.b[0] + r[1] * f.b[1] + r[2] * f.b[2], R = stentRadius(u, Math.atan2(rb, rn), pose);
    return Math.hypot(rn, rb) < R ? R - WIRE_R : Infinity;
  };
  const push = pts.map((q, i) => {
    if (mine[i]) return null;
    let best = null, cap = null;
    for (const Rb of other) {
      if (!within(q, Rb)) continue;
      const f = footOn(Rb, q); if (!f) continue;
      const { c, t, s } = f; if (cap === null) cap = stentCap(q);
      const R = Math.min(Rb.b.outerAt(s) + WIRE_R + 0.01, cap);
      const v0 = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], vt = v0[0] * t[0] + v0[1] * t[1] + v0[2] * t[2];
      const v = v0.map((x, k) => x - vt * t[k]);
      const nl = Math.hypot(t[1], t[0]) || 1, nb = [-t[1] / nl, t[0] / nl, 0];
      const bz = [t[1] * nb[2] - t[2] * nb[1], t[2] * nb[0] - t[0] * nb[2], t[0] * nb[1] - t[1] * nb[0]];
      const vn = v[0] * nb[0] + v[1] * nb[1], vz = v[0] * bz[0] + v[1] * bz[1] + v[2] * bz[2];
      if (Math.hypot(vn, vz) >= R) continue;
      const m = sg * Math.sqrt(R * R - vz * vz) - vn;
      if (!best || Math.abs(m) > best.m) best = { d: nb.map((x) => x * m), m: Math.abs(m) };
    }
    return best;
  });
  if (!push.some(Boolean)) return pts;
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + dist(pts[i], pts[i - 1]));
  return spread(pts, S, push, (i) => mine[i]);
}
// pushes ({ d, m } per point, or null) spread along the wire (s: each point's coordinate along it). How far: the largest push
// near each point, tapered by the distance — never less than the point's own: one smooth bump, as a stiff wire spans a
// balloon rather than hugging its shoulder. Which way: the pushes near it averaged by size and distance (a push that turns
// with a curving device turns the wire gently), lengthened where needed so the point still clears what pushed it. A point
// held (inside its own balloon) never moves, and the push fades out over OWN_FADE mm before it (kissing balloons overlap —
// the wire is where its own balloon is).
function spread(pts, S, push, held) {
  const idx = []; push.forEach((p, j) => { if (p) idx.push(j); });
  if (!idx.length) return pts;
  const heldS = S.filter((_, i) => held(i));
  // the first entry of a sorted list at or after x
  const from = (list, at, x) => { let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (at(list[m]) < x) lo = m + 1; else hi = m; } return lo; };
  return pts.map((q, i) => {
    if (held(i)) return q;
    let M = 0; const sum = [0, 0, 0];
    for (let k = from(idx, (j) => S[j], S[i] - BESIDE_RAMP); k < idx.length && S[idx[k]] <= S[i] + BESIDE_RAMP; k++) {
      const p = push[idx[k]], w = smoothstep(1 - Math.abs(S[i] - S[idx[k]]) / BESIDE_RAMP); if (w <= 0) continue;
      M = Math.max(M, p.m * w); for (let c = 0; c < 3; c++) sum[c] += p.d[c] * w;
    }
    const sl = Math.hypot(...sum); if (M <= 0 || sl < 1e-9) return q;
    const dir = sum.map((x) => x / sl);
    if (push[i]) { const own = push[i].d.map((x) => x / push[i].m), c = dir[0] * own[0] + dir[1] * own[1] + dir[2] * own[2];
      M = Math.max(M, push[i].m / Math.max(0.25, c)); }
    for (let k = from(heldS, (x) => x, S[i] - OWN_FADE); k < heldS.length && heldS[k] <= S[i] + OWN_FADE; k++) M *= smoothstep(Math.abs(S[i] - heldS[k]) / OWN_FADE);
    return [q[0] + dir[0] * M, q[1] + dir[1] * M, q[2] + dir[2] * M];
  });
}
