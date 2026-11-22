/* views/today.js – úvodní obrazovka: věk, aktuální fáze, rychlé zápisy (čistota, jídlo, spánek) a přehled dne. */
import * as store from '../store.js';
import {
  html, $, toISO, todayISO, addDaysISO, parseISO, ageParts, ageDisplay, fmtDate, fmtTime, timeInput,
  fmtKg, relDay, nDays, nWeeks, fmtKm,
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm, miniBars } from '../ui.js';
import { QUICK, QUICK_BY, KIND, phaseFor, TIPS } from '../data.js';
import { weightSeries, nextVet } from '../domain.js';
import { photoUrl } from '../photodb.js';
import * as cards from '../cards.js';
import * as days from './days.js';

let root = null;

export function render(r) {
  root = r;
  root.onclick = onClick;
  draw();
  runShortcut();
}

/** Zkratka z ikony na ploše: #/dnes?q=pee zapíše událost a odkaz uklidí. */
function runShortcut() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q');
  if (!q) return;
  history.replaceState(null, '', location.pathname + location.search + '#/dnes');
  if (QUICK_BY[q] && q !== 'note') quickLog(q);
}
export const refresh = () => root && draw();
export function destroy() { if (root) root.onclick = null; root = null; }

function tipOfDay(months) {
  const ok = TIPS.filter((t) => (t.min ?? 0) <= months && months < (t.max ?? 999));
  const d = parseISO(todayISO());
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  return ok[dayOfYear % ok.length];
}

function draw() {
  const meta = store.getMeta();
  const age = ageParts(meta.birthDate);
  const { big, small } = ageDisplay(meta.birthDate);
  const phase = phaseFor(age.months);
  const t = todayISO();

  const events = store.list('diary').filter((e) => e.date === t).sort((a, b) => b.ts - a.ts);
  const count = (type) => events.filter((e) => e.type === type).length;
  const good = count('pee') + count('poop'), bad = count('accident');

  const weekRows = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDaysISO(t, -i);
    const ev = store.list('diary').filter((e) => e.date === d);
    weekRows.push({
      label: parseISO(d).toLocaleDateString('cs-CZ', { weekday: 'narrow' }),
      good: ev.filter((e) => e.type === 'pee' || e.type === 'poop').length,
      bad: ev.filter((e) => e.type === 'accident').length,
    });
  }
  const weekHasData = weekRows.some((r) => r.good + r.bad > 0);
  const weekKm = store.list('walks').filter((w) => w.date >= addDaysISO(t, -6)).reduce((a, w) => a + (w.meters || 0), 0);

  const socialLeft = age.totalDays >= 0 && age.totalDays < 112 ? Math.max(1, Math.round((112 - age.totalDays) / 7)) : null;
  const nv = nextVet();
  const ws = weightSeries();
  const lastW = ws[ws.length - 1], prevW = ws[ws.length - 2];
  const tip = tipOfDay(age.months);

  root.innerHTML = String(html`
    <section class="hero" aria-label="Věk">
      <div class="hero-main">
        <p class="hero-name">${meta.name}</p>
        <h1 class="hero-age"><span class="big">${big}</span>${small ? html` <span class="small">${small}</span>` : ''}</h1>
        <p class="hero-sub">${age.totalDays} dní života · narozen ${fmtDate(meta.birthDate)}</p>
      </div>
      <div class="hero-avatar" id="avatar" aria-hidden="true">${icon('paw', 34)}</div>
    </section>

    ${socialLeft ? html`<a class="notice" href="#/vychova?t=social">
        <strong>Okno socializace se zavírá</strong>
        <span>Zhruba ${nWeeks(socialLeft)} do 16. týdne věku. Odškrtávej, co už Cipísek zažil.</span>${icon('chev', 18)}</a>` : ''}

    ${cards.backupNotice()}

    <section class="card" aria-labelledby="h-quick">
      <h2 id="h-quick">Rychlý zápis</h2>
      <div class="quick">
        ${QUICK.map((q) => html`<button class="q ${q.good ? 'good' : q.bad ? 'bad' : ''}" data-q="${q.type}"><span class="e" aria-hidden="true">${q.emoji}</span><span>${q.label}</span></button>`)}
      </div>
    </section>

    ${cards.tasksCard()}
    ${days.todayCard()}

    <section class="card" aria-labelledby="h-today">
      <h2 id="h-today">Dnes</h2>
      <div class="chips">
        <span class="chip good">Venku ${good}×</span>
        <span class="chip ${bad ? 'bad' : ''}">Nehody ${bad}×</span>
        <span class="chip">Jídlo ${count('meal')}×</span>
        ${good + bad > 0 ? html`<span class="chip strong">Čistota ${Math.round((good / (good + bad)) * 100)} %</span>` : ''}
        ${weekKm > 0 ? html`<span class="chip">Týden venku ${fmtKm(weekKm)}</span>` : ''}
      </div>
      ${events.length ? html`<ul class="timeline">${events.map((e) => {
        const q = QUICK_BY[e.type] || QUICK_BY.note;
        return html`<li><button class="tl" data-ev="${e.id}"><span class="tl-time">${fmtTime(e.ts)}</span><span class="e" aria-hidden="true">${q.emoji}</span><span class="tl-text"><b>${q.label}</b>${e.note ? html`<small>${e.note}</small>` : ''}</span>${e.by ? html`<span class="tl-by">${e.by}</span>` : ''}</button></li>`;
      })}</ul>` : html`<p class="empty">Zatím nic. Klepni nahoře na to, co se právě stalo.</p>`}
    </section>

    ${cards.pottyCard()}
    ${cards.whereCard()}

    ${weekHasData ? html`<section class="card"><h2>Čistota za týden</h2>${miniBars(weekRows)}
      <p class="legend"><i class="dot good"></i>venku <i class="dot bad"></i>nehoda doma</p></section>` : ''}

    <section class="card phase">
      <div class="phase-head"><span class="phase-e" aria-hidden="true">${phase.emoji}</span><div><h2>${phase.title}</h2><p class="muted">${phase.lead}</p></div></div>
      <ul class="points">${phase.points.slice(0, 3).map((p) => html`<li>${p}</li>`)}</ul>
      <a class="link" href="#/vychova?t=guide">Celý průvodce ${icon('chev', 16)}</a>
    </section>

    <div class="grid2">
      <a class="card mini" href="#/zdravi">
        <span class="mini-ic">${icon('heart', 20)}</span>
        ${nv ? html`<b class="${nv.date < t ? 'late' : ''}">${nv.date < t ? 'Po termínu' : relDay(nv.date)}</b><span>${KIND[nv.kind]?.emoji} ${nv.title}</span><small>${fmtDate(nv.date)}</small>`
             : html`<b>Veterina</b><span>Žádný termín</span><small>Naplánuj další</small>`}
      </a>
      <a class="card mini" href="#/rust">
        <span class="mini-ic">${icon('scale', 20)}</span>
        ${lastW ? html`<b>${fmtKg(lastW.kg)}</b><span>${prevW ? `${lastW.kg - prevW.kg >= 0 ? '+' : '−'}${fmtKg(Math.abs(lastW.kg - prevW.kg))} od minule` : 'První záznam'}</span><small>${relDay(lastW.date)}</small>`
                : html`<b>Váha</b><span>Zatím nezapsáno</span><small>Zapiš první</small>`}
      </a>
    </div>

    ${tip ? html`<aside class="tip"><span aria-hidden="true">💡</span><p>${tip.text}</p></aside>` : ''}
  `);

  setAvatar();
}

