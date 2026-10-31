// Pre-close in both windows: two ProGlide layers (each fed its own device pose), the large-bore sheath with its hub, and
// in the Hands window a shodded hemostat on each parked suture.
import { W, tractPoint } from '../scene/world.js';
import { sheathPath, TRACT_LEN } from '../scene/paths.js';
import { proglideInside } from '../proglide/inside-layer.js';
import { proglideHands } from '../proglide/hands-layer.js';
import { suturePaths } from '../proglide/suture.js';
import { devicePose } from './pose.js';
import { makeStrand } from '../render/strands.js';
import { COLORS } from '../render/look.js';
import { tanglePath } from './tangle.js';

const SQ = Math.SQRT1_2;
function bigSheath(THREE, root) {
  const shaft = makeStrand(THREE, { color: '#d8dee6', radius: 3.0, sides: 24, rough: 0.3, physical: true });
  const hub = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 4, 26, 40), new THREE.MeshStandardMaterial({ color: '#30363f', roughness: 0.45 }));
  body.position.y = 13; hub.add(body);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 6, 40), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 }));
  valve.position.y = 28; hub.add(valve);
  hub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(SQ, SQ, 0)); hub.position.set(...tractPoint(TRACT_LEN + 16));
  root.add(shaft.group, hub);
  const set = (on) => { shaft.update(on ? sheathPath(16, 16) : null); hub.visible = !!on; };
  set.objs = [shaft.group, hub];
  return set;
}

export function precloseInside(view, root, [model, trimmer], geom) {
  const { THREE } = view, ra = new THREE.Group(), rb = new THREE.Group(); root.add(ra, rb);
  const A = proglideInside(view, ra, { model, trimmer, geom }), B = proglideInside(view, rb, { model, trimmer, geom });
  const big = bigSheath(THREE, root);
  const tangle = makeStrand(THREE, { color: COLORS.suture, radius: 0.14, sides: 8 }); root.add(tangle.group);    // knots locked out of order
  function update(p) { A.update(devicePose(p, 'a')); B.update(devicePose(p, 'b')); big(p.bigShown); tangle.update(tanglePath(p, geom)); }
  const resolve = (n, target) => (n === 'bigSheath' ? big.objs : target?.device === 'b' ? B.resolve(n) : target?.device === 'a' ? A.resolve(n) : [A.resolve(n), B.resolve(n)].flat());
  return { update, rig: A.rig, resolve, node: (n) => A.node(n), knotWorld: (p) => suturePaths(devicePose(p, 'a'), geom).knot.at };
}

export function precloseHands(view, root, [model, trimmer, hemostat], geom) {
  const { THREE } = view, ra = new THREE.Group(), rb = new THREE.Group(); root.add(ra, rb);
  const A = proglideHands(view, ra, { model, trimmer, geom }), B = proglideHands(view, rb, { model, trimmer, geom });
  const big = bigSheath(THREE, root);
  const clamps = [hemostat.clone(true), hemostat.clone(true)]; for (const c of clamps) { c.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); }); root.add(c); }
  const tangle = makeStrand(THREE, { color: COLORS.suture, radius: 0.3, sides: 8 }); root.add(tangle.group);
  function update(p) {
    const pa = devicePose(p, 'a'), pb = devicePose(p, 'b');
    A.update(pa); B.update(pb); big(p.bigShown); tangle.update(tanglePath(p, geom));
    // a hemostat on each parked pair of strands, jaws on them a little way out from the skin
    for (const [c, pk, on] of [[clamps[0], pa, p.clamp1], [clamps[1], pb, p.clamp2]]) {
      c.visible = !!on; if (!on) continue;
      const rail = suturePaths(pk, geom).rail, at = rail[Math.min(rail.length - 1, Math.floor(rail.length * 0.55))];
      const dir = rail[rail.length - 1].map((v, i) => v - at[i]), n = Math.hypot(...dir);
      c.position.set(...at); c.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(...dir.map(v => v / n)));
    }
  }
  ra.userData.device = 'a'; rb.userData.device = 'b';
  const resolve = (n, target) => (n === 'clamp' ? clamps : n === 'bigSheath' ? big.objs
    : target?.device === 'b' ? B.resolve(n) : target?.device === 'a' ? A.resolve(n) : [A.resolve(n), B.resolve(n)].flat());
  return { update, rig: A.rig, rigs: { a: A.rig, b: B.rig }, resolve };
}
