// The figure-of-8 ("fellow's stitch") in the world frame, mm. Saro: "it's a figure of 8 needle bites, but a fisherman's
// knot on top". As Kumar 2019 describes it (PMID 31636798, full text PMC6785297): a deep bite a little caudal to where the
// sheath enters the skin, passing BELOW the sheath; needle and suture crossed OVER the sheath; a superficial bite a little
// cranial to the entry, passing ABOVE the sheath — entry, exit and course make a Z — and the two free ends tied in a
// fisherman's knot over the entry point, which gives the stitch its figure-of-eight look; the knot is pushed down while
// the sheath comes out. The knot is tied as Saro ties it: cross the ends, twist one round the other three times, one end
// back through the loop, pull and bring the knot down. Bites run medial (−Z) to lateral (+Z) on this right groin; the
// sheath leaves the skin at x = 30 (the 45° tract from the venotomy on the anterior wall at x = 0).
import { W } from '../scene/world.js';
import { piece, track, arcs, TRACK_AT } from '../scene/paths.js';

export const SHEATH_R = 4.0;                                       // 24F
export const STRAND_R = 0.5;                                       // the silk as the Hands window draws it (thick, to be seen)
export const SURF = 0.5;                                           // a strand lying on the skin: its centre this far up
export const PUNCTURE = Object.freeze([30, 0, 0]);
export const VENOTOMY = Object.freeze([0, W.WALL_OUT_Y, 0]);
export const HANDS_TOP = Object.freeze({ target: [28, 2, 0], dir: [0.3, 1, 0], radius: 26 });
// a ½-circle needle, 48 mm (Alnaimi 2025): radius 15.3 mm. A bite is the part of its circle under the skin, so a deeper
// bite enters and leaves the skin farther apart.
export const NEEDLE_R = 48 / Math.PI;
// Caudal bite: 7 mm caudal of the skin entry (Kumar: 5–10 mm), 12 mm deep (Lakshmanadoss 2017: 1–1.5 cm), under the sheath
// where it rises out of the skin. Cranial bite: superficial, over the sheath where it runs under the skin (Kumar: "above
// the sheath"); the 24F sheath at 45° lies only 0–4 mm under the skin 5–10 mm cranial of its entry, so the bite is taken
// 13 mm cranial, 5 mm deep, where it clears the sheath's wall.
export const BITE = Object.freeze({ caudal: Object.freeze({ x: 37, depth: 12 }), cranial: Object.freeze({ x: 17, depth: 5 }) });

const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const norm = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };
const onSkin = (q) => [q[0], SURF, q[2]];

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

// ── the sheath ──
// the 24F sheath: 14 mm into the vein, a 9 mm stub outside the skin (no hub, so it does not hide the stitch from above);
// pulling it out slides it along the track until its tip is 4 mm out of the skin
const TRACK = track(), TL = arcs(TRACK);
export const SHEATH = Object.freeze({ inside: 14, stub: 9, pull: (TRACK_AT.hole - TRACK_AT.skin) + 14 + 4 });
export function sheathPath(p) {
  if (!p.sheathShown) return null;
  const m = (p.sheathPull || 0) * SHEATH.pull;
  return piece(TRACK, TL, TRACK_AT.skin - SHEATH.stub - m, TRACK_AT.hole + SHEATH.inside - m);
}
const segDist = (q, a, b) => { const ab = sub(b, a), t = clamp01(ab.reduce((s, v, i) => s + v * (q[i] - a[i]), 0) / (ab.reduce((s, v) => s + v * v, 0) || 1));
  return Math.hypot(...sub(q, add(a, mul(ab, t)))); };
export const distToPath = (q, P) => { let d = Infinity; for (let i = 1; i < P.length; i++) d = Math.min(d, segDist(q, P[i - 1], P[i])); return d; };

// the strand across the skin from a to b, drawn taut over the sheath if the sheath is under it: the upper hull of the
// height each point needs to clear the sheath's wall (a string pulled over a cylinder runs straight to it and over it)
const CLEAR = SHEATH_R + STRAND_R + 0.5;
function needHeight(q, S) {
  if (!S) return SURF;
  if (distToPath(onSkin(q), S) >= CLEAR) return SURF;
  let lo = SURF, hi = 40;                                    // the lowest height from which the point is clear, all the way up
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (distToPath([q[0], mid, q[2]], S) >= CLEAR) hi = mid; else lo = mid; }
  return hi;
}
export function tautAcross(a, b, S, n = 48) {
  const prof = [];
  for (let k = 0; k <= n; k++) { const t = k / n, q = lerp(a, b, t); prof.push([t, Math.max(SURF, needHeight(q, S))]); }
  prof[0][1] = prof[n][1] = SURF;
  const hull = [];                                           // upper hull, left to right
  for (const p of prof) {
    while (hull.length >= 2) { const [o, m] = hull.slice(-2); if ((m[0] - o[0]) * (p[1] - o[1]) - (m[1] - o[1]) * (p[0] - o[0]) >= 0) hull.pop(); else break; }
    hull.push(p);
  }
  const yAt = (t) => { for (let i = 1; i < hull.length; i++) if (t <= hull[i][0] + 1e-12) { const [t0, y0] = hull[i - 1], [t1, y1] = hull[i]; return y0 + (y1 - y0) * (t - t0) / ((t1 - t0) || 1); } return SURF; };
  const out = [];
  for (let k = 0; k <= n; k++) { const t = k / n, q = lerp(a, b, t); out.push([q[0], yAt(t), q[2]]); }
  return out;
}

