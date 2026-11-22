/* data.js – obsah průvodce: věkové fáze, katalog dovedností, socializační seznam, tipy, veterinární kalendář.
   Texty jsou orientační a obecné pro pyrenejského horského psa – nenahrazují veterináře ani cvičitele. */
import { addDaysISO, addMonthsISO, todayISO, diffDays } from './util.js';

// ---------- Rychlé zápisy v deníku ----------
export const QUICK = [
  { type: 'pee', emoji: '💧', label: 'Venku čůral', good: true },
  { type: 'poop', emoji: '💩', label: 'Venku hovínko', good: true },
  { type: 'accident', emoji: '🧻', label: 'Nehoda doma', bad: true },
  { type: 'meal', emoji: '🍽️', label: 'Najedl se' },
  { type: 'sleep', emoji: '😴', label: 'Spal' },
  { type: 'note', emoji: '📝', label: 'Poznámka' },
];
export const QUICK_BY = Object.fromEntries(QUICK.map((q) => [q.type, q]));

// ---------- Věkové fáze ----------
export const PHASES = [
  {
    id: 'p1', a: 0, b: 3, emoji: '🍼', title: 'První týdny doma', range: 'do 3 měsíců',
    lead: 'Všechno je nové. Co Cipísek zažije teď, bude později brát jako normální.',
    points: [
      'Okno socializace trvá zhruba do 12–16 týdnů věku. Dávej mu hodně dobrých, klidných zkušeností – ale ne všechny naráz.',
      'Čistota: ven po spaní, po jídle, po hře a jinak zhruba každé 1–2 hodiny. Odměna hned venku, nehody bez trestu.',
      'Spí 18–20 hodin denně. Klid v pelíšku je trénink i odpočinek.',
      'Krátké tréninky (2–5 minut), víckrát za den. Skonči dřív, než ho to omrzí.',
    ],
  },
  {
    id: 'p2', a: 3, b: 5, emoji: '🦷', title: 'Zkoumání a výměna zubů', range: '3–5 měsíců',
    lead: 'Roste jako z vody a všechno bere do pusy.',
    points: [
      'Mléčné zuby se začínají měnit (zhruba mezi 4. a 6. měsícem). Dej mu žvýkací hračky a ostré kousání směruj na ně.',
      'Socializace pokračuje – nová místa, lidé a zvuky, vždy v tempu, které zvládá.',
      'Začíná se ukazovat nezávislost. Nečekej, že na tebe bude pořád koukat – odměny musí stát za to.',
      'Přivolání trénuj na dlouhém vodítku, ne na volno.',
    ],
  },
  {
    id: 'p3', a: 5, b: 9, emoji: '🌄', title: 'Puberta nastupuje', range: '5–9 měsíců',
    lead: 'Zdánlivě „zapomíná“ všechno, co uměl. To je normální.',
    points: [
      'Vrať se o krok zpátky, trénuj kratší a veselejší a nevzdávej to.',
      'Hlídací instinkt se probouzí: častější štěkání a zájem o všechno za plotem. Učíme „ohlásil jsi, stačí“.',
      'Hodně roste. Hlídej váhu a nepřetěžuj klouby dlouhými túrami, skoky a schody.',
      'Bez ohrady na volno nepatří – plemeno se vrozeně toulá a rozhoduje samo.',
    ],
  },
  {
    id: 'p4', a: 9, b: 18, emoji: '🏔️', title: 'Dospívání', range: '9–18 měsíců',
    lead: 'Testuje hranice a hlídá o to víc.',
    points: [
      'Buď klidný a důsledný. Pyrenejec nereaguje na tlak, ale na jasná a předvídatelná pravidla.',
      'Růst pomalu končí (u tohoto plemene se obvykle dorůstá kolem 1,5 roku).',
      'Hlídání území je naplno – srovnej si pravidla pro návštěvy, plot a bránu.',
      'Přeočkování a kontrola u veterináře: domluv termín.',
    ],
  },
  {
    id: 'p5', a: 18, b: 36, emoji: '🐾', title: 'Mladý dospělý', range: '1,5–3 roky',
    lead: 'Psychicky dozrává až ve 2–3 letech.',
    points: [
      'Zlepšení přichází, ale pomalu. Trpělivost je součást výcviku.',
      'Stálá rutina, dostatek klidu a smysluplná „práce“ (hlídání, vycházky) ho drží vyrovnaného.',
      'Pravidelné česání a kontrola srsti, hlavně v době línání.',
    ],
  },
  {
    id: 'p6', a: 36, b: 999, emoji: '🌲', title: 'Dospělý pes', range: 'od 3 let',
    lead: 'Klidný hlídač, který ví, co dělá.',
    points: ['Drž rutinu, váhu a pravidelné veterinární kontroly.', 'Sleduj klouby a pohyb – velká plemena stárnou dřív.'],
  },
];
export const phaseFor = (months) => PHASES.find((p) => months >= p.a && months < p.b) || PHASES[PHASES.length - 1];

