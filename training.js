/* views/training.js – výchova: moje tréninky (úroveň, log, vývoj v čase) a průvodce pro pyrenejce. */
import * as store from '../store.js';
import { html, raw, $, $$, todayISO, fmtDate, relDay, nDays, ageParts, parseNum } from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm, ring, sparkline } from '../ui.js';
import { PHASES, phaseFor, CATALOG, CATALOG_BY, catalogForPhase, GUIDE, SOCIAL, SOCIAL_COUNT } from '../data.js';
import { STAGES, stageOf, logsOf, lastTrained, trainingStreak, trainingsThisWeek, overallProgress, daysSince } from '../domain.js';

let root = null;
let tab = 'mine';
let phaseSel = null;
let focusId = null;

export function render(r) {
  root = r;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const t = q.get('t');
  if (t === 'guide') tab = 'guide';
  else if (t === 'social') { tab = 'guide'; focusId = 'socializace'; }
  else if (t === 'mine') tab = 'mine';
  root.onclick = onClick;
  root.onchange = onChange;
  draw();
}
export const refresh = () => root && draw();
export function destroy() { if (root) { root.onclick = null; root.onchange = null; } root = null; }

const skillByKey = (key) => store.list('skills').find((s) => s.key === key);
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

function draw() {
  const open = new Set($$('details[open]', root).map((d) => d.dataset.id));
  if (focusId) open.add(focusId);
  root.innerHTML = String(html`
    <header class="page-head"><h1>Výchova</h1></header>
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="${tab === 'mine'}" class="${tab === 'mine' ? 'on' : ''}" data-tab="mine">Moje tréninky</button>
      <button role="tab" aria-selected="${tab === 'guide'}" class="${tab === 'guide' ? 'on' : ''}" data-tab="guide">Průvodce</button>
    </div>
    ${tab === 'mine' ? mine() : guide(open)}`);
  if (focusId) {
    const el = $(`details[data-id="${focusId}"]`, root);
    el?.scrollIntoView({ block: 'start' });
    focusId = null;
  }
}

// ---------- Moje tréninky ----------
function mine() {
  const skills = store.list('skills');
  const ov = overallProgress();
  const streak = trainingStreak();
  const week = trainingsThisWeek();
  const sorted = [...skills].sort((a, b) => {
    const am = (a.progress || 0) >= 100, bm = (b.progress || 0) >= 100;
    if (am !== bm) return am ? 1 : -1;
    return (lastTrained(a.id) || '').localeCompare(lastTrained(b.id) || '');
  });
  const age = ageParts(store.getMeta().birthDate);
  const suggest = catalogForPhase(phaseFor(age.months)).filter((c) => !skillByKey(c.key)).slice(0, 4);

  return html`
    <section class="card progress-card">
      ${ring(ov.pct, { size: 92, stroke: 10 })}
      <div>
        <h2>Celkový pokrok</h2>
        <p class="muted">${ov.count ? `${ov.count} ${ov.count === 1 ? 'dovednost' : ov.count < 5 ? 'dovednosti' : 'dovedností'} · ${ov.mastered} zvládnuto` : 'Zatím žádné dovednosti'}</p>
        <div class="chips"><span class="chip ${streak ? 'strong' : ''}">Série ${nDays(streak)}</span><span class="chip">Za týden ${week}×</span></div>
      </div>
    </section>

    ${skills.length ? html`${sorted.map(skillCard)}` : html`
      <section class="card"><h2>Začni první dovedností</h2>
        <p class="muted">V tomhle věku se hodí hlavně tyto. Klepnutím je přidáš do aktivního tréninku.</p>
        <div class="chips wrap">${suggest.map((c) => html`<button class="chip btn-chip" data-add-cat="${c.key}">${c.emoji} ${c.name} ${icon('plus', 14)}</button>`)}</div>
      </section>`}

    <button class="btn primary block" data-add-skill>${icon('plus', 20)} Přidat dovednost</button>`;
}

