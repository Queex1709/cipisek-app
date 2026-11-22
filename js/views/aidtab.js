/* views/aidtab.js – záložka První pomoc v sekci Zdraví. */
import * as store from '../store.js';
import { html, esc } from '../util.js';
import { icon } from '../ui.js';
import { URGENT, TOPICS, TOXIC } from '../aid.js';

export function renderHtml() {
  const meta = store.getMeta();
  const tel = (meta.vetPhone || '').replace(/[^\d+]/g, '');
  return html`
    <section class="card aid-urgent" aria-labelledby="h-urg">
      <h2 id="h-urg">Ihned k veterináři, když…</h2>
      <ul class="points">${URGENT.map((x) => html`<li>${x}</li>`)}</ul>
      ${tel ? html`<a class="btn danger block" href="tel:${tel}">${icon('link', 18)} Zavolat: ${meta.vetName || meta.vetPhone}</a>`
        : html`<p class="muted small">Vlož telefon na veterináře v Nastavení, ať ho tu máš na jedno klepnutí.</p><a class="btn ghost block" href="#/nastaveni">Otevřít Nastavení</a>`}
      <p class="muted small">Mimo ordinační hodiny hledej nejbližší pohotovostní veterinu. Při pochybnostech radši zavolej.</p>
    </section>
    <section class="card" aria-labelledby="h-aid"><h2 id="h-aid">Co dělat</h2>
      <div class="aid">${TOPICS.map((x) => html`<details><summary><span aria-hidden="true">${x.e}</span> ${x.t}</summary>
        <ol class="steps">${x.steps.map((s) => html`<li>${s}</li>`)}</ol></details>`)}</div></section>
    <section class="card" aria-labelledby="h-tox"><h2 id="h-tox">Nebezpečné pro psa</h2>
      <ul class="tox">${TOXIC.map(([e, t]) => html`<li><span aria-hidden="true">${e}</span>${t}</li>`)}</ul>
      <p class="muted small">Obecné informace z veterinárních příruček. Nenahrazují radu veterináře a nestanovují diagnózu.</p></section>`;
}