// ---------- Katalog dovedností (from/to = vhodné období v měsících věku) ----------
export const CATALOG = [
  { key: 'cistota', emoji: '🚪', name: 'Čistota – venčení', from: 0, to: 4, tip: 'Stejné místo a stejné slovo. Odměna hned venku, ne až doma. Nehodu bez emocí uklidit enzymatickým čističem.' },
  { key: 'jmeno', emoji: '🗣️', name: 'Reaguje na jméno', from: 0, to: 4, tip: 'Řekni jméno jednou a v okamžiku pohledu odměň. Desetkrát denně po pár vteřinách.' },
  { key: 'pelisek', emoji: '🛏️', name: 'Klid na místě / v pelíšku', from: 0, to: 6, tip: 'Pelíšek = odměna a bezpečí, nikdy trest. Odměňuj za klid, ne za pohyb.' },
  { key: 'manip', emoji: '✋', name: 'Manipulace (tlapky, uši, zuby, kartáč)', from: 0, to: 6, tip: 'Pyrenejec má hustou srst a na zadních tlapách dvojité paspárky. Zvykej ho na dotyky a česání dřív, než bude velký.' },
  { key: 'kousani', emoji: '🦷', name: 'Jemné kousání', from: 0, to: 5, tip: 'Když kousne moc, hra na pár vteřin končí. Hned potom nabídni žvýkací hračku.' },
  { key: 'sedni', emoji: '🐕', name: 'Sedni', from: 0, to: 5, tip: 'Pamlsek nad nos, zadek jde dolů. Povel přidej, až to dělá spolehlivě.' },
  { key: 'lehni', emoji: '🛌', name: 'Lehni', from: 1, to: 6, tip: 'Z polohy „sedni“ veď pamlsek k zemi. Trpělivost, na tvrdé podlaze to nemá rád.' },
  { key: 'samota', emoji: '🏠', name: 'Zvládne chvíli zůstat samo', from: 0, to: 6, tip: 'Začni na pár vteřin a postupně prodlužuj. Odchody a příchody bez drama.' },
  { key: 'dej', emoji: '🤲', name: 'Dej / Pusť', from: 1, to: 6, tip: 'Vyměňuj za něco lepšího. Nikdy mu nic nevytrhávej z pusy.' },
  { key: 'misa', emoji: '🍽️', name: 'Klid u misky', from: 0, to: 8, tip: 'Přidávej do misky něco dobrého, ne ji bereš. Předcházíš hlídání jídla.' },
  { key: 'auto', emoji: '🚗', name: 'Jízda autem', from: 0, to: 6, tip: 'Nejdřív jen sedět v autě bez jízdy, pak krátké cesty. Pyrenejec je velký, vyplatí se zvyknout ho brzy.' },
  { key: 'voditko', emoji: '🦮', name: 'Chůze na vodítku', from: 1, to: 10, tip: 'Začni doma a na zahradě. Zastav se, kdykoli táhne, a pokračuj, když je vodítko povolené.' },
  { key: 'necto', emoji: '🚫', name: 'Nech to', from: 2, to: 10, tip: 'Pamlsek v zavřené dlani – nech ho čichat, odměň za couvnutí.' },
  { key: 'zustan', emoji: '⏱️', name: 'Zůstaň', from: 3, to: 12, tip: 'Napřed vteřiny, pak vzdálenost, nakonec rozptýlení. Vždy ho vrať, než vstane sám.' },
  { key: 'prichod', emoji: '📣', name: 'Přivolání (na dlouhém vodítku)', from: 2, to: 36, tip: 'Pyrenejci jsou nezávislí. Trénuj na dlouhém vodítku a odměňuj jako o život. Bez ohrady na volno nepatří.' },
  { key: 'ticho', emoji: '🔔', name: 'Ohlásil jsi, stačí', from: 4, to: 18, tip: 'Pyr štěká přirozeně. Neučíme „nesmí štěkat“, ale „ohlásil jsi, díky“: pochval ohlášení, zavolej k sobě a odměň za ztišení.' },
];
export const CATALOG_BY = Object.fromEntries(CATALOG.map((c) => [c.key, c]));
export const catalogForPhase = (ph) => CATALOG.filter((c) => c.from < ph.b && c.to > ph.a);

