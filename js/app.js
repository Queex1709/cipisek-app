/* app.js – spouštěč: router (hash), horní lišta, spodní navigace, úvodní nastavení, PWA. */
import * as store from './store.js';
import * as sync from './sync.js';
import * as tracker from './tracker.js';
import { $, $$, html, debounce, todayISO, fmtClock, fmtKm } from './util.js';
import { icon, toast, openSheet, hasOpenSheet, field, readForm } from './ui.js';

const ROUTES = {
  dnes: () => import('./views/today.js'),
  prochazky: () => import('./views/walks.js'),
  vychova: () => import('./views/training.js'),
  rust: () => import('./views/growth.js'),
  zdravi: () => import('./views/health.js'),
  nastaveni: () => import('./views/settings.js'),
};
const NAV = [
  ['dnes', 'Dnes', 'home'], ['prochazky', 'Procházky', 'map'], ['vychova', 'Výchova', 'award'],
  ['rust', 'Růst', 'camera'], ['zdravi', 'Zdraví', 'heart'],
];

let current = null;
let navToken = 0;

// ---------- Kostra ----------
function buildChrome() {
  $('#nav').innerHTML = NAV.map(([id, label, ic]) =>
    `<a href="#/${id}" data-route="${id}">${icon(ic, 24)}<span>${label}</span></a>`).join('');
  $('#logo').innerHTML = String(icon('paw', 26));
  $('#gear').innerHTML = String(icon('gear', 22));
  updateBrand();
}
function updateBrand() { $('#brand-name').textContent = store.getMeta().name || 'Cipísek'; }

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const name = hash.split('?')[0] || 'dnes';
  const loader = ROUTES[name] || ROUTES.dnes;
  const token = ++navToken;
  const mod = await loader();
  if (token !== navToken) return;
  current?.destroy?.();
  current = mod;
  const root = $('#view');
  root.innerHTML = '';
  root.className = 'view view-' + (ROUTES[name] ? name : 'dnes');
  window.scrollTo(0, 0);
  await mod.render(root);
  $$('#nav a').forEach((a) => {
    const on = a.dataset.route === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#gear').classList.toggle('on', name === 'nastaveni');
  document.title = `${store.getMeta().name} – Průvodce & Deník`;
}

// ---------- Živé změny (od ostatních v rodině) ----------
const scheduleRefresh = debounce(() => { if (!hasOpenSheet()) current?.refresh?.(); }, 350);
store.subscribe((ev) => {
  if (ev.type === 'meta') updateBrand();
  if (ev.origin === 'remote' || ev.type === 'import' || ev.type === 'reset') scheduleRefresh();
});
addEventListener('cipisek:photo', scheduleRefresh);

// ---------- Indikátory v horní liště ----------
function initIndicators() {
  const pill = $('#recPill'), dot = $('#syncDot');
  tracker.subscribe((st) => {
    pill.hidden = !st.active;
    if (st.active) $('#recTxt').textContent = `${st.paused ? 'Pauza' : 'Nahrávám'} ${fmtClock(tracker.elapsed())} · ${fmtKm(tracker.distance())}`;
  });
  const labels = { connecting: 'Připojuji…', online: 'Sdílení v rodině je aktivní', offline: 'Offline – odešle se později', error: '' };
  sync.onStatus((s) => {
    dot.hidden = s.status === 'off';
    dot.className = 'sync-dot s-' + s.status;
    dot.title = s.msg || labels[s.status] || '';
    dot.setAttribute('aria-label', dot.title);
  });
  dot.onclick = () => toast(dot.title || 'Sdílení');
}

// ---------- Úvodní nastavení (poprvé) ----------
function welcome() {
  if (localStorage.getItem('cipisek.welcome')) return;
  const meta = store.getMeta();
  const s = openSheet({
    title: 'Vítej v deníku',
    body: html`<form class="form" id="wf">
      <p class="muted">Zkontroluj údaje o štěněti. Datum narození jsem dopočítal z věku „2 měsíce a 22 dní“ – oprav ho na přesné, ať jsou fáze výchovy a termíny správně.</p>
      ${field({ label: 'Jméno psa', name: 'name', value: meta.name, attrs: 'required maxlength="40"' })}
      ${field({ label: 'Datum narození', name: 'birthDate', type: 'date', value: meta.birthDate, attrs: `required max="${todayISO()}"` })}
      ${field({ label: 'Kdo jsi? (uvidí to ostatní v rodině)', name: 'who', value: store.getSettings().who, attrs: 'maxlength="30" placeholder="např. Honza"' })}
      <button class="btn primary block" type="submit">Začít</button></form>`,
    onClose: () => localStorage.setItem('cipisek.welcome', '1'),
  });
  s.$('#wf').onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    store.setMeta({ name: f.name.trim() || 'Cipísek', birthDate: f.birthDate });
    store.setSettings({ who: f.who.trim() });
    s.close();
    current?.refresh?.();
  };
}

// ---------- Pozvánka přes odkaz (#join=…) ----------
function handleJoin() {
  if (!location.hash.startsWith('#join=')) return false;
  const inv = sync.parseInvite(location.hash);
  history.replaceState(null, '', location.pathname + location.search + '#/dnes');
  if (!inv) { toast('Pozvánka je poškozená nebo neúplná.'); return false; }
  localStorage.setItem('cipisek.welcome', '1');
  const s = openSheet({
    title: 'Připojit k rodině',
    body: html`<form class="form" id="jf">
      <p>Chceš sdílet deník${inv.n ? html` psa <strong>${inv.n}</strong>` : ''} s ostatními z rodiny? Data se budou ukládat do sdílené databáze a všem se budou zobrazovat stejná.</p>
      ${field({ label: 'Kdo jsi?', name: 'who', value: store.getSettings().who, attrs: 'maxlength="30" placeholder="např. Máma" required' })}
      <button class="btn primary block" type="submit">Připojit</button></form>`,
  });
  s.$('#jf').onsubmit = async (e) => {
    e.preventDefault();
    store.setSettings({ who: readForm(e.target).who.trim(), firebaseConfig: inv.c, familyCode: inv.k, syncOn: true });
    s.close();
    await sync.start();
    toast('Připojeno. Data se za chvíli načtou.');
  };
  return true;
}

// ---------- PWA ----------
function initPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__installEvt = e;
    dispatchEvent(new Event('cipisek:installable'));
  });
  addEventListener('appinstalled', () => { window.__installEvt = null; toast('Aplikace je nainstalovaná.'); });

  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Je tu nová verze aplikace.', { label: 'Obnovit', ms: 20000, onClick: () => nw.postMessage('SKIP_WAITING') });
        }
      });
    });
  }).catch((e) => console.warn('Service worker se nezaregistroval', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// ---------- Start ----------
buildChrome();
initIndicators();
initPwa();
const joining = handleJoin();
addEventListener('hashchange', route);
await route();
if (!joining) welcome();
sync.start();
