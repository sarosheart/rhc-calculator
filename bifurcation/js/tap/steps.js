// T and small protrusion (TAP) of the LAD / D1 bifurcation, step by step (design §6.2; brief §A6, with §A5's T): Provisional
// to its kiss (distal rewire and kiss first, BURZ15), then the bail-out — D1 dissected after the kiss (EBC18: beyond type B),
// a short D1 stent through the LAD stent's opened cell, covering the upper edge of D1's ostium with a minimal protrusion,
// its balloon pulled back and re-inflated, a kiss with a balloon parked in the LAD, and a POT short of the new carina.
import { STEPS as P, ACTIONS as PA } from '../provisional/steps.js';

export const ACTIONS = Object.freeze({
  ...Object.fromEntries(['wireD1', 'wireLAD', 'predilLAD', 'predilD1', 'placeStent', 'deployStent', 'removeStentBalloon', 'pot',
    'pullBackGold', 'recrossD1', 'pullJailed', 'tealToLAD', 'kissIn', 'kissInflate', 'kissOut', 'wiresOut'].map(a => [a, PA[a]])),
  checkD1: { label: 'Inject: check D1' },
  parkMV: { label: 'Park the LAD balloon' },
  placeSB: { label: 'Position the D1 stent' },
  deploySB: { label: 'Deploy the D1 stent' },
  psoTap: { label: 'Pull back and re-inflate' },
  kissTap: { label: 'Kiss' },
  potShort: { label: 'Final POT' },
});

export const STEPS = Object.freeze([
  P[0], P[1], P[2], P[3], P[4],
  { ...P[5], cue: 'In this patient the D1 balloon tears the ostium of D1.' },
  { id: 'check', title: 'D1 dissected: bail out to a stent', actions: ['checkD1'],
    text: 'Inject. D1’s ostium now shows a dissection flap with residual narrowing, beyond a type B dissection: one of the EBC’s reasons to stent the side branch after provisional. At this angle a plain T would leave a gap at D1’s take-off, so it goes in as TAP.',
    cue: 'In Provisional the same kiss leaves D1 open: the two techniques part here.' },
  { id: 'position', title: 'Position the D1 stent', actions: ['parkMV', 'placeSB'],
    text: 'A 3.0 mm balloon parked uninflated in the LAD across D1 for the kiss; then a 2.5 × 16 mm stent on the gold wire through the opened cell, its proximal marker about 2 mm into the LAD, the least that covers the upper edge of D1’s ostium here.',
    cue: 'Published protrusions are 1–2 mm: the best TAP is a T. Check it with stent enhancement.' },
  { id: 'deploy', title: 'Deploy, pull back, re-inflate', actions: ['deploySB', 'psoTap'],
    text: 'Deploy the D1 stent with the LAD balloon uninflated. Then pull its balloon back a little, level with the LAD balloon, and inflate it again at high pressure.',
    cue: 'Too proximal, the stent would block the LAD (then internal crush or culotte); too distal, it leaves the ostium bare.' },
  { id: 'kiss2', title: 'Kiss', actions: ['kissTap', 'kissOut'],
    text: 'Inflate the D1 stent’s balloon and the LAD balloon together, and deflate them together. The kiss presses the protruding struts on the carina side into a short wall of single-layer metal between the two branches: the new carina.',
    cue: 'Deflating them out of step can push the new carina aside.' },
  { id: 'finalpot', title: 'Final POT, short of the new carina', actions: ['potShort', 'wiresOut'],
    text: 'A final POT with a 3.75 × 6 mm balloon, its distal end well short of the new carina and its proximal end inside the LAD stent. It rounds the proximal LAD after the kiss; reaching the new carina, it would crush or displace it.',
    cue: 'Optional in the EBC’s sequence; shown here.' },
]);

export const DONE = Object.freeze({ title: 'T / TAP: the result',
  text: 'One layer in the LAD, D1’s ostium covered up to its upper edge, and a short single-layer carina of metal where the D1 stent protrudes.' });
