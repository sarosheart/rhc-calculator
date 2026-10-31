// ProGlide's layer in the Hands window: the device as held (its own material copies, so a part can glow alone), its
// catheter, the strands once they are out, and the trimmer. Strands are drawn a little thicker than true (0.25 mm) so they
// stay visible at this window's distance.
import { tractPoint, deviceFrame } from '../scene/world.js';
import { distalSheathPath, tornAt, TRACT_LEN } from '../scene/paths.js';
import { suturePaths } from './suture.js';
import { makeStrand } from '../render/strands.js';
import { makeRig, poseTrimmer } from '../render/rig.js';
import { COLORS, sheathRadius } from '../render/look.js';

export function handsPreset(stepIndex, pose, rig) {
  if (stepIndex >= 10 || stepIndex === 1) {
    return { target: tractPoint(TRACT_LEN + (stepIndex === 1 ? 40 : 30)), dir: [0.22, 0.85, 1], radius: stepIndex === 1 ? 70 : 46 };
  }
  const F = deviceFrame(pose, rig.seat);
  return { target: F.toWorld([168, 0, 0]), dir: [0.26, 0.62, 1], radius: 62 };
}

export function proglideHands(view, root, { model, trimmer, geom }) {
  const { THREE } = view;
  const rig = makeRig(THREE, model, geom);
  rig.root.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
  root.add(rig.holder);
  const distal = makeStrand(THREE, { color: COLORS.sheath, radius: sheathRadius(geom), sides: 16, rough: 0.35, physical: true });
  const distalTip = makeStrand(THREE, { color: COLORS.sheath, radius: 1.2, sides: 16, rough: 0.35, physical: true });
  const rail = makeStrand(THREE, { color: COLORS.suture, radius: 0.3 });
  const nonRail = makeStrand(THREE, { color: COLORS.suture, radius: 0.3, tipColor: COLORS.whiteTip, tipLen: 10 });
  for (const s of [distal, distalTip, rail, nonRail]) root.add(s.group);
  const trim = trimmer ? trimmer.clone(true) : null;
  if (trim) { trim.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); }); root.add(trim); }

  function update(pose) {
    const F = rig.update(pose);
    const cath = pose.deviceShown ? distalSheathPath(F.toWorld(geom.sheathStartLocal), geom.sheathLen) : null;
    const torn = cath && pose.sheathTorn ? tornAt(cath) : null;
    distal.update(torn ? torn[0] : cath); distalTip.update(torn ? torn[1] : null);
    const S = suturePaths(pose, geom);
    rail.update(S.rail && pose.harvest ? S.rail : null); nonRail.update(S.nonRail && pose.harvest ? S.nonRail : null);
    poseTrimmer(THREE, trim, pose, geom);
  }
  const resolve = (n) => (n === 'trimmer' ? trim : n === 'rail' ? rail.group : n === 'nonRail' ? nonRail.group
    : n === 'cuff' ? [rig.node('CuffAnterior'), rig.node('CuffPosterior')] : n === 'link' ? [rig.node('LinkOpen'), rig.node('LinkClosed')]
    : (rig.node(n) || trim?.getObjectByName(n)));
  return { update, rig, resolve };
}
