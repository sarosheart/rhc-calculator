// The step engine every technique shares (Phase 1's Provisional machine, made generic). A technique is its steps, each
// with its actions in order, and the keyframes of every action: the states the move passes through (advance, inflate,
// deflate, withdraw), landing on the last. Pure: apply() returns a new frozen state and never mutates. An action may
// appear in more than one step (a second kiss, a second POT) when its keyframes are the same; actions that differ get
// their own names. No wrong moves on offer (Saro: "No mistakes for now").

// every technique's state starts from these (named things; technique/pose.js turns them into numbers)
export const BASE_STATE = Object.freeze({
  done: 0,
  wA_route: 'none', wA_tip: 'guide', wB_route: 'none', wB_tip: 'guide',
  bA: null, bA_wire: 'B', bA_at: 'guide', bA_inf: 0, bB: null, bB_wire: 'A', bB_at: 'guide', bB_inf: 0,
  stent: false, st_exp: 0, st_potR: 1.5, st_cell: null, st_open: 0, st_ellip: 1,
  sbStent: false, ss_exp: 0, ss_flare: 0, ss_hold: 'none', ss_crushR: 0, ss_cell: null, ss_open: 0, ss_potR: 0, v_diss: 0,
  v_predLAD: 0, v_predD1: 0, puff: 0,
});

// keyframe helpers: a balloon advanced on a wire to its place, and withdrawn to the guide
export const advance = (w, kind, wire) => ({ set: { [`b${w}`]: kind, [`b${w}_wire`]: wire, [`b${w}_at`]: 'place' }, ms: 1600 });
export const withdraw = (w) => ({ set: { [`b${w}`]: null, [`b${w}_at`]: 'guide', [`b${w}_inf`]: 0 }, ms: 1300 });

export function makeMachine({ steps, keys, initial = BASE_STATE }) {
  const ORDER = steps.flatMap((s) => s.actions);
  const STEP_OF = steps.flatMap((s, i) => s.actions.map(() => i));
  for (const a of ORDER) if (!keys[a]) throw new Error(`no keyframes for ${a}`);
  const init = Object.freeze({ ...BASE_STATE, ...initial });
  const nextAction = (s) => ORDER[s.done] ?? null;
  function keyframes(s, a) {
    if (a !== nextAction(s)) throw new Error('not available');
    const out = []; let cur = s;
    for (const k of keys[a]) { cur = Object.freeze({ ...cur, ...k.set }); out.push(cur); }
    out[out.length - 1] = Object.freeze({ ...out[out.length - 1], done: s.done + 1 });
    return out;
  }
  return {
    initialState: () => init,
    nextAction,
    stepIndex: (s) => (s.done < ORDER.length ? STEP_OF[s.done] : steps.length),
    available: (s) => (nextAction(s) ? [nextAction(s)] : []),
    durationOf: (a, k) => keys[a]?.[k]?.ms ?? 0,
    keyframes,
    apply: (s, a) => { const k = keyframes(s, a); return k[k.length - 1]; },
  };
}
