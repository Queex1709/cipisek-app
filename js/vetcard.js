/* vetcard.js – „Karta pro veterináře“: přehledná stránka k ukázání nebo vytištění (PDF). */
import * as store from './store.js';
import { html, fmtDate, fmtKg, ageText, todayISO, copyText, plural } from './util.js';
import { icon, toast, openSheet } from './ui.js';
import { KIND } from './data.js';
import { weightSeries } from './domain.js';
import { doseText } from './tasks.js';
import * as feeding from './feeding.js';

function collect() {
  const meta = store.getMeta();
  const vet = store.list('vet');
  const done = vet.filter((v) => v.status !== 'planned').sort((a, b) => b.date.localeCompare(a.date));
  const planned = vet.filter((v) => v.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  const weights = weightSeries().slice(-6).reverse();
  const meds = store.list('tasks').filter((t) => t.active !== false && (t.kind === 'supplement' || t.kind === 'med'));
  const est = feeding.estimate();
  const plan = feeding.getPlan();
  return { meta, done, planned, weights, meds, est, plan };
}

function textVersion() {
  const { meta, done, planned, weights, meds, est, plan } = collect();
  const sex = meta.sex === 'f' ? 'fena' : 'pes';
  const L = [`KARTA PRO VETERINÁŘE – ${meta.name}`, `${meta.breed}, ${sex}`, `Narozen: ${fmtDate(meta.birthDate)} (${ageText(meta.birthDate)})`];
  if (meta.chip) L.push(`Číslo čipu: ${meta.chip}`);
  if (meta.notes) L.push(`Alergie a poznámky: ${meta.notes}`);
  L.push('', 'VÁHA');
  weights.length ? weights.forEach((w) => L.push(`${fmtDate(w.date)}: ${fmtKg(w.kg)} (${ageText(meta.birthDate, w.date)})`)) : L.push('Zatím nezapsáno');
  L.push('', 'OČKOVÁNÍ, ODČERVENÍ, NÁVŠTĚVY');
  done.length ? done.forEach((v) => L.push(`${fmtDate(v.date)}: ${v.title}${v.weightKg ? `, ${fmtKg(v.weightKg)}` : ''}${v.note ? ` – ${v.note}` : ''}`)) : L.push('Zatím nezapsáno');
  if (planned.length) { L.push('', 'NAPLÁNOVÁNO'); planned.forEach((v) => L.push(`${fmtDate(v.date)}: ${v.title}`)); }
  if (meds.length) { L.push('', 'DOPLŇKY A LÉKY'); meds.forEach((t) => L.push(`${t.title}${doseText(t) ? ` – ${doseText(t)}` : ''}, ${(t.times || []).join(', ')}`)); }
  if (est.ok) L.push('', 'KRMENÍ', `${plan.foodName || 'Krmivo'}: asi ${est.gramsDay} g denně, ${est.meals}× denně`);
  L.push('', `Vytvořeno ${fmtDate(todayISO())}`);
  return L.join('\n');
}

export function openVetCard() {
  const { meta, done, planned, weights, meds, est, plan } = collect();
  const sex = meta.sex === 'f' ? 'fena' : 'pes';
  const s = openSheet({
    title: 'Karta pro veterináře', full: true, cls: 'vetcard',
    body: html`<div class="vc" id="vc">
      <div class="vc-head"><h3>${meta.name}</h3><p>${meta.breed} · ${sex}</p></div>
      <dl class="vc-grid">
        <div><dt>Narozen</dt><dd>${fmtDate(meta.birthDate)}</dd></div>
        <div><dt>Věk</dt><dd>${ageText(meta.birthDate)}</dd></div>
        <div><dt>Číslo čipu</dt><dd>${meta.chip || 'doplň v Nastavení'}</dd></div>
        <div><dt>Poslední váha</dt><dd>${weights[0] ? fmtKg(weights[0].kg) : '–'}</dd></div>
      </dl>
      ${meta.notes ? html`<div class="vc-box"><b>Alergie a poznámky</b><p>${meta.notes}</p></div>` : ''}
      <h4>Váha</h4>
      ${weights.length ? html`<table class="vc-tab">${weights.map((w) => html`<tr><td>${fmtDate(w.date)}</td><td>${ageText(meta.birthDate, w.date)}</td><td class="r">${fmtKg(w.kg)}</td></tr>`)}</table>` : html`<p class="muted small">Zatím nezapsáno.</p>`}
      <h4>Očkování, odčervení, návštěvy</h4>
      ${done.length ? html`<table class="vc-tab">${done.map((v) => html`<tr><td>${fmtDate(v.date)}</td><td>${KIND[v.kind]?.emoji || ''} ${v.title}${v.note ? html`<small>${v.note}</small>` : ''}</td><td class="r">${v.weightKg ? fmtKg(v.weightKg) : ''}</td></tr>`)}</table>` : html`<p class="muted small">Zatím nezapsáno.</p>`}
      ${planned.length ? html`<h4>Naplánováno</h4><table class="vc-tab">${planned.map((v) => html`<tr><td>${fmtDate(v.date)}</td><td>${v.title}</td><td></td></tr>`)}</table>` : ''}
      ${meds.length ? html`<h4>Doplňky a léky</h4><table class="vc-tab">${meds.map((t) => html`<tr><td>${t.title}</td><td>${(t.times || []).join(', ')}</td><td class="r">${doseText(t)}</td></tr>`)}</table>` : ''}
      ${est.ok ? html`<h4>Krmení</h4><p>${plan.foodName || 'Krmivo'}: asi ${est.gramsDay} g denně, ${est.meals}× denně (${plan.kcalKg} kcal/kg).</p>` : ''}
      <p class="vc-foot">Vytvořeno ${fmtDate(todayISO())} v aplikaci Cipísek</p>
    </div>
    <div class="btn-row no-print">
      <button class="btn primary" data-print>${icon('download', 18)} Tisk / uložit PDF</button>
      <button class="btn ghost" data-copy>${icon('link', 18)} Zkopírovat text</button>
    </div>
    ${navigator.share ? html`<button class="btn ghost block no-print" data-share>${icon('share', 18)} Sdílet jako text</button>` : ''}`,
  });
  s.$('[data-print]').onclick = () => window.print();
  s.$('[data-copy]').onclick = async () => toast((await copyText(textVersion())) ? 'Text je zkopírovaný.' : 'Kopírování se nepovedlo.');
  const sh = s.$('[data-share]');
  if (sh) sh.onclick = () => navigator.share({ title: `Karta pro veterináře – ${meta.name}`, text: textVersion() }).catch(() => {});
}
