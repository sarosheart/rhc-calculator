// Provisional's places for the shared pose builder (technique/pose.js): a wire tip in D1 is 35 mm along its route, in the
// distal LAD 60, pulled back to the carina just past the distal cell's passage; the distal cell is found on the deployed,
// post-dilated stent.
import { ROUTE, STENT } from '../devices/kinds.js';
import { distalCell, cellPassage } from '../devices/stent.js';
import { poseFrom, SWITCHES } from '../technique/pose.js';

export { SWITCHES };
const cellCache = new WeakMap();
// the deployed, post-dilated stent, as the rewire finds it
const AFTER_POT = { wA_route: ROUTE.d1, wA_tip: 35, wB_route: ROUTE.lad, wB_tip: 60, bA_kind: 0, bA_wire: 2, bA_dist: 0, bA_inf: 0,
  bB_kind: 0, bB_wire: 1, bB_dist: 0, bB_inf: 0, st_shown: 1, st_exp: 1, st_potR: 1.875, st_cell: -1, st_open: 0, st_ellip: 1, v_predLAD: 1, v_predD1: 1, puff: 0 };
function cellFor(ctx) {
  if (!cellCache.has(ctx)) {
    const cell = distalCell(ctx.graph, AFTER_POT, ctx), X = cellPassage(cell, ctx.graph, { ...AFTER_POT, st_cell: cell }, ctx);
    // the pull-back stops with the tip just past the distal cell's passage, at the carina, where it drops through
    cellCache.set(ctx, { cell, carinaTip: STENT.u0 + X.z + 0.6 });
  }
  return cellCache.get(ctx);
}

export const PLACES = Object.freeze({
  tips: { d1: 35, lad: 60, proxStent: STENT.u0 - 2, carina: (ctx) => cellFor(ctx).carinaTip },
  cells: { st: { distal: (ctx) => cellFor(ctx).cell }, ss: {} },
  prot: 0,
});
export const poseOf = (s, ctx) => poseFrom(s, ctx, PLACES);
