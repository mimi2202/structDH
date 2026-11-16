// Organisations, memberships, invitations and the audit log, kept in this
// browser's localStorage (there is no backend for accounts yet). Every change
// goes through here and is checked against utils/orgRbac.js, so the pages
// cannot do what the actor's role does not allow.
//
//   mock_workspaces  [{ id, name, industry, description, website, owner_id, created_at, ... }]
//   mock_members     [{ id, workspace_id, user_id|null, email, name, role,
//                       status: 'active'|'invited', invited_by, invited_at, joined_at }]
//   org_audit        { [orgId]: [{ at, actor_id, actor_name, action, target, detail }] }
//   mock_projects    projects; workspace_id = organisation id or null (personal)
//
// The key names predate this file (other pages read them) and are kept.

import { can, canManage, assignableRoles, roleLabel } from './orgRbac';

const K = { orgs: 'mock_workspaces', members: 'mock_members', projects: 'mock_projects', audit: 'org_audit', users: 'local_users' };
const AUDIT_MAX = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const read = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
};
// Every write tells open pages (notification bell, lists) to re-read.
export const ORG_EVENT = 'org-data';
const write = (key, v) => {
  localStorage.setItem(key, JSON.stringify(v));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ORG_EVENT));
};
const now = () => new Date().toISOString();
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const norm = (e) => String(e || '').trim().toLowerCase();

const orgs = () => read(K.orgs, []);
const members = () => read(K.members, []);
const fail = (error) => ({ success: false, error });

function audit(orgId, actor, action, target = '', detail = '') {
  const all = read(K.audit, {});
  const list = all[orgId] || [];
  list.unshift({ at: now(), actor_id: actor?.id || null, actor_name: actor?.name || actor?.email || 'Unknown', action, target, detail });
  all[orgId] = list.slice(0, AUDIT_MAX);
  write(K.audit, all);
}

export const getAudit = (orgId) => read(K.audit, {})[orgId] || [];

// Browsers used before 2026-11-16 still hold the sample data the app used to
// seed (ws-1 "Acme Engineering", ws-2 "Personal Projects", proj-1..5, their
// members and invites). Removed once, keeping anything the user made; user
// projects that sat in a sample organisation become personal. Runs before
// migrate() so a sample organisation is never adopted as the user's own.
const SAMPLE_WS = ['ws-1', 'ws-2'];
const SAMPLE_FLAG = 'sample_data_removed_v1';
export function removeSampleData() {
  if (localStorage.getItem(SAMPLE_FLAG)) return;
  const keep = (key, isSample) => localStorage.setItem(key, JSON.stringify(read(key, []).filter((x) => !isSample(x))));
  keep(K.orgs, (w) => SAMPLE_WS.includes(w.id));
  keep(K.projects, (p) => /^proj-[1-5]$/.test(p.id));
  keep(K.members, (m) => SAMPLE_WS.includes(m.workspace_id));
  keep('mock_pending_invites', (i) => SAMPLE_WS.includes(i.workspace_id));
  keep('mock_failed_invites', (i) => SAMPLE_WS.includes(i.workspace_id));
  localStorage.setItem(K.projects, JSON.stringify(read(K.projects, []).map((p) =>
    SAMPLE_WS.includes(p.workspace_id) ? { ...p, workspace_id: null } : p)));
  localStorage.setItem(SAMPLE_FLAG, '1');
}

// Older data: organisations made before memberships were recorded have no
// owner row. The first signed-in user to open them (the creator, in practice)
// becomes the owner; member rows without a status are active.
function migrate(user) {
  removeSampleData();
  if (!user) return;
  let ms = members();
  let changed = false;
  ms = ms.map((m) => (m.status ? m : (changed = true, { ...m, status: 'active', email: m.email || '' })));
  const list = orgs().map((o) => {
    if (ms.some((m) => m.workspace_id === o.id && m.role === 'owner')) return o;
    ms.push({
      id: uid('mem'), workspace_id: o.id, user_id: user.id, email: user.email || '', name: user.name || user.email,
      role: 'owner', status: 'active', joined_at: o.created_at || now(),
    });
    changed = true;
    return { ...o, owner_id: user.id };
  });
  if (changed) { write(K.members, ms); write(K.orgs, list); }
}

const membership = (orgId, user) => user && members().find((m) =>
  m.workspace_id === orgId && m.status === 'active' && m.user_id === user.id);

export const roleIn = (orgId, user) => membership(orgId, user)?.role || null;

