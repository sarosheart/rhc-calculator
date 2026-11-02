// The devices' fixed numbers (design §5.2, §6.1; brief §B): the balloons, the LAD stent, the wires. No logic, no imports
// beyond the anatomy, so every device module can read them.
import { CARINA } from '../scene/anatomy.js';

// Phase 2's kinds come after Phase 1's seven, so Provisional's indices keep their values
export const BALLOON_IDS = Object.freeze([null, 'predilLAD', 'stentLAD', 'pot', 'kissMV', 'predilD1', 'kissSB',
  'stentSB', 'psoSB', 'crushMV', 'small125', 'potAway', 'stentCu', 'potCu', 'openMV', 'psoTap', 'potShort']);
export const BALLOONS = Object.freeze({
  predilLAD: Object.freeze({ d: 3.0, len: 15, nc: true, side: 'A' }),     // across the bifurcation (vessel.js PREDIL.lad)
  stentLAD: Object.freeze({ d: 3.0, len: 22, stent: true, side: 'A' }),   // the stent's delivery balloon
  pot: Object.freeze({ d: 3.75, len: 8, nc: true, side: 'A' }),           // distal working end on the carina cut plane
  kissMV: Object.freeze({ d: 3.0, len: 12, nc: true, side: 'A' }),
  predilD1: Object.freeze({ d: 2.0, len: 12, nc: true, side: 'B' }),
  kissSB: Object.freeze({ d: 2.5, len: 12, nc: true, side: 'B' }),
  stentSB: Object.freeze({ d: 2.5, len: 16.4, stent: true, side: 'B' }),  // the D1 stent's delivery balloon
  psoSB: Object.freeze({ d: 2.5, len: 16.4, side: 'B' }),               // the same, pulled halfway back (PSO, high pressure)
  crushMV: Object.freeze({ d: 3.0, len: 12, nc: true, side: 'A' }),     // parked in the LAD across D1, then the crush
  small125: Object.freeze({ d: 1.25, len: 12, side: 'B' }),             // opens a cell a little before the kiss
  potAway: Object.freeze({ d: 3.75, len: 8, nc: true, side: 'A' }),     // DK's final POT, 0.6 mm short of the carina
  // Phase 3
  stentCu: Object.freeze({ d: 2.5, len: 22, stent: true, side: 'B' }),  // the culotte's D1 stent's delivery balloon
  potCu: Object.freeze({ d: 3.75, len: 6, nc: true, side: 'B' }),       // the culotte POT inside the D1 stent (on its wire)
  openMV: Object.freeze({ d: 3.0, len: 12, nc: true, side: 'A' }),      // through the D1 stent's cell into the distal LAD
  psoTap: Object.freeze({ d: 2.5, len: 16.4, side: 'B' }),             // TAP: the D1 stent's balloon pulled back level with the LAD's
  potShort: Object.freeze({ d: 3.75, len: 6, nc: true, side: 'A' }),    // TAP's final POT, short of the new carina
});
export const SHOULDER = 1.5, NECK = 0.6;                                // [VERIFY] (brief §F gap 8)
// The LAD stent reaches 8.6 mm above the carina: the 8 mm POT then reaches its proximal segment with its proximal end
// 0.6 mm inside the stent (EBC), and the stent lands on normal vessel proximal of the lesion.
// u0: 8.6 mm above the carina — exactly one ring pitch from 10 mm, which with a 67.5° turn about its axis (rot) lays the same
// cells over D1 as before: a distal cell centred at the carina, its passage in the bifurcation plane (a stent deploys at
// whatever turn it lands; this one is chosen so the distal cell is unambiguous)
export const STENT = Object.freeze({ len: 22, u0: CARINA.cutX - 8.6, crimpR: 0.55, nomR: 1.5, rot: 3 * Math.PI / 8 });   // crimped [VERIFY]
// The D1 stent (Phase 2): the same strut design's first 12 rings (11 × 1.4 + 1.0 = 16.4 mm) at nominal 2.5 — one design
// family covers ~2.25–3.0 mm (brief §F) — on D1's axis; ring 0's crown tip at θ = 0 faces D1's heel.
export const SBSTENT = Object.freeze({ rings: 12, len: 16.4, crimpR: 0.55, nomR: 1.25, rot: 0 });
// The culotte's D1 stent (Phase 3): the whole graph (16 rings, 2.5 × 22) on the D1 path (paths.js sbPath), its proximal end
// level with the LAD stent's (8.6 mm above the carina); turned so a distal cell sits over the distal LAD's origin at the
// carina with its passage in the bifurcation plane (as the LAD stent's turn does for D1).
export const CUSTENT = Object.freeze({ rings: 16, len: 22, crimpR: 0.55, nomR: 1.25, rot: Math.PI / 8, u0: STENT.u0 });
// which D1 stent a technique uses: Phase 2's on D1's axis (crushed), TAP's (on D1's axis, placed through the LAD stent),
// the culotte's (on the D1 path, from the proximal LAD)
export const SB_KIND = Object.freeze({ crush: 0, tap: 1, culotte: 2 });
// what a device parked in the LAD keeps clear round the gold wire while the D1 stent opens beside it [ESTIMATE]: a folded
// 3.0 balloon (DK crush), a crimped stent (mini-crush)
export const HOLD = Object.freeze({ none: 0, balloon: 0.5, stent: 0.6 });
export const KISS_PROX_X = CARINA.cutX - 4;                              // both kissing balloons' proximal working ends, just
                                                                         // proximal of D1's heel (a short overlap, EBC)
export const ROUTE = Object.freeze({ none: 0, lad: 1, d1: 2, d1cell: 3, d1ss: 4, d1both: 5, dmvcell: 6 });
export const WIRE_R = 0.356 / 2, TIP_LEN = 30;                           // 0.014″; radiopaque tip [VERIFY]
export const SIDE = Object.freeze({ A: 0.22, B: -0.22 });                // the two wires sit either side of the plane
