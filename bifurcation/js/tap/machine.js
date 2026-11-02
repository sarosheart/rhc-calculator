// T / TAP as a sequence of actions (design §6.2), on the shared step engine: Provisional's moves to its kiss (the kiss here
// tears D1's ostium), then the bail-out: an injection, a 3.0 balloon parked in the LAD on teal, the D1 stent on gold through
// the LAD stent's opened cell, deployed, its balloon pulled back level with the LAD balloon and re-inflated, the two kissed
// together (inflated and deflated together), and a short POT.
import { STEPS } from './steps.js';
import { makeMachine, advance, withdraw } from '../technique/machine.js';
import { KEYS as P } from '../provisional/machine.js';
import { KEYS as DK } from '../dkcrush/machine.js';

export const KEYS = {
  ...Object.fromEntries(['wireD1', 'wireLAD', 'predilLAD', 'predilD1', 'placeStent', 'deployStent', 'removeStentBalloon', 'pot',
    'pullBackGold', 'recrossD1', 'pullJailed', 'tealToLAD', 'kissIn', 'kissOut', 'wiresOut'].map(a => [a, P[a]])),
  // Provisional's kiss; the D1 balloon's inflation tears the ostium
  kissInflate: [{ set: { ...P.kissInflate[0].set, v_diss: 1 }, ms: P.kissInflate[0].ms }, ...P.kissInflate.slice(1)],
  checkD1: [{ set: {}, ms: 400 }],
  parkMV: [{ set: { ...advance('A', 'kissMV', 'A').set, ss_hold: 'balloon' }, ms: 1600 }],
  placeSB: [{ set: { ...advance('B', 'stentSB', 'B').set, sbStent: true, ss_exp: 0 }, ms: 1800 }],
  deploySB: DK.deploySB,
  psoTap: [{ set: { bB: 'psoTap', bB_at: 'place' }, ms: 1200 }, { set: { bB_inf: 1, ss_flare: 1 }, ms: 1100 }, { set: { bB_inf: 0 }, ms: 800 }],
  kissTap: [{ set: { bA_inf: 1, bB_inf: 1, ss_crushR: 1.5, st_ellip: 1.22 }, ms: 1200 }, { set: { bA_inf: 0, bB_inf: 0 }, ms: 900 }],
  potShort: [advance('A', 'potShort', 'A'), { set: { bA_inf: 1, st_ellip: 1 }, ms: 1100 }, { set: { bA_inf: 0 }, ms: 800 }, withdraw('A')],
};

export const { initialState, nextAction, stepIndex, available, durationOf, keyframes, apply } = makeMachine({ steps: STEPS, keys: KEYS });
