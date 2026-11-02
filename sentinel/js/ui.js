// The guide, the step list and the buttons under the two windows (Closure's, less its wrong moves and devices). It shows
// what the page tells it and reports taps.
export function createUI({ steps, label, done }, { onAction, onPlay = () => {}, onUndo, onRestart, onJump, onExpand, onPick = () => {} }) {
  const $ = (s) => document.querySelector(s);
  const title = $('#guide .guide-title'), text = $('#guide .guide-text'), cue = $('#guide .guide-cue'), count = $('#guide .step-count');
  const acts = $('#actions'), undo = $('#undo'), play = $('#play'), restart = $('#restart'), list = $('#steps ol');
  const lockF = $('#lockF'), lockR = $('#lockR');
  // the step list, grouped as the guide is: Position · Deployment 1–6 · During TAVR · Retrieval 1–5 · On the table
  list.textContent = '';
  steps.forEach((s, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = `${label(i)} — ${s.title}`; b.addEventListener('click', () => onJump(i));
    li.appendChild(b); list.appendChild(li);
  });
  // "What's inside": one button per part; only the parts in view are shown
  const partsBox = $('#parts .parts-list');
  let partsKey = '';
  function setParts(parts) {
    partsBox.textContent = '';
    for (const p of parts) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'part'; b.dataset.part = p.id; b.textContent = p.label;
      b.setAttribute('aria-pressed', 'false'); b.hidden = true; b.addEventListener('click', () => onPick(p.id)); partsBox.appendChild(b);
    }
  }
  function showParts(ids) {
    const k = ids.join('|'); if (k === partsKey) return; partsKey = k;
    for (const b of partsBox.children) b.hidden = !ids.includes(b.dataset.part);
    $('#parts').hidden = ids.length === 0;
  }
  const pick = (id) => { for (const b of partsBox.children) b.setAttribute('aria-pressed', String(b.dataset.part === id)); };
  function loading(on) {
    $('.actionbar').setAttribute('aria-busy', String(!!on));
    if (on) { play.disabled = true; moveBtn.disabled = true; }
  }
  const notice = (t) => { cue.textContent = t; };
  play.addEventListener('click', onPlay); undo.addEventListener('click', onUndo); restart.addEventListener('click', onRestart);
  for (const win of document.querySelectorAll('.win')) {
    const btn = win.querySelector('.expand');
    btn.addEventListener('click', () => onExpand(win.classList.contains('expanded') ? null : win.id));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') onExpand(null); });

  // the guide is aria-live: a line is rewritten only when it changes, so a screen reader hears each step once
  const put = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  // one move button for the whole run, relabelled, so keyboard focus stays on it from move to move
  const moveBtn = document.createElement('button'); moveBtn.type = 'button'; moveBtn.className = 'act'; moveBtn.hidden = true;
  moveBtn.addEventListener('click', () => { if (moveBtn.dataset.id) onAction(moveBtn.dataset.id); });
  acts.textContent = ''; acts.appendChild(moveBtn);
  function chip(el, closed) {
    el.dataset.closed = String(closed);
    put(el.querySelector('.lock-v'), closed ? 'closed' : 'open');
  }
  // next: the move to make, as its label; locks: {F, R} as the guide has them now
  function show({ stepIndex, next, locks, canUndo }) {
    const closed = stepIndex >= steps.length, s = closed ? done : steps[stepIndex];
    put(count, closed ? '' : label(stepIndex));
    put(title, s.title); put(text, s.text); put(cue, s.cue || '');
    chip(lockF, locks.F); chip(lockR, locks.R);
    moveBtn.hidden = !next; moveBtn.dataset.id = next ? next.id : '';
    if (next) put(moveBtn, next.label);
    else if (document.activeElement === moveBtn) play.focus();     // nothing left to make: focus moves to Play
    acts.classList.add('single');
    play.disabled = false; undo.disabled = !canUndo;                // at the end Play replays it
    [...list.children].forEach((li, i) => { li.className = i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''; });
  }
  function expand(id) {
    const app = $('.app');
    for (const win of document.querySelectorAll('.win')) {
      const on = win.id === id; win.classList.toggle('expanded', on);
      const b = win.querySelector('.expand'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Collapse' : 'Expand');
    }
    app.classList.toggle('has-expanded', !!id);
  }
  function playing(on) {
    play.dataset.playing = String(!!on); play.setAttribute('aria-label', on ? 'Pause' : 'Play all steps');
    play.querySelector('.play-k').textContent = on ? 'Pause' : 'Play';
  }
  return { show, expand, setParts, showParts, pick, loading, notice, playing };
}
