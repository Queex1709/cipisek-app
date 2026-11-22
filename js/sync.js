/* sync.js – volitelné sdílení v rodině přes Firebase Firestore.

   Princip: aplikace je „local-first“ – všechno funguje offline z localStorage/IndexedDB.
   Pokud je v Nastavení vložená konfigurace Firebase a rodinný kód, každý změněný záznam se
   navíc zapíše do  families/{kód}/records/{kolekce}__{id}  a změny od ostatních se
   slučují zpět (pravidlo „poslední zápis vyhrává“ podle updatedAt).
   Fotky jsou zvlášť v families/{kód}/photos/{id} a stahují se až podle potřeby.

   Firebase SDK (compat) je přibalené ve vendor/firebase a načítá se jen při zapnutém sdílení. */
import * as store from './store.js';
import * as photodb from './photodb.js';

let db = null, famRef = null, unsub = null, unsubStore = null;
let state = { status: 'off', msg: '' };
const listeners = new Set();

export const getStatus = () => state;
export const onStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
function setStatus(status, msg = '') { state = { status, msg }; listeners.forEach((f) => f(state)); }

const clean = (o) => JSON.parse(JSON.stringify(o));
const recDoc = (col, rec) => clean({ col, id: rec.id, rec, updatedAt: rec.updatedAt || 0 });

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Nepodařilo se načíst ' + src));
    document.head.append(s);
  });
}
async function loadFirebase() {
  if (window.firebase?.firestore && window.firebase?.auth) return;
  await loadScript('vendor/firebase/firebase-app-compat.js');
  await Promise.all([loadScript('vendor/firebase/firebase-auth-compat.js'), loadScript('vendor/firebase/firebase-firestore-compat.js')]);
}

function friendly(e) {
  const c = e?.code || '';
  if (c.includes('operation-not-allowed') || c.includes('admin-restricted')) return 'V konzoli Firebase zapni Authentication → Anonymous.';
  if (c.includes('permission-denied')) return 'Firestore odmítl přístup. Zkontroluj pravidla (viz README).';
  if (c.includes('invalid-api-key') || c.includes('api-key-not-valid')) return 'Neplatný apiKey v konfiguraci Firebase.';
  if (c.includes('unavailable') || c.includes('network')) return 'Bez připojení – změny se odešlou později.';
  return e?.message || 'Neznámá chyba synchronizace.';
}

/** Spustí (nebo vypne) synchronizaci podle uloženého nastavení. */
export async function start() {
  const s = store.getSettings();
  stop();
  if (!s.syncOn || !s.firebaseConfig || !s.familyCode) { setStatus('off'); return; }
  setStatus('connecting');
  try {
    await loadFirebase();
    const fb = window.firebase;
    if (!fb.apps.length) fb.initializeApp(s.firebaseConfig);
    await fb.auth().signInAnonymously();
    db = fb.firestore();
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch { /* už zapnuto nebo nepodporováno */ }
    famRef = db.collection('families').doc(s.familyCode);

    let reconciled = false;
    unsub = famRef.collection('records').onSnapshot(
      (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
          applyRemote(ch.doc.data());
        });
        if (!reconciled && !snap.metadata.fromCache) { reconciled = true; reconcile(snap).catch((e) => setStatus('error', friendly(e))); }
        setStatus(snap.metadata.fromCache ? 'offline' : 'online');
      },
      (e) => setStatus('error', friendly(e)),
    );
    unsubStore = store.subscribe(onLocalChange);
  } catch (e) {
    console.error(e);
    setStatus('error', friendly(e));
  }
}
export function stop() {
  unsub?.(); unsub = null;
  unsubStore?.(); unsubStore = null;
  famRef = null;
  setStatus('off');
}

function onLocalChange(ev) {
  if (ev.origin !== 'local' || !famRef) return;
  if (ev.type === 'put' || ev.type === 'del') pushRecord(ev.col, ev.rec);
  else if (ev.type === 'meta') pushRecord('meta', store.getMeta());
  else if (ev.type === 'import') start();
}

export function pushRecord(col, rec) {
  if (!famRef) return;
  famRef.collection('records').doc(`${col}__${rec.id}`).set(recDoc(col, rec)).catch((e) => setStatus('error', friendly(e)));
}

function applyRemote(d) {
  if (!d?.rec) return;
  if (d.col === 'meta') { store.mergeRemoteMeta(d.rec); return; }
  const changed = store.mergeRemote(d.col, d.rec);
  if (!changed || d.col !== 'growth') return;
  if (d.rec.deletedAt) photodb.removePhoto(d.rec.id).catch(() => {});
  else if (d.rec.hasPhoto) ensurePhoto(d.rec.id);
}

/** První spojení: nahraje všechno, co je lokálně novější nebo na serveru chybí. */
async function reconcile(snap) {
  const remote = new Map();
  snap.docs.forEach((d) => remote.set(d.id, d.data().updatedAt || 0));
  const writes = [];
  const meta = store.getMeta();
  if ((meta.updatedAt || 0) > (remote.get('meta__dog') || 0)) writes.push(['meta', meta]);
  for (const col of store.COLS) {
    for (const rec of store.allRaw(col)) {
      if ((rec.updatedAt || 0) > (remote.get(`${col}__${rec.id}`) || 0)) writes.push([col, rec]);
    }
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(([col, rec]) => batch.set(famRef.collection('records').doc(`${col}__${rec.id}`), recDoc(col, rec)));
    await batch.commit();
  }
  for (const g of store.list('growth')) {
    if (g.hasPhoto) { pushPhoto(g.id).catch(() => {}); ensurePhoto(g.id); }
  }
}

// ---------- Fotky ----------
export async function pushPhoto(id) {
  if (!famRef) return;
  const s = store.getSettings();
  if (s.pushedPhotos.includes(id)) return;
  const p = await photodb.loadPhoto(id);
  if (!p) return;
  const img = await photodb.blobToDataURL(p.img);
  await famRef.collection('photos').doc(id).set({ id, img, updatedAt: Date.now() });
  store.setSettings({ pushedPhotos: [...store.getSettings().pushedPhotos, id] });
}

const retries = new Map();
export async function ensurePhoto(id, attempt = 0) {
  if (!famRef || (await photodb.hasPhoto(id))) return;
  try {
    const doc = await famRef.collection('photos').doc(id).get();
    if (!doc.exists) {
      // druhé zařízení ještě fotku nenahrálo – zkusíme to za chvíli znovu
      if (attempt < 4 && !retries.has(id)) {
        retries.set(id, setTimeout(() => { retries.delete(id); ensurePhoto(id, attempt + 1); }, 6000 * (attempt + 1)));
      }
      return;
    }
    const img = await photodb.dataURLToBlob(doc.data().img);
    const thumb = await photodb.thumbFromBlob(img);
    await photodb.savePhoto(id, img, thumb);
    window.dispatchEvent(new CustomEvent('cipisek:photo', { detail: id }));
  } catch (e) { console.warn('Fotku se nepodařilo stáhnout', id, e); }
}

// ---------- Pozvánka pro další členy rodiny ----------
const b64e = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
export function inviteLink() {
  const s = store.getSettings();
  if (!s.firebaseConfig || !s.familyCode) return null;
  const base = location.origin + location.pathname;
  return `${base}#join=${b64e({ c: s.firebaseConfig, k: s.familyCode, n: store.getMeta().name })}`;
}
export function parseInvite(hash) {
  try { const o = b64d(hash.replace(/^#join=/, '')); return o.c && o.k ? o : null; } catch { return null; }
}
export function randomCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return [...a].map((n) => abc[n % abc.length]).join('');
}
