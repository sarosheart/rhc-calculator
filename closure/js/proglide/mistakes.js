// What goes wrong when a ProGlide step is done wrong: what happened, why, and what the instructions say to do about it.
// Sources (plans/closure/research/perclose.md): shallow angle and twisting — §C step 4 mistakes (Abbott in-service deck,
// IFU precautions); tightening on the device — §B precautions (IFU 2018 p6); the white strand early or with the wire in —
// §C steps 8 and 12; twisting the knot pusher — §C step 11.
export const MISTAKES = Object.freeze({
  shallow: {
    title: 'Too shallow: the foot lifted off the wall',
    what: 'At 30° the back end of the foot tips away from the wall and leaves a gap under it, and the posterior needle misses its cuff.',
    why: 'The needles and the cuffs line up only with the device at about 45° and the whole foot flat against the wall; at a shallow angle the foot can also break.',
    fix: 'Do not fire the needles again. Put the wire back in through the exit port, take the device out over it and use a new device.',
  },
  twist: {
    title: 'Twisted while firing: cuff miss',
    what: 'Turning the device as the needles went out pushed the anterior needle sideways, and it missed its cuff.',
    why: 'Each needle has to land in its cuff to pick up the link. When the plunger comes out there will be no suture on the anterior needle.',
    fix: 'Do not fire the needles again. Put the wire back in through the exit port, take the device out over it and use a new device.',
  },
  tightenOnDevice: {
    title: 'Tightened on the device',
    what: 'Pulling the strands tight with the device still in cinched the stitch round the device\'s catheter instead of the artery wall.',
    why: 'The loop closes on whatever runs through it; the catheter tip can tear off inside the vessel.',
    fix: 'Take the device out first, keeping only slow, steady tension on the blue strand, and tighten after it is out.',
  },
  lockedHigh: {
    title: 'The knot locked in the tract',
    what: 'Pulling the white strand cinched the knot where it was, partway down the tract and short of the artery wall. The stitch round the hole stays loose and blood tracks up past it.',
    why: 'The white strand locks the knot. It stays slack until the blue strand has carried the knot all the way down to the wall.',
    fix: 'Slide the knot down on the blue strand first; pull the white strand only with the trimmer sitting on the knot at the wall.',
  },
  lockedOnWire: {
    title: 'Locked with the wire still in',
    what: 'The knot is down and locked while the wire still runs through the closure.',
    why: 'Locking is final: once locked, the knot can no longer be re-advanced. Until the knot-down site is dry, the wire is the way back in for another device or a sheath.',
    fix: 'Keep the wire in until the knot-down site is dry, then pull it and lock.',
  },
  railWrapped: {
    title: 'The blue strand wrapped round the trimmer',
    what: 'Turning the trimmer as it went down wound the blue strand round its shaft, and the knot stopped sliding short of the wall.',
    why: 'The knot slides only along a straight, taut blue strand.',
    fix: 'Keep the thumb knob at 12 o\'clock and slide the trimmer straight down without turning it.',
  },
});
