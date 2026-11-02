// The balloons (kinds.js): where one sits on its wire's route and how wide it is. Balloon A rides the main vessel, B the
// side branch; each rides the wire the pose names (bX_wire 1 = wire A, 2 = wire B). `dist` is the route coordinate of the distal end of the working length,
// where the distal marker sits; the proximal marker sits `len` behind it.
import { CARINA, axis } from '../scene/anatomy.js';
import { PREDIL } from '../scene/vessel.js';
import { BALLOON_IDS, BALLOONS, SHOULDER, NECK, STENT, SBSTENT, CUSTENT, KISS_PROX_X } from './kinds.js';
import { POT_IN, POT_LEN } from './cu-stent.js';
import { ladFrameOf } from './paths.js';
import { routePolyline, routeAt } from './wires.js';

export { BALLOON_IDS, BALLOONS };
const SB = axis('sb').dir, sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const wireOf = (pose, which) => (pose[`b${which}_wire`] === 2 ? 'B' : 'A');     // 1 = wire A, 2 = wire B
const routeOf = (pose, which, ctx) => { const w = wireOf(pose, which); return routePolyline(pose[`w${w}_route`], pose, ctx, w); };

// { kind, spec, inf, path, s, s0, s1, markers: [proximal, distal], radiusAt(s) } or null
export function balloonPlace(pose, which, ctx) {
  const kind = BALLOON_IDS[pose[`b${which}_kind`]];
  if (!kind) return null;
  const spec = BALLOONS[kind], route = routeOf(pose, which, ctx), s1 = pose[`b${which}_dist`], s0 = s1 - spec.len, inf = pose[`b${which}_inf`] || 0;
  const path = [], ss = [];
  for (let s = s0 - SHOULDER - NECK; s <= s1 + SHOULDER + NECK + 1e-9; s += 0.25) { path.push(routeAt(route, s).p); ss.push(s); }
  const R = spec.d / 2;
  const radiusAt = (s) => {
    if (s < s0 - SHOULDER || s > s1 + SHOULDER) return 0;
    const k = s < s0 ? (s - (s0 - SHOULDER)) / SHOULDER : s > s1 ? (s1 + SHOULDER - s) / SHOULDER : 1;
    return R * inf * smoothstep(k);
  };
  return { kind, spec, inf, route, path, s: ss, s0, s1, markers: [routeAt(route, s0).p, routeAt(route, s1).p], radiusAt };
}

// the route coordinate where a balloon's distal working end belongs (design §6.1, kinds.js)
export function placeFor(kind, pose, ctx) {
  const route = routeOf(pose, BALLOONS[kind].side, ctx);
  const at = (test, from) => {                       // first s ≥ from where test(point) crosses zero, interpolated
    const { pts, s } = route;
    for (let i = 1; i < pts.length; i++) {
      if (s[i] < from) continue;
      const a = test(pts[i - 1]), b = test(pts[i]);
      if ((a <= 0) !== (b <= 0)) return s[i - 1] + (s[i] - s[i - 1]) * a / (a - b);
    }
    return NaN;
  };
  switch (kind) {
    case 'predilLAD': return PREDIL.lad.to;
    case 'stentLAD': return STENT.u0 + STENT.len;
    case 'pot': return at((p) => p[0] - CARINA.cutX, 0);
    case 'kissMV': case 'kissSB': return at((p) => p[0] - KISS_PROX_X, -20) + BALLOONS[kind].len;
    case 'predilD1': return at((p) => sbProj(p) - PREDIL.d1.to, 0);
    case 'stentSB': return at((p) => sbProj(p) - (pose.ss_s0 + SBSTENT.len), 0);
    case 'psoSB': return at((p) => sbProj(p) - (pose.ss_s0 + SBSTENT.len / 2), 0);
    // 1.5 mm proximal of the D1 stent's most proximal strut at nominal (its proximal ring's heel side)
    case 'crushMV': return ladFrameOf([SB[0] * pose.ss_s0 - SB[1] * SBSTENT.nomR, 0, 0]).u - 1.5 + BALLOONS.crushMV.len;
    case 'small125': return route.passS === undefined ? NaN : route.passS - 2 + BALLOONS.small125.len;
    // just proximal to the carina (Hall), as far back as an 8 mm balloon can sit with its proximal end inside the stent
    case 'potAway': return at((p) => p[0] - (CARINA.cutX - 0.6), 0);
    // the culotte (on teal's route along the D1 path, whose coordinate is the path's u): the D1 stent's balloon to its end; the
    // POT 3.75 × 6 from 0.25 inside the stent's proximal end; the 3.0 balloon through the cell, 2 mm of it before the passage
    case 'stentCu': return pose.ss_s0 + CUSTENT.len;
    case 'potCu': return pose.ss_s0 + POT_IN + POT_LEN;
    case 'openMV': return route.passS === undefined ? NaN : route.passS - 2 + BALLOONS.openMV.len;
    // TAP: the D1 stent's balloon pulled back level with the LAD balloon parked for the kiss (BURZ15: align them); the final
    // POT 3.75 × 6 ending 0.75 mm short of the protrusion's carina-side edge (EBC: not reaching the new carina)
    case 'psoTap': return at((p) => p[0] - KISS_PROX_X, -20) + BALLOONS.psoTap.len;
    case 'potShort': return at((p) => p[0] - (SB[0] * pose.ss_s0 + SB[1] * SBSTENT.nomR - 0.75), 0);
  }
  return NaN;
}
