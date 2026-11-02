// Provisional as a sequence of actions (design §6.1), on the step engine every technique shares (technique/machine.js).
// States name things (routes, wire tips, balloon kinds, where a balloon is); pose.js turns them into the numbers drawn.
import { STEPS } from './steps.js';
import { makeMachine, advance, withdraw } from '../technique/machine.js';

// the keyframes of each action: { set: what changes, ms: how long the move takes }
export const KEYS = {
  wireD1: [{ set: { wA_route: 'd1', wA_tip: 'd1' }, ms: 2000 }],
  wireLAD: [{ set: { wB_route: 'lad', wB_tip: 'lad' }, ms: 2000 }],
  predilLAD: [advance('A', 'predilLAD', 'B'), { set: { bA_inf: 1, v_predLAD: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  predilD1: [advance('B', 'predilD1', 'A'), { set: { bB_inf: 1, v_predD1: 1 }, ms: 1100 }, { set: { bB_inf: 0 }, ms: 800 }, withdraw('B')],
  placeStent: [{ set: { ...advance('A', 'stentLAD', 'B').set, stent: true, st_exp: 0 }, ms: 1800 }],
  deployStent: [{ set: { bA_inf: 1, st_exp: 1 }, ms: 1500 }, { set: { bA_inf: 0 }, ms: 900 }],
  removeStentBalloon: [withdraw('A')],
  pot: [advance('A', 'pot', 'B'), { set: { bA_inf: 1, st_potR: 1.875 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  pullBackGold: [{ set: { wB_tip: 'carina' }, ms: 1900 }],
  recrossD1: [{ set: { wB_route: 'd1cell', st_cell: 'distal', wB_tip: 'd1' }, ms: 2200 }],
  pullJailed: [{ set: { wA_tip: 'proxStent' }, ms: 1800 }],
  tealToLAD: [{ set: { wA_route: 'lad' }, ms: 150 }, { set: { wA_tip: 'lad' }, ms: 2000 }],
  kissIn: [{ set: { ...advance('A', 'kissMV', 'A').set, ...advance('B', 'kissSB', 'B').set }, ms: 1800 }],
  kissInflate: [
    { set: { bB_inf: 1, st_open: 1 }, ms: 1000 }, { set: { bB_inf: 0 }, ms: 700 },          // D1 alone
    { set: { bA_inf: 1 }, ms: 1000 }, { set: { bA_inf: 0 }, ms: 700 },                       // the LAD alone
    { set: { bA_inf: 1, bB_inf: 1, st_ellip: 1.22 }, ms: 1100 },                             // both together
    { set: { bA_inf: 0, bB_inf: 0 }, ms: 900 },                                              // deflated together
  ],
  kissOut: [{ set: { ...withdraw('A').set, ...withdraw('B').set }, ms: 1400 }],
  rePot: [advance('A', 'pot', 'A'), { set: { bA_inf: 1, st_ellip: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  wiresOut: [{ set: { wA_tip: 'guide', wB_tip: 'guide' }, ms: 1800 }, { set: { wA_route: 'none', wB_route: 'none' }, ms: 150 }],
};

export const { initialState, nextAction, stepIndex, available, durationOf, keyframes, apply } = makeMachine({ steps: STEPS, keys: KEYS });
