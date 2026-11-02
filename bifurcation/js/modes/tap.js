// T / TAP: everything the page needs for this technique, assembled from bifurcation/js/tap/.
import * as machine from '../tap/machine.js';
import { poseOf, SWITCHES } from '../tap/pose.js';
import { STEPS, ACTIONS, DONE } from '../tap/steps.js';

export default {
  id: 'tap', label: 'T / TAP',
  intro: { title: 'T and small protrusion (TAP)', text: 'Provisional first. If D1 then needs a stent, a short one goes in through the LAD stent’s opened cell, protruding a little, and is kissed with an LAD balloon.' },
  steps: STEPS, actions: ACTIONS, done: DONE, machine, poseOf, switches: SWITCHES,
  duration: (a, k) => machine.durationOf(a, k),
  puffAfter: new Set(['predilD1', 'placeStent', 'removeStentBalloon', 'pot', 'checkD1', 'placeSB', 'kissOut', 'potShort']),
  phases: [{ from: 0, label: 'Provisional' }, { from: 6, label: 'Bail-out' }, { from: 9, label: 'Kiss' }],
  cutPreset: (i) => (i < 2 ? 'whole' : 'core'),
  lastRewire: Object.freeze({ action: 'recrossD1', wire: 'B' }),
};
