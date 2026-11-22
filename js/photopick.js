/* photopick.js – výběr fotky (foťák / galerie) s náhledem a zmenšením. Používají milníky. */
import { html } from './util.js';
import { icon } from './ui.js';
import * as photodb from './photodb.js';

export const photoPickHtml = (hasExisting = false) => html`<div class="photo-pick">
  <div class="pp-prev" id="ppPrev">${hasExisting ? html`<img id="ppImg" alt="">` : html`<span class="muted">Bez fotky</span>`}</div>
  <div class="pp-btns">
    <button type="button" class="btn ghost" data-cam>${icon('camera', 18)} Vyfotit</button>
    <button type="button" class="btn ghost" data-gal>${icon('image', 18)} Z galerie</button>
  </div>
  <input type="file" accept="image/*" capture="environment" id="fCam" hidden>
  <input type="file" accept="image/*" id="fGal" hidden>
  <p class="muted small" id="ppStat">Fotka se zmenší, aby nezabírala místo.</p></div>`;

/** Naváže ovládání na otevřené okno. Vrací stav {pending} a dispose(). */
export function bindPhotoPick(s, { saveBtn = '[type=submit]' } = {}) {
  const st = { pending: null, url: null, dispose() { if (st.url) URL.revokeObjectURL(st.url); } };
  const pick = async (file) => {
    if (!file) return;
    const stat = s.$('#ppStat'), btn = s.$(saveBtn);
    stat.textContent = 'Zmenšuji fotku…';
    if (btn) btn.disabled = true;
    try {
      st.pending = await photodb.compress(file);
      st.dispose();
      st.url = URL.createObjectURL(st.pending.img);
      s.$('#ppPrev').innerHTML = `<img src="${st.url}" alt="">`;
      stat.textContent = `Hotovo: ${Math.round(st.pending.img.size / 1024)} kB`;
    } catch (err) {
      console.error(err);
      st.pending = null;
      stat.textContent = 'Fotku se nepodařilo zpracovat. Zkus jinou.';
    }
    if (btn) btn.disabled = false;
  };
  s.$('[data-cam]').onclick = () => s.$('#fCam').click();
  s.$('[data-gal]').onclick = () => s.$('#fGal').click();
  s.$('#fCam').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
  s.$('#fGal').onchange = (e) => { pick(e.target.files[0]); e.target.value = ''; };
  return st;
}
