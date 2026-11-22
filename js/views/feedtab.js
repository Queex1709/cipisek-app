/* views/feedtab.js – záložka Krmení v sekci Zdraví: kolik má štěně sníst, pravidla a výživa kloubů. */
import * as store from '../store.js';
import * as feeding from '../feeding.js';
import { html, fmtDate, fmtKg, nDays, todayISO, ageText, ageParts, parseNum } from '../util.js';
import { icon, toast, field, readForm } from '../ui.js';
import { TASK_PRESETS } from '../data.js';
import { taskSheet } from '../cards.js';
import { doseText } from '../tasks.js';

const MEAL_TIMES = { 4: ['07:30', '11:30', '15:30', '19:30'], 3: ['07:30', '13:00', '19:00'], 2: ['07:30', '18:30'] };

export function renderHtml() {
  const meta = store.getMeta();
  const plan = feeding.getPlan();
  const age = ageParts(meta.birthDate);
  const est = feeding.estimate();
  const meals = feeding.mealsPerDay(age.months);
  const mealsTask = store.get('tasks', 'preset_meals');
  const meds = store.list('tasks').filter((t) => t.active !== false && (t.kind === 'supplement' || t.kind === 'med'));

  return html`
    <section class="card" aria-labelledby="h-food">
      <h2 id="h-food">Kolik má sníst</h2>
      <p class="muted small">Zadej krmivo z obalu a spočítám denní porci podle váhy a věku. Je to odhad. Tabulka na obalu a veterinář mají přednost.</p>
      <form class="form" data-form="feed">
        ${field({ label: 'Krmivo (název)', name: 'foodName', value: plan?.foodName || '', attrs: 'maxlength="60" placeholder="např. granule pro štěňata velkých plemen"' })}
        ${field({ label: 'Energie v krmivu (kcal/kg)', name: 'kcalKg', type: 'text', value: plan?.kcalKg || '', attrs: 'required inputmode="numeric" placeholder="např. 3800"', hint: 'Na obalu hledej „metabolizovatelná energie“. Když je v kJ, vyděl číslem 4,18.' })}
        <button class="btn primary block" type="submit">Spočítat porci</button>
      </form>
      ${est.ok ? html`
        <div class="feed-result">
          <div class="fr-main"><b>${est.gramsDay} g</b><span>za den</span></div>
          <div class="fr-sub"><b>${est.meals}× denně</b><span>asi ${est.gramsMeal} g na jedno krmení</span></div>
        </div>
        <ul class="points">
          <li>Odhad z váhy ${fmtKg(est.kg)} (${fmtDate(est.kgDate)}) a věku ${ageText(meta.birthDate)}: asi ${est.kcalDay} kcal denně.</li>
          <li>Pamlsky započítej do denní porce, nejvýš 10 % kalorií. To je zhruba ${Math.round(est.gramsDay * 0.1)} g granulí, které si za ně uber.</li>
          <li>Odměřuj na kuchyňské váze, ne hrnkem.</li>
          <li>Obří plemeno má růst pomalu a štíhle. Když je odhad vyšší než tabulka na obalu, drž se spíš obalu.</li>
        </ul>
        ${est.staleDays > 14 ? html`<p class="warn">Poslední váha je stará ${nDays(est.staleDays)}. Štěně rychle roste, zvaž ho znovu, jinak bude odhad nízký.</p>` : ''}
        <div class="btn-row">
          ${mealsTask ? html`<button class="btn ghost" data-task-edit="preset_meals">${icon('cal', 18)} Upravit časy krmení</button>`
                      : html`<button class="btn ghost" data-meal-task>${icon('cal', 18)} Připomínky krmení (${est.meals}×)</button>`}
        </div>`
        : est.reason === 'noweight' ? html`<p class="warn">Chybí váha. Zapiš ji v záložce Růst a porce se spočítá.</p>`
        : html`<p class="hint">Vyplň energii z obalu a klepni na Spočítat porci.</p>`}
    </section>

    <section class="card" aria-labelledby="h-rules">
      <h2 id="h-rules">Pravidla pro velké štěně</h2>
      <ul class="points">
        <li><b>Teď (${ageText(meta.birthDate)}): ${meals}× denně.</b> Po odstavení zhruba 4×, do 6 měsíců 3×, pak 2× (u velkých plemen přibližně od 6 do 15 měsíců).</li>
        <li>Krmivo pro <b>štěňata velkých a obřích plemen</b>. Má jiný obsah vápníku a fosforu než běžné.</li>
        <li>Žádný vápník ani jiné doplňky navíc na vlastní pěst. Štěně neumí regulovat vstřebávání vápníku a hrozí poruchy kostí.</li>
        <li>Pomalý a plynulý růst je zdravější než rychlý. Velká plemena dorůstají až dva roky.</li>
        <li>Stálý přístup k čerstvé vodě, nejlépe v keramické nebo nerezové misce.</li>
        <li>Po jídle klid, žádné běhání ani divoké hry.</li>
      </ul>
      <p class="muted small">Zdroje: PetMD (výpočet energie), Royal Canin CZ (počet krmení), VCA Hospitals (velká a obří plemena).</p>
    </section>

    <section class="card" aria-labelledby="h-joint">
      <h2 id="h-joint">Výživa kloubů</h2>
      ${meds.length ? html`<ul class="recs">${meds.map((t) => html`<li><span class="e" aria-hidden="true">${t.emoji || '💊'}</span>
        <div><b>${t.title}</b><small>${doseText(t) || 'bez dávky'} · ${(t.times || []).join(', ')}</small></div>
        <button class="icon-btn" data-task-edit="${t.id}" aria-label="Upravit">${icon('edit', 18)}</button></li>`)}</ul>`
        : html`<p class="muted small">Žádná připomínka není nastavená.</p>
          <button class="btn ghost" data-add-joints>${icon('plus', 18)} Připomínka: výživa kloubů 2 tablety denně</button>`}
      <ul class="points">
        <li>Dávka je vždy na obalu přípravku podle váhy psa. Nepřekračuj ji a s přibývající váhou ji průběžně kontroluj.</li>
        <li>Zdravé štěně na kvalitním krmivu pro velká plemena ji obvykle nepotřebuje. Důležitější je správné krmivo, štíhlá postava a přiměřený pohyb. Pokud ti ji nedoporučil veterinář nebo chovatel, zeptej se ho.</li>
        <li>Účinek se čeká až po 4 až 8 týdnech. Hodnotit má smysl po dvou měsících.</li>
        <li>Občas se objeví měkčí stolice, hlavně při rychlém nasazení vysoké dávky.</li>
        <li>Kulhání, ztuhlost nebo bolest při pohybu je důvod k veterináři. Doplněk léčbu nenahradí.</li>
      </ul>
      <p class="muted small">Zdroj: Testado.cz. Obecné informace, které nenahrazují radu veterináře.</p>
    </section>`;
}

