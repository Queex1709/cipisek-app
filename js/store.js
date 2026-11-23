/* store.js – jediné místo, kde žijí data aplikace.

   Struktura (localStorage, klíč cipisek.v1):
   {
     schema: 1,
     meta:  { id:'dog', name, birthDate, sex, breed, updatedAt },
     cols:  { walks, skills, logs, growth, vet, diary, social,   // každá {id: záznam}
              tasks, tasklogs, milestones, devices, plan }
   }
   Každý záznam má id, createdAt, updatedAt, by (kdo zapsal) a při smazání deletedAt
   (tzv. „náhrobek“, aby se smazání dalo synchronizovat). Díky tomu jde později
   napojit sdílenou databázi (Firebase – viz sync.js) bez změny zbytku aplikace.

   Lokální nastavení zařízení (kdo jsem, tempo chůze, Firebase…) je zvlášť v cipisek.settings.v1
   a nesynchronizuje se. Fotky (velká data) jsou v IndexedDB – viz photodb.js. */
import { uid } from './util.js';

export const COLS = ['walks', 'skills', 'logs', 'growth', 'vet', 'diary', 'social', 'tasks', 'tasklogs', 'milestones', 'devices', 'plan', 'days'];
const KEY = 'cipisek.v1';
const SKEY = 'cipisek.settings.v1';

const DEFAULT_META = {
  id: 'dog', name: 'Cipísek', birthDate: '2026-08-31', sex: 'm',
  breed: 'Pyrenejský horský pes', chip: '', notes: '', vetName: '', vetPhone: '', updatedAt: 0,
};
const DEFAULT_SETTINGS = {
  who: '', paceKmh: 3, mapLayer: 'sat-labels', showRef: true,
  theme: 'auto', accent: 'g', notifOn: false, lastBackup: 0,
  familyCode: '', firebaseConfig: null, syncOn: false, pushedPhotos: [],
};

const subs = new Set();
let state = loadState();
let settings = loadSettings();
let saveTimer;

function blank() {
  const cols = {};
  COLS.forEach((c) => (cols[c] = {}));
  return { schema: 1, meta: { ...DEFAULT_META }, cols };
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.cols) {
      COLS.forEach((c) => (s.cols[c] ??= {}));
      s.meta = { ...DEFAULT_META, ...s.meta };
      return s;
    }
  } catch (e) { console.warn('Data se nepodařilo načíst', e); }
  return blank();
}
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SKEY)) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

function emit(ev) {
  subs.forEach((fn) => { try { fn(ev); } catch (e) { console.error(e); } });
}
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export function flush() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Uložení selhalo (plné úložiště?)', e); emit({ type: 'error', error: e }); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); }
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

// ---------- Profil psa ----------
export const getMeta = () => state.meta;
export function setMeta(patch) {
  state.meta = { ...state.meta, ...patch, updatedAt: Date.now() };
  save();
  emit({ type: 'meta', origin: 'local' });
}

// ---------- Záznamy ----------
export const list = (col) => Object.values(state.cols[col]).filter((r) => !r.deletedAt);
export const get = (col, id) => { const r = state.cols[col][id]; return r && !r.deletedAt ? r : null; };
/** Všechny záznamy včetně smazaných (pro synchronizaci). */
export const allRaw = (col) => Object.values(state.cols[col]);

/** Vloží nebo upraví záznam (sloučí s původním). Vrací uložený záznam. */
export function put(col, rec) {
  const id = rec.id || uid();
  const prev = state.cols[col][id];
  const now = Date.now();
  const r = { ...(prev && !prev.deletedAt ? prev : {}), ...rec, id };
  r.createdAt ??= now;
  r.updatedAt = now;
  r.by = settings.who || r.by || '';
  delete r.deletedAt;
  state.cols[col][id] = r;
  save();
  emit({ type: 'put', col, id, rec: r, origin: 'local' });
  return r;
}
export function del(col, id) {
  const now = Date.now();
  const rec = { id, deletedAt: now, updatedAt: now };
  state.cols[col][id] = rec;
  save();
  emit({ type: 'del', col, id, rec, origin: 'local' });
}

// ---------- Slučování ze vzdáleného zdroje (poslední zápis vyhrává) ----------
export function mergeRemote(col, rec) {
  if (!state.cols[col] || !rec || !rec.id) return false;
  const cur = state.cols[col][rec.id];
  if (cur && (cur.updatedAt || 0) >= (rec.updatedAt || 0)) return false;
  state.cols[col][rec.id] = rec;
  save();
  emit({ type: 'remote', col, id: rec.id, rec, origin: 'remote' });
  return true;
}
export function mergeRemoteMeta(rec) {
  if (!rec || (rec.updatedAt || 0) <= (state.meta.updatedAt || 0)) return false;
  state.meta = { ...DEFAULT_META, ...rec };
  save();
  emit({ type: 'meta', origin: 'remote' });
  return true;
}

// ---------- Záloha ----------
export const snapshot = () => JSON.parse(JSON.stringify(state));
export function importSnapshot(s) {
  let n = 0;
  if (s?.meta && (s.meta.updatedAt || 0) > (state.meta.updatedAt || 0)) { state.meta = { ...DEFAULT_META, ...s.meta }; n++; }
  for (const c of COLS) {
    for (const r of Object.values(s?.cols?.[c] || {})) {
      const cur = state.cols[c][r.id];
      if (!cur || (cur.updatedAt || 0) < (r.updatedAt || 0)) { state.cols[c][r.id] = r; n++; }
    }
  }
  flush();
  emit({ type: 'import', origin: 'local' });
  return n;
}
export function resetAll() {
  state = blank();
  flush();
  emit({ type: 'reset', origin: 'local' });
}

// ---------- Nastavení zařízení ----------
export const getSettings = () => settings;
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { console.error(e); }
  emit({ type: 'settings', origin: 'local' });
}
