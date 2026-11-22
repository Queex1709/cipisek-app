/* views/milestones.js – milníky (první procházka, první sníh…) s volitelnou fotkou. Záložka v sekci Růst. */
import * as store from '../store.js';
import * as sync from '../sync.js';
import * as photodb from '../photodb.js';
import { html, uid, todayISO, fmtDate, ageText, ageDisplay } from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm } from '../ui.js';
import { MILESTONE_PRESETS } from '../data.js';
import { photoPickHtml, bindPhotoPick } from '../photopick.js';
import { ageImage, shareOrDownload } from '../shareimg.js';

export function renderHtml() {
  const meta = store.getMeta();
  const list = store.list('milestones').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const used = new Set(list.map((m) => m.title));
  const free = MILESTONE_PRESETS.filter((p) => !used.has(p));
  return html`
    <button class="btn primary block" data-mile-add>${icon('plus', 20)} Přidat milník</button>
    ${list.length ? html`<ol class="miles">${list.map((m) => html`<li><button class="mile" data-mile="${m.id}">
        ${m.hasPhoto ? html`<img data-ph="${m.id}" alt="">` : html`<span class="mile-ic" aria-hidden="true">${icon('star', 22)}</span>`}
        <span class="mile-t"><b>${m.title}</b><small>${fmtDate(m.date)} · ${ageText(meta.birthDate, m.date)}</small>${m.note ? html`<small class="note">${m.note}</small>` : ''}</span>
      </button></li>`)}</ol>`
      : html`<p class="empty">Tady si schováš první zážitky. Klepni na některý a doplň datum.</p>`}
    ${free.length ? html`<h2 class="sec">Nápady</h2>
      <div class="chips wrap">${free.slice(0, 8).map((p) => html`<button class="chip btn-chip" data-mile-preset="${p}">${p}</button>`)}</div>` : ''}`;
}

export function handleClick(e, redraw) {
  const t = e.target;
  let el;
  if (t.closest('[data-mile-add]')) { sheet(null, '', redraw); return true; }
  if ((el = t.closest('[data-mile-preset]'))) { sheet(null, el.dataset.milePreset, redraw); return true; }
  if ((el = t.closest('[data-mile]'))) { sheet(store.get('milestones', el.dataset.mile), '', redraw); return true; }
  return false;
}

function sheet(existing, presetTitle, redraw) {
  const meta = store.getMeta();
  const b = { title: presetTitle, date: todayISO(), note: '', ...existing };
  const s = openSheet({
    title: existing ? 'Upravit milník' : 'Nový milník',
    onClose: () => pick.dispose(),
    body: html`<form class="form" id="mf">
      ${field({ label: 'Co se stalo?', name: 'title', value: b.title, attrs: 'required maxlength="80" placeholder="např. První sníh"' })}
      ${field({ label: 'Datum', name: 'date', type: 'date', value: b.date, attrs: `required min="${meta.birthDate}" max="${todayISO()}"` })}
      <p class="muted small" id="mAge">Věk: ${ageText(meta.birthDate, b.date)}</p>
      ${textarea({ label: 'Poznámka', name: 'note', value: b.note || '', attrs: 'maxlength="500"' })}
      ${photoPickHtml(!!existing?.hasPhoto)}
      <button class="btn primary block" type="submit">Uložit</button>
      ${existing ? html`<div class="btn-row">${existing.hasPhoto ? html`<button class="btn ghost" type="button" data-share>${icon('share', 18)} Sdílet s věkem</button>` : ''}
        <button class="btn danger-ghost" type="button" data-del>${icon('trash', 18)} Smazat</button></div>` : ''}
    </form>`,
  });
  const form = s.$('#mf');
  const pick = bindPhotoPick(s);
  if (existing?.hasPhoto) photodb.photoUrl(existing.id, 'img').then((u) => { const i = s.$('#ppImg'); if (u && i) i.src = u; });
  form.date.onchange = () => { s.$('#mAge').textContent = 'Věk: ' + ageText(meta.birthDate, form.date.value || todayISO()); };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = readForm(form);
    const id = existing?.id || uid();
    try { if (pick.pending) await photodb.savePhoto(id, pick.pending.img, pick.pending.thumb); }
    catch (err) { console.error(err); toast('Fotku se nepodařilo uložit (málo místa?).'); return; }
    store.put('milestones', { id, title: f.title.trim(), date: f.date, note: f.note.trim(), hasPhoto: !!pick.pending || !!existing?.hasPhoto });
    if (pick.pending) sync.pushPhoto(id).catch(() => {});
    s.close();
    toast('Milník uložen.');
    redraw();
  };
  const sh = s.$('[data-share]');
  if (sh) sh.onclick = async () => {
    sh.disabled = true;
    try {
      const p = await photodb.loadPhoto(existing.id);
      if (!p) { toast('Fotka se do tohoto zařízení ještě nestáhla.'); return; }
      const a = ageDisplay(meta.birthDate, form.date.value || existing.date);
      const blob = await ageImage({ blob: p.img, name: meta.name, big: a.big, small: a.small, foot: `${fmtDate(form.date.value || existing.date)} · ${existing.title}` });
      await shareOrDownload(blob, `${meta.name}-${existing.date}.jpg`, `${meta.name}, ${ageText(meta.birthDate, existing.date)}`);
    } catch (err) { console.error(err); toast('Obrázek se nepodařilo vytvořit.'); }
    sh.disabled = false;
  };
  const del = s.$('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Smazat milník?', ok: 'Smazat', danger: true })) {
      store.del('milestones', existing.id);
      photodb.removePhoto(existing.id).catch(() => {});
      s.close();
      redraw();
    }
  };
}
