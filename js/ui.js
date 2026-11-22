/* ui.js – ikony, spodní okna (sheet), toasty, formulářové prvky a SVG grafy */
import { html, raw, esc, $, fmtShort, toISO } from './util.js';

// ---------- Ikony (24×24, obrys) ----------
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  bowl: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3"/>',
  heart: '<path d="M12 20s-7-4.4-9-9.2C1.6 7.2 4 4 7.2 4c1.9 0 3.3 1 4.8 2.8C13.5 5 14.9 4 16.8 4 20 4 22.4 7.2 21 10.8 19 15.6 12 20 12 20z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 000-6H8a3 3 0 010-6h8"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9.5a4 4 0 018 0"/><path d="M12 9.5l2-2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 9"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18.5 14.8c1.6.8 2.7 2.4 3 5.2"/>',
  paw: '<ellipse cx="12" cy="16" rx="4.6" ry="3.8"/><ellipse cx="5.5" cy="11" rx="1.9" ry="2.5"/><ellipse cx="9.3" cy="6.3" rx="1.9" ry="2.6"/><ellipse cx="14.7" cy="6.3" rx="1.9" ry="2.6"/><ellipse cx="18.5" cy="11" rx="1.9" ry="2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
};
const FILLED = new Set(['play', 'stop', 'paw']);
export function icon(name, size = 22) {
  const f = FILLED.has(name);
  return raw(`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="${f ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

// ---------- Spodní okna (sheet) ----------
// Tlačítko Zpět na Androidu zavře horní okno. Každé otevřené okno přidá položku do historie;
// přebytečné položky po programovém zavření se uklidí jedním history.go().
const stack = [];
let depth = 0;       // kolik našich položek je v historii před aktuální pozicí
let skip = 0;        // kolik popstate událostí způsobili my sami
let backTimer;

export function openSheet({ title = '', body = '', onClose, full = false, cls = '' } = {}) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<section class="sheet ${full ? 'sheet-full' : ''} ${esc(cls)}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Zavřít">${icon('x')}</button></header>
    <div class="sheet-body"></div></section>`;
  const bodyEl = $('.sheet-body', back);
  if (body instanceof Node) bodyEl.append(body); else bodyEl.innerHTML = String(body);
  document.body.append(back);
  document.body.classList.add('noscroll');
  const s = { el: back, body: bodyEl, onClose, close: () => closeSheet(s), $: (sel) => $(sel, back) };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) s.close(); });
  stack.push(s);
  history.pushState({ sheet: true }, '');
  depth++;
  requestAnimationFrame(() => back.classList.add('open'));
  return s;
}

export function closeSheet(s, fromPop = false) {
  const i = stack.indexOf(s);
  if (i < 0) return;
  stack.splice(i, 1);
  s.el.classList.remove('open');
  setTimeout(() => s.el.remove(), 220);
  if (!stack.length) document.body.classList.remove('noscroll');
  if (fromPop) depth--;
  else scheduleCleanup();
  s.onClose?.();
}
function scheduleCleanup() {
  clearTimeout(backTimer);
  backTimer = setTimeout(() => {
    const surplus = depth - stack.length;
    if (surplus > 0) { skip++; depth -= surplus; history.go(-surplus); }
  }, 0);
}
addEventListener('popstate', () => {
  if (skip > 0) { skip--; return; }
  const top = stack[stack.length - 1];
  if (top) closeSheet(top, true);
});
export const hasOpenSheet = () => stack.length > 0;

// ---------- Toast ----------
export function toast(msg, { label, onClick, ms = 3800 } = {}) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button type="button">${esc(label)}</button>` : ''}`;
  if (label) t.querySelector('button').onclick = () => { onClick?.(); t.remove(); };
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export function confirmDialog({ title, text = '', ok = 'Potvrdit', danger = false }) {
  return new Promise((res) => {
    let answered = false;
    const s = openSheet({
      title,
      body: html`<p class="muted">${text}</p>
        <div class="btn-row"><button class="btn ghost" data-no>Zrušit</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ok}</button></div>`,
      onClose: () => { if (!answered) res(false); },
    });
    s.$('[data-yes]').onclick = () => { answered = true; res(true); s.close(); };
    s.$('[data-no]').onclick = () => s.close();
  });
}

// ---------- Formuláře ----------
export const field = ({ label, name, type = 'text', value = '', attrs = '', hint = '' }) =>
  html`<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${value}" ${raw(attrs)}>${hint ? html`<small>${hint}</small>` : ''}</label>`;
export const textarea = ({ label, name, value = '', attrs = '' }) =>
  html`<label class="field"><span>${label}</span><textarea name="${name}" rows="3" ${raw(attrs)}>${value}</textarea></label>`;
export const select = ({ label, name, value = '', options = [] }) =>
  html`<label class="field"><span>${label}</span><select name="${name}">${options.map(([v, t]) => html`<option value="${v}" ${v === value ? raw('selected') : ''}>${t}</option>`)}</select></label>`;
export const readForm = (form) => Object.fromEntries(new FormData(form));

// ---------- Grafy ----------
export function ring(pct, { size = 96, stroke = 10 } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  return html`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${Math.round(p)} %">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" class="ring-t" text-anchor="middle" dominant-baseline="central">${Math.round(p)} %</text></svg>`;
}

