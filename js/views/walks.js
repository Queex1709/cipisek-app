/* views/walks.js – procházky: satelitní mapa (Leaflet), kreslení trasy s přichycením na cesty (OSRM, pěšky),
   živé nahrávání přes GPS, uložené procházky a odkaz do Google Map. */
import * as store from '../store.js';
import * as tracker from '../tracker.js';
import {
  html, raw, $, todayISO, fmtDate, fmtShort, fmtKm, fmtMin, fmtClock, pathLength, thin, sample,
  encodePath, decodePath, ageParts, parseNum, plural,
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, field, textarea, readForm } from '../ui.js';

// ---------- Leaflet se načítá až na záložce Procházky ----------
let leafletP;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return (leafletP ??= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css';
    const js = document.createElement('script');
    js.src = 'vendor/leaflet/leaflet.js';
    let n = 0;
    const done = () => { if (++n === 2) res(); };
    css.onload = done; js.onload = done;
    css.onerror = js.onerror = () => { leafletP = null; rej(new Error('Mapu se nepodařilo načíst')); };
    document.head.append(css, js);
  }));
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const LAYERS = {
  'sat-labels': { name: 'Satelit s popisky', make: (L) => L.layerGroup([
    L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 18, maxZoom: 20, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 17, maxZoom: 20, opacity: 0.85 }),
    L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 17, maxZoom: 20 }),
  ]) },
  sat: { name: 'Satelit', make: (L) => L.layerGroup([
    L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 18, maxZoom: 20, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' }),
  ]) },
  osm: { name: 'Mapa', make: (L) => L.layerGroup([
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20, attribution: '&copy; přispěvatelé OpenStreetMap' }),
  ]) },
};
const LAYER_KEYS = Object.keys(LAYERS);

const ROUTE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const VIEW_KEY = 'cipisek.mapview';

// ---------- stav ----------
let root = null, map = null, L = null;
let mode = 'draw';
let snap = true;
let draft = { wps: [], segs: [], flags: [] };   // segs[i] = úsek končící v wps[i]; segs[0] = [wps[0]]
let busy = false;
let lastWarn = 0;
let baseLayer = null, layerKey = 'sat-labels';
let draftLayer, markerLayer, viewLayer, recLayer, recLine, curMarker, meLayer;
let unsubTracker = null, lastKey = '';
let follow = true;
let onResize = null;

export async function render(r) {
  root = r;
  // zkratka z plochy: #/prochazky?q=start spustí nahrávání, q=stop ho ukončí
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q');
  if (q) history.replaceState(null, '', location.pathname + location.search + '#/prochazky');
  if (q === 'start' || q === 'toggle') mode = 'rec';
  mode = tracker.isActive() ? 'rec' : mode;
  root.innerHTML = String(html`
    <header class="page-head"><h1>Procházky</h1></header>
    <div class="seg" role="tablist">
      <button role="tab" class="${mode === 'draw' ? 'on' : ''}" aria-selected="${mode === 'draw'}" data-mode="draw">${icon('route', 18)} Kreslit trasu</button>
      <button role="tab" class="${mode === 'rec' ? 'on' : ''}" aria-selected="${mode === 'rec'}" data-mode="rec">${icon('locate', 18)} Nahrávat GPS</button>
    </div>
    <div class="mapwrap">
      <div id="map" class="map" aria-label="Mapa"></div>
      <div class="map-btns">
        <button class="map-btn" data-layer aria-label="Přepnout podklad mapy">${icon('layers', 20)}</button>
        <button class="map-btn" data-locate aria-label="Moje poloha">${icon('locate', 20)}</button>
        <button class="map-btn" id="hideView" data-hide aria-label="Skrýt zobrazenou trasu" hidden>${icon('x', 20)}</button>
      </div>
      <div class="map-status" id="mstat" hidden></div>
    </div>
    <section class="card panel" id="panel"></section>
    <h2 class="sec">Uložené procházky</h2>
    <div id="walklist"></div>`);
  root.onclick = onClick;
  root.onchange = onChange;
  drawPanel();
  drawList();
  try {
    await loadLeaflet();
  } catch (e) {
    $('#map', root).innerHTML = '<p class="map-err">Mapa se nenačetla. Zkontroluj připojení k internetu a zkus to znovu.</p>';
    return;
  }
  if (!root) return;
  initMap();
  // toggle = jedna ikona na ploše: nahrávání zapne, a když už běží, ukončí ho
  if ((q === 'start' || q === 'toggle') && !tracker.isActive()) { if (!(q === 'toggle' && tracker.hasRecovery())) startRec(); }
  else if ((q === 'stop' || q === 'toggle') && tracker.isActive()) stopRec();
}

