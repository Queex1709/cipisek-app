# Cipísek – Průvodce & Deník

Rodinný deník a průvodce pro pyrenejského horského psa. Běží celý v telefonu (PWA), funguje offline a volitelně se dá sdílet s rodinou přes Firebase.

Žádný build, žádný backend, žádné npm. Je to čisté HTML, CSS a JavaScript (ES moduly).

## Co umí

| Záložka | Funkce |
|---|---|
| **Dnes** | Věk psa („2 měsíce a 22 dní“), rychlé zápisy (venku čůral / hovínko, nehoda doma, jídlo, spánek, poznámka), čistota za týden, aktuální vývojová fáze, nejbližší veterina, poslední váha, tip dne |
| **Procházky** | Satelitní mapa (Esri) s popisky, přepínač podkladu, kreslení trasy s přichycením na cesty a stezky (OSRM, pěšky), živé nahrávání přes GPS (pauza, obnova po zavření), délka v km, odhad času, doporučená délka pro věk štěněte, otevření v Google Mapách, uložené procházky |
| **Výchova** | Dovednosti s procenty a fázemi zvládnutí, logování tréninků (datum, hodnocení, poznámka), graf pokroku, série dní, průvodce po věkových fázích s přidáním dovednosti jedním klepnutím, socializační seznam |
| **Růst** | Fotky z foťáku nebo galerie (zmenšené v prohlížeči), váha k fotce, graf váhy s orientační křivkou plemene, porovnání „Předtím vs. Teď“ posuvníkem |
| **Zdraví** | Termíny s odpočtem, historie (očkování, odčervení, kontroly), orientační plán pro štěně, export termínu do kalendáře (.ics s upozorněním den předem) |
| **Nastavení** | Profil psa, kdo zapisuje, sdílení v rodině, záloha a obnova, instalace |

## Vlastní nápady navíc oproti zadání

- **Rodinné sdílení** přes pozvánkový odkaz (ty + máma vidíte stejná data; u každého zápisu je vidět, kdo ho zapsal).
- **Rychlý deník dne** – čistota je u štěněte nejčastější starost, zápis je na jedno klepnutí a s tlačítkem Zpět.
- **Okno socializace** – odpočet do 16. týdne věku.
- **Délka procházky podle věku** (5 minut za měsíc) a varování, když je nakreslená trasa moc dlouhá.
- **Plán pro štěně** včetně povinného čipu a registru psů (od 1. 7. 2026 Centrální evidence psů).
- **Fáze zvládnutí** místo holých procent: Seznamujeme se → Učíme se → Bez návnady → S rozptýlením → Zvládnuto.
- Záloha do souboru (převod dat z prohlížeče do nainstalované aplikace nebo na jiný telefon).

## Spuštění na počítači

```bash
cd cipisek
python3 -m http.server 8000
```

Otevři `http://localhost:8000`. Na `localhost` fungují i GPS a service worker. Na telefonu jinak **vyžaduje https** (kvůli GPS, instalaci a offline režimu).

## Nasazení (potřeba pro telefon)

Stačí jakýkoli statický hosting s https. Nejjednodušší:

1. **GitHub Pages** – nahraj složku do repozitáře, Settings → Pages → Deploy from branch → `main` / `/ (root)`. Výsledek: `https://tvoje-jmeno.github.io/repo/`.
2. **Netlify Drop** – otevři app.netlify.com/drop a přetáhni složku.
3. **Render → Static Site** – bez build příkazu, publish directory `.`.

Aplikace používá relativní cesty, takže funguje i v podadresáři (GitHub Pages).

## Instalace do telefonu

- **Android (Chrome):** otevři adresu → menu ⋮ → *Instalovat aplikaci*. Nebo v Nastavení aplikace tlačítko *Nainstalovat aplikaci*.
- **iPhone (Safari):** Sdílet → *Přidat na plochu*.

## Sdílení s mámou (Firebase, zdarma)

Jednorázově, asi 10 minut:

