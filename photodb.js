/* photodb.js – fotky jsou v IndexedDB (localStorage má jen ~5 MB) + komprese v prohlížeči.
   Každá fotka se ukládá dvakrát: img (max 1100 px) a thumb (360 px do mřížky). */

const DB_NAME = 'cipisek-photos';
const STORE = 'photos';
let dbp;

const open = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export function savePhoto(id, img, thumb) {
  revoke(id); // zahodí starý blob: URL, kdyby se fotka nahrazovala
  return tx('readwrite', (s) => s.put({ id, img, thumb }));
}
export const loadPhoto = (id) => tx('readonly', (s) => s.get(id));
export const allPhotos = () => tx('readonly', (s) => s.getAll());
export const hasPhoto = async (id) => !!(await loadPhoto(id));
export function removePhoto(id) {
  revoke(id);
  return tx('readwrite', (s) => s.delete(id));
}
export const clearPhotos = () => { for (const k of [...urls.keys()]) revoke(k.split(':')[0]); return tx('readwrite', (s) => s.clear()); };

// ---------- object URL cache ----------
const urls = new Map();
/** Vrátí blob: URL fotky ('thumb' nebo 'img'); null, pokud fotka v zařízení není. */
export async function photoUrl(id, kind = 'thumb') {
  const k = id + ':' + kind;
  if (urls.has(k)) return urls.get(k);
  const p = await loadPhoto(id);
  if (!p) return null;
  const u = URL.createObjectURL(kind === 'thumb' ? p.thumb || p.img : p.img);
  urls.set(k, u);
  return u;
}
function revoke(id) {
  for (const k of [...urls.keys()]) {
    if (k.startsWith(id + ':')) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
  }
}

// ---------- komprese ----------
async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fallback níž */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(u); res(img); };
    img.onerror = () => rej(new Error('Fotku se nepodařilo načíst'));
    img.src = u;
  });
}
function scaleTo(src, max, q) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', q));
}

/** Zmenší fotku z foťáku/galerie na rozumnou velikost (typicky 100–250 kB). */
export async function compress(file, { max = 1100, quality = 0.78 } = {}) {
  const src = await decode(file);
  let q = quality;
  let img = await scaleTo(src, max, q);
  // strop ~450 kB: po převodu na base64 (sdílení přes Firestore) se vejde do limitu 1 MiB na dokument
  while (img.size > 450 * 1024 && q > 0.45) { q -= 0.08; img = await scaleTo(src, max, q); }
  if (img.size > 450 * 1024) img = await scaleTo(src, 900, 0.6);
  const thumb = await scaleTo(src, 360, 0.72);
  src.close?.();
  return { img, thumb };
}
export async function thumbFromBlob(blob) {
  const src = await decode(blob);
  const t = await scaleTo(src, 360, 0.72);
  src.close?.();
  return t;
}

export const blobToDataURL = (b) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});
export const dataURLToBlob = async (u) => (await fetch(u)).blob();