export function refresh() {
  if (!root) return;
  drawPanel();
  drawList();
}

export function destroy() {
  unsubTracker?.(); unsubTracker = null;
  if (onResize) removeEventListener('resize', onResize);
  onResize = null;
  try { map?.remove(); } catch { /* nic */ }
  map = null;
  if (root) { root.onclick = null; root.onchange = null; }
  root = null; busy = false; lastKey = '';
}

// ---------- mapa ----------
function initMap() {
  L = window.L;
  let view = { c: [49.75, 15.5], z: 7 };
  let restored = false;
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY));
    if (v?.c) { view = v; restored = true; }
  } catch { /* nic */ }
  if (!restored) {
    const last = store.list('walks').sort((a, b) => b.createdAt - a.createdAt)[0];
    const p = last && decodePath(last.path)[0];
    if (p) view = { c: p, z: 15 };
  }

  map = L.map('map', { zoomControl: false, attributionControl: true, tap: true }).setView(view.c, view.z);
  L.control.zoom({ position: 'topleft' }).addTo(map);
  map.attributionControl.setPrefix(false);
  layerKey = LAYERS[store.getSettings().mapLayer] ? store.getSettings().mapLayer : 'sat-labels';
  baseLayer = LAYERS[layerKey].make(L).addTo(map);

  viewLayer = L.layerGroup().addTo(map);
  draftLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  recLayer = L.layerGroup().addTo(map);
  meLayer = L.layerGroup().addTo(map);

  map.on('click', (e) => { if (mode === 'draw') addPoint(e.latlng); });
  map.on('dragstart', () => { follow = false; });
  map.on('moveend', () => {
    const c = map.getCenter();
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ c: [c.lat, c.lng], z: map.getZoom() })); } catch { /* nic */ }
  });
  onResize = () => map?.invalidateSize();
  addEventListener('resize', onResize);
  setTimeout(() => map?.invalidateSize(), 60);

  drawDraft();
  unsubTracker = tracker.subscribe(onTrack);
  onTrack(tracker.get());
  // úplně první otevření: přehled celé republiky je k ničemu, přibliž se na polohu uživatele
  if (!restored && !store.list('walks').length && !tracker.isActive()) locateMe();
}

const dotIcon = (kind) => L.divIcon({ className: `wp wp-${kind}`, iconSize: [18, 18], iconAnchor: [9, 9] });

function casedLine(group, pts, color) {
  L.polyline(pts, { color: '#000', weight: 9, opacity: 0.35, lineJoin: 'round' }).addTo(group);
  return L.polyline(pts, { color, weight: 5, opacity: 0.95, lineJoin: 'round' }).addTo(group);
}

// ---------- kreslení trasy ----------
const draftPts = () => draft.segs.flat();
const pace = () => store.getSettings().paceKmh || 3;
const estMinutes = (m) => Math.max(1, Math.round(m / ((pace() * 1000) / 60)));
function recommended() {
  const a = ageParts(store.getMeta().birthDate);
  return Math.min(90, Math.max(5, Math.round((5 * a.decimalMonths) / 5) * 5));
}

