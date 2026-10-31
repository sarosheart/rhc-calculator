// The device numbers the page needs, in the device frame (mm): read from the loaded model where it carries them, the
// rest as modelled in tools/closure/blender/proglide.py. Derived numbers (where the exit port reaches the skin, how far
// plunger-out hauls the chain) are computed here once.
import { W, computeSeat, deviceFrame } from '../scene/world.js';
import { TRACT_LEN } from '../scene/paths.js';
import { haulPerStroke } from './suture.js';

export const GEOM_DEFAULTS = Object.freeze({
  footTopLocal: [0.30, 0, 0.30],              // a point on the open foot's upper face, between the cuffs
  needleZ: [2.83, -2.83],                     // anterior, posterior needle lines (device z)
  housingFace: 4.23,                          // the needle housing's face: the plane x + z = 4.23
  coil: { x0: 6.6, x1: 9.7, r: 0.46 },        // the pre-tied knot on the anterior needle
  markerPortLocal: [2.5, 0, -1.35],
  sheathStartLocal: [-14.14, 0, 10.0],        // where the flexible distal sheath leaves the distal guide (spike: arc end + C·10)
  sheathLen: 90, portArc: 34,
  sheathProfile: [[0, 1.5], [60, 1.45], [84, 1.15], [88.5, 0.95], [90, 0.55]],
  footParkedDeg: -45, footRestDeg: -45,       // the foot's rotation about device y when parked, and as exported
  toeLocal: [-3.24, 0, 3.83],                 // the open foot's toe on its upper face (C·5 + up·0.42): it stays on the wall
  cuffS: 4.0,                                 // the cuffs sit ±4 mm along the open foot from the hinge
});

const gltfToDevice = (v) => [v.x, -v.z, v.y];

export function readGeom(model) {
  const g = { ...GEOM_DEFAULTS, coil: { ...GEOM_DEFAULTS.coil } };
  if (model) {
    const root = model.getObjectByName('ProGlide') || model;
    root.updateWorldMatrix(true, true);
    const inv = root.matrixWorld.clone().invert();
    const local = (name) => { const o = root.getObjectByName(name); if (!o) return null;
      const v = o.getWorldPosition(new o.position.constructor()).applyMatrix4(inv); return gltfToDevice(v); };
    const extras = root.userData || {};
    for (const k of Object.keys(GEOM_DEFAULTS)) if (extras[k] !== undefined) g[k] = extras[k];
    const mp = local('MarkerPort'); if (mp) g.markerPortLocal = mp;
  }
  // where the exit port reaches the skin: the port is portArc along the sheath, which runs down the tract
  const F0 = deviceFrame({ insert: 0 }, computeSeat(g)), s0 = F0.toWorld(g.sheathStartLocal);
  const a = W.ANGLE * Math.PI / 180, along = (p) => p[0] * Math.cos(a) + (p[1] - W.WALL_OUT_Y) * Math.sin(a);
  g.portAtSkinInsert = along(s0) - g.portArc - TRACT_LEN;
  g.haulPerStroke = haulPerStroke(g);
  return Object.freeze(g);
}
