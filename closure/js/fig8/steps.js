// The figure-of-8 subcutaneous stitch for femoral venous hemostasis after a large sheath (e.g. TEER): the "fellow's stitch"
// as Kumar 2019 describes it (PMID 31636798; plans/closure/research/angioseal_fig8.md Part 2) — a deep caudal bite under
// the sheath, the suture crossed over it, a superficial cranial bite over it, and a fisherman's knot on top, slid down as
// the sheath comes out — with the knot tied as Saro ties it: cross the ends, twist them together three times, one end
// through the loop, pull and bring the knot down. Saro: "show each loop one by one", so every twist is its own move.
// Right groin; bites medial to lateral.
export const ACTIONS = Object.freeze({
  bite1: { label: 'Take the deep caudal bite' }, crossOver: { label: 'Cross over the sheath' }, bite2: { label: 'Take the shallow cranial bite' },
  crossEnds: { label: 'Cross the ends' }, wrap1: { label: 'First twist' }, wrap2: { label: 'Second twist' }, wrap3: { label: 'Third twist' },
  throughLoop: { label: 'One end back through the loop' },
  sheathOut: { label: 'Pull the sheath, knot following' }, pullDown: { label: 'Pull the knot down onto the skin' },
  dress: { label: 'Dress the site' },
  deepBite: { label: 'Take the bite deeper' }, shallowBite: { label: 'Take a shallow bite' }, tieNow: { label: 'Cinch it down now' },
});
export const STEPS = Object.freeze([
  { id: 'bite1', title: 'Deep bite, caudal, medial to lateral', actions: ['bite1'],
    text: 'With the venous sheath still in, take a bite a little caudal to where the sheath enters the skin: medial to lateral, deep through the subcutaneous tissue, about 1 to 1.5 cm, passing under the sheath.',
    cue: 'Superficial to the vessels: the needle never enters the vein or the artery. Seen from above with the head at the top, medial to lateral runs right to left.' },
  { id: 'cross', title: 'Across the skin, over the sheath', actions: ['crossOver'],
    text: 'Carry the needle and suture across the skin, over the sheath, to the cranial side.', cue: 'The suture now crosses over the puncture: one limb of the eight.' },
  { id: 'bite2', title: 'Shallow bite, cranial, medial to lateral', actions: ['bite2'],
    text: 'Take the second bite a little cranial to the skin entry, again medial to lateral, but superficial: through the subcutaneous tissue above the sheath, which runs under the skin here.',
    cue: 'Deep below the sheath caudally, shallow above it cranially: the course of the suture is a Z, and the needle comes off.' },
  { id: 'knot', title: 'A fisherman\'s knot on top', actions: ['crossEnds', 'wrap1', 'wrap2', 'wrap3', 'throughLoop'],
    text: 'Over the skin entry, cross the two ends. Twist one round the other three times, one twist at a time, then pass the end back through the loop. Leave it loose.',
    cue: 'The two ends crossing over the puncture make the figure of eight. The knot slides on the straight end, so it can follow the sheath down.' },
  { id: 'down', title: 'Sheath out, knot down', actions: ['sheathOut', 'pullDown'],
    text: 'Pull the sheath out while the knot slides down after it, then pull the ends to bring the knot down snug on the skin over the puncture.',
    cue: 'Pulling gathers the skin and fat over the venotomy into a tamponade. The vein wall itself is not stitched.' },
  { id: 'after', title: 'Dress it, take it out in a few hours', actions: ['dress'],
    text: 'Dress the site. The stitch is cut and removed after about 4 to 8 hours, per the protocol.', cue: 'Silk or braided polyester: it comes out, it is not absorbed.' },
]);
export const DONE = Object.freeze({ title: 'Done',
  text: 'Two bites in a Z, deep under the sheath and shallow over it, crossed over the puncture into a figure of eight and held by a fisherman\'s knot on the skin; it comes out after a few hours.' });
