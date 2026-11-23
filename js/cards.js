/* cards.js – karty na úvodní obrazovce Dnes: úkoly (prášky, krmení), kde je pes + trackery, kdy ven, záloha.
   Každá karta vrací HTML, společné klepání obsluhuje handleClick(e, redraw). */
import * as store from './store.js';
import {
  html, raw, $, $$, todayISO, fmtTime, fmtDate, agoText, DOW, ageParts, fmtShort,
} from './util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, select, readForm, miniBars } from './ui.js';
import {
  TASK_PRESETS, TASK_KIND_LABEL, DEVICE_TYPES, DEVICE_BY, WHERE_OPTIONS,
} from './data.js';
import {
  slotsFor, slotState, toggleSlot, doseText, downloadTaskIcs, downloadAllIcs, gcalLinks, enableNotifications, notificationsSupported,
} from './tasks.js';
import { pottyStats, nextOutside } from './insights.js';
import * as weather from './weather.js';

// =====================================================================
// Budíky do kalendáře telefonu (zazvoní i při zavřené aplikaci)
// =====================================================================
function calendarSheet(only = null) {
  const tasks = (only ? [only] : store.list('tasks').filter((t) => t.active !== false && t.times?.length));
  if (!tasks.length) { toast('Nejdřív přidej nějaký úkol.'); return; }
  const s = openSheet({
    title: 'Budíky do kalendáře',
    body: html`<div class="form">
      <p class="muted">Aplikace na pozadí zvonit nemůže, kalendář v telefonu ano. Přidej si úkoly do něj a zazvoní i při zavřené aplikaci.</p>
      <h3 class="sec">Google Kalendář (doporučeno)</h3>
      <p class="muted small">Klepni na čas, otevře se Kalendář s hotovou opakovanou událostí a stačí dát „Uložit“.</p>
      <ul class="calist">${tasks.map((t) => html`<li><b>${t.emoji || '🔔'} ${t.title}</b>
        <span class="chips">${gcalLinks(t).map((l) => html`<a class="chip btn-chip" target="_blank" rel="noopener" href="${l.url}">${icon('cal', 14)} ${l.time}</a>`)}</span></li>`)}</ul>
      <h3 class="sec">Všechno najednou</h3>
      <button class="btn ghost block" data-ics-all>${icon('download', 18)} Stáhnout soubor (.ics)</button>
      <p class="muted small">Po stažení ho otevři (v oznámení o stažení nebo ve složce Stažené) a zvol kalendář. Přidají se všechny úkoly najednou.</p>
      <p class="muted small">Tip: v Kalendáři u události nastav upozornění „v čase události“, ať zazvoní přesně.</p>
    </div>`,
  });
  s.$('[data-ics-all]').onclick = () => { downloadAllIcs(tasks); toast('Soubor je stažený. Otevři ho a přidej do kalendáře.'); };
}

// =====================================================================
// Úkoly
// =====================================================================
export function tasksCard() {
  const slots = slotsFor(todayISO());
  const done = slots.filter((s) => s.log).length;
  const askNotif = slots.length > 0 && notificationsSupported() && Notification.permission === 'default';
  return html`<section class="card" aria-labelledby="h-tasks">
    <div class="card-head"><h2 id="h-tasks">Na řadě dnes</h2>
      ${slots.length ? html`<span class="chip ${done === slots.length ? 'good' : ''}">${done} z ${slots.length}</span>` : ''}
      <button class="icon-btn" data-task-manage aria-label="Spravovat úkoly">${icon('edit', 20)}</button></div>
    ${slots.length ? html`<ul class="slots">${slots.map((s) => {
      const st = slotState(s);
      const dose = doseText(s.task);
      return html`<li><button class="slot s-${st}" data-slot="${s.id}" aria-pressed="${st === 'done'}">
        <span class="chk-box" aria-hidden="true">${st === 'done' ? icon('check', 18) : ''}</span>
        <span class="slot-time">${s.time}</span>
        <span class="slot-text"><b>${s.task.emoji || '🔔'} ${s.task.title}</b>
          <small>${st === 'done' ? `${dose ? dose + ' · ' : ''}${s.log.by ? s.log.by + ' ' : ''}v ${fmtTime(s.log.ts)}` : st === 'late' ? `Zpoždění${dose ? ' · ' + dose : ''}` : dose}</small></span>
      </button></li>`;
    })}</ul>` : html`<p class="empty">Žádné úkoly. Přidej třeba prášky na klouby nebo krmení.</p>`}
    ${askNotif ? html`<button class="btn ghost small" data-notif>${icon('cal', 16)} Zapnout upozornění</button>` : ''}
    <button class="btn ghost small" data-cal-all>${icon('cal', 16)} Budíky do kalendáře</button>
    <button class="btn ghost small" data-task-add>${icon('plus', 16)} Přidat úkol</button>
  </section>`;
}

