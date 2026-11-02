// DK crush as a sequence of actions (design §6.5), on the shared step engine. Wiring, predilation, the LAD stent and its
// POT are Provisional's moves; the rest are DK's: the parked crush balloon, the D1 stent and its proximal optimisation,
// the crush, the POT-crush, two rewires and two kisses (the first opens the crushed D1 stent's cell, the final the LAD
// stent's), and a final POT short of the carina.
import { STEPS } from './steps.js';
import { makeMachine, advance, withdraw } from '../technique/machine.js';
import { KEYS as P } from '../provisional/machine.js';

const kissPair = (open) => [
  { set: { bB_inf: 1, ...open }, ms: 1000 }, { set: { bB_inf: 0 }, ms: 700 },             // D1 alone
  { set: { bA_inf: 1 }, ms: 1000 }, { set: { bA_inf: 0 }, ms: 700 },                       // the LAD alone
  { set: { bA_inf: 1, bB_inf: 1, ...(open.st_open ? { st_ellip: 1.22 } : {}) }, ms: 1100 }, // both together
  { set: { bA_inf: 0, bB_inf: 0 }, ms: 900 },                                              // deflated together
];
export const KEYS = {
  wireD1: P.wireD1, wireLAD: P.wireLAD, predilLAD: P.predilLAD, predilD1: P.predilD1,
  parkBalloon: [{ set: { ...advance('A', 'crushMV', 'B').set, ss_hold: 'balloon' }, ms: 1600 }],
  placeSB: [{ set: { ...advance('B', 'stentSB', 'A').set, sbStent: true, ss_exp: 0 }, ms: 1800 }],
  deploySB: [{ set: { bB_inf: 1, ss_exp: 1 }, ms: 1500 }, { set: { bB_inf: 0 }, ms: 900 }],
  pso: [{ set: { bB: 'psoSB', bB_at: 'place' }, ms: 1200 }, { set: { bB_inf: 1, ss_flare: 1 }, ms: 1100 }, { set: { bB_inf: 0 }, ms: 800 }],
  removeSB: [{ set: { ...withdraw('B').set, wA_tip: 'guide' }, ms: 1700 }, { set: { wA_route: 'none' }, ms: 150 }],
  crush: [{ set: { bA_inf: 1, ss_crushR: 1.5 }, ms: 1300 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  potCrush: [advance('A', 'pot', 'B'), { set: { bA_inf: 1, ss_crushR: 1.875 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  rewireProx: [{ set: { wA_route: 'd1ss', ss_cell: 'proximal', wA_tip: 'd1' }, ms: 2400 }],
  small: [advance('B', 'small125', 'A'), { set: { bB_inf: 1, ss_open: 0.5 }, ms: 1000 }, { set: { bB_inf: 0 }, ms: 700 }, withdraw('B')],
  kissIn: [{ set: { ...advance('A', 'kissMV', 'B').set, ...advance('B', 'kissSB', 'A').set }, ms: 1800 }],
  kissInflate1: kissPair({ ss_open: 1 }),
  kissOut: P.kissOut,
  tealOut: [{ set: { wA_tip: 'guide' }, ms: 1600 }, { set: { wA_route: 'none' }, ms: 150 }],
  placeStent: P.placeStent, deployStent: P.deployStent, removeStentBalloon: P.removeStentBalloon, pot: P.pot,
  rewireCentral: [{ set: { wA_route: 'd1cell', st_cell: 'central', wA_tip: 'd1' }, ms: 2400 }],
  kissInflate: kissPair({ st_open: 1 }),
  potAway: [advance('A', 'potAway', 'B'), { set: { bA_inf: 1, st_ellip: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
  wiresOut: P.wiresOut,
};

export const { initialState, nextAction, stepIndex, available, durationOf, keyframes, apply } = makeMachine({ steps: STEPS, keys: KEYS });
