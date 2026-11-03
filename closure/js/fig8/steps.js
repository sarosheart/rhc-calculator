// The figure-of-8 as Saro does it (plans/closure/research/saro_fig8_fisherman_knot.pdf; plans/closure/fig8_2026-11-02.md):
// an optional stitch over the puncture when it still oozes after a pre-close — the large venous sheath out, both pre-close
// sutures tied. Two bites crossed over the puncture, then a fisherman's knot on the needle end, every pass its own move
// (Saro, 2026-11-01: "show each loop one by one"), slid down onto the puncture. Right groin; bites medial to lateral.
export const ACTIONS = Object.freeze({
  bite1: { label: 'Take the caudal bite' }, crossOver: { label: 'Cross over the puncture' }, bite2: { label: 'Take the cranial bite' },
  bringDown: { label: 'Bring both ends down' }, wrap1: { label: 'First wrap' }, wrap2: { label: 'Second wrap' }, wrap3: { label: 'Third wrap' },
  throughLoop: { label: 'Back through the first loop' }, throughBigLoop: { label: 'Back through the big loop' },
  setKnot: { label: 'Pull the end to set it' }, slideDown: { label: 'Slide the knot down onto the puncture' },
  dress: { label: 'Cut the needle off and dress' },
  deepBite: { label: 'Take the bite deeper' }, shallowBite: { label: 'Take a shallow bite' },
});
export const STEPS = Object.freeze([
  { id: 'bite1', title: 'Caudal bite, medial to lateral', actions: ['bite1'],
    text: 'The pre-close sutures are tied and the sheath is out, but the puncture still oozes. A figure of eight over it is optional. Start a little caudal to the puncture: one bite medial to lateral, deep through the subcutaneous tissue.',
    cue: 'Superficial to the vessels: the needle never enters the vein or the artery. Seen from above with the head at the top, medial to lateral runs right to left.' },
  { id: 'cross', title: 'Across, over the puncture', actions: ['crossOver'],
    text: 'Carry the needle and suture diagonally across the skin, over the puncture, to the cranial side.', cue: 'One limb of the eight.' },
  { id: 'bite2', title: 'Cranial bite, medial to lateral', actions: ['bite2'],
    text: 'Take the second bite a little cranial to the puncture, again medial to lateral and as deep, under the tract the sheath left.',
    cue: 'Leave the needle on: the knot is tied on this end.' },
  { id: 'knot', title: 'The fisherman\'s knot', actions: ['bringDown', 'wrap1', 'wrap2', 'wrap3', 'throughLoop', 'throughBigLoop', 'setKnot'],
    text: 'Bring both ends down together. Wrap the other end round the needle end three times, over then under each time, working away from the stitch. Pass it back under the needle end through the first loop, by the stitch, then back through the big loop it made. Pull it to set the knot.',
    cue: 'The knot holds on the needle end but can still slide along it.' },
  { id: 'down', title: 'Down onto the puncture', actions: ['slideDown'],
    text: 'Slide the knot up the needle end onto the skin over the puncture and snug it: the tissue gathers over the tract.',
    cue: 'The two ends coming in to the knot cross the stitch\'s diagonal over the puncture: the eight.' },
  { id: 'after', title: 'Cut the needle off, dress it', actions: ['dress'],
    text: 'Cut the needle off, trim the ends and dress the site. The stitch is cut and taken out after a few hours, per the lab\'s protocol.',
    cue: 'Silk or braided polyester: it comes out, it is not absorbed.' },
]);
export const DONE = Object.freeze({ title: 'Done',
  text: 'Two bites crossed over the puncture and a fisherman\'s knot slid down onto it: a figure of eight that gathers the tissue over the tract after a pre-close.' });