// ---------- Průvodce pyrenejským horským psem ----------
export const GUIDE = [
  {
    id: 'hlidani', emoji: '🛡️', title: 'Hlídání a štěkání',
    body: [
      'Pyrenejský horský pes je pastevecký ochranný pes: hlídá, ohlašuje a rozhoduje sám. To není „vada“, je to jeho práce.',
      'Štěkání večer a v noci je pro plemeno typické. Neodstraníš ho, ale můžeš ho usměrnit – pochvalou za ohlášení a klidným „díky, stačí“.',
      'Síla a nátlak nefungují. Plemeno reaguje na klid, důslednost a odměny.',
      'Plot musí být pevný a bezpečný. Bez ohrady nebo vodítka nepatří ven – má sklon k toulání a obchůzkám.',
    ],
  },
  {
    id: 'samostatnost', emoji: '🧭', title: 'Samostatnost a trpělivost',
    body: [
      'Je to samostatný myslitel – ne „vyhoví všem“ typ. Výcvik má být krátký, pestrý a stát za to.',
      'Dospívá pomalu: psychicky až ve 2–3 letech. Nečekej, že bude v půl roce spolehlivý.',
      'Největší posun dělá rutina. Stejné povely, stejná pravidla, všichni v rodině stejně.',
      'Když to nejde, vrať se o krok zpátky. Žádný trest, jen jednodušší cvičení.',
    ],
  },
  {
    id: 'socializace', emoji: '🌍', title: 'Socializace (zdravě a v klidu)',
    body: [
      'Cíl není „potkat všechno“, ale mít zkušenost, že svět je v pohodě. Nech ho, ať přichází sám, a nikdy ho nenuť.',
      'Do dokončeného očkování (a ještě zhruba týden dva po poslední dávce) se vyhýbej místům, kde chodí neznámí psi. Nos ho v náručí, zvykej ho na auta, zvuky a lidi, a seznamuj ho se zdravými, očkovanými psy. Přesné pokyny ti dá veterinář.',
      'U plemene hlídače je důležité, aby poznalo spoustu lidí, kteří jsou „v pořádku“ – návštěvy, děti, lidé s kočárkem, na kole, s čepicí.',
    ],
    social: true,
  },
  {
    id: 'pohyb', emoji: '🦴', title: 'Pohyb a klouby (obří plemeno)',
    body: [
      'Obecné pravidlo: asi 5 minut procházky za každý měsíc věku, 2× denně. Pro Cipíska teď platí to, co ukazuje záložka Procházky.',
      'Žádné nucené dlouhé túry, běhání u kola ani běh po tvrdém povrchu. Volná hra na trávě je v pořádku.',
      'Schody a skákání z výšky omezuj, dokud nedorostou kosti. Do auta ho zvedej.',
      'Štíhlý štěně roste zdravěji. Pomalý, stálý růst je lepší než rychlý.',
    ],
  },
  {
    id: 'krmeni', emoji: '🥣', title: 'Krmení a váha',
    body: [
      'Krmivo pro štěňata velkých/obřích plemen (hlídá obsah vápníku a energie), 3–4 menší porce denně.',
      'Nepřekrmovat. Žebra by měly být pod rukou hmatná, ne vidět.',
      'Po jídle klid asi hodinu. Náhlé nafouknutí břicha, neklid nebo marné dávení je akutní věc pro veterináře.',
      'Váhu zapisuj do záložky Růst – uvidíš, jestli roste plynule.',
    ],
  },
  {
    id: 'srst', emoji: '❄️', title: 'Srst a počasí',
    body: [
      'Hustá dvojitá srst: česání 1–2× týdně, v době línání častěji. Nestříhat – srst chrání před horkem i zimou.',
      'Dvojité paspárky na zadních tlapách (nehty) kontroluj a zkracuj.',
      'V létě stín a voda, v horku žádné procházky. Zima mu většinou nevadí.',
    ],
  },
];

