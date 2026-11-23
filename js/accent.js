/* accent.js – barva aplikace (ikona, úvodní obrazovka, tlačítka). Volí se v Nastavení → Vzhled.
   Vzhled uvnitř aplikace se změní hned. Ikonu na ploše telefonu určuje manifest, proto ho přepínáme taky. */
export const ACCENTS = [
  { id: 'g', name: 'Původní zelená', boot: ['#2b7a66', '#164a3e'], fg: '#ffffff' },
  { id: 'a', name: 'Horská modrá', boot: ['#3f7fcf', '#1b4b8f'], fg: '#ffffff' },
  { id: 'b', name: 'Medová oranžová', boot: ['#f1a23a', '#c2691a'], fg: '#ffffff' },
  { id: 'c', name: 'Fialová', boot: ['#8b6fd6', '#4d3a9a'], fg: '#ffffff' },
  { id: 'e', name: 'Černá se zlatou', boot: ['#2a2f36', '#0e1114'], fg: '#f5c66b' },
  { id: 'f', name: 'Mátová', boot: ['#bfeadb', '#8fd3bd'], fg: '#17493d' },
];
export const accentOf = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];
export const iconDir = (id) => (id === 'g' || !ACCENTS.some((a) => a.id === id) ? 'icons' : `icons/${id}`);

export function applyAccent(id) {
  const a = accentOf(id);
  const root = document.documentElement;
  if (a.id === 'g') delete root.dataset.accent; else root.dataset.accent = a.id;
  const dir = iconDir(a.id);
  const set = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('link[rel=manifest]', 'href', a.id === 'g' ? 'manifest.webmanifest' : `manifest-${a.id}.webmanifest`);
  set('link[rel=icon]', 'href', `${dir}/icon.svg`);
  set('link[rel=apple-touch-icon]', 'href', `${dir}/apple-touch-icon.png`);
  root.style.setProperty('--boot1', a.boot[0]);
  root.style.setProperty('--boot2', a.boot[1]);
  root.style.setProperty('--boot-fg', a.fg);
}
