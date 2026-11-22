/* feeding.js – kolik má štěně sníst. Logika bez UI.
   Vzorec (PetMD / AAHA): RER = 70 × kg^0,75;  denní energie = RER × faktor
   faktor 3 = štěně do 4 měsíců, 2 = štěně nad 4 měsíců.
   Počet krmení (Royal Canin CZ, velká a obří plemena): po odstavení ~4, do 6 měsíců 3, od 6 do ~15 měsíců 2.
   Jde jen o odhad. Tabulka na obalu krmiva a veterinář mají přednost. */
import * as store from './store.js';
import { weightSeries } from './domain.js';
import { ageParts, diffDays, todayISO } from './util.js';

export const getPlan = () => store.get('plan', 'feeding');

export const rer = (kg) => 70 * Math.pow(kg, 0.75);
export const factor = (months) => (months < 4 ? 3 : 2);
export const mealsPerDay = (months) => (months < 3 ? 4 : months < 6 ? 3 : 2);
const round5 = (n) => Math.round(n / 5) * 5;

export function latestWeight() {
  const w = weightSeries();
  return w.length ? w[w.length - 1] : null;
}

/** Odhad porce z uložené konfigurace krmiva a poslední váhy. */
export function estimate(mealsCount) {
  const plan = getPlan();
  const lw = latestWeight();
  const age = ageParts(store.getMeta().birthDate);
  const months = age.months;
  const meals = mealsCount || mealsPerDay(months);
  if (!plan?.kcalKg || plan.kcalKg < 1500 || plan.kcalKg > 6000) return { ok: false, reason: 'nofood', plan, age, meals };
  if (!lw) return { ok: false, reason: 'noweight', plan, age, meals };
  const kcalDay = rer(lw.kg) * factor(months);
  const gramsDay = round5((kcalDay / plan.kcalKg) * 1000);
  return {
    ok: true, plan, age, meals, kg: lw.kg, kgDate: lw.date, staleDays: diffDays(lw.date, todayISO()),
    kcalDay: Math.round(kcalDay), gramsDay, gramsMeal: round5(gramsDay / meals), factor: factor(months),
  };
}

/** Text porce na jedno krmení pro úkol s dávkou „auto“. */
export function mealDoseText(timesCount) {
  const e = estimate(timesCount || undefined);
  return e.ok ? `asi ${e.gramsMeal} g` : 'porce podle kalkulačky';
}