function skillCard(s) {
  const p = s.progress || 0;
  const st = stageOf(p);
  const last = lastTrained(s.id);
  const n = logsOf(s.id).length;
  return html`<article class="card skill" data-skill="${s.id}">
    <div class="skill-top">
      <span class="skill-emoji" aria-hidden="true">${s.emoji || '🐾'}</span>
      <div class="skill-title"><h3>${s.name}</h3><span class="stage tone-${st.tone}">${st.label}</span></div>
      <span class="pct">${p} %</span>
    </div>
    <div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i class="tone-${st.tone}" style="width:${p}%"></i></div>
    <p class="muted small">${last ? `Naposledy ${relDay(last)} · ${n}× trénováno` : 'Ještě netrénováno'}</p>
    <div class="btn-row"><button class="btn primary" data-log="${s.id}">Zalogovat trénink</button><button class="btn ghost" data-detail="${s.id}">Detail</button></div>
  </article>`;
}

// ---------- Průvodce ----------
function guide(open) {
  const age = ageParts(store.getMeta().birthDate);
  const cur = phaseFor(age.months);
  const sel = PHASES.find((p) => p.id === (phaseSel || cur.id)) || cur;
  const recs = catalogForPhase(sel);
  const done = store.list('social').length;

  return html`
    <div class="phase-chips" role="tablist" aria-label="Věkové fáze">
      ${PHASES.slice(0, 5).map((p) => html`<button role="tab" class="pchip ${p.id === sel.id ? 'on' : ''}" data-phase="${p.id}" aria-selected="${p.id === sel.id}">
        <span aria-hidden="true">${p.emoji}</span>${p.range}${p.id === cur.id ? html`<i class="now">teď</i>` : ''}</button>`)}
    </div>

    <section class="card phase">
      <div class="phase-head"><span class="phase-e" aria-hidden="true">${sel.emoji}</span><div><h2>${sel.title}</h2><p class="muted">${sel.lead}</p></div></div>
      <ul class="points">${sel.points.map((p) => html`<li>${p}</li>`)}</ul>
      <h3 class="sub">Doporučené dovednosti</h3>
      <ul class="recs">${recs.map((c) => {
        const have = skillByKey(c.key);
        return html`<li><span class="e" aria-hidden="true">${c.emoji}</span>
          <div><b>${c.name}</b><small>${c.tip}</small></div>
          ${have ? html`<span class="added">${icon('check', 16)} V tréninku</span>` : html`<button class="btn small" data-add-cat="${c.key}">${icon('plus', 16)} Přidat</button>`}</li>`;
      })}</ul>
    </section>

    ${GUIDE.map((g) => html`<details class="acc card" data-id="${g.id}" ${open.has(g.id) ? raw('open') : ''}>
      <summary><span class="e" aria-hidden="true">${g.emoji}</span><span>${g.title}</span>${icon('chev', 18)}</summary>
      <div class="acc-body">
        ${g.body.map((p) => html`<p>${p}</p>`)}
        ${g.social ? html`<div class="social">
          <p class="social-count"><b id="soc-count">${done}</b> z ${SOCIAL_COUNT} zkušeností</p>
          ${SOCIAL.map((grp) => html`<fieldset><legend>${grp.group}</legend>
            ${grp.items.map(([key, label]) => html`<label class="chk"><input type="checkbox" data-social="${key}" ${store.get('social', 'soc_' + key) ? raw('checked') : ''}><span>${label}</span></label>`)}
          </fieldset>`)}</div>` : ''}
      </div>
    </details>`)}
    <p class="disclaimer">Obecné rady k plemeni. Nenahrazují veterináře ani cvičitele.</p>`;
}

// ---------- události ----------
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-tab]'))) { tab = el.dataset.tab; draw(); return; }
  if ((el = t.closest('[data-phase]'))) { phaseSel = el.dataset.phase; draw(); return; }
  if ((el = t.closest('[data-add-cat]'))) { addFromCatalog(el.dataset.addCat); return; }
  if (t.closest('[data-add-skill]')) { addSkillSheet(); return; }
  if ((el = t.closest('[data-log]'))) { logSheet(el.dataset.log); return; }
  if ((el = t.closest('[data-detail]'))) { detailSheet(el.dataset.detail); return; }
}
function onChange(e) {
  const c = e.target.closest('[data-social]');
  if (!c) return;
  const id = 'soc_' + c.dataset.social;
  if (c.checked) store.put('social', { id, key: c.dataset.social, done: true, date: todayISO() });
  else store.del('social', id);
  const n = $('#soc-count', root);
  if (n) n.textContent = store.list('social').length;
}

