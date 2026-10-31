// ProGlide's layer in the Inside window: the device (posed by the rig), its flexible catheter, the suture chain, loop,
// rail and white-tipped strand, the knot's coils, the trimmer, and the failure pictures (torn catheter, blood up the tract).
import { tractPoint } from '../scene/world.js';
import { distalSheathPath, tornAt } from '../scene/paths.js';
import { suturePaths } from './suture.js';
import { makeStrand, coilPoints } from '../render/strands.js';
import { makeRig, poseTrimmer } from '../render/rig.js';
import { COLORS, sheathRadius } from '../render/look.js';

export const INSIDE_PRESETS = {
  wide: { target: [10, -17, 0], dir: [0.10, 0.26, 1], radius: 36 },
  tract: { target: [9, -21, 0], dir: [0.10, 0.26, 1], radius: 21 },
  wall: { target: [0, -31.8, 0], dir: [0.14, 0.34, 1], radius: 10.5 },
};
export const insidePresetName = (stepIndex) => (stepIndex <= 2 ? 'wide' : stepIndex <= 8 ? 'wall' : stepIndex <= 10 ? 'tract' : 'wall');


export function proglideInside(view, root, { model, trimmer, geom }) {
  const { THREE } = view;
  const rig = makeRig(THREE, model, geom); root.add(rig.holder);
  const distal = makeStrand(THREE, { color: COLORS.sheath, radius: sheathRadius(geom), sides: 16, rough: 0.35, physical: true });
  const distalTip = makeStrand(THREE, { color: COLORS.sheath, radius: 1.2, sides: 16, rough: 0.35, physical: true });
  const chain = { suture: [], link: [], cuff: [] };
  const mk = (kind) => kind === 'link' ? makeStrand(THREE, { color: COLORS.link, radius: 0.2, sides: 8 })
    : kind === 'cuff' ? makeStrand(THREE, { color: COLORS.steel, radius: 0.32, sides: 12, metal: 1, rough: 0.25 })
    : makeStrand(THREE, { color: COLORS.suture, radius: 0.125, sides: 8 });
  const loop = makeStrand(THREE, { color: COLORS.suture, radius: 0.125 });
  const rail = makeStrand(THREE, { color: COLORS.suture, radius: 0.125 });
  const nonRail = makeStrand(THREE, { color: COLORS.suture, radius: 0.125, tipColor: COLORS.whiteTip, tipLen: 8 });
  const coil = makeStrand(THREE, { color: COLORS.suture, radius: 0.125, step: 0.08, sides: 6 });
  // blood tracking up the tract past a loose stitch
  const bleed = makeStrand(THREE, { color: COLORS.blood, radius: 1.2, sides: 14, rough: 0.25, opacity: 0.72 });
  for (const s of [distal, distalTip, loop, rail, nonRail, coil, bleed]) root.add(s.group);
  const trim = trimmer ? trimmer.clone(true) : null; if (trim) root.add(trim);

  function update(pose) {
    const F = rig.update(pose);
    const cath = pose.deviceShown ? distalSheathPath(F.toWorld(geom.sheathStartLocal), geom.sheathLen) : null;
    const torn = cath && pose.sheathTorn ? tornAt(cath) : null;           // tightened on the device: the tip tears off at the wall
    distal.update(torn ? torn[0] : cath); distalTip.update(torn ? torn[1] : null);
    const S = suturePaths(pose, geom);
    const used = { suture: 0, link: 0, cuff: 0 };
    for (const c of S.chain || []) {
      const list = chain[c.kind]; if (!list[used[c.kind]]) { const s = mk(c.kind); list.push(s); root.add(s.group); }
      list[used[c.kind]++].update(c.pts);
    }
    for (const k of Object.keys(chain)) for (let i = used[k]; i < chain[k].length; i++) chain[k][i].update(null);
    loop.update(S.loop); rail.update(S.rail); nonRail.update(S.nonRail);
    coil.update(S.chain ? null : coilPoints(S.knot.at, S.knot.dir, { cinch: S.knot.cinch }));
    poseTrimmer(THREE, trim, pose, geom);
    bleed.update(pose.bleed > 0 ? [tractPoint(-0.4), tractPoint(Math.max(1.5, pose.knotS - 1.2))] : null);
    return S;
  }
  const g = (list) => list.map((s) => s.group);
  const resolve = (n) => (n === 'rail' ? rail.group : n === 'nonRail' ? nonRail.group : n === 'knot' ? coil.group : n === 'trimmer' ? trim
    : n === 'cuff' ? [rig.node('CuffAnterior'), rig.node('CuffPosterior'), ...g(chain.cuff)]
    : n === 'link' ? [rig.node('LinkOpen'), rig.node('LinkClosed'), ...g(chain.link)] : rig.node(n));
  return { update, rig, resolve, node: (n) => rig.node(n), knotWorld: (pose) => suturePaths(pose, geom).knot.at };
}
