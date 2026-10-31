// What the Hands window points at for each Angio-Seal action: an arrow along the move (the sheath assembly, the device cap,
// the tamper tube, the suture), placed from the pose. Only the wire and the procedure sheath glow; hard parts get the arrow.
import { tractPoint } from '../scene/world.js';
import { trackPoint, trackDir, TRACT_LEN } from '../scene/paths.js';
import { AS } from './geometry.js';

const SQ = Math.SQRT1_2, OUT = [SQ, SQ, 0], IN = [-SQ, -SQ, 0], UP = [-SQ, SQ, 0];
const lift = (p, d) => p.map((v, i) => v + UP[i] * d);

export function focusFor(action, p) {
  const hub = trackPoint(p.tipArc - AS.SHEATH_LEN), out = trackDir(p.tipArc - AS.SHEATH_LEN).map(v => -v);
  const onHub = (d, h = 14) => lift(hub.map((v, i) => v + out[i] * d), h);
  switch (action) {
    case 'checkAngio': return null;
    case 'snapLocator': return { nodes: [], tip: onHub(20), dir: out.map(v => -v) };
    case 'wireIn': return { nodes: ['wire'], tip: tractPoint(TRACT_LEN + 30), dir: IN };
    case 'procOut': return { nodes: ['sheath'], tip: tractPoint(TRACT_LEN + 44), dir: OUT };
    case 'advanceToDrip': case 'readvance': case 'deviceIn': return { nodes: [], tip: onHub(action === 'deviceIn' ? 40 : 26), dir: out.map(v => -v) };
    case 'pullBackToStop': case 'locatorOut': return { nodes: [], tip: onHub(36), dir: out };
    case 'pullCap': case 'rearLock': return { nodes: [], tip: onHub(48), dir: out };
    case 'toWall': case 'deployCollagen': case 'toClearStop': return { nodes: [], tip: onHub(56), dir: out };
    case 'tamp': return { nodes: [], tip: lift(tractPoint(TRACT_LEN + 16), 6), dir: IN };
    case 'cutTop': return { nodes: [], tip: lift(tractPoint(TRACT_LEN + AS.DEVICE_BACK + 30), 8), dir: UP.map(v => -v) };
    case 'cutSkin': return { nodes: [], tip: lift(tractPoint(TRACT_LEN + 2), 8), dir: UP.map(v => -v) };
    default: return null;
  }
}
