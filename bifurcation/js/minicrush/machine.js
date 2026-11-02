// Mini-crush as a sequence of actions (design §6.4), on the shared step engine: both stents positioned together, the D1
// stent deployed first, the LAD stent's expansion doing the crush, one rewire through both layers, one kiss.
import { STEPS } from './steps.js';
import { makeMachine, advance, withdraw } from '../technique/machine.js';
import { KEYS as P } from '../provisional/machine.js';
import { KEYS as DK } from '../dkcrush/machine.js';

export const KEYS = {
  wireD1: P.wireD1, wireLAD: P.wireLAD, predilLAD: P.predilLAD, predilD1: P.predilD1,
  placeStent: [{ set: { ...advance('A', 'stentLAD', 'B').set, stent: true, st_exp: 0, ss_hold: 'stent' }, ms: 1800 }],
  placeSB: DK.placeSB, deploySB: DK.deploySB, removeSB: DK.removeSB,
  deployStent: [{ set: { bA_inf: 1, st_exp: 1, ss_crushR: 1.5 }, ms: 1600 }, { set: { bA_inf: 0 }, ms: 900 }],
  removeStentBalloon: P.removeStentBalloon,
  pot: [advance('A', 'pot', 'B'), { set: { bA_inf: 1, st_potR: 1.875, ss_crushR: 1.875 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  rewireBoth: [{ set: { wA_route: 'd1both', st_cell: 'central', ss_cell: 'behind', wA_tip: 'd1' }, ms: 2600 }],
  small: [advance('B', 'small125', 'A'), { set: { bB_inf: 1, st_open: 0.5 }, ms: 1000 }, { set: { bB_inf: 0 }, ms: 700 }, withdraw('B')],
  kissIn: DK.kissIn, kissInflate: DK.kissInflate, kissOut: P.kissOut,
  rePot: [advance('A', 'pot', 'B'), { set: { bA_inf: 1, st_ellip: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  wiresOut: P.wiresOut,
};

export const { initialState, nextAction, stepIndex, available, durationOf, keyframes, apply } = makeMachine({ steps: STEPS, keys: KEYS });
