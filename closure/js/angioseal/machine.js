// Angio-Seal VIP as a sequence of actions; wrong moves on offer at some steps fail into a terminal state (Undo goes back).
import { STEPS } from './steps.js';
import { TRACT_LEN } from '../scene/paths.js';

const ORDER = STEPS.flatMap((s) => s.actions);
const STEP_OF = ORDER.map((a) => STEPS.findIndex((s) => s.actions.includes(a)));
// how far the insertion sheath's tip is past the arteriotomy (mm along the track): the locator drips at 18.5, stops at
// 15.5 (inlet hole in the wall), and the working depth is where it just drips again
export const TIP = Object.freeze({ outside: -(TRACT_LEN + 70), drip: 18.5, stop: 15.5, work: 17, wall: 1.4, out: -(TRACT_LEN + 8), slipped: -1 });

export function initialState() {
  return Object.freeze({ done: 0, checked: false, locator: 'apart', wire: 'out', proc: 'in', ins: 'outside', tipIn: TIP.outside,
    device: 'outside', anchor: 'carrier', capBack: 0, collagen: 'carrier', tamper: 'none', paid: false, clearStop: false,
    marker: false, cut1: false, cut2: false });
}
export const nextAction = (s) => (s.failed ? null : ORDER[s.done] ?? null);
export const stepIndex = (s) => (s.done < ORDER.length ? STEP_OF[s.done] : STEPS.length);

const EFFECT = {
  checkAngio: () => ({ checked: true }),
  snapLocator: () => ({ locator: 'in' }),
  wireIn: () => ({ wire: 'in' }),
  procOut: () => ({ proc: 'out' }),
  advanceToDrip: () => ({ ins: 'in', tipIn: TIP.drip }),
  pullBackToStop: () => ({ tipIn: TIP.stop }),
  readvance: () => ({ tipIn: TIP.work }),
  locatorOut: () => ({ locator: 'out', wire: 'out' }),
  deviceIn: () => ({ device: 'in', anchor: 'released' }),
  pullCap: () => ({ anchor: 'caught', capBack: 0.5 }),
  rearLock: () => ({ capBack: 1 }),
  toWall: () => ({ anchor: 'wall', tipIn: TIP.wall }),
  deployCollagen: () => ({ collagen: 'plug', tamper: 'shown', tipIn: TIP.out }),
  toClearStop: () => ({ paid: true, clearStop: true }),
  tamp: () => ({ collagen: 'mound', tamper: 'down', marker: true }),
  cutTop: () => ({ tamper: 'off', cut1: true, ins: 'removed', device: 'removed' }),
  cutSkin: () => ({ cut2: true, marker: false }),
};
const WRONG = {
  deviceIn: { slip: 'sheathSlipped', force: 'forcedBackWall' },
  pullCap: { pullFast: 'prematureCatch' },
  tamp: { tampSlack: 'collagenIn' },
  cutTop: { tampMore: 'overTamped' },
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
