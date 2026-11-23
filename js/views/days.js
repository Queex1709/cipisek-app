/* views/days.js – denní deník: co se naučil (a s čím jsme začali), co se povedlo, co se pokazilo,
   co jedl, poznámky a fotky ke dni. Záložka „Deník“ v sekci Růst + karta na Dnes.
   Záznam má pevné id  day_RRRR-MM-DD  – každý den je jeden, takže se v rodině slučují. */
import * as store from '../store.js';
import * as sync from '../sync.js';
import * as photodb from '../photodb.js';
import { logsOf } from '../domain.js';
import { html, uid, todayISO, fmtDate, ageText } from '../util.js';
import { openLightbox } from '../lightbox.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm } from '../ui.js';

const MAX_PHOTOS = 6;
const FOOD_IDEAS = ['Granule', 'Namočené granule', 'Pamlsky', 'Kuřecí', 'Rýže', 'Mrkev', 'Jogurt'];
export const dayId = (date) => `day_${date}`;
const photosOf = (d) => (d?.photos?.length ? d.photos : d?.hasPhoto ? [d.id] : []);
export const hasContent = (d) => !!(d && (d.learned || d.started || d.good || d.bad || d.food || d.note || photosOf(d).length));

/** Co aplikace o daném dni už ví (události, tréninky, procházky, váha). */
function autoSummary(date) {
  const ev = store.list('diary').filter((e) => e.date === date);
  const n = (t) => ev.filter((e) => e.type === t).length;
  const trainings = store.list('logs').filter((l) => l.date === date);
  const skillName = (id) => store.get('skills', id)?.name || 'trénink';
  const walks = store.list('walks').filter((w) => w.date === date);
  const km = walks.reduce((a, w) => a + (w.meters || 0), 0) / 1000;
  const w = store.list('growth').find((g) => g.date === date && g.weightKg > 0);
  const out = [];
  if (n('pee') + n('poop')) out.push(`🌳 venku ${n('pee') + n('poop')}×`);
  if (n('accident')) out.push(`💧 nehody ${n('accident')}×`);
  if (trainings.length) out.push(`🎓 ${[...new Set(trainings.map((l) => skillName(l.skillId)))].join(', ')}`);
  if (walks.length) out.push(`🥾 procházka ${km.toFixed(1).replace('.', ',')} km`);
  if (w) out.push(`⚖️ ${String(w.weightKg).replace('.', ',')} kg`);
  return out;
}

/** Přehled „s čím jsme začali a kdy“ – odvozeno z výchovy (první trénink). */
function learningOverview() {
  return store.list('skills').map((s) => {
    const logs = logsOf(s.id);
    const from = logs[0]?.date || null;
    return { s, from, last: logs[logs.length - 1]?.date || null, n: logs.length };
  }).filter((x) => x.from).sort((a, b) => a.from.localeCompare(b.from));
}

export function renderHtml() {
  const meta = store.getMeta();
  const t = todayISO();
  const days = store.list('days').filter(hasContent).sort((a, b) => b.date.localeCompare(a.date));
  const todayRec = store.get('days', dayId(t));
  const learn = learningOverview();
  return html`
    <div class="btn-row">
      <button class="btn primary" data-day-open="${t}">${icon('plus', 20)} ${hasContent(todayRec) ? 'Dnešní zápis' : 'Zapsat dnešek'}</button>
      <button class="btn ghost" data-day-other>${icon('cal', 18)} Jiný den</button>
    </div>
    ${learn.length ? html`<section class="card"><h2>Co se učí a od kdy</h2>
      <ul class="learned">${learn.map((x) => html`<li><span class="e" aria-hidden="true">${x.s.emoji || '🐾'}</span>
        <span><b>${x.s.name}</b><small>začali ${fmtDate(x.from)} (${ageText(meta.birthDate, x.from)}) · ${x.n}× trénink · ${x.s.progress || 0} %</small></span></li>`)}</ul></section>` : ''}
    ${days.length ? html`<ol class="dlist">${days.map((d) => dayCard(d, meta))}</ol>`
      : html`<p class="empty">Tady vznikne deník ${meta.name}. Zapiš, co se dnes naučil, co se povedlo, co pokazil a co snědl.</p>`}`;
}

