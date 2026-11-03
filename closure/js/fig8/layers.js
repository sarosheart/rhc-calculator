// The figure-of-8 in both windows: the curved needle while a bite is taken and on the needle end until it is cut off, the
// silk (drawn dark) through the bites, across the skin and into the fisherman's knot, the ooze at the puncture, and — in
// the Inside window — the two pre-close sutures as the Pre-close mode leaves them, tied on the vein. From above (the Hands
// window) the bites are under the skin, so their course is drawn faintly through it: the two bites and the two crossing
// strands are the 8.
import { stitchPaths, oozeOutline, STRAND_R } from './geometry.js';
import { makeStrand, coilPoints } from '../render/strands.js';
import { COLORS } from '../render/look.js';
import { readGeom } from '../proglide/geom.js';
import * as PM from '../preclose/machine.js';
import { poseOf as precloseOf, devicePose } from '../preclose/pose.js';
import { suturePaths } from '../proglide/suture.js';

// the pre-close sutures, tied and trimmed: the end of the Pre-close mode (each device's loop through the wall, its knot,
// the two trimmed ends), computed once
let preclosed = null;
function preclosedPaths() {
  if (preclosed) return preclosed;
  const G = readGeom(null); let s = PM.initialState(G);
  while (PM.nextAction(s)) s = PM.apply(s, PM.nextAction(s));
  const p = precloseOf(s, G);
  preclosed = ['a', 'b'].map((k) => { const S = suturePaths(devicePose(p, k), G);
    return [S.loop, S.rail, S.nonRail, S.knot ? coilPoints(S.knot.at, S.knot.dir, { cinch: S.knot.cinch }) : null].filter((l) => l && l.length > 1); });
  return preclosed;
}

function oozeMesh(THREE) {
  // dark venous red, wet but not mirror-bright (a high clearcoat washed it to grey under the room light)
  const g = new THREE.BufferGeometry(), mat = new THREE.MeshPhysicalMaterial({ color: '#7a0f19', roughness: 0.32, clearcoat: 0.45,
    clearcoatRoughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 1;
  let key = '';
  function update(amount) {
    const O = oozeOutline(amount); m.visible = !!O; if (!O) return;
    const k = amount.toFixed(3); if (k === key) return; key = k;
    const c = O.reduce((a, q) => a.map((v, i) => v + q[i] / O.length), [0, 0, 0]);
    const pos = [c[0], c[1] + 0.04, c[2], ...O.flat()], idx = [];
    for (let i = 0; i < O.length; i++) idx.push(0, 1 + ((i + 1) % O.length), 1 + i);
    m.geometry.dispose(); m.geometry = new THREE.BufferGeometry();
    m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.geometry.setIndex(idx); m.geometry.computeVertexNormals();
  }
  return { mesh: m, update };
}

function layer(view, root, { thick }) {
  const { THREE } = view;
  const needle = makeStrand(THREE, { color: COLORS.steel, radius: (s) => Math.max(0.12, Math.min(0.55, 0.12 + s * 0.12)), sides: 10, metal: 1, rough: 0.22 });
  const silk = makeStrand(THREE, { color: COLORS.silk, radius: thick ? STRAND_R : 0.22, sides: 8, rough: 0.8, step: 0.2 });
  const ooze = oozeMesh(THREE);
  root.add(needle.group, silk.group, ooze.mesh);
  // the bites seen through the skin from above: faint, drawn over the skin
  const ghosts = thick ? [0, 1].map(() => {
    const g = makeStrand(THREE, { color: COLORS.silk, radius: STRAND_R * 0.8, sides: 8, rough: 0.9, opacity: 0.32 });
    g.material.depthTest = false; g.material.depthWrite = false; g.group.renderOrder = 2; root.add(g.group); return g; }) : [];
  // the pre-close sutures on the vein (under the skin: the Inside window only)
  const sutures = thick ? [] : preclosedPaths().flat().map((pts) => { const s = makeStrand(THREE, { color: COLORS.suture, radius: 0.125, sides: 8 });
    root.add(s.group); s.update(pts); return s; });
  function update(p) {
    const S = stitchPaths(p);
    silk.update(S.strand);
    needle.update(S.needle);
    ooze.update(p.ooze ?? 0);
    ghosts.forEach((g, i) => g.update(S.buried[i] && S.buried[i].length > 1 ? S.buried[i] : null));
    for (const s of sutures) s.group.visible = (p.preclosed ?? 1) >= 0.5;
  }
  const resolve = (n) => (n === 'silk' ? silk.group : n === 'needle' ? needle.group : n === 'ooze' ? ooze.mesh : n === 'preclose' ? sutures.map((s) => s.group) : null);
  return { update, node: () => null, resolve };
}
export const fig8Inside = (view, root) => layer(view, root, { thick: false });
export const fig8Hands = (view, root) => layer(view, root, { thick: true });
