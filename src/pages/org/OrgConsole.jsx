// /workspace/:workspaceId  — one organisation: overview, members, roles and
// permissions, projects, audit log, settings (?tab=...). Everything shown and
// every action is limited by the signed-in user's role (utils/orgRbac.js).
import React, { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FiPlus, FiExternalLink, FiLock, FiCheck, FiMinus } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import * as store from '../../utils/orgStore'
import { can, orgCode, PERMISSIONS, ROLE_ORDER, roleLabel } from '../../utils/orgRbac'
import { fmtDate, fmtTs } from './orgFormat'
import { Panel, RoleBadge, Btn, OrgMark, Th, Empty } from './orgUi'
import OrgMembers from './OrgMembers'
import OrgRoles from './OrgRoles'
import OrgAudit from './OrgAudit'
import OrgSettings from './OrgSettings'

const BLUEPRINT = {
  backgroundColor: '#0A2F44',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'projects', label: 'Projects' },
  { id: 'audit', label: 'Audit Log', perm: 'org.audit' },
  { id: 'settings', label: 'Settings' },
]

function Spec({ label, children }) {
  return (
    <div className="min-w-[110px] border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white tabular-nums">{children}</div>
    </div>
  )
}

export default function OrgConsole({ initialTab }) {
  const { workspaceId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { workspaces, refreshWorkspaces, listUserProjects } = useWorkspace()
  const [, setVersion] = useState(0)

  // Re-read after every change (the store is synchronous localStorage).
  const changed = useCallback(() => { setVersion((v) => v + 1); refreshWorkspaces() }, [refreshWorkspaces])

  const org = store.getOrg(workspaceId, user)
  const role = org?.userRole || null
  const members = org ? store.getMembers(org.id) : []
  const active = members.filter((m) => m.status === 'active')
  const invited = members.filter((m) => m.status === 'invited')
  const projects = org ? listUserProjects(org.id) : []
  const owner = active.find((m) => m.role === 'owner')

  const visibleTabs = TABS.filter((t) => !t.perm || can(role, t.perm))
  const requested = params.get('tab') || initialTab || 'overview'
  const tab = visibleTabs.some((t) => t.id === requested) ? requested : 'overview'
  const setTab = (id) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  if (!org) {
    return (
      <AccountLayout title="Organisation" subtitle="Access denied">
        <div className="p-4 sm:p-8">
          <Panel index="403" title="No access">
            <div className="flex flex-col items-start gap-3 text-sm text-[#334155] dark:text-[#cbd5e1]">
              <p className="flex items-center gap-2"><FiLock /> This organisation does not exist, or you are not a member of it.</p>
              <p className="font-mono text-xs text-[#64748b]">{workspaceId}</p>
              <Link to="/organisations"><Btn variant="primary">Your organisations</Btn></Link>
            </div>
          </Panel>
        </div>
      </AccountLayout>
    )
  }

  const switchOptions = workspaces.map((w) => ({ value: w.id, label: w.name }))

  return (
    <AccountLayout title="Organisation" subtitle={`${org.name} · ${roleLabel(role)}`}>
      {/* Header band */}
      <div style={BLUEPRINT} className="border-b border-black/20 px-4 pt-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <OrgMark name={org.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold text-white">{org.name}</h2>
                <RoleBadge role={role} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-white/70">
                <span>{orgCode(org.id)}</span>
                {org.industry && <span>· {org.industry}</span>}
                {org.country && <span>· {org.country}</span>}
                {org.website && (
                  <a href={/^https?:\/\//.test(org.website) ? org.website : `https://${org.website}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-white/30 hover:text-white">
                    · {org.website.replace(/^https?:\/\//, '')} <FiExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {switchOptions.length > 1 && (
              <div className="w-56">
                <Dropdown value={org.id} onChange={(v) => navigate(`/workspace/${v}`)} options={switchOptions} className="!py-1.5" />
              </div>
            )}
            <Link to="/workspace/create">
              <Btn className="border border-white/30 bg-white/10 text-white hover:bg-white/20" size="md"><FiPlus /> New organisation</Btn>
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-y-3 pb-4">
          <Spec label="Members">{active.length}</Spec>
          <Spec label="Pending">{invited.length}</Spec>
          <Spec label="Projects">{projects.length}</Spec>
          <Spec label="Owner">{owner?.name || '-'}</Spec>
          <Spec label="Created">{fmtDate(org.created_at)}</Spec>
        </div>

        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Organisation sections">
          {visibleTabs.map((t) => {
            const count = t.id === 'members' ? members.length : t.id === 'projects' ? projects.length : null
            const on = t.id === tab
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  on ? 'border-[#66a4c2] text-white' : 'border-transparent text-white/60 hover:text-white'}`}>
                {t.label}
                {count !== null && <span className="ml-1.5 font-mono text-white/50">{count}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-8">
        {tab === 'overview' && <Overview org={org} role={role} members={members} projects={projects} setTab={setTab} />}
        {tab === 'members' && <OrgMembers org={org} role={role} members={members} user={user} onChange={changed} />}
        {tab === 'roles' && <OrgRoles role={role} members={members} />}
        {tab === 'projects' && <OrgProjects org={org} role={role} projects={projects} members={members} />}
        {tab === 'audit' && <OrgAudit org={org} />}
        {tab === 'settings' && <OrgSettings org={org} role={role} members={members} projects={projects} user={user} onChange={changed} />}
      </div>
    </AccountLayout>
  )
}

function Overview({ org, role, members, projects, setTab }) {
  const active = members.filter((m) => m.status === 'active')
  const counts = ROLE_ORDER.map((r) => [r, active.filter((m) => m.role === r).length])
  const audit = can(role, 'org.audit') ? store.getAudit(org.id).slice(0, 8) : []
  const COLORS = { owner: 'bg-amber-500', admin: 'bg-blue-500', editor: 'bg-emerald-500', member: 'bg-slate-400' }
  const myPerms = Object.entries(PERMISSIONS)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Panel index="01" title="Team composition" actions={<Btn size="sm" variant="ghost" onClick={() => setTab('members')}>Manage</Btn>}>
          <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-[#e2e8f0] dark:bg-[#334155]">
            {counts.map(([r, n]) => n > 0 && <div key={r} className={COLORS[r]} style={{ width: `${(n / active.length) * 100}%` }} title={`${roleLabel(r)}: ${n}`} />)}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map(([r, n]) => (
              <div key={r} className="rounded border border-[#e2e8f0] dark:border-[#334155] px-3 py-2">
                <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] dark:text-[#94a3b8]">
                  <span className={`h-2 w-2 rounded-sm ${COLORS[r]}`} />{roleLabel(r)}
                </dt>
                <dd className="mt-1 font-mono text-xl text-[#0F172A] dark:text-white tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          {members.some((m) => m.status === 'invited') && (
            <p className="mt-3 font-mono text-xs text-amber-600 dark:text-amber-400">
              {members.filter((m) => m.status === 'invited').length} invitation(s) pending
            </p>
          )}
        </Panel>

        {can(role, 'org.audit') && (
          <Panel index="02" title="Recent activity" actions={<Btn size="sm" variant="ghost" onClick={() => setTab('audit')}>Full log</Btn>} bodyClass="">
            {audit.length === 0 ? <Empty>No activity recorded</Empty> : (
              <ul className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">{fmtTs(a.at)}</span>
                    <span className="rounded bg-[#f1f5f9] dark:bg-[#0f172a] px-1.5 py-0.5 font-mono text-[11px] text-[#0A2F44] dark:text-[#66a4c2]">{a.action}</span>
                    <span className="text-[#0F172A] dark:text-white">{a.actor_name}</span>
                    {a.target && <span className="font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">{a.target}</span>}
                    {a.detail && <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{a.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel index={can(role, 'org.audit') ? '03' : '02'} title="Latest projects" actions={<Btn size="sm" variant="ghost" onClick={() => setTab('projects')}>All projects</Btn>} bodyClass="">
          <ProjectTable org={org} projects={projects.slice(0, 5)} members={members} />
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Your access" actions={<RoleBadge role={role} />} bodyClass="">
          <ul className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
            {myPerms.map(([key, p]) => {
              const ok = can(role, key)
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className={ok ? 'text-[#0F172A] dark:text-white' : 'text-[#94a3b8]'}>{p.label}</span>
                  {ok ? <FiCheck className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" /> : <FiMinus className="flex-shrink-0 text-[#cbd5e1] dark:text-[#475569]" />}
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Organisation record">
          <dl className="space-y-3 text-sm">
            {[
              ['Reference', <span className="font-mono">{orgCode(org.id)}</span>],
              ['Industry', org.industry || '-'],
              ['Country', org.country || '-'],
              ['Website', org.website || '-'],
              ['Last change', <span className="font-mono">{fmtTs(org.updated_at || org.created_at)}</span>],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b] dark:text-[#94a3b8]">{k}</dt>
                <dd className="col-span-2 break-words text-[#0F172A] dark:text-white">{v}</dd>
              </div>
            ))}
            {org.description && <p className="border-t border-[#e2e8f0] dark:border-[#334155] pt-3 text-[#475569] dark:text-[#cbd5e1]">{org.description}</p>}
          </dl>
        </Panel>
      </div>
    </div>
  )
}

function ProjectTable({ org, projects, members }) {
  if (!projects.length) return <Empty>No projects in this organisation</Empty>
  const ownerName = (p) => members.find((m) => m.user_id && m.user_id === p.owner_id)?.name || p.owner_name || '-'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
          <tr><Th>Project</Th><Th>Type</Th><Th>Created by</Th><Th className="text-right">Updated</Th></tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
              <td className="px-4 py-2.5">
                <Link to={`/workspace/${org.id}/projects/${p.id}/design`} className="font-medium text-[#0A2F44] dark:text-[#66a4c2] hover:underline">{p.name}</Link>
                {p.location && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{p.location}</div>}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">{p.project_type || '-'}</td>
              <td className="px-4 py-2.5 text-sm text-[#0F172A] dark:text-white">{ownerName(p)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-[#64748b] dark:text-[#94a3b8] tabular-nums">{fmtDate(p.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrgProjects({ org, role, projects, members }) {
  return (
    <Panel index="01" title={`Projects · ${projects.length}`} bodyClass=""
      actions={can(role, 'project.create')
        ? <Link to={`/workspace/${org.id}/projects/new`}><Btn variant="primary" size="sm"><FiPlus /> New project</Btn></Link>
        : <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Read-only</span>}>
      <ProjectTable org={org} projects={projects} members={members} />
      <p className="border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
        Personal projects can be moved in from the project page (Settings tab) by anyone whose role here is Editor or above.
      </p>
    </Panel>
  )
}
