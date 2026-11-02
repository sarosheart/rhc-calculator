// DK crush's places for the shared pose builder: the D1 stent protrudes 3 mm (design §6.5); a wire tip in D1 is 35 mm
// along its route, in the distal LAD 60. The cells are found on the state each rewire meets: the crushed stent's
// proximal cell after the POT-crush, the LAD stent's central cell after its POT.
import { poseFrom, SWITCHES } from '../technique/pose.js';
import { pickSbCell } from '../devices/sb-stent.js';
import { pickCell } from '../devices/stent.js';
import * as M from './machine.js';

export { SWITCHES };
const PROT = 3.0, cache = new WeakMap();
const stateAfter = (action) => { let s = M.initialState(), a; do { a = M.nextAction(s); s = M.apply(s, a); } while (a !== action); return s; };
function cells(ctx) {
  if (!cache.has(ctx)) {
    const c = {};
    const places = { tips: PLACES.tips, prot: PROT, cells: { st: { central: () => c.central }, ss: { proximal: () => c.proximal } } };
    c.proximal = pickSbCell(ctx.graph, poseFrom(stateAfter('potCrush'), ctx, places), ctx, 'proximal');
    c.central = pickCell(ctx.graph, poseFrom(stateAfter('pot'), ctx, places), ctx, 'central');
    cache.set(ctx, c);
  }
  return cache.get(ctx);
}
export const PLACES = Object.freeze({
  tips: { d1: 35, lad: 60 },
  cells: { st: { central: (ctx) => cells(ctx).central }, ss: { proximal: (ctx) => cells(ctx).proximal } },
  prot: PROT,
});
export const poseOf = (s, ctx) => poseFrom(s, ctx, PLACES);
