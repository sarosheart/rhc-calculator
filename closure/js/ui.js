// The guide, the step list and the buttons under the two windows. It shows what the page tells it and reports taps.
export function createUI(initial, { onAction, onShowMe, onUndo, onRestart, onJump, onExpand, onPick = () => {} }) {
  let { steps, actions, done } = initial;
  const guide = document.querySelector('#guide');
  const $ = (s) => document.querySelector(s);
  const title = $('#guide .guide-title'), text = $('#guide .guide-text'), cue = $('#guide .guide-cue'), count = $('#guide .step-count');
  const acts = $('#actions'), undo = $('#undo'), showme = $('#showme'), restart = $('#restart'), list = $('#steps ol');
  function buildList() {
    list.textContent = '';
    steps.forEach((s, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = s.title; b.addEventListener('click', () => onJump(i));
      li.appendChild(b); list.appendChild(li);
    });
  }
  buildList();
  // a new device: its steps, its action labels, its closing words
  function setMode(m) { ({ steps, actions, done } = m); buildList(); setParts(m.parts || []); }
  // "What's inside": one button per part the device has; only the parts in view are shown
  const partsBox = $('#parts .parts-list');
  let partsKey = '';
  function setParts(parts) {
    partsBox.textContent = ''; partsKey = '';
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
  // while a device's code and models load nothing can be tapped
  function loading(on) {
    $('.actionbar').setAttribute('aria-busy', String(!!on));
    if (on) { showme.disabled = true; for (const b of acts.children) b.disabled = true; }
  }
  const notice = (t) => { cue.textContent = t; };
  showme.addEventListener('click', onShowMe); undo.addEventListener('click', onUndo); restart.addEventListener('click', onRestart);
  for (const win of document.querySelectorAll('.win')) {
    const btn = win.querySelector('.expand');
    btn.addEventListener('click', () => onExpand(win.classList.contains('expanded') ? null : win.id));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') onExpand(null); });

  // available: the correct action first, then the wrong moves the page offers; failed: the failure's words, if one happened
  function show({ stepIndex, next, available = next ? [next] : [], failed = null, canUndo }) {
    const closed = !failed && stepIndex >= steps.length, s = closed ? done : steps[Math.min(stepIndex, steps.length - 1)];
    guide.classList.toggle('failed', !!failed);
    count.textContent = failed ? 'What went wrong' : closed ? '' : `Step ${stepIndex + 1} of ${steps.length}`;
    title.textContent = failed ? failed.title : s.title;
    text.textContent = failed ? `${failed.what} ${failed.why}` : s.text;
    cue.textContent = failed ? failed.fix : s.cue || '';
    acts.textContent = '';
    for (const a of available) {
      const b = document.createElement('button'); b.type = 'button'; b.className = a === next ? 'act' : 'act alt';
      b.textContent = actions[a].label; b.addEventListener('click', () => onAction(a)); acts.appendChild(b);
    }
    acts.classList.toggle('single', available.length === 1);
    showme.disabled = !next; undo.disabled = !canUndo;
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
  return { show, expand, setMode, showParts, pick, loading, notice };
}