/** Malá čára vývoje 0–100 % (pokrok v tréninku). */
export function sparkline(values, { w = 260, h = 64 } = {}) {
  if (!values.length) return html``;
  const pad = 6, iw = w - pad * 2, ih = h - pad * 2;
  const pts = values.map((v, i) => [pad + (values.length === 1 ? iw / 2 : (i * iw) / (values.length - 1)), pad + ih * (1 - v / 100)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return html`<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Vývoj pokroku">
    <line x1="${pad}" x2="${w - pad}" y1="${pad}" y2="${pad}" class="spark-grid"/><line x1="${pad}" x2="${w - pad}" y1="${h - pad}" y2="${h - pad}" class="spark-grid"/>
    ${pts.length > 1 ? html`<path d="${d}" class="spark-line"/>` : ''}
    <circle cx="${last[0]}" cy="${last[1]}" r="4" class="spark-dot"/></svg>`;
}

/** Sloupce posledních dní: dobře (venku) a nehody. rows = [{label, good, bad}] */
export function miniBars(rows, { w = 300, h = 96 } = {}) {
  const max = Math.max(4, ...rows.map((r) => r.good + r.bad));
  const bw = w / rows.length, base = h - 20, scale = (base - 6) / max;
  return html`<svg class="bars" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Čistota za posledních dní">
    ${rows.map((r, i) => {
      const x = i * bw + bw * 0.2, bwid = bw * 0.6;
      const gh = r.good * scale, bh = r.bad * scale;
      return html`<rect x="${x}" y="${base - gh}" width="${bwid}" height="${gh}" rx="3" class="bar-good"/>
        <rect x="${x}" y="${base - gh - bh}" width="${bwid}" height="${bh}" rx="3" class="bar-bad"/>
        <text x="${x + bwid / 2}" y="${h - 5}" text-anchor="middle" class="axis">${r.label}</text>`;
    })}</svg>`;
}

/**
 * Graf váhy v čase. pts: [{t (ms), y (kg)}], ref: [{t, y}] orientační křivka (jen uvnitř rozsahu).
 * Vrací SVG s kolečky data-i (klepnutím se zobrazí hodnota).
 */
export function weightChart({ pts, ref = [], w = 340, h = 210 }) {
  const m = { l: 34, r: 14, t: 14, b: 26 };
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  let x0 = Math.min(...pts.map((p) => p.t)), x1 = Math.max(...pts.map((p) => p.t));
  if (x1 - x0 < 14 * 864e5) x1 = x0 + 14 * 864e5;
  x1 += (x1 - x0) * 0.04;

  // referenční křivka: lineární interpolace mezi uzly, ořezaná na zobrazený rozsah
  const rk = [...ref].sort((a, b) => a.t - b.t);
  const refAt = (t) => {
    for (let i = 1; i < rk.length; i++) {
      if (t >= rk[i - 1].t && t <= rk[i].t) return rk[i - 1].y + ((rk[i].y - rk[i - 1].y) * (t - rk[i - 1].t)) / (rk[i].t - rk[i - 1].t);
    }
    return null;
  };
  const refPts = [];
  if (rk.length > 1) {
    const lo = Math.max(x0, rk[0].t), hi = Math.min(x1, rk[rk.length - 1].t);
    if (lo < hi) {
      refPts.push({ t: lo, y: refAt(lo) });
      rk.forEach((k) => { if (k.t > lo && k.t < hi) refPts.push(k); });
      refPts.push({ t: hi, y: refAt(hi) });
    }
  }
  const maxY0 = Math.max(...pts.map((p) => p.y), ...refPts.map((p) => p.y), 1);
  const step = maxY0 < 12 ? 2 : maxY0 < 30 ? 5 : 10;
  const yMax = Math.ceil((maxY0 * 1.08) / step) * step;
  const sx = (t) => m.l + ((t - x0) / (x1 - x0)) * iw;
  const sy = (v) => m.t + ih - (v / yMax) * ih;
  const nGrid = yMax / step;
  const gridStep = nGrid > 6 ? step * 2 : step;
  const grid = [];
  for (let v = 0; v <= yMax; v += gridStep) grid.push(v);
  const ticks = [0, 1, 2, 3].map((i) => x0 + ((x1 - x0) * i) / 3);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
  const area = pts.length > 1 ? `${line} L${sx(pts[pts.length - 1].t).toFixed(1)} ${sy(0)} L${sx(pts[0].t).toFixed(1)} ${sy(0)} Z` : '';
  const refLine = refPts.map((p, i) => (i ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');

  return html`<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Graf vývoje váhy">
    ${grid.map((v) => html`<line x1="${m.l}" x2="${w - m.r}" y1="${sy(v)}" y2="${sy(v)}" class="grid"/><text x="${m.l - 6}" y="${sy(v)}" text-anchor="end" dominant-baseline="central" class="axis">${v}</text>`)}
    ${ticks.map((t) => html`<text x="${sx(t)}" y="${h - 6}" text-anchor="middle" class="axis">${fmtShort(toISO(new Date(t)))}</text>`)}
    ${refLine ? html`<path d="${refLine}" class="ref"/>` : ''}
    ${area ? html`<path d="${area}" class="area"/>` : ''}
    ${pts.length > 1 ? html`<path d="${line}" class="wline"/>` : ''}
    ${pts.map((p, i) => html`<circle cx="${sx(p.t)}" cy="${sy(p.y)}" r="4.5" class="pt"/><circle cx="${sx(p.t)}" cy="${sy(p.y)}" r="15" class="hit" data-i="${i}"/>`)}
  </svg>`;
}