function addFromCatalog(key) {
  const c = CATALOG_BY[key];
  if (!c || skillByKey(key)) return;
  store.put('skills', { key, name: c.name, emoji: c.emoji, tip: c.tip, progress: 0 });
  toast(`Přidáno do tréninku: ${c.name}`);
  draw();
}

function addSkillSheet() {
  const age = ageParts(store.getMeta().birthDate);
  const ph = phaseFor(age.months);
  const avail = CATALOG.filter((c) => !skillByKey(c.key));
  const rec = new Set(catalogForPhase(ph).map((c) => c.key));
  avail.sort((a, b) => (rec.has(b.key) ? 1 : 0) - (rec.has(a.key) ? 1 : 0));
  const s = openSheet({
    title: 'Přidat dovednost',
    body: html`
      ${avail.length ? html`<ul class="recs">${avail.map((c) => html`<li><span class="e" aria-hidden="true">${c.emoji}</span>
        <div><b>${c.name}</b><small>${rec.has(c.key) ? 'Hodí se v tomhle věku' : c.tip}</small></div>
        <button class="btn small" data-cat="${c.key}">${icon('plus', 16)}</button></li>`)}</ul>` : html`<p class="muted">Všechno z průvodce už v tréninku máš.</p>`}
      <form class="form" id="cf"><h3 class="sub">Vlastní dovednost</h3>
        <div class="row2">${field({ label: 'Název', name: 'name', attrs: 'required maxlength="50" placeholder="např. Podej tlapku"' })}
        ${field({ label: 'Ikona', name: 'emoji', attrs: 'maxlength="4" placeholder="🐾"' })}</div>
        <button class="btn primary block" type="submit">Přidat vlastní</button></form>`,
  });
  s.body.onclick = (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    addFromCatalog(b.dataset.cat);
    b.closest('li').remove();
  };
  s.$('#cf').onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    store.put('skills', { key: 'custom', name: f.name.trim(), emoji: f.emoji.trim() || '🐾', progress: 0 });
    s.close();
    draw();
  };
}

