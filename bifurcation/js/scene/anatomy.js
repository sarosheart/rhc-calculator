// The LAD / first-diagonal bifurcation the page stents, in its own frame, 1 unit = 1 mm.
// +x along the proximal LAD toward the bifurcation, +y in the bifurcation plane toward D1, +z toward the viewer (the cut-open
// window removes the front half, z > 0). Origin: where the D1 axis leaves the LAD axis. Each branch is a straight axis from
// the origin: pMV runs s = −14 … 0 along +x, the dMV leaves at −20° and D1 at +30°, so the distal angle is 50° and the
// proximal 150° (design §5.1; brief §E, TU12). Sizes 3.75 / 3.0 / 2.5 mm (Finet 0.678 × 5.5 = 3.73), no taper in the window.
// Radial direction about a branch: dir(θ) = cos θ · n + sin θ · ẑ, n the in-plane normal (+90° from the axis); the cut
// plane is θ = 0 / π and the kept back half is sin θ ≤ 0.

export const A = Object.freeze({
  PMV_R: 1.875, DMV_R: 1.5, SB_R: 1.25,
  DMV_DEG: -20, SB_DEG: 30,
  WIN: Object.freeze({ pmv: 14, dmv: 18, sb: 18 }),
  MEDIA_T: 0.25, ADV_T: 0.35, CARINA_K: 0.35,
  // lesions placed by the clinical landmarks: the pMV's a ~5 mm Medina segment next to the bifurcation, so the stent lands on
  // normal vessel either side; D1's ≥ 50 % for ≥ 10 mm from its ostium (EBC: prepare both; DEFINITION's major criterion)
  LESION: Object.freeze({ pmv: Object.freeze([-3.5, 0]), dmv: Object.freeze([0, 10]), sb: Object.freeze([0, 14]) }),
  DS: Object.freeze({ pmv: 0.55, dmv: 0.55, sb: 0.90 }),
});
export const BRANCHES = Object.freeze(['pmv', 'dmv', 'sb']);

const rad = (d) => d * Math.PI / 180;
const unitAt = (d) => [Math.cos(rad(d)), Math.sin(rad(d)), 0];
const AX = Object.freeze({
  pmv: Object.freeze({ dir: unitAt(0), s0: -A.WIN.pmv, s1: 0, R: A.PMV_R }),
  dmv: Object.freeze({ dir: unitAt(A.DMV_DEG), s0: 0, s1: A.WIN.dmv, R: A.DMV_R }),
  sb: Object.freeze({ dir: unitAt(A.SB_DEG), s0: 0, s1: A.WIN.sb, R: A.SB_R }),
});
export const axis = (b) => AX[b];
export const onAxis = (b, s) => { const d = AX[b].dir; return [d[0] * s, d[1] * s, 0]; };
export function radial(b, theta) {
  const d = AX[b].dir, c = Math.cos(theta), s = Math.sin(theta);
  return [-d[1] * c, d[0] * c, s];
}

// distance from p to a branch's axis segment, and where along it (s) the closest point lies
export function axisDist(b, p) {
  const { dir, s0, s1 } = AX[b];
  const s = Math.max(s0, Math.min(s1, p[0] * dir[0] + p[1] * dir[1]));
  return { s, d: Math.hypot(p[0] - dir[0] * s, p[1] - dir[1] * s, p[2]) };
}
// polynomial smooth minimum (k mm): rounds the crotch where two lumens meet
export function smin(a, b, k = A.CARINA_K) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k / 4;
}
// signed distance to the reference (healthy) lumen: negative inside
export function refSDF(p) {
  const a = axisDist('pmv', p).d - A.PMV_R, b = axisDist('dmv', p).d - A.DMV_R, c = axisDist('sb', p).d - A.SB_R;
  return smin(smin(a, b), c);
}

// The carina tip: the apex of the flow divider — of the rays from the origin between the dMV and D1 axes, the one that leaves
// the reference lumen nearest the origin. cutX: the carina cut plane, perpendicular to the pMV axis through the tip.
function exitAlong(u) {
  let lo = 0, hi = 12;
  if (refSDF(u.map(v => v * hi)) < 0) return Infinity;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (refSDF(u.map(v => v * m)) < 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function findCarina() {
  let best = { rho: Infinity, deg: 0 };
  for (let d = A.DMV_DEG + 0.5; d < A.SB_DEG; d += 0.1) { const r = exitAlong(unitAt(d)); if (r < best.rho) best = { rho: r, deg: d }; }
  for (let d = best.deg - 0.1; d <= best.deg + 0.1; d += 0.002) { const r = exitAlong(unitAt(d)); if (r < best.rho) best = { rho: r, deg: d }; }
  return unitAt(best.deg).map(v => v * best.rho);
}
const tip = findCarina();
export const CARINA = Object.freeze({ tip: Object.freeze(tip), cutX: tip[0] });

// The D1 ostium on the main vessel: heel = where D1's proximal wall meets the main-vessel reference lumen (pMV ∪ dMV), toe =
// the carina tip; centre = where D1's axis leaves the main-vessel lumen; normal = D1's axis.
function mainSDF(p) { return Math.min(axisDist('pmv', p).d - A.PMV_R, axisDist('dmv', p).d - A.DMV_R); }
function findOstium() {
  const d = AX.sb.dir, n = [-d[1], d[0], 0];
  const wall = (t) => [d[0] * t + n[0] * A.SB_R, d[1] * t + n[1] * A.SB_R, 0];
  let lo = 0, hi = 8;                      // inside the main lumen at t = 0, outside at 8
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (mainSDF(wall(m)) < 0) lo = m; else hi = m; }
  const heel = wall((lo + hi) / 2);
  lo = 0; hi = 8;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (mainSDF(onAxis('sb', m)) < 0) lo = m; else hi = m; }
  return { heel, toe: tip, centre: onAxis('sb', (lo + hi) / 2), normal: d, r: A.SB_R };
}
const ost = findOstium();
export const OSTIUM = Object.freeze({ heel: Object.freeze(ost.heel), toe: CARINA.tip, centre: Object.freeze(ost.centre),
  normal: Object.freeze(ost.normal), r: ost.r });

// the branch a point belongs to (smallest distance to its wall), with its place on that branch: s along the axis, θ about it,
// d = distance from the axis
export function nearest(p) {
  let best = null;
  for (const b of BRANCHES) {
    const { s, d } = axisDist(b, p), g = d - AX[b].R;
    if (!best || g < best.g) {
      const dir = AX[b].dir, v = [p[0] - dir[0] * s, p[1] - dir[1] * s, p[2]];
      const theta = Math.atan2(v[2], -dir[1] * v[0] + dir[0] * v[1]);
      best = { b, s, theta, d, g };
    }
  }
  return { b: best.b, s: best.s, theta: best.theta, d: best.d };
}

// local ↔ world (the fluoro's LPS axes, origin at the bifurcation), from tree.json's frame
export function makeFrame(tree) {
  const { x, y, z } = tree.frame;
  return {
    toWorld: (p) => [0, 1, 2].map(k => x[k] * p[0] + y[k] * p[1] + z[k] * p[2]),
    toLocal: (w) => [x[0] * w[0] + x[1] * w[1] + x[2] * w[2], y[0] * w[0] + y[1] * w[1] + y[2] * w[2], z[0] * w[0] + z[1] * w[1] + z[2] * w[2]],
  };
}
