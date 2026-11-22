/* help.js – nápověda „Kde to najdu?“ pro všechny v rodině (třeba mámu).
   Není to umělá inteligence: hledá v hotových odpovědích podle slov a ke každé nabídne tlačítko, které otevře správné místo. */
import { html, esc } from './util.js';
import { icon, openSheet } from './ui.js';

const FAQ = [
  { q: 'Jak zapíšu, že čůral nebo kakal venku?', k: 'cural kakal venku hovinko zapis udalost pipi', a: 'Na úvodní stránce Dnes klepni na velké tlačítko „Venku čůral“ nebo „Venku hovínko“. Zapíše se to s časem. Když se spletl, klepni na zápis a smaž ho, nebo hned po zápisu na „Zpět“.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Co dělat, když čůral doma?', k: 'nehoda doma cural kaluz', a: 'Klepni na „Nehoda doma“ na stránce Dnes. Nehodu nikdy netrestej, jen uklid a příště ho vem ven dřív. Aplikace pak ukáže, kdy se nehody stávají nejčastěji.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Kdy ho mám vzít ven?', k: 'kdy ven vencit cas potreba', a: 'Na stránce Dnes je karta „Kdy ven“. Řekne, kdy zkusit jít ven, podle toho, jak často chodil ven v minulých dnech. Vždy ven po spaní, jídle, pití a hře.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Kolik má sníst?', k: 'kolik jidlo snist granule porce gramy krmeni', a: 'V záložce Jídlo → Porce zadej název krmiva a kcal na 1 kg z obalu (třeba 3800). Aplikace spočítá gramy na den a na jedno krmení. Je to odhad, řiď se i obalem.', go: '#/jidlo', b: 'Otevřít Jídlo' },
  { q: 'Kde jsou slevy na maso?', k: 'slevy akce maso levne obchod cena', a: 'V záložce Jídlo → Slevy. Klepni na „Aktualizovat“ pro čerstvé ceny, nebo na „Živě na Kupi.cz“ u kategorie.', go: '#/jidlo?t=slevy', b: 'Otevřít slevy' },
  { q: 'Jak dám prášky na klouby a jak se připomenou?', k: 'prasky klouby tablety doplnek pripominka upozorneni budik', a: 'Na stránce Dnes je karta „Na řadě dnes“, tam úkol odškrtni, až prášky dostane. Aby zazvonilo i při zavřené aplikaci, klepni na „Budíky do kalendáře“ a přidej je do kalendáře v telefonu.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Jak zapíšu procházku a kolik ušli?', k: 'prochazka gps mapa kilometry trasa nahrat', a: 'V záložce Procházky vyber „Nahrávat GPS“ a klepni na „Začít nahrávat“. Při procházce nech aplikaci otevřenou. Na konci klepni na „Ukončit“ a ulož. Trasu můžeš i nakreslit v režimu „Kreslit trasu“.', go: '#/prochazky', b: 'Otevřít Procházky' },
  { q: 'Jak ho zvážím a zapíšu váhu?', k: 'vaha vazeni kila kg zapsat', a: 'V záložce Růst klepni na „Přidat fotku nebo váhu“, zadej kila a ulož. Z váhy se pak počítá porce jídla.', go: '#/rust', b: 'Otevřít Růst' },
  { q: 'Kam dám fotku a poznámky k dnešku?', k: 'foto fotka denik poznamky den povedlo pokazil naucil', a: 'Na stránce Dnes je karta „Deník dne“. Klepni na „Zapsat“ a vyplň, co se naučil, co se povedlo, co pokazil, co jedl, a přidej fotky. Staré dny najdeš v Růst → Deník.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Kde je výchova a čemu se učit?', k: 'vychova trenink sedni zustan nauceni dovednost cviceni', a: 'V záložce Výchova jsou dovednosti. Klepni na „Přidat“ u doporučené dovednosti a po tréninku ho zapiš. Průvodce ukáže, co je vhodné v jeho věku.', go: '#/vychova', b: 'Otevřít Výchovu' },
  { q: 'Kdy má být u veterináře a očkování?', k: 'veterina ockovani veterinar termin odcerveni cip', a: 'V záložce Zdraví je Veterina s termíny, odpočtem a historií. Můžeš tam vytvořit i „Kartu pro veterináře“ ke sdílení nebo tisku.', go: '#/zdravi', b: 'Otevřít Zdraví' },
  { q: 'Něco snědl nebo je mu špatně, co dělat?', k: 'otrava spatne zvraci prujem pomoc nouze pohotovost snedl jed cokolada', a: 'Otevři Zdraví → První pomoc. Je tam, kdy jet ihned k veterináři, a návody na otravu, úpal, žihadlo a další. Při pochybnostech zavolej veterináři.', go: '#/zdravi?t=pomoc', b: 'Otevřít První pomoc' },
  { q: 'Jak zjistím, jestli je dobré počasí na venčení?', k: 'pocasi horko mraz venku teplo dest', a: 'Na stránce Dnes je karta „Počasí na procházku“. Klepni na „Zjistit počasí“ a povol polohu.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Jak vidím, kde Cipísek je (GPS obojek)?', k: 'kde je tracker obojek poloha airtag tractive', a: 'Na stránce Dnes je karta „Kde je Cipísek“. Klepni na „+“ a přidej tracker. Tlačítko „Poloha“ pak otevře stránku výrobce s mapou.', go: '#/dnes', b: 'Otevřít Dnes' },
  { q: 'Jak se to propojí s mobilem někoho dalšího?', k: 'sdileni rodina propojit mama telefon firebase pozvanka spolecne', a: 'V Nastavení je „Sdílení v rodině“. Po nastavení vytvoříš odkaz s pozvánkou, pošleš ho a druhý telefon se připojí. Postup je v README na GitHubu. Ptej se Honzy, pomůže.', go: '#/nastaveni', b: 'Otevřít Nastavení' },
  { q: 'Jak si udělám zálohu, aby se nic neztratilo?', k: 'zaloha export ulozit data ztratit novy telefon', a: 'V Nastavení klepni na „Stáhnout zálohu“ a soubor si schovej (třeba do e-mailu). Na jiném telefonu ho tam nahraješ.', go: '#/nastaveni', b: 'Otevřít Nastavení' },
  { q: 'Jak dám aplikaci na plochu?', k: 'plocha instalace nainstalovat ikona aplikace', a: 'V Chrome otevři menu ⋮ (tři tečky) a zvol „Instalovat aplikaci“ nebo „Přidat na plochu“. Podržíš-li pak prst na ikoně, uvidíš rychlé zkratky.', go: '#/nastaveni', b: 'Otevřít Nastavení' },
  { q: 'Jak změním tmavý nebo světlý vzhled?', k: 'tmavy svetly vzhled barvy rezim', a: 'V Nastavení je karta „Vzhled a upozornění“, kde vybereš světlý, tmavý nebo automatický vzhled.', go: '#/nastaveni', b: 'Otevřít Nastavení' },
  { q: 'Aplikace se mi nenačetla nebo je stará', k: 'nefunguje nenacetla stara aktualizace obnovit chyba rozbita', a: 'Zavři aplikaci úplně (smáhni ji z posledních aplikací) a otevři ji znovu. Když se ukáže hláška „Je tu nová verze“, klepni na „Obnovit“. Data se nesmažou.', go: '#/dnes', b: 'Otevřít Dnes' },
];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function search(text) {
  const words = norm(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (!words.length) return FAQ;
  return FAQ.map((f) => {
    const hay = norm(f.q + ' ' + f.k);
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : (w.length > 4 && hay.includes(w.slice(0, -1)) ? 0.6 : 0)), 0);
    return { f, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.f);
}

const list = (items) => (items.length
  ? html`<div class="aid">${items.map((f) => html`<details><summary>${f.q}</summary>
      <div class="help-a"><p>${f.a}</p><button class="btn primary small" data-go="${f.go}">${f.b} ${icon('chev', 16)}</button></div></details>`)}</div>`
  : html`<p class="empty">K tomu nic nemám. Zkus jiné slovo, třeba „jídlo“, „váha“ nebo „procházka“.</p>`);

export function openHelp() {
  const s = openSheet({
    title: 'Nápověda: kde to najdu?',
    body: html`<div class="form">
      <p class="muted small">Napiš, co hledáš, třeba „prášky“, „fotka“ nebo „váha“. Nebo klepni na otázku níže.</p>
      <label class="field"><span>Co potřebuješ?</span><input type="search" id="hq" placeholder="např. kolik má sníst" autocomplete="off"></label>
      <div id="hres">${list(FAQ)}</div>
      <p class="muted small">Pomůže ti i Honza. Aplikace není chytrý robot, jen najde hotové odpovědi.</p></div>`,
  });
  const res = s.$('#hres');
  s.$('#hq').oninput = (e) => { res.innerHTML = String(list(search(e.target.value))); };
  s.el.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (!g) return;
    s.close();
    setTimeout(() => { location.hash = g.dataset.go; }, 60);
  });
}
