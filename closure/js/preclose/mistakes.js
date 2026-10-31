// What goes wrong in pre-close (plans/closure/research/perclose.md §D2–D3, Abbott in-service deck s34, s46, s47).
export const MISTAKES = Object.freeze({
  oneLimb: {
    title: 'One strand pulled alone',
    what: 'One strand pulled alone moves the knot: the blue strand alone runs it down, the white strand alone locks it. Here it ran down and locked partway up the tract.',
    why: 'In pre-close the knot has to wait for the end of the case; the two strands are held and clamped together.',
    fix: 'Pull both strands out held together and clamp them at once with a shodded hemostat.',
  },
  overRotated: {
    title: 'Turned too far',
    what: 'At 60° the twist strains the device where its two guides meet; they can separate and the device can get trapped.',
    why: 'The IFU turns each device only about 30°, especially in stiff, diseased tissue.',
    fix: 'Turn about 30° toward the side the step names, before opening the foot.',
  },
  slackLoop: {
    title: 'Slack left in a parked suture',
    what: 'Suture 2 was parked with slack in it. The large sheath went in through the loops and pushed that slack into the vessel.',
    why: 'Slack in the tract tangles or is carried in by the sheath and the exchanges.',
    fix: 'Clamp both strands together and pull gently until taut before laying them down.',
  },
  lockedOutOfOrder: {
    title: 'Knot 2 locked first',
    what: 'Knot 2 was locked over a loose knot 1. The strands tangle and the first stitch is left slack: a partial closure.',
    why: 'The first suture placed is the bottom one, nearest the vessel. It has to be down and locked before the one above it.',
    fix: 'Re-advance knot 1 with the rail taut, lock it, then do knot 2.',
  },
  lockedWireIn: {
    title: 'Locked with the wire still in',
    what: 'Knot 1 is locked while the wire still runs through the closure.',
    why: 'Until the bleeding is controlled the wire is the way back in for a third device or a sheath.',
    fix: 'Advance both knots without locking, check the bleeding, pull the wire, then lock in order.',
  },
});
