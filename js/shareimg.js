/* shareimg.js – fotka s nápisem „Cipísek, 2 měsíce a 22 dní“ ke sdílení (canvas, vše v telefonu). */
import { downloadBlob } from './util.js';

const W = 1080, H = 1350;

async function decode(blob) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* fallback níž */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    const u = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(u); res(img); };
    img.onerror = () => rej(new Error('Fotku se nepodařilo načíst'));
    img.src = u;
  });
}

/** @param {{blob:Blob,name:string,big:string,small?:string,foot?:string}} o  @returns {Promise<Blob>} JPEG 1080×1350 */
export async function ageImage({ blob, name, big, small = '', foot = '' }) {
  const FONT = '"Bricolage Grotesque", system-ui, sans-serif';
  try { await document.fonts.load(`800 100px ${FONT}`); await document.fonts.load(`500 40px ${FONT}`); } catch { /* nic */ }
  const src = await decode(blob);
  const bw = src.naturalWidth || src.width, bh = src.naturalHeight || src.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const k = Math.max(W / bw, H / bh);
  g.drawImage(src, (W - bw * k) / 2, (H - bh * k) / 2, bw * k, bh * k);
  src.close?.();
  const grad = g.createLinearGradient(0, H * 0.52, 0, H);
  grad.addColorStop(0, 'rgba(8,28,24,0)');
  grad.addColorStop(1, 'rgba(8,28,24,0.86)');
  g.fillStyle = grad;
  g.fillRect(0, H * 0.52, W, H * 0.48);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.font = `650 46px ${FONT}`;
  g.globalAlpha = 0.9;
  g.fillText(name, 72, H - (small ? 300 : 230));
  g.globalAlpha = 1;
  g.font = `800 128px ${FONT}`;
  g.fillText(big, 68, H - (small ? 180 : 110));
  if (small) { g.font = `560 62px ${FONT}`; g.globalAlpha = 0.92; g.fillText(small, 72, H - 104); g.globalAlpha = 1; }
  if (foot) { g.font = `500 36px ${FONT}`; g.globalAlpha = 0.8; g.fillText(foot, 72, H - 48); g.globalAlpha = 1; }
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
}

/** Otevře systémové sdílení, jinak soubor stáhne. Vrací 'shared' | 'downloaded' | 'cancel'. */
export async function shareOrDownload(blob, filename, text = '') {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
