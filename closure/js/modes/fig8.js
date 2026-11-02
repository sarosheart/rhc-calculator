// The figure-of-8 venous stitch: assembled from closure/js/fig8/. No models — the sheath, needle and silk are drawn.
import * as machine from '../fig8/machine.js';
import { poseOf } from '../fig8/pose.js';
import { STEPS, ACTIONS, DONE } from '../fig8/steps.js';
import { MISTAKES } from '../fig8/mistakes.js';
import { fig8Inside, fig8Hands } from '../fig8/layers.js';
import { HANDS_TOP, BITE, knotFrame } from '../fig8/geometry.js';

const SQ = Math.SQRT1_2;
// the side cutaway: the bites' depth against the skin, the sheath and the vein; from the knot on, framed higher to take in
// the knot above the skin
const INSIDE = {
  side: { target: [26, -12, 0], dir: [0.18, 0.30, 1], radius: 24 },
  knot: { target: [25, 4, 0], dir: [0.18, 0.30, 1], radius: 30 },
};
// steps: 0 caudal bite · 1 across · 2 cranial bite · 3 the knot · 4 sheath out, knot down · 5 dress
export default {
  id: 'fig8', label: 'Figure-of-8', intro: { title: 'Figure-of-8 stitch (vein)', text: 'Hemostasis after a large femoral venous sheath: a figure of eight of needle bites, a fisherman\'s knot on top.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  phases: [{ from: 0, label: 'Bites' }, { from: 3, label: 'Knot' }, { from: 4, label: 'Sheath out' }],
  models: [],
  parts: [{ id: 'silk', label: 'Silk' }, { id: 'needle', label: 'Needle' }, { id: 'sheath', label: '24F sheath' }],
  readGeom: () => ({}),
  poseOf: (s) => poseOf(s),
  // the 24F skin opening is larger than a 6F one; the tied stitch closes the tract (tamponade)
  shared: (p) => ({ holeOpen: p.holeOpen, gather: 0, bites: [-4, 4], wireShown: 0, sheathShown: 0, topView: p.topView, venous: 1,
    tractClose: p.gather, puncture: 2.4 }),
  insideLayer: (view, root) => fig8Inside(view, root),
  handsLayer: (view, root) => fig8Hands(view, root),
  insidePreset: (i) => (i >= 3 ? INSIDE.knot : INSIDE.side),
  handsPreset: () => HANDS_TOP,
  focusFor(a, p) {
    if (a === 'bite1' || a === 'deepBite' || a === 'shallowBite') return { nodes: [], tip: [BITE.caudal.x, 10, -14], dir: [0, -0.4, 1] };
    if (a === 'bite2') return { nodes: [], tip: [BITE.cranial.x, 10, -11], dir: [0, -0.4, 1] };
    if (a === 'crossOver') return { nodes: [], tip: [28, 12, 0], dir: [-1, 0, -1] };
    const F = knotFrame(p), at = (h) => F.base.map((v, i) => v + F.u[i] * h);
    if (a === 'crossEnds' || a === 'wrap1' || a === 'wrap2' || a === 'wrap3' || a === 'throughLoop') return { nodes: ['silk'], tip: at(4), dir: [0, -1, 0] };
    if (a === 'pullDown' || a === 'tieNow') return { nodes: ['silk'], tip: at(8), dir: [0, -1, 0] };
    if (a === 'sheathOut') return { nodes: ['sheath'], tip: [30 + 30 * SQ, 30 * SQ, 0], dir: [SQ, SQ, 0] };
    return null;
  },
  duration: (a) => (a === 'bite1' || a === 'bite2' ? 2600 : a === 'sheathOut' || a === 'crossOver' ? 2000 : 1300),
};
