/* tasks.js – opakující se úkoly (prášky, krmení…), odškrtávání sdílené v rodině a upozornění.

   Úkol (tasks):    {title, emoji, kind, times:['08:00'], days?:[0-6], dose, startDate, endDate?, note, active}
   Odškrtnutí (tasklogs): id = `${task}_${datum}_${čas}` → když zapíšou oba naráz, vznikne jeden záznam.

   Upozornění: když je aplikace otevřená, ukáže se hláška (a v pozadí systémové oznámení).
   Pokud je aplikace zavřená, budík zajistí kalendář (.ics s opakováním), protože webová aplikace
   se sama od sebe v pozadí spustit nemůže. */
import * as store from './store.js';
import { todayISO, minutesOf, downloadBlob, parseISO } from './util.js';
import { toast } from './ui.js';
import * as feeding from './feeding.js';

export const slotId = (taskId, date, time) => `${taskId}_${date}_${time.replace(':', '')}`;

export function appliesOn(task, date) {
  if (task.active === false) return false;
  if (task.startDate && date < task.startDate) return false;
  if (task.endDate && date > task.endDate) return false;
  if (task.days?.length && task.days.length < 7) return task.days.includes(parseISO(date).getDay());
  return true;
}

/** Všechna odškrtávací políčka pro daný den (úkol × čas), seřazená podle času. */
export function slotsFor(date) {
  const logs = new Map(store.list('tasklogs').filter((l) => l.date === date).map((l) => [l.id, l]));
  const out = [];
  for (const task of store.list('tasks')) {
    if (!appliesOn(task, date)) continue;
    for (const time of task.times || []) {
      const id = slotId(task.id, date, time);
      out.push({ id, task, time, date, log: logs.get(id) || null });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.task.title.localeCompare(b.task.title, 'cs'));
}

/** done | due (je čas) | late (přes hodinu po čase) | later | missed */
export function slotState(slot) {
  if (slot.log) return 'done';
  const today = todayISO();
  if (slot.date < today) return 'missed';
  if (slot.date > today) return 'later';
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();
  const t = minutesOf(slot.time);
  return cur >= t + 60 ? 'late' : cur >= t ? 'due' : 'later';
}

export function toggleSlot(slot) {
  if (slot.log) { store.del('tasklogs', slot.id); return false; }
  store.put('tasklogs', { id: slot.id, taskId: slot.task.id, date: slot.date, time: slot.time, ts: Date.now() });
  return true;
}

export const doseText = (task) => (task.dose === 'auto' ? feeding.mealDoseText((task.times || []).length) : task.dose || '');

/** Při prvním spuštění přidá úkol „Výživa kloubů – 2 tablety denně“. Pevné id brání duplicitám při sdílení. */
export function seedDefaults() {
  if (localStorage.getItem('cipisek.seeded.v2')) return;
  localStorage.setItem('cipisek.seeded.v2', '1');
  if (store.allRaw('tasks').some((t) => t.id === 'preset_joints')) return;
  store.put('tasks', {
    id: 'preset_joints', emoji: '🦴', title: 'Výživa kloubů', kind: 'supplement', times: ['08:00'], dose: '2 tablety',
    startDate: todayISO(), note: 'Dávku a značku si ověř na obalu nebo u veterináře.', active: true,
  });
}

// ---------- upozornění ----------
const NKEY = 'cipisek.notified';
let timer = null;

function loadNotified() {
  try {
    const o = JSON.parse(localStorage.getItem(NKEY) || '{}');
    const t = todayISO();
    for (const k of Object.keys(o)) if (o[k] !== t) delete o[k];
    return o;
  } catch { return {}; }
}

export function startReminders() {
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

function tick() {
  const today = todayISO();
  const notified = loadNotified();
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();
  let changed = false;
  for (const s of slotsFor(today)) {
    if (s.log || notified[s.id]) continue;
    const t = minutesOf(s.time);
    if (cur < t || cur > t + 120) continue;
    notified[s.id] = today;
    changed = true;
    fire(s);
  }
  if (changed) { try { localStorage.setItem(NKEY, JSON.stringify(notified)); } catch { /* nic */ } }
}

function fire(s) {
  const dose = doseText(s.task);
  const msg = `${s.task.emoji || '🔔'} ${s.task.title}${dose ? ` – ${dose}` : ''}`;
  if (document.hidden) {
    if (store.getSettings().notifOn) notify(`${store.getMeta().name}: ${s.task.title}`, dose || 'Je čas', s.id);
    return;
  }
  toast(msg, {
    label: 'Hotovo', ms: 25000,
    onClick: () => { toggleSlot(s); window.dispatchEvent(new Event('cipisek:tasks')); },
  });
}

async function notify(title, body, tag) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/dnes' } });
    else new Notification(title, { body, tag });
  } catch (e) { console.warn('Oznámení se nepodařilo zobrazit', e); }
}

export const notificationsSupported = () => 'Notification' in window;
export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  store.setSettings({ notifOn: p === 'granted' });
  return p;
}

// ---------- budík do kalendáře (.ics s opakováním) ----------
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const ics = (x) => String(x).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function icsForTask(task) {
  const name = store.getMeta().name;
  const start = task.startDate && task.startDate > todayISO() ? task.startDate : todayISO();
  const ymd = start.replaceAll('-', '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const weekly = task.days?.length && task.days.length < 7;
  const rule = (weekly ? `FREQ=WEEKLY;BYDAY=${task.days.map((d) => BYDAY[d]).join(',')}` : 'FREQ=DAILY')
    + (task.endDate ? `;UNTIL=${task.endDate.replaceAll('-', '')}T235959` : '');
  const dose = doseText(task);
  const summary = `${name}: ${task.title}${dose ? ` – ${dose}` : ''}`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cipisek//CS', 'CALSCALE:GREGORIAN'];
  for (const time of task.times || []) {
    const [h, m] = time.split(':');
    lines.push(
      'BEGIN:VEVENT', `UID:${task.id}-${time.replace(':', '')}@cipisek`, `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${h.padStart(2, '0')}${m}00`, 'DURATION:PT10M', `RRULE:${rule}`,
      `SUMMARY:${ics(summary)}`, ...(task.note ? [`DESCRIPTION:${ics(task.note)}`] : []),
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${ics(summary)}`, 'END:VALARM', 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadTaskIcs(task) {
  const slug = task.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadBlob(new Blob([icsForTask(task)], { type: 'text/calendar;charset=utf-8' }), `${slug || 'ukol'}.ics`);
}
