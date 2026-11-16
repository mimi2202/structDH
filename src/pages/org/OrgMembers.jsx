// Members tab: list, search/filter, invite, change role, remove / revoke.
import React, { useState } from 'react'
import { FiUserPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import Dropdown from '../../components/Dropdown'
import { Avatar } from '../../components/ui/UserMenu'
import * as store from '../../utils/orgStore'
import { can, canManage, assignableRoles, ROLE_DEFS, ROLE_ORDER, roleLabel } from '../../utils/orgRbac'
import { fmtDate, accountFor } from './orgFormat'
import { Panel, RoleBadge, StatusTag, Btn, Field, TextInput, Notice, Modal, Th, Empty } from './orgUi'

export default function OrgMembers({ org, role, members, user, onChange }) {
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [msg, setMsg] = useState(null)

  const mayInvite = can(role, 'members.invite')
  const options = assignableRoles(role)
  const shown = members.filter((m) => {
    const t = `${m.name || ''} ${m.email || ''}`.toLowerCase()
    return t.includes(q.trim().toLowerCase()) && (roleFilter === 'all' || m.role === roleFilter
      || (roleFilter === 'invited' && m.status === 'invited'))
  })

  const report = (res, okText) => {
    setMsg(res.success ? { tone: 'ok', text: okText } : { tone: 'error', text: res.error })
    if (res.success) onChange()
    return res.success
  }

  const isMe = (m) => m.user_id && m.user_id === user?.id

  return (
    <div className="space-y-4">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Panel index="01" title={`Members · ${members.filter((m) => m.status === 'active').length} active`} bodyClass=""
        actions={mayInvite
          ? <Btn variant="primary" size="sm" onClick={() => { setMsg(null); setInviting(true) }}><FiUserPlus /> Invite member</Btn>
          : <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">View only</span>}>
        <div className="flex flex-col gap-2 border-b border-[#e2e8f0] dark:border-[#334155] p-3 sm:flex-row">
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search members" />
          </div>
          <div className="sm:w-48">
            <Dropdown value={roleFilter} onChange={setRoleFilter}
              options={[{ value: 'all', label: 'All roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: roleLabel(r) })), { value: 'invited', label: 'Pending invitations' }]} />
          </div>
        </div>

        {shown.length === 0 ? <Empty>No members match</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                <tr><Th>Member</Th><Th>Role</Th><Th>Status</Th><Th>Since</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                {shown.map((m) => {
                  const manage = !isMe(m) && can(role, 'members.role') && canManage(role, m.role)
                  const account = accountFor(m)
                  return (
                    <tr key={m.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]" data-member={m.email}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar user={{ name: account?.name || m.name, email: m.email, avatar: m.status === 'active' ? account?.avatar : null }} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A] dark:text-white">
                              <span className="truncate">{m.status === 'active' ? (account?.name || m.name) : m.name}</span>
                              {isMe(m) && <span className="rounded bg-[#e6f0f5] dark:bg-[#1e3a4a] px-1.5 font-mono text-[10px] uppercase text-[#0A2F44] dark:text-[#66a4c2]">You</span>}
                            </div>
                            <div className="truncate font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{m.email || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {manage ? (
                          <div className="w-36" data-role-select>
                            <Dropdown value={m.role} className="!py-1 !text-xs"
                              onChange={(r) => report(store.changeRole(user, org.id, m.id, r), `${m.email}: role set to ${roleLabel(r)}.`)}
                              options={options.map((r) => ({ value: r, label: roleLabel(r) }))} />
                          </div>
                        ) : <RoleBadge role={m.role} />}
                      </td>
                      <td className="px-4 py-2.5"><StatusTag status={m.status} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">
                        {fmtDate(m.status === 'invited' ? m.invited_at : m.joined_at)}
                        {m.status === 'invited' && m.invited_by_name && <div className="text-[10px] normal-case">by {m.invited_by_name}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!isMe(m) && can(role, 'members.remove') && canManage(role, m.role) ? (
                          <Btn size="sm" variant="dangerOutline" onClick={() => { setMsg(null); setRemoving(m) }}>
                            <FiTrash2 /> {m.status === 'invited' ? 'Revoke' : 'Remove'}
                          </Btn>
                        ) : <span className="font-mono text-[11px] text-[#cbd5e1] dark:text-[#475569]">-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {role === 'admin' && (
        <p className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">As Admin you can manage Editors and Members. Admins and the Owner are managed by the Owner.</p>
      )}

      {inviting && (
        <InviteModal role={role} options={options} onClose={() => setInviting(false)}
          onInvite={(email, r) => {
            const res = store.inviteMember(user, org.id, email, r)
            if (res.success) { setInviting(false); report(res, `Invitation recorded for ${res.member.email} as ${roleLabel(r)}.`) }
            return res
          }} />
      )}

      {removing && (
        <Modal title={removing.status === 'invited' ? 'Revoke invitation' : 'Remove member'} onClose={() => setRemoving(null)}
          footer={<>
            <Btn onClick={() => setRemoving(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => { report(store.removeMember(user, org.id, removing.id), removing.status === 'invited' ? `Invitation for ${removing.email} revoked.` : `${removing.email} removed.`); setRemoving(null) }}>
              {removing.status === 'invited' ? 'Revoke' : 'Remove'}
            </Btn>
          </>}>
          <p>
            {removing.status === 'invited'
              ? <>Cancel the invitation for <span className="font-mono">{removing.email}</span>?</>
              : <>Remove <strong>{removing.name}</strong> (<span className="font-mono">{removing.email}</span>, {roleLabel(removing.role)}) from the organisation? They lose access to its projects. Projects they created stay in the organisation.</>}
          </p>
        </Modal>
      )}
    </div>
  )
}

function InviteModal({ role, options, onClose, onInvite }) {
  const [email, setEmail] = useState('')
  const [r, setR] = useState(options.includes('editor') ? 'editor' : options[0])
  const [error, setError] = useState('')
  const submit = (e) => {
    e?.preventDefault()
    const res = onInvite(email, r)
    if (!res.success) setError(res.error)
  }
  return (
    <Modal title="Invite member" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit}>Send invitation</Btn></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={error}>
          <TextInput type="email" mono autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} placeholder="name@company.com" />
        </Field>
        <Field label="Role" hint={ROLE_DEFS[r]?.summary}>
          <Dropdown value={r} onChange={setR} options={options.map((x) => ({ value: x, label: roleLabel(x) }))} />
        </Field>
        {role === 'admin' && <p className="text-xs text-[#64748b]">Admins can invite Editors and Members.</p>}
        <Notice tone="info">
          No email is sent yet (there is no mail server). The invitation appears for that person under Organisations when they sign in with this email, where they can accept or decline it.
        </Notice>
      </form>
    </Modal>
  )
}
