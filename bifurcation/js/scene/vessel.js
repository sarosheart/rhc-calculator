// The vessel: plaque, lumen and wall of the three branches as functions of the pose, and the cut-open wall mesh.
// Per branch, about its own axis (anatomy.js): plaque thickness T(s, θ) = g(s) · (c + e · (½ + ½ cos(θ − θ₀))), θ₀ the wall
// away from the flow divider. Positive remodelling [ESTIMATE]: 35 % of the plaque grows outward, so at rest the EEM sits at
// R + 0.35 T and the lumen at R − 0.65 T. A device holding the lumen at `push` compresses the plaque down to 35 % of its
// rest thickness, after which the EEM stretches. Predilation keeps 70 % of what the balloon gained (30 % recoil) [ESTIMATE].
// When the LAD stent opens across D1, the carina shifts toward D1 and narrows the ostium on its carina side, until a balloon
// through the stent's side cell opens it again (brief §D: carina shift plus plaque shift).
// The wall mesh is built once at load around the PREDILATED lumen (BASE: halfway between the 90 % slit and the stented or
// kissed lumen, so no triangle is stretched far either way) — outside the lumen, inside the outer wall, back half, inside the
// window — and deformed each frame by moving its vertices along their branch's radial direction.
import { A, BRANCHES, axis, axisDist, smin, radial, CARINA, OSTIUM } from './anatomy.js';
import { meshSurfaceSteps, run, runAsync } from './surface-nets.js';

export const WALL = A.MEDIA_T + A.ADV_T;                  // media + adventitia outside the EEM
export const BASE = Object.freeze({ v_predLAD: 1, v_predD1: 1 });   // the pose the wall mesh is built at
const OUT = 0.35, IN = 1 - OUT, FLOOR = 0.35, RECOIL_KEEP = 0.7, SHIFT = 0.45;

// eccentric plaque per branch: c concentric, e eccentric, θ₀ the thick side, the lesion's extent along s and how it ends
const PLAQUE = Object.freeze({
  pmv: { c: 0.35, e: 2.473, th0: Math.PI, g: (s) => smoothstep((s - A.LESION.pmv[0]) / 2) },   // full to the bifurcation
  dmv: { c: 0.30, e: 1.938, th0: Math.PI, g: (s) => smoothstep((A.LESION.dmv[1] - s) / 3) },   // full from the bifurcation
  sb: { c: 1.60, e: 0.262, th0: 0, g: (s) => smoothstep((A.LESION.sb[1] - s) / 3) },           // 90 %: near-concentric
});
function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
const span = (s, S) => smoothstep(s - S.from) * smoothstep(S.to - s);

// where the predilation balloons sit (the lumen they leave behind is the vessel's; balloon.js places the balloons here)
const sbS = (p) => p[0] * axis('sb').dir[0] + p[1] * axis('sb').dir[1];
const S_HEEL = sbS(OSTIUM.heel), S_OST = sbS(OSTIUM.centre);
const S_TIP_D = CARINA.tip[0] * axis('dmv').dir[0] + CARINA.tip[1] * axis('dmv').dir[1];   // the carina tip on the distal LAD's axis
const U_CUT = CARINA.cutX / Math.cos(A.DMV_DEG * Math.PI / 180);   // the LAD's u at the carina cut plane
export const PREDIL = Object.freeze({
  lad: Object.freeze({ from: U_CUT - 7.5, to: U_CUT + 7.5, r: 1.5 }),       // 3.0 × 15 NC centred on the carina cut plane (u = s)
  d1: Object.freeze({ from: S_HEEL, to: S_HEEL + 12, r: 1.0 }),            // 2.0 × 12 NC from the D1 ostium
});

