/* views/settings.js – profil psa, kdo jsem, sdílení v rodině (Firebase), záloha, instalace aplikace. */
import { ACCENTS, iconDir, applyAccent } from '../accent.js';
import * as store from '../store.js';
import * as sync from '../sync.js';
import { applyCompat } from '../compat.js';
import * as photodb from '../photodb.js';
import { html, raw, $, todayISO, ageText, parseNum, fmtDate } from '../util.js';
import { notificationsSupported, enableNotifications } from '../tasks.js';
import { icon, toast, openSheet, confirmDialog, field, select, readForm } from '../ui.js';

const APP_VERSION = '1.0.0';
const FB_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{family}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
const STATUS_TXT = { off: 'Vypnuto', connecting: 'Připojuji…', online: 'Připojeno, data se sdílejí', offline: 'Offline, odešle se později', error: 'Chyba' };

let root = null, unsubStatus = null;
const onInstallable = () => root && drawInstall();

export function render(r) {
  root = r;
  root.onclick = onClick;
  root.onsubmit = onSubmit;
  root.onchange = onChange;
  root.oninput = onInput;
  addEventListener('cipisek:installable', onInstallable);
  draw();
  unsubStatus = sync.onStatus(paintStatus);
}
export const refresh = () => root && draw();
export function destroy() {
  unsubStatus?.(); unsubStatus = null;
  removeEventListener('cipisek:installable', onInstallable);
  if (root) { root.onclick = null; root.onsubmit = null; root.onchange = null; root.oninput = null; }
  root = null;
}

function onInput(e) {
  if (!e.target.matches('[data-compat-range]')) return;
  const f = e.target.form, top = Number(f.compatTop.value), bot = Number(f.compatBottom.value);
  $('#cTv', root).textContent = top; $('#cBv', root).textContent = bot;
  applyCompat({ compat: true, compatTop: top, compatBottom: bot });   // náhled hned, uloží se tlačítkem Uložit
}

function paintStatus(s) {
  const el = $('#syncState', root);
  if (!el) return;
  el.textContent = s.status === 'error' ? s.msg : STATUS_TXT[s.status] + (s.status === 'offline' && s.msg ? '' : '');
  el.className = 'sync-state s-' + s.status;
}

