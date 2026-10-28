// Details: "Current view" (the nearest standard view and what it is for) and "Segments" (every shown segment at this exact
// angle: seen best, foreshortened or overlapped). Rebuilt at most once a frame, and only when its text would change.
import { classify, nearestView, segmentName, segmentsShown } from './segments.js';
import { segmentVisibility } from './data.js';

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// floored, so a segment just under the 25 % limit never prints "25%" in the clear group
const pct = (x) => `${Math.floor(x * 100 + 1e-9)}%`;
function rangeText(r) {
  const one = ([a, b], pos, neg) => {
    const s = (x) => x === 0 ? null : (x > 0 ? `${pos} ${x}` : `${neg} ${-x}`);
    if (a === b) return s(a);
    if (a < 0 && b <= 0) return b === 0 ? `AP to ${neg} ${-a}` : `${neg} ${-b}–${-a}`;
    if (a >= 0 && b > 0) return a === 0 ? `AP to ${pos} ${b}` : `${pos} ${a}–${b}`;
    return `${neg} ${-a} to ${pos} ${b}`;
  };
  const rot = one(r.lao, 'LAO', 'RAO') || 'AP', ang = one(r.cra, 'CRA', 'CAU');
  return ang ? `${rot}, ${ang.replace(/^AP to /, '0 to ')}` : rot;
}

// a citation as the reader sees it: without the notes on how much of the paper could be read
const cite = (c) => c.replace(/ \((figure captions only[^)]*|abstract only)\)/, '');