// Organisations the user belongs to, each with the user's role and counts.
export function listOrgsForUser(user) {
  migrate(user);
  if (!user) return [];
  const ms = members();
  const projects = read(K.projects, []);
  return orgs()
    .map((o) => {
      const mine = ms.find((m) => m.workspace_id === o.id && m.status === 'active' && m.user_id === user.id);
      if (!mine) return null;
      const orgMembers = ms.filter((m) => m.workspace_id === o.id);
      return {
        ...o,
        userRole: mine.role,
        member_count: orgMembers.filter((m) => m.status === 'active').length,
        invite_count: orgMembers.filter((m) => m.status === 'invited').length,
        project_count: projects.filter((p) => p.workspace_id === o.id).length,
      };
    })
    .filter(Boolean);
}

export function getOrg(orgId, user) {
  return listOrgsForUser(user).find((o) => o.id === orgId) || null;
}

export function getMembers(orgId) {
  return members().filter((m) => m.workspace_id === orgId)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
}

// Invitations waiting for this user's email.
export function listInvitesForUser(user) {
  if (!user?.email) return [];
  const all = orgs();
  return members()
    .filter((m) => m.status === 'invited' && norm(m.email) === norm(user.email))
    .map((m) => ({ ...m, org: all.find((o) => o.id === m.workspace_id) }))
    .filter((m) => m.org);
}

export function createOrg(user, data) {
  if (!user) return fail('Sign in first.');
  const name = String(data.name || '').trim();
  if (!name) return fail('Give the organisation a name.');
  if (orgs().some((o) => norm(o.name) === norm(name) && roleIn(o.id, user))) {
    return fail('You already belong to an organisation with that name.');
  }
  const org = {
    id: `ws-${Date.now()}`,
    name,
    industry: data.industry || '',
    description: String(data.description || '').trim(),
    website: String(data.website || '').trim(),
    country: String(data.country || '').trim(),
    owner_id: user.id,
    created_by: user.id,
    created_at: now(),
    updated_at: now(),
  };
  write(K.orgs, [...orgs(), org]);
  write(K.members, [...members(), {
    id: uid('mem'), workspace_id: org.id, user_id: user.id, email: user.email || '', name: user.name || user.email,
    role: 'owner', status: 'active', joined_at: now(),
  }]);
  audit(org.id, user, 'org.create', name, 'Organisation created; creator is Owner');
  return { success: true, org };
}

export function updateOrg(user, orgId, patch) {
  if (!can(roleIn(orgId, user), 'org.edit')) return fail('Only the Owner or an Admin can edit organisation details.');
  const name = patch.name !== undefined ? String(patch.name).trim() : undefined;
  if (name !== undefined && !name) return fail('The name cannot be empty.');
  const allowed = ['name', 'industry', 'description', 'website', 'country'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)).map(([k, v]) => [k, String(v ?? '').trim()]));
  const before = orgs().find((o) => o.id === orgId);
  const changedKeys = Object.keys(clean).filter((k) => (before?.[k] || '') !== clean[k]);
  if (!changedKeys.length) return { success: true };
  write(K.orgs, orgs().map((o) => (o.id === orgId ? { ...o, ...clean, updated_at: now() } : o)));
  audit(orgId, user, 'org.update', '', `Changed ${changedKeys.join(', ')}`);
  return { success: true };
}

export function inviteMember(user, orgId, email, role) {
  const actor = roleIn(orgId, user);
  if (!can(actor, 'members.invite')) return fail('Only the Owner or an Admin can invite members.');
  if (!assignableRoles(actor).includes(role)) return fail(`As ${roleLabel(actor)} you cannot invite someone as ${roleLabel(role)}.`);
  const e = norm(email);
  if (!EMAIL_RE.test(e)) return fail('Enter a valid email address.');
  const existing = members().find((m) => m.workspace_id === orgId && norm(m.email) === e);
  if (existing) return fail(existing.status === 'invited' ? 'That email already has a pending invitation.' : 'That person is already a member.');
  const account = read(K.users, []).find((u) => norm(u.email) === e);
  const row = {
    id: uid('mem'), workspace_id: orgId, user_id: null, email: e, name: account?.name || e.split('@')[0],
    role, status: 'invited', invited_by: user.id, invited_by_name: user.name || user.email, invited_at: now(),
  };
  write(K.members, [...members(), row]);
  audit(orgId, user, 'member.invite', e, `Invited as ${roleLabel(role)}`);
  return { success: true, member: row };
}

export function acceptInvite(user, memberId) {
  const row = members().find((m) => m.id === memberId);
  if (!row || row.status !== 'invited' || norm(row.email) !== norm(user?.email)) return fail('Invitation not found.');
  write(K.members, members().map((m) => (m.id === memberId
    ? { ...m, status: 'active', user_id: user.id, name: user.name || m.name, joined_at: now() } : m)));
  audit(row.workspace_id, user, 'member.join', user.email, `Accepted invitation as ${roleLabel(row.role)}`);
  return { success: true, orgId: row.workspace_id };
}

