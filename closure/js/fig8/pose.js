// What the two windows draw for a figure-of-8 state (numbers only, so a move tweens: a bite is the needle turning
// through the tissue, a twist is one coil forming, the knot slides down as the sheath comes out).
import { BITE } from './geometry.js';

const FAILED = {
  biteDeep: () => ({ stitch: 1, bite1Depth: 33 }),            // through the anterior wall into the lumen
  biteShallow: () => ({ stitch: 1, bite1Depth: 2.4 }),         // skin only
  tiedOnSheath: () => ({ down: 1, gather: 0.6, cinchOnSheath: 1 }),
};
export function poseOf(s) {
  const out = s.sheath === 'out';
  const p = {
    holeOpen: out ? 1 : 2.7, wireShown: 0, sheathShown: out ? 0 : 1, sheathPull: out ? 1 : 0,
    venous: 1, topView: 0, stitch: s.stitch, needleOn: s.needle ? 1 : 0, bite1Depth: BITE.caudal.depth, bite2Depth: BITE.cranial.depth,
    cross: s.knot >= 1 ? 1 : 0, wraps: s.wraps, tuck: s.tucked ? 1 : 0, down: s.down,
    gather: s.down >= 1 ? 1 : 0, dressed: s.dressed ? 1 : 0, cinchOnSheath: 0,
  };
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  return p;
}
