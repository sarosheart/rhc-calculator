// The figure-of-8 over the puncture after a pre-close, as Saro draws it (plans/closure/research/saro_fig8_fisherman_knot.pdf;
// plans/closure/fig8_2026-11-02.md): the large venous sheath is out and both pre-close sutures are tied, but the puncture
// still oozes. Two bites, caudal then cranial, each medial to lateral, crossed over the puncture; then a fisherman's knot
// tied on the needle end (his "leading edge") with the other (his "starting edge"): three wraps, over then under, working
// away from the stitch; the end back under the needle end through the first loop, by the stitch, and back over it; then
// under its own return strand, through the big loop, and pulled; the knot set, then slid up the needle end onto the
// puncture. World frame, mm: +X caudal, +Y anterior, +Z lateral on this right groin; the skin puncture at x = 30, the
// 24F tract running cranially from it at 45° down to the venotomy at x = 0.
import { W } from '../scene/world.js';
import { skinY } from '../render/hands.js';

export const STRAND_R = 0.5;                                       // the silk as the Hands window draws it (thick, to be seen)
export const SURF = 0.5;                                           // a strand lying on the skin: its centre this far up
export const PUNCTURE = Object.freeze([30, 0, 0]);
export const VENOTOMY = Object.freeze([0, W.WALL_OUT_Y, 0]);
export const TRACT_R = 4.0;                                        // the 24F sheath's tract
export const HANDS_TOP = Object.freeze({ target: [28, 2, 0], dir: [0.3, 1, 0], radius: 26 });
// while the knot is tied, caudal to the stitch: the stitch and the knot both in view
export const HANDS_KNOT = Object.freeze({ target: [45, 5, 0], dir: [0.3, 1, 0], radius: 27 });
// near the end the strands crowd together, so the camera closes in on them (Saro: "zoomed up towards the crowded
// components near the end"): on the knot while the end threads back through it and it is set, then on the puncture
export const HANDS_TIE = Object.freeze({ target: [54, 8, -0.5], dir: [0.3, 1, 0], radius: 11 });
export const HANDS_DOWN = Object.freeze({ target: [30.5, 3.5, 0], dir: [0.3, 1, 0], radius: 10 });
// a ½-circle needle, 48 mm (Alnaimi 2025): radius 15.3 mm. A bite is the part of its circle under the skin, so a deeper
// bite enters and leaves the skin farther apart.
export const NEEDLE_R = 48 / Math.PI;
// The two bites 7 mm either side of the puncture (Kumar 2019: 5–10 mm), at one depth (the drawing's two bites are alike),
// 14 mm (Lakshmanadoss 2017: 1–1.5 cm): 7 mm cranial of the puncture the tract's lower wall is 12.7 mm deep, so a bite there
// passes under the tract, not through it.
export const BITE = Object.freeze({ caudal: Object.freeze({ x: 37, depth: 14 }), cranial: Object.freeze({ x: 23, depth: 14 }) });

const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const norm = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };
// a point lying on the skin (the groin's gentle dome), the strand's centre SURF above it
export const onSkin = (q) => [q[0], skinY(q[0], q[2]) + SURF, q[2]];

// ── the bites ──
// a bite's circle, in the plane x = const: centre (x, cy, 0), radius R; point(θ) = [x, cy − R cos θ, R sin θ], θ = 0 at
// the deepest point; the arc under the skin runs θ ∈ [−t0, t0], medial entry to lateral exit. Tying gathers it: the bites
// move toward the puncture, shallower and narrower.
export function biteCircle(which, depth = BITE[which].depth, gather = 0) {
  const d0 = depth;
  let R = NEEDLE_R, half = d0 <= R ? Math.sqrt(2 * R * d0 - d0 * d0) : R;
  if (d0 > NEEDLE_R) R = (half * half + d0 * d0) / (2 * d0);       // deeper than the needle can reach: a wider arc (a mistake)
  const d = d0 * (1 - 0.15 * gather), h = half * (1 - 0.3 * gather);
  if (gather > 0) R = (h * h + d * d) / (2 * d);
  const cy = R - d, t0 = Math.acos(Math.max(-1, Math.min(1, cy / R)));
  const x = BITE[which].x + (which === 'caudal' ? -1 : 1) * 2.5 * gather;
  return { which, x, cy, R, t0, depth: d, at: (t) => [x, cy - R * Math.cos(t), R * Math.sin(t)] };
}
const arcPts = (C, a, b, n = 40) => { const out = []; for (let k = 0; k <= n; k++) out.push(C.at(a + (b - a) * k / n)); return out; };
export const bitePath = (which, depth = BITE[which].depth, gather = 0) => { const C = biteCircle(which, depth, gather); return arcPts(C, -C.t0, C.t0); };

