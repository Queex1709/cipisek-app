/* compat.js – „Režim pro starší telefon“ (hlavně starší Samsungy se zakulacenou obrazovkou a 3 tlačítky dole).
   Zapne atribut data-compat a pevné odsazení shora a zdola, protože starší systémy často hlásí bezpečné okraje jako 0. */
export function applyCompat(s) {
  const r = document.documentElement;
  if (!s?.compat) { delete r.dataset.compat; r.style.removeProperty('--cx-t'); r.style.removeProperty('--cx-b'); return; }
  r.dataset.compat = '1';
  r.style.setProperty('--cx-t', `${s.compatTop ?? 30}px`);
  r.style.setProperty('--cx-b', `${s.compatBottom ?? 48}px`);
}
