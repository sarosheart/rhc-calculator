// The X-ray camera for three.js, built from geometry.cameraFor().
//
// A camera AT THE SOURCE looking toward the detector sees the patient mirrored left-right compared with the cath-lab
// monitor, which shows the image as if viewed from the detector side (geometry.js: image right = (−d) × up, pinned to
// the audited old page and to real CARDIAG frames). So the projection is mirrored in x here. Measured 2026-10-17:
// without the mirror the image was off by 79–110 mm; with it, by 0.0000 mm at AP, LAO 45 CRA 30 and RAO 100 CRA 30.
// The mirror REVERSES TRIANGLE WINDING: under this camera a mesh's front faces rasterise as back faces, so any material
// that relies on face side must swap FrontSide/BackSide (see render-angio.js).
import { cameraFor } from './geometry.js';

export function makeXrayCamera(THREE, lao, cra, opts = {}) {
  const cam = cameraFor(lao, cra, opts);
  const c = new THREE.PerspectiveCamera(cam.fovDeg, 1, cam.near, cam.far);
  aimXrayCamera(THREE, c, lao, cra, opts);
  return c;
}

export function aimXrayCamera(THREE, c, lao, cra, opts = {}) {
  const cam = cameraFor(lao, cra, opts);
  c.fov = cam.fovDeg; c.near = cam.near; c.far = cam.far; c.aspect = 1;
  c.position.set(...cam.position); c.up.set(...cam.up); c.lookAt(...cam.target);
  c.updateMatrixWorld(); c.updateProjectionMatrix();
  c.projectionMatrix.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  c.userData.flipsWinding = true;
  return c;
}