function dayCard(d, meta) {
  const ph = photosOf(d);
  const row = (emoji, label, text) => (text ? html`<p class="drow"><span class="e" aria-hidden="true">${emoji}</span><span><b>${label}</b> ${text}</span></p>` : '');
  return html`<li><button class="day" data-day-open="${d.date}">
    <span class="day-h"><b>${fmtDate(d.date)}</b><small>${ageText(meta.birthDate, d.date)}</small></span>
    ${ph.length ? html`<span class="day-ph">${ph.slice(0, 3).map((id) => html`<img class="zoomable" data-ph="${id}" data-day="${d.date}" alt="Fotka ze dne ${fmtDate(d.date)}">`)}${ph.length > 3 ? html`<i>+${ph.length - 3}</i>` : ''}</span>` : ''}
    ${row('🆕', 'Začali jsme', d.started)}
    ${row('🎓', 'Naučil se', d.learned)}
    ${row('👍', 'Povedlo se', d.good)}
    ${row('🙈', 'Pokazil', d.bad)}
    ${row('🍖', 'Jedl', d.food)}
    ${row('📝', '', d.note)}
  </button></li>`;
}

export function handleClick(e, redraw) {
  const t = e.target;
  let el;
  if ((el = t.closest('img[data-day]'))) {
    const d = store.get('days', dayId(el.dataset.day));
    const meta = store.getMeta();
    const ids = photosOf(d);
    openLightbox(ids.map((id) => ({ id, title: fmtDate(d.date), sub: ageText(meta.birthDate, d.date), note: d.note })), Math.max(0, ids.indexOf(el.dataset.ph)));
    return true;
  }
  if ((el = t.closest('[data-day-open]'))) { openDay(el.dataset.dayOpen, redraw); return true; }
  if (t.closest('[data-day-other]')) { pickDay(redraw); return true; }
  return false;
}

function pickDay(redraw) {
  const meta = store.getMeta();
  const s = openSheet({
    title: 'Který den?',
    body: html`<form class="form" id="pdf">${field({ label: 'Datum', name: 'date', type: 'date', value: todayISO(), attrs: `required min="${meta.birthDate}" max="${todayISO()}"` })}
      <button class="btn primary block" type="submit">Pokračovat</button></form>`,
  });
  s.$('#pdf').onsubmit = (e) => { e.preventDefault(); const d = readForm(e.target).date; s.close(); setTimeout(() => openDay(d, redraw), 50); };
}

/** Karta na Dnes: rychlý vstup do dnešního zápisu. */
export function todayCard() {
  const t = todayISO();
  const d = store.get('days', dayId(t));
  const filled = hasContent(d);
  const bits = filled ? [d.learned && '🎓', d.good && '👍', d.bad && '🙈', d.food && '🍖', photosOf(d).length && '📷'].filter(Boolean).join(' ') : '';
  return html`<section class="card daycard"><div><h2>Deník dne</h2>
    <p class="muted">${filled ? `Dnes zapsáno ${bits}` : 'Co se dnes naučil, povedlo, pokazil a co jedl?'}</p></div>
    <button class="btn ${filled ? 'ghost' : 'primary'}" data-day-open="${t}">${filled ? 'Upravit' : 'Zapsat'}</button></section>`;
}