function addTaskSheet(redraw) {
  const used = new Set(store.list('tasks').map((t) => t.id));
  const presets = TASK_PRESETS.filter((p) => !p.id || !used.has(p.id));
  const s = openSheet({
    title: 'Přidat úkol',
    body: html`<ul class="recs">${presets.map((p) => html`<li><span class="e" aria-hidden="true">${p.emoji}</span>
      <div><b>${p.title}</b><small>${p.times.join(', ')}${p.dose && p.dose !== 'auto' ? ` · ${p.dose}` : ''}${p.days ? ' · jen některé dny' : ''}</small></div>
      <button class="btn small" data-preset="${p.key}">${icon('plus', 16)}</button></li>`)}</ul>
      <button class="btn ghost block" data-custom>Vlastní úkol</button>`,
  });
  s.body.onclick = (e) => {
    const b = e.target.closest('[data-preset]');
    if (b) { const p = TASK_PRESETS.find((x) => x.key === b.dataset.preset); s.close(); setTimeout(() => taskSheet(null, p, redraw), 260); return; }
    if (e.target.closest('[data-custom]')) { s.close(); setTimeout(() => taskSheet(null, { emoji: '🔔', title: '', kind: 'other', times: ['08:00'], dose: '', note: '' }, redraw), 260); }
  };
}

function manageSheet(redraw) {
  const tasks = store.list('tasks').sort((a, b) => (a.times?.[0] || '').localeCompare(b.times?.[0] || ''));
  const s = openSheet({
    title: 'Úkoly a upozornění',
    body: html`${tasks.length ? html`<ul class="recs">${tasks.map((t) => html`<li><span class="e" aria-hidden="true">${t.emoji || '🔔'}</span>
      <div><b>${t.title}${t.active === false ? ' (vypnuto)' : ''}</b><small>${(t.times || []).join(', ')}${doseText(t) ? ' · ' + doseText(t) : ''}${t.days?.length && t.days.length < 7 ? ' · ' + t.days.map((d) => DOW[d]).join(' ') : ' · každý den'}</small></div>
      <button class="icon-btn" data-edit="${t.id}" aria-label="Upravit">${icon('edit', 18)}</button></li>`)}</ul>` : html`<p class="empty">Zatím žádný úkol.</p>`}
      <button class="btn primary block" data-add>${icon('plus', 18)} Přidat úkol</button>
      <p class="muted small">Když je aplikace otevřená, ozve se hláška v čase úkolu. Pokud zavřená, spolehlivě to hlídá budík z kalendáře: otevři úkol a klepni na „Budík do kalendáře“.</p>`,
  });
  s.body.onclick = (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { const t = store.get('tasks', ed.dataset.edit); s.close(); setTimeout(() => taskSheet(t, null, redraw), 260); return; }
    if (e.target.closest('[data-add]')) { s.close(); setTimeout(() => addTaskSheet(redraw), 260); }
  };
}

