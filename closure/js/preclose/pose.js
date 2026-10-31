// Pre-close pose: the groin's shared fields, plus each device's single-device pose flattened under a_ (device 1) and b_
// (device 2) so the animator can tween one flat object. devicePose(p, 'a') gives a device's pose back for the ProGlide layer.
import { poseOf as oneDevice } from '../proglide/pose.js';
import { stepIndex } from './machine.js';

export const TOP_FROM = 9;   // from parking suture 2 on, the Inside window looks down on the front wall: the X

const BIG_R = 3.0;          // 18F large-bore sheath, 6 mm across
function devicePart(d, s, geom, park) {
  const p = oneDevice({ ...d, flushed: s.flushed, wire: s.wire, sheath: 'out', failed: undefined }, geom);
  p.roll = d.roll;
  if (d.device === 'waiting') p.deviceShown = 0;
  p.clamped = d.clamped ? 1 : 0; p.park = d.clamped ? park : 0;
  p.besideR = s.big === 'in' ? BIG_R + 0.8 : d.device === 'in' ? 2.1 : s.wire === 'in' ? 1.0 : 0;
  p.dipY = s.big === 'in' ? -34.0 : d.device === 'in' ? -33.0 : -31.25;
  return p;
}
const FAILED = {
  oneLimb: () => ({ a_knotS: 6, a_lock: 1 }),
  overRotated: () => ({ a_roll: -60 }),
  slackLoop: () => ({ bigShown: 1, holeOpen: 2.2, a_dipY: -34.0, a_besideR: BIG_R + 0.8, b_dipY: -36.5, b_besideR: BIG_R + 0.8, b_knotS: 8 }),
  lockedOutOfOrder: () => ({ b_lock: 1, a_lock: 0, tangle: 1, gather: 0.5 }),
  lockedWireIn: () => ({ a_lock: 1 }),
};

export function poseOf(s, geom) {
  const a = devicePart(s.d1, s, geom, 1), b = devicePart(s.d2, s, geom, -1);
  const down = (d) => (d.knotS >= 0 && d.knotS <= 1.6 && d.device === 'removed' ? 0.5 : 0);
  const gather = down(s.d1) + down(s.d2);
  const deviceIn = s.d1.device === 'in' || s.d2.device === 'in';
  const p = {
    wireShown: s.wire === 'in' ? 1 : 0, sheathShown: s.sheath === 'in' ? 1 : 0, bigShown: s.big === 'in' ? 1 : 0, flushed: s.flushed ? 1 : 0,
    gather, holeOpen: s.big === 'in' ? 2.2 : deviceIn ? 1 : 1 - gather, clamp1: s.d1.clamped ? 1 : 0, clamp2: s.d2.clamped ? 1 : 0, tangle: 0,
    topView: stepIndex(s) >= TOP_FROM ? 1 : 0,
  };
  for (const [k, v] of Object.entries(a)) p[`a_${k}`] = v;
  for (const [k, v] of Object.entries(b)) p[`b_${k}`] = v;
  if (s.failed) Object.assign(p, FAILED[s.failed](p));
  return p;
}

// one device's pose back out of the flat pose, with the shared fields it reads
export function devicePose(p, k) {
  const d = {};
  for (const [key, v] of Object.entries(p)) if (key.startsWith(`${k}_`)) d[key.slice(2)] = v;
  d.wireShown = p.wireShown; d.gather = p.gather;
  return d;
}