// TAP's dissection (Phase 3, design §6.2: the visible reason to bail out): the first kiss tears D1's ostium and a flap of
// intima lifts off D1's back wall from 0.3 to 4.3 mm past the heel, ±60° about θ −90°, rising to 0.85 mm at its free edge
// [ESTIMATE] — on fluoro the lumen narrows under it (EBC18: dissection beyond type B, residual narrowing). Nothing goes
// behind it: a balloon inflated in D1 presses it flat (it shows as the balloon deflates), the D1 stent presses it back as it
// opens, and it never lifts into the room the D1 stent needs — its crimped (then opening) outline + 0.1 mm — so the stent
// stays in the true lumen. `held`: the lumen the wall holds at that point; with it, the lift is capped there.
export const FLAP = Object.freeze({ s0: S_HEEL + 0.3, s1: S_HEEL + 4.3, th: -Math.PI / 2, half: Math.PI / 3, lift: 0.85 });
const CRIMP_R = 0.55, NOM_R = 1.25, CLEAR = 0.1;                       // the D1 stent's (kinds.js SBSTENT), and the room
export function flapLift(s, th, pose, held = Infinity) {
  const v = pose?.v_diss || 0;
  if (!v || s < FLAP.s0 || s > FLAP.s1) return 0;
  const d = Math.abs(Math.atan2(Math.sin(th - FLAP.th), Math.cos(th - FLAP.th)));
  if (d >= FLAP.half) return 0;
  const stent = pose.ss_shown && pose.ss_kind === 1 ? pose.ss_exp || 0 : 0, press = pose.bB_kind > 0 ? pose.bB_inf || 0 : 0;
  const lift = v * (1 - stent) * (1 - press) * FLAP.lift * smoothstep((s - FLAP.s0) / (FLAP.s1 - FLAP.s0)) * smoothstep((FLAP.half - d) / 0.35);
  return Math.min(lift, Math.max(0, held - (CRIMP_R + (NOM_R - CRIMP_R) * stent + CLEAR)));
}

export function plaque(b, s, th) {
  const P = PLAQUE[b];
  return P.g(s) * (P.c + P.e * (0.5 + 0.5 * Math.cos(th - P.th0)));
}
function lumenFrom(b, s, th, T, pose, push) {
  const R = axis(b).R;
  let l = R - IN * T;
  if (pose) {
    if (b === 'sb') {
      const v = pose.v_predD1 || 0;
      if (v) l += v * RECOIL_KEEP * Math.max(0, PREDIL.d1.r - l) * span(s, PREDIL.d1);
      const shift = (pose.st_shown || 0) * (pose.st_exp || 0) * (1 - (pose.st_open || 0));
      if (shift) l -= SHIFT * shift * (1 - smoothstep((s - S_OST - 0.5) / 2.5)) * (0.5 - 0.5 * Math.cos(th));
    } else {
      const v = pose.v_predLAD || 0;
      if (v) l += v * RECOIL_KEEP * Math.max(0, PREDIL.lad.r - l) * span(s, PREDIL.lad);
      // the culotte (Phase 3): its D1 stent open across the distal LAD's origin shifts the carina toward it, until a balloon
      // through its cell opens it (the mirror of the LAD stent's shift on D1; inverted provisional's risk, EBC-WP Table 1)
      if (b === 'dmv' && pose.ss_kind === 2) {
        const sh = (pose.ss_shown || 0) * (pose.ss_exp || 0) * (1 - (pose.ss_open || 0));
        if (sh) l -= SHIFT * sh * (1 - smoothstep((s - S_TIP_D - 0.5) / 2.5)) * (0.5 + 0.5 * Math.cos(th));
      }
    }
  }
  // TAP's flap lies inside whatever holds the lumen open, until a stent presses it back (flapLift is 0 by then)
  const held = Math.max(l, push || 0, 0.05), flap = b === 'sb' && pose?.v_diss ? flapLift(s, th, pose, held) : 0;
  return Math.max(held - flap, 0.05);
}
const eemFrom = (b, T, l) => OUT * T + Math.max(axis(b).R, l + (FLOOR - OUT) * T);

export const lumenRadius = (b, s, th, pose = null, push = 0) => lumenFrom(b, s, th, plaque(b, s, th), pose, push);
export function eemRadius(b, s, th, pose = null, push = 0) {
  const T = plaque(b, s, th); return eemFrom(b, T, lumenFrom(b, s, th, T, pose, push));
}
function placeOn(b, p) {
  const { s, d } = axisDist(b, p), dir = axis(b).dir, v = [p[0] - dir[0] * s, p[1] - dir[1] * s, p[2]];
  return { s, d, th: Math.atan2(v[2], -dir[1] * v[0] + dir[0] * v[1]) };
}
export function branchLumenSDF(b, p, pose = null, pushFn = null) {
  const { s, d, th } = placeOn(b, p);
  return d - lumenRadius(b, s, th, pose, pushFn ? pushFn(b, s, th) : 0);
}
function branchEemSDF(b, p, pose, pushFn) {
  const { s, d, th } = placeOn(b, p);
  return d - eemRadius(b, s, th, pose, pushFn ? pushFn(b, s, th) : 0);
}
export const lumenSDF = (p, pose = null, pushFn = null) =>
  smin(smin(branchLumenSDF('pmv', p, pose, pushFn), branchLumenSDF('dmv', p, pose, pushFn)), branchLumenSDF('sb', p, pose, pushFn));