function draw() {
  const meta = store.getMeta();
  const set = store.getSettings();
  const shared = set.syncOn && set.firebaseConfig && set.familyCode;

  root.innerHTML = String(html`
    <header class="page-head"><h1>Nastavení</h1></header>

    <section class="card">
      <h2>Pes</h2>
      <form class="form" data-form="dog">
        ${field({ label: 'Jméno', name: 'name', value: meta.name, attrs: 'required maxlength="40"' })}
        ${field({ label: 'Datum narození', name: 'birthDate', type: 'date', value: meta.birthDate, attrs: `required max="${todayISO()}"`, hint: `Dnes: ${ageText(meta.birthDate)}` })}
        ${select({ label: 'Pohlaví (jen pro orientační křivku váhy)', name: 'sex', value: meta.sex, options: [['m', 'Pes'], ['f', 'Fena']] })}
        ${field({ label: 'Číslo čipu (volitelně)', name: 'chip', value: meta.chip || '', attrs: 'maxlength="20" inputmode="numeric" autocomplete="off"', hint: 'Objeví se na kartě pro veterináře.' })}
        ${field({ label: 'Veterinář (jméno nebo klinika)', name: 'vetName', value: meta.vetName || '', attrs: 'maxlength="60"' })}
        ${field({ label: 'Telefon veterináře', name: 'vetPhone', type: 'tel', value: meta.vetPhone || '', attrs: 'maxlength="25" inputmode="tel" autocomplete="off"', hint: 'Ukáže se v první pomoci jako tlačítko „Zavolat“.' })}
        <label class="field"><span>Alergie a poznámky pro veterináře</span><textarea name="notes" rows="2" maxlength="300" placeholder="např. alergie na kuřecí maso">${meta.notes || ''}</textarea></label>
        <button class="btn primary block" type="submit">Uložit</button>
      </form>
    </section>

    <section class="card">
      <h2>Vzhled a upozornění</h2>
      <div class="field"><span>Barva aplikace</span>
        <div class="swatches">${ACCENTS.map((a) => html`<button type="button" class="swatch ${(set.accent || 'g') === a.id ? 'on' : ''}" data-accent-pick="${a.id}" aria-pressed="${(set.accent || 'g') === a.id}">
          <img src="${iconDir(a.id)}/icon-192.png" alt="">${a.name}</button>`)}</div>
        <small>Změní barvy v aplikaci a úvodní obrazovku. Ikona na ploše se změní až po jejím odebrání a novém přidání (Chrome ji někdy aktualizuje sám za pár dní).</small></div>
      <form class="form" data-form="look">
        ${select({ label: 'Vzhled', name: 'theme', value: set.theme || 'auto', options: [['auto', 'Podle telefonu'], ['light', 'Světlý'], ['dark', 'Tmavý']] })}
        <label class="check"><input type="checkbox" name="compat" ${set.compat ? 'checked' : ''}> <span><b>Režim pro starší telefon (Samsung)</b><br><small class="muted">Posune horní lištu pod stavový řádek a spodní lištu nad systémová tlačítka. Zjednoduší i efekty.</small></span></label>
        <div class="field"><span>Odsazení shora: <b id="cTv">${set.compatTop ?? 30}</b> px</span><input type="range" name="compatTop" min="0" max="70" step="2" value="${set.compatTop ?? 30}" data-compat-range></div>
        <div class="field"><span>Odsazení zdola: <b id="cBv">${set.compatBottom ?? 48}</b> px</span><input type="range" name="compatBottom" min="0" max="110" step="2" value="${set.compatBottom ?? 48}" data-compat-range></div>
        <button class="btn primary block" type="submit">Uložit</button>
      </form>
      <p class="muted small">Upozornění na úkoly (prášky, krmení): ${!notificationsSupported() ? 'toto zařízení je nepodporuje.' : Notification.permission === 'granted' ? 'povolená. Ozvou se, když je aplikace otevřená nebo na pozadí.' : Notification.permission === 'denied' ? 'zakázaná. Povol je v nastavení prohlížeče.' : 'zatím nepovolená.'}
        Když je aplikace úplně zavřená, hlídá úkoly budík z kalendáře (úkol → Budík do kalendáře).</p>
      ${notificationsSupported() && Notification.permission === 'default' ? html`<button class="btn ghost" data-notif>${icon('cal', 18)} Povolit upozornění</button>` : ''}
    </section>

    <section class="card">
      <h2>Kdo zapisuje</h2>
      <form class="form" data-form="me">
        ${field({ label: 'Tvoje jméno na tomhle telefonu', name: 'who', value: set.who, attrs: 'maxlength="30" placeholder="např. Honza, Máma"', hint: 'Zobrazí se u zápisů, ať je vidět, kdo co zapsal.' })}
        <button class="btn primary block" type="submit">Uložit</button>
      </form>
    </section>

    <section class="card" id="shareCard">
      <h2>Sdílení v rodině</h2>
      ${shared ? sharedOn(set) : sharedOff()}
    </section>

    <section class="card">
      <h2>Procházky</h2>
      <form class="form" data-form="pace">
        <label class="field"><span>Tempo chůze: <b id="paceV">${String(set.paceKmh).replace('.', ',')} km/h</b></span>
          <input type="range" name="pace" min="1.5" max="6" step="0.5" value="${set.paceKmh}"></label>
        <p class="muted small">Z tempa se počítá odhad času u kreslených tras. S malým štěnětem je to klidně 2 km/h.</p>
        <button class="btn primary block" type="submit">Uložit</button>
      </form>
    </section>

    <section class="card">
      <h2>Záloha dat</h2>
      <p class="muted small">Záloha je soubor, který můžeš poslat do jiného telefonu nebo si ho schovat. Data v prohlížeči a v nainstalované aplikaci jsou oddělená, záloha je převede.</p>
      <label class="switch"><input type="checkbox" id="withPhotos" checked><span>Zahrnout fotky</span></label>
      <div class="btn-row">
        <button class="btn ghost" data-export>${icon('download', 18)} Stáhnout zálohu</button>
        <button class="btn ghost" data-import>${icon('upload', 18)} Nahrát zálohu</button>
      </div>
      <input type="file" id="fImport" accept="application/json,.json" hidden>
      <p class="muted small" id="expStat">${set.lastBackup ? `Poslední záloha: ${fmtDate(new Date(set.lastBackup).toISOString().slice(0, 10))}.` : 'Zatím jsi žádnou nestáhl.'}</p>
    </section>

    <section class="card" id="installCard"></section>

    <section class="card danger-zone">
      <h2>Smazání dat</h2>
      <p class="muted small">Smaže všechna data a fotky jen v tomhle zařízení. Pokud je zapnuté sdílení, zůstanou data v rodinné databázi.</p>
      <button class="btn danger-ghost block" data-reset>${icon('trash', 18)} Smazat data v tomto zařízení</button>
    </section>

    <p class="disclaimer">Cipísek – Průvodce &amp; Deník · verze ${APP_VERSION}<br>Mapy: © Esri, © přispěvatelé OpenStreetMap, trasy: routing.openstreetmap.de</p>`);

  drawInstall();
  paintStatus(sync.getStatus());
  const pace = $('[name="pace"]', root);
  pace.oninput = () => { $('#paceV', root).textContent = pace.value.replace('.', ',') + ' km/h'; };
}

