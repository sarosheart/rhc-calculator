// The figure-of-8 subcutaneous stitch for femoral venous hemostasis after a large sheath (e.g. TEER), as published
// (plans/closure/research/angioseal_fig8.md Part 2) and as Saro ties it: cross the ends, twist them together three times,
// pass one end through the loop, pull and bring the knot down. Right groin; bites medial to lateral.
export const ACTIONS = Object.freeze({
  bite1: { label: 'Take the caudal bite' }, crossOver: { label: 'Cross over the sheath' }, bite2: { label: 'Take the cranial bite' },
  tension: { label: 'Hold both ends up, taut' }, sheathOut: { label: 'Sheath out, keeping tension' },
  crossEnds: { label: 'Cross the ends' }, twist3: { label: 'Twist them together 3 times' },
  throughLoop: { label: 'One end through the loop' }, pullDown: { label: 'Pull and bring the knot down' },
  dress: { label: 'Dress the site' },
  deepBite: { label: 'Take the bite deeper' }, shallowBite: { label: 'Take a shallow bite' }, tieNow: { label: 'Tie it down now' },
});
export const STEPS = Object.freeze([
  { id: 'bite1', title: 'Caudal bite, medial to lateral', actions: ['bite1'],
    text: 'With the venous sheath still in, take a bite through the subcutaneous tissue just caudal to where the sheath enters the skin: medial to lateral, about 1 to 1.5 cm deep.',
    cue: 'Superficial to the vessels: the needle never enters the vein or the artery. On a right groin seen from above, medial to lateral runs right to left.' },
  { id: 'cross', title: 'Across the skin, over the sheath', actions: ['crossOver'],
    text: 'Bring the suture across the skin, over the sheath, to the cranial side.', cue: 'This crossing is what makes the figure of eight.' },
  { id: 'bite2', title: 'Cranial bite, medial to lateral', actions: ['bite2'],
    text: 'Take the second bite just cranial to the skin entry, again medial to lateral, at the same depth.',
    cue: 'The two bites and the crossing now encircle the sheath\'s tract above the venotomy.' },
  { id: 'sheath', title: 'Tension, then the sheath out', actions: ['tension', 'sheathOut'],
    text: 'Hold the two ends up across the puncture, taut, while the sheath is pulled out.', cue: 'The stitch takes over the moment the sheath leaves the tract.' },
  { id: 'knot', title: 'Tie it down', actions: ['crossEnds', 'twist3', 'throughLoop', 'pullDown'],
    text: 'Cross the ends, twist them together three times, pass one end through the loop, then pull and bring the knot down onto the skin.',
    cue: 'Pulling gathers the skin and fat over the venotomy into a tamponade. The vein wall itself is not stitched.' },
  { id: 'after', title: 'Dress it, take it out in a few hours', actions: ['dress'],
    text: 'Dress the site. The stitch is cut and removed after about 4 to 8 hours, per the protocol.', cue: 'Silk or braided polyester: it comes out, it is not absorbed.' },
]);
export const DONE = Object.freeze({ title: 'Done',
  text: 'The skin and fat over the venotomy gathered under a figure-of-eight stitch knotted on the skin; it comes out after a few hours.' });
