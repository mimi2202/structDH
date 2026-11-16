// /organisations — the organisations you belong to, and invitations waiting
// for your email.
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiPlus, FiCheck, FiX, FiChevronRight } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import * as store from '../../utils/orgStore'
import { orgCode, ROLE_DEFS, ROLE_ORDER, roleLabel } from '../../utils/orgRbac'
import { fmtDate } from './orgFormat'
import { Panel, RoleBadge, Btn, Notice, Th, Empty, SectionHeading, CARD_CLASS } from './orgUi'

export default function OrgHome() {
  const { user } = useAuth()
  const { refreshWorkspaces } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [, setVersion] = useState(0)
  const [msg, setMsg] = useState(location.state?.notice ? { tone: 'ok', text: location.state.notice } : null)

  const orgs = store.listOrgsForUser(user)
  const invites = store.listInvitesForUser(user)

  const act = (res, okText, go) => {
    setMsg(res.success ? { tone: 'ok', text: okText } : { tone: 'error', text: res.error })
    setVersion((v) => v + 1)
    refreshWorkspaces()
    if (res.success && go) navigate(go)
  }

  return (
    <AccountLayout title="Organisations" subtitle="Teams you belong to and the role you hold in each">
      <div className="space-y-6 p-4 sm:p-8">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        {invites.length > 0 && (
          <Panel index="!" title={`Invitations · ${invites.length}`} bodyClass="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-invite={inv.org.name}>
                <div className="text-sm">
                  <div className="font-medium text-[#0F172A] dark:text-white">{inv.org.name} <span className="ml-1 font-mono text-xs text-[#94a3b8]">{orgCode(inv.org.id)}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                    <RoleBadge role={inv.role} /> invited by {inv.invited_by_name || 'a member'} on <span className="font-mono">{fmtDate(inv.invited_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" onClick={() => act(store.declineInvite(user, inv.id), `Declined the invitation to ${inv.org.name}.`)}><FiX /> Decline</Btn>
                  <Btn size="sm" variant="primary" onClick={() => act(store.acceptInvite(user, inv.id), `You joined ${inv.org.name} as ${roleLabel(inv.role)}.`, `/workspace/${inv.org.id}`)}><FiCheck /> Accept</Btn>
                </div>
              </div>
            ))}
          </Panel>
        )}

        <Panel index="01" title={`Your organisations · ${orgs.length}`} bodyClass=""
          actions={<Link to="/workspace/create"><Btn variant="primary" size="sm"><FiPlus /> New organisation</Btn></Link>}>
          {orgs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Empty>You are not in any organisation</Empty>
              <p className="mx-auto -mt-4 mb-5 max-w-md text-sm text-[#64748b] dark:text-[#94a3b8]">
                Your projects are personal until you create or join an organisation. Create one and you become its Owner.
              </p>
              <Link to="/workspace/create"><Btn variant="primary"><FiPlus /> Create organisation</Btn></Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                  <tr><Th>Organisation</Th><Th>Reference</Th><Th>Your role</Th><Th className="text-right">Members</Th><Th className="text-right">Projects</Th><Th className="text-right">Created</Th><Th /></tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                  {orgs.map((o) => (
                    <tr key={o.id} onClick={() => navigate(`/workspace/${o.id}`)} className="cursor-pointer hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0F172A] dark:text-white">{o.name}</div>
                        {o.industry && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{o.industry}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">{orgCode(o.id)}</td>
                      <td className="px-4 py-3"><RoleBadge role={o.userRole} /></td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[#0F172A] dark:text-white">{o.member_count}{o.invite_count > 0 && <span className="text-amber-600"> +{o.invite_count}</span>}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[#0F172A] dark:text-white">{o.project_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtDate(o.created_at)}</td>
                      <td className="px-4 py-3 text-right text-[#94a3b8]"><FiChevronRight className="ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <section>
        <SectionHeading index="02" title="Roles at a glance" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_ORDER.map((r) => (
            <div key={r} className={`p-4 ${CARD_CLASS} hover:translate-y-0`}>
              <RoleBadge role={r} />
              <p className="mt-2 text-sm text-[#475569] dark:text-[#cbd5e1]">{ROLE_DEFS[r].summary}</p>
            </div>
          ))}
        </div>
        </section>
      </div>
    </AccountLayout>
  )
}
