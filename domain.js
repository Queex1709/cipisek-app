/* domain.js – odvozená data nad úložištěm (váha, další termín, fáze zvládnutí, série tréninků). */
import * as store from './store.js';
import { todayISO, addDaysISO, diffDays } from './util.js';

/** Všechny záznamy váhy (z galerie i z veterinárních záznamů), seřazené podle data. */
export function weightSeries() {
  const out = [];
  for (const g of store.list('growth')) {
    if (g.weightKg > 0) out.push({ id: g.id, date: g.date, kg: g.weightKg, src: 'growth', photo: !!g.hasPhoto });
  }
  for (const v of store.list('vet')) {
    if (v.status !== 'planned' && v.weightKg > 0) out.push({ id: v.id, date: v.date, kg: v.weightKg, src: 'vet' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Nejbližší naplánovaný termín u veterináře (i po termínu). */
export function nextVet() {
  return store.list('vet').filter((v) => v.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

/** Fáze zvládnutí dovednosti podle procent. */
export const STAGES = [
  { from: 0, label: 'Seznamujeme se', hint: 'Učíme se s pamlskem v klidu doma.', tone: 'a' },
  { from: 25, label: 'Učíme se', hint: 'Zvládá s pamlskem, začínáme ho schovávat.', tone: 'b' },
  { from: 50, label: 'Bez návnady', hint: 'Funguje i bez pamlsku v ruce.', tone: 'c' },
  { from: 75, label: 'S rozptýlením', hint: 'Zkoušíme venku, mezi lidmi a psy.', tone: 'd' },
  { from: 100, label: 'Zvládnuto', hint: 'Spolehlivě i v běžném životě.', tone: 'e' },
];
export const stageOf = (p) => [...STAGES].reverse().find((s) => p >= s.from) || STAGES[0];

export function logsOf(skillId) {
  return store.list('logs').filter((l) => l.skillId === skillId).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}
export function lastTrained(skillId) {
  const l = logsOf(skillId);
  return l.length ? l[l.length - 1].date : null;
}

/** Počet dní v řadě (do dneška nebo včerejška), kdy proběhl aspoň jeden trénink. */
export function trainingStreak() {
  const days = new Set(store.list('logs').map((l) => l.date));
  let d = todayISO();
  if (!days.has(d)) d = addDaysISO(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDaysISO(d, -1); }
  return n;
}
export const trainingsThisWeek = () => {
  const from = addDaysISO(todayISO(), -6);
  return store.list('logs').filter((l) => l.date >= from).length;
};

export function overallProgress() {
  const sk = store.list('skills');
  if (!sk.length) return { pct: 0, count: 0, mastered: 0 };
  const sum = sk.reduce((a, s) => a + (s.progress || 0), 0);
  return { pct: Math.round(sum / sk.length), count: sk.length, mastered: sk.filter((s) => (s.progress || 0) >= 100).length };
}

export const daysSince = (iso) => (iso ? diffDays(iso, todayISO()) : null);
