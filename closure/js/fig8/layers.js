// The figure-of-8 in both windows: the 24F venous sheath with its hub, the curved needle while a bite is taken, and the
// silk (drawn dark) through the bites, across the skin and into Saro's knot.
import { sheathPath } from '../scene/paths.js';
import { stitchPaths, SHEATH_R } from './geometry.js';
import { makeStrand } from '../render/strands.js';
import { COLORS } from '../render/look.js';

function layer(view, root, { thick }) {
  const { THREE } = view;
  const shaft = makeStrand(THREE, { color: '#d9dfe6', radius: SHEATH_R, sides: 28, rough: 0.3, physical: true });
  const needle = makeStrand(THREE, { color: COLORS.steel, radius: (s) => Math.max(0.12, Math.min(0.55, 0.12 + s * 0.12)), sides: 10, metal: 1, rough: 0.22 });
  const strands = [0, 1].map(() => makeStrand(THREE, { color: COLORS.silk, radius: thick ? 0.5 : 0.22, sides: 8, rough: 0.8 }));
  root.add(shaft.group, needle.group, ...strands.map(s => s.group));
  function update(p) {
    // only a short stub of the sheath outside the skin, so the stitch stays in view from above
    shaft.update(p.sheathShown ? sheathPath(14, 9) : null);
    const S = stitchPaths(p);
    strands.forEach((st, i) => st.update(S.strands[i] || null));
    needle.update(S.needle);
  }
  const resolve = (n) => (n === 'silk' ? strands.map((s) => s.group) : n === 'needle' ? needle.group : n === 'sheath' ? shaft.group : null);
  return { update, node: () => null, resolve };
}
export const fig8Inside = (view, root) => layer(view, root, { thick: false });
export const fig8Hands = (view, root) => layer(view, root, { thick: true });
