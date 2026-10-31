// ProGlide pre-close (two devices, large bore): assembled from closure/js/preclose/ and the single-device ProGlide parts.
import * as machine from '../preclose/machine.js';
import { poseOf, devicePose } from '../preclose/pose.js';
import { STEPS, ACTIONS, DONE } from '../preclose/steps.js';
import { MISTAKES } from '../preclose/mistakes.js';
import { focusFor as oneFocus } from '../proglide/focus.js';
import { readGeom } from '../proglide/geom.js';
import { precloseInside, precloseHands } from '../preclose/layers.js';
import { INSIDE_PRESETS } from '../proglide/inside-layer.js';
import { handsPreset as oneHands } from '../proglide/hands-layer.js';
import { tractPoint } from '../scene/world.js';
import { TRACT_LEN } from '../scene/paths.js';

const SQ = Math.SQRT1_2;
const INSIDE = { ...INSIDE_PRESETS, top: { target: [0, -30.5, -0.5], dir: [0.02, 1, 0.16], radius: 12 } };
// steps: 0 prep · 1 exchange · 2 mark · 3 turn · 4 deploy 1 · 5 park 1 · 6 remove · 7 device 2 · 8 deploy 2 · 9 park 2 · 10 big · 11 end
const insideName = (i) => (i <= 2 ? 'wide' : i <= 4 ? 'wall' : i <= 6 ? 'tract' : i === 7 ? 'wide' : i === 8 ? 'wall' : 'top');
const base = (a) => a.replace(/2$/, '').replace('harvestBoth', 'harvest');
const SLOW = new Set(['backload', 'backload2', 'plungerOut', 'plungerOut2', 'retractToPort', 'retractToPort2', 'removeDevice', 'bigSheathIn', 'advance1', 'advance2']);

export default {
  id: 'preclose', label: 'Pre-close', intro: { title: 'ProGlide pre-close', text: 'Two devices placed before a large-bore sheath, knotted at the end of the case.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  models: ['proglide.glb', 'trimmer.glb', 'hemostat.glb'],
  parts: [{ id: 'Foot', label: 'Foot' }, { id: 'cuff', label: 'Cuffs' }, { id: 'link', label: 'Link' },
    { id: 'rail', label: 'Blue strand (rail)' }, { id: 'nonRail', label: 'White-tipped strand (lock)' }, { id: 'knot', label: 'Knot' },
    { id: 'trimmer', label: 'Trimmer' },
    { id: 'clamp', label: 'Hemostats' }, { id: 'bigSheath', label: 'Large sheath' }],
  readGeom: ([model]) => readGeom(model),
  poseOf,
  shared: (p) => ({ holeOpen: p.holeOpen, gather: p.gather, bites: [-4, 4], wireShown: p.wireShown, sheathShown: p.sheathShown, topView: p.topView }),
  insideLayer: (view, root, models, geom) => precloseInside(view, root, models, geom),
  handsLayer: (view, root, models, geom) => precloseHands(view, root, models, geom),
  insidePreset: (i) => INSIDE[insideName(i)],
  handsPreset(i, p, layer) {
    if (i >= 9 || i === 5 || i === 6) return { target: tractPoint(TRACT_LEN + 34), dir: [0.22, 0.85, 1], radius: 62 };
    const second = i >= 7;
    return oneHands(Math.min(i, 9), devicePose(p, second ? 'b' : 'a'), second ? { seat: layer.rigs.b.seat } : { seat: layer.rigs.a.seat });
  },
  // the target says whose parts glow (device: 'a' | 'b' | 'both'), so "Lock knot 2" lights suture 2's white strand
  focusFor(a, p, layer) {
    const k = a === 'trimAll' ? 'both' : /2$/.test(a) || a === 'parkSlack' || a === 'lock2First' ? 'b' : 'a';
    const t = (target) => target && { ...target, device: k };
    if (a === 'rotate1' || a === 'rotate2' || a === 'rotate60') return t({ nodes: [], tip: tractPoint(TRACT_LEN + 70), dir: [0, 0, a === 'rotate2' ? -1 : 1] });
    if (a === 'clamp1' || a === 'clamp2' || a === 'parkSlack' || a === 'pullOne') return t({ nodes: ['rail', 'nonRail'], tip: tractPoint(TRACT_LEN + 30), dir: [SQ, SQ, 0] });
    if (a === 'bigSheathIn' || a === 'advance1' || a === 'advance2') return t({ nodes: [], tip: tractPoint(TRACT_LEN + 40), dir: [-SQ, -SQ, 0] });
    if (/^lock|^trim/.test(a)) return t({ nodes: ['nonRail'], tip: tractPoint(TRACT_LEN + 40), dir: [SQ, SQ, 0] });
    return t(oneFocus(base(a), devicePose(p, k), layer.rigs[k].seat));
  },
  duration: (a) => (SLOW.has(a) ? 2000 : 1200),
};