// is the screen's right medial in the top view? (camera above and caudal, world up +Y)
export function screenRightIsMedial() {
  const n = Math.hypot(...HANDS_TOP.dir), f = HANDS_TOP.dir.map((v) => -v / n), up = [0, 1, 0];
  const right = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  return right[2] < 0;                                     // −Z is medial on a right groin
}
// the tract the sheath left: its axis from the skin puncture to the venotomy
export const tractAxis = () => [PUNCTURE, VENOTOMY];
const segDist = (q, a, b) => { const ab = sub(b, a), t = clamp01(dot(ab, sub(q, a)) / (dot(ab, ab) || 1)); return Math.hypot(...sub(q, add(a, mul(ab, t)))); };
export const distToPath = (q, P) => { let d = Infinity; for (let i = 1; i < P.length; i++) d = Math.min(d, segDist(q, P[i - 1], P[i])); return d; };

// ── smooth curves ──
// cubic Hermite from a (leaving along ta) to b (arriving along tb), tangents scaled by the chord × k; n points after a
function hermite(a, ta, b, tb, n = 16, k = 1) {
  const L = Math.hypot(...sub(b, a)) * k, A = mul(norm(ta), L), B = mul(norm(tb), L), out = [];
  for (let i = 1; i <= n; i++) { const t = i / n, t2 = t * t, t3 = t2 * t;
    out.push(add(add(mul(a, 2 * t3 - 3 * t2 + 1), mul(A, t3 - 2 * t2 + t)), add(mul(b, -2 * t3 + 3 * t2), mul(B, t3 - t2)))); }
  return out;
}

// ── the needle ──
// a ½-circle on the bite's circle with its tip at θ (its swaged end, where the suture is, at θ − π)
const needleOn = (C, tip, off = [0, 0, 0]) => arcPts(C, tip - Math.PI, tip, 24).map((q) => add(q, off));
// a pass, f ∈ [0, 1]: the needle turns through the tissue on its own curve until its swaged end is out of the exit
// (f ≤ PASS), then it is lifted clear: after the caudal bite laterally (out of the top view's way), after the cranial bite
// cranially and medially, where the drawing leaves it (step 1)
const PASS = 0.85;
const liftOf = (C) => (C.which === 'caudal' ? [6, 6, 20] : [-12, 8, -8]);
function passOf(C, f) {
  const turn = Math.min(1, f / PASS), tip = -C.t0 + turn * (2 * C.t0 + Math.PI), tail = tip - Math.PI;
  const off = mul(liftOf(C), smoothstep((f - PASS) / (1 - PASS)));
  const needle = needleOn(C, tip, off);
  // the suture behind the swaged end: through the bite as far as the end has gone, then on to the (lifted) needle
  let thread;
  if (tail <= -C.t0) thread = [onSkin(C.at(-C.t0)), needle[0]];
  else thread = [onSkin(C.at(-C.t0)), ...arcPts(C, -C.t0, Math.min(tail, C.t0), 30), ...(tail > C.t0 ? arcPts(C, C.t0, tail, 12).slice(1) : []), needle[0]];
  const buried = tail <= -C.t0 ? [] : arcPts(C, -C.t0, Math.min(tail, C.t0), 30);
  return { needle, thread, buried };
}
// the needle poised to take the cranial bite: its point on the medial entry
const poised = (C) => needleOn(C, -C.t0);