async function routeLeg(a, b) {
  if (!snap) return { pts: [a, b], snapped: false };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(`${ROUTE_URL}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('bez trasy');
    return { pts: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), snapped: true };
  } catch (e) {
    return { pts: [a, b], snapped: false, failed: true };
  } finally { clearTimeout(timer); }
}

function setStatus(t) {
  const el = $('#mstat', root);
  if (!el) return;
  el.hidden = !t;
  el.textContent = t || '';
}

async function addPoint(ll) {
  if (busy || !root) return;
  const pt = [ll.lat, ll.lng];
  if (!draft.wps.length) {
    draft.wps.push(pt); draft.segs.push([pt]); draft.flags.push(true);
    drawDraft();
    return;
  }
  busy = true;
  setStatus('Hledám cestu…');
  const leg = await routeLeg(draft.wps[draft.wps.length - 1], pt);
  busy = false;
  if (!root) return;
  setStatus('');
  if (leg.failed && Date.now() - lastWarn > 20000) {
    lastWarn = Date.now();
    toast('Přichycení na cestu se nepodařilo, použila se přímá čára. Zkontroluj připojení.');
  }
  draft.wps.push(leg.pts[leg.pts.length - 1]);
  draft.segs.push(leg.pts);
  draft.flags.push(leg.snapped);
  drawDraft();
}

function undoPoint() {
  if (busy || !draft.wps.length) return;
  draft.wps.pop(); draft.segs.pop(); draft.flags.pop();
  drawDraft();
}
function clearDraft() {
  if (busy) return;
  draft = { wps: [], segs: [], flags: [] };
  drawDraft();
}

function drawDraft() {
  if (map) {
    draftLayer.clearLayers();
    markerLayer.clearLayers();
    const all = draftPts();
    if (all.length > 1) casedLine(draftLayer, all, '#ffcf33');
    const last = draft.wps.length - 1;
    draft.wps.forEach((p, i) => {
      const kind = i === 0 ? 'start' : i === last ? 'end' : 'mid';
      L.marker(p, { icon: dotIcon(kind), interactive: false, keyboard: false }).addTo(markerLayer);
    });
  }
  if (mode === 'draw') drawPanel();
}

// ---------- panel pod mapou ----------
function drawPanel() {
  const el = $('#panel', root);
  if (!el) return;
  el.innerHTML = String(mode === 'draw' ? drawPanelHtml() : recPanelHtml());
}

function drawPanelHtml() {
  const n = draft.wps.length;
  const m = pathLength(draftPts());
  const min = estMinutes(m);
  const rec = recommended();
  const tooLong = n > 1 && min > rec * 1.5;
  const noRoute = n < 2 ? raw('disabled') : '';
  return html`
    <div class="stats">
      <div><b>${fmtKm(m)}</b><span>délka</span></div>
      <div><b>${n > 1 ? fmtMin(min) : '–'}</b><span>odhad času</span></div>
      <div><b>${n}</b><span>${plural(n, 'bod', 'body', 'bodů')}</span></div>
    </div>
    ${n === 0 ? html`<p class="hint">Klepej na mapu a označ trasu. Každý úsek se sám přichytí na nejbližší cestu nebo stezku.</p>` : ''}
    ${tooLong ? html`<p class="warn">Na Cipíska je to dlouhé. V tomhle věku zhruba ${rec} min v kuse. Zkrať trasu nebo dej pauzy.</p>`
              : html`<p class="muted small">Odhad při tempu ${pace()} km/h (změníš v Nastavení). Pro ${store.getMeta().name} zhruba ${rec} min v kuse (5 min za měsíc věku).</p>`}
    <label class="switch"><input type="checkbox" id="snap" ${snap ? raw('checked') : ''}><span>Přichytávat na cesty a stezky</span></label>
    <div class="btn-row">
      <button class="btn ghost" data-undo ${n < 1 ? raw('disabled') : ''}>${icon('undo', 18)} Zpět</button>
      <button class="btn ghost" data-clear ${n < 1 ? raw('disabled') : ''}>${icon('trash', 18)} Vymazat</button>
    </div>
    <div class="btn-row">
      <button class="btn primary" data-save ${noRoute}>${icon('check', 18)} Uložit procházku</button>
      <button class="btn ghost" data-gmaps-draft ${noRoute}>${icon('external', 18)} Mapy</button>
    </div>`;
}

function recPanelHtml() {
  const st = tracker.get();
  if (!st.active) {
    const rc = tracker.hasRecovery() ? tracker.recoveryInfo() : null;
    return html`
      <p>Nahrávání zaznamená skutečnou cestu přes GPS. Při nahrávání nech aplikaci otevřenou, displej se snaží držet zapnutý.</p>
      ${rc ? html`<div class="notice-inline"><span>Přerušené nahrávání: ${fmtKm(rc.meters)}</span>
        <button class="btn small" data-recover>Obnovit</button><button class="btn small ghost" data-discard>Zahodit</button></div>` : ''}
      <button class="btn primary block" data-start>${icon('play', 20)} Začít nahrávat</button>`;
  }
  return html`
    <div class="stats">
      <div><b id="r-time">${fmtClock(tracker.elapsed())}</b><span>čas</span></div>
      <div><b id="r-km">${fmtKm(tracker.distance())}</b><span>vzdálenost</span></div>
      <div><b id="r-acc">${st.acc != null ? '±' + Math.round(st.acc) + ' m' : '–'}</b><span>přesnost GPS</span></div>
    </div>
    <p class="warn" id="r-warn" ${st.warn ? '' : raw('hidden')}>${st.warn}</p>
    <div class="btn-row">
      ${st.paused ? html`<button class="btn primary" data-resume>${icon('play', 18)} Pokračovat</button>`
                  : html`<button class="btn ghost" data-pause>${icon('pause', 18)} Pauza</button>`}
      <button class="btn danger" data-stop>${icon('stop', 18)} Ukončit</button>
    </div>`;
}

// ---------- živé nahrávání ----------
function onTrack(st) {
  if (!root) return;
  const key = `${st.active}|${st.paused}`;
  if (key !== lastKey) {
    lastKey = key;
    if (mode === 'rec') drawPanel();
  }
  if (map) {
    recLayer.clearLayers();
    if (st.active && st.pts.length > 1) casedLine(recLayer, st.pts, '#ff5a36');
    if (st.active && st.cur) {
      L.marker(st.cur, { icon: L.divIcon({ className: 'me-dot', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false }).addTo(recLayer);
      if (follow && !st.paused) map.panTo(st.cur, { animate: true });
    }
  }
  if (mode === 'rec' && st.active) {
    const set = (id, v) => { const e = $(id, root); if (e) e.textContent = v; };
    set('#r-time', fmtClock(tracker.elapsed()));
    set('#r-km', fmtKm(tracker.distance()));
    set('#r-acc', st.acc != null ? '±' + Math.round(st.acc) + ' m' : '–');
    const w = $('#r-warn', root);
    if (w) { w.hidden = !st.warn; w.textContent = st.warn; }
  }
}

function startRec() {
  try { tracker.start(); follow = true; } catch (e) { toast(e.message); return; }
  toast('Nahrávám trasu. Dobrou procházku!');
}

function stopRec() {
  const r = tracker.stop();
  if (r.pts.length < 2 || r.meters < 20) { toast('Trasa je příliš krátká, neuložilo se nic.'); drawPanel(); return; }
  saveSheet({ pts: r.pts, meters: r.meters, minutes: Math.max(1, Math.round(r.minutes)), src: 'gps', snapped: false });
}

// ---------- uložení procházky ----------
function saveSheet({ pts, meters, minutes, src, snapped }) {
  let saved = false;
  const s = openSheet({
    title: 'Uložit procházku',
    onClose: () => {
      if (saved) return;
      if (src === 'gps') toast('Trasa nebyla uložena.', { label: 'Uložit', ms: 12000, onClick: () => saveSheet({ pts, meters, minutes, src, snapped }) });
    },
    body: html`<form class="form" id="wf">
      <div class="stats compact"><div><b>${fmtKm(meters)}</b><span>délka</span></div><div><b>${fmtMin(minutes)}</b><span>${src === 'gps' ? 'skutečný čas' : 'odhad času'}</span></div></div>
      ${field({ label: 'Název', name: 'name', value: `Procházka ${fmtShort(todayISO())}`, attrs: 'required maxlength="60"' })}
      <div class="row2">
        ${field({ label: 'Datum', name: 'date', type: 'date', value: todayISO(), attrs: `required max="${todayISO()}"` })}
        ${field({ label: 'Čas (min)', name: 'minutes', type: 'number', value: minutes, attrs: 'min="1" max="600" inputmode="numeric" required' })}
      </div>
      ${textarea({ label: 'Poznámka', name: 'note', attrs: 'maxlength="500" placeholder="Jak to šlo, co potkal, jak byl unavený…"' })}
      <button class="btn primary block" type="submit">Uložit</button></form>`,
  });
  s.$('#wf').onsubmit = (e) => {
    e.preventDefault();
    const f = readForm(e.target);
    const rec = store.put('walks', {
      name: f.name.trim(), date: f.date, note: f.note.trim(),
      meters: Math.round(meters), minutes: Math.round(parseNum(f.minutes)) || minutes,
      src, snapped, path: encodePath(thin(pts, 3)),
    });
    saved = true;
    if (src === 'draw') clearDraft();
    s.close();
    drawList();
    drawPanel();
    showWalk(rec.id);
    toast('Procházka uložena.');
  };
}

// ---------- uložené procházky ----------
function drawList() {
  const el = $('#walklist', root);
  if (!el) return;
  const walks = store.list('walks').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (!walks.length) {
    el.innerHTML = '<p class="empty">Zatím žádná procházka. Nakresli trasu na mapě nebo ji nahraj přes GPS.</p>';
    return;
  }
  const total = walks.reduce((a, w) => a + (w.meters || 0), 0);
  el.innerHTML = String(html`
    <p class="muted small">${walks.length} ${plural(walks.length, 'procházka', 'procházky', 'procházek')} · celkem ${fmtKm(total)}</p>
    ${walks.map((w) => html`<article class="card walk">
      <div class="walk-top"><div><h3>${w.name}</h3><p class="muted small">${fmtDate(w.date)}${w.by ? ` · ${w.by}` : ''}</p></div>
        <span class="chip">${w.src === 'gps' ? 'GPS' : 'kreslená'}</span></div>
      <div class="chips"><span class="chip strong">${fmtKm(w.meters || 0)}</span>${w.minutes ? html`<span class="chip">${fmtMin(w.minutes)}</span>` : ''}</div>
      ${w.note ? html`<p class="walk-note">${w.note}</p>` : ''}
      <div class="btn-row">
        <button class="btn primary small" data-show="${w.id}">${icon('map', 16)} Na mapě</button>
        <button class="btn ghost small" data-gmaps="${w.id}">${icon('external', 16)} Google Mapy</button>
        <button class="icon-btn" data-delwalk="${w.id}" aria-label="Smazat procházku">${icon('trash', 18)}</button>
      </div></article>`)}`);
}

function showWalk(id) {
  const w = store.get('walks', id);
  if (!w || !map) return;
  const pts = decodePath(w.path);
  viewLayer.clearLayers();
  if (pts.length < 2) return;
  casedLine(viewLayer, pts, '#3be3ff');
  L.marker(pts[0], { icon: dotIcon('start'), interactive: false, keyboard: false }).addTo(viewLayer);
  L.marker(pts[pts.length - 1], { icon: dotIcon('end'), interactive: false, keyboard: false }).addTo(viewLayer);
  follow = false;
  map.invalidateSize();
  map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 18 });
  $('#hideView', root).hidden = false;
  $('.mapwrap', root).scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function hideWalk() {
  viewLayer?.clearLayers();
  const b = $('#hideView', root);
  if (b) b.hidden = true;
}

function gmapsUrl(pts) {
  const s = sample(pts, 10);
  const f = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  let u = `https://www.google.com/maps/dir/?api=1&origin=${f(s[0])}&destination=${f(s[s.length - 1])}&travelmode=walking`;
  const mid = s.slice(1, -1);
  if (mid.length) u += '&waypoints=' + mid.map(f).join('%7C');
  return u;
}
const openMaps = (pts) => window.open(gmapsUrl(pts), '_blank', 'noopener');

// ---------- poloha ----------
function locateMe() {
  if (!('geolocation' in navigator)) { toast('Toto zařízení neumí zjistit polohu.'); return; }
  toast('Hledám tvoji polohu…', { ms: 1800 });
  navigator.geolocation.getCurrentPosition((p) => {
    if (!map) return;
    const ll = [p.coords.latitude, p.coords.longitude];
    follow = true;
    map.setView(ll, Math.max(map.getZoom(), 16));
    meLayer.clearLayers();
    L.circle(ll, { radius: p.coords.accuracy, color: '#3b82f6', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(meLayer);
    L.marker(ll, { icon: L.divIcon({ className: 'me-dot', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false }).addTo(meLayer);
  }, (err) => {
    toast(err.code === 1 ? 'Poloha není povolená. Povol ji v nastavení prohlížeče nebo telefonu.' : 'Polohu se nepodařilo zjistit.');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}

function cycleLayer() {
  if (!map) return;
  map.removeLayer(baseLayer);
  layerKey = LAYER_KEYS[(LAYER_KEYS.indexOf(layerKey) + 1) % LAYER_KEYS.length];
  baseLayer = LAYERS[layerKey].make(L).addTo(map);
  baseLayer.eachLayer((l) => l.bringToBack?.());
  store.setSettings({ mapLayer: layerKey });
  toast(LAYERS[layerKey].name, { ms: 1500 });
}

// ---------- události ----------
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-mode]'))) {
    mode = el.dataset.mode;
    root.querySelectorAll('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    drawPanel();
    return;
  }
  if (t.closest('[data-layer]')) return cycleLayer();
  if (t.closest('[data-locate]')) return locateMe();
  if (t.closest('[data-hide]')) return hideWalk();
  if (t.closest('[data-undo]')) return undoPoint();
  if (t.closest('[data-clear]')) return clearDraft();
  if (t.closest('[data-save]')) {
    const pts = draftPts();
    if (pts.length < 2) return;
    const m = pathLength(pts);
    return saveSheet({ pts, meters: m, minutes: estMinutes(m), src: 'draw', snapped: draft.flags.slice(1).every(Boolean) });
  }
  if (t.closest('[data-gmaps-draft]')) return openMaps(draftPts());
  if (t.closest('[data-start]')) return startRec();
  if (t.closest('[data-pause]')) return tracker.pause();
  if (t.closest('[data-resume]')) return tracker.resume();
  if (t.closest('[data-stop]')) return stopRec();
  if (t.closest('[data-recover]')) { tracker.recover(); follow = true; return; }
  if (t.closest('[data-discard]')) { tracker.discardRecovery(); drawPanel(); return; }
  if ((el = t.closest('[data-show]'))) return showWalk(el.dataset.show);
  if ((el = t.closest('[data-gmaps]'))) {
    const w = store.get('walks', el.dataset.gmaps);
    if (w) openMaps(decodePath(w.path));
    return;
  }
  if ((el = t.closest('[data-delwalk]'))) {
    const w = store.get('walks', el.dataset.delwalk);
    if (!w) return;
    confirmDialog({ title: 'Smazat procházku?', text: `„${w.name}“ (${fmtKm(w.meters || 0)}) se smaže všem v rodině.`, ok: 'Smazat', danger: true }).then((ok) => {
      if (!ok) return;
      store.del('walks', w.id);
      hideWalk();
      drawList();
    });
  }
}

function onChange(e) {
  if (e.target.id === 'snap') snap = e.target.checked;
}
