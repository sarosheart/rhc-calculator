// ProGlide pre-close: two devices, each one's state kept in the single-device shape (d1, d2) so its pose and its drawing
// come from closure/js/proglide/. Wrong moves on offer at some steps fail into a terminal state (Undo goes back).
import { STEPS } from './steps.js';
import { MARK_INSERT, OUTSIDE_INSERT, KNOT_RELEASED } from '../proglide/machine.js';

const ORDER = STEPS.flatMap((s) => s.actions);
const STEP_OF = ORDER.map((a) => STEPS.findIndex((s) => s.actions.includes(a)));
const device = (on) => ({ device: on ? 'outside' : 'waiting', insert: OUTSIDE_INSERT, roll: 0, foot: 'parked', apposed: false, plunger: 'back',
  captured: false, cut: false, harvested: false, pusher: 'none', knotS: -1, locked: false, trimmed: false, clamped: false });

export function initialState(geom) {
  return Object.freeze({ done: 0, portAtSkin: geom.portAtSkinInsert, flushed: false, sheath: 'in', wire: 'out', big: 'none',
    d1: device(true), d2: device(false) });
}
export const nextAction = (s) => (s.failed ? null : ORDER[s.done] ?? null);
export const stepIndex = (s) => (s.done < ORDER.length ? STEP_OF[s.done] : STEPS.length);

const D = (k, f) => (s) => ({ [k]: { ...s[k], ...f(s, s[k]) } });
const both = (...fs) => (s) => Object.assign({}, ...fs.map((f) => f(s)));
const EFFECT = {
  flush: () => ({ flushed: true }), wireIn: () => ({ wire: 'in' }), sheathOut: () => ({ sheath: 'out' }),
  backload: D('d1', (s) => ({ device: 'in', insert: s.portAtSkin })), wireOut: () => ({ wire: 'out' }),
  advanceToMark: D('d1', () => ({ insert: MARK_INSERT })), rotate1: D('d1', () => ({ roll: -30 })),
  leverUp: D('d1', () => ({ foot: 'open' })), retractToWall: D('d1', () => ({ insert: 0, apposed: true })),
  plungerIn: D('d1', () => ({ plunger: 'in', captured: true })), plungerOut: D('d1', () => ({ plunger: 'out' })),
  quickCut: D('d1', () => ({ cut: true })), leverDown: D('d1', () => ({ foot: 'parked', apposed: false })),
  retractToPort: D('d1', (s) => ({ insert: s.portAtSkin, knotS: KNOT_RELEASED })), harvestBoth: D('d1', () => ({ harvested: true })),
  clamp1: D('d1', () => ({ clamped: true })), rewire: () => ({ wire: 'in' }),
  removeDevice: D('d1', () => ({ device: 'removed', insert: OUTSIDE_INSERT, knotS: 8 })),
  backload2: D('d2', (s) => ({ device: 'in', insert: s.portAtSkin })), wireOut2: () => ({ wire: 'out' }),
  advanceToMark2: D('d2', () => ({ insert: MARK_INSERT })), rotate2: D('d2', () => ({ roll: 30 })),
  leverUp2: D('d2', () => ({ foot: 'open' })), retractToWall2: D('d2', () => ({ insert: 0, apposed: true })),
  plungerIn2: D('d2', () => ({ plunger: 'in', captured: true })), plungerOut2: D('d2', () => ({ plunger: 'out' })),
  quickCut2: D('d2', () => ({ cut: true })), leverDown2: D('d2', () => ({ foot: 'parked', apposed: false })),
  retractToPort2: D('d2', (s) => ({ insert: s.portAtSkin, knotS: KNOT_RELEASED })), harvestBoth2: D('d2', () => ({ harvested: true })),
  clamp2: D('d2', () => ({ clamped: true })), rewire2: () => ({ wire: 'in' }),
  bigSheathIn: both(D('d2', () => ({ device: 'removed', insert: OUTSIDE_INSERT, knotS: 8 })), () => ({ big: 'in' })),
  advance1: both(D('d1', () => ({ knotS: 0, clamped: false })), () => ({ big: 'out' })),
  advance2: D('d2', () => ({ knotS: 1.6, clamped: false })),
  wireOutEnd: () => ({ wire: 'out' }),
  lock1: D('d1', () => ({ locked: true })), lock2: D('d2', () => ({ locked: true })),
  trimAll: both(D('d1', () => ({ trimmed: true })), D('d2', () => ({ trimmed: true }))),
};
const WRONG = {
  clamp1: { pullOne: 'oneLimb' }, rotate1: { rotate60: 'overRotated' }, clamp2: { parkSlack: 'slackLoop' },
  lock1: { lock2First: 'lockedOutOfOrder' }, wireOutEnd: { lock1Now: 'lockedWireIn' },
};
export function available(s) { const n = nextAction(s); return n ? [n, ...Object.keys(WRONG[n] || {})] : []; }
export const isCorrect = (s, a) => a === nextAction(s);
export function apply(s, action) {
  const next = nextAction(s);
  if (next && action === next) return Object.freeze({ ...s, ...EFFECT[action](s), done: s.done + 1 });
  const failed = next && WRONG[next]?.[action];
  if (!failed) throw new Error('not available');
  return Object.freeze({ ...s, failed, failedFrom: next });
}
