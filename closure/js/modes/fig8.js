// The figure-of-8 venous stitch: assembled from closure/js/fig8/. No models — the sheath, needle and silk are drawn.
import * as machine from '../fig8/machine.js';
import { poseOf } from '../fig8/pose.js';
import { STEPS, ACTIONS, DONE } from '../fig8/steps.js';
import { MISTAKES } from '../fig8/mistakes.js';
import { fig8Inside, fig8Hands } from '../fig8/layers.js';
import { HANDS_TOP, PUNCTURE, BITE } from '../fig8/geometry.js';

const SQ = Math.SQRT1_2;
const INSIDE = {
  top: { target: [30, -7, 0], dir: [0.3, 1, 0.05], radius: 24 },                   // from above: head at the top, lateral left
  side: { target: [24, -15, 0], dir: [0.18, 0.30, 1], radius: 22 },
};
// steps: 0 caudal bite · 1 cross · 2 cranial bite · 3 sheath out · 4 knot · 5 dress
const lift = (y) => [PUNCTURE[0], y, PUNCTURE[2]];
export default {
  id: 'fig8', label: 'Figure-of-8', intro: { title: 'Figure-of-8 stitch (vein)', text: 'Hemostasis after a large femoral venous sheath, tied the way it is taught here.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  models: [],
  parts: [{ id: 'silk', label: 'Silk' }, { id: 'needle', label: 'Needle' }, { id: 'sheath', label: '24F sheath' }],
  readGeom: () => ({}),
  poseOf: (s) => poseOf(s),
  shared: (p) => ({ holeOpen: p.holeOpen, gather: 0, bites: [-4, 4], wireShown: 0, sheathShown: 0, topView: p.topView, venous: 1, tractClose: p.gather }),
  insideLayer: (view, root) => fig8Inside(view, root),
  handsLayer: (view, root) => fig8Hands(view, root),
  insidePreset: () => INSIDE.side,          // the side cutaway shows each bite's depth against the skin and the vein
  handsPreset: () => HANDS_TOP,
  focusFor(a) {
    if (a === 'bite1' || a === 'bite2' || a === 'deepBite' || a === 'shallowBite') return { nodes: [], tip: [a === 'bite2' ? BITE.x.cranial : BITE.x.caudal, 10, 4], dir: [0, 0, 1] };
    if (a === 'crossOver') return { nodes: [], tip: [30, 10, 0], dir: [-1, 0, -1] };
    if (a === 'tension' || a === 'tieNow' || a === 'pullDown') return { nodes: [], tip: lift(a === 'pullDown' ? 14 : 8), dir: a === 'pullDown' ? [0, -1, 0] : [0, 1, 0] };
    if (a === 'sheathOut') return { nodes: [], tip: [30 + 30 * SQ, 30 * SQ, 0], dir: [SQ, SQ, 0] };
    return null;
  },
  duration: (a) => (a === 'twist3' || a === 'sheathOut' || a === 'bite1' || a === 'bite2' ? 1800 : 1200),
};