// Everything here follows the variant on screen: the dominance's tree and tables, the ramus, the grafts.
export function mountDetails(root, state, D, { onView }) {
  let lastKey = '', raf = 0;

  function currentView(s) {
    const nv = nearestView(D.views, s.lao, s.cra, s.sys); if (!nv) return '';
    const v = nv.view, at = nv.distance <= 2, model = v.seen_best_source === 'model';
    const tree = D.trees[s.dom], inHeart = new Set(segmentsShown(tree, 'both', { ramus: true })), present = new Set(segmentsShown(tree, 'both', s));
    const why = (id) => !inHeart.has(id) ? 'not in this heart' : 'ramus not shown';
    const seen = v.seen_best.map(id => present.has(id) ? esc(segmentName(D.views, id)) : `${esc(segmentName(D.views, id))} <span class="dim">(${why(id)})</span>`);
    // where this model, at THIS angle, does not bear the claim out — said plainly, never hidden
    // ... but only ON the view (inside its usual range, ±4°, or within 5°): off the view the literature makes no claim
    const near = nv.distance <= 5 || (s.lao >= v.range.lao[0] - 4 && s.lao <= v.range.lao[1] + 4 && s.cra >= v.range.cra[0] - 4 && s.cra <= v.range.cra[1] + 4);
    const notes = !near ? [] : v.seen_best.filter(id => present.has(id)).map(id => ({ id, c: segmentVisibility(D.visibility, s.dom, id, s.lao, s.cra, s) }))
      .filter(({ c }) => c && (c.foreshortening >= D.views.fs_limit || c.overlap >= D.views.overlap_limit))
      .map(({ id, c }) => `${esc(segmentName(D.views, id))} is ${c.foreshortening >= c.overlap ? pct(c.foreshortening) + ' foreshortened' : pct(c.overlap) + ' overlapped'}`);
    return `<h3>Current view</h3>
      <p class="cv-head">${at ? `At <strong>${esc(v.name)}</strong>` : `Nearest standard view: <strong>${esc(v.name)}</strong> · ${Math.round(nv.distance)}° away
        <button type="button" class="tool-btn small" data-role="go-view" data-target-view="${esc(v.id)}">Go there</button>`}</p>
      <p>${esc(v.purpose)}</p>
      <p><span class="k">What you should see:</span> ${esc(v.what_you_see)}</p>
      <p><span class="k">Usual range:</span> ${esc(rangeText(v.range))}</p>
      <p><span class="k">Seen best${model ? '' : ' (published)'}:</span> ${seen.join(', ') || '—'}</p>
      ${model ? '<p class="dim">Few published sources describe this view\'s use: the angle comes from one atlas figure, and the segments listed are this model\'s.</p>' : ''}
      ${notes.length ? `<p class="model-note" data-role="model-note">In this model at this exact angle, ${notes.join('; ')}. Real anatomy varies; the published views are a starting point.</p>` : ''}
      <details class="sources"><summary data-role="sources">Sources</summary><ul>${v.sources.map(x => `<li>${esc(cite(x.citation))}${x.location ? ` — ${esc(x.location)}` : ''}</li>`).join('')}</ul></details>`;
  }

  function segments(s) {
    const c = classify(D, s.dom, s.sys, s.lao, s.cra, s);
    const row = (r) => `<button type="button" class="seg-row" data-seg="${esc(r.id)}" aria-pressed="${r.id === s.sel}">
        <span class="sr-name">${esc(r.name)}</span>
        <span class="sr-bars" aria-hidden="true"><i class="b-fs" style="width:${Math.min(100, r.fs * 100).toFixed(0)}%"></i><i class="b-ov" style="width:${Math.min(100, r.ov * 100).toFixed(0)}%"></i></span>
        <span class="sr-num">foreshortened ${pct(r.fs)} · overlapped ${pct(r.ov)}${r.with ? `, crossed by ${esc(r.with)}` : ''}</span></button>`;
    const group = (key, title, rows) => `<div class="seg-group" data-group="${key}"><h4>${title} <span class="dim">${rows.length}</span></h4>${rows.map(row).join('') || '<p class="dim">None at this angle.</p>'}</div>`;
    return `<h3>Segments at this angle</h3>
      ${c.pending ? '<p class="dim" data-role="loading">Loading the numbers for this heart…</p>' : ''}
      ${group('best', 'Seen clearly', c.best)}${group('foreshortened', 'Foreshortened', c.foreshortened)}${group('overlapped', 'Overlapped', c.overlapped)}
      <p class="dim small">Foreshortened: how much shorter the segment looks than it is. Overlapped: how much of it is crossed by
      other branches of the same coronary artery (left or right), in front or behind${s.grafts?.length ? '; a graft, by the artery it was grafted to' : ''}.
      Either at 25% or more moves it out of "Seen clearly". Tap a segment to highlight it.</p>`;
  }

  const cvEl = root.querySelector('[data-role="current-view"]'), sgEl = root.querySelector('[data-role="segments"]');
  function update() {
    raf = 0; const s = state.get(); const a = currentView(s), b = segments(s);
    if (a + b === lastKey) return; lastKey = a + b;
    // keep keyboard focus across the rebuild: a segment row by its id, anything else in the panel by its data-role
    const f = document.activeElement, focused = root.contains(f) ? f.dataset?.seg : null, focusedRole = root.contains(f) && !focused ? f.dataset?.role : null;
    if (cvEl.innerHTML !== a) {
      const open = cvEl.querySelector('details.sources')?.open; cvEl.innerHTML = a;
      if (open) cvEl.querySelector('details.sources').open = true;
    }
    sgEl.innerHTML = b;
    if (focused) sgEl.querySelector(`[data-seg="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    else if (focusedRole && document.activeElement !== f) root.querySelector(`[data-role="${CSS.escape(focusedRole)}"]`)?.focus({ preventScroll: true });
  }
  root.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-seg]'); if (seg) { const id = seg.dataset.seg; state.set({ sel: state.get().sel === id ? null : id }); return; }
    const go = e.target.closest('[data-role="go-view"]'); if (go) onView(go.dataset.targetView);
  });
  const unsub = state.subscribe(() => { if (!raf) raf = requestAnimationFrame(update); });
  update();
  return { dispose() { unsub(); cancelAnimationFrame(raf); } };
}
