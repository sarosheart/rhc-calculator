// Mini-crush: everything the page needs for this technique, assembled from bifurcation/js/minicrush/.
import * as machine from '../minicrush/machine.js';
import { poseOf, SWITCHES } from '../minicrush/pose.js';
import { STEPS, ACTIONS, DONE } from '../minicrush/steps.js';

export default {
  id: 'mini-crush', label: 'Mini-crush',
  intro: { title: 'Mini-crush', text: 'Two stents, the side branch first with a short protrusion that the main-vessel stent crushes, then one kiss.' },
  steps: STEPS, actions: ACTIONS, done: DONE, machine, poseOf, switches: SWITCHES,
  duration: (a, k) => machine.durationOf(a, k),
  puffAfter: new Set(['predilD1', 'placeSB', 'deploySB', 'removeStentBalloon', 'pot', 'kissOut', 'rePot']),
  // the names under the scrub bar, each at the first step of its stretch
  phases: [{ from: 0, label: 'Prepare' }, { from: 1, label: 'Stents' }, { from: 4, label: 'Crush' }, { from: 6, label: 'Kiss' }],
  cutPreset: (i) => (i < 1 ? 'whole' : 'core'),
  lastRewire: Object.freeze({ action: 'rewireBoth', wire: 'A' }),
};
