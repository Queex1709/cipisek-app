/* views/growth.js – galerie růstu: fotky s váhou, graf váhy a porovnání „Předtím vs. Teď“. */
import * as store from '../store.js';
import * as sync from '../sync.js';
import * as photodb from '../photodb.js';
import {
  html, raw, $, $$, uid, todayISO, parseISO, fmtDate, fmtShort, fmtKg, relDay, ageText, parseNum, diffDays,
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm, weightChart } from '../ui.js';
import { weightSeries } from '../domain.js';
import { REF_WEIGHT } from '../data.js';
import { addMonthsISO } from '../util.js';

let root = null;
let chartPts = [];

export function render(r) {
  root = r;
  root.onclick = onClick;
  root.onchange = onChange;
  draw();
}
export const refresh = () => root && draw();
export function destroy() { if (root) { root.onclick = null; root.onchange = null; } root = null; }

const photosOf = () => store.list('growth').filter((g) => g.hasPhoto).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

function refCurve() {
  const meta = store.getMeta();
  const anchors = REF_WEIGHT[meta.sex === 'f' ? 'f' : 'm'];
  return anchors.map(([mo, kg]) => ({ t: parseISO(addMonthsISO(meta.birthDate, mo)).getTime(), y: kg }));
}

function draw() {
  const meta = store.getMeta();
  const ws = weightSeries();
  const entries = store.list('growth').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const photos = photosOf();
  const last = ws[ws.length - 1], prev = ws[ws.length - 2];
  const showRef = store.getSettings().showRef;
  chartPts = ws.map((w) => ({ t: parseISO(w.date).getTime(), y: w.kg, date: w.date, kg: w.kg }));
  const refInRange = chartPts.length > 0 && refCurve()[0].t <= chartPts[chartPts.length - 1].t;

  let delta = '';
  if (last && prev) {
    const d = last.kg - prev.kg, days = Math.max(1, diffDays(prev.date, last.date));
    delta = `${d >= 0 ? '+' : '−'}${fmtKg(Math.abs(d))} za ${days} ${days === 1 ? 'den' : days < 5 ? 'dny' : 'dní'}`;
  }

  root.innerHTML = String(html`
    <header class="page-head"><h1>Růst</h1></header>
    <button class="btn primary block" data-add>${icon('camera', 20)} Přidat fotku nebo váhu</button>

    <section class="card" aria-labelledby="h-w">
      <h2 id="h-w">Váha</h2>
      ${last ? html`<div class="weight-now"><b>${fmtKg(last.kg)}</b><span>${relDay(last.date)}${delta ? ` · ${delta}` : ''}</span></div>` : ''}
      ${ws.length ? html`${weightChart({ pts: chartPts, ref: showRef ? refCurve() : [] })}
        <p class="chart-tip" id="ctip" aria-live="polite">Klepni na bod v grafu.</p>
        <label class="switch"><input type="checkbox" id="showRef" ${showRef ? raw('checked') : ''}><span>Orientační křivka plemene</span></label>
        ${showRef ? (refInRange
          ? html`<p class="muted small">Křivka je jen střed z cizích tabulek (3, 6 a 12 měsíců). Každý pes roste jinak, hlídej hlavně plynulý růst a žebra, která jsou pod rukou hmatná.</p>`
          : html`<p class="muted small">Křivka plemene se v grafu objeví, až bude ${meta.name} mít 3 měsíce.</p>`) : ''}`
        : html`<p class="empty">Zatím žádná váha. Přidej první záznam a objeví se graf.</p>`}
    </section>

    ${photos.length >= 2 ? html`<button class="btn ghost block" data-compare>${icon('image', 20)} Porovnat: předtím vs. teď</button>` : ''}

    <h2 class="sec">Galerie ${photos.length ? html`<small>${photos.length}</small>` : ''}</h2>
    ${entries.length ? html`<div class="gallery">${entries.map((g) => html`<button class="gitem ${g.hasPhoto ? '' : 'nophoto'}" data-open="${g.id}">
        ${g.hasPhoto ? html`<img data-ph="${g.id}" alt="Fotka ${fmtDate(g.date)}">` : html`<span class="gph">${icon('scale', 26)}</span>`}
        <span class="gcap"><b>${g.weightKg ? fmtKg(g.weightKg) : ''}</b><small>${ageText(meta.birthDate, g.date)}</small></span>
      </button>`)}</div>`
      : html`<p class="empty">Fotky se zobrazí tady. Přidej první a sleduj, jak ${meta.name} roste.</p>`}`);

  loadThumbs();
}

async function loadThumbs() {
  for (const img of $$('img[data-ph]', root)) {
    const id = img.dataset.ph;
    const u = await photodb.photoUrl(id, 'thumb');
    if (!root) return;
    if (u) img.src = u;
    else { img.closest('.gitem')?.classList.add('missing'); sync.ensurePhoto(id); }
  }
}

