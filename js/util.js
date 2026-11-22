/* util.js – malé pomocné funkce bez závislostí: šablony, datumy, čeština, trasa */

// ---------- HTML šablony s automatickým escapováním ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
/** Označí řetězec jako už bezpečné HTML (neescapuje se). */
export const raw = (s) => new Raw(String(s ?? ''));
export const isRaw = (v) => v instanceof Raw;

const part = (v) =>
  v instanceof Raw ? v.s
  : Array.isArray(v) ? v.map(part).join('')
  : v === false || v == null ? ''
  : esc(v);

/** html`<p>${text}</p>` – hodnoty se escapují, vnořená html`` šablona ne. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += part(vals[i]);
  });
  return new Raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// ---------- Datumy (celé dny jako 'YYYY-MM-DD' v místním čase) ----------
const z = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDaysISO = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

function addMonths(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
}
export const addMonthsISO = (iso, n) => toISO(addMonths(parseISO(iso), n));

/** Věk k danému dni: celé měsíce + zbylé dny (31. 8. → 22. 11. = 2 měsíce a 22 dní). */
export function ageParts(birthISO, atISO = todayISO()) {
  const b = parseISO(birthISO), a = parseISO(atISO);
  const totalDays = diffDays(birthISO, atISO);
  if (a < b) return { neg: true, months: 0, days: 0, totalDays, weeks: 0, decimalMonths: 0 };
  let months = (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
  if (addMonths(b, months) > a) months--;
  const days = Math.round((a - addMonths(b, months)) / 86400000);
  return { months, days, totalDays, weeks: Math.floor(totalDays / 7), decimalMonths: totalDays / 30.4375 };
}

// ---------- Čeština ----------
export const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
export const nDays = (n) => `${n} ${plural(n, 'den', 'dny', 'dní')}`;
export const nWeeks = (n) => `${n} ${plural(n, 'týden', 'týdny', 'týdnů')}`;
export const nMonths = (n) => `${n} ${plural(n, 'měsíc', 'měsíce', 'měsíců')}`;
export const nYears = (n) => `${n} ${plural(n, 'rok', 'roky', 'let')}`;

/** Věk jako text: „2 měsíce a 22 dní“. */
export function ageText(birthISO, atISO) {
  const p = ageParts(birthISO, atISO);
  if (p.neg) return 'ještě nenarozen';
  if (p.months < 1) return p.totalDays === 0 ? 'narozen dnes' : nDays(p.days);
  if (p.months < 12) return p.days ? `${nMonths(p.months)} a ${nDays(p.days)}` : nMonths(p.months);
  const y = Math.floor(p.months / 12), m = p.months % 12;
  return m ? `${nYears(y)} a ${nMonths(m)}` : nYears(y);
}

/** Věk rozdělený na velkou a malou část pro hero kartu. */
export function ageDisplay(birthISO, atISO) {
  const p = ageParts(birthISO, atISO);
  if (p.neg) return { big: '—', small: '' };
  if (p.months < 1) return { big: nDays(p.days), small: '' };
  if (p.months < 12) return { big: nMonths(p.months), small: p.days ? `a ${nDays(p.days)}` : '' };
  const y = Math.floor(p.months / 12), m = p.months % 12;
  return { big: nYears(y), small: m ? `a ${nMonths(m)}` : '' };
}

const fDate = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
const fDayMonth = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long' });
const fShort = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' });
export const fmtDate = (iso) => fDate.format(parseISO(iso));
export const fmtDayMonth = (iso) => fDayMonth.format(parseISO(iso));
export const fmtShort = (iso) => fShort.format(parseISO(iso));
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
export const timeInput = (ts) => { const d = new Date(ts); return `${z(d.getHours())}:${z(d.getMinutes())}`; };

export function relDay(iso) {
  const d = diffDays(todayISO(), iso);
  if (d === 0) return 'dnes';
  if (d === 1) return 'zítra';
  if (d === -1) return 'včera';
  return d > 0 ? `za ${nDays(d)}` : `před ${nDays(-d)}`;
}

const nf = (n, max = 2) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: max });
export const fmtKg = (n) => `${nf(n, 2)} kg`;
export const fmtKm = (m) => `${nf(m / 1000, 2)} km`;
export const fmtMin = (min) => {
  min = Math.round(min);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};
export const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${z(m)}:${z(sec)}` : `${m}:${z(sec)}`;
};
export const parseNum = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// ---------- Trasa ----------
// Firestore neumí vnořená pole, proto se trasa ukládá jako řetězec „lat,lng;lat,lng“.
export const encodePath = (pts) => pts.map((p) => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(';');
export const decodePath = (s) => (s ? s.split(';').map((x) => x.split(',').map(Number)) : []);

export function haversine(a, b) {
  const R = 6371000, t = (x) => (x * Math.PI) / 180;
  const dLat = t(b[0] - a[0]), dLng = t(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function pathLength(pts) {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]);
  return m;
}
/** Zredukuje body tak, aby sousední byly aspoň minM metrů od sebe (první a poslední zůstanou). */
export function thin(pts, minM = 4) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) if (haversine(out[out.length - 1], pts[i]) >= minM) out.push(pts[i]);
  out.push(pts[pts.length - 1]);
  return out;
}
/** Vybere až n rovnoměrně rozložených bodů (pro odkaz do Google Map). */
export function sample(pts, n) {
  if (pts.length <= n) return pts.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (n - 1))]);
  return out;
}

// ---------- Různé ----------
export const DOW = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
export const minutesOf = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** „před 5 min“, „před 3 h“, „včera“… */
export function agoText(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `před ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'včera' : `před ${nDays(d)}`;
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* záloha níž */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* nic */ }
  ta.remove();
  return ok;
}
