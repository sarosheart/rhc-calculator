// The figure-of-8 stitch as a sequence of actions; wrong moves on offer at some steps fail into a terminal state.
import { STEPS } from './steps.js';

const ORDER = STEPS.flatMap((s) => s.actions);
const STEP_OF = ORDER.map((a) => STEPS.findIndex((s) => s.actions.includes(a)));
// stitch: bites and crossing so far (0–3) · needle: on the suture until the ends are crossed · knot: 0 none, 1 crossed ·
// wraps: twists so far · tucked: the end back through the loop · sheath: in/out · down: 0 loose, 0.3 following the
// sheath out, 1 snug on the skin
export function initialState() {
  return Object.freeze({ done: 0, stitch: 0, needle: true, knot: 0, wraps: 0, tucked: false, sheath: 'in', down: 0, dressed: false });
}
export const nextAction = (s) => (s.failed ? null : ORDER[s.done] ?? null);
export const stepIndex = (s) => (s.done < ORDER.length ? STEP_OF[s.done] : STEPS.length);
const EFFECT = {
  bite1: () => ({ stitch: 1 }), crossOver: () => ({ stitch: 2 }), bite2: () => ({ stitch: 3 }),
  crossEnds: () => ({ knot: 1, needle: false }), wrap1: () => ({ wraps: 1 }), wrap2: () => ({ wraps: 2 }), wrap3: () => ({ wraps: 3 }),
  throughLoop: () => ({ tucked: true }), sheathOut: () => ({ sheath: 'out', down: 0.3 }), pullDown: () => ({ down: 1 }),
  dress: () => ({ dressed: true }),
};
const WRONG = { bite1: { deepBite: 'biteDeep', shallowBite: 'biteShallow' }, sheathOut: { tieNow: 'tiedOnSheath' } };
export function available(s) { const n = nextAction(s); return n ? [n, ...Object.keys(WRONG[n] || {})] : []; }
export const isCorrect = (s, a) => a === nextAction(s);
export function apply(s, action) {
  const next = nextAction(s);
  if (next && action === next) return Object.freeze({ ...s, ...EFFECT[action](s), done: s.done + 1 });
  const failed = next && WRONG[next]?.[action];
  if (!failed) throw new Error('not available');
  return Object.freeze({ ...s, failed, failedFrom: next });
}
