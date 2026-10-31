// What goes wrong with the figure-of-8 (plans/closure/research/angioseal_fig8.md §2A–2C). The deep bite is what every
// published description warns against; the shallow bite and tying on the sheath follow from the mechanism the papers
// describe, so their words say what would happen.
export const MISTAKES = Object.freeze({
  biteDeep: {
    title: 'Too deep: through the vein',
    what: 'The needle went deep enough to pass through the femoral vein.',
    why: 'The stitch is meant to gather the skin and fat over the venotomy. A bite into the vein, or the artery beside it, can tear it or tie it.',
    fix: 'Take the bite through subcutaneous tissue only, about 1 to 1.5 cm deep, superficial to the vessels.',
  },
  biteShallow: {
    title: 'Too shallow: skin only',
    what: 'The bite caught only skin. Tightening it would pucker the skin without pressing down on the tract or the venotomy.',
    why: 'The tamponade comes from gathering subcutaneous tissue; the stitch has failed where there was too little of it.',
    fix: 'Take a full subcutaneous bite, about 1 to 1.5 cm deep.',
  },
  tiedOnSheath: {
    title: 'Tied down with the sheath in',
    what: 'The knot was pulled down with the sheath still in, so the stitch would cinch round the sheath.',
    why: 'The figure of eight closes on whatever runs through it; tightened now, it grips the sheath instead of the tissue over the venotomy.',
    fix: 'Hold the ends up, taut, take the sheath out, then tie.',
  },
});
