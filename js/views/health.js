/* views/health.js – veterina a zdraví: termíny s odpočtem, historie, orientační plán pro štěně a export do kalendáře. */
import * as store from '../store.js';
import {
  html, raw, $, todayISO, addDaysISO, diffDays, fmtDate, fmtShort, fmtKg, relDay, nDays, parseNum,
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, select, readForm } from '../ui.js';
import { KIND, vetCalendar } from '../data.js';
import { nextVet } from '../domain.js';
import * as aidtab from './aidtab.js';
import { openVetCard } from '../vetcard.js';

let root = null;
let tab = 'vet';

export function render(r) {
  root = r;
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('t');
  if (q === 'krmeni') { location.replace('#/jidlo'); return; }
  if (q === 'pomoc') tab = 'aid';
  root.onclick = onClick;
  draw();
}
export const refresh = () => root && draw();
export function destroy() { if (root) { root.onclick = null; root.onsubmit = null; } root = null; }

const kindOf = (k) => KIND[k] || KIND.other;

function draw() {
  const meta = store.getMeta();
  const t = todayISO();
  const all = store.list('vet');
  const planned = all.filter((v) => v.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const done = all.filter((v) => v.status !== 'planned').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const next = nextVet();
  const cal = vetCalendar(meta.birthDate);
  const byKey = (key) => all.find((v) => v.calKey === key);

  root.innerHTML = String(html`
    <header class="page-head"><h1>Zdraví</h1></header>
    <div class="seg" role="tablist">
      <button role="tab" class="${tab === 'vet' ? 'on' : ''}" aria-selected="${tab === 'vet'}" data-tab="vet">Veterina</button>
      <button role="tab" class="${tab === 'aid' ? 'on' : ''}" aria-selected="${tab === 'aid'}" data-tab="aid">První pomoc</button>
    </div>
    ${tab === 'aid' ? aidtab.renderHtml() : html`
    ${next ? countdown(next, t) : html`<section class="card countdown empty-cd"><b>Žádný termín</b><p class="muted">Naplánuj další očkování, odčervení nebo kontrolu.</p></section>`}

    <button class="btn primary block" data-add>${icon('plus', 20)} Přidat záznam nebo termín</button>

    ${planned.length ? html`<h2 class="sec">Naplánováno</h2>${planned.map((v) => plannedItem(v, t))}` : ''}

    <h2 class="sec">Plán pro štěně</h2>
    <p class="muted small">Orientační schéma podle věku. Skutečný plán určuje veterinář.</p>
    ${cal.map((c) => calItem(c, byKey(c.key)))}

    <h2 class="sec">Historie ${done.length ? html`<small>${done.length}</small>` : ''}</h2>
    ${done.length ? html`<ul class="hist">${done.map((v) => html`<li><button class="hrow" data-edit="${v.id}">
        <span class="e" aria-hidden="true">${kindOf(v.kind).emoji}</span>
        <span class="htxt"><b>${v.title}</b><small>${fmtDate(v.date)}${v.weightKg ? ` · ${fmtKg(v.weightKg)}` : ''}${v.by ? ` · ${v.by}` : ''}</small>${v.note ? html`<small class="note">${v.note}</small>` : ''}</span>
        ${icon('chev', 16)}</button></li>`)}</ul>`
      : html`<p class="empty">Tady se objeví proběhlé návštěvy, očkování a odčervení.</p>`}
    <button class="btn ghost block" data-vetcard>${icon('download', 20)} Karta pro veterináře</button>`}`);
}

function countdown(v, t) {
  const d = diffDays(t, v.date);
  const late = d < 0;
  const big = d === 0 ? 'Dnes' : late ? nDays(-d) : nDays(d);
  const label = d === 0 ? 'je termín' : late ? 'po termínu' : 'do termínu';
  return html`<section class="card countdown ${late ? 'late' : d <= 3 ? 'soon' : ''}">
    <div class="cd-num"><b>${big}</b><span>${label}</span></div>
    <div class="cd-info"><h2>${kindOf(v.kind).emoji} ${v.title}</h2><p class="muted">${fmtDate(v.date)}</p></div>
    <button class="btn small" data-done="${v.id}">${icon('check', 16)} Hotovo</button>
  </section>`;
}

function plannedItem(v, t) {
  const d = diffDays(t, v.date);
  return html`<article class="card plan ${d < 0 ? 'late' : ''}">
    <div class="plan-top"><span class="e" aria-hidden="true">${kindOf(v.kind).emoji}</span>
      <div><h3>${v.title}</h3><p class="muted small">${fmtDate(v.date)} · ${d < 0 ? 'po termínu' : relDay(v.date)}</p></div></div>
    ${v.note ? html`<p class="walk-note">${v.note}</p>` : ''}
    <div class="btn-row">
      <button class="btn primary small" data-done="${v.id}">${icon('check', 16)} Hotovo</button>
      <button class="btn ghost small" data-ics="${v.id}">${icon('cal', 16)} Do kalendáře</button>
      <button class="icon-btn" data-edit="${v.id}" aria-label="Upravit">${icon('edit', 18)}</button>
    </div></article>`;
}

function calItem(c, rec) {
  const range = c.from === c.to ? fmtShort(c.from) : `${fmtShort(c.from)} – ${fmtShort(c.to)}`;
  const status = rec ? (rec.status === 'planned' ? `Naplánováno ${fmtShort(rec.date)}` : `Hotovo ${fmtShort(rec.date)}`) : '';
  return html`<article class="cal ${c.state} ${rec?.status === 'done' ? 'isdone' : ''}">
    <span class="e" aria-hidden="true">${kindOf(c.kind).emoji}</span>
    <div class="cal-body"><b>${c.title}</b>
      <small>${c.ageText} · ${range}</small>
      ${c.note ? html`<small class="note">${c.note}</small>` : ''}</div>
    ${rec ? html`<span class="added">${icon('check', 16)} ${status}</span>`
          : html`<button class="btn small ${c.state === 'now' ? '' : 'ghost'}" data-cal="${c.key}">${icon('plus', 16)} Naplánovat</button>`}
  </article>`;
}

// ---------- události ----------
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-tab]'))) { tab = el.dataset.tab; draw(); return; }
  if (t.closest('[data-vetcard]')) return openVetCard();
  if (t.closest('[data-add]')) return entrySheet(null, { status: 'planned' });
  if ((el = t.closest('[data-done]'))) {
    const v = store.get('vet', el.dataset.done);
    return v && entrySheet(v, { status: 'done', date: todayISO() });
  }
  if ((el = t.closest('[data-edit]'))) {
    const v = store.get('vet', el.dataset.edit);
    return v && entrySheet(v);
  }
  if ((el = t.closest('[data-ics]'))) return downloadIcs(store.get('vet', el.dataset.ics));
  if ((el = t.closest('[data-cal]'))) {
    const c = vetCalendar(store.getMeta().birthDate).find((x) => x.key === el.dataset.cal);
    if (!c) return;
    const date = c.state === 'next' ? c.from : todayISO();
    entrySheet(null, { status: 'planned', calKey: c.key, kind: c.kind, title: c.title, date, note: c.note });
  }
}

