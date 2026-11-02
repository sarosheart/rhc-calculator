// What the devices hold the lumen open to, for vessel.js: pushFn(pose, ctx) → (branch, s, θ) → radius (0 = nothing there).
// The LAD: the stent's radius over its length, an inflated MV balloon, and a jailed wire pressing the wall out behind the
// stent. D1: an inflated SB balloon, and once the kiss has opened the side cell, what it left (90 % of 2.5 mm, 10 % recoil
// [ESTIMATE]) over the kissing balloon's length in D1.
import { axis, OSTIUM, CARINA } from '../scene/anatomy.js';
import { STENT, SHOULDER, WIRE_R, ROUTE } from './kinds.js';
import { stentRadius } from './stent.js';
import { sbStentRadius, crushSurface, SBSTENT } from './sb-stent.js';
import { balloonPlace } from './balloon.js';
import { stentU0 } from './paths.js';
import { cuStentRadius, CUSTENT } from './cu-stent.js';

const SB = axis('sb').dir, sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];
const S_HEEL = sbProj(OSTIUM.heel);
export const KISS_SB_SPAN = Object.freeze({ from: S_HEEL - 0.5, to: S_HEEL + 10 });
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function pushFn(pose, ctx) {
  const u0 = stentU0(pose), st = !!pose.st_shown && pose.st_exp > 0.01;
  const bA = pose.bA_inf > 0 ? balloonPlace(pose, 'A', ctx) : null, bB = pose.bB_inf > 0 ? balloonPlace(pose, 'B', ctx) : null;
  const sb = bB && { a: sbProj(bB.markers[0]), b: sbProj(bB.markers[1]), r: bB.spec.d / 2 * bB.inf };
  const open = pose.st_cell >= 0 ? (pose.st_open || 0) : 0;
  const jailed = st && [pose.wA_route, pose.wB_route].includes(ROUTE.d1), heelX = OSTIUM.heel[0];
  // the D1 stent: it holds D1 at its radius; once crushed, its layers hold the LAD's D1 side out past the crushing surface
  // (the culotte's D1 stent, ss_kind 2, runs from the proximal LAD into D1 and is never crushed; Phase 3)
  const cu = pose.ss_kind === 2 && !!pose.ss_shown && pose.ss_exp > 0.01;
  // (TAP's, ss_kind 1, is pressed into a carina of metal in the lumen, not onto the wall: no crushed layers there)
  const ss = !cu && !!pose.ss_shown && pose.ss_exp > 0.01, s0 = pose.ss_s0, crushed = ss && pose.ss_kind !== 1 && (pose.ss_crushR >= 1.5 || (bA && !st));
  // the culotte: the stent holds the proximal LAD and D1; the LAD stent inside it holds it one strut out; the wire jailed behind
  // it presses the far side out, as Provisional's jailed wire does on D1's side
  const cuJail = cu && [pose.wA_route, pose.wB_route].includes(ROUTE.lad) && !st && !(pose.ss_open > 0);
  const cx0 = SB[0] * s0 - SB[1] * SBSTENT.nomR - 0.3, cx1 = CARINA.cutX + 0.3;
  return (b, s, th) => {
    let r = 0;
    if (b !== 'sb') {
      if (st && s >= u0 && s <= u0 + STENT.len) {
        r = stentRadius(s, th, pose);
        const c = Math.cos(th);
        if (jailed && b === 'pmv' && s <= heelX && c > 0.985) r = Math.max(r, stentRadius(s, 0, pose) + 2 * WIRE_R * (c - 0.985) / 0.015);
      }
      if (bA) r = Math.max(r, bA.radiusAt(s));
      if (cu && b === 'pmv' && s >= s0) {
        r = Math.max(r, cuStentRadius(s, pose));
        if (st) r = Math.max(r, stentRadius(s, th, pose) + 0.09);
        const c = Math.cos(th);
        if (cuJail && c < -0.985) r = Math.max(r, cuStentRadius(s, pose) + 2 * WIRE_R * (-c - 0.985) / 0.015);
      }
      if (crushed && s >= cx0 && s <= cx1) { const S = crushSurface(s, pose); if (S > 0 && Math.abs(Math.sin(th)) * S <= 1.25 && Math.cos(th) > 0) r = Math.max(r, S + 0.2); }
    } else {
      if (ss && s >= s0 && s <= s0 + SBSTENT.len) r = Math.max(r, sbStentRadius(s, th, pose));
      if (cu && s <= s0 + CUSTENT.len) r = Math.max(r, cuStentRadius(s, pose));       // the D1 path's u is D1's s from s 1
      if (sb && s >= sb.a - SHOULDER && s <= sb.b + SHOULDER) {
        const k = s < sb.a ? (s - (sb.a - SHOULDER)) / SHOULDER : s > sb.b ? (sb.b + SHOULDER - s) / SHOULDER : 1;
        r = Math.max(r, sb.r * smoothstep(k));
      }
      if (open > 0 && s >= KISS_SB_SPAN.from && s <= KISS_SB_SPAN.to) r = Math.max(r, 1.25 * 0.9 * open);
    }
    return r;
  };
}
