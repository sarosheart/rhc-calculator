// The figure-of-8 in both windows: the 24F venous sheath, the curved needle while a bite is taken, and the silk (drawn
// dark) through the bites, across the skin and into the fisherman's knot. From above (the Hands window) the bites are
// under the skin, so their course is drawn faintly through it: the two bites and the two crossing strands are the 8.
import { stitchPaths, sheathPath, SHEATH_R, STRAND_R } from './geometry.js';
import { makeStrand } from '../render/strands.js';
import { COLORS } from '../render/look.js';

function layer(view, root, { thick }) {
  const { THREE } = view;
  const shaft = makeStrand(THREE, { color: '#d9dfe6', radius: SHEATH_R, sides: 28, rough: 0.3, physical: true });
  const needle = makeStrand(THREE, { color: COLORS.steel, radius: (s) => Math.max(0.12, Math.min(0.55, 0.12 + s * 0.12)), sides: 10, metal: 1, rough: 0.22 });
  const silk = makeStrand(THREE, { color: COLORS.silk, radius: thick ? STRAND_R : 0.22, sides: 8, rough: 0.8, step: 0.2 });
  root.add(shaft.group, needle.group, silk.group);
  // the bites seen through the skin from above: faint, drawn over the skin
  const ghosts = thick ? [0, 1].map(() => {
    const g = makeStrand(THREE, { color: COLORS.silk, radius: STRAND_R * 0.8, sides: 8, rough: 0.9, opacity: 0.32 });
    g.material.depthTest = false; g.material.depthWrite = false; g.group.renderOrder = 2; root.add(g.group); return g; }) : [];
  function update(p) {
    shaft.update(sheathPath(p));
    const S = stitchPaths(p);
    silk.update(S.strand);
    needle.update(S.needle);
    ghosts.forEach((g, i) => g.update(S.buried[i] && S.buried[i].length > 1 ? S.buried[i] : null));
  }
  const resolve = (n) => (n === 'silk' ? silk.group : n === 'needle' ? needle.group : n === 'sheath' ? shaft.group : null);
  return { update, node: () => null, resolve };
}
export const fig8Inside = (view, root) => layer(view, root, { thick: false });
export const fig8Hands = (view, root) => layer(view, root, { thick: true });
