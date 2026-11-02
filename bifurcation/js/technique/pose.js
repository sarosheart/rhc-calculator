// A technique's state as the numbers both windows draw (the pose tables in the Phase 1 and Phase 2 plans). The state names
// things; the technique's `places` say where they are: `tips` (a wire tip's route coordinate, a number or a function of
// ctx), `cells` (`st` for the LAD stent, `ss` for the D1 stent: name → function of ctx giving the cell id) and `prot`
// (the D1 stent's protrusion, mm from the carina tip to its proximal end on its own axis). Phase 3: `sb` names the D1 stent's
// kind ('crush' default, 'tap', 'culotte') and `sbU0` the culotte's proximal end, u on the D1 path. A balloon in place sits
// where balloon.js's placeFor puts its kind.
import { A, CARINA } from '../scene/anatomy.js';
import { BALLOON_IDS, ROUTE, HOLD, SB_KIND } from '../devices/kinds.js';
import { placeFor } from '../devices/balloon.js';
import { treeLocal } from '../devices/paths.js';

// the pose fields the animator switches rather than tweens, each with its "none" value (a cell id 0 is a cell)
export const SWITCHES = new Map([['wA_route', 0], ['wB_route', 0], ['bA_kind', 0], ['bB_kind', 0], ['bA_wire', 0], ['bB_wire', 0],
  ['st_shown', 0], ['st_cell', -1], ['ss_shown', 0], ['ss_cell', -1]]);
const COS_SB = Math.cos(A.SB_DEG * Math.PI / 180);
const resolve = (v, ctx) => (typeof v === 'function' ? v(ctx) : v);

export function poseFrom(s, ctx, places) {
  const guide = treeLocal(ctx).lm.s[0];                       // the route coordinate of the guide tip
  const tip = (t) => (t === 'guide' ? guide : resolve(places.tips[t], ctx));
  const cell = (kind, name) => (name == null ? -1 : resolve(places.cells[kind][name], ctx));
  const p = {
    wA_route: ROUTE[s.wA_route], wA_tip: tip(s.wA_tip), wB_route: ROUTE[s.wB_route], wB_tip: tip(s.wB_tip),
    bA_kind: BALLOON_IDS.indexOf(s.bA), bA_wire: s.bA_wire === 'B' ? 2 : 1, bA_dist: guide, bA_inf: s.bA_inf,
    bB_kind: BALLOON_IDS.indexOf(s.bB), bB_wire: s.bB_wire === 'B' ? 2 : 1, bB_dist: guide, bB_inf: s.bB_inf,
    st_shown: s.stent ? 1 : 0, st_exp: s.st_exp, st_potR: s.st_potR, st_cell: cell('st', s.st_cell),
    st_open: s.st_open, st_ellip: s.st_ellip, v_predLAD: s.v_predLAD, v_predD1: s.v_predD1, puff: s.puff,
    ss_shown: s.sbStent ? 1 : 0, ss_exp: s.ss_exp || 0,
    ss_s0: places.sbU0 != null ? places.sbU0 : places.prot ? (CARINA.cutX - places.prot) / COS_SB : 0,
    ss_kind: SB_KIND[places.sb || 'crush'], ss_potR: s.ss_potR || 0, v_diss: s.v_diss || 0,
    ss_flare: s.ss_flare || 0, ss_hold: HOLD[s.ss_hold || 'none'], ss_crushR: s.ss_crushR || 0,
    ss_cell: cell('ss', s.ss_cell), ss_open: s.ss_open || 0,
  };
  if (p.bA_kind < 0) p.bA_kind = 0;
  if (p.bB_kind < 0) p.bB_kind = 0;
  if (s.bA && s.bA_at === 'place') p.bA_dist = placeFor(s.bA, p, ctx);
  if (s.bB && s.bB_at === 'place') p.bB_dist = placeFor(s.bB, p, ctx);
  return p;
}