// ---------- události ----------
function onClick(e) {
  const t = e.target;
  let el;
  if (t.closest('[data-add]')) return entrySheet();
  if (t.closest('[data-compare]')) return compareSheet();
  if ((el = t.closest('[data-open]'))) return detailSheet(el.dataset.open);
  if ((el = t.closest('.hit'))) {
    const p = chartPts[Number(el.dataset.i)];
    const tip = $('#ctip', root);
    if (p && tip) tip.textContent = `${fmtDate(p.date)} · ${fmtKg(p.kg)} · ${ageText(store.getMeta().birthDate, p.date)}`;
  }
}
function onChange(e) {
  if (e.target.id === 'showRef') { store.setSettings({ showRef: e.target.checked }); draw(); }
}

// ---------- přidat / upravit záznam ----------
function entrySheet(existing = null) {
  const meta = store.getMeta();
  let pending = null;       // {img, thumb} nově vybraná fotka
  let previewUrl = null;
  const date0 = existing?.date || todayISO();

  const s = openSheet({
    title: existing ? 'Upravit záznam' : 'Nový záznam',
    onClose: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); },
    body: html`<form class="form" id="gf">
      <div class="photo-pick" id="pp">
        <div class="pp-prev" id="ppPrev">${existing?.hasPhoto ? html`<img id="ppImg" alt="">` : html`<span class="muted">Bez fotky</span>`}</div>
        <div class="pp-btns">
          <button type="button" class="btn ghost" data-cam>${icon('camera', 18)} Vyfotit</button>
          <button type="button" class="btn ghost" data-gal>${icon('image', 18)} Z galerie</button>
        </div>
        <input type="file" accept="image/*" capture="environment" id="fCam" hidden>
        <input type="file" accept="image/*" id="fGal" hidden>
        <p class="muted small" id="ppStat">Fotka se zmenší, aby nezabírala místo.</p>
      </div>
      <div class="row2">
        ${field({ label: 'Datum', name: 'date', type: 'date', value: date0, attrs: `required min="${meta.birthDate}" max="${todayISO()}"` })}
        ${field({ label: 'Váha (kg)', name: 'weight', type: 'text', value: existing?.weightKg ? String(existing.weightKg).replace('.', ',') : '', attrs: 'inputmode="decimal" placeholder="např. 12,4"' })}
      </div>
      <p class="muted small" id="ageNow">Věk: ${ageText(meta.birthDate, date0)}</p>
      ${textarea({ label: 'Poznámka', name: 'note', value: existing?.note || '', attrs: 'maxlength="500" placeholder="Co je nového, jak se mu daří…"' })}
      <div class="btn-row">${existing ? html`<button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button>` : ''}<button class="btn primary" type="submit" id="gSave">Uložit</button></div>
    </form>`,
  });

  const form = s.$('#gf');
  if (existing?.hasPhoto) photodb.photoUrl(existing.id, 'img').then((u) => { const i = s.$('#ppImg'); if (u && i) i.src = u; });

  const pick = async (file) => {
    if (!file) return;
    const stat = s.$('#ppStat'), save = s.$('#gSave');
    stat.textContent = 'Zmenšuji fotku…';
    save.disabled = true;
    try {
      pending = await photodb.compress(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(pending.img);
      s.$('#ppPrev').innerHTML = `<img src="${previewUrl}" alt="">`;
      stat.textContent = `Hotovo: ${Math.round(pending.img.size / 1024)} kB`;
    } catch (err) {
      console.error(err);
      pending = null;
      stat.textContent = 'Fotku se nepodařilo zpracovat. Zkus jinou.';
    }
    save.disabled = false;
  };
  s.$('[data-cam]').onclick = () => s.$('#fCam').click();
  s.$('[data-gal]').onclick = () => s.$('#fGal').click();
  s.$('#fCam').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
  s.$('#fGal').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
  form.date.onchange = () => { s.$('#ageNow').textContent = 'Věk: ' + ageText(meta.birthDate, form.date.value || todayISO()); };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = readForm(form);
    const wRaw = f.weight.trim();
    const w = wRaw ? parseNum(wRaw) : null;
    if (wRaw && !(w > 0.1 && w < 120)) { toast('Váha musí být číslo v kg, např. 12,4.'); return; }
    const hasPhoto = !!pending || !!existing?.hasPhoto;
    if (!hasPhoto && !w) { toast('Přidej fotku nebo váhu.'); return; }
    const id = existing?.id || uid();
    try {
      if (pending) await photodb.savePhoto(id, pending.img, pending.thumb);
    } catch (err) {
      console.error(err);
      toast('Fotku se nepodařilo uložit (málo místa v zařízení?).');
      return;
    }
    store.put('growth', { id, date: f.date, weightKg: w, note: f.note.trim(), hasPhoto });
    if (pending) sync.pushPhoto(id).catch(() => {});
    s.close();
    toast('Uloženo.');
    draw();
  };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Smazat záznam?', text: 'Smaže se i fotka a váha.', ok: 'Smazat', danger: true })) {
      removeEntry(existing.id);
      s.close();
    }
  };
}

