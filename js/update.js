/* update.js – aktualizace aplikace: viditelné tlačítko „Aktualizovat“, ruční kontrola a číslo verze. */
import { toast } from './ui.js';

let reg = null;
export const setRegistration = (r) => { reg = r; };

/** Pruh nahoře s tlačítkem. Zůstane, dokud na něj nekleneš (aplikace se pak sama načte znovu). */
export function showUpdateBar() {
  if (document.getElementById('updateBar')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>Je tu nová verze Cipíska.</span><button type="button" class="btn small">Aktualizovat</button>';
  bar.querySelector('button').onclick = () => { bar.querySelector('button').disabled = true; location.reload(); };
  document.body.append(bar);
}

/** Zeptá se serveru, jestli je nová verze. Vrací 'new' | 'current' | 'error'. */
export async function checkForUpdate() {
  if (!reg) return 'error';
  try {
    await reg.update();
    if (reg.installing || reg.waiting) return 'new';
    return 'current';
  } catch { return 'error'; }
}

export function appVersion() {
  return new Promise((res) => {
    const c = navigator.serviceWorker?.controller;
    if (!c) return res(null);
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => res(e.data?.version || null);
    c.postMessage('GET_VERSION', [ch.port2]);
    setTimeout(() => res(null), 1500);
  });
}

export async function manualCheck() {
  toast('Zjišťuji, jestli je nová verze…');
  const r = await checkForUpdate();
  if (r === 'new') { showUpdateBar(); toast('Nová verze se stáhla. Klepni na Aktualizovat.'); }
  else if (r === 'current') toast('Máš nejnovější verzi.');
  else toast('Zjištění se nepovedlo. Jsi online?');
}
