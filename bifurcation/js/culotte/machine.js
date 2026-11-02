// Culotte as a sequence of actions (design §6.3), on the shared step engine. Wiring, predilation, the LAD stent, the D1
// rewire by pull-back and the final kiss are Provisional's moves (the LAD stent rides teal here); the D1 stent from the
// proximal LAD, its POT, the pull-back into the LAD, the balloon through its cell and the gold wire's return are the
// culotte's.
import { STEPS } from './steps.js';
import { makeMachine, advance, withdraw } from '../technique/machine.js';
import { KEYS as P } from '../provisional/machine.js';
import { KEYS as DK } from '../dkcrush/machine.js';

export const KEYS = {
  wireD1: P.wireD1, wireLAD: P.wireLAD, predilLAD: P.predilLAD, predilD1: P.predilD1,
  placeSB: [{ set: { ...advance('B', 'stentCu', 'A').set, sbStent: true, ss_exp: 0 }, ms: 1800 }],
  deploySB: DK.deploySB,
  removeSBBalloon: [withdraw('B')],
  potCu: [advance('B', 'potCu', 'A'), { set: { bB_inf: 1, ss_potR: 1.875 }, ms: 1100 }, { set: { bB_inf: 0 }, ms: 800 }, withdraw('B')],
  pullBackTeal: [{ set: { wA_tip: 'carinaCu' }, ms: 1900 }],
  recrossLAD: [{ set: { wA_route: 'dmvcell', ss_cell: 'distal', wA_tip: 'lad' }, ms: 2200 }],
  goldOut: [{ set: { wB_tip: 'guide' }, ms: 1600 }, { set: { wB_route: 'none' }, ms: 150 }],
  openLAD: [advance('A', 'openMV', 'A'), { set: { bA_inf: 1, ss_open: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  // the LAD stent on teal: through the opened cell the wire lies in the LAD's lumen again
  placeStent: [{ set: { ...advance('A', 'stentLAD', 'A').set, stent: true, st_exp: 0, wA_route: 'lad' }, ms: 1800 }],
  deployStent: P.deployStent, removeStentBalloon: P.removeStentBalloon,
  potLAD: [advance('A', 'pot', 'A'), ...P.pot.slice(1)],
  goldToLAD: [{ set: { wB_route: 'lad' }, ms: 150 }, { set: { wB_tip: 'lad' }, ms: 2000 }],
  pullBackGold: P.pullBackGold, recrossD1: P.recrossD1,
  kissIn: P.kissIn, kissInflate: P.kissInflate, kissOut: P.kissOut, rePot: P.rePot, wiresOut: P.wiresOut,
};

export const { initialState, nextAction, stepIndex, available, durationOf, keyframes, apply } = makeMachine({ steps: STEPS, keys: KEYS });
