// src/services/chatService.js
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ DEMO ADAPTER. Messages live in this browser's localStorage and reach     │
// │ other tabs of the same browser through BroadcastChannel. Nothing goes to │
// │ a server. To make chat real, re-implement the functions below against    │
// │ the backend and keep their names, arguments and return shapes; the UI    │
// │ (components/chat/ProjectChat.jsx, ChatBubble.jsx) only talks to this     │
// │ module.                                                                  │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Data shapes
//   Channel  { id, project_id, kind: 'general' | 'design', name,
//              design_ref: { element, id, name } | null,   // kind 'design'
//              resolved: boolean,                          // design threads
//              created_at, last_message_at }
//   Message  { id, channel_id, author: { id, name, email }, body,
//              mentions: [userId], created_at, edited_at: null,
//              system: boolean }                           // e.g. "resolved"
//
// Suggested backend (what the real adapter would call)
//   GET    /api/projects/:projectId/channels                -> Channel[]
//   POST   /api/projects/:projectId/channels                -> Channel   body { kind, name, design_ref }
//   PATCH  /api/channels/:channelId                         -> Channel   body { resolved }
//   GET    /api/channels/:channelId/messages?before=&limit= -> Message[] (oldest first)
//   POST   /api/channels/:channelId/messages                -> Message   body { body, mentions }
//   POST   /api/channels/:channelId/read                    -> { last_read_at }
//   GET    /api/projects/:projectId/unread                  -> { [channelId]: count }
//   WS     /ws/projects/:projectId  events: message.created, channel.created, channel.updated
// Authorisation: anyone who can see the project (organisation member, or the
// owner of a personal project) can read and post; the server must check it.
//
// All functions are async so the real adapter can drop in unchanged.

const K = { channels: 'chat_channels', messages: 'chat_messages', reads: 'chat_reads' };
const BUS = 'sdh-chat';
const MAX_PER_CHANNEL = 500;

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const now = () => new Date().toISOString();
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

let bus = null;
const getBus = () => {
  if (!bus && typeof BroadcastChannel !== 'undefined') bus = new BroadcastChannel(BUS);
  return bus;
};
const listeners = new Set();
const emit = (event) => {
  listeners.forEach((fn) => fn(event));        // this tab
  try { getBus()?.postMessage(event); } catch { /* closed */ }  // other tabs
};
if (typeof window !== 'undefined') {
  const b = getBus();
  if (b) b.onmessage = (e) => listeners.forEach((fn) => fn(e.data));
}

// Every project has a "General" channel; design threads are added on demand.
async function ensureGeneral(projectId) {
  const all = read(K.channels, []);
  if (all.some((c) => c.project_id === projectId && c.kind === 'general')) return;
  all.push({ id: uid('ch'), project_id: projectId, kind: 'general', name: 'General', design_ref: null, resolved: false, created_at: now(), last_message_at: null });
  write(K.channels, all);
}

/** Channels of a project: General first, then design threads (open before resolved, newest activity first). */
export async function listChannels(projectId) {
  await ensureGeneral(projectId);
  return read(K.channels, [])
    .filter((c) => c.project_id === projectId)
    .sort((a, b) => (a.kind === 'general' ? -1 : b.kind === 'general' ? 1
      : (a.resolved - b.resolved) || String(b.last_message_at || b.created_at).localeCompare(String(a.last_message_at || a.created_at))));
}

/** The review thread for one saved design, created if missing. design = { element, id, name } */
export async function openDesignThread(projectId, design) {
  const all = read(K.channels, []);
  let ch = all.find((c) => c.project_id === projectId && c.kind === 'design' && c.design_ref?.id === design.id && c.design_ref?.element === design.element);
  if (!ch) {
    ch = { id: uid('ch'), project_id: projectId, kind: 'design', name: design.name, design_ref: { element: design.element, id: design.id, name: design.name }, resolved: false, created_at: now(), last_message_at: null };
    write(K.channels, [...all, ch]);
    emit({ type: 'channel.created', channel: ch });
  }
  return ch;
}

/** Messages of a channel, oldest first. */
export async function listMessages(channelId) {
  return (read(K.messages, {})[channelId] || []);
}

/** Post a message. author = { id, name, email }. Returns the Message. */
export async function sendMessage(channelId, author, body, mentions = []) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Empty message');
  const msg = { id: uid('msg'), channel_id: channelId, author: { id: author.id, name: author.name || author.email, email: author.email || '' }, body: text, mentions, created_at: now(), edited_at: null, system: false };
  const all = read(K.messages, {});
  all[channelId] = [...(all[channelId] || []), msg].slice(-MAX_PER_CHANNEL);
  write(K.messages, all);
  write(K.channels, read(K.channels, []).map((c) => (c.id === channelId ? { ...c, last_message_at: msg.created_at } : c)));
  emit({ type: 'message.created', message: msg });
  return msg;
}

/** Mark a design thread resolved / reopened (adds a system message). */
export async function setResolved(channelId, resolved, author) {
  let updated = null;
  write(K.channels, read(K.channels, []).map((c) => (c.id === channelId ? (updated = { ...c, resolved }) : c)));
  const all = read(K.messages, {});
  const sys = { id: uid('msg'), channel_id: channelId, author: { id: author.id, name: author.name || author.email, email: author.email || '' }, body: resolved ? 'marked this thread resolved' : 'reopened this thread', mentions: [], created_at: now(), edited_at: null, system: true };
  all[channelId] = [...(all[channelId] || []), sys];
  write(K.messages, all);
  emit({ type: 'channel.updated', channel: updated });
  emit({ type: 'message.created', message: sys });
  return updated;
}

/** Record that userId has read the channel up to now. */
export async function markRead(channelId, userId) {
  const all = read(K.reads, {});
  all[`${userId}:${channelId}`] = now();
  write(K.reads, all);
  emit({ type: 'read', channel_id: channelId, user_id: userId });
}

/** Unread messages per channel for a user: { [channelId]: count } (own messages never count). */
export async function unreadCounts(projectId, userId) {
  const reads = read(K.reads, {});
  const msgs = read(K.messages, {});
  const out = {};
  for (const c of read(K.channels, []).filter((x) => x.project_id === projectId)) {
    const since = reads[`${userId}:${c.id}`] || '';
    out[c.id] = (msgs[c.id] || []).filter((m) => m.author.id !== userId && m.created_at > since).length;
  }
  return out;
}

/** Live updates. fn(event) for message.created / channel.created / channel.updated / read. Returns unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => { if (e.key && e.key.startsWith('chat_')) fn({ type: 'storage' }); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

export const IS_DEMO = true;