// ── the needle ──
// a ½-circle on the bite's circle with its tip at θ (its swaged end, where the suture is, at θ − π)
const needleOn = (C, tip, off = [0, 0, 0]) => arcPts(C, tip - Math.PI, tip, 24).map((q) => add(q, off));
// a pass, f ∈ [0, 1]: the needle turns through the tissue on its own curve until its swaged end is out of the exit
// (f ≤ PASS), then it is lifted clear, away from the stitch (caudally for the caudal bite, cranially for the cranial one)
const PASS = 0.85;
const liftOf = (C) => [C.which === 'caudal' ? 6 : -6, 6, 20];          // lateral, clear of the stitch (mostly out of the top view)
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

// ── the knot: a fisherman's knot, the A end tied round the B end ──
// A is the end left at the caudal bite's entry (medial), B the end out of the cranial bite's exit (lateral), which stays
// straight; A crosses B at the knot's base, twists round it (one coil per twist), and goes back down through the loop.
// Loose it sits above the skin, cranial of the sheath; pulled down it slides along B to the skin over the puncture.
export const KNOT = Object.freeze({
  loose: Object.freeze({ base: [24, 9, 0], up: [-0.3, 1, 0], r: 2.2, pitch: 2.0, h0: 1.4 }),
  snug: Object.freeze({ base: [30, SURF + 0.1, 0], up: [0, 1, 0], r: 1.05, pitch: 1.05, h0: 0.7 }),
  onSheath: Object.freeze({ base: [21.5, SURF + 0.1, 0], up: [0, 1, 0], r: 1.05, pitch: 1.05, h0: 0.7 }),
});
export function knotFrame(p) {
  const L = KNOT.loose, S = p.cinchOnSheath ? KNOT.onSheath : KNOT.snug, t = clamp01(p.down || 0);
  const u = norm(lerp(L.up, S.up, t)), v = [0, 0, 1], w = norm(cross(u, v));
  return { base: lerp(L.base, S.base, t), u, v, w, r: L.r + (S.r - L.r) * t, pitch: L.pitch + (S.pitch - L.pitch) * t, h0: L.h0 + (S.h0 - L.h0) * t };
}
export const knotAt = (p) => knotFrame(p).base;
const radial = (F, th) => add(mul(F.v, Math.cos(th)), mul(F.w, Math.sin(th)));
const TH0 = Math.PI / 2;                                    // the first coil starts on the +w side, where A crossed B
// the fisherman's knot, A's side: from A's free end to where A leaves the skin; wraps: coils so far (fractional while one
// forms); tuck: how far the end has gone back through the loop
function knotA(F, wraps, tuck, exitA) {
  const rise = add(exitA, [0, 3 * clamp01((F.base[1] - SURF) / 8), 0]);        // lifted toward the knot; flat once it is down
  const Pa = add(F.base, add(mul(F.v, -(F.r + 0.8)), mul(F.u, 0.2)));              // A comes in from the medial side …
  const Pc = add(F.base, add(mul(F.w, 0.9), mul(F.u, 0.35)));                      // … and crosses in front of B
  const coils = [];
  const n = Math.max(1, Math.ceil(wraps * 24));
  for (let k = 0; k <= n; k++) { const t = wraps * k / n, th = TH0 + 2 * Math.PI * t;
    coils.push(add(add(F.base, mul(F.u, F.h0 + F.pitch * t)), mul(radial(F, th), F.r))); }
  const end = coils[coils.length - 1], thEnd = TH0 + 2 * Math.PI * wraps;
  // held up and out, or tucked: down outside the coils, through the loop below them, out the far side and up
  const free = [add(end, mul(F.u, 3)), add(add(F.base, mul(F.u, F.h0 + F.pitch * wraps + 12)), mul(radial(F, thEnd), 5))];
  const loop = add(F.base, add(mul(F.u, 0.3), add(mul(sub(Pa, F.base), 0.35), mul(sub(Pc, F.base), 0.35))));
  const tucked = [add(add(F.base, mul(F.u, F.h0 * 0.6)), mul(radial(F, thEnd), F.r + 0.9)), loop,
    add(F.base, add(mul(F.u, 0.15), mul(F.v, -(F.r + 2.2)))), add(F.base, add(mul(F.u, 10), add(mul(F.v, -6), mul(F.w, -2))))];
  const lead = morph(free, tucked, tuck);
  return { pts: [...lead.slice().reverse(), ...coils.slice().reverse(), Pc, Pa, rise, onSkin(exitA)], coils, loop, lead };
}
// B's side: from where B leaves the skin, straight up through the coils to B's free end, held up
function knotB(F, exitB) {
  const rise = add(exitB, [0, 3 * clamp01((F.base[1] - SURF) / 8), 0]);
  return [onSkin(exitB), rise, add(F.base, mul(F.u, -0.3)), add(F.base, mul(F.u, F.h0 + 3 * F.pitch + 3)), add(add(F.base, mul(F.u, 22)), mul(F.v, -2))];
}
// two polylines blended point for point (each resampled to the same count by arc length)
function resample(P, n) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...sub(P[i], P[i - 1])));
  const T = L[L.length - 1] || 1, out = [];
  for (let k = 0; k < n; k++) { const s = T * k / (n - 1); let i = 1; while (i < L.length - 1 && L[i] < s) i++;
    const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); out.push(lerp(P[i - 1], P[i], clamp01(t))); }
  return out;
}
function morph(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const n = Math.max(a.length, b.length, 24), A = resample(a, n), B = resample(b, n);
  return A.map((q, i) => lerp(q, B[i], t));
}