async function setAvatar() {
  const g = store.list('growth').filter((x) => x.hasPhoto).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!g) return;
  const url = await photoUrl(g.id, 'thumb');
  const el = $('#avatar');
  if (url && el) el.innerHTML = `<img src="${url}" alt="">`;
}

// ---------- události ----------
function onClick(e) {
  if (cards.handleClick(e, draw)) return;
  if (days.handleClick(e, draw)) return;
  const q = e.target.closest('[data-q]');
  if (q) return quickLog(q.dataset.q);
  const ev = e.target.closest('[data-ev]');
  if (ev) return editEvent(ev.dataset.ev);
}

function addEvent(type, note = '') {
  return store.put('diary', { type, ts: Date.now(), date: todayISO(), note });
}

function quickLog(type) {
  if (type === 'note') return noteSheet();
  const rec = addEvent(type);
  draw();
  toast(`Zapsáno: ${QUICK_BY[type].label}`, { label: 'Zpět', onClick: () => { store.del('diary', rec.id); draw(); } });
}

function noteSheet() {
  const s = openSheet({
    title: 'Poznámka',
    body: html`<form class="form" id="nf">${textarea({ label: 'Co se stalo?', name: 'note', attrs: 'required maxlength="500" autofocus' })}
      <button class="btn primary block" type="submit">Zapsat</button></form>`,
  });
  s.$('#nf').onsubmit = (e) => {
    e.preventDefault();
    addEvent('note', readForm(e.target).note.trim());
    s.close();
    draw();
  };
}

function editEvent(id) {
  const ev = store.get('diary', id);
  if (!ev) return;
  const q = QUICK_BY[ev.type] || QUICK_BY.note;
  const s = openSheet({
    title: `${q.emoji} ${q.label}`,
    body: html`<form class="form" id="ef">
      ${field({ label: 'Čas', name: 'time', type: 'time', value: timeInput(ev.ts), attrs: 'required' })}
      ${textarea({ label: 'Poznámka', name: 'note', value: ev.note || '', attrs: 'maxlength="500"' })}
      ${ev.by ? html`<p class="muted small">Zapsal(a): ${ev.by}</p>` : ''}
      <div class="btn-row"><button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button><button class="btn primary" type="submit">Uložit</button></div></form>`,
  });
  s.$('#ef').onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    const d = new Date(ev.ts);
    const [h, m] = f.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    store.put('diary', { id, ts: d.getTime(), date: toISO(d), note: f.note.trim() });
    s.close();
    draw();
  };
  s.$('[data-del]').onclick = async () => {
    if (await confirmDialog({ title: 'Smazat zápis?', ok: 'Smazat', danger: true })) { store.del('diary', id); s.close(); draw(); }
  };
}
