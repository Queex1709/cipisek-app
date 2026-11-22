/* deals.js – akce na maso a jídlo pro psa (záložka Jídlo → Slevy).
   Data jsou v souboru data/deals.json (ceny z letáků Kupi.cz) a tlačítko Aktualizovat si stáhne nejnovější verzi.
   Každá kategorie má i odkaz na živé hledání na Kupi.cz. */
import { html, todayISO, fmtDate, fmtShort, diffDays } from './util.js';
import { icon, toast } from './ui.js';

let data = null, state = 'idle';   // idle | loading | error

export async function load(force = false) {
  state = 'loading';
  try {
    const r = await fetch(`data/deals.json${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
    if (!r.ok) throw new Error(String(r.status));
    data = await r.json();
    state = 'idle';
  } catch (e) {
    state = data ? 'idle' : 'error';
    throw e;
  }
}

const money = (n) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',').replace(',00', '')} Kč`;
const validText = (it) => {
  const t = todayISO();
  if (it.from && it.from > t) return `od ${fmtShort(it.from)}${it.to ? ` do ${fmtShort(it.to)}` : ''}`;
  if (it.to === t) return 'dnes končí';
  return it.to ? `do ${fmtShort(it.to)}` : 'aktuální';
};

function itemHtml(it) {
  const off = it.was ? Math.round((1 - it.price / it.was) * 100) : 0;
  return html`<li class="deal">
    <div class="deal-t"><b>${it.name}</b><small>${it.store} · ${it.pack}${it.unit ? ` · ${it.unit}` : ''}</small>
      <small class="deal-v">${validText(it)}${it.club ? ' · s kartou obchodu' : ''}</small></div>
    <div class="deal-p"><b>${money(it.price)}</b>${it.was ? html`<s>${money(it.was)}</s><span class="chip good">−${off} %</span>` : ''}</div></li>`;
}

export function renderHtml() {
  const t = todayISO();
  const head = html`<div class="card-head"><h2>Akce na jídlo pro Cipíska</h2>
    <button class="btn ghost small" data-deals-refresh ${state === 'loading' ? 'disabled' : ''}>${icon('undo', 16)} ${state === 'loading' ? 'Načítám…' : 'Aktualizovat'}</button></div>`;
  if (!data) {
    return html`<section class="card">${head}${state === 'error'
      ? html`<p class="muted small">Akce se nepodařilo načíst. Zkontroluj internet a klepni na Aktualizovat.</p>` : html`<p class="muted small">Načítám…</p>`}</section>`;
  }
  const upd = data.updated.slice(0, 10);
  const age = diffDays(upd, t);
  const cats = data.cats.map((c) => ({ ...c, items: c.items.filter((i) => !i.to || i.to >= t) }));
  return html`
    <section class="card">${head}
      <p class="muted small">Stav k ${fmtDate(upd)}${age > 2 ? html` <b class="late">(${age} dní stará data)</b>` : ''}. ${data.note || ''}</p>
      ${age > 2 ? html`<p class="warn">Data už jsou starší. Napiš mi v chatu „aktualizuj slevy“, nebo otevři živé hledání u kategorie.</p>` : ''}
    </section>
    ${cats.map((c) => html`<section class="card" aria-label="${c.label}">
      <div class="card-head"><h2>${c.emoji} ${c.label}</h2>
        <a class="chip btn-chip" target="_blank" rel="noopener" href="https://www.kupi.cz/hledej?f=${encodeURIComponent(c.q)}">Živě na Kupi.cz</a></div>
      ${c.items.length ? html`<ul class="deals">${c.items.map(itemHtml)}</ul>`
        : html`<p class="muted small">Teď tu není žádná akce. Zkus živé hledání.</p>`}</section>`)}
    <p class="muted small">Maso jen jako doplněk ke granulím, vařené bez soli a koření, žádné uzeniny. Syrové krmení nejdřív proberte s veterinářem.</p>`;
}

export function handleClick(e, redraw) {
  if (!e.target.closest('[data-deals-refresh]')) return false;
  const before = data?.updated;
  state = 'loading';
  redraw();
  load(true).then(() => {
    toast(data.updated === before ? 'Máš nejnovější data.' : 'Akce jsou aktualizované.');
  }).catch(() => toast('Aktualizace se nepovedla. Jsi online?')).finally(redraw);
  return true;
}
