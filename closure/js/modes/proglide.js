// Perclose ProGlide, one device: everything the page needs for this mode, assembled from closure/js/proglide/.
import * as machine from '../proglide/machine.js';
import { poseOf } from '../proglide/pose.js';
import { STEPS, ACTIONS, DONE } from '../proglide/steps.js';
import { MISTAKES } from '../proglide/mistakes.js';
import { focusFor } from '../proglide/focus.js';
import { readGeom } from '../proglide/geom.js';
import { bites } from '../proglide/suture.js';
import { proglideInside, INSIDE_PRESETS, insidePresetName } from '../proglide/inside-layer.js';
import { proglideHands, handsPreset } from '../proglide/hands-layer.js';

const SLOW = new Set(['backload', 'plungerOut', 'retractToPort', 'removeDevice', 'advanceKnot', 'harvest']);

export default {
  id: 'proglide', label: 'ProGlide', intro: { title: 'Perclose ProGlide', text: 'Closing a 5–8F femoral artery puncture with one device.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  models: ['proglide.glb', 'trimmer.glb'],
  parts: [{ id: 'Foot', label: 'Foot' }, { id: 'cuff', label: 'Cuffs' }, { id: 'link', label: 'Link' },
    { id: 'rail', label: 'Blue strand (rail)' }, { id: 'nonRail', label: 'White-tipped strand (lock)' }, { id: 'knot', label: 'Knot' },
    { id: 'trimmer', label: 'Trimmer' }],
  readGeom: ([model]) => readGeom(model),
  poseOf,
  // what the shared groin needs from a pose: the hole, the stitch's bites, the wire and the procedure sheath
  shared(pose, geom) {
    const B = bites(geom);
    return { holeOpen: pose.holeOpen, gather: pose.gather, bites: [B.A.out[0], B.P.out[0]], wireShown: pose.wireShown, sheathShown: pose.sheathShown };
  },
  insideLayer: (view, root, [model, trimmer], geom) => proglideInside(view, root, { model, trimmer, geom }),
  handsLayer: (view, root, [model, trimmer], geom) => proglideHands(view, root, { model, trimmer, geom }),
  insidePreset: (i) => INSIDE_PRESETS[insidePresetName(i)],
  handsPreset: (i, pose, layer) => handsPreset(i, pose, layer.rig),
  focusFor: (a, pose, layer) => focusFor(a, pose, layer.rig.seat),
  duration: (a) => (SLOW.has(a) ? 2200 : 1300),
};
