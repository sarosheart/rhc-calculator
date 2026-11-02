// The techniques the page can show. Each loads on first use. (Phase 3: Provisional, DK crush, mini-crush, culotte, T / TAP.)
export const MODES = [
  { id: 'provisional', label: 'Provisional', load: () => import('./provisional.js') },
  { id: 'dk-crush', label: 'DK crush', load: () => import('./dk-crush.js') },
  { id: 'mini-crush', label: 'Mini-crush', load: () => import('./mini-crush.js') },
  { id: 'culotte', label: 'Culotte', load: () => import('./culotte.js') },
  { id: 'tap', label: 'T / TAP', load: () => import('./tap.js') },
];
export const DEFAULT_MODE = 'provisional';
export const modeFromHash = (hash) => (MODES.some(m => `#${m.id}` === hash) ? hash.slice(1) : DEFAULT_MODE);
export async function loadMode(id) { const m = MODES.find(x => x.id === id) || MODES[0]; return (await m.load()).default; }
