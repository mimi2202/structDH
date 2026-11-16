// Design activity: one count per successful design calculation, per user, per
// local calendar day. Written by services/api.js after each design request
// returns 200; read by the dashboard heatmap and the streak card.
//
// localStorage `design_activity` = { [userId]: { "YYYY-MM-DD": count } }
// (kept in the browser: there is no backend store for users yet).

const KEY = 'design_activity';
const EVENT = 'design-activity';

const hasStorage = () => typeof localStorage !== 'undefined';

// Local date, not UTC: a design at 00:30 belongs to today.
export const dayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};

const currentUserId = () => {
  try {
    const raw = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    return raw ? JSON.parse(raw).id || 'anonymous' : 'anonymous';
  } catch { return 'anonymous'; }
};

export function recordDesign() {
  if (!hasStorage()) return; // e.g. api.js bundled and run from Node
  try {
    const all = readAll();
    const uid = currentUserId();
    const today = dayKey();
    const days = all[uid] || {};
    days[today] = (days[today] || 0) + 1;
    all[uid] = days;
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage full or blocked: activity is a convenience */ }
}

export function getActivity(userId) {
  if (!hasStorage()) return {};
  return readAll()[userId || currentUserId()] || {};
}

export const onActivityChange = (fn) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', fn); };
};

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Days in a row with at least one design. The current streak counts back from
// today, or from yesterday when nothing has been designed yet today (so the
// streak is not shown as broken in the morning).
export function streaks(days, today = new Date()) {
  const has = (d) => (days[dayKey(d)] || 0) > 0;
  let start = has(today) ? today : addDays(today, -1);
  let current = 0;
  while (has(start)) { current += 1; start = addDays(start, -1); }

  const keys = Object.keys(days).filter((k) => days[k] > 0).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, activeToday: has(today) };
}

// GitHub-style grid: columns are weeks (Sunday first), the last column holds
// today; `weeks` columns in all. Future days in the last week are null.
export function calendarWeeks(days, weeks = 53, today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = addDays(end, -(end.getDay() + 7 * (weeks - 1)));
  const cols = [];
  for (let w = 0; w < weeks; w += 1) {
    const col = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, w * 7 + i);
      col.push(d > end ? null : { date: dayKey(d), count: days[dayKey(d)] || 0, d });
    }
    cols.push(col);
  }
  return cols;
}

// 0 = none, then 1, 2-3, 4-6, 7+ designs in a day.
export const activityLevel = (count) => (
  count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4
);

export function summary(days, today = new Date()) {
  const weekStart = addDays(today, -today.getDay());
  const yearAgo = addDays(today, -364);
  let thisWeek = 0;
  let lastYear = 0;
  let lastActive = null;
  for (const [k, n] of Object.entries(days)) {
    if (!n) continue;
    const d = new Date(`${k}T12:00:00`);
    if (dayKey(d) >= dayKey(weekStart) && dayKey(d) <= dayKey(today)) thisWeek += n;
    if (dayKey(d) >= dayKey(yearAgo)) lastYear += n;
    if (!lastActive || k > lastActive) lastActive = k;
  }
  return { thisWeek, lastYear, lastActive };
}
