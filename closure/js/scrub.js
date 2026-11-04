// The scrub bar (Saro: "user should be able to click and drag where they are to speed up or rewind the sequence"): the
// whole run of correct moves as one bar, filled to where it is now, a tick where each step starts and the groups named
// under it. Press anywhere on it and drag to run the moves forward or back to that point; let go and the page settles on
// the nearest move. Arrow keys step one move, Home/End go to the ends. DOM only — shared verbatim by the step pages.
//
// createScrubber(root, { onScrub(x), onRelease(x), text(x) }) → { set(x), setMarks(count, marks), dragging() }
//   x: position along the moves, 0 … count (2.5 = half-way through the third move)
//   marks: [{ at: move index where a step starts, group: name shown under the bar at the first step of its group }]
export function createScrubber(root, { onScrub, onRelease, text = () => '' }) {
  root.textContent = '';
  const track = document.createElement('div'); track.className = 'scrub-track';
  track.setAttribute('role', 'slider'); track.tabIndex = 0; track.setAttribute('aria-label', 'Position in the steps');
  const rail = document.createElement('div'); rail.className = 'scrub-rail';
  const fill = document.createElement('div'); fill.className = 'scrub-fill';
  const ticks = document.createElement('div'); ticks.className = 'scrub-ticks';
  const thumb = document.createElement('div'); thumb.className = 'scrub-thumb';
  rail.append(fill, ticks); track.append(rail, thumb);
  const labels = document.createElement('div'); labels.className = 'scrub-labels';
  root.append(track, labels);

  let count = 1, x = 0, drag = false;
  const clamp = (v) => Math.min(Math.max(v, 0), count);
  function set(v) {
    x = clamp(v); const pct = `${(100 * x / count).toFixed(3)}%`;
    fill.style.width = pct; thumb.style.left = pct;
    track.setAttribute('aria-valuenow', String(Math.floor(x))); track.setAttribute('aria-valuetext', text(x));   // now = the move under way, as the step text names it
  }
  function setMarks(n, marks) {
    count = Math.max(1, n); ticks.textContent = ''; labels.textContent = '';
    track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(count));
    for (const m of marks) {
      if (m.at > 0 && m.at < count) {
        const t = document.createElement('span'); t.className = 'scrub-tick'; t.style.left = `${100 * m.at / count}%`; ticks.appendChild(t);
      }
    }
    // each group's name centred under its stretch of the bar, kept inside the bar and clear of its neighbours
    const groups = marks.filter((m) => m.group);
    groups.forEach((m, i) => {
      const l = document.createElement('span'); l.className = 'scrub-label'; l.textContent = m.group;
      l.dataset.mid = String((m.at + (i + 1 < groups.length ? groups[i + 1].at : count)) / 2 / count);
      labels.appendChild(l);
    });
    placeLabels(); set(x);
  }
  function placeLabels() {
    const W = labels.clientWidth; let edge = 0;
    for (const l of labels.children) {
      const w = l.offsetWidth, left = Math.min(Math.max(Number(l.dataset.mid) * W - w / 2, edge), Math.max(W - w, 0));
      l.style.left = `${left}px`; edge = left + w + 6;
    }
  }
  new ResizeObserver(placeLabels).observe(labels);
  const xOf = (e) => { const r = rail.getBoundingClientRect(); return clamp((e.clientX - r.left) / Math.max(r.width, 1) * count); };
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag = true; track.setPointerCapture?.(e.pointerId); track.classList.add('dragging');
    const v = xOf(e); set(v); onScrub(v); e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => { if (!drag) return; const v = xOf(e); set(v); onScrub(v); });
  const end = (e) => {
    if (!drag) return; drag = false; track.classList.remove('dragging');
    onRelease(e.type === 'pointercancel' ? x : xOf(e));
  };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', (e) => {
    const k = { ArrowRight: Math.floor(x) + 1, ArrowUp: Math.floor(x) + 1, ArrowLeft: Math.ceil(x) - 1, ArrowDown: Math.ceil(x) - 1,
      Home: 0, End: count }[e.key];
    if (k === undefined) return;
    e.preventDefault(); onRelease(clamp(k));
  });
  return { set, setMarks, dragging: () => drag };
}