1. [console.firebase.google.com](https://console.firebase.google.com) → vytvoř projekt (Analytics nepotřebuješ).
2. **Build → Authentication** → Get started → Sign-in method → **Anonymous** → zapnout.
3. **Build → Firestore Database** → Create database (production mode, region `eur3`). V záložce **Rules** vlož a dej Publish:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /families/{family}/{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. **Project settings → Your apps → Web (`</>`)** → zaregistruj aplikaci a zkopíruj `firebaseConfig`.
5. V aplikaci **Nastavení → Sdílení v rodině** vlož konfiguraci → *Zapnout sdílení*.
6. **Pozvat do rodiny** → pošli odkaz mámě (třeba přes WhatsApp). Otevře se u ní aplikace, zadá jméno a je připojená.

Jak to funguje: každý telefon má všechna data u sebe (funguje offline) a změny se synchronizují s Firestore. Při souběžné změně téhož záznamu vyhrává poslední zápis. Smazání se synchronizuje také. Fotky jsou po zmenšení v dokumentech `families/{kód}/photos/` a stahují se do ostatních telefonů samy.

Zabezpečení: databázi chrání nehádatelný rodinný kód (14 náhodných znaků) v cestě dokumentu. Kdo odkaz z pozvánky nemá, data nenajde. Odkaz proto posílej jen rodině.

> Sdílení jsem nemohl vyzkoušet proti živému Firebase projektu (to vyžaduje tvůj účet). Načítání, offline chování a chybové stavy jsou ověřené, samotný přenos dat prosím vyzkoušej na dvou telefonech a dej vědět, jestli se něco zasekne.

## Zabalení do .apk

### A) PWABuilder (nejrychlejší, doporučuju)

1. Nasaď aplikaci na https (viz výše).
2. [pwabuilder.com](https://www.pwabuilder.com) → vlož adresu → *Package for stores* → **Android**.
3. Stáhneš zip s `.apk` (a `.aab` pro Google Play) a podpisovým klíčem. **Klíč si uschovej**, bez něj nejde aplikaci aktualizovat.
4. Apk pošli do telefonu a povol instalaci z neznámých zdrojů.

Je to TWA: Chrome v plné obrazovce načítá tvoji adresu. Aktualizace aplikace tedy stačí nahrát na hosting, apk se nemusí stavět znovu.

### B) Capacitor (soubory přímo v aplikaci)

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init Cipisek cz.cipisek.app --web-dir=.
npx cap add android
npx cap sync
npx cap open android      # v Android Studiu: Build → Build APK
```

Do `android/app/src/main/AndroidManifest.xml` přidej oprávnění pro GPS:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Pozor: data v apk (Capacitor) a data v prohlížeči jsou oddělená. Převedeš je zálohou (Nastavení → Záloha dat).

## Data a záloha

- Záznamy: `localStorage` (klíč `cipisek.v1`), fotky: IndexedDB (`cipisek-photos`).
- Mazání dat prohlížeče nebo odinstalace aplikace smaže i data. Proto **pravidelně stáhni zálohu** nebo zapni sdílení.

## Struktura

```
index.html            kostra, horní lišta, spodní navigace
manifest.webmanifest  PWA (ikony, barvy, zkratky)
sw.js                 offline cache (při změně souborů zvyš VERSION)
css/                  style.css, fonts.css
js/
  app.js              router, úvodní nastavení, PWA, pozvánky
  store.js            jediné místo s daty (localStorage), záznamy s id, časem a „náhrobky“
  sync.js             volitelný Firebase Firestore (local-first)
  photodb.js          fotky v IndexedDB + komprese
  tracker.js          GPS nahrávání trasy
  domain.js           odvozená data (váha, série, pokrok)
  data.js             obsah průvodce, dovednosti, plán pro štěně
  util.js, ui.js      pomocné funkce, spodní okna, grafy
  views/              today, walks, training, growth, health, settings
vendor/               Leaflet a Firebase SDK (lokálně, bez CDN)
```

Datový model je záměrně připravený na databázi: každý záznam má `id`, `createdAt`, `updatedAt`, `by` a případně `deletedAt`. Chceš-li jinou databázi než Firebase, stačí přepsat `js/sync.js`, zbytek aplikace se nemění.

## Použité služby

- Satelitní snímky a popisky: Esri World Imagery / Reference (pro osobní nekomerční použití).
- Mapa: OpenStreetMap tiles. Trasy pěšky: `routing.openstreetmap.de` (veřejná služba, bez záruky dostupnosti; při výpadku se použije přímá čára).
- Písmo Bricolage Grotesque (SIL OFL), Leaflet (BSD-2), Firebase SDK (Apache-2.0), všechno bundlované v projektu.

## Důležité upozornění

Rady k výchově, zdraví a socializaci jsou obecné a orientační. Termíny očkování a odčervení určuje veterinář. Křivka váhy je jen střed z veřejných tabulek, každý pes roste jinak.

Zdroje obsahu: schéma očkování (Royal Canin CZ), povinné čipování a Centrální evidence psů (finance.cz, muj-pravnik.cz, MZe), referenční váhy pyrenejského horského psa (belpatt.fr).
