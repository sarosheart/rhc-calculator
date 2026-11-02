// The culotte's places for the shared pose builder: its D1 stent on the D1 path from the LAD stent's proximal level
// (kinds.js CUSTENT); the D1 stent's distal cell, over the distal LAD's origin, named on the stent after its POT, and the
// teal pull-back's stop just past that cell's passage; the LAD stent's distal cell and the gold pull-back's stop are
// Provisional's (the same LAD stent, in the same place).
import { poseFrom, SWITCHES } from '../technique/pose.js';
import { CUSTENT } from '../devices/kinds.js';
import { pickCuCell, cuCellPassage } from '../devices/cu-stent.js';
import { sbFrameOf } from '../devices/paths.js';
import { PLACES as PROV } from '../provisional/pose.js';
import * as M from './machine.js';

export { SWITCHES };
const cache = new WeakMap();
const stateAfter = (action) => { let s = M.initialState(), a; do { a = M.nextAction(s); s = M.apply(s, a); } while (a !== action); return s; };
function cuCell(ctx) {
  if (!cache.has(ctx)) {
    const pose = poseFrom(stateAfter('potCu'), ctx, { ...PLACES, cells: { st: {}, ss: {} } });
    const cell = pickCuCell(ctx.graph, pose, ctx, 'distal'), X = cuCellPassage(cell, ctx.graph, pose, ctx).p;
    cache.set(ctx, { cell, tip: sbFrameOf(X).u + 0.6 });
  }
  return cache.get(ctx);
}
export const PLACES = Object.freeze({
  tips: { d1: 35, lad: 60, carina: PROV.tips.carina, carinaCu: (ctx) => cuCell(ctx).tip },
  cells: { st: { distal: PROV.cells.st.distal }, ss: { distal: (ctx) => cuCell(ctx).cell } },
  sb: 'culotte', sbU0: CUSTENT.u0,
});
export const poseOf = (s, ctx) => poseFrom(s, ctx, PLACES);