export const eemSDF = (p, pose = null, pushFn = null) =>
  smin(smin(branchEemSDF('pmv', p, pose, pushFn), branchEemSDF('dmv', p, pose, pushFn)), branchEemSDF('sb', p, pose, pushFn));

// minimal lumen diameter through the axis at s: min over θ of R(θ) + R(θ + π)
export function mld(b, s, pose = null, pushFn = null) {
  let m = Infinity;
  for (let k = 0; k < 36; k++) {
    const th = k * Math.PI / 36, a = lumenRadius(b, s, th, pose, pushFn ? pushFn(b, s, th) : 0);
    const c = lumenRadius(b, s, th + Math.PI, pose, pushFn ? pushFn(b, s, th + Math.PI) : 0);
    m = Math.min(m, a + c);
  }
  return m;
}

// ── the cut-open wall mesh ──
const dot2 = (p, d) => p[0] * d[0] + p[1] * d[1];
// the solid wall at rest is max of four terms (negative inside): outside the lumen, inside the outer wall, the back half, the window
function terms(p, base = BASE) {
  const L = lumenSDF(p, base), O = eemSDF(p, base) - WALL;
  const E = Math.max(axis('pmv').s0 - p[0], dot2(p, axis('dmv').dir) - axis('dmv').s1, dot2(p, axis('sb').dir) - axis('sb').s1);
  return [-L, O, p[2], E];
}
// Newton steps onto the zero set of one term
function project(p, k, base) {
  const h = 1e-3, q = p.slice();
  for (let it = 0; it < 4; it++) {
    const f = terms(q, base)[k];
    if (Math.abs(f) < 1e-5) break;
    const g = [0, 1, 2].map(c => { const a = q.slice(), b = q.slice(); a[c] += h; b[c] -= h; return (terms(a, base)[k] - terms(b, base)[k]) / (2 * h); });
    const gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2] || 1;
    for (let c = 0; c < 3; c++) q[c] -= f * g[c] / gg;
  }
  return q;
}
// { position, index, part (0 lumen · 1 outer · 2 cut face · 3 window end), depth (0 at the lumen → 1 at the outer wall),
//   eem (where the EEM falls on that 0 → 1 scale), plaque (rest thickness under a lumen vertex, mm) }
export const buildVessel = (opts) => run(buildVesselSteps(opts));
export const buildVesselAsync = (opts) => runAsync(buildVesselSteps(opts));
export function* buildVesselSteps({ step = 0.15, half = true, base = BASE } = {}) {
  const reach = 3.8;
  const ends = ['dmv', 'sb'].map(b => axis(b).dir.map(v => v * axis(b).s1));
  const box = { min: [axis('pmv').s0 - step, Math.min(-reach, ...ends.map(e => e[1] - reach)), -reach],
    max: [Math.max(...ends.map(e => e[0] + reach)), Math.max(reach, ...ends.map(e => e[1] + reach)), half ? step : reach] };
  const F = half ? (p) => Math.max(...terms(p, base)) : (p) => Math.max(...terms(p, base).filter((_, k) => k !== 2));
  const { position, index } = yield* meshSurfaceSteps(F, box, step);
  const n = position.length / 3, part = new Uint8Array(n), depth = new Float32Array(n), eem = new Float32Array(n), pl = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = [position[3 * i], position[3 * i + 1], position[3 * i + 2]];
    const t0 = terms(p, base);
    let k = 0; for (let j = 1; j < 4; j++) if ((half || j !== 2) && t0[j] > t0[k]) k = j;
    p = project(p, k, base);
    if (k === 2) p[2] = 0;
    position[3 * i] = p[0]; position[3 * i + 1] = p[1]; position[3 * i + 2] = p[2];
    part[i] = k;
    const L = lumenSDF(p, base), O = eemSDF(p, base) - WALL, E = eemSDF(p, base);
    depth[i] = k === 0 ? 0 : k === 1 ? 1 : Math.max(0, Math.min(1, L / ((L - O) || 1)));
    eem[i] = Math.max(0, Math.min(1, (L - E) / ((L - O) || 1)));
    const nb = nearestBranch(p);
    pl[i] = plaque(nb.b, nb.s, nb.th);
    if (i % 400 === 0) yield;
  }
  return { position, index, part, depth, eem, plaque: pl };
}
// the lumen as a closed solid inside the window (for the fluoro's contrast: path length needs a closed surface)
export const buildLumen = (opts) => run(buildLumenSteps(opts));
export const buildLumenAsync = (opts) => runAsync(buildLumenSteps(opts));
export function* buildLumenSteps({ step = 0.3, base = BASE } = {}) {
  const ends = ['dmv', 'sb'].map(b => axis(b).dir.map(v => v * axis(b).s1)), reach = 2.6;
  const box = { min: [axis('pmv').s0 - 2 * step, Math.min(-reach, ...ends.map(e => e[1] - reach)), -reach],
    max: [Math.max(...ends.map(e => e[0] + reach)), Math.max(reach, ...ends.map(e => e[1] + reach)), reach] };
  const F = (p) => Math.max(lumenSDF(p, base), terms(p, base)[3]);
  const { position, index } = yield* meshSurfaceSteps(F, box, step);
  return { position, index, part: new Uint8Array(position.length / 3) };
}
function nearestBranch(p) {
  let best = null;
  for (const b of BRANCHES) { const q = placeOn(b, p), g = q.d - lumenRadius(b, q.s, q.th); if (!best || g < best.g) best = { b, ...q, g }; }
  return best;
}

