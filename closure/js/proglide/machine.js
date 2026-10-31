// Perclose ProGlide (one device) as a sequence of actions. Pure: apply() returns a new frozen state and never mutates.
// At each point the page offers the correct action and the wrong ones that are physically possible there; a wrong one
// returns a FAILED state (`failed`: a key of MISTAKES), which is terminal — Undo is the way back.
import { STEPS } from './steps.js';

const ORDER = STEPS.flatMap((s) => s.actions);
const STEP_OF = ORDER.map((a) => STEPS.findIndex((s) => s.actions.includes(a)));
export const MARK_INSERT = 6;          // mm deeper than apposed: the marker port is in the lumen
export const OUTSIDE_INSERT = -160;    // the device out of the body, clear of the skin
export const KNOT_RELEASED = 10;       // mm up the tract from the wall where the knot sits once it leaves the device
export const KNOT_STARTED = 6;         // … after the device comes out under tension on the rail

export function initialState(geom) {
  return Object.freeze({
    done: 0, portAtSkin: geom.portAtSkinInsert,
    flushed: false, sheath: 'in', wire: 'out', device: 'outside', insert: OUTSIDE_INSERT, foot: 'parked', apposed: false,
    plunger: 'back', captured: false, cut: false, harvested: false, pusher: 'none', knotS: -1, locked: false, trimmed: false,
  });
}

export const nextAction = (s) => (s.failed ? null : ORDER[s.done] ?? null);
export const stepIndex = (s) => (s.done < ORDER.length ? STEP_OF[s.done] : STEPS.length);

const EFFECT = {
  flush: () => ({ flushed: true }),
  wireIn: () => ({ wire: 'in' }),
  sheathOut: () => ({ sheath: 'out' }),
  backload: (s) => ({ device: 'in', insert: s.portAtSkin }),
  wireOut: () => ({ wire: 'out' }),
  advanceToMark: () => ({ insert: MARK_INSERT }),
  leverUp: () => ({ foot: 'open' }),
  retractToWall: () => ({ insert: 0, apposed: true }),
  plungerIn: () => ({ plunger: 'in', captured: true }),
  plungerOut: () => ({ plunger: 'out' }),
  quickCut: () => ({ cut: true }),
  leverDown: () => ({ foot: 'parked', apposed: false }),
  retractToPort: (s) => ({ insert: s.portAtSkin, knotS: KNOT_RELEASED }),
  rewire: () => ({ wire: 'in' }),
  harvest: () => ({ harvested: true }),
  removeDevice: () => ({ device: 'removed', insert: OUTSIDE_INSERT, knotS: KNOT_STARTED }),
  loadPusher: () => ({ pusher: 'loaded' }),
  advanceKnot: () => ({ pusher: 'down', knotS: 0 }),
  wireOutFinal: () => ({ wire: 'out' }),
  lock: () => ({ locked: true }),
  trim: () => ({ trimmed: true, pusher: 'none' }),
};

// the wrong moves on offer while each correct action is next, and what each one does there
const WRONG = {
  plungerIn: { plungeShallow: 'shallow', plungeTwist: 'twist' },
  removeDevice: { tightenEarly: 'tightenOnDevice', lock: 'lockedHigh' },
  loadPusher: { lock: 'lockedHigh' },
  advanceKnot: { lock: 'lockedHigh', twistPusher: 'railWrapped' },
  wireOutFinal: { lock: 'lockedOnWire' },
};

export function available(s) {
  const next = nextAction(s);
  return next ? [next, ...Object.keys(WRONG[next] || {})] : [];
}
export const isCorrect = (s, action) => action === nextAction(s);

export function apply(s, action) {
  const next = nextAction(s);
  if (next && action === next) return Object.freeze({ ...s, ...EFFECT[action](s), done: s.done + 1 });
  const failed = next && WRONG[next]?.[action];
  if (!failed) throw new Error('not available');
  return Object.freeze({ ...s, failed, failedFrom: next });
}