// ---------- přidat / upravit ----------
function entrySheet(existing = null, preset = {}) {
  const base = { kind: 'vaccine', title: '', status: 'planned', date: todayISO(), weightKg: '', note: '', calKey: '', ...existing, ...preset };
  const kinds = Object.entries(KIND).map(([k, v]) => [k, `${v.emoji} ${v.label}`]);
  const s = openSheet({
    title: existing && !preset.status ? 'Upravit záznam' : existing ? 'Dokončit záznam' : 'Nový záznam',
    body: html`<form class="form" id="vf">
      ${select({ label: 'Druh', name: 'kind', value: base.kind, options: kinds })}
      ${field({ label: 'Název', name: 'title', value: base.title, attrs: 'required maxlength="80" placeholder="např. Očkování – psinka, parvoviróza"' })}
      <div class="field"><span>Stav</span>
        <div class="seg two" role="radiogroup" aria-label="Stav">
          <label class="segopt"><input type="radio" name="status" value="done" ${base.status === 'done' ? raw('checked') : ''}><span>Proběhlo</span></label>
          <label class="segopt"><input type="radio" name="status" value="planned" ${base.status !== 'done' ? raw('checked') : ''}><span>Naplánováno</span></label>
        </div></div>
      <div class="row2">
        ${field({ label: 'Datum', name: 'date', type: 'date', value: base.date, attrs: 'required' })}
        ${field({ label: 'Váha (kg)', name: 'weight', value: base.weightKg ? String(base.weightKg).replace('.', ',') : '', attrs: 'inputmode="decimal" placeholder="volitelně"' })}
      </div>
      <div id="nextBox">${field({ label: 'Další termín (volitelně)', name: 'nextDate', type: 'date', value: '', hint: 'Po uložení se automaticky naplánuje.' })}</div>
      ${textarea({ label: 'Poznámka', name: 'note', value: base.note || '', attrs: 'maxlength="500" placeholder="Vakcína, léky, co řekl veterinář…"' })}
      <div class="btn-row">${existing ? html`<button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button>` : ''}<button class="btn primary" type="submit">Uložit</button></div>
    </form>`,
  });

  const form = s.$('#vf');
  const syncNext = () => { s.$('#nextBox').hidden = form.status.value !== 'done'; };
  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'status') syncNext();
    if (ev.target.name === 'kind' && !form.title.value.trim()) form.title.value = KIND[form.kind.value].label;
  });
  syncNext();

  form.onsubmit = (ev) => {
    ev.preventDefault();
    const f = readForm(form);
    const wRaw = f.weight.trim();
    const w = wRaw ? parseNum(wRaw) : null;
    if (wRaw && !(w > 0.1 && w < 120)) { toast('Váha musí být číslo v kg, např. 12,4.'); return; }
    if (f.status === 'done' && f.date > todayISO()) { toast('Proběhlý záznam nemůže být v budoucnosti. Zvol „Naplánováno“.'); return; }
    store.put('vet', {
      id: existing?.id, kind: f.kind, title: f.title.trim(), status: f.status, date: f.date,
      weightKg: w, note: f.note.trim(), calKey: base.calKey || '',
    });
    if (f.status === 'done' && f.nextDate && f.nextDate > f.date) {
      store.put('vet', { kind: f.kind, title: f.title.trim(), status: 'planned', date: f.nextDate, weightKg: null, note: '' });
    }
    s.close();
    toast(f.status === 'done' ? 'Zapsáno.' : 'Termín uložen.');
    draw();
  };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Smazat záznam?', ok: 'Smazat', danger: true })) { store.del('vet', existing.id); s.close(); draw(); }
  };
}

// ---------- export do kalendáře (.ics) ----------
function downloadIcs(v) {
  if (!v) return;
  const esc = (x) => String(x).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ymd = (iso) => iso.replaceAll('-', '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const name = store.getMeta().name;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cipisek//CS', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${v.id}@cipisek`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(v.date)}`, `DTEND;VALUE=DATE:${ymd(addDaysISO(v.date, 1))}`,
    `SUMMARY:${esc(`${name}: ${v.title}`)}`,
    ...(v.note ? [`DESCRIPTION:${esc(v.note)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Zítra: ${v.title}`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${v.date}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Soubor kalendáře je stažený. Otevři ho a přidej do kalendáře.');
}
