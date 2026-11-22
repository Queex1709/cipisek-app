/* aid.js – první pomoc a jedovaté věci (záložka v Zdraví). Obecné zásady, nenahrazují veterináře. */
export const URGENT = [
  'Zkolaboval, nedá se probudit, má křeče nebo se dusí.',
  'Tvrdé, nafouknuté bříško, marné dávení, slinění a neklid (hrozí torze žaludku, obří plemena jsou ohrožená).',
  'Silné nebo nezastavitelné krvácení, pád z výšky, srážka s autem.',
  'Snědl něco jedovatého nebo neznámého.',
  'Dýchá s námahou, má bledé nebo modré dásně, je přehřátý.',
  'Štěně opakovaně zvrací, má průjem s krví, je apatické nebo týden není ochotné jíst či pít.',
];

export const TOPICS = [
  { e: '🫨', t: 'Nafouknuté bříško (torze žaludku)', steps: [
    'Je to akutní stav ohrožující život. Jeď na veterinu hned, nečekej do rána.',
    'Předem zavolej, ať se na tebe připraví.',
    'Neprovokuj zvracení a nic nedávej.',
    'Prevence u velkých plemen: víc menších porcí, po jídle klid, žádné běhání před ani hodinu po jídle.'] },
  { e: '☠️', t: 'Otrava', steps: [
    'Odeber mu, co ještě zbývá, a vyplivni to z tlamy, jde-li to bezpečně.',
    'Zjisti co, kolik a kdy snědl. Vezmi s sebou obal nebo vzorek.',
    'Okamžitě volej veterináře a řiď se jeho pokyny.',
    'Zvracení nevyvolávej, dokud ti to veterinář neřekne. U některých látek by to uškodilo.',
    'Nepodávej mléko, olej ani domácí léky.'] },
  { e: '🌡️', t: 'Úpal a přehřátí', steps: [
    'Okamžitě do stínu nebo chladné místnosti.',
    'Polévej ho chladnou (ne ledovou) vodou, hlavně břicho, tlapky a třísla. Dej mu napít.',
    'Jakmile je to možné, jeď k veterináři, i když se zdá, že je mu líp.',
    'Nikdy ho nenech v autě, ani na pár minut.'] },
  { e: '🐍', t: 'Uštknutí zmijí a žihadlo', steps: [
    'Nech ho v klidu a co nejméně se hýbat, malého štěněte ho radši vezmi do náruče.',
    'Nic nevyřezávej, nevysávej ani nepodvazuj.',
    'Jeď co nejrychleji k veterináři.',
    'Otok v tlamě nebo na krku po žihadle, potíže s dechem: ihned veterina.'] },
  { e: '🤮', t: 'Zvracení a průjem', steps: [
    'Štěně se rychle vysuší. Jednou zvracet nebo mít řidší stolici může po změně krmiva.',
    'K veterináři, když zvrací víc než dvakrát, má krev, je apatické, nechce pít nebo to trvá déle než den.',
    'Dej mu k dispozici čerstvou vodu v malých dávkách. Žádné léky pro lidi.',
    'Nezapomeň, jestli nesnědl něco z venku nebo z odpadků.'] },
  { e: '🦴', t: 'Dušení a cizí předmět', steps: [
    'Podívej se do tlamy. Co je vidět a dá se vzít bez tlačení hlouběji, vytáhni.',
    'Když se dusí a nedýchá, jeď ihned na veterinu a cestou volej.',
    'Pozor na vařené kosti, kamínky, kousky hraček a punčochy. Mohou způsobit ucpání střeva.'] },
  { e: '🩸', t: 'Krvácení a rány', steps: [
    'Přilož čistý obvaz nebo látku a tlač přímo na ránu.',
    'Zabodnutý předmět neodstraňuj, zafixuj ho a jeď k veterináři.',
    'Hluboké, velké nebo kousnuté rány vždy vyšetří veterinář.'] },
  { e: '🐾', t: 'Tlapky v zimě', steps: [
    'Po procházce umyj tlapky vlažnou vodou, aby nelízal sůl.',
    'Mezi polštářky se mohou sbírat ledové hrudky, vyčisti je.',
    'Červené, popraskané nebo krvavé tlapky ukaž veterináři.'] },
];

export const TOXIC = [
  ['🍫', 'Čokoláda, kakao a káva'], ['🍇', 'Hrozny a rozinky'], ['🍬', 'Xylitol (sladidlo ve žvýkačkách, sladkostech, pečivu bez cukru)'],
  ['🧅', 'Cibule, česnek, pórek, jarní cibulka'], ['🥑', 'Avokádo, makadamové ořechy'], ['🍺', 'Alkohol a těsto s droždím'],
  ['💊', 'Léky pro lidi (ibuprofen, paracetamol) a antidepresiva'], ['🧪', 'Nemrznoucí směs, jed na krysy a slimáky, čisticí prostředky'],
  ['🍖', 'Uzeniny, slané a kořeněné jídlo, tučné zbytky ze stolu'], ['🎄', 'Vánoce: cukroví, čokoláda, jmelí a svíčky na stromečku'],
];
