// T / TAP's places for the shared pose builder: Provisional's (the same LAD stent, its distal cell and the pull-back stop),
// and the D1 stent's protrusion, 2.3 mm from the carina tip to its proximal end on its own axis — the least that covers
// D1's heel at this angle (mini-crush's, Phase 2 P2). A plain T (for the result's comparison) protrudes not at all: its
// carina-side edge at the carina tip.
import { poseFrom, SWITCHES } from '../technique/pose.js';
import { CARINA, axis } from '../scene/anatomy.js';
import { PLACES as PROV } from '../provisional/pose.js';

export { SWITCHES };
const SB = axis('sb').dir;
export const PLACES = Object.freeze({ tips: PROV.tips, cells: PROV.cells, prot: 2.3, sb: 'tap' });
export const T_PLACES = Object.freeze({ ...PLACES, prot: CARINA.cutX - SB[0] * (CARINA.tip[0] * SB[0] + CARINA.tip[1] * SB[1]) });
export const poseOf = (s, ctx, { plainT = false } = {}) => poseFrom(s, ctx, plainT ? T_PLACES : PLACES);