function logSheet(skillId) {
  const sk = store.get('skills', skillId);
  if (!sk) return;
  let rating = 4;
  const s = openSheet({
    title: `Trénink: ${sk.name}`,
    body: html`<form class="form" id="lf">
      <div class="row2">${field({ label: 'Datum', name: 'date', type: 'date', value: todayISO(), attrs: `required max="${todayISO()}"` })}
      ${field({ label: 'Délka (min)', name: 'minutes', type: 'number', attrs: 'min="0" max="120" inputmode="numeric" placeholder="5"' })}</div>
      <div class="field"><span>Jak to šlo?</span>
        <div class="stars" role="radiogroup" aria-label="Hodnocení">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" role="radio" aria-checked="${n === rating}" class="${n <= rating ? 'on' : ''}" data-star="${n}" aria-label="${n} z 5">${icon('star', 28)}</button>`)}</div></div>
      <label class="field"><span>Pokrok: <b id="pv">${sk.progress || 0} %</b> <em id="pstage" class="stage tone-${stageOf(sk.progress || 0).tone}">${stageOf(sk.progress || 0).label}</em></span>
        <input type="range" name="progress" min="0" max="100" step="5" value="${sk.progress || 0}"></label>
      ${textarea({ label: 'Poznámka', name: 'note', attrs: 'maxlength="500" placeholder="Co fungovalo, co ne…"' })}
      <button class="btn primary block" type="submit">Uložit trénink</button></form>`,
  });
  const form = s.$('#lf');
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    rating = Number(b.dataset.star);
    $$('[data-star]', s.el).forEach((x) => {
      const n = Number(x.dataset.star);
      x.classList.toggle('on', n <= rating);
      x.setAttribute('aria-checked', String(n === rating));
    });
  });
  form.progress.oninput = () => {
    const v = Number(form.progress.value), st = stageOf(v);
    $('#pv', s.el).textContent = v + ' %';
    const sg = $('#pstage', s.el);
    sg.textContent = st.label;
    sg.className = 'stage tone-' + st.tone;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(form);
    const progress = Number(f.progress);
    store.put('logs', { skillId, date: f.date, minutes: parseNum(f.minutes) || null, rating, progress, note: f.note.trim() });
    store.put('skills', { id: skillId, progress });
    s.close();
    toast(progress >= 100 ? 'Zvládnuto! 🎉' : 'Trénink zapsán');
    draw();
  };
}

function detailSheet(skillId) {
  const sk = store.get('skills', skillId);
  if (!sk) return;
  const logs = logsOf(skillId);
  const p = sk.progress || 0, st = stageOf(p);
  const s = openSheet({
    title: `${sk.emoji || '🐾'} ${sk.name}`,
    body: html`
      <div class="detail-top"><span class="stage tone-${st.tone}">${st.label}</span><b class="pct">${p} %</b></div>
      <p class="muted small">${st.hint}</p>
      ${sk.tip ? html`<p class="tip-inline">${sk.tip}</p>` : ''}
      <h3 class="sub">Pokrok v čase</h3>
      ${logs.length ? sparkline(logs.map((l) => l.progress ?? p)) : html`<p class="muted small">Graf se objeví po prvním zalogovaném tréninku.</p>`}
      <h3 class="sub">Historie (${logs.length})</h3>
      ${logs.length ? html`<ul class="loglist">${[...logs].reverse().map((l) => html`<li>
        <div><b>${fmtDate(l.date)}</b> <span class="stars-inline" aria-label="${l.rating} z 5">${stars(l.rating || 0)}</span>${l.minutes ? html` <small>${l.minutes} min</small>` : ''}
        ${l.note ? html`<small class="note">${l.note}</small>` : ''}</div>
        <span class="pct-s">${l.progress ?? ''}${l.progress != null ? ' %' : ''}</span>
        <button class="icon-btn" data-dellog="${l.id}" aria-label="Smazat záznam">${icon('trash', 18)}</button></li>`)}</ul>` : html`<p class="empty">Zatím žádný trénink.</p>`}
      <div class="btn-row"><button class="btn primary" data-do-log>Zalogovat trénink</button><button class="btn ghost" data-edit>Upravit</button></div>
      <button class="btn danger-ghost block" data-remove>${icon('trash', 18)} Odebrat dovednost</button>`,
  });
  s.body.onclick = async (e) => {
    const t = e.target;
    const dl = t.closest('[data-dellog]');
    if (dl) {
      store.del('logs', dl.dataset.dellog);
      const rest = logsOf(skillId);
      store.put('skills', { id: skillId, progress: rest.length ? rest[rest.length - 1].progress ?? p : 0 });
      s.close(); draw(); detailSheet(skillId);
    } else if (t.closest('[data-do-log]')) { s.close(); setTimeout(() => logSheet(skillId), 260); }
    else if (t.closest('[data-edit]')) { s.close(); setTimeout(() => editSheet(skillId), 260); }
    else if (t.closest('[data-remove]')) {
      if (await confirmDialog({ title: 'Odebrat dovednost?', text: 'Smaže se i celá historie tréninků.', ok: 'Odebrat', danger: true })) {
        logsOf(skillId).forEach((l) => store.del('logs', l.id));
        store.del('skills', skillId);
        s.close(); draw();
      }
    }
  };
}

function editSheet(skillId) {
  const sk = store.get('skills', skillId);
  if (!sk) return;
  const s = openSheet({
    title: 'Upravit dovednost',
    body: html`<form class="form" id="ef"><div class="row2">${field({ label: 'Název', name: 'name', value: sk.name, attrs: 'required maxlength="50"' })}
      ${field({ label: 'Ikona', name: 'emoji', value: sk.emoji || '', attrs: 'maxlength="4"' })}</div>
      <label class="field"><span>Pokrok: <b id="pv">${sk.progress || 0} %</b></span><input type="range" name="progress" min="0" max="100" step="5" value="${sk.progress || 0}"></label>
      <button class="btn primary block" type="submit">Uložit</button></form>`,
  });
  const form = s.$('#ef');
  form.progress.oninput = () => { $('#pv', s.el).textContent = form.progress.value + ' %'; };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(form);
    store.put('skills', { id: skillId, name: f.name.trim(), emoji: f.emoji.trim() || '🐾', progress: Number(f.progress) });
    s.close(); draw();
  };
}
