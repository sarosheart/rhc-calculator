// The groin the Closure Devices page draws, in one frame, 1 unit = 1 mm.
// +X caudal (head to the left in the Inside window), +Y anterior (toward the skin), +Z toward the patient's right — the
// operator's side, where the camera sits. The tissue is cut by the plane z = 0 along the tract; everything with z > 0 is
// cut away so the tract, the device and the artery cut lengthwise are seen side-on.

export const W = Object.freeze({
  SKIN_Y: 0, SKIN_T: 2.0,
  WALL_OUT_Y: -30, WALL_T: 1.0, LUMEN_R: 3.5, VESSEL_CY: -34.5, VESSEL_OUT_R: 4.5,   // CFA, 7 mm lumen
  TISSUE: Object.freeze({ x0: -60, x1: 60, y0: -55, y1: 0, z0: -40, z1: 0 }),
  ANGLE: 45,          // device and tract angle to the skin, degrees
  HOLE_R: 1.35,       // arteriotomy radius with an 8F guide or a 6F sheath in it
  TRACT_R: 1.5,       // the tissue tract's radius
});

const rad = (d) => d * Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The device's own frame (as modelled): +X toward the handle, origin = the foot hinge, +Z = 12 o'clock (the logo),
// +Y = Z × X. In the world: X → out (up the tract), Z → up (12 o'clock, rolled about out), Y → side.
function basis(angle, roll) {
  const a = rad(angle), r = rad(roll);
  const out = [Math.cos(a), Math.sin(a), 0];
  const up0 = [-Math.sin(a), Math.cos(a), 0], side0 = [0, 0, -1];   // side0 = up0 × out
  const up = add(scale(up0, Math.cos(r)), scale(side0, Math.sin(r)));
  const side = cross(up, out);
  return { out, up, side };
}

// Where the hinge sits when the foot is apposed (insert 0) at `angle`: the open foot's upper face on the inner wall
// surface (y = -31) and the device axis crossing the outer wall at x = 0, so the hole is centred between the bites.
// geom.footTopLocal: a point on the open foot's upper face, in the device frame (read from the model).
export function computeSeat(geom, angle = W.ANGLE) {
  const { out, up, side } = basis(angle, 0);
  const p = geom.footTopLocal;
  const lift = p[0] * out[1] + p[1] * side[1] + p[2] * up[1];          // the foot top's height above the hinge
  const y = W.WALL_OUT_Y - W.WALL_T - lift;
  const k = (W.WALL_OUT_Y - y) / out[1];                                // along the axis from the hinge to the outer wall
  return [-k * out[0], y, 0];
}

// pose: { insert (mm deeper than apposed, along the tract), angle (deg to skin), roll (deg about the axis) }
// pivotLocal: a device point that keeps where it would be at 45° (the foot's toe on the wall, when the angle drops)
export function deviceFrame({ insert = 0, angle = W.ANGLE, roll = 0 }, seat, pivotLocal = null) {
  const { out, up, side } = basis(angle, roll);
  const dir = (v) => add(add(scale(out, v[0]), scale(side, v[1])), scale(up, v[2]));
  let origin = add(seat, scale(out, -insert));
  if (pivotLocal) {
    const b = basis(W.ANGLE, 0), o45 = add(seat, scale(b.out, -insert));
    const at45 = add(o45, add(add(scale(b.out, pivotLocal[0]), scale(b.side, pivotLocal[1])), scale(b.up, pivotLocal[2])));
    origin = add(at45, scale(dir(pivotLocal), -1));
  }
  const toWorld = (p) => add(origin, dir(p));
  return { origin, out, up, side, dir, toWorld };
}

// inside the arterial lumen (the vessel runs along x)
export function inLumen(p) {
  const dy = p[1] - W.VESSEL_CY, dz = p[2];
  return dy * dy + dz * dz < W.LUMEN_R * W.LUMEN_R;
}

// s mm out along the tract from the arteriotomy on the outer wall surface (0, -30, 0)
export function tractPoint(s, angle = W.ANGLE) {
  const a = rad(angle);
  return [s * Math.cos(a), W.WALL_OUT_Y + s * Math.sin(a), 0];
}
