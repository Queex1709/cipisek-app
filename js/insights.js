/* insights.js – doporučení z deníku: kdy vyvenčit a kdy se nejčastěji stávají nehody. */
import * as store from './store.js';
import { addDaysISO, todayISO, ageParts, clamp } from './util.js';

const OUT = new Set(['pee', 'poop']);

/** Rozložení událostí během dne po dvou hodinách (posledních `days` dní). */
export function pottyStats(days = 14) {
  const from = addDaysISO(todayISO(), -(days - 1));
  const ev = store.list('diary').filter((e) => e.date >= from && (OUT.has(e.type) || e.type === 'accident'));
  const buckets = Array.from({ length: 12 }, (_, i) => ({ label: String(i * 2), from: i * 2, good: 0, bad: 0 }));
  for (const e of ev) {
    const b = buckets[Math.floor(new Date(e.ts).getHours() / 2)];
    if (e.type === 'accident') b.bad++; else b.good++;
  }
  const bad = ev.filter((e) => e.type === 'accident').length;
  let worst = -1, max = 0;
  buckets.forEach((b, i) => { if (b.bad > max) { max = b.bad; worst = i; } });
  return { buckets, total: ev.length, bad, worst: worst >= 0 ? buckets[worst] : null };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Kdy zkusit jít ven. Z odstupů v deníku (aspoň 5), jinak podle věku štěněte. */
export function nextOutside() {
  const events = store.list('diary').filter((e) => OUT.has(e.type)).sort((a, b) => a.ts - b.ts);
  const recent = events.filter((e) => e.ts > Date.now() - 7 * 864e5);
  const gaps = [];
  for (let i = 1; i < recent.length; i++) {
    const g = (recent[i].ts - recent[i - 1].ts) / 60000;
    if (g >= 20 && g <= 300) gaps.push(g);
  }
  const months = ageParts(store.getMeta().birthDate).months;
  const byAge = Math.round((60 + 20 * months) / 15) * 15;
  const fromData = gaps.length >= 5;
  const interval = clamp(Math.round(fromData ? median(gaps) : byAge), 45, 240);
  const last = events[events.length - 1] || null;
  const hour = new Date().getHours();
  const night = hour >= 22 || hour < 6;
  const nextTs = last ? last.ts + interval * 60000 : null;
  return { interval, fromData, last, nextTs, overdue: nextTs != null && nextTs < Date.now(), night };
}
