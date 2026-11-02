// The guide's moves, one after another (Saro: no wrong steps). The state is how many moves have been made; the step on
// show is the one whose move comes next, and after the last move the device is out with its filters on the table.
// A move's id is '#k' (a string: Closure's Play treats a falsy move as none left). Pure: scripts/test-sentinel-unit.mjs.

export function createMachine(seq) {
  const M = seq.moves.length, first = [];
  seq.moves.forEach((m, k) => { if (first[m.step] === undefined) first[m.step] = k; });
  const nSteps = seq.steps.length;
  const stepOf = (k) => (k < M ? seq.moves[k].step : nSteps);
  return {
    count: M,
    initialState: () => ({ k: 0 }),
    nextAction: (s) => (s.k < M ? `#${s.k}` : null),
    available: (s) => (s.k < M ? [`#${s.k}`] : []),
    apply: (s, a) => (a === `#${s.k}` && s.k < M ? { k: s.k + 1 } : s),
    index: (a) => Number(String(a).slice(1)),
    stepIndex: (s) => stepOf(s.k),
    startOf: (i) => (i >= nSteps ? M : first[i]),
    duration: (a) => seq.moves[Number(String(a).slice(1))].ms,
    // the locks as the guide has them before move k: the step's own, then any its earlier moves set
    locksAt: (k) => {
      const i = Math.min(stepOf(k), nSteps - 1), st = seq.steps[i], L = { ...st.locks };
      for (let j = first[i]; j < Math.min(k, M); j++) if (seq.moves[j].step === i && st.moves[j - first[i]].locks) Object.assign(L, st.moves[j - first[i]].locks);
      if (k >= M) for (const m of st.moves) if (m.locks) Object.assign(L, m.locks);
      return L;
    },
  };
}

// "Deployment 3 of 6", as the guide numbers its cards; the steps without a number go by their group alone
export function stepLabel(steps, i) {
  const s = steps[i]; if (!s) return '';
  if (!s.num) return s.group;
  const n = steps.filter((t) => t.group === s.group && t.num).length;
  return `${s.group} ${s.num} of ${n}`;
}