// ── the knot ──
// Built in a frame on the needle end (B): u along B away from the stitch, v medial (the drawing's right), w over (toward
// the viewer above: B's "over" side). Held off the skin caudal to the stitch while it is tied (the drawing's steps 2–5);
// set (pulled snug on B); then slid up B onto the skin over the puncture, standing up from it.
export const KNOT = Object.freeze({
  // held: the needle end runs caudally and a little down toward the hand, square to the top view, so the wraps and passes
  // read side by side as the drawing has them (tilted up toward the camera, each wrap hid half the next)
  held: Object.freeze({ base: [50, 9, 0], u: [1, -0.2, 0], r: 2.4, pitch: 2.6, h0: 1.8 }),
  set: Object.freeze({ r: 1.15, pitch: 1.15, h0: 1.1 }),
  // down on the puncture, where the stitch's diagonal lies on the skin: the knot sits on it, its base a strand's width up
  down: Object.freeze({ base: [30, 2.4, 0], u: [0.45, 1, 0] }),
});
export function knotFrame(p) {
  // (p.down is already eased by the animator: eased again here the knot crept, rushed, then crept, out of step with the
  // bites gathering under it)
  const H = KNOT.held, S = KNOT.set, D = KNOT.down, s = clamp01(p.set || 0), t = clamp01(p.down || 0);
  const u = norm(lerp(norm(H.u), norm(D.u), t)), v = [0, 0, -1], w = cross(u, v);
  return { base: lerp(H.base, D.base, t), u, v, w, r: H.r + (S.r - H.r) * s, pitch: H.pitch + (S.pitch - H.pitch) * s, h0: H.h0 + (S.h0 - H.h0) * s, set: s };
}
export const knotAt = (p) => knotFrame(p).base;
// a point in the frame: a along v (medial), b along w (over), h along u
const at = (F, a, b, h) => add(F.base, add(add(mul(F.v, a), mul(F.w, b)), mul(F.u, h)));
const radial = (F, phi) => add(mul(F.v, Math.cos(phi)), mul(F.w, Math.sin(phi)));
// a wrap: φ from 0 at +v (the drawing's right) over B (+w, φ = π/2) to the left, under B and back — one wrap per 2π, each
// a pitch farther from the stitch
const coil = (F, phi) => add(add(F.base, mul(F.u, F.h0 + F.pitch * phi / (2 * Math.PI))), mul(radial(F, phi), F.r));

// The end's route through the two passes, from the third wrap's end (each point [along v, along w, along u], sized by the
// coil radius r so the passes tighten with it): back up the right side outside the coils (the return strand) to the top,
// over the incoming starting end; down between it and B — the first loop, nearest the stitch — and under B to the left;
// round and back over B to the right, a little farther from the stitch than it went under (so the end never crosses its
// own path, as in the drawing); out over the first wrap and down between the coils and the return strand — the big loop —
// under the return strand, and out to the right, pulled (the drawing's arrow).
// Saro (2026-11-04): "this part of the figure of 8 shows the suture coming back in a really tight way … can you take a
// wider course to go thru the loop" and, for the last pass, "a wider smoother course back thru the loop". While the knot
// is held loose the route is WIDE — as his drawing has it (step 5): the end rises up the right, over the incoming end and
// round in a dome well up toward the stitch, under B, round wide on the left and back over B, then sweeps out and down
// through the big loop. Setting the knot draws it in to the TIGHT route (w = 1 − set). Same points, same crossings.
function passRoute(F) {
  const r = F.r, h0 = F.h0, p = F.pitch, w = 1 - F.set, ret = r + 2.0 + 0.2 * w, thr = r + 1.0 + 0.1 * w, gap = r + 1.1;
  const TIGHT = [
    [r + 0.4, 0.2, h0 + 3 * p + 0.25], [ret, 0.4, h0 + 2.6 * p], [ret, 0.45, h0 + 1.5 * p], [ret, 0.45, h0 + 0.3 * p],
    [ret - 0.3, 1.35, h0 - 1.6],                                                                // the top, over the incoming end
    [r + 0.2, 1.3, h0 - 1.8], [gap * 0.6, -0.1, h0 - 1.9],                                      // down into the first loop
    [0.45, -1.15, h0 - 1.85], [-1.15, -0.3, h0 - 1.6], [-0.875, 0.4, h0 - 1.325],               // under B, to the left
    [-0.6, 1.1, h0 - 1.05], [0.75, 1.2, h0 - 0.85],                                             // round and back over B
    [r, 1.5, h0 - 0.7], [thr, 1.6, h0 + 0.3],                                                   // out, before the first wrap begins
    [thr, 0.55, h0 + 0.9 * p], [thr + 0.1, -0.7, h0 + 1.15 * p],                                // down into the big loop
    [ret + 1.0, -1.05, h0 + 1.35 * p], [ret + 4.0, -0.6, h0 + 1.6 * p], [ret + 10, 0, h0 + 2.2 * p],   // under the return strand, out
  ];
  const WIDE = [
    [r + 0.6, 0.9, h0 + 3 * p + 0.45], [ret + 1.1, 0.8, h0 + 2.6 * p], [ret + 1.6, 0.5, h0 + 1.4 * p], [ret + 1.9, 0.55, h0 + 0.1 * p],   // off the last wrap in a round turn
    [ret + 1.4, 1.7, h0 - 2.3],                                                                 // rising, over the incoming end
    [r + 1.4, 1.85, h0 - 4.4], [1.5, -0.6, h0 - 5.2],                                           // the dome, up toward the stitch
    [-1.2, -1.6, h0 - 5.1], [-3.2, -1.0, h0 - 4.4], [-4.3, 0.2, h0 - 2.9],                      // under B, round wide on the left
    [-3.6, 1.1, h0 - 1.3], [1.0, 1.4, h0 - 0.9],                                                // and back over B
    [r + 0.9, 1.75, h0 - 0.4], [thr + 0.9, 1.7, h0 + 0.9],                                      // sweeping out over the first wrap
    [thr + 1.2, 0.7, h0 + 0.9 * p + 0.2], [thr + 1.8, -0.6, h0 + 1.15 * p + 0.7],               // down into the big loop
    [ret + 3.4, -1.25, h0 + 1.35 * p + 1.6], [ret + 6.4, -0.7, h0 + 1.6 * p + 2.0], [ret + 12, 0, h0 + 2.2 * p + 2.0],   // under the return strand, out
  ];
  return TIGHT.map((t, i) => at(F, ...t.map((v, k) => v + (WIDE[i][k] - v) * w)));
}
// where along the route the first pass ends (back over B, to the right) and the second begins; the first TURN of a pass
// swings the held-out end round onto the route (the two meet at the coil's end, on its right, outside the coils)
const PASS1_END = 11, TURN = 0.15;   // (route point 10, back over B: the control list starts with the coil's end)
// a polyline's length and the point at length s along it, and the polyline up to s
const lengths = (P) => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...sub(P[i], P[i - 1]))); return L; };
function upTo(P, s) {
  const L = lengths(P), out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    if (L[i] <= s) { out.push(P[i]); continue; }
    const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); out.push(lerp(P[i - 1], P[i], clamp01(t))); break;
  }
  return out;
}
// Catmull-Rom through the control points, so the route is the smooth curve the end follows (centripetal enough at this
// spacing: the points are ≥ 0.8 mm apart)
function smoothThrough(P, n = 8) {
  const out = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 1; k <= n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  return out;
}

