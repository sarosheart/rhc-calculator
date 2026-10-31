// The devices the page can show. Each loads on first use (its code and its models).
export const MODES = [
  { id: 'proglide', label: 'ProGlide', load: () => import('./proglide.js') },
  { id: 'preclose', label: 'Pre-close', load: () => import('./preclose.js') },
  { id: 'angioseal', label: 'Angio-Seal', load: () => import('./angioseal.js') },
  { id: 'fig8', label: 'Figure-of-8', load: () => import('./fig8.js') },
];
export const DEFAULT_MODE = 'proglide';
export const modeFromHash = (hash) => (MODES.some(m => `#${m.id}` === hash) ? hash.slice(1) : DEFAULT_MODE);
export async function loadMode(id) { const m = MODES.find(x => x.id === id) || MODES[0]; return (await m.load()).default; }