// ---------- Socializační seznam ----------
export const SOCIAL = [
  { group: 'Lidé', items: [
    ['deti', 'Děti (klidně, ne naráz)'], ['vousy', 'Muž s vousy nebo čepicí'], ['kolo', 'Člověk na kole / koloběžce'],
    ['kocarek', 'Kočárek, vozík, berle'], ['navsteva', 'Návštěva doma'] ] },
  { group: 'Zvuky', items: [
    ['vysavac', 'Vysavač a domácí spotřebiče'], ['zvonek', 'Zvonek, klepání'], ['auto-zvuk', 'Provoz, autobus'], ['hrom', 'Hlasité zvuky (zlehka, z dálky)'] ] },
  { group: 'Povrchy', items: [
    ['travnik', 'Tráva, hlína, listí'], ['dlazdice', 'Dlaždice, kluzká podlaha'], ['pisek', 'Písek, štěrk'], ['voda', 'Louže, potůček (mělké)'], ['schody', 'Schody (jen pár a s pomocí)'] ] },
  { group: 'Místa', items: [
    ['autojizda', 'Jízda autem'], ['veterina', 'Čekárna u veterináře (v náručí)'], ['nastupiste', 'Ulice, náměstí, zastávka'], ['obchod', 'Obchod pro zvířata'] ] },
  { group: 'Zvířata', items: [
    ['pes-klid', 'Klidný dospělý očkovaný pes'], ['kocka', 'Kočka (kontrolovaně)'], ['hospodarska', 'Slepice, ovce nebo kozy (je to hlídač stád)'] ] },
  { group: 'Péče', items: [
    ['kartac', 'Kartáč a hřeben'], ['nehty', 'Zkracování nehtů'], ['tlapky', 'Osahání tlapek, uší, tlamy'], ['rucnik', 'Utírání ručníkem'] ] },
];
export const SOCIAL_COUNT = SOCIAL.reduce((a, g) => a + g.items.length, 0);

// ---------- Tip dne (rotuje podle data) ----------
export const TIPS = [
  { text: 'Pyrenejci dozrávají pomalu. Trpělivost je součást výcviku, ne jeho nedostatek.' },
  { text: 'Tréninkové chvilky ať jsou krátké a veselé: 3 minuty vydrží víc než půlhodina.', max: 6 },
  { text: 'Štěně je rádo venku po spaní, po jídle a po hře. Nachytáš ho dřív, než se stane nehoda.', max: 4 },
  { text: 'Neučíme „nesmíš štěkat“, ale „ohlásil jsi, díky“. Štěkání je jeho práce.' },
  { text: 'Pohyb ať ho unaví lehce. Obří plemeno nesnáší dlouhé nucené túry.', max: 12 },
  { text: 'Hodně spánku není lenost – štěně roste a spí i 18–20 hodin denně.', max: 5 },
  { text: 'Žvýkací hračka dobře uleví při výměně zubů. Mrazák pomáhá.', min: 3, max: 8 },
  { text: 'Každá nová dobrá zkušenost má váhu zlata. Do 16 týdnů se svět nejlíp učí.', max: 4 },
  { text: 'Přivolání jen na dlouhém vodítku. Na volno bez ohrady je pyrenejec samostatný rozhodovatel.' },
  { text: 'Pořád stejná slova a pravidla pro všechny v rodině. Pes se učí z následků, ne z přemlouvání.' },
  { text: 'Odměna stojí za to: sýr nebo šunka funguje líp než suché granule.', max: 18 },
  { text: 'Když něco nejde, jdi o krok zpátky a udělej to snazší. Nikdy to není selhání.' },
  { text: 'Česání, tlapky a uši zkoušej od mládí. Dospělému pyrenejci to už nikdo nevysvětlí.', max: 8 },
  { text: 'Hlídá i na zahradě: kontroluj plot, bránu a místa, kde by se mohl vykopat ven.', min: 3 },
];

// ---------- Orientační kalendář štěněte ----------
export const KIND = {
  vaccine: { label: 'Očkování', emoji: '💉' },
  deworm: { label: 'Odčervení', emoji: '🪱' },
  visit: { label: 'Návštěva u veterináře', emoji: '🩺' },
  chip: { label: 'Čip / registr', emoji: '🔖' },
  parasite: { label: 'Klíšťata a blechy', emoji: '🕷️' },
  other: { label: 'Jiné', emoji: '📋' },
};

