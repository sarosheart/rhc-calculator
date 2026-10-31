// Poses one instance of the ProGlide model for a pose: places the whole device in the groin (deviceFrame) and moves its
// pivots — lever, foot, needles, plunger — and swaps what is drawn by the page (the link and cuffs once they are hauled,
// the knot once it leaves the device, the distal sheath always).
// glTF is Y-up: a model point (x, y, z) is the device-frame point (x, −z, y) — device X → glTF X, device Z → glTF Y,
// device Y → glTF −Z.
import { W, computeSeat, deviceFrame, tractPoint } from '../scene/world.js';
import { STROKE, DEFLECT, knotAxis } from '../proglide/suture.js';

export const LEVER_DEG = -62, PLUNGER_IN = -17, PLUNGER_OUT = 46;
const deviceToGltf = (v) => [v[0], v[2], -v[1]];

export function makeRig(THREE, model, geom) {
  const root = model.clone(true);
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.add(root);
  const seat = computeSeat(geom);
  const node = (n) => root.getObjectByName(n);
  const NAMES = ['Lever', 'Foot', 'LinkOpen', 'LinkClosed', 'CuffAnterior', 'CuffPosterior', 'NeedleAnterior', 'NeedlePosterior',
    'Plunger', 'KnotCoil', 'DistalSheath', 'MarkerPort', 'WireExitPort', 'QuickCut', 'Logo'];
  const N = Object.fromEntries(NAMES.map(n => [n, node(n)]));
  const rest = new Map();
  for (const o of Object.values(N)) if (o) rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
  const axisY = new THREE.Vector3(...deviceToGltf([0, 1, 0]));
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const turn = (o, deg) => { if (!o) return; const r = rest.get(o); o.quaternion.copy(r.q).premultiply(q.setFromAxisAngle(axisY, deg * Math.PI / 180)); };
  const slide = (o, dx, dy = 0) => { if (!o) return; const r = rest.get(o); o.position.copy(r.p); o.position.x += dx; o.position.z -= dy; };   // device y = glTF −z
  if (N.DistalSheath) N.DistalSheath.visible = false;             // drawn by the page, bending with the tract

  function update(pose) {
    holder.visible = pose.deviceShown > 0;
    const F = deviceFrame(pose, seat, pose.toePivot ? geom.toeLocal : null);
    const X = new THREE.Vector3(...F.out), Y = new THREE.Vector3(...F.up), Z = new THREE.Vector3(...F.side).negate();
    m.makeBasis(X, Y, Z); m.setPosition(...F.origin); holder.matrix.copy(m); holder.matrixWorldNeedsUpdate = true;
    turn(N.Lever, LEVER_DEG * pose.lever);
    turn(N.Foot, geom.footParkedDeg * (1 - pose.foot) - geom.footRestDeg);
    // the front needle comes home as fast as the chain it hauls (suture.js); the back needle with the plunger
    const ext = Math.min(pose.needles, pose.haul > 0 ? Math.max(0, 1 - pose.haul * geom.haulPerStroke) : 1);
    slide(N.NeedleAnterior, -STROKE * ext, DEFLECT * pose.deflectA);
    slide(N.NeedlePosterior, -STROKE * pose.needles, DEFLECT * pose.deflectP);
    slide(N.Plunger, PLUNGER_IN * pose.plunger + PLUNGER_OUT * pose.plungerBack);
    if (N.Plunger) N.Plunger.visible = pose.plungerShown > 0;
    const hauled = pose.haul > 0;
    if (N.LinkOpen) N.LinkOpen.visible = !hauled && pose.foot >= 0.5;
    if (N.LinkClosed) N.LinkClosed.visible = !hauled && pose.foot < 0.5;
    for (const c of [N.CuffAnterior, N.CuffPosterior]) if (c) c.visible = !hauled;
    if (N.KnotCoil) N.KnotCoil.visible = pose.knotS < 0;
    return F;
  }
  return { holder, root, node: (n) => N[n] || node(n), update, seat };
}

// the Suture Trimmer: tip at the model origin, shaft along model +X; its tip rides the tract at pusherS (on top of the knot
// once it is down), the shaft running out along the tract; the red lever swings when it trims
export function poseTrimmer(THREE, trim, pose, geom) {
  if (!trim) return;
  trim.visible = pose.pusherShown > 0;
  const a = W.ANGLE * Math.PI / 180, out = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  trim.position.set(...knotAxis(pose, pose.pusherS + (geom.coil.x1 - geom.coil.x0) / 2 + 0.2));   // it rides the rail, on the knot's line
  trim.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), out);
  const lever = trim.getObjectByName('TrimLever'); if (lever) { lever.userData.rest ??= lever.rotation.z; lever.rotation.z = lever.userData.rest + 0.45 * pose.trimmed; }
}
