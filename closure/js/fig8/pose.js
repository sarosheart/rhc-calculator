// What the two windows draw for a figure-of-8 state (numbers only, so a move tweens: a bite is the needle turning through
// the tissue, a wrap is one coil forming, a pass is the end threading along its route, the knot slides down the needle end).
import { BITE } from './geometry.js';

const FAILED = {
  biteDeep: () => ({ stitch: 1, bite1Depth: 33 }),            // through the anterior wall into the lumen
  biteShallow: () => ({ stitch: 1, bite1Depth: 2.4 }),         // skin only
};
export function poseOf(s) {
  const p = {
    holeOpen: 0, wireShown: 0, sheathShown: 0, venous: 1, topView: 0, preclosed: 1,
    stitch: s.stitch, needleOn: s.needle ? 1 : 0, bite1Depth: BITE.caudal.depth, bite2Depth: BITE.cranial.depth,
    ends: s.ends ? 1 : 0, wraps: s.wraps, tuck: s.tuck, set: s.set ? 1 : 0, down: s.down ? 1 : 0, tails: s.dressed ? 1 : 0,
    ooze: s.down ? 0 : 1, dressed: s.dressed ? 1 : 0,
  };
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  return p;
}