// ---------- sdílení ----------
function sharedOff() {
  return html`
    <p>Díky sdílení uvidíš ty i máma stejný deník na svých telefonech. Potřebuje to zdarma databázi Firebase (jednorázové nastavení asi 10 minut).</p>
    <details class="acc-in"><summary>Jak nastavit Firebase</summary>
      <ol class="steps">
        <li>Na <b>console.firebase.google.com</b> vytvoř projekt (Analytics nepotřebuješ).</li>
        <li><b>Build → Authentication</b> → Get started → Sign-in method → <b>Anonymous</b> → zapni.</li>
        <li><b>Build → Firestore Database</b> → Create database (production mode, region <i>eur3</i>). V záložce <b>Rules</b> vlož pravidla níže a dej Publish.</li>
        <li><b>Project settings → Your apps → Web (&lt;/&gt;)</b> → zaregistruj aplikaci a zkopíruj <code>firebaseConfig</code>.</li>
        <li>Vlož ho sem a klepni na Zapnout sdílení.</li>
      </ol>
      <pre class="code" id="rules">${RULES}</pre>
      <button class="btn small ghost" data-copy-rules>${icon('link', 16)} Zkopírovat pravidla</button>
    </details>
    <form class="form" data-form="fb">
      <label class="field"><span>Konfigurace Firebase</span>
        <textarea name="cfg" rows="5" required placeholder='apiKey: "…", authDomain: "…", projectId: "…", appId: "…"'></textarea></label>
      <button class="btn primary block" type="submit">Zapnout sdílení</button>
    </form>
    <form class="form" data-form="join">
      <h3 class="sub">Mám pozvánku od někoho z rodiny</h3>
      ${field({ label: 'Odkaz z pozvánky', name: 'link', attrs: 'required placeholder="https://…#join=…"' })}
      <button class="btn ghost block" type="submit">${icon('users', 18)} Připojit se</button>
    </form>`;
}

function sharedOn(set) {
  return html`
    <p class="sync-line"><i class="sync-dot s-on" aria-hidden="true"></i><span id="syncState" class="sync-state">…</span></p>
    <p class="muted small">Rodinný kód: <code>${set.familyCode}</code></p>
    <div class="btn-row">
      <button class="btn primary" data-invite>${icon('share', 18)} Pozvat do rodiny</button>
      <button class="btn ghost" data-resync>${icon('undo', 18)} Znovu připojit</button>
    </div>
    <button class="btn danger-ghost block" data-unshare>Vypnout sdílení na tomto telefonu</button>
    <p class="muted small">Vypnutím se nic nesmaže, data zůstanou v telefonu i v databázi.</p>`;
}

function inviteSheet() {
  const link = sync.inviteLink();
  if (!link) return;
  const s = openSheet({
    title: 'Pozvat do rodiny',
    body: html`<p>Pošli tenhle odkaz mámě nebo komukoli z rodiny a otevře se u nich připojení k deníku.</p>
      <textarea class="linkbox" id="lk" rows="4" readonly>${link}</textarea>
      <div class="btn-row"><button class="btn primary" data-copy>${icon('link', 18)} Zkopírovat</button>
        ${navigator.share ? html`<button class="btn ghost" data-share>${icon('share', 18)} Sdílet</button>` : ''}</div>
      <p class="warn">Odkaz obsahuje přístup k datům. Posílej ho jen lidem, kterým věříš.</p>`,
  });
  s.$('[data-copy]').onclick = async () => { await copyText(link, s.$('#lk')); toast('Odkaz je zkopírovaný.'); };
  const sh = s.$('[data-share]');
  if (sh) sh.onclick = () => navigator.share({ title: `Deník ${store.getMeta().name}`, text: `Připoj se k deníku ${store.getMeta().name}:`, url: link }).catch(() => {});
}

