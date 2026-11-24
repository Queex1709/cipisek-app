/* week.js – týdenní souhrn na Dnes: nehody, venku, jídlo, procházky, váha, úkoly. Se šipkami po týdnech zpět a tlačítkem „Zkopírovat“. */
import * as store from './store.js';
import { html, todayISO, addDaysISO, parseISO, fmtShort, fmtKm, fmtKg, copyText } from './util.js';
import { icon, toast, miniBars } from './ui.js';

let off = 0;   // 0 = posledních 7 dní, 1 = týden před tím…

function range(o) { const to = addDaysISO(todayISO(), -7 * o), from = addDaysISO(to, -6); return { from, to }; }

function stats(o) {
  const { from, to } = range(o);
  const inR = (d) => d >= from && d <= to;
  const ev = store.list('diary').filter((e) => inR(e.date));
  const n = (t) => ev.filter((e) => e.type === t).length;
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDaysISO(to, -i), day = ev.filter((e) => e.date === d);
    rows.push({
      label: parseISO(d).toLocaleDateString('cs-CZ', { weekday: 'narrow' }),
      good: day.filter((e) => e.type === 'pee' || e.type === 'poop').length,
      bad: day.filter((e) => e.type === 'accident').length,
    });
  }
  const worstRow = rows.reduce((m, r, i) => (r.bad > (m.v || 0) ? { i, v: r.bad } : m), {});
  const walks = store.list('walks').filter((w) => inR(w.date));
  const gr = store.list('growth').filter((g) => g.weightKg).sort((a, b) => a.date.localeCompare(b.date));
  const wIn = gr.filter((g) => inR(g.date));
  const before = gr.filter((g) => g.date < from).pop();
  const last = wIn[wIn.length - 1];
  const good = n('pee') + n('poop'), bad = n('accident');
  return {
    from, to, rows, good, bad, meals: n('meal'), sleeps: n('sleep'),
    clean: good + bad ? Math.round((good / (good + bad)) * 100) : null,
    worstDay: worstRow.v ? parseISO(addDaysISO(to, -(6 - worstRow.i))).toLocaleDateString('cs-CZ', { weekday: 'long' }) : null,
    walks: walks.length, meters: walks.reduce((a, w) => a + (w.meters || 0), 0),
    weight: last ? { kg: last.weightKg, diff: before ? Math.round((last.weightKg - before.weightKg) * 100) / 100 : null } : null,
    tasks: store.list('tasklogs').filter((l) => inR(l.date)).length,
    days: new Set(ev.map((e) => e.date)).size,
  };
}

function text(s) {
  const l = [`Týden ${fmtShort(s.from)} – ${fmtShort(s.to)} (${store.getMeta().name || 'Cipísek'})`,
    `Venku: ${s.good}×, nehody doma: ${s.bad}×${s.clean != null ? `, čistota ${s.clean} %` : ''}`,
    `Jídlo: ${s.meals}×, procházky: ${s.walks}${s.meters ? ` (${fmtKm(s.meters)})` : ''}`];
  if (s.weight) l.push(`Váha: ${fmtKg(s.weight.kg)}${s.weight.diff != null ? ` (${s.weight.diff > 0 ? '+' : ''}${String(s.weight.diff).replace('.', ',')} kg)` : ''}`);
  if (s.worstDay) l.push(`Nejvíc nehod: ${s.worstDay}`);
  return l.join('\n');
}

export function renderHtml() {
  const s = stats(off), p = stats(off + 1);
  const empty = s.good + s.bad + s.meals + s.walks === 0;
  const trend = (a, b, lowerBetter) => {
    if (p.good + p.bad === 0 || a === b) return '';
    const better = lowerBetter ? a < b : a > b;
    return html` <small class="${better ? 'tr-good' : 'tr-bad'}">${a > b ? '▲' : '▼'} ${Math.abs(a - b)} oproti minulému týdnu</small>`;
  };
  return html`<section class="card" aria-label="Týdenní souhrn">
    <div class="card-head"><h2>${off ? `Týden ${fmtShort(s.from)} – ${fmtShort(s.to)}` : 'Souhrn týdne'}</h2>
      <span class="wk-nav"><button class="icon-btn" data-week="-1" aria-label="Starší týden" style="transform:scaleX(-1)">${icon('chev', 18)}</button>
      <button class="icon-btn" data-week="1" aria-label="Novější týden" ${off === 0 ? 'disabled style="opacity:.3"' : ''}>${icon('chev', 18)}</button></span></div>
    ${empty ? html`<p class="muted small">V tomhle týdnu nejsou žádné zápisy.</p>` : html`
      ${miniBars(s.rows)}
      <p class="legend"><i class="dot good"></i>venku <i class="dot bad"></i>nehoda doma</p>
      <ul class="wk-list">
        <li><span>Nehody doma</span><b>${s.bad}×</b>${trend(s.bad, p.bad, true)}</li>
        <li><span>Venku (čůrání, hovínka)</span><b>${s.good}×</b>${trend(s.good, p.good, false)}</li>
        ${s.clean != null ? html`<li><span>Čistota</span><b>${s.clean} %</b></li>` : ''}
        <li><span>Najedl se</span><b>${s.meals}×</b></li>
        <li><span>Procházky</span><b>${s.walks}${s.meters ? ` · ${fmtKm(s.meters)}` : ''}</b></li>
        ${s.weight ? html`<li><span>Poslední váha</span><b>${fmtKg(s.weight.kg)}${s.weight.diff != null ? ` (${s.weight.diff > 0 ? '+' : ''}${String(s.weight.diff).replace('.', ',')} kg)` : ''}</b></li>` : ''}
        <li><span>Splněné úkoly</span><b>${s.tasks}×</b></li>
      </ul>
      ${s.worstDay ? html`<p class="muted small">Nejvíc nehod: ${s.worstDay}. Zapsané dny: ${s.days} ze 7.</p>` : html`<p class="muted small">Zapsané dny: ${s.days} ze 7.</p>`}
      <button class="btn ghost" data-week-copy>${icon('link', 18)} Zkopírovat souhrn</button>`}
  </section>`;
}

export function handleClick(e, redraw) {
  const b = e.target.closest('[data-week]');
  if (b) { off = Math.max(0, off - Number(b.dataset.week)); redraw(); return true; }
  if (e.target.closest('[data-week-copy]')) {
    copyText(text(stats(off))).then((ok) => toast(ok ? 'Souhrn je zkopírovaný.' : 'Kopírování se nepovedlo.'));
    return true;
  }
  return false;
}
