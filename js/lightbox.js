/* lightbox.js – celoobrazovkové prohlížení fotek: přiblížení štípnutím nebo dvojklepem, posun prstem,
   listování do stran, zavření tažením dolů. Používají milníky, deník dne a růst. */
import { html, esc } from './util.js';
import { icon, openSheet } from './ui.js';
import * as photodb from './photodb.js';
import * as sync from './sync.js';
import { shareOrDownload } from './shareimg.js';

/** items: [{ id? , url?, title, sub, note }] – fotka z úložiště (id) nebo hotové url. */
export function openLightbox(items, start = 0) {
  items = items.filter(Boolean);
  if (!items.length) return;
  let idx = Math.min(Math.max(start, 0), items.length - 1);
  const s = openSheet({
    title: 'Fotka', cls: 'lb', full: true,
    body: html`<div class="lb-stage" id="lbStage"><img id="lbImg" alt="" draggable="false"><p class="lb-miss" id="lbMiss" hidden></p></div>
      <button class="lb-x" data-close aria-label="Zavřít">${icon('x', 24)}</button>
      <div class="lb-cap" id="lbCap"></div>`,
  });
  const stage = s.$('#lbStage'), img = s.$('#lbImg'), miss = s.$('#lbMiss'), cap = s.$('#lbCap');
  let scale = 1, tx = 0, ty = 0, dim = false;
  const apply = (anim = false) => {
    img.style.transition = anim ? 'transform .22s ease' : 'none';
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };
  const reset = () => { scale = 1; tx = ty = 0; apply(); };
  const limit = () => {
    const r = stage.getBoundingClientRect();
    const w = img.offsetWidth * scale, h = img.offsetHeight * scale;
    const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
    tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
  };

  async function show(i, dir = 0) {
    idx = (i + items.length) % items.length;
    const it = items[idx];
    reset();
    miss.hidden = true;
    img.style.opacity = '0';
    let url = it.url || null;
    if (!url && it.id) url = await photodb.photoUrl(it.id, 'img');
    if (!document.body.contains(stage)) return;
    if (!url) { miss.hidden = false; miss.textContent = 'Fotka se do tohoto zařízení ještě nestáhla.'; if (it.id) sync.ensurePhoto(it.id); }
    else { img.src = url; img.onload = () => { img.style.opacity = '1'; }; }
    cap.innerHTML = `${items.length > 1 ? `<span class="lb-n">${idx + 1} / ${items.length}</span>` : ''}<b>${esc(it.title || '')}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}${it.note ? `<small class="lb-note">${esc(it.note)}</small>` : ''}
      <button class="lb-share" type="button" aria-label="Sdílet fotku">${String(icon('share', 20))}</button>`;
    cap.querySelector('.lb-share').onclick = async () => {
      try {
        const blob = await (await fetch(url)).blob();
        await shareOrDownload(blob, `${(it.title || 'fotka').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}.jpg`, it.title || '');
      } catch { /* sdílení zrušeno */ }
    };
  }

  // ----- gesta -----
  const ptr = new Map();
  let g = null, lastTap = 0, lastTapX = 0, lastTapY = 0, moved = false;
  const dist = () => { const [a, b] = [...ptr.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = [...ptr.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  stage.style.touchAction = 'none';
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (ptr.size === 1) g = { x: e.clientX, y: e.clientY, tx, ty, t: Date.now(), axis: null };
    else if (ptr.size === 2) g = { d: dist(), s: scale, m: mid(), tx, ty };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 2 && g?.d) {
      scale = Math.min(5, Math.max(1, g.s * dist() / g.d));
      const m = mid(); tx = g.tx + (m.x - g.m.x); ty = g.ty + (m.y - g.m.y);
      limit(); apply(); moved = true; return;
    }
    if (ptr.size !== 1 || !g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (scale > 1) { tx = g.tx + dx; ty = g.ty + dy; limit(); apply(); return; }
    if (!g.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (g.axis === 'x' && items.length > 1) { tx = dx; apply(); }
    else if (g.axis === 'y') { ty = dy; apply(); s.el.style.background = `rgba(0,0,0,${Math.max(0.3, 1 - Math.abs(dy) / 450)})`; }
  });
  const end = (e) => {
    if (!ptr.has(e.pointerId)) return;
    const wasOne = ptr.size === 1;
    ptr.delete(e.pointerId);
    if (ptr.size === 1) { const [p] = [...ptr.values()]; g = { x: p.x, y: p.y, tx, ty, t: Date.now(), axis: null }; return; }
    if (!wasOne || !g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    s.el.style.background = '';
    if (!moved) {   // klepnutí: dvojklep přiblíží/oddálí, jedno klepnutí schová popisky
      const now = Date.now();
      if (now - lastTap < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 40) {
        const r = stage.getBoundingClientRect();
        const px = e.clientX - (r.left + r.width / 2), py = e.clientY - (r.top + r.height / 2);
        const ns = scale > 1 ? 1 : 2.6;
        tx = px - (px - tx) * ns / scale; ty = py - (py - ty) * ns / scale; scale = ns;
        if (ns === 1) { tx = ty = 0; } else limit();
        apply(true); lastTap = 0; g = null; return;
      }
      lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY;
      setTimeout(() => { if (lastTap === now && scale === 1) { dim = !dim; s.el.classList.toggle('lb-hide', dim); } }, 300);
      tx = scale === 1 ? 0 : tx; ty = scale === 1 ? 0 : ty; apply(true); g = null; return;
    }
    if (scale > 1) { if (scale < 1.05) reset(); g = null; return; }
    if (g.axis === 'y' && Math.abs(dy) > 110) { s.close(); return; }
    if (g.axis === 'x' && Math.abs(dx) > 70 && items.length > 1) { show(idx + (dx < 0 ? 1 : -1)); g = null; return; }
    tx = 0; ty = 0; apply(true);
    g = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'Escape') s.close();
  };
  addEventListener('keydown', onKey);
  const prevClose = s.onClose;
  s.onClose = () => { removeEventListener('keydown', onKey); prevClose?.(); };
  show(idx);
}