export function openDay(date, redraw) {
  const meta = store.getMeta();
  const id = dayId(date);
  const ex = store.get('days', id);
  const b = { learned: '', started: '', good: '', bad: '', food: '', note: '', ...ex };
  const kept = [...photosOf(ex)];              // už uložené fotky (lze odebrat)
  const added = new Map();                      // nové: id -> {img, thumb}
  const urls = [];
  const auto = autoSummary(date);

  const s = openSheet({
    title: `Deník – ${fmtDate(date)}`,
    onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
    body: html`<form class="form" id="df">
      <p class="muted small">Věk: ${ageText(meta.birthDate, date)}</p>
      ${auto.length ? html`<div class="chips wrap">${auto.map((a) => html`<span class="chip">${a}</span>`)}</div>` : ''}
      ${textarea({ label: '🆕 S čím jsme dnes začali', name: 'started', value: b.started, attrs: 'maxlength="300" rows="2" placeholder="např. učíme se „sedni“"' })}
      ${textarea({ label: '🎓 Co se naučil', name: 'learned', value: b.learned, attrs: 'maxlength="500" rows="2"' })}
      ${textarea({ label: '👍 Co se povedlo', name: 'good', value: b.good, attrs: 'maxlength="500" rows="2"' })}
      ${textarea({ label: '🙈 Co pokazil', name: 'bad', value: b.bad, attrs: 'maxlength="500" rows="2"' })}
      ${textarea({ label: '🍖 Co jedl', name: 'food', value: b.food, attrs: 'maxlength="500" rows="2" placeholder="např. 4× granule, mrkev, pár pamlsků"' })}
      <div class="chips wrap">${FOOD_IDEAS.map((f) => html`<button type="button" class="chip btn-chip" data-food="${f}">+ ${f}</button>`)}</div>
      ${textarea({ label: '📝 Poznámky', name: 'note', value: b.note, attrs: 'maxlength="800" rows="3"' })}
      <div><span class="lbl">Fotky ke dni</span>
        <div class="dphotos" id="dPh"></div>
        <div class="pp-btns">
          <button type="button" class="btn ghost" data-cam>${icon('camera', 18)} Vyfotit</button>
          <button type="button" class="btn ghost" data-gal>${icon('image', 18)} Z galerie</button>
        </div>
        <input type="file" accept="image/*" capture="environment" id="fCam" hidden>
        <input type="file" accept="image/*" id="fGal" multiple hidden>
        <p class="muted small" id="ppStat">Až ${MAX_PHOTOS} fotek, zmenší se samy.</p></div>
      <button class="btn primary block" type="submit">Uložit</button>
      ${ex ? html`<button class="btn danger-ghost block" type="button" data-del>${icon('trash', 18)} Smazat zápis dne</button>` : ''}
    </form>`,
  });
  const form = s.$('#df');
  const stat = s.$('#ppStat');

  const paintPhotos = async () => {
    const box = s.$('#dPh');
    box.innerHTML = '';
    for (const pid of [...kept, ...added.keys()]) {
      const wrap = document.createElement('div');
      wrap.className = 'dph';
      const img = document.createElement('img');
      img.alt = '';
      if (added.has(pid)) { const u = URL.createObjectURL(added.get(pid).img); urls.push(u); img.src = u; img.onclick = () => openLightbox([{ url: u, title: fmtDate(date), sub: 'Nová fotka' }]); }
      else { const u = await photodb.photoUrl(pid, 'thumb'); if (u) { img.src = u; img.onclick = () => openLightbox(kept.map((id) => ({ id, title: fmtDate(date), sub: ageText(meta.birthDate, date) })), kept.indexOf(pid)); } else sync.ensurePhoto(pid); }
      img.classList.add('zoomable');
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'dph-x'; x.setAttribute('aria-label', 'Odebrat fotku'); x.textContent = '×';
      x.onclick = () => {
        if (added.has(pid)) added.delete(pid);
        else kept.splice(kept.indexOf(pid), 1);
        paintPhotos();
      };
      wrap.append(img, x);
      box.append(wrap);
    }
  };
  paintPhotos();

  const addFiles = async (files) => {
    const room = MAX_PHOTOS - kept.length - added.size;
    const list = [...files].slice(0, Math.max(0, room));
    if (!list.length) { stat.textContent = `Maximum je ${MAX_PHOTOS} fotek.`; return; }
    stat.textContent = 'Zmenšuji fotky…';
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    for (const f of list) {
      try { added.set(`${id}_${uid()}`, await photodb.compress(f)); }
      catch (err) { console.error(err); stat.textContent = 'Některou fotku se nepodařilo zpracovat.'; }
    }
    btn.disabled = false;
    if (stat.textContent === 'Zmenšuji fotky…') stat.textContent = 'Hotovo.';
    paintPhotos();
  };
  s.$('[data-cam]').onclick = () => s.$('#fCam').click();
  s.$('[data-gal]').onclick = () => s.$('#fGal').click();
  s.$('#fCam').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  s.$('#fGal').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };

  form.addEventListener('click', (e) => {
    const f = e.target.closest('[data-food]');
    if (!f) return;
    const ta = form.food;
    ta.value = ta.value.trim() ? `${ta.value.trim().replace(/[,.]$/, '')}, ${f.dataset.food.toLowerCase()}` : f.dataset.food;
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = readForm(form);
    try { for (const [pid, p] of added) await photodb.savePhoto(pid, p.img, p.thumb); }
    catch (err) { console.error(err); toast('Fotky se nepodařilo uložit (málo místa?).'); return; }
    const removed = photosOf(ex).filter((p) => !kept.includes(p));
    removed.forEach((p) => photodb.removePhoto(p).catch(() => {}));
    const photos = [...kept, ...added.keys()];
    store.put('days', {
      id, date,
      started: f.started.trim(), learned: f.learned.trim(), good: f.good.trim(), bad: f.bad.trim(),
      food: f.food.trim(), note: f.note.trim(), photos, hasPhoto: photos.length > 0,
    });
    for (const pid of added.keys()) sync.pushPhoto(pid).catch(() => {});
    s.close();
    toast('Zápis uložen.');
    redraw?.();
  };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (!(await confirmDialog({ title: 'Smazat zápis dne?', text: 'Smažou se i fotky tohoto dne.', ok: 'Smazat', danger: true }))) return;
    photosOf(ex).forEach((p) => photodb.removePhoto(p).catch(() => {}));
    store.del('days', id);
    s.close();
    redraw?.();
  };
}