async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* záloha níž */ }
  if (el) { el.focus(); el.select(); try { document.execCommand('copy'); } catch { /* nic */ } }
}

function parseFirebaseConfig(text) {
  const out = {};
  for (const m of text.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g)) if (FB_KEYS.includes(m[1])) out[m[1]] = m[2];
  return out.apiKey && out.projectId && out.appId ? out : null;
}

// ---------- instalace ----------
function drawInstall() {
  const el = $('#installCard', root);
  if (!el) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  import('../update.js').then((m) => m.appVersion()).then((v) => { const l = $('#verLine', root); if (l) l.textContent = v ? `Verze aplikace: ${v}.` : ''; });
  el.innerHTML = String(html`
    <h2>Aplikace v telefonu</h2>
    ${standalone ? html`<p class="muted">Aplikace běží nainstalovaná.</p>`
      : window.__installEvt ? html`<p class="muted small">Přidej si Cipíska na plochu, otevře se na celou obrazovku a funguje i bez internetu.</p>
          <button class="btn primary block" data-install>${icon('download', 18)} Nainstalovat aplikaci</button>`
      : ios ? html`<p class="muted">V Safari klepni na <b>Sdílet</b> a pak <b>Přidat na plochu</b>.</p>`
      : html`<p class="muted">V Chrome otevři menu ⋮ a zvol <b>Instalovat aplikaci</b> (nebo <b>Přidat na plochu</b>). Instalace funguje jen přes https.</p>`}
    <button class="btn ghost block" data-help>${icon('info', 18)} Nápověda: kde to najdu?</button>
    <div class="btn-row"><button class="btn ghost" data-check-update>${icon('undo', 18)} Zkontrolovat aktualizace</button></div>
    <p class="muted small" id="verLine"></p>
    <p class="muted small"><b>Zkratky na ploše:</b> na Androidu podrž prst na ikoně Cipíska. Objeví se „Čůral venku“, „Nehoda“, „Začít procházku“ a „Přidat fotku a váhu“. Každou z nich můžeš přetáhnout na plochu jako samostatnou ikonu, i vedle widgetu s počasím.</p>`);
}

// ---------- záloha ----------
async function exportData() {
  const stat = $('#expStat', root);
  stat.textContent = 'Připravuji zálohu…';
  try {
    const out = { app: 'cipisek', version: 1, exportedAt: new Date().toISOString(), state: store.snapshot(), photos: [] };
    if ($('#withPhotos', root).checked) {
      for (const p of await photodb.allPhotos()) out.photos.push({ id: p.id, img: await photodb.blobToDataURL(p.img) });
    }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cipisek-zaloha-${todayISO()}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    store.setSettings({ lastBackup: Date.now() });
    stat.textContent = `Hotovo: ${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB, ${out.photos.length} fotek.`;
  } catch (e) {
    console.error(e);
    stat.textContent = 'Zálohu se nepodařilo vytvořit.';
  }
}

async function importData(file) {
  const stat = $('#expStat', root);
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'cipisek' || !data.state?.cols) throw new Error('Tohle není záloha Cipíska.');
    stat.textContent = 'Nahrávám…';
    const n = store.importSnapshot(data.state);
    for (const p of data.photos || []) {
      const img = await photodb.dataURLToBlob(p.img);
      await photodb.savePhoto(p.id, img, await photodb.thumbFromBlob(img));
    }
    localStorage.setItem('cipisek.welcome', '1');
    stat.textContent = `Nahráno: ${n} záznamů, ${(data.photos || []).length} fotek.`;
    toast('Záloha je nahraná.');
    draw();
  } catch (e) {
    console.error(e);
    stat.textContent = e.message || 'Zálohu se nepodařilo načíst.';
  }
}

