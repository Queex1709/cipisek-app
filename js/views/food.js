/* views/food.js – samostatná sekce Jídlo: Porce (kolik má sníst), Slevy a Doplňky. */
import { html } from '../util.js';
import * as feedtab from './feedtab.js';
import * as deals from '../deals.js';

let root = null;
let tab = 'portion';

export function render(r) {
  root = r;
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('t');
  if (q === 'slevy') tab = 'deals';
  else if (q === 'doplnky') tab = 'supp';
  else if (q === 'porce') tab = 'portion';
  root.onclick = onClick;
  root.onsubmit = (e) => { if (tab === 'portion') feedtab.handleSubmit(e, draw); };
  draw();
  if (tab === 'deals') deals.load().then(draw).catch(draw);
}
export const refresh = () => root && draw();
export function destroy() { if (root) { root.onclick = null; root.onsubmit = null; } root = null; }

const TABS = [['portion', 'Porce'], ['deals', 'Slevy'], ['supp', 'Doplňky']];

function draw() {
  if (!root) return;
  root.innerHTML = String(html`
    <header class="page-head"><h1>Jídlo</h1></header>
    <div class="seg" role="tablist">${TABS.map(([id, label]) =>
      html`<button role="tab" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}" data-tab="${id}">${label}</button>`)}</div>
    ${tab === 'deals' ? deals.renderHtml() : tab === 'supp' ? feedtab.renderSupplements() : feedtab.renderPortion()}`);
}

function onClick(e) {
  const el = e.target.closest('[data-tab]');
  if (el) {
    tab = el.dataset.tab;
    draw();
    if (tab === 'deals') deals.load().then(draw).catch(draw);
    return;
  }
  if (tab === 'deals' && deals.handleClick(e, draw)) return;
  feedtab.handleClick(e, draw);
}
