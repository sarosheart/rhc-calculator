// What the two windows draw for a figure-of-8 state (numbers only).
import { BITE } from './geometry.js';

const FAILED = {
  biteDeep: () => ({ stitch: 1, bite1Depth: 33 }),            // through the anterior wall into the lumen
  biteShallow: () => ({ stitch: 1, bite1Depth: 2.4 }),
  tiedOnSheath: () => ({ knot: 4, gather: 1, cinchOnSheath: 1 }),
};
export function poseOf(s) {
  const p = {
    holeOpen: s.sheath === 'in' ? 2.7 : 1, gather: s.knot >= 4 ? 1 : 0, wireShown: 0, sheathShown: s.sheath === 'in' ? 1 : 0,
    venous: 1, topView: 0, stitch: s.stitch, bite1Depth: BITE.depth, bite2Depth: BITE.depth,
    tension: s.tension ? 1 : 0, knot: s.knot, dressed: s.dressed ? 1 : 0, cinchOnSheath: 0,
  };
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  return p;
}