// The starting end (A), from its entry to its free end: up off the skin (the drawing's small hook) and down to the knot on
// B's right, in to the first wrap; the wraps so far (fractional while one forms); then its end — held out, or threaded
// along the passes as far as `tuck` (0–2) has taken it. down: 0 held, 1 on the skin (the approach flattens onto it).
function strandA(F, wraps, tuck, entry, down) {
  const f = 1 - down, e = onSkin(entry), hook = add(e, [-1.6, 2.2 * f + 0.25, 0.3]);
  const pin = at(F, F.r + 1.1, 0, F.h0 - 1.4), c0 = coil(F, 0);
  const t0 = norm(lerp([-0.4, 1, 0.25], sub(pin, hook), down));
  const approach = [e, hook, ...hermite(hook, t0, pin, F.u, 14, 0.9)];
  const n = Math.max(1, Math.ceil(wraps * 36)), coils = [];
  for (let k = 0; k <= n; k++) coils.push(coil(F, 2 * Math.PI * wraps * k / n));
  // held out: before the first wrap along B on its right (the drawing's step 2); once wrapping, out from the coil (the
  // hand carries the end round B)
  const phi = 2 * Math.PI * wraps, E = coils[coils.length - 1], k = smoothstep(wraps / 0.25);
  const d = norm(add(mul(radial(F, phi), k), mul(F.u, 1 - k * 0.85)));
  // (never below the skin: carried under B, the end swings no lower than 1 mm above it)
  const above = (q) => { const floor = skinY(q[0], q[2]) + SURF + 1; return q[1] >= floor ? q : [q[0], floor, q[2]]; };
  const out = [E, ...[add(E, mul(d, 3)), add(E, mul(d, 7)), add(add(E, mul(d, 10)), mul(F.u, 1.5))].map(above)];
  let end;
  if (tuck <= 0) end = out.slice(1);
  else {
    // threaded: the end has gone along the route as far as tuck takes it (the strand behind it follows the route, so it
    // never cuts through the strand it passes)
    const R = smoothThrough([E, ...passRoute(F)]), L = lengths(R), lead = 7;
    const i1 = (PASS1_END + 1) * 8, s1 = L[Math.min(i1, L.length - 1)], s2 = L[L.length - 1];
    if (tuck < TURN) end = morph(out, upTo(R, lead), tuck / TURN).slice(1);
    else end = upTo(R, tuck <= 1 ? lead + (s1 - lead) * (tuck - TURN) / (1 - TURN) : s1 + (s2 - s1) * (tuck - 1)).slice(1);
  }
  return { pts: [...approach, c0, ...coils.slice(1), ...end], coils };
}
// The needle end (B), from its exit to the needle: up off the skin and cranially (the drawing's step 2: up, over to the
// middle), down across the stitch to the knot, straight through it and on to the needle, held up
// As the knot slides down, the needle end is the strand pulled: between its exit and the knot it straightens, and it comes
// onto the knot from the side, above the stitch's diagonal under the knot.
function strandB(F, exit, down, tail) {
  const f = 1 - down, x = onSkin(exit), rise = add(x, [-2.2, 2.4 * f + 0.2, -0.9]);
  const q = sub(F.base, mul(F.u, 1.5 - 0.7 * down)), chord = sub(q, rise), side = norm([chord[0], 0, chord[2]]);
  const taut = smoothstep(down * 1.6), t0 = norm(lerp([-1, 0.7, -0.55], chord, taut)), t1 = norm(lerp(F.u, side, 0.6 * down));
  // out of the knot the free end runs on along B while it is held; once the knot is down it is laid off caudally and
  // laterally, toward the operator, so the needle on it lies beside the knot, not across it
  const top = add(F.base, mul(F.u, F.h0 + 3 * F.pitch + 2)), out = norm(lerp(F.u, [0.8, 0.35, 0.5], down));
  return [x, rise, ...hermite(rise, t0, q, t1, 20, 1.15 - 0.75 * taut).slice(0, -1), q, F.base, top, add(top, mul(out, tail))];
}

