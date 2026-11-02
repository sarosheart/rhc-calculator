// DK crush: everything the page needs for this technique, assembled from bifurcation/js/dkcrush/.
import * as machine from '../dkcrush/machine.js';
import { poseOf, SWITCHES } from '../dkcrush/pose.js';
import { STEPS, ACTIONS, DONE } from '../dkcrush/steps.js';

export default {
  id: 'dk-crush', label: 'DK crush',
  intro: { title: 'DK crush', text: 'Two stents, the side branch first: crush its protrusion, kiss, stent the main vessel, kiss again.' },
  steps: STEPS, actions: ACTIONS, done: DONE, machine, poseOf, switches: SWITCHES,
  duration: (a, k) => machine.durationOf(a, k),
  // contrast after the moves an operator checks on an angiogram (the distal D1 before the crush, each POT, each kiss)
  puffAfter: new Set(['predilD1', 'placeSB', 'pso', 'potCrush', 'kissOut', 'placeStent', 'removeStentBalloon', 'pot', 'potAway']),
  // the names under the scrub bar, each at the first step of its stretch
  phases: [{ from: 0, label: 'Prepare' }, { from: 1, label: 'D1 stent' }, { from: 3, label: 'Crush' }, { from: 5, label: 'First kiss' }, { from: 7, label: 'LAD stent' }, { from: 9, label: 'Final kiss' }],
  cutPreset: (i) => (i < 1 ? 'whole' : 'core'),
  // the final product's "layers the last wire crossed" is measured as this rewire leaves it
  lastRewire: Object.freeze({ action: 'rewireCentral', wire: 'A' }),
};
