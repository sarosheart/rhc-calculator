// What goes wrong when an Angio-Seal step is done wrong (Terumo IFU; plans/closure/research/angioseal_fig8.md §1C).
export const MISTAKES = Object.freeze({
  sheathSlipped: {
    title: 'The sheath slid back',
    what: 'The sheath moved out after the locator came out, so its tip was no longer inside the artery when the device pushed the anchor out. The anchor ended up in the wall and the tract, outside the lumen.',
    why: 'The anchor can only catch on the inside of the wall if it is released inside the artery.',
    fix: 'Do not move the sheath between taking out the locator and pulling back the anchor. If it moves, put the wire and locator back in first. If the device comes out, hold pressure and check that every part came out with it.',
  },
  forcedBackWall: {
    title: 'Forced against the back wall',
    what: 'Pushing on through the resistance drove the anchor down into the back wall of the artery.',
    why: 'Strong resistance near full insertion means the anchor is hitting the posterior wall; back-wall plaque can block it too.',
    fix: 'Do not force it. Lower the sheath angle or pull the sheath back 1 to 2 mm, then insert again.',
  },
  prematureCatch: {
    title: 'Caught too early: the anchor is crooked',
    what: 'Pulling the cap back fast caught one end of the anchor on the sheath tip, so it sits at an angle instead of flat. The cap\'s edge covers the coloured band.',
    why: 'A crooked anchor will not sit flat on the inside of the wall and can pull through.',
    fix: 'Push the device back into the sheath and pull again slowly until the cap\'s edge stops within the coloured bands. Do not go on until it has caught properly.',
  },
  collagenIn: {
    title: 'Collagen pushed into the artery',
    what: 'Tamping with the suture slack pushed part of the collagen through the hole into the lumen.',
    why: 'Only tension on the suture holds the anchor against the wall while the collagen is pressed onto it. Collagen in the artery can cause thrombosis or occlusion.',
    fix: 'Keep pulling the device back to hold the suture taut while you push the tamper tube down.',
  },
  overTamped: {
    title: 'Tamped too hard',
    what: 'Tamping on past the black marker pushed the middle of the anchor up into the hole and split the collagen.',
    why: 'Resistance and the black marker mean the sandwich is already tight; more force deforms the anchor and tears the collagen.',
    fix: 'Stop at resistance and the black marker, check hemostasis, then cut.',
  },
});