function removeEntry(id) {
  store.del('growth', id);
  photodb.removePhoto(id).catch(() => {});
  draw();
}

// ---------- detail ----------
function detailSheet(id) {
  const g = store.get('growth', id);
  if (!g) return;
  const meta = store.getMeta();
  const s = openSheet({
    title: fmtDate(g.date),
    body: html`
      ${g.hasPhoto ? html`<div class="detail-photo"><img id="dImg" alt="Fotka ${fmtDate(g.date)}"></div>` : ''}
      <div class="chips"><span class="chip strong">${ageText(meta.birthDate, g.date)}</span>${g.weightKg ? html`<span class="chip">${fmtKg(g.weightKg)}</span>` : ''}</div>
      ${g.note ? html`<p class="walk-note">${g.note}</p>` : ''}
      ${g.by ? html`<p class="muted small">Zapsal(a): ${g.by}</p>` : ''}
      <div class="btn-row"><button class="btn primary" data-edit>${icon('edit', 18)} Upravit</button><button class="btn danger-ghost" data-rm>${icon('trash', 18)} Smazat</button></div>`,
  });
  if (g.hasPhoto) {
    photodb.photoUrl(id, 'img').then((u) => {
      const i = s.$('#dImg');
      if (!i) return;
      if (u) i.src = u;
      else { i.replaceWith(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Fotka se do tohoto zařízení ještě nestáhla.' })); sync.ensurePhoto(id); }
    });
  }
  s.$('[data-edit]').onclick = () => { s.close(); setTimeout(() => entrySheet(g), 260); };
  s.$('[data-rm]').onclick = async () => {
    if (await confirmDialog({ title: 'Smazat záznam?', text: 'Smaže se i fotka a váha.', ok: 'Smazat', danger: true })) { removeEntry(id); s.close(); }
  };
}

// ---------- porovnání předtím vs. teď ----------
function compareSheet() {
  const photos = photosOf();
  if (photos.length < 2) return;
  const meta = store.getMeta();
  let a = photos[0], b = photos[photos.length - 1];
  const opt = (g, sel) => html`<option value="${g.id}" ${g.id === sel ? raw('selected') : ''}>${fmtShort(g.date)} · ${ageText(meta.birthDate, g.date)}</option>`;

  const s = openSheet({
    title: 'Předtím vs. teď',
    full: true,
    body: html`
      <div class="row2">
        <label class="field"><span>Předtím</span><select id="selA">${photos.map((g) => opt(g, a.id))}</select></label>
        <label class="field"><span>Teď</span><select id="selB">${photos.map((g) => opt(g, b.id))}</select></label>
      </div>
      <div class="cmp" id="cmp">
        <img class="cmp-b" id="imgB" alt="Teď"><img class="cmp-a" id="imgA" alt="Předtím">
        <div class="cmp-line" id="cmpLine"><span>${icon('chev', 14)}</span></div>
        <span class="cmp-tag l">Předtím</span><span class="cmp-tag r">Teď</span>
      </div>
      <input type="range" id="cmpRange" min="0" max="100" value="50" aria-label="Posuvník porovnání">
      <div class="cmp-info" id="cmpInfo"></div>`,
  });

  const setPos = (v) => {
    s.$('#imgA').style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    s.$('#cmpLine').style.left = v + '%';
    s.$('#cmpRange').value = v;
  };
  const info = () => {
    const part = (g, label) => html`<div><b>${label}</b><span>${fmtDate(g.date)}</span><span>${ageText(meta.birthDate, g.date)}</span>${g.weightKg ? html`<span>${fmtKg(g.weightKg)}</span>` : ''}</div>`;
    s.$('#cmpInfo').innerHTML = String(html`${part(a, 'Předtím')}${part(b, 'Teď')}`);
  };
  const load = async () => {
    const [ua, ub] = await Promise.all([photodb.photoUrl(a.id, 'img'), photodb.photoUrl(b.id, 'img')]);
    if (ua) s.$('#imgA').src = ua;
    if (ub) s.$('#imgB').src = ub;
    if (!ua || !ub) toast('Některá fotka se do zařízení ještě nestáhla.');
    info();
  };
  s.$('#selA').onchange = (e) => { a = photos.find((g) => g.id === e.target.value); load(); };
  s.$('#selB').onchange = (e) => { b = photos.find((g) => g.id === e.target.value); load(); };
  s.$('#cmpRange').oninput = (e) => setPos(Number(e.target.value));

  // tažení prstem přímo po fotce
  const box = s.$('#cmp');
  const fromPointer = (ev) => {
    const r = box.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)));
  };
  box.addEventListener('pointerdown', (ev) => { box.setPointerCapture(ev.pointerId); fromPointer(ev); });
  box.addEventListener('pointermove', (ev) => { if (box.hasPointerCapture(ev.pointerId)) fromPointer(ev); });

  setPos(50);
  load();
}
