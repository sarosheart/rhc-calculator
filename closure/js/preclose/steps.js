// Perclose ProGlide pre-close for large-bore access (two devices), as the ProGlide 2018 IFU orders it
// (plans/closure/research/perclose.md §D2–D3). Each device's own deployment repeats the single-device steps.
import { ACTIONS as ONE } from '../proglide/steps.js';

const two = (label) => ({ label: label.replace('device', 'device 2') });
export const ACTIONS = Object.freeze({
  flush: { label: 'Flush both marker lumens' },
  wireIn: ONE.wireIn, sheathOut: ONE.sheathOut, backload: { label: 'Backload device 1 to the exit port' }, wireOut: ONE.wireOut,
  advanceToMark: ONE.advanceToMark, rotate1: { label: 'Turn device 1 30° to the patient\'s right' },
  leverUp: ONE.leverUp, retractToWall: ONE.retractToWall, plungerIn: ONE.plungerIn, plungerOut: ONE.plungerOut,
  quickCut: ONE.quickCut, leverDown: ONE.leverDown,
  retractToPort: ONE.retractToPort, harvestBoth: { label: 'Pull both strands out together' },
  clamp1: { label: 'Clamp both strands, take up the slack, park them right' },
  rewire: ONE.rewire, removeDevice: { label: 'Take device 1 out over the wire' },
  backload2: { label: 'Backload device 2 over the wire' }, wireOut2: ONE.wireOut, advanceToMark2: ONE.advanceToMark,
  rotate2: { label: 'Turn device 2 30° to the patient\'s left' },
  leverUp2: ONE.leverUp, retractToWall2: ONE.retractToWall, plungerIn2: ONE.plungerIn, plungerOut2: ONE.plungerOut,
  quickCut2: ONE.quickCut, leverDown2: ONE.leverDown,
  retractToPort2: ONE.retractToPort, harvestBoth2: { label: 'Pull both strands out together' },
  clamp2: { label: 'Clamp both strands, take up the slack, park them left' },
  rewire2: ONE.rewire, bigSheathIn: { label: 'Swap device 2 for the large sheath' },
  advance1: { label: 'Sheath out while advancing knot 1 — do not lock' },
  advance2: { label: 'Advance knot 2 — do not lock' },
  wireOutEnd: { label: 'Bleeding controlled: pull the wire' },
  lock1: { label: 'Lock knot 1 (white strand)' }, lock2: { label: 'Lock knot 2 (white strand)' },
  trimAll: { label: 'Trim all four strands' },
  // wrong moves the page offers
  pullOne: { label: 'Pull one strand alone' }, rotate60: { label: 'Turn it 60°' },
  parkSlack: { label: 'Park it without taking up the slack' }, lock2First: { label: 'Lock knot 2 first' },
  lock1Now: { label: 'Lock knot 1 now' },
});

const DEPLOY = 'Lever up and pull the foot to the wall, plunger in, plunger out, cut with QuickCut, lever down — as for one device, keeping the turn.';
export const STEPS = Object.freeze([
  { id: 'prep', title: 'Flush both devices', actions: ['flush'],
    text: 'Above 8F in an artery (14F in a vein) the IFU asks for at least two devices, placed before the large sheath goes in.',
    cue: 'Pre-close: the stitches go in first; the knots wait until the end of the case.' },
  { id: 'exchange', title: 'Swap the sheath for device 1', actions: ['wireIn', 'sheathOut', 'backload', 'wireOut'],
    text: 'Over a 0.038″ wire, take the sheath out with pressure on the groin and backload device 1 until the wire exit port is just above the skin; pull the wire.',
    cue: 'Exactly as for one device.' },
  { id: 'mark1', title: 'Device 1 to the mark', actions: ['advanceToMark'],
    text: 'At 45°, logo at 12 o\'clock, advance until blood comes back briskly from the marker lumen.', cue: 'Stop at the mark.' },
  { id: 'rotate1', title: 'Turn device 1 30°', actions: ['rotate1'],
    text: 'Before opening the foot, turn device 1 about 30° on its own axis toward the patient\'s right, which on a right groin is lateral. The ProStyle IFU turns it the opposite way, medially; either works if device 2 then turns the other way.',
    cue: 'Turn first, then open the foot, and only about 30°. Its stitch will lie at 11 o\'clock.' },
  { id: 'deploy1', title: 'Deploy device 1', actions: ['leverUp', 'retractToWall', 'plungerIn', 'plungerOut', 'quickCut', 'leverDown'],
    text: DEPLOY, cue: 'One stitch through the front wall, at an angle to the vessel.' },
  { id: 'park1', title: 'Take and park suture 1', actions: ['retractToPort', 'harvestBoth', 'clamp1'],
    text: 'Pull back to the exit port, pull both strands out held together, clamp them together with a shodded hemostat, take up all the slack and lay them on the patient\'s right.',
    cue: 'Never pull one strand alone: it runs or locks the knot. This is the knot that goes down first.' },
  { id: 'remove1', title: 'Re-wire and take device 1 out', actions: ['rewire', 'removeDevice'],
    text: 'Put the wire back in through the exit port, then take device 1 out over it, pressing above the puncture.', cue: 'The wire keeps the way in.' },
  { id: 'device2', title: 'Device 2 to the mark, turned the other way', actions: ['backload2', 'wireOut2', 'advanceToMark2', 'rotate2'],
    text: 'Backload device 2 over the same wire, pull the wire at the exit port, advance to the mark and turn it about 30° toward the patient\'s left.',
    cue: 'Its stitch will lie at 1 o\'clock: the two cross in an X over the hole.' },
  { id: 'deploy2', title: 'Deploy device 2', actions: ['leverUp2', 'retractToWall2', 'plungerIn2', 'plungerOut2', 'quickCut2', 'leverDown2'],
    text: DEPLOY, cue: 'The second stitch crosses the first.' },
  { id: 'park2', title: 'Take and park suture 2', actions: ['retractToPort2', 'harvestBoth2', 'clamp2'],
    text: 'As for suture 1: both strands together, clamped, slack taken up, laid on the patient\'s left.', cue: 'Slack left in a parked suture can be pushed into the vessel by the large sheath.' },
  { id: 'big', title: 'In goes the large sheath', actions: ['rewire2', 'bigSheathIn'],
    text: 'Re-wire through the exit port and swap device 2 for the large sheath over the wire. It goes in through both loops.',
    cue: 'The knots wait until the end of the case.' },
  { id: 'end', title: 'End of case: knots in order', actions: ['advance1', 'advance2', 'wireOutEnd', 'lock1', 'lock2', 'trimAll'],
    text: 'With the wire still in, take the sheath out while advancing knot 1, then advance knot 2 — neither locked. Once the bleeding is controlled pull the wire, then lock 1, then 2, and trim.',
    cue: 'Knot 1 is the bottom one, nearest the vessel: it goes down and locks first.' },
]);

export const DONE = Object.freeze({ title: 'Done',
  text: 'Two stitches crossing over the arteriotomy, each knotted on the outside of the artery, the first one underneath.' });