// ── binding and per-frame deformation ──
// Each vertex is bound to the branches whose lumen it is near (weights fall off over 0.25 mm of extra distance), with its
// s, θ and rest plaque on each, so a frame only evaluates what the pose changes.
export const bindVertices = (...a) => run(bindVerticesSteps(...a));
export const bindVerticesAsync = (...a) => runAsync(bindVerticesSteps(...a));
export function* bindVerticesSteps(position, part, depth = null, base = BASE) {
  const n = position.length / 3, B = BRANCHES.length;
  const s = new Float32Array(n * B), th = new Float32Array(n * B), w = new Float32Array(n * B), T = new Float32Array(n * B);
  const restL = new Float32Array(n * B), restE = new Float32Array(n * B), cos = new Float32Array(n * B), sin = new Float32Array(n * B);
  for (let i = 0; i < n; i++) {
    const p = [position[3 * i], position[3 * i + 1], position[3 * i + 2]], g = [];
    BRANCHES.forEach((b, j) => {
      const q = placeOn(b, p), t = plaque(b, q.s, q.th), l = lumenFrom(b, q.s, q.th, t, base, 0), k = i * B + j;
      s[k] = q.s; th[k] = q.th; T[k] = t; restL[k] = l; restE[k] = eemFrom(b, t, l); cos[k] = Math.cos(q.th); sin[k] = Math.sin(q.th);
      g.push(q.d - l);
    });
    const gm = Math.min(...g); let sum = 0;
    for (let j = 0; j < B; j++) { const v = Math.exp(-(g[j] - gm) / 0.25); w[i * B + j] = v; sum += v; }
    for (let j = 0; j < B; j++) { const k = i * B + j; w[k] = w[k] / sum < 0.01 ? 0 : w[k] / sum; }
    if (i % 800 === 0) yield;
  }
  return { n, s, th, w, T, restL, restE, cos, sin, part: part.slice(), depth: depth ? depth.slice() : null };
}
// out = rest moved by the pose: lumen vertices by the lumen's change, outer ones by the EEM's, the cut face in between
export function deformVertices(bind, rest, pose, pushFn, out) {
  const B = BRANCHES.length, dirs = BRANCHES.map(b => axis(b).dir);
  for (let i = 0; i < bind.n; i++) {
    let dx = 0, dy = 0, dz = 0;
    const pt = bind.part[i], t = pt === 0 ? 0 : pt === 1 ? 1 : (bind.depth ? bind.depth[i] : 0.5);
    for (let j = 0; j < B; j++) {
      const k = i * B + j, wk = bind.w[k];
      if (wk === 0) continue;
      const b = BRANCHES[j], s = bind.s[k], th = bind.th[k];
      const push = pushFn ? pushFn(b, s, th) : 0;
      const l = lumenFrom(b, s, th, bind.T[k], pose, push);
      const dl = l - bind.restL[k], de = l === bind.restL[k] ? 0 : eemFrom(b, bind.T[k], l) - bind.restE[k];
      const d = wk * (dl * (1 - t) + de * t);
      if (d === 0) continue;
      const dir = dirs[j], c = bind.cos[k], sn = bind.sin[k];       // radial(b, θ) = cos θ · n + sin θ · ẑ
      dx += d * -dir[1] * c; dy += d * dir[0] * c; dz += d * sn;
    }
    out[3 * i] = rest[3 * i] + dx; out[3 * i + 1] = rest[3 * i + 1] + dy; out[3 * i + 2] = rest[3 * i + 2] + dz;
  }
  return out;
}
export { radial };