// Where the two ends' labels sit (Saro, 2026-11-04: "show which side of the suture cinches the knot (side with needle i
// believe) and which side locks the knot (other string i believe)"): on the needle end just past the knot — the end the
// knot slides along, so pulling it runs the knot down and cinches the stitch — and on the other end out past the big loop,
// the end pulled to set it, which locks it.
export function endTags(p) {
  const F = knotFrame(p), R = passRoute(F), t = clamp01(p.down || 0);
  const top = add(F.base, mul(F.u, F.h0 + 3 * F.pitch + 2)), out = norm(lerp(F.u, [0.8, 0.35, 0.5], t));
  return { cinch: add(top, mul(out, 1.5)), lock: lerp(R[R.length - 4], R[R.length - 3], 0.6) };   // just past the return strand
}

// ── the ooze ──
// blood welling at the puncture and running a little caudally on the skin: its outline (closed polyline on the skin) for a
// given amount (1 at the start, 0 once the knot is down and the tissue gathered)
export function oozeOutline(amount) {
  const a = clamp01(amount); if (a < 0.02) return null;
  const out = [];
  for (let k = 0; k < 40; k++) {
    const th = 2 * Math.PI * k / 40, lobe = 1 + 0.18 * Math.sin(3 * th + 0.7) + 0.1 * Math.sin(5 * th + 2.1);
    const rx = (3.2 + 1.6 * Math.max(0, Math.cos(th))) * lobe * a, rz = 2.6 * lobe * a;      // longer caudally (+x)
    const q = [PUNCTURE[0] + 0.8 * a + rx * Math.cos(th), 0, PUNCTURE[2] + rz * Math.sin(th)];
    out.push([q[0], skinY(q[0], q[2]) + 0.06, q[2]]);
  }
  return out;
}

