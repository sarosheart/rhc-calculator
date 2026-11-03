// Provisional stenting of the LAD / D1 bifurcation, step by step (design §6.1; brief §A1, the EBC stepwise sequence, and its
// LAD/diagonal worked example). Each step: what to do, what tells you it worked, and the actions that make it up, in order.
// The two wires are named by colour: teal went to D1 first, gold to the LAD; after the rewire they swap branches.

export const ACTIONS = Object.freeze({
  wireD1: { label: 'Wire D1 (teal)' },
  wireLAD: { label: 'Wire the LAD (gold)' },
  predilLAD: { label: 'Predilate the LAD' },
  predilD1: { label: 'Predilate D1' },
  placeStent: { label: 'Position the stent' },
  deployStent: { label: 'Deploy the stent' },
  removeStentBalloon: { label: 'Remove its balloon' },
  pot: { label: 'POT' },
  pullBackGold: { label: 'Pull the gold wire back to the carina' },
  recrossD1: { label: 'Drop into D1 through the distal cell' },
  pullJailed: { label: 'Pull the jailed teal wire' },
  tealToLAD: { label: 'Teal wire down the LAD' },
  kissIn: { label: 'Position both balloons' },
  kissInflate: { label: 'Kiss' },
  kissOut: { label: 'Remove both balloons' },
  rePot: { label: 'Re-POT' },
  wiresOut: { label: 'Remove the wires' },
});

export const STEPS = Object.freeze([
  { id: 'wire', title: 'Wire both branches', actions: ['wireD1', 'wireLAD'],
    text: 'Wire the harder branch first, here the tight D1, so the wires do not wrap, then the LAD. The D1 wire stays in while the LAD is stented: it protects D1 and marks its origin.',
    cue: 'Teal wire in D1, gold wire in the distal LAD.' },
  { id: 'prep', title: 'Prepare both branches', actions: ['predilLAD', 'predilD1'],
    text: 'Predilate the LAD across the bifurcation, then D1. The EBC prepares both branches when the side-branch lesion is longer than 10 mm, and uses a non-compliant balloon in the side branch.',
    cue: '3.0 × 15 mm non-compliant in the LAD, 2.0 × 12 mm non-compliant in D1.' },
  { id: 'stent', title: 'Stent the LAD across D1', actions: ['placeStent', 'deployStent', 'removeStentBalloon'],
    text: 'A 3.0 × 22 mm stent, sized 1:1 to the distal LAD, from the proximal LAD across the origin of D1, leaving at least 8 mm of stent above the carina for the POT balloon. Deploying it jails the teal D1 wire.',
    cue: 'The stent is small for the 3.75 mm proximal LAD, and the carina shifts toward D1: its ostium narrows.' },
  { id: 'pot', title: 'Proximal optimisation (POT)', actions: ['pot'],
    text: 'A short 3.75 mm non-compliant balloon, 1:1 to the proximal LAD, its distal end at the carina and its proximal end inside the stent. It expands the stent to the proximal LAD, presses its struts to the wall and pushes those in front of D1 toward its ostium.',
    cue: 'Place it with stent boost: the distal shoulder on the carina, never past it.' },
  { id: 'rewire', title: 'Rewire D1 through a distal cell', actions: ['pullBackGold', 'recrossD1', 'pullJailed', 'tealToLAD'],
    text: 'Pull the gold wire back, tip turned toward D1, until it drops through the distal cell at the carina, then advance it into D1. Pull the jailed teal wire from behind the stent and pass it down the LAD.',
    cue: 'Check it with stent boost: through a proximal cell the kiss would leave struts across D1 and a metal neo-carina.' },
  { id: 'kiss', title: 'Kissing balloons', actions: ['kissIn', 'kissInflate', 'kissOut'],
    text: 'Short non-compliant balloons sized 1:1 to each branch, 3.0 mm in the LAD and 2.5 mm in D1, their proximal ends level just above the carina. Inflate each alone at high pressure, then both together, and deflate them together.',
    cue: 'The side cell opens and the struts in front of D1 are pushed aside. The kiss leaves the proximal LAD oval.' },
  { id: 'repot', title: 'Re-POT', actions: ['rePot', 'wiresOut'],
    text: 'POT again with the 3.75 mm balloon in the same place, proximal to the carina. It rounds the proximal LAD after the kiss and presses the struts back to the wall.',
    cue: 'Never distal to the carina: that would push struts back over D1.' },
]);

export const DONE = Object.freeze({ title: 'Provisional: the result',
  text: 'One stent, one layer: D1 opened through a distal cell, no metal neo-carina, the proximal LAD round again.' });
