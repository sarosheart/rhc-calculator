// Mini-crush's places for the shared pose builder: the D1 stent protrudes 2.3 mm (the least that covers D1's heel at this
// angle, within the design's 2 ± 0.3; Galassi 1–2 mm). The rewire's cells are found after the POT: the LAD stent's central
// cell, then the crushed D1 stent's cell behind it.
import { poseFrom, SWITCHES } from '../technique/pose.js';
import { pickSbCell } from '../devices/sb-stent.js';
import { pickCell, cellPassage } from '../devices/stent.js';
import * as M from './machine.js';

export { SWITCHES };
const PROT = 2.3, cache = new WeakMap();
const stateAfter = (action) => { let s = M.initialState(), a; do { a = M.nextAction(s); s = M.apply(s, a); } while (a !== action); return s; };
function cells(ctx) {
  if (!cache.has(ctx)) {
    const c = {}, places = { tips: PLACES.tips, prot: PROT, cells: { st: { central: () => c.central }, ss: { behind: () => c.behind } } };
    const pose = poseFrom(stateAfter('pot'), ctx, places);
    c.central = pickCell(ctx.graph, pose, ctx, 'central');
    c.behind = pickSbCell(ctx.graph, pose, ctx, 'behind', cellPassage(c.central, ctx.graph, { ...pose, st_cell: c.central }, ctx).p);
    cache.set(ctx, c);
  }
  return cache.get(ctx);
}
export const PLACES = Object.freeze({
  tips: { d1: 35, lad: 60 },
  cells: { st: { central: (ctx) => cells(ctx).central }, ss: { behind: (ctx) => cells(ctx).behind } },
  prot: PROT,
});
export const poseOf = (s, ctx) => poseFrom(s, ctx, PLACES);
