// src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as orgStore from '../utils/orgStore';
import { roleLabel } from '../utils/orgRbac';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

// Real notifications only (they used to be four hard-coded samples about
// "Acme Engineering"). Built on every read from the organisation data:
//   - pending invitations for the signed-in user's email (accept / decline here);
//   - audit-log events in the user's organisations that were done TO the user
//     by someone else: role changed, ownership transferred to them.
// Read / dismissed ids are kept per user in localStorage.
const stateKey = (uid) => `notifications_state_${uid}`;
const readState = (uid) => {
  try { return { read: [], dismissed: [], ...JSON.parse(localStorage.getItem(stateKey(uid))) }; }
  catch { return { read: [], dismissed: [] }; }
};
const saveState = (uid, st) => {
  try { localStorage.setItem(stateKey(uid), JSON.stringify(st)); } catch { /* storage full */ }
};

function buildNotifications(user) {
  if (!user) return [];
  const email = (user.email || '').toLowerCase();
  const list = orgStore.listInvitesForUser(user).map((inv) => ({
    id: `invite:${inv.id}`,
    member_id: inv.id,
    type: 'invite',
    status: 'pending',
    title: 'Organisation invitation',
    message: `${inv.invited_by_name || 'A member'} invited you to join "${inv.org.name}" as ${roleLabel(inv.role)}`,
    workspace_id: inv.org.id,
    workspace_name: inv.org.name,
    role: roleLabel(inv.role),
    created_at: inv.invited_at,
  }));
  for (const org of orgStore.listOrgsForUser(user)) {
    orgStore.getAudit(org.id).forEach((a, i) => {
      if (a.actor_id === user.id || (a.target || '').toLowerCase() !== email) return;
      if (a.action !== 'member.role' && a.action !== 'org.transfer') return;
      list.push({
        id: `audit:${org.id}:${a.at}:${i}`,
        type: a.action === 'org.transfer' ? 'transfer' : 'role',
        title: a.action === 'org.transfer' ? 'You are now the Owner' : 'Your role changed',
        message: a.action === 'org.transfer'
          ? `${a.actor_name} transferred "${org.name}" to you`
          : `${a.actor_name} changed your role in "${org.name}": ${a.detail}`,
        workspace_id: org.id,
        workspace_name: org.name,
        created_at: a.at,
      });
    });
  }
  const st = readState(user.id);
  return list
    .filter((n) => !st.dismissed.includes(n.id))
    .map((n) => ({ ...n, read: st.read.includes(n.id) }))
    .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
}

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  // Re-read when organisation data changes (this tab or another).
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(orgStore.ORG_EVENT, bump);
    window.addEventListener('storage', bump);
    window.addEventListener('focus', bump);
    return () => {
      window.removeEventListener(orgStore.ORG_EVENT, bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('focus', bump);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads storage
  const notifications = useMemo(() => buildNotifications(user), [user, tick]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const loading = false;

  const update = (fn) => {
    if (!user) return;
    const st = readState(user.id);
    fn(st);
    saveState(user.id, st);
    setTick((t) => t + 1);
  };

  const loadNotifications = async () => setTick((t) => t + 1);

  const markAsRead = async (id) => update((st) => { if (!st.read.includes(id)) st.read.push(id); });

  const markAllAsRead = async () => update((st) => {
    notifications.forEach((n) => { if (!st.read.includes(n.id)) st.read.push(n.id); });
  });

  // Returns the orgStore result ({ success, orgId } / { success, error }).
  const acceptInvite = async (n) => orgStore.acceptInvite(user, n.member_id);
  const rejectInvite = async (n) => orgStore.declineInvite(user, n.member_id);
  const acceptTransfer = async (n) => { markAsRead(n.id); return { success: true, orgId: n.workspace_id }; };

  const deleteNotification = async (id) => update((st) => { if (!st.dismissed.includes(id)) st.dismissed.push(id); });

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    acceptInvite,
    rejectInvite,
    acceptTransfer,
    deleteNotification,
    loadNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};