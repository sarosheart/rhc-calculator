// Closed tube meshes along a vessel centreline, radius per sample (Dodge calibres). Shared by the X-ray angiogram and the
// 3D heart. Frames are parallel-transported so the tube does not twist; both ends are capped so the mesh is CLOSED —
// the angiogram measures contrast path length as (back-face depth − front-face depth), which needs closed surfaces.

export function tubeGeometry(THREE, pts, r, { sides = 10 } = {}) {
  const n = pts.length, P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const T = P.map((p, i) => new THREE.Vector3().subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize());
  // parallel-transport frames
  const N = [], B = [];
  let ref = Math.abs(T[0].z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  N[0] = new THREE.Vector3().crossVectors(T[0], ref).normalize(); B[0] = new THREE.Vector3().crossVectors(T[0], N[0]);
  for (let i = 1; i < n; i++) {
    const v = new THREE.Vector3().crossVectors(T[i - 1], T[i]);
    N[i] = N[i - 1].clone();
    if (v.length() > 1e-6) N[i].applyAxisAngle(v.normalize(), Math.acos(Math.min(1, Math.max(-1, T[i - 1].dot(T[i])))));
    N[i].sub(T[i].clone().multiplyScalar(N[i].dot(T[i]))).normalize();
    B[i] = new THREE.Vector3().crossVectors(T[i], N[i]);
  }
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2, c = Math.cos(a) * r[i], s = Math.sin(a) * r[i];
    pos.push(P[i].x + N[i].x * c + B[i].x * s, P[i].y + N[i].y * c + B[i].y * s, P[i].z + N[i].z * c + B[i].z * s);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + (k + 1) % sides, c = (i + 1) * sides + k, d = (i + 1) * sides + (k + 1) % sides;
    idx.push(a, b, c, b, d, c);                                    // outward-facing (counter-clockwise seen from outside)
  }
  // end caps: a centre vertex fanned to each ring, wound outward
  const c0 = pos.length / 3; pos.push(P[0].x, P[0].y, P[0].z);
  const c1 = pos.length / 3; pos.push(P[n - 1].x, P[n - 1].y, P[n - 1].z);
  for (let k = 0; k < sides; k++) {
    idx.push(c0, (k + 1) % sides, k);
    idx.push(c1, (n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
