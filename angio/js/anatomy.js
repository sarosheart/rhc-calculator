// The anatomy controls: dominance (right / left / co), the ramus intermedius, and the three bypass grafts — with one short
// note on what the reader is now looking at. Every change goes through setVariant(), which waits for the data first.
// Turning on something the shown system hides (the ramus or a left graft while Right is shown) widens the view to Both, so
// the button never seems to do nothing.
import { GRAFT_IDS } from './segments.js';

const DOMS = [['right', 'Right', 'Right dominant'], ['left', 'Left', 'Left dominant'], ['co', 'Co', 'Co-dominant']];
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// written from what this model's trees contain (coronary-{right,left,co}.json) and the dataset counts in ATTRIBUTION.md
// Dominance is named for the artery that crosses the crux to give the PDA and the posterolateral branches.
const DOM_NOTE = {
  right: 'Right dominant: the right coronary artery crosses the crux to give the posterior descending artery (PDA) and the posterolateral branches.',
  left: 'Left dominant: the circumflex crosses the crux to give the PDA and the posterolateral branches; the right coronary is small and does not reach the crux.',
  co: 'Co-dominant (balanced): the right coronary gives the PDA, and in this model the posterolateral branches come from both the right coronary and the circumflex.',
};
const COUNTS = 'Of the 773 coronary CT scans this model averages, 706 were labelled right dominant, 39 left dominant and 28 co-dominant; these are the dataset\'s labels, not population rates.';
const RAMUS_NOTE = 'Ramus intermedius (12): a third branch of the left main, arising between the LAD and the circumflex.';
const graftNote = (dom) => `Bypass grafts: the left internal mammary artery (LIMA) to the mid LAD, and vein grafts from the ascending aorta to the
  first obtuse marginal and to the PDA${dom === 'left' ? ' (from the circumflex in this left-dominant heart)' : ''}. Each graft is injected on its
  own and is listed with the artery it was grafted to. Their courses are built from measurements of 16 post-operative models; the
  sternal wires and the clips on the LIMA show as metal.`;

// view(): the state as it will be once any pending change lands (toggles build on that, so quick taps add up)
export function mountAnatomy(root, state, { names = {}, graftArtery = () => 'left', setVariant, view = () => state.get() }) {
  const btn = (attrs, text) => `<button type="button" class="${attrs.cls || 'tool-btn'}" ${Object.entries(attrs).filter(([k]) => k !== 'cls')
    .map(([k, v]) => `${k}="${esc(v)}"`).join(' ')} aria-pressed="false">${esc(text)}</button>`;
  root.innerHTML = `<h3 class="anat-h">Anatomy</h3>
    <div class="anat-row"><span class="anat-k" id="anat-dom">Dominance</span>
      <div class="ctl-sys" role="group" aria-labelledby="anat-dom">${DOMS.map(([k, t, full]) => btn({ cls: 'seg', 'data-dom': k, 'aria-label': full }, t)).join('')}</div></div>
    <div class="anat-row"><span class="anat-k" id="anat-var">Variant</span>
      <div class="anat-btns" role="group" aria-labelledby="anat-var">${btn({ 'data-role': 'ramus' }, 'Ramus intermedius')}</div></div>
    <div class="anat-row"><span class="anat-k" id="anat-gr">Grafts</span>
      <div class="anat-btns" role="group" aria-labelledby="anat-gr">${GRAFT_IDS.map(id => btn({ 'data-graft': id }, names[id] || id)).join('')}</div></div>
    <p class="anat-note" data-role="anatomy-note" aria-live="polite"></p>`;
  const note = root.querySelector('[data-role="anatomy-note"]');

  // widen the view when the thing turned on belongs to an artery that is not shown
  const widen = (s, artery) => (s.sys === 'both' || s.sys === artery) ? {} : { sys: 'both' };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = view();
    if (b.dataset.dom) setVariant({ dom: b.dataset.dom });
    else if (b.dataset.role === 'ramus') setVariant({ ramus: !s.ramus, ...(s.ramus ? {} : widen(s, 'left')) });
    else if (b.dataset.graft) {
      const id = b.dataset.graft, on = s.grafts.includes(id);
      setVariant({ grafts: on ? s.grafts.filter(g => g !== id) : [...s.grafts, id], ...(on ? {} : widen(s, graftArtery(s.dom, id))) });
    }
  });
  function sync(s) {
    root.querySelectorAll('[data-dom]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dom === s.dom)));
    root.querySelector('[data-role="ramus"]').setAttribute('aria-pressed', String(!!s.ramus));
    root.querySelectorAll('[data-graft]').forEach(b => b.setAttribute('aria-pressed', String(s.grafts.includes(b.dataset.graft))));
    // a graft that is on but belongs to the artery not shown says where it shows
    const hidden = s.sys === 'both' ? [] : s.grafts.filter(id => graftArtery(s.dom, id) !== s.sys)
      .map(id => `${names[id] || id} shows with the ${graftArtery(s.dom, id)} coronary.`);
    const parts = [failure, DOM_NOTE[s.dom] + ' ' + COUNTS, s.ramus ? RAMUS_NOTE : '', s.grafts.length ? graftNote(s.dom) : '', ...hidden].filter(Boolean);
    const html = parts.map(p => `<span>${esc(p.replace(/\s+/g, ' '))}</span>`).join(' ');
    if (note.innerHTML !== html) note.innerHTML = html;
  }
  let failure = '';
  const unsub = state.subscribe(sync); sync(state.get());
  return {
    busy(on) { root.setAttribute('aria-busy', String(!!on)); },
    error(what) { failure = what ? 'That anatomy could not load. Check the connection and tap again.' : ''; sync(state.get()); },
    dispose() { unsub(); root.replaceChildren(); },
  };
}