// ---------- události ----------
async function onClick(e) {
  const t = e.target;
  if (t.closest('[data-invite]')) return inviteSheet();
  if (t.closest('[data-export]')) return exportData();
  if (t.closest('[data-import]')) { $('#fImport', root).click(); return; }
  const pick = t.closest('[data-accent-pick]');
  if (pick) {
    store.setSettings({ accent: pick.dataset.accentPick });
    applyAccent(pick.dataset.accentPick);
    toast('Barva změněna. Ikonu na ploše změníš odebráním a novým přidáním.');
    draw();
    return;
  }
  if (t.closest('[data-check-update]')) { import('../update.js').then((m) => m.manualCheck()); return; }
  if (t.closest('[data-help]')) { import('../help.js').then((m) => m.openHelp()); return; }
  if (t.closest('[data-install]')) {
    const ev = window.__installEvt;
    if (!ev) return;
    ev.prompt();
    await ev.userChoice.catch(() => {});
    window.__installEvt = null;
    drawInstall();
    return;
  }
  if (t.closest('[data-notif]')) {
    const p = await enableNotifications();
    toast(p === 'granted' ? 'Upozornění jsou zapnutá.' : 'Upozornění nejsou povolená.');
    draw();
    return;
  }
  if (t.closest('[data-copy-rules]')) { await copyText(RULES); toast('Pravidla jsou zkopírovaná.'); return; }
  if (t.closest('[data-resync]')) { await sync.start(); toast('Připojuji znovu…'); return; }
  if (t.closest('[data-unshare]')) {
    if (await confirmDialog({ title: 'Vypnout sdílení?', text: 'Data zůstanou v tomto telefonu i v databázi. Změny se přestanou posílat.', ok: 'Vypnout' })) {
      store.setSettings({ syncOn: false });
      sync.stop();
      draw();
    }
    return;
  }
  if (t.closest('[data-reset]')) {
    if (await confirmDialog({ title: 'Smazat všechna data?', text: 'Zmizí všechny záznamy a fotky v tomto zařízení. Vrátit to nepůjde, pokud nemáš zálohu nebo sdílení.', ok: 'Smazat vše', danger: true })) {
      sync.stop();
      store.setSettings({ syncOn: false, pushedPhotos: [] });
      store.resetAll();
      await photodb.clearPhotos();
      localStorage.removeItem('cipisek.welcome');
      toast('Data v tomto zařízení jsou smazaná.');
      draw();
    }
  }
}

function onChange(e) {
  if (e.target.id === 'fImport' && e.target.files[0]) {
    importData(e.target.files[0]);
    e.target.value = '';
  }
}

async function onSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = readForm(form);
  switch (form.dataset.form) {
    case 'dog':
      store.setMeta({ name: f.name.trim() || 'Cipísek', birthDate: f.birthDate, sex: f.sex, chip: f.chip.trim(), notes: f.notes.trim(), vetName: f.vetName.trim(), vetPhone: f.vetPhone.replace(/[^\d+ ]/g, '').trim() });
      toast('Uloženo.');
      draw();
      break;
    case 'look':
      store.setSettings({ theme: f.theme, compat: 'compat' in f, compatTop: Number(f.compatTop) || 0, compatBottom: Number(f.compatBottom) || 0 });
      document.documentElement.dataset.theme = f.theme === 'auto' ? '' : f.theme;
      applyCompat(store.getSettings());
      toast('Uloženo.');
      break;
    case 'me':
      store.setSettings({ who: f.who.trim() });
      toast('Uloženo.');
      break;
    case 'pace':
      store.setSettings({ paceKmh: parseNum(f.pace) || 3 });
      toast('Uloženo.');
      break;
    case 'fb': {
      const cfg = parseFirebaseConfig(f.cfg);
      if (!cfg) { toast('V konfiguraci chybí apiKey, projectId nebo appId. Zkopíruj celý objekt firebaseConfig.'); return; }
      store.setSettings({ firebaseConfig: cfg, familyCode: sync.randomCode(), syncOn: true, pushedPhotos: [] });
      draw();
      await sync.start();
      toast('Sdílení je zapnuté. Teď pozvi mámu.');
      break;
    }
    case 'join': {
      const i = f.link.indexOf('#join=');
      const inv = i >= 0 ? sync.parseInvite(f.link.slice(i)) : null;
      if (!inv) { toast('Odkaz nevypadá jako pozvánka. Zkopíruj ho celý.'); return; }
      store.setSettings({ firebaseConfig: inv.c, familyCode: inv.k, syncOn: true, pushedPhotos: [] });
      draw();
      await sync.start();
      toast('Připojeno. Data se za chvíli načtou.');
      break;
    }
    default:
  }
}