/** Orientační schéma. Skutečný plán určuje veterinář. */
export function vetCalendar(birthISO) {
  const w = (n) => addDaysISO(birthISO, n * 7);
  const m = (n) => addMonthsISO(birthISO, n);
  return [
    { key: 'c1', kind: 'visit', title: 'První návštěva a očkování', ageText: '6–8 týdnů', from: w(6), to: w(8), note: 'Základní očkování, kontrola a plán odčervení.' },
    { key: 'c2', kind: 'vaccine', title: 'Očkování (psinka, hepatitida, parvoviróza)', ageText: '11–13 týdnů', from: w(11), to: w(13) },
    { key: 'c3', kind: 'vaccine', title: 'Leptospiróza + vzteklina', ageText: '15–17 týdnů', from: w(15), to: w(17) },
    { key: 'c4', kind: 'chip', title: 'Čip a zápis v registru psů', ageText: 'nejpozději do 3 měsíců', from: birthISO, to: m(3), note: 'Čip je povinný nejpozději do 3 měsíců věku. Zápis v Centrální evidenci psů ověř u veterináře (registrpsu.gov.cz).' },
    { key: 'c5', kind: 'deworm', title: 'Odčervení', ageText: 'opakovaně dle veterináře', from: w(2), to: m(6), note: 'U štěňat se obvykle opakuje zhruba měsíčně do 6 měsíců. Domluv se s veterinářem.' },
    { key: 'c6', kind: 'vaccine', title: 'Přeočkování', ageText: 'kolem 12–15 měsíců', from: m(12), to: m(15) },
  ].map((c) => {
    const t = todayISO();
    const state = t > c.to ? 'past' : t >= c.from ? 'now' : 'next';
    return { ...c, state, mid: addDaysISO(c.from, Math.round(diffDays(c.from, c.to) / 2)) };
  });
}

// ---------- Referenční váhy (orientační střed, kg) ----------
// Zdroj: belpatt.fr – jen přibližné kotvy pro 3, 6 a 12 měsíců. Každý pes je jiný.
export const REF_WEIGHT = {
  m: [[3, 17.65], [6, 32.45], [12, 48]],
  f: [[3, 13.1], [6, 24.4], [12, 34.2]],
};

// ---------- Předvolby úkolů (opakující se denně) ----------
// days: dny v týdnu (0 = neděle … 6 = sobota); bez days = každý den. dose 'auto' = porce z kalkulačky krmení.
export const TASK_PRESETS = [
  { key: 'joints', id: 'preset_joints', emoji: '🦴', title: 'Výživa kloubů', kind: 'supplement', times: ['08:00'], dose: '2 tablety', note: 'Dávku a značku si ověř na obalu nebo u veterináře.' },
  { key: 'meals', id: 'preset_meals', emoji: '🍽️', title: 'Krmení', kind: 'meal', times: ['07:30', '11:30', '15:30', '19:30'], dose: 'auto', note: 'Porci spočítá záložka Zdraví → Krmení.' },
  { key: 'pill', emoji: '💊', title: 'Lék nebo tableta', kind: 'med', times: ['08:00'], dose: '1 tableta', note: '' },
  { key: 'brush', emoji: '🪮', title: 'Česání srsti', kind: 'other', times: ['18:00'], days: [3, 6], dose: '', note: 'Hustá dvojitá srst, 1–2× týdně, v línání častěji.' },
  { key: 'paws', emoji: '🐾', title: 'Kontrola tlapek a uší', kind: 'other', times: ['19:00'], days: [0], dose: '', note: '' },
];
export const TASK_KIND_LABEL = { supplement: 'Doplněk', meal: 'Krmení', med: 'Lék', other: 'Jiné' };

// ---------- Milníky ----------
export const MILESTONE_PRESETS = [
  'Přišel domů', 'První noc beze slz', 'První procházka venku', 'První návštěva u veterináře', 'První jízda autem',
  'První kamarád pes', 'První sníh', 'První koupání', 'Poprvé sám celou noc', 'Zvládl „sedni“', 'Zvládl přivolání',
  'Nová nejtěžší váha', 'První výlet do hor',
];

// ---------- Trackery polohy ----------
export const DEVICE_TYPES = [
  { key: 'tractive', label: 'Tractive (GPS obojek)', emoji: '📡', url: 'https://my.tractive.com/' },
  { key: 'airtag', label: 'Apple AirTag', emoji: '🏷️', url: 'https://www.icloud.com/find' },
  { key: 'smarttag', label: 'Samsung SmartTag', emoji: '🏷️', url: 'https://smartthingsfind.samsung.com/' },
  { key: 'google', label: 'Google Najít zařízení', emoji: '📍', url: 'https://www.google.com/android/find' },
  { key: 'other', label: 'Jiný tracker', emoji: '📡', url: '' },
];
export const DEVICE_BY = Object.fromEntries(DEVICE_TYPES.map((d) => [d.key, d]));
export const WHERE_OPTIONS = ['Doma', 'Na procházce', 'V autě', 'U veterináře', 'U kamaráda', 'U hlídání'];
