/* app.js – spouštěč: router (hash), horní lišta, spodní navigace, úvodní nastavení, PWA. */
import * as store from './store.js';
import * as sync from './sync.js';
import * as tracker from './tracker.js';
import { seedDefaults, startReminders } from './tasks.js';
import { openHelp } from './help.js';
import { applyAccent } from './accent.js';
import { showUpdateBar, setRegistration, checkForUpdate } from './update.js';
import { $, $$, html, debounce, todayISO, fmtClock, fmtKm } from './util.js';
import { icon, toast, openSheet, hasOpenSheet, field, readForm } from './ui.js';

const ROUTES = {
  dnes: () => import('./views/today.js'),
  prochazky: () => import('./views/walks.js'),
  vychova: () => import('./views/training.js'),
  rust: () => import('./views/growth.js'),
  jidlo: () => import('./views/food.js'),
  zdravi: () => import('./views/health.js'),
  nastaveni: () => import('./views/settings.js'),
};
const NAV = [
  ['dnes', 'Dnes', 'home'], ['prochazky', 'Procházky', 'map'], ['vychova', 'Výchova', 'award'],
  ['jidlo', 'Jídlo', 'bowl'], ['rust', 'Růst', 'camera'], ['zdravi', 'Zdraví', 'heart'],
];

let current = null;
let navToken = 0;

// ---------- Kostra ----------
function buildChrome() {
  $('#nav').innerHTML = NAV.map(([id, label, ic]) =>
    `<a href="#/${id}" data-route="${id}">${icon(ic, 24)}<span>${label}</span></a>`).join('');
  $('#logo').innerHTML = String(icon('paw', 26));
  $('#gear').innerHTML = String(icon('gear', 22));
  $('#help').innerHTML = String(icon('info', 22));
  $('#help').onclick = openHelp;
  updateBrand();
}
function updateBrand() { $('#brand-name').textContent = store.getMeta().name || 'Cipísek'; }

/** Krátká animace vstupu stránky nebo záložky (vypne se u zařízení se sníženým pohybem). */
function playEnter(el, cls, dir = 0) {
  el.classList.remove('enter', 'enter-soft');
  el.dataset.dir = dir > 0 ? 'r' : dir < 0 ? 'l' : '';
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 450);
}
const ORDER = ['dnes', 'prochazky', 'vychova', 'jidlo', 'rust', 'zdravi', 'nastaveni'];
let prevRoute = null;
document.addEventListener('click', (e) => {
  if (e.target.closest('.seg [data-tab]')) setTimeout(() => playEnter($('#view'), 'enter-soft'), 0);
});

/** Skryje úvodní animaci (nejdřív po 800 ms, ať se stihne ukázat). */
function hideBoot() {
  const b = document.getElementById('boot');
  if (!b) return;
  const wait = Math.max(0, 800 - performance.now());
  setTimeout(() => { b.classList.add('done'); setTimeout(() => b.remove(), 500); }, wait);
}

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
  root.innerHTML = '<div class="loader" role="status" aria-label="Načítám"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="16" rx="4.6" ry="3.8"/><ellipse cx="5.6" cy="11" rx="1.9" ry="2.5"/><ellipse cx="9.4" cy="6.8" rx="2" ry="2.7"/><ellipse cx="14.6" cy="6.8" rx="2" ry="2.7"/><ellipse cx="18.4" cy="11" rx="1.9" ry="2.5"/></svg></div>';
  root.className = 'view view-' + (ROUTES[name] ? name : 'dnes');
  window.scrollTo(0, 0);
  await mod.render(root);
  const ni = ORDER.indexOf(ROUTES[name] ? name : 'dnes'), pi = ORDER.indexOf(prevRoute);
  playEnter(root, 'enter', prevRoute && pi >= 0 ? Math.sign(ni - pi) : 0);
  prevRoute = ROUTES[name] ? name : 'dnes';
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
addEventListener('cipisek:tasks', scheduleRefresh);

// ---------- Vzhled ----------
function applyTheme() {
  const t = store.getSettings().theme;
  document.documentElement.dataset.theme = t === 'light' || t === 'dark' ? t : '';
}

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
    setRegistration(reg);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar();
      });
    });
    // při každém otevření a pak každých 30 minut se zeptáme, jestli je nová verze
    checkForUpdate();
    setInterval(checkForUpdate, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  }).catch((e) => console.warn('Service worker se nezaregistroval', e));
  // nová verze se aktivuje sama, ale stránku nepřerušujeme: ukáže se tlačítko Aktualizovat
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBar(); });
}

// ---------- Start ----------
applyTheme();
applyAccent(store.getSettings().accent);
seedDefaults();
buildChrome();
initIndicators();
initPwa();
const joining = handleJoin();
addEventListener('hashchange', route);
await route();
hideBoot();
if (!joining) welcome();
sync.start();
startReminders();
