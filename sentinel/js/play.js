// Play: the correct moves one after another, each followed by a pause (longer when it opens a new step, to read its
// words), until the last step is done. Pausing lets the move under way finish; nothing else is done.
export const READ = Object.freeze({ within: 800, base: 2500, perChar: 12, max: 6000 });
export const pauseAfter = (newStep, words = '') =>
  (newStep ? Math.min(READ.max, READ.base + READ.perChar * words.length) : READ.within);

// next(): the correct move now, or null · stepIndex(): the step on show · words(): its words · perform(a): the move,
// resolved when it has played · wait(ms) · onChange(playing)
export function createPlayer({ next, stepIndex, words, perform, wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  onChange = () => {} }) {
  let serial = 0, current = 0;
  function stop() { if (!current) return; current = 0; onChange(false); }
  async function play() {
    if (current || !next()) return;
    const me = current = ++serial; onChange(true);
    for (let a = next(); a && current === me; a = next()) {
      const si = stepIndex();
      await perform(a);
      if (current !== me || !next()) break;
      const opened = stepIndex() !== si;
      await wait(pauseAfter(opened, opened ? words() : ''));
    }
    if (current === me) stop();
  }
  const toggle = () => (current ? (stop(), Promise.resolve()) : play());
  return { play, stop, toggle, playing: () => current !== 0 };
}
