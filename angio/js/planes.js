// Anatomy planes for the 3D heart, fitted to the arteries that run in each groove — not to the body axes (the old page's
// axis-aligned guides were 51–54° off the real grooves; August 2026 audit).
//   AV-groove plane       : least-squares plane through the RCA and circumflex centrelines (the atrioventricular ring)
//   interventricular plane: through the LAD and the PDA (anterior and posterior interventricular grooves)

// symmetric 3×3 eigen-decomposition by Jacobi rotations; returns eigenvalues ascending with their unit vectors
function eigSym(A) {
  const a = A.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += a[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  return [0, 1, 2].map(i => ({ value: a[i][i], vector: [V[0][i], V[1][i], V[2][i]] })).sort((x, y) => x.value - y.value);
}

export function fitPlane(pts) {
  const n = pts.length, c = [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k], 0) / n);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j] / n; }
  const e = eigSym(C), normal = e[0].vector;
  const rms = Math.sqrt(pts.reduce((s, p) => s + ((p[0] - c[0]) * normal[0] + (p[1] - c[1]) * normal[1] + (p[2] - c[2]) * normal[2]) ** 2, 0) / n);
  // in-plane extent: the largest spread direction, for sizing the drawn disc
  const radius = 2 * Math.sqrt(e[2].value);
  return { centre: c, normal, rms, radius };
}

export function anatomyPlanes(tree) {
  const pts = (...ids) => tree.vessels.filter(v => ids.includes(v.id)).flatMap(v => v.pts);
  const av = fitPlane(pts('RCA', 'LCX')), iv = fitPlane(pts('LAD', 'R_PDA', 'L_PDA'));
  const dot = Math.abs(av.normal[0] * iv.normal[0] + av.normal[1] * iv.normal[1] + av.normal[2] * iv.normal[2]);
  return { av, iv, angleDeg: Math.acos(Math.min(1, dot)) * 180 / Math.PI };
}