export function declineInvite(user, memberId) {
  const row = members().find((m) => m.id === memberId);
  if (!row || row.status !== 'invited' || norm(row.email) !== norm(user?.email)) return fail('Invitation not found.');
  write(K.members, members().filter((m) => m.id !== memberId));
  audit(row.workspace_id, user, 'member.decline', user.email, 'Declined invitation');
  return { success: true };
}

export function changeRole(user, orgId, memberId, role) {
  const actor = roleIn(orgId, user);
  const target = members().find((m) => m.id === memberId && m.workspace_id === orgId);
  if (!target) return fail('Member not found.');
  if (!can(actor, 'members.role') || !canManage(actor, target.role)) return fail(`As ${roleLabel(actor)} you cannot change the role of a ${roleLabel(target.role)}.`);
  if (target.user_id && target.user_id === user.id) return fail('You cannot change your own role.');
  if (!assignableRoles(actor).includes(role)) return fail(`As ${roleLabel(actor)} you cannot assign ${roleLabel(role)}.`);
  if (target.role === role) return { success: true };
  write(K.members, members().map((m) => (m.id === memberId ? { ...m, role } : m)));
  audit(orgId, user, 'member.role', target.email || target.name, `${roleLabel(target.role)} -> ${roleLabel(role)}`);
  return { success: true };
}

export function removeMember(user, orgId, memberId) {
  const actor = roleIn(orgId, user);
  const target = members().find((m) => m.id === memberId && m.workspace_id === orgId);
  if (!target) return fail('Member not found.');
  if (target.user_id && target.user_id === user.id) return fail('Use "Leave organisation" to remove yourself.');
  if (!can(actor, 'members.remove') || !canManage(actor, target.role)) return fail(`As ${roleLabel(actor)} you cannot remove a ${roleLabel(target.role)}.`);
  write(K.members, members().filter((m) => m.id !== memberId));
  audit(orgId, user, target.status === 'invited' ? 'member.revoke' : 'member.remove', target.email || target.name,
    target.status === 'invited' ? 'Invitation revoked' : `Removed (${roleLabel(target.role)})`);
  return { success: true };
}

export function transferOwnership(user, orgId, memberId) {
  if (!can(roleIn(orgId, user), 'org.transfer')) return fail('Only the Owner can transfer ownership.');
  const target = members().find((m) => m.id === memberId && m.workspace_id === orgId);
  if (!target || target.status !== 'active') return fail('Ownership can only go to an active member.');
  if (target.user_id === user.id) return fail('You already own this organisation.');
  write(K.members, members().map((m) => {
    if (m.workspace_id !== orgId) return m;
    if (m.id === memberId) return { ...m, role: 'owner' };
    if (m.user_id === user.id) return { ...m, role: 'admin' };
    return m;
  }));
  write(K.orgs, orgs().map((o) => (o.id === orgId ? { ...o, owner_id: target.user_id, updated_at: now() } : o)));
  audit(orgId, user, 'org.transfer', target.email || target.name, 'Ownership transferred; previous owner is now Admin');
  return { success: true };
}

export function leaveOrg(user, orgId) {
  const actor = roleIn(orgId, user);
  if (!actor) return fail('You are not a member.');
  if (actor === 'owner') return fail('The Owner cannot leave. Transfer ownership first, or delete the organisation.');
  write(K.members, members().filter((m) => !(m.workspace_id === orgId && m.user_id === user.id)));
  audit(orgId, user, 'member.leave', user.email || user.name, `Left (${roleLabel(actor)})`);
  return { success: true };
}

// Deleting keeps the work: the organisation's projects become personal
// projects of whoever created them (the owner when that is not recorded).
export function deleteOrg(user, orgId) {
  if (!can(roleIn(orgId, user), 'org.delete')) return fail('Only the Owner can delete the organisation.');
  const projects = read(K.projects, []);
  let moved = 0;
  write(K.projects, projects.map((p) => {
    if (p.workspace_id !== orgId) return p;
    moved += 1;
    return { ...p, workspace_id: null, owner_id: p.owner_id || user.id, updated_at: now() };
  }));
  write(K.orgs, orgs().filter((o) => o.id !== orgId));
  write(K.members, members().filter((m) => m.workspace_id !== orgId));
  const all = read(K.audit, {});
  delete all[orgId];
  write(K.audit, all);
  return { success: true, movedProjects: moved };
}
