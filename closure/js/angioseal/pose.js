// What the two windows draw for an Angio-Seal state: numbers only, so the animator can tween them.
import { inLumen } from '../scene/world.js';
import { TRACK_HOLE, trackPoint } from '../scene/paths.js';
import { TIP } from './machine.js';
import { AS } from './geometry.js';

const STAGE = { carrier: 0, released: 1, caught: 2, wall: 3 };
const COLLAGEN = { carrier: 0, plug: 1, mound: 2 };
// what each mistake leaves behind (plans/closure/2026-10-30-phase3-angioseal-plan.md, the mistakes table)
const FAILED = {
  sheathSlipped: () => ({ tipArc: TRACK_HOLE + TIP.slipped, anchorStage: 1, deviceShown: 1, anchorOutside: 1 }),
  forcedBackWall: () => ({ anchorStage: 1, deviceShown: 1, backWall: 1 }),
  prematureCatch: () => ({ anchorStage: 2, capBack: 0.25, oblique: 1, capCoversBand: 1 }),   // caught early: the cap stopped short, over the band
  collagenIn: () => ({ collagen: 2, tamperS: 3.2, collagenIn: 1, blackMarker: 0 }),
  overTamped: () => ({ bent: 1, split: 1, tamperS: 3.0 }),
};

export function poseOf(s) {
  const tipArc = TRACK_HOLE + s.tipIn;
  const p = {
    holeOpen: 1, gather: 0, wireShown: s.wire === 'in' ? 1 : 0, sheathShown: s.proc === 'in' ? 1 : 0,   // shared groin
    insShown: s.ins === 'removed' ? 0 : 1, tipArc, locatorShown: s.locator === 'in' ? 1 : 0, drip: 0,
    deviceShown: s.device === 'in' ? 1 : 0, capBack: s.capBack, anchorStage: STAGE[s.anchor],
    collagen: COLLAGEN[s.collagen], tamperShown: s.tamper === 'shown' || s.tamper === 'down' ? 1 : 0,
    tamperS: s.tamper === 'down' ? AS.MOUND_H / Math.SQRT1_2 * 0.5 + 2.2 : AS.PLUG_LEN + 1.5,
    suturePaid: s.paid ? 1 : 0, clearStop: s.clearStop && !s.cut1 ? 1 : 0, blackMarker: s.marker ? 1 : 0,
    cutTop: s.cut1 ? 1 : 0, cutSkin: s.cut2 ? 1 : 0, checked: s.checked ? 1 : 0,
    anchorOutside: 0, backWall: 0, oblique: 0, capCoversBand: 0, collagenIn: 0, bent: 0, split: 0,
  };
  if (p.locatorShown && p.insShown) p.drip = inLumen(trackPoint(tipArc - AS.INLET_BACK)) ? 1 : 0;
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  return p;
}