/** Formulář úkolu. Exportováno kvůli záložce Krmení (úprava časů). */
export function taskSheet(existing, preset, redraw) {
  const b = { emoji: '🔔', title: '', kind: 'other', times: ['08:00'], days: [], dose: '', note: '', startDate: todayISO(), endDate: '', active: true, ...preset, ...existing };
  const days = b.days?.length ? b.days : [0, 1, 2, 3, 4, 5, 6];
  const timeRow = (v = '') => html`<div class="trow"><input type="time" name="time" value="${v}"><button type="button" class="icon-btn" data-rm-time aria-label="Odebrat čas">${icon('x', 18)}</button></div>`;
  const auto = b.dose === 'auto';
  const s = openSheet({
    title: existing ? 'Upravit úkol' : 'Nový úkol',
    body: html`<form class="form" id="tf">
      <div class="row-emoji">${field({ label: 'Název', name: 'title', value: b.title, attrs: 'required maxlength="60" placeholder="např. Výživa kloubů"' })}
        ${field({ label: 'Ikona', name: 'emoji', value: b.emoji, attrs: 'maxlength="4"' })}</div>
      ${auto ? html`<input type="hidden" name="dose" value="auto"><p class="muted small">Porci na jedno krmení počítá kalkulačka v záložce Jídlo → Porce.</p>`
             : field({ label: 'Dávka', name: 'dose', value: b.dose, attrs: 'maxlength="60" placeholder="např. 2 tablety"', hint: 'Řiď se obalem přípravku nebo radou veterináře.' })}
      <div class="field"><span>Časy</span><div id="times">${(b.times?.length ? b.times : ['08:00']).map((t) => timeRow(t))}</div>
        <button type="button" class="btn small ghost" data-add-time>${icon('plus', 16)} Přidat čas</button></div>
      <div class="field"><span>Dny</span><div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<label class="dchip"><input type="checkbox" name="day" value="${d}" ${days.includes(d) ? raw('checked') : ''}><span>${DOW[d]}</span></label>`)}</div></div>
      <div class="row2">${field({ label: 'Od', name: 'startDate', type: 'date', value: b.startDate || todayISO() })}
        ${field({ label: 'Do (volitelně)', name: 'endDate', type: 'date', value: b.endDate || '' })}</div>
      ${textarea({ label: 'Poznámka', name: 'note', value: b.note || '', attrs: 'maxlength="300"' })}
      ${existing ? html`<label class="switch"><input type="checkbox" name="active" ${b.active !== false ? raw('checked') : ''}><span>Úkol je zapnutý</span></label>` : ''}
      <button class="btn primary block" type="submit">Uložit</button>
      ${existing ? html`<div class="btn-row"><button class="btn ghost" type="button" data-ics>${icon('cal', 18)} Budík do kalendáře</button>
        <button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button></div>` : ''}
    </form>`,
  });
  const form = s.$('#tf');
  s.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-time]')) {
      s.$('#times').insertAdjacentHTML('beforeend', String(timeRow('12:00')));
    }
    const rm = e.target.closest('[data-rm-time]');
    if (rm) rm.closest('.trow').remove();
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(form);
    const times = [...new Set($$('input[name=time]', form).map((i) => i.value).filter(Boolean))].sort();
    if (!times.length) { toast('Přidej aspoň jeden čas.'); return; }
    const sel = $$('input[name=day]:checked', form).map((i) => Number(i.value));
    if (!sel.length) { toast('Vyber aspoň jeden den.'); return; }
    if (f.endDate && f.endDate < f.startDate) { toast('Konec nemůže být před začátkem.'); return; }
    store.put('tasks', {
      id: existing?.id || preset?.id, title: f.title.trim(), emoji: f.emoji.trim() || '🔔', kind: b.kind,
      times, days: sel.length === 7 ? [] : sel, dose: f.dose?.trim?.() ?? f.dose ?? '', note: f.note.trim(),
      startDate: f.startDate, endDate: f.endDate || null, active: existing ? 'active' in f : true,
    });
    s.close();
    toast('Úkol uložen.');
    redraw?.();
  };
  const ics = s.$('[data-ics]');
  if (ics) ics.onclick = () => { s.close(); setTimeout(() => calendarSheet(existing), 50); };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Smazat úkol?', text: 'Zmizí všem v rodině. Odškrtnutá historie zůstane.', ok: 'Smazat', danger: true })) { store.del('tasks', existing.id); s.close(); redraw?.(); }
  };
}

// =====================================================================
// Kde je pes + trackery
// =====================================================================
export function whereCard() {
  const meta = store.getMeta();
  const where = store.get('plan', 'where');
  const devs = store.list('devices').sort((a, b) => a.createdAt - b.createdAt);
  return html`<section class="card" aria-labelledby="h-where">
    <div class="card-head"><h2 id="h-where">Kde je ${meta.name}</h2>
      <button class="icon-btn" data-dev-add aria-label="Přidat tracker">${icon('plus', 20)}</button></div>
    <button class="where-now" data-where-edit>
      <span class="where-pin" aria-hidden="true">${icon('map', 20)}</span>
      <span><b>${where?.value || 'Nezadáno'}</b><small>${where ? `${where.by ? where.by + ' · ' : ''}${agoText(where.ts)}` : 'Klepni a nastav, ať to vidí celá rodina'}</small></span>
      ${icon('chev', 16)}</button>
    ${devs.length ? html`<ul class="devs">${devs.map((d) => {
      const t = DEVICE_BY[d.type] || DEVICE_BY.other;
      return html`<li class="dev"><span class="e" aria-hidden="true">${t.emoji}</span>
        <div><b>${d.name || t.label}</b><small>${d.url ? 'Vlastní odkaz' : t.label}${d.note ? ' · ' + d.note : ''}</small></div>
        <button class="btn primary small" data-dev-open="${d.id}">${icon('external', 16)} Poloha</button>
        <button class="icon-btn" data-dev-edit="${d.id}" aria-label="Upravit tracker">${icon('edit', 18)}</button></li>`;
    })}</ul>`
      : html`<p class="muted small">Máš GPS obojek nebo AirTag? Přidej ho a jeho polohu otevřeš jedním klepnutím, i mámě na jejím telefonu.</p>`}
  </section>`;
}

function whereSheet(redraw) {
  const cur = store.get('plan', 'where');
  const s = openSheet({
    title: 'Kde je pes teď?',
    body: html`<div class="chips wrap">${WHERE_OPTIONS.map((o) => html`<button class="chip btn-chip ${cur?.value === o ? 'on' : ''}" data-set="${o}">${o}</button>`)}</div>
      <form class="form" id="wf2">${field({ label: 'Nebo napiš vlastní', name: 'v', attrs: 'maxlength="60" placeholder="např. U babičky"' })}
        <button class="btn primary block" type="submit">Uložit</button></form>`,
  });
  const save = (v) => { if (!v) return; store.put('plan', { id: 'where', value: v, ts: Date.now() }); s.close(); redraw?.(); };
  s.body.onclick = (e) => { const b = e.target.closest('[data-set]'); if (b) save(b.dataset.set); };
  s.$('#wf2').onsubmit = (e) => { e.preventDefault(); save(readForm(e.target).v.trim()); };
}

function deviceSheet(existing, redraw) {
  const b = { type: 'tractive', name: '', url: '', note: '', ...existing };
  const s = openSheet({
    title: existing ? 'Upravit tracker' : 'Přidat tracker',
    body: html`<form class="form" id="df">
      ${select({ label: 'Druh', name: 'type', value: b.type, options: DEVICE_TYPES.map((d) => [d.key, d.label]) })}
      ${field({ label: 'Název', name: 'name', value: b.name, attrs: 'maxlength="40" placeholder="např. Obojek"' })}
      ${field({ label: 'Odkaz na polohu (volitelně)', name: 'url', type: 'url', value: b.url, attrs: 'placeholder="https://…" inputmode="url"', hint: 'Pokud umí tvoje aplikace sdílet polohu odkazem, vlož ho sem. Bez odkazu se otevře web výrobce.' })}
      ${field({ label: 'Poznámka', name: 'note', value: b.note, attrs: 'maxlength="80"' })}
      <p class="muted small">Živou mapu tracker do aplikace vložit nejde, výrobci to neumožňují. Tlačítko „Poloha“ otevře jeho vlastní stránku nebo aplikaci.</p>
      <div class="btn-row">${existing ? html`<button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button>` : ''}<button class="btn primary" type="submit">Uložit</button></div>
    </form>`,
  });
  s.$('#df').onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    const url = f.url.trim();
    if (url && !/^https:\/\//i.test(url)) { toast('Odkaz musí začínat https://'); return; }
    store.put('devices', { id: existing?.id, type: f.type, name: f.name.trim(), url, note: f.note.trim() });
    s.close(); redraw?.();
  };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Smazat tracker?', ok: 'Smazat', danger: true })) { store.del('devices', existing.id); s.close(); redraw?.(); }
  };
}

function openDevice(id, redraw) {
  const d = store.get('devices', id);
  if (!d) return;
  const url = d.url || DEVICE_BY[d.type]?.url;
  if (!url) { toast('U tohoto trackeru chybí odkaz.'); deviceSheet(d, redraw); return; }
  window.open(url, '_blank', 'noopener');
}

// =====================================================================
// Kdy ven
// =====================================================================
const hm = (ts) => new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const ivText = (m) => (m >= 60 ? `${(m / 60).toFixed(1).replace('.0', '').replace('.', ',')} h` : `${m} min`);

export const weatherCard = () => weather.card();
export const weatherHydrate = () => weather.hydrate();

export function pottyCard() {
  const meta = store.getMeta();
  const months = ageParts(meta.birthDate).months;
  const st = pottyStats();
  if (months >= 9 && st.bad === 0) return html``;
  const n = nextOutside();
  let main, sub;
  if (n.night) { main = 'Noc: ven podle potřeby'; sub = 'Hned po probuzení a po pití.'; }
  else if (!n.last) { main = `Zkus ven asi každých ${ivText(n.interval)}`; sub = 'Zapiš první „Venku čůral“ a začnu hlídat odstupy.'; }
  else if (n.overdue) { main = 'Už je čas jít ven'; sub = `Poslední venku v ${hm(n.last.ts)}, odstup bývá ${ivText(n.interval)}.`; }
  else { main = `Zkus ven kolem ${hm(n.nextTs)}`; sub = `Poslední venku v ${hm(n.last.ts)}, odstup ${ivText(n.interval)} ${n.fromData ? 'podle deníku' : 'podle věku'}.`; }
  const w = st.worst;
  return html`<section class="card" aria-labelledby="h-pot">
    <h2 id="h-pot">Kdy ven</h2>
    <div class="outside ${n.overdue ? 'late' : ''}"><b>${main}</b><span>${sub}</span></div>
    ${st.total >= 6 ? html`${miniBars(st.buckets.map((b) => ({ label: b.label, good: b.good, bad: b.bad })))}
      <p class="legend"><i class="dot good"></i>venku <i class="dot bad"></i>nehoda doma · hodiny dne</p>
      ${w ? html`<p class="muted small">Nehody se za poslední dva týdny nejčastěji stávaly mezi ${w.from} a ${w.from + 2} h. V tu dobu ho vyveď radši dřív.</p>` : ''}`
      : html`<p class="muted small">Až bude v deníku víc zápisů, ukážu, kdy se nejčastěji stávají nehody.</p>`}
    <p class="muted small">Ven vždy po spaní, jídle, pití a hře.</p>
  </section>`;
}

// =====================================================================
// Záloha
// =====================================================================
export function backupNotice() {
  const set = store.getSettings();
  if (set.syncOn) return html``;
  const n = store.COLS.reduce((a, c) => a + store.list(c).length, 0);
  if (n < 15) return html``;
  const age = set.lastBackup ? (Date.now() - set.lastBackup) / 864e5 : Infinity;
  if (age < 14) return html``;
  return html`<a class="notice" href="#/nastaveni"><span><strong>Stáhni zálohu</strong>
    <span>${set.lastBackup ? `Naposledy ${fmtShort(new Date(set.lastBackup).toISOString().slice(0, 10))}.` : 'Zatím žádná.'} Kdyby se telefon zasekl, o data nepřijdeš.</span></span>${icon('chev', 18)}</a>`;
}

// =====================================================================
// Společné klepání
// =====================================================================
export function handleClick(e, redraw) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-slot]'))) {
    const s = slotsFor(todayISO()).find((x) => x.id === el.dataset.slot);
    if (s) { toggleSlot(s); redraw(); document.querySelector(`[data-slot="${s.id}"] .chk-box`)?.classList.add('pop'); }
    return true;
  }
  if (t.closest('[data-wx]')) { weather.refreshNow(); return true; }
  if (t.closest('[data-cal-all]')) { calendarSheet(); return true; }
  if (t.closest('[data-task-add]')) { addTaskSheet(redraw); return true; }
  if (t.closest('[data-task-manage]')) { manageSheet(redraw); return true; }
  if (t.closest('[data-notif]')) {
    enableNotifications().then((p) => {
      toast(p === 'granted' ? 'Upozornění jsou zapnutá. Funguje, když je aplikace otevřená nebo na pozadí.' : p === 'unsupported' ? 'Tohle zařízení oznámení nepodporuje.' : 'Oznámení nejsou povolená. Povol je v nastavení prohlížeče.');
      redraw();
    });
    return true;
  }
  if (t.closest('[data-where-edit]')) { whereSheet(redraw); return true; }
  if (t.closest('[data-dev-add]')) { deviceSheet(null, redraw); return true; }
  if ((el = t.closest('[data-dev-edit]'))) { deviceSheet(store.get('devices', el.dataset.devEdit), redraw); return true; }
  if ((el = t.closest('[data-dev-open]'))) { openDevice(el.dataset.devOpen, redraw); return true; }
  return false;
}
