// Angio-Seal VIP: everything the page needs for this mode, assembled from closure/js/angioseal/.
import * as machine from '../angioseal/machine.js';
import { poseOf } from '../angioseal/pose.js';
import { STEPS, ACTIONS, DONE } from '../angioseal/steps.js';
import { MISTAKES } from '../angioseal/mistakes.js';
import { focusFor } from '../angioseal/focus.js';
import { angiosealInside, angiosealHands } from '../angioseal/layers.js';
import { trackPoint, TRACT_LEN } from '../scene/paths.js';
import { tractPoint } from '../scene/world.js';
import { AS } from '../angioseal/geometry.js';

const INSIDE = {
  wide: { target: [6, -19, 0], dir: [0.10, 0.26, 1], radius: 34 },
  tip: { target: [-8, -32.5, 0], dir: [0.12, 0.30, 1], radius: 12 },
  tract: { target: [6, -24, 0], dir: [0.10, 0.26, 1], radius: 17 },
  wall: { target: [0, -30.5, 0], dir: [0.14, 0.34, 1], radius: 10 },
};
// steps: 0 angiogram · 1 snap · 2 exchange · 3 depth · 4 locator out · 5 insert · 6 set · 7 to the wall · 8 collagen · 9 tamp · 10 cut
const insideName = (i) => (i <= 3 ? 'wide' : i <= 6 ? 'tip' : i === 7 ? 'wall' : i === 8 ? 'tract' : 'wall');
const SLOW = new Set(['advanceToDrip', 'toWall', 'deployCollagen', 'tamp', 'deviceIn']);

export default {
  id: 'angioseal', label: 'Angio-Seal', intro: { title: 'Angio-Seal VIP', text: 'Closing a 6–8F femoral artery puncture with an anchor and a collagen plug.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  models: ['angioseal.glb'],
  parts: [{ id: 'Anchor', label: 'Anchor' }, { id: 'collagen', label: 'Collagen' }, { id: 'TamperTube', label: 'Tamper tube' }],
  readGeom: () => ({}),
  poseOf: (s) => poseOf(s),
  shared: (p) => ({ holeOpen: p.holeOpen, gather: p.gather, bites: [-4, 4], wireShown: p.wireShown, sheathShown: p.sheathShown }),
  insideLayer: (view, root, models) => angiosealInside(view, root, models),
  handsLayer: (view, root, models) => angiosealHands(view, root, models),
  insidePreset: (i) => INSIDE[insideName(i)],
  handsPreset(i, p) {
    if (i === 0 || i >= 8) return { target: tractPoint(TRACT_LEN + (i === 0 ? 40 : 28)), dir: [0.22, 0.85, 1], radius: i === 0 ? 70 : 50 };
    const hub = trackPoint(p.tipArc - AS.SHEATH_LEN + 6);          // the caps, where the hands are
    return { target: hub, dir: [0.26, 0.62, 1], radius: 40 };
  },
  focusFor: (a, p) => focusFor(a, p),
  duration: (a) => (SLOW.has(a) ? 2000 : 1300),
};
