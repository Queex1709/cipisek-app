/* weather.js – počasí a rada, jestli jít ven (Open-Meteo, bez klíče a bez účtu).
   Poloha se zjišťuje až po klepnutí a ukládá se jen v tomto telefonu. Výsledek se 30 minut pamatuje. */
import { html, esc } from './util.js';
import { icon } from './ui.js';

const KEY = 'cipisek.wx';
const TTL = 30 * 60 * 1000;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* plné úložiště */ } };

const EMOJI = (c) => (c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : c <= 86 ? '🌨️' : '⛈️');

export async function fetchWeather(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), timezone: 'auto', forecast_days: 1,
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code',
    hourly: 'apparent_temperature,precipitation_probability',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!r.ok) throw new Error('Počasí se nenačetlo.');
  const j = await r.json();
  return {
    lat, lon, ts: Date.now(),
    temp: j.current.temperature_2m, feels: j.current.apparent_temperature, rain: j.current.precipitation, code: j.current.weather_code,
    hours: j.hourly.time.map((t, i) => ({ h: Number(t.slice(11, 13)), a: j.hourly.apparent_temperature[i], p: j.hourly.precipitation_probability[i] ?? 0 })),
  };
}

/** Rada pro pyrenejce: hustá srst = trápí ho horko víc než zima. */
export function advice(w, nowH = new Date().getHours()) {
  const a = w.feels;
  let tone = 'ok', text = 'Dobré počasí na procházku.';
  if (a >= 25) { tone = 'bad'; text = 'Horko. Pyrenejec s hustou srstí se snadno přehřeje. Ven jen ráno a pozdě večer, stín a voda s sebou, na rozpálený asfalt ho nepouštěj.'; }
  else if (a >= 20) { tone = 'warn'; text = 'Teplo. Kratší procházka ve stínu, voda s sebou a žádné hry na přímém slunci.'; }
  else if (a <= -10) { tone = 'bad'; text = 'Silný mráz. Štěně na to ještě nemá, jen krátce na potřebu a hned zpátky.'; }
  else if (a <= 0) { tone = 'warn'; text = 'Mráz. Pyrenejec zimu zvládá, ale hlídej led a posypovou sůl. Po procházce umyj tlapky.'; }
  if (w.rain > 0.2) { text += ' Prší: osuš ho, ať nezůstane mokrý.'; if (tone === 'ok') tone = 'warn'; }
  const score = (x) => (x.a > 20 ? (x.a - 20) * 2 : 0) + (x.a < -5 ? (-5 - x.a) * 1.5 : 0) + x.p / 10;
  const cand = w.hours.filter((x) => x.h >= Math.max(6, nowH) && x.h <= 21);
  const best = cand.length ? cand.reduce((m, x) => (score(x) < score(m) ? x : m)) : null;
  return { tone, text, best: best && best.h !== nowH && score(best) + 1 < score(cand.find((x) => x.h === nowH) || best) ? best.h : null };
}

function view(w) {
  const ad = advice(w);
  return html`<div class="wx wx-${ad.tone}">
    <div class="wx-main"><span class="wx-e" aria-hidden="true">${EMOJI(w.code)}</span>
      <div><b>${Math.round(w.temp)} °C</b><small>pocitově ${Math.round(w.feels)} °C</small></div>
      <button class="icon-btn" data-wx aria-label="Obnovit počasí">${icon('locate', 20)}</button></div>
    <p>${ad.text}</p>
    ${ad.best ? html`<p class="wx-best">Nejlepší čas dnes: kolem ${ad.best} h.</p>` : ''}</div>`;
}

export function card() {
  const w = read();
  return html`<section class="card" id="wxCard" aria-labelledby="h-wx"><h2 id="h-wx">Počasí na procházku</h2>
    <div id="wxBody">${w ? view(w) : html`<p class="muted small">Zjistím počasí tam, kde jste, a poradím, kdy je pro Cipíska nejlepší jít ven. Poloha zůstane jen v telefonu.</p>
      <button class="btn ghost" data-wx>${icon('locate', 18)} Zjistit počasí</button>`}</div></section>`;
}

const setBody = (htmlStr) => { const b = document.getElementById('wxBody'); if (b) b.innerHTML = htmlStr; };

function position() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Poloha není v tomto zařízení dostupná.'));
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), (e) => rej(new Error(e.code === 1 ? 'Povol v telefonu polohu pro tuto aplikaci.' : 'Polohu se nepodařilo zjistit.')), { timeout: 12000, maximumAge: 600000 });
  });
}

/** Klepnutí na tlačítko: zjistí polohu a počasí. */
export async function refreshNow() {
  setBody('<p class="muted small">Zjišťuji počasí…</p>');
  try {
    const c = await position();
    const w = await fetchWeather(c.latitude, c.longitude);
    write(w);
    setBody(String(view(w)));
  } catch (e) {
    const old = read();
    setBody(`<p class="muted small">${esc(e.message || 'Počasí se nenačetlo.')}</p><button class="btn ghost" data-wx>Zkusit znovu</button>${old ? '' : ''}`);
  }
}

/** Po vykreslení Dnes: když je uložená poloha a data jsou stará, tiše je obnoví. */
export async function hydrate() {
  const w = read();
  if (!w || Date.now() - w.ts < TTL || !navigator.onLine) return;
  try { const n = await fetchWeather(w.lat, w.lon); write(n); setBody(String(view(n))); } catch { /* zůstane poslední známé */ }
}
