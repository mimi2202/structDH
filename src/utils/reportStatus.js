// Checking status of each calculation report (a saved design): Draft ->
// Checked -> Issued, with who and when, and a revision letter that moves on
// each time a report is issued again after a change. Kept in this browser
// (localStorage `report_status`, keyed "<element>:<design id>") like the
// designs themselves.

const KEY = 'report_status';

export const STATUS = {
  draft: { label: 'Draft', note: 'Not checked yet' },
  checked: { label: 'Checked', note: 'Checked by a second engineer' },
  issued: { label: 'Issued', note: 'Issued for use' },
};

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const writeAll = (all) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full */ }
};
const keyOf = (d) => `${d.element}:${d.id}`;

// { status, revision, checked_by, checked_at, issued_by, issued_at, note, history[] }
export function getStatus(d) {
  return { status: 'draft', revision: null, history: [], ...(readAll()[keyOf(d)] || {}) };
}

const nextRevision = (rev) => (rev ? String.fromCharCode(rev.charCodeAt(0) + 1) : 'A');

// action: 'check' | 'issue' | 'draft'. person = name recorded; returns the new record.
export function setStatus(d, action, person, note = '') {
  const all = readAll();
  const cur = getStatus(d);
  const at = new Date().toISOString();
  let next = { ...cur };
  if (action === 'check') next = { ...cur, status: 'checked', checked_by: person, checked_at: at, note };
  else if (action === 'issue') {
    if (cur.status !== 'checked') throw new Error('Only a checked report can be issued.');
    next = { ...cur, status: 'issued', issued_by: person, issued_at: at, revision: nextRevision(cur.revision), note };
  } else if (action === 'draft') next = { ...cur, status: 'draft', note };
  next.history = [{ at, action, person, note, revision: next.revision }, ...(cur.history || [])].slice(0, 50);
  all[keyOf(d)] = next;
  writeAll(all);
  return next;
}

export function clearStatus(d) {
  const all = readAll();
  delete all[keyOf(d)];
  writeAll(all);
}
