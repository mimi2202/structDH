// Organisation role-based access control: the roles, what each may do, and
// who may manage whom. One table drives both the checks in utils/orgStore.js
// and what the organisation pages show (permission matrix, enabled buttons).

export const ROLE_ORDER = ['owner', 'admin', 'editor', 'member'];

export const ROLE_DEFS = {
  owner: {
    label: 'Owner',
    summary: 'Full control. One per organisation; the person who created it until ownership is transferred.',
  },
  admin: {
    label: 'Admin',
    summary: 'Runs the organisation day to day: members, roles below Admin, settings and all projects.',
  },
  editor: {
    label: 'Editor',
    summary: 'Creates and edits projects and designs. Cannot manage members or settings.',
  },
  member: {
    label: 'Member',
    summary: 'Read-only: sees the organisation, its members and its projects.',
  },
};

export const RANK = { owner: 4, admin: 3, editor: 2, member: 1 };

// key -> [label, group, roles allowed]
const P = (label, group, roles) => ({ label, group, roles });
export const PERMISSIONS = {
  'org.view': P('View organisation, members and projects', 'Organisation', ['owner', 'admin', 'editor', 'member']),
  'org.edit': P('Edit organisation details', 'Organisation', ['owner', 'admin']),
  'org.audit': P('View audit log', 'Organisation', ['owner', 'admin']),
  'org.transfer': P('Transfer ownership', 'Organisation', ['owner']),
  'org.delete': P('Delete organisation', 'Organisation', ['owner']),
  'members.invite': P('Invite members', 'Members', ['owner', 'admin']),
  'members.role': P('Change member roles', 'Members', ['owner', 'admin']),
  'members.remove': P('Remove members, revoke invitations', 'Members', ['owner', 'admin']),
  'project.create': P('Create projects / move projects in', 'Projects', ['owner', 'admin', 'editor']),
  'project.edit': P('Edit projects and run designs', 'Projects', ['owner', 'admin', 'editor']),
  'project.delete': P('Delete projects', 'Projects', ['owner', 'admin']),
};

export const can = (role, perm) => !!role && !!PERMISSIONS[perm]?.roles.includes(role);

// Owners manage everyone else; admins manage editors and members only. Nobody
// manages the owner (ownership moves only by transfer).
export const canManage = (actorRole, targetRole) => {
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return RANK[targetRole] < RANK.admin;
  return false;
};

// Roles an actor may give someone (never 'owner': that is a transfer).
export const assignableRoles = (actorRole) => {
  if (actorRole === 'owner') return ['admin', 'editor', 'member'];
  if (actorRole === 'admin') return ['editor', 'member'];
  return [];
};

export const roleLabel = (role) => ROLE_DEFS[role]?.label || role || '-';

// Short, stable reference shown in the UI ("ORG-LZ4K2Q").
export const orgCode = (id) => {
  const tail = String(id || '').replace(/^ws-/, '');
  const n = Number(tail);
  return 'ORG-' + (Number.isFinite(n) && n > 0 ? n.toString(36) : tail).slice(-6).toUpperCase();
};