export function handleClick(e, redraw) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-task-edit]'))) { taskSheet(store.get('tasks', el.dataset.taskEdit), null, redraw); return true; }
  if (t.closest('[data-meal-task]')) {
    const meals = feeding.estimate().meals;
    const base = TASK_PRESETS.find((p) => p.key === 'meals');
    store.put('tasks', { ...base, times: MEAL_TIMES[meals] || base.times, startDate: todayISO(), active: true });
    toast('Připomínky krmení jsou nastavené.');
    redraw();
    return true;
  }
  if (t.closest('[data-add-joints]')) {
    const base = TASK_PRESETS.find((p) => p.key === 'joints');
    store.put('tasks', { ...base, startDate: todayISO(), active: true });
    toast('Připomínka je přidaná.');
    redraw();
    return true;
  }
  return false;
}

export function handleSubmit(e, redraw) {
  const form = e.target.closest('form[data-form="feed"]');
  if (!form) return false;
  e.preventDefault();
  const f = readForm(form);
  const kcal = parseNum(String(f.kcalKg).replace(/\s/g, ''));
  if (!(kcal >= 1500 && kcal <= 6000)) { toast('Energie musí být v kcal/kg, třeba 3800. Hodnoty v kJ vyděl číslem 4,18.'); return true; }
  store.put('plan', { id: 'feeding', foodName: f.foodName.trim(), kcalKg: Math.round(kcal) });
  redraw();
  return true;
}
