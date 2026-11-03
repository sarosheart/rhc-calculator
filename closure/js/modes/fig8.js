// The figure-of-8 over the puncture after a pre-close: assembled from closure/js/fig8/. No models — the needle, silk, ooze
// and pre-close sutures are drawn.
import * as machine from '../fig8/machine.js';
import { poseOf } from '../fig8/pose.js';
import { STEPS, ACTIONS, DONE } from '../fig8/steps.js';
import { MISTAKES } from '../fig8/mistakes.js';
import { fig8Inside, fig8Hands } from '../fig8/layers.js';
import { HANDS_TOP, HANDS_KNOT, HANDS_TIE, HANDS_DOWN, BITE, knotFrame } from '../fig8/geometry.js';

// the side cutaway: the bites' depth against the skin, the tract and the vein; from the knot on, framed higher and wider
// to take in the knot off the skin caudal to the stitch; close on the knot, then on the puncture, as in the Hands window
const INSIDE = {
  top: { target: [26, -12, 0], dir: [0.18, 0.30, 1], radius: 26 },
  knot: { target: [38, 2, 0], dir: [0.18, 0.30, 1], radius: 34 },
  tie: { target: [55, 12, -2], dir: [0.18, 0.30, 1], radius: 11 },
  down: { target: [30, 1, 0], dir: [0.18, 0.30, 1], radius: 14 },
};
const HANDS = { top: HANDS_TOP, knot: HANDS_KNOT, tie: HANDS_TIE, down: HANDS_DOWN };
// steps: 0 caudal bite · 1 across · 2 cranial bite · 3 the knot · 4 down onto the puncture · 5 dress
const KNOT_STEP = 3, DOWN_STEP = 4, SLIDE_MS = 2200, LONG_MS = 2000;
// near the end the cameras close in on the crowded strands: on the knot once the end threads back through it, then on the
// puncture. Each camera move glides for as long as the move that brings it on (Saro: "make it smooth please no
// clunkiness"): out to the knot as both ends come down, in on it as the end threads back through, and down the needle end
// with the knot as it slides. Dragged or let go part-way down the slide (along: the pose drawn there), the camera is put
// on the knot where it is drawn, at once.
const close = (p) => p.down > 0 || p.tuck > 0 || p.set > 0;
const shot = (i, p) => (p.down > 0 ? 'down' : close(p) ? 'tie' : i >= KNOT_STEP ? 'knot' : 'top');
const GLIDE = { top: 1200, knot: LONG_MS, tie: LONG_MS, down: SLIDE_MS };
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
function preset(P, i, p, along) {
  const q = along || p, s = shot(i, q);
  if (s === 'down' && q.down < 1) { const t = q.down;                 // as knotFrame moves the knot down
    return { target: mix(P.tie.target, P.down.target, t), dir: P.down.dir, radius: P.tie.radius + (P.down.radius - P.tie.radius) * t, ms: 0 }; }
  return { ...P[s], ms: GLIDE[s] };
}
export default {
  id: 'fig8', label: 'Figure-of-8', intro: { title: 'Figure-of-8 stitch (vein)', text: 'An optional stitch when the puncture still oozes after a pre-close: a figure of eight of needle bites, a fisherman\'s knot on top.' },
  steps: STEPS, actions: ACTIONS, done: DONE, mistakes: MISTAKES, machine,
  phases: [{ from: 0, label: 'Bites' }, { from: KNOT_STEP, label: 'Knot' }, { from: DOWN_STEP, label: 'Down' }],
  models: [],
  parts: [{ id: 'silk', label: 'Silk' }, { id: 'needle', label: 'Needle' }, { id: 'ooze', label: 'Ooze' }, { id: 'preclose', label: 'Pre-close sutures' }],
  readGeom: () => ({}),
  poseOf: (s) => poseOf(s),
  // the vein closed by the pre-close (no hole); the 24F skin opening, gathered shut as the knot comes down (tamponade)
  shared: (p) => ({ holeOpen: 0, gather: 0, bites: [-4, 4], wireShown: 0, sheathShown: 0, topView: p.topView, venous: 1,
    tractClose: p.down, puncture: 2.4 }),
  insideLayer: (view, root) => fig8Inside(view, root),
  handsLayer: (view, root) => fig8Hands(view, root),
  insidePreset: (i, p, along) => preset(INSIDE, i, p, along),
  handsPreset: (i, p, layer, along) => preset(HANDS, i, p, along),
  focusFor(a, p0, layer, along) {
    const p = along || p0;                                          // part-way through a move: where it is drawn
    if (a === 'bite1' || a === 'deepBite' || a === 'shallowBite') return { nodes: [], tip: [BITE.caudal.x, 10, -16], dir: [0, -0.4, 1] };
    if (a === 'bite2') return { nodes: [], tip: [BITE.cranial.x, 10, -16], dir: [0, -0.4, 1] };
    if (a === 'crossOver') return { nodes: [], tip: [30, 8, 0], dir: [-1, 0, -1] };
    // (the silk is not lit for its moves: it is the only thing there, and lit then unlit it flipped colour between moves)
    // the knot moves: the arrow off the knot's upper left — between it and the stitch, on the lateral side, where the end
    // carried round the needle end never swings — pointing down at it, never over it; shorter and closer in a close-up
    const F = knotFrame(p), at = (h, side) => F.base.map((v, i) => v + F.u[i] * h - F.v[i] * side), near = close(p);
    const scale = near ? 0.25 : 1;
    const toward = [0, 1, 2].map((i) => 0.7 * F.u[i] + F.v[i]);
    if (['bringDown', 'wrap1', 'wrap2', 'wrap3', 'throughLoop', 'throughBigLoop', 'setKnot'].includes(a)) return { nodes: [], tip: near ? at(F.h0 - 0.6, F.r + 0.7) : at(F.h0 - 1.2, F.r + 1.4), dir: toward, scale };
    // sliding down: beside the knot on its lateral side, pointing the way it slides — cranially, toward the stitch (along
    // the skin, so it never turns end-on to the camera as the knot stands up on the puncture); once it is well on its way
    // the strands come in to it from every side, so no arrow
    if (a === 'slideDown') return p.down > 0.25 ? { nodes: [] } : { nodes: [], tip: at(F.h0 - 1.5, F.r + 1.6), dir: [-1, -0.2, 0], scale };
    return null;
  },
  duration: (a) => (a === 'bite1' || a === 'bite2' ? 2600 : a === 'slideDown' ? SLIDE_MS : a === 'crossOver' ? 2200
    : a === 'throughLoop' || a === 'throughBigLoop' || a === 'bringDown' ? LONG_MS : 1300),
};
