/* tracker.js – živé nahrávání trasy přes GPS (bez DOM, přežije přepnutí záložky).
   Stav se průběžně ukládá, takže se nahrávání dá po omylném zavření obnovit. */
import { haversine, pathLength } from './util.js';

const KEY = 'cipisek.rec.v1';
const subs = new Set();
let watchId = null, wake = null, ticker = null;

const empty = () => ({ active: false, paused: false, startTs: 0, activeMs: 0, lastResume: 0, pts: [], cur: null, acc: null, warn: '' });
let st = empty();

export const get = () => st;
export const isActive = () => st.active;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((f) => f(st));

export const elapsed = () => st.activeMs + (st.active && !st.paused ? Date.now() - st.lastResume : 0);
export const distance = () => pathLength(st.pts);

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ startTs: st.startTs, activeMs: elapsed(), pts: st.pts })); } catch { /* plné úložiště */ }
}
export const hasRecovery = () => !!localStorage.getItem(KEY);
export function recoveryInfo() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    return r ? { startTs: r.startTs, pts: r.pts?.length || 0, meters: pathLength(r.pts || []) } : null;
  } catch { return null; }
}
export const discardRecovery = () => localStorage.removeItem(KEY);

/** Obnoví přerušené nahrávání (v pozastaveném stavu). */
export function recover() {
  const r = JSON.parse(localStorage.getItem(KEY));
  st = { ...empty(), active: true, paused: true, startTs: r.startTs, activeMs: r.activeMs, pts: r.pts || [], cur: (r.pts || []).slice(-1)[0] || null };
  ticker = setInterval(emit, 1000);
  emit();
}

export function start() {
  if (!('geolocation' in navigator)) throw new Error('Toto zařízení neumí GPS.');
  st = { ...empty(), active: true, startTs: Date.now(), lastResume: Date.now() };
  watch();
  ticker = setInterval(emit, 1000);
  acquireWake();
  persist();
  emit();
}
export function pause() {
  if (!st.active || st.paused) return;
  st.activeMs += Date.now() - st.lastResume;
  st.paused = true;
  unwatch();
  releaseWake();
  persist();
  emit();
}
export function resume() {
  if (!st.active || !st.paused) return;
  st.paused = false;
  st.lastResume = Date.now();
  watch();
  acquireWake();
  emit();
}
/** Ukončí nahrávání a vrátí {pts, meters, minutes}. */
export function stop() {
  const result = { pts: st.pts.slice(), meters: pathLength(st.pts), minutes: elapsed() / 60000 };
  unwatch();
  releaseWake();
  clearInterval(ticker);
  st = empty();
  discardRecovery();
  emit();
  return result;
}

function watch() {
  unwatch();
  watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}
function unwatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
function onPos(p) {
  const { latitude, longitude, accuracy } = p.coords;
  const pt = [latitude, longitude];
  st.acc = accuracy;
  st.cur = pt;
  if (st.paused) { emit(); return; }
  if (accuracy > 35) { st.warn = `Slabý signál GPS (±${Math.round(accuracy)} m)`; emit(); return; }
  st.warn = '';
  const last = st.pts[st.pts.length - 1];
  const minStep = Math.max(6, Math.min(accuracy * 0.6, 15));
  if (!last || haversine(last, pt) >= minStep) {
    st.pts.push(pt);
    if (st.pts.length % 5 === 0) persist();
  }
  emit();
}
function onErr(e) {
  st.warn = e.code === 1 ? 'Poloha není povolená. Povol ji v nastavení prohlížeče.' : 'GPS teď neodpovídá…';
  emit();
}

async function acquireWake() {
  try {
    if ('wakeLock' in navigator && !wake) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    }
  } catch { /* není podporováno nebo zamítnuto */ }
}
function releaseWake() { try { wake?.release(); } catch { /* nic */ } wake = null; }
document.addEventListener('visibilitychange', () => {
  if (st.active && !st.paused && document.visibilityState === 'visible') acquireWake();
});
