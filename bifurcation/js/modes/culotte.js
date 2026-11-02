// Culotte: everything the page needs for this technique, assembled from bifurcation/js/culotte/.
import * as machine from '../culotte/machine.js';
import { poseOf, SWITCHES } from '../culotte/pose.js';
import { STEPS, ACTIONS, DONE } from '../culotte/steps.js';

export default {
  id: 'culotte', label: 'Culotte',
  intro: { title: 'Culotte', text: 'Two stents, the side branch first from the main vessel, then the main vessel through its side: they overlap in the main vessel.' },
  steps: STEPS, actions: ACTIONS, done: DONE, machine, poseOf, switches: SWITCHES,
  duration: (a, k) => machine.durationOf(a, k),
  puffAfter: new Set(['predilD1', 'placeSB', 'potCu', 'openLAD', 'placeStent', 'removeStentBalloon', 'potLAD', 'kissOut', 'rePot']),
  phases: [{ from: 0, label: 'Prepare' }, { from: 1, label: 'D1 stent' }, { from: 3, label: 'Open to the LAD' }, { from: 5, label: 'LAD stent' }, { from: 7, label: 'Kiss' }],
  cutPreset: (i) => (i < 1 ? 'whole' : 'core'),
  lastRewire: Object.freeze({ action: 'recrossD1', wire: 'B' }),
};
