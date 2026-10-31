// What the Hands window points at for each ProGlide action: the parts that glow and an arrow (tip + direction, world mm).
// Only strands and the wire glow; every hard part gets the arrow alone (a glow on black or purple plastic reads as a new colour).
// Device-frame spots are on the modelled handle: lever paddle x 150–166 on top, QuickCut at x ≈ 128, thumb disc x ≈ 262.
import { W, tractPoint, deviceFrame } from '../scene/world.js';
import { TRACT_LEN } from '../scene/paths.js';

const a = W.ANGLE * Math.PI / 180, OUT = [Math.cos(a), Math.sin(a), 0], IN = OUT.map(v => -v);
const SKIN = (k = 8) => tractPoint(TRACT_LEN + k);

export function focusFor(action, pose, seat) {
  const F = deviceFrame(pose, seat), dev = (p) => F.toWorld(p), d = (v) => F.dir(v);
  switch (action) {
    case 'flush': return { nodes: [], tip: dev([124, -6, 26]), dir: d([0, 0, -1]) };
    case 'wireIn': case 'rewire': return { nodes: ['wire'], tip: SKIN(30), dir: IN };
    case 'wireOut': case 'wireOutFinal': return { nodes: ['wire'], tip: SKIN(60), dir: OUT };
    case 'sheathOut': return { nodes: ['sheath'], tip: SKIN(44), dir: OUT };
    case 'backload': case 'advanceToMark': return { nodes: [], tip: dev([96, 0, 18]), dir: IN };
    case 'retractToWall': case 'retractToPort': case 'removeDevice': return { nodes: [], tip: dev([120, 0, 18]), dir: OUT };
    case 'leverUp': return { nodes: [], tip: dev([160, 0, 26]), dir: d([0, 0, 1]) };
    case 'leverDown': return { nodes: [], tip: dev([160, 0, 15]), dir: d([0, 0, -1]) };
    case 'plungerIn': return { nodes: [], tip: dev([268, 0, 0]), dir: d([-1, 0, 0]) };
    case 'plungerOut': return { nodes: [], tip: dev([300, 0, 0]), dir: d([1, 0, 0]) };
    case 'quickCut': return { nodes: [], tip: dev([128.5, 0, 16]), dir: d([0, 0, -1]) };
    case 'harvest': return { nodes: ['rail', 'nonRail'], tip: SKIN(40), dir: OUT };
    case 'loadPusher': case 'advanceKnot': return { nodes: ['rail'], tip: SKIN(36), dir: IN };
    case 'lock': return { nodes: ['nonRail'], tip: SKIN(52), dir: OUT };
    case 'trim': return { nodes: [], tip: SKIN(36), dir: IN };
    default: return null;
  }
}
