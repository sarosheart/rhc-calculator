// Provisional stenting: everything the page needs for this technique, assembled from bifurcation/js/provisional/.
import * as machine from '../provisional/machine.js';
import { poseOf, SWITCHES } from '../provisional/pose.js';
import { STEPS, ACTIONS, DONE } from '../provisional/steps.js';

export default {
  id: 'provisional', label: 'Provisional',
  intro: { title: 'Provisional stenting', text: 'One stent across the side branch, then the side branch only if it needs it.' },
  steps: STEPS, actions: ACTIONS, done: DONE, machine, poseOf, switches: SWITCHES,
  duration: (a, k) => machine.durationOf(a, k),
  // contrast is injected after the moves an operator checks on an angiogram
  puffAfter: new Set(['predilD1', 'placeStent', 'removeStentBalloon', 'pot', 'kissOut', 'rePot']),
  // the cut-open window's camera: the whole bifurcation while wiring and preparing, then its core
  // the names under the scrub bar, each at the first step of its stretch
  phases: [{ from: 0, label: 'Prepare' }, { from: 2, label: 'LAD stent' }, { from: 4, label: 'D1' }],
  cutPreset: (i) => (i < 2 ? 'whole' : 'core'),
  // the final product's "layers the last wire crossed" is measured as this rewire leaves it
  lastRewire: Object.freeze({ action: 'recrossD1', wire: 'B' }),
};
