// What the two windows draw for a ProGlide state: numbers only (booleans as 0/1), so the animator can tween them.
import { computeSeat, deviceFrame, inLumen, W } from '../scene/world.js';
import { OUTSIDE_INSERT } from './machine.js';

// what each mistake leaves behind (plans/closure/2026-10-30-phase2-proglide-mistakes-plan.md, the table)
const FAILED = {
  shallow: () => ({ angle: 30, toePivot: 1, plunger: 1, needles: 1, deflectP: 1 }),
  twist: () => ({ roll: 12, plunger: 1, needles: 1, deflectA: 1 }),
  tightenOnDevice: () => ({ cinchOnDevice: 1, sheathTorn: 1, knotS: 1.5 }),
  lockedHigh: () => ({ lock: 1, bleed: 1 }),
  lockedOnWire: () => ({ lock: 1 }),
  railWrapped: (p) => ({ wrap: 1, pusherShown: 1, pusherS: p.knotS }),
};

const TRACT_LEN = (W.SKIN_Y - W.WALL_OUT_Y) / Math.sin(W.ANGLE * Math.PI / 180);   // arteriotomy to skin along the tract

export function poseOf(s, geom) {
  const deviceIn = s.device === 'in';
  const insert = deviceIn ? s.insert : OUTSIDE_INSERT;
  const p = {
    insert, angle: W.ANGLE, roll: 0,
    deviceShown: s.device === 'removed' ? 0 : 1,          // before backload it is held ready above the groin
    lever: s.foot === 'open' ? 1 : 0, foot: s.foot === 'open' ? 1 : 0,
    plunger: s.plunger === 'in' ? 1 : 0, needles: s.plunger === 'in' ? 1 : 0,
    haul: s.plunger === 'out' ? 1 : 0, plungerBack: s.plunger === 'out' ? 1 : 0,
    plungerShown: s.plunger === 'out' && s.cut ? 0 : 1,
    cut: s.cut ? 1 : 0, flushed: s.flushed ? 1 : 0,
    wireShown: s.wire === 'in' ? 1 : 0,
    sheathShown: s.sheath === 'in' ? 1 : 0,
    harvest: s.harvested ? 1 : 0,
    knotS: s.knotS,
    pusherShown: s.pusher === 'none' ? 0 : 1,
    pusherS: s.pusher === 'down' ? s.knotS : TRACT_LEN,
    lock: s.locked ? 1 : 0, trimmed: s.trimmed ? 1 : 0,
    gather: s.knotS === 0 ? 1 : 0,
    mark: 0,
    // the failure pictures (Phase 2); 0 on the correct path
    bleed: 0, deflectA: 0, deflectP: 0, toePivot: 0, cinchOnDevice: 0, sheathTorn: 0, wrap: 0,
  };
  p.holeOpen = 1 - p.gather;
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  if (deviceIn && geom.markerPortLocal) {
    const port = deviceFrame(p, computeSeat(geom), p.toePivot ? geom.toeLocal : null).toWorld(geom.markerPortLocal);
    p.mark = inLumen(port) ? 1 : 0;
  }
  return p;
}
