// The figure-of-8 stitch as a sequence of actions; wrong moves on offer at some steps fail into a terminal state.
import { STEPS } from './steps.js';

const ORDER = STEPS.flatMap((s) => s.actions);
const STEP_OF = ORDER.map((a) => STEPS.findIndex((s) => s.actions.includes(a)));
// stitch: bites and crossing so far (0–3) · needle: on the needle end until it is cut off · ends: both brought down ·
// wraps: so far · tuck: 0, 1 through the first loop, 2 through the big loop · set · down: on the puncture · dressed
export function initialState() {
  return Object.freeze({ done: 0, stitch: 0, needle: true, ends: false, wraps: 0, tuck: 0, set: false, down: false, dressed: false });
}
export const nextAction = (s) => (s.failed ? null : ORDER[s.done] ?? null);
export const stepIndex = (s) => (s.done < ORDER.length ? STEP_OF[s.done] : STEPS.length);
const EFFECT = {
  bite1: () => ({ stitch: 1 }), crossOver: () => ({ stitch: 2 }), bite2: () => ({ stitch: 3 }),
  bringDown: () => ({ ends: true }), wrap1: () => ({ wraps: 1 }), wrap2: () => ({ wraps: 2 }), wrap3: () => ({ wraps: 3 }),
  throughLoop: () => ({ tuck: 1 }), throughBigLoop: () => ({ tuck: 2 }), setKnot: () => ({ set: true }),
  slideDown: () => ({ down: true }), dress: () => ({ needle: false, dressed: true }),
};
const WRONG = { bite1: { deepBite: 'biteDeep', shallowBite: 'biteShallow' } };
export function available(s) { const n = nextAction(s); return n ? [n, ...Object.keys(WRONG[n] || {})] : []; }
export const isCorrect = (s, a) => a === nextAction(s);
export function apply(s, action) {
  const next = nextAction(s);
  if (next && action === next) return Object.freeze({ ...s, ...EFFECT[action](s), done: s.done + 1 });
  const failed = next && WRONG[next]?.[action];
  if (!failed) throw new Error('not available');
  return Object.freeze({ ...s, failed, failedFrom: next });
}