// ── the whole stitch for a pose ──
// pose: stitch 0…3 (0–1 the caudal bite, 1–2 across the sheath, 2–3 the cranial bite), needleOn, cross 0…1 (the ends
// crossed), wraps 0…3, tuck 0…1, down 0…1 (the knot slid down), gather, sheathShown, sheathPull, bite depths, cinchOnSheath
// → { strand: one polyline from A's free end to B's free end (or the needle), buried: the parts under the skin, needle,
//     knot: { base, coils, loop } | null }
export function stitchPaths(p) {
  const s = p.stitch || 0;
  if (s <= 0) return { strand: null, buried: [], needle: null, knot: null };
  const g = p.gather || 0, C1 = biteCircle('caudal', p.bite1Depth ?? BITE.caudal.depth, g), C2 = biteCircle('cranial', p.bite2Depth ?? BITE.cranial.depth, g);
  const S = sheathPath(p);
  const e1 = C1.at(-C1.t0), x1 = C1.at(C1.t0), e2 = C2.at(-C2.t0), x2 = C2.at(C2.t0);
  const restA = [[e1[0] + 10, SURF, e1[2] - 20], onSkin(e1)];   // A's tail, left lying on the skin caudal-medially
  const buried = [];
  let needle = null, strandA, mid, strandB = [];
  if (s < 1) {                                               // the caudal bite, being taken
    const P = passOf(C1, s); if (P.buried.length) buried.push(P.buried);
    return { strand: [restA[0], ...P.thread], buried, needle: P.needle, knot: null };
  }
  buried.push(arcPts(C1, -C1.t0, C1.t0, 30));
  const across = tautAcross(onSkin(x1), onSkin(e2), S);
  const rest1 = passOf(C1, 1).needle, poised2 = poised(C2);
  if (s < 2) {                                               // carried across over the sheath
    const f = s - 1, k = Math.max(1, Math.round(f * (across.length - 1)));
    const nd = rest1.map((q, i) => add(lerp(q, poised2[i], smoothstep(f)), [0, 8 * Math.sin(Math.PI * f), 0]));
    return { strand: [restA[0], onSkin(e1), ...arcPts(C1, -C1.t0, C1.t0, 30), onSkin(x1), ...across.slice(1, k + 1), nd[0]], buried, needle: nd, knot: null };
  }
  mid = [...arcPts(C1, -C1.t0, C1.t0, 30), ...across, ...arcPts(C2, -C2.t0, C2.t0, 30)];
  if (s < 3) {                                               // the cranial bite, being taken
    const P = passOf(C2, s - 2); if (P.buried.length) buried.push(P.buried);
    return { strand: [restA[0], onSkin(e1), ...arcPts(C1, -C1.t0, C1.t0, 30), ...across, ...P.thread.slice(1)], buried, needle: P.needle, knot: null };
  }
  buried.push(arcPts(C2, -C2.t0, C2.t0, 30));
  // both bites taken: the needle lifted clear on B, until it is cut off; then the knot
  const restNeedle = passOf(C2, 1).needle, restB = [onSkin(x2), restNeedle[0]];
  const cross = Math.min(1, Math.max(0, p.cross || 0));
  if (cross <= 0) {
    strandA = restA; strandB = restB;
    if ((p.needleOn ?? 1) >= 0.5) needle = restNeedle;
    return { strand: [...strandA, ...mid, ...strandB], buried, needle, knot: null };
  }
  const F = knotFrame(p), K = knotA(F, cross < 1 ? 0 : Math.max(0, p.wraps || 0), cross < 1 ? 0 : Math.max(0, p.tuck || 0), e1);
  const KB = knotB(F, x2);
  strandA = morph(restA, K.pts, cross); strandB = morph(restB, KB, cross);
  if ((p.needleOn ?? 1) >= 0.5) needle = restNeedle.map((q) => add(q, sub(strandB[strandB.length - 1], restB[1])));
  return { strand: [...strandA, ...mid, ...strandB], buried, needle,
    knot: cross >= 1 ? { base: F.base, u: F.u, r: F.r, coils: K.coils, loop: K.loop, lead: K.lead, wraps: p.wraps || 0 } : null };
}