// ── the whole stitch for a pose ──
// pose: stitch 0…3 (0–1 the caudal bite, 1–2 across the puncture, 2–3 the cranial bite), needleOn, ends 0…1 (both ends
// brought down), wraps 0…3, tuck 0…2, set 0…1, down 0…1 (slid onto the puncture; the tissue gathers with it), tails 0…1
// (cut short), bite depths → { strand: one polyline from A's free end to B's free end (or the needle), buried: the parts
// under the skin, needle, knot: { base, u, r, coils, wraps } | null }
export function stitchPaths(p) {
  const s = Math.max(0, p.stitch || 0);
  const g = clamp01(p.down || 0), C1 = biteCircle('caudal', p.bite1Depth ?? BITE.caudal.depth, g), C2 = biteCircle('cranial', p.bite2Depth ?? BITE.cranial.depth, g);
  const e1 = C1.at(-C1.t0), x1 = C1.at(C1.t0), e2 = C2.at(-C2.t0), x2 = C2.at(C2.t0);
  const restA = [onSkin([e1[0] - 10, 0, e1[2] - 16]), onSkin(e1)];   // A's tail, left on the skin cranially and medially
  const buried = [];
  if (s < 1) {                                               // the caudal bite: poised at its entry (from the start, so
                                                             // nothing appears when it begins), then taken
    const P = passOf(C1, s); if (P.buried.length) buried.push(P.buried);
    return { strand: [restA[0], ...P.thread], buried, needle: P.needle, knot: null };
  }
  buried.push(arcPts(C1, -C1.t0, C1.t0, 30));
  const across = [];                                         // over the skin, the diagonal across the puncture
  for (let k = 0; k <= 48; k++) across.push(onSkin(lerp(x1, e2, k / 48)));
  const rest1 = passOf(C1, 1).needle, poised2 = poised(C2), bite1 = [restA[0], onSkin(e1), ...arcPts(C1, -C1.t0, C1.t0, 30), onSkin(x1)];
  // carried across: the suture runs from the caudal bite's exit straight up to the needle; the diagonal over the puncture
  // lies down only when the needle's swaged end goes in at the cranial bite's entry (laid along the skin ahead of the
  // needle, it doubled back over itself)
  if (s < 2) {
    const f = s - 1, nd = rest1.map((q, i) => add(lerp(q, poised2[i], f), [0, 8 * Math.sin(Math.PI * f), 0]));
    return { strand: [...bite1, nd[0]], buried, needle: nd, knot: null };
  }
  const mid = [...arcPts(C1, -C1.t0, C1.t0, 30), ...across, ...arcPts(C2, -C2.t0, C2.t0, 30)];
  if (s < 3) {                                               // the cranial bite, being taken
    const P = passOf(C2, s - 2);
    if (!P.buried.length) return { strand: [...bite1, P.needle[0]], buried, needle: P.needle, knot: null };
    buried.push(P.buried);
    return { strand: [...bite1.slice(0, -1), ...across, ...P.thread.slice(1)], buried, needle: P.needle, knot: null };
  }
  buried.push(arcPts(C2, -C2.t0, C2.t0, 30));
  const restNeedle = passOf(C2, 1).needle, restB = [onSkin(x2), restNeedle[0]];
  const ends = clamp01(p.ends || 0), needleShown = (p.needleOn ?? 1) >= 0.5;
  if (ends <= 0) return { strand: [...restA, ...mid.slice(1), ...restB.slice(1)], buried, needle: needleShown ? restNeedle : null, knot: null };
  const F = knotFrame(p), tail = 12 - 6 * clamp01(p.tails || 0);
  const A = strandA(F, ends < 1 ? 0 : Math.max(0, p.wraps || 0), ends < 1 ? 0 : Math.max(0, p.tuck || 0), e1, g);
  const B = strandB(F, x2, g, tail);
  // both ends brought down together (the drawing's step 2): each from where it lay to where it is held
  const Af = morph(restA.slice().reverse(), A.pts, ends), Bf = morph(restB, B, ends);
  const strand = [...Af.slice().reverse(), ...mid.slice(1, -1), ...Bf];
  // the needle on the needle end, carried with it, never into the skin
  let needle = null;
  if (needleShown) { needle = restNeedle.map((q) => add(q, sub(Bf[Bf.length - 1], restNeedle[0])));
    const low = Math.min(...needle.map((q) => q[1] - skinY(q[0], q[2]) - SURF)); if (low < 0) needle = needle.map((q) => add(q, [0, -low, 0])); }
  return { strand, buried, needle, a: Af, b: Bf, knot: ends >= 1 ? { base: F.base, u: F.u, v: F.v, w: F.w, r: F.r, coils: A.coils, wraps: p.wraps || 0 } : null };
}
// two polylines blended point for point (each resampled to the same count by arc length)
function resample(P, n) {
  const L = lengths(P), T = L[L.length - 1] || 1, out = [];
  for (let k = 0; k < n; k++) { const s = T * k / (n - 1); let i = 1; while (i < L.length - 1 && L[i] < s) i++;
    const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); out.push(lerp(P[i - 1], P[i], clamp01(t))); }
  return out;
}
// (t comes eased by the animator; eased again, a move stalled then rushed — and the end threading on from a morph stopped
// dead before it set off along its route)
function morph(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const n = Math.max(a.length, b.length, 24), A = resample(a, n), B = resample(b, n);
  return A.map((q, i) => lerp(q, B[i], t));
}
