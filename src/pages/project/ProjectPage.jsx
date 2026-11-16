// /workspace/:workspaceId/projects/:projectId — a project's details, designs,
// team and settings (replaces the old pages/ProjectDetail.jsx). Design work
// itself happens in the project's design hub (/design). What a user may change
// follows their role: personal projects belong to their owner; in an
// organisation, Editors and above edit, Owner/Admin delete (utils/orgRbac.js).
import React, { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  FiArrowLeft, FiLayers, FiExternalLink, FiSave, FiArchive, FiRotateCcw, FiDownload, FiTrash2,
  FiRepeat, FiCornerUpLeft, FiLock, FiUsers, FiMessageSquare,
} from 'react-icons/fi'
import ProjectChat, { ChatBubble } from '../../components/chat/ProjectChat'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { Avatar } from '../../components/ui/UserMenu'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { ALL_WS, PERSONAL_WS, isPersonal } from '../../utils/projects'
import { listForProject, assignToProject, deleteDesign, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'
import { getMembers } from '../../utils/orgStore'
import { can, PERMISSIONS, ROLE_ORDER } from '../../utils/orgRbac'
import { projectHubPath } from '../../utils/designMode'
import { Panel, Btn, Field, TextInput, TextArea, Notice, Modal, Th, Empty, RoleBadge, ConfirmLabel } from '../org/orgUi'
import { fmtDate, fmtTs, accountFor } from '../org/orgFormat'

const BLUEPRINT = {
  backgroundColor: '#0A2F44',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'designs', label: 'Designs' },
  { id: 'team', label: 'Team' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'settings', label: 'Settings' },
]

const TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'other', label: 'Other' },
]

const PROJECT_PERMS = Object.entries(PERMISSIONS).filter(([k]) => k.startsWith('project.'))

function Spec({ label, children }) {
  return (
    <div className="min-w-[110px] border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white tabular-nums">{children}</div>
    </div>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Opened from the project's design hub: the back link returns there (kept
  // while switching tabs, which replace the URL and drop the router state).
  const [fromHub] = useState(() => location.state?.from === 'hub')
  const { user } = useAuth()
  const { workspaces, listUserProjects, updateProject, moveProject, deleteProject } = useWorkspace()
  const [, setVersion] = useState(0)
  const [msg, setMsg] = useState(null)
  const refresh = () => setVersion((v) => v + 1)

  const project = listUserProjects(ALL_WS).find((p) => p.id === projectId) || null
  const role = project?.workspace_id ? workspaces.find((w) => w.id === project.workspace_id)?.userRole : null
  const owns = project && (!project.owner_id || project.owner_id === user?.id)
  const mayEdit = project && (project.workspace_id ? can(role, 'project.edit') : owns)
  const mayDelete = project && (project.workspace_id ? can(role, 'project.delete') : owns)
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (id) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  if (!project) {
    return (
      <AccountLayout title="Project" subtitle="Not found">
        <div className="p-4 sm:p-8">
          <Panel index="404" title="Project not found">
            <div className="flex flex-col items-start gap-3 text-sm text-[#334155] dark:text-[#cbd5e1]">
              <p className="flex items-center gap-2"><FiLock /> This project does not exist, or you do not have access to it.</p>
              <Link to="/workspace/all/projects"><Btn variant="primary">Your projects</Btn></Link>
            </div>
          </Panel>
        </div>
      </AccountLayout>
    )
  }

  const designs = listForProject(project.id)
  // people who can be @mentioned in the project's chat
  const chatMembers = project.workspace_id
    ? getMembers(project.workspace_id).filter((m) => m.status === 'active' && m.user_id)
      .map((m) => { const a = accountFor(m); return { id: m.user_id, name: a?.name || m.name, email: m.email, avatar: a?.avatar } })
    : [{ id: user.id, name: user.name || user.email, email: user.email, avatar: user.avatar }]
  const discussDesign = (d) => setParams({ tab: 'discussion', design: `${d.element}:${d.id}` }, { replace: true })
  const designParam = params.get('design')
  const initialDesign = designParam ? designs.find((d) => `${d.element}:${d.id}` === designParam) : null
  const pass = designs.filter((d) => d.status === 'PASS').length
  const fail = designs.filter((d) => d.status === 'FAIL').length
  const hub = projectHubPath(project)
  const ownerName = accountFor({ user_id: project.owner_id })?.name || project.owner_name || '-'

  return (
    <AccountLayout title="Project" subtitle={`${project.name} · ${project.organisation_name || 'Personal'}`}>
      <div style={BLUEPRINT} className="border-b border-black/20 px-4 pt-6 sm:px-8">
        <Link to={fromHub ? hub : '/workspace/all/projects'} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 hover:text-white">
          <FiArrowLeft /> {fromHub ? 'Design hub' : 'Projects'}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold text-white">{project.name}</h2>
              {project.status === 'archived' && <span className="rounded border border-white/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/80">Archived</span>}
              {role && <RoleBadge role={role} />}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs text-white/70">
              <span>{project.organisation_name || 'Personal project'}</span>
              {project.project_type && <span>· {project.project_type.toUpperCase()}</span>}
              {project.location && <span>· {project.location}</span>}
            </div>
          </div>
          <Link to={hub}><Btn className="border border-white/30 bg-white/10 text-white hover:bg-white/20"><FiLayers /> Open design hub</Btn></Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-y-3 pb-4">
          <Spec label="Designs">{designs.length}</Spec>
          <Spec label="Pass / fail">{pass} / {fail}</Spec>
          <Spec label="Created by">{ownerName}</Spec>
          <Spec label="Created">{fmtDate(project.created_at)}</Spec>
          <Spec label="Updated">{fmtDate(project.updated_at)}</Spec>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Project sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                t.id === tab ? 'border-[#66a4c2] text-white' : 'border-transparent text-white/60 hover:text-white'}`}>
              {t.label}{t.id === 'designs' && <span className="ml-1.5 font-mono text-white/50">{designs.length}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6 p-4 sm:p-8">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {tab === 'overview' && <Overview project={project} designs={designs} hub={hub} setTab={setTab} mayEdit={mayEdit} />}
        {tab === 'designs' && <Designs designs={designs} hub={hub} user={user} navigate={navigate} mayEdit={mayEdit} onDiscuss={discussDesign}
          onChange={(text) => { setMsg({ tone: 'ok', text }); refresh() }} />}
        {tab === 'discussion' && (
          <div className="h-[calc(100vh-330px)] min-h-[460px]">
            <ProjectChat key={designParam || 'general'} project={project} user={user} members={chatMembers} designs={designs}
              initialDesign={initialDesign ? { element: initialDesign.element, id: initialDesign.id, name: initialDesign.name } : null} />
          </div>
        )}
        {tab === 'team' && <Team project={project} user={user} />}
        {tab === 'settings' && (
          <Settings project={project} workspaces={workspaces} mayEdit={mayEdit} mayDelete={mayDelete}
            updateProject={updateProject} moveProject={moveProject} deleteProject={deleteProject}
            onMessage={(m) => { setMsg(m); refresh() }} navigate={navigate} />
        )}
      </div>
      {tab !== 'discussion' && <ChatBubble project={project} user={user} members={chatMembers} designs={designs} />}
    </AccountLayout>
  )
}

function Overview({ project, designs, hub, setTab, mayEdit }) {
  const kinds = Object.entries(designs.reduce((acc, d) => {
    const k = ELEMENTS[d.element]?.label || d.element
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {}))
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Panel index="01" title="Project record">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {[
              ['Name', project.name],
              ['Organisation', project.organisation_name || 'Personal'],
              ['Building type', project.project_type ? project.project_type[0].toUpperCase() + project.project_type.slice(1) : '-'],
              ['Location', project.location || '-'],
              ['Design code', 'EN 1992-1-1 (Eurocode 2)'],
              ['Status', project.status === 'archived' ? 'Archived' : 'Active'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b] dark:text-[#94a3b8]">{k}</dt>
                <dd className="mt-0.5 text-[#0F172A] dark:text-white">{v}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b] dark:text-[#94a3b8]">Description</dt>
              <dd className="mt-0.5 text-[#0F172A] dark:text-white">{project.description || '-'}</dd>
            </div>
          </dl>
          {mayEdit && <div className="mt-4 border-t border-[#e2e8f0] dark:border-[#334155] pt-3"><Btn size="sm" onClick={() => setTab('settings')}>Edit details</Btn></div>}
        </Panel>

        <Panel index="02" title="Latest designs" bodyClass="" actions={<Btn size="sm" variant="ghost" onClick={() => setTab('designs')}>All designs</Btn>}>
          {designs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Empty>No designs yet</Empty>
              <Link to={hub}><Btn variant="primary"><FiLayers /> Open design hub</Btn></Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
              {designs.slice(0, 5).map((d) => (
                <li key={`${d.element}-${d.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="text-[#0F172A] dark:text-white">{d.name}<span className="ml-2 font-mono text-[11px] uppercase text-[#64748b]">{ELEMENTS[d.element]?.label}</span></span>
                  <span className="flex items-center gap-3">
                    <Status s={d.status} />
                    <span className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Designs by element">
        {kinds.length === 0 ? <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Nothing designed yet.</p> : (
          <ul className="space-y-2 text-sm">
            {kinds.map(([k, n]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="text-[#0F172A] dark:text-white">{k}</span>
                <span className="font-mono tabular-nums text-[#475569] dark:text-[#cbd5e1]">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

const Status = ({ s }) => (s
  ? <span className={`font-mono text-[11px] font-semibold uppercase ${s === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{s}</span>
  : <span className="text-[#94a3b8]">-</span>)

function Designs({ designs, hub, user, navigate, mayEdit, onChange, onDiscuss }) {
  const [deleting, setDeleting] = useState(null)
  const mine = (d) => !d.owner_id || d.owner_id === user?.id
  return (
    <>
      <Panel index="01" title={`Designs · ${designs.length}`} bodyClass=""
        actions={mayEdit && <Link to={hub}><Btn size="sm" variant="primary"><FiLayers /> New design</Btn></Link>}>
        {designs.length === 0 ? <Empty>No designs in this project</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                <tr><Th>Design</Th><Th>Element</Th><Th>Result</Th><Th>By</Th><Th>Saved</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                {designs.map((d) => (
                  <tr key={`${d.element}-${d.id}`} data-design={d.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-[#0F172A] dark:text-white">{d.name || 'Untitled design'}</div>
                      {d.subtitle && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{d.subtitle}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">{ELEMENTS[d.element]?.label || d.element}</td>
                    <td className="px-4 py-2.5"><Status s={d.status} /></td>
                    <td className="px-4 py-2.5 text-sm text-[#0F172A] dark:text-white">{d.owner_name || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Btn size="sm" onClick={() => navigate(designRoute(d, d.element), { state: designState(d) })}><FiExternalLink /> Open</Btn>
                        <Btn size="sm" onClick={() => onDiscuss(d)} aria-label="Discuss design"><FiMessageSquare /> Discuss</Btn>
                        {mine(d) && (
                          <>
                            <Btn size="sm" title="Move back to Quick Design" aria-label="Remove from project"
                              onClick={() => { assignToProject(d.element, d.id, null); onChange(`“${d.name}” moved back to Quick Design.`) }}><FiCornerUpLeft /></Btn>
                            <Btn size="sm" variant="dangerOutline" aria-label="Delete design" onClick={() => setDeleting(d)}><FiTrash2 /></Btn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">Everyone with access to the project can open its designs; only the person who saved a design can remove or delete it.</p>
      {deleting && (
        <Modal title="Delete design" onClose={() => setDeleting(null)}
          footer={<><Btn onClick={() => setDeleting(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => { deleteDesign(deleting.element, deleting.id); setDeleting(null); onChange(`“${deleting.name}” deleted.`) }}>Delete</Btn></>}>
          <p>Delete “{deleting.name}”? The saved result and its report are removed.</p>
        </Modal>
      )}
    </>
  )
}

function Team({ project, user }) {
  if (isPersonal(project)) {
    return (
      <Panel index="01" title="Team">
        <div className="flex items-start gap-3 text-sm text-[#334155] dark:text-[#cbd5e1]">
          <FiUsers className="mt-0.5 flex-shrink-0" />
          <p>This is a personal project: only you can see it. To work on it with others, move it into an organisation (Settings tab); its members then get access according to their role there.</p>
        </div>
      </Panel>
    )
  }
  const members = getMembers(project.workspace_id).filter((m) => m.status === 'active')
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
  return (
    <div className="space-y-4">
      <Panel index="01" title={`Team · ${members.length}`} bodyClass=""
        actions={<Link to={`/workspace/${project.workspace_id}?tab=members`}><Btn size="sm">Manage in {project.organisation_name}</Btn></Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
              <tr><Th>Member</Th><Th>Role</Th>{PROJECT_PERMS.map(([k, p]) => <Th key={k} className="text-center">{p.label.split(/[ /]/)[0]}</Th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
              {members.map((m) => {
                const acc = accountFor(m)
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar user={{ name: acc?.name || m.name, email: m.email, avatar: acc?.avatar }} size="md" />
                        <div>
                          <div className="text-sm font-medium text-[#0F172A] dark:text-white">{acc?.name || m.name}{m.user_id === user?.id && <span className="ml-2 font-mono text-[10px] uppercase text-[#0A2F44] dark:text-[#66a4c2]">You</span>}</div>
                          <div className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><RoleBadge role={m.role} /></td>
                    {PROJECT_PERMS.map(([k]) => (
                      <td key={k} className="px-4 py-2.5 text-center font-mono text-sm">{can(m.role, k) ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-[#cbd5e1] dark:text-[#475569]">–</span>}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">Project access follows organisation roles: Create = create / move in, Edit = edit and run designs, Delete = delete the project.</p>
    </div>
  )
}

const pick = (p) => ({ name: p.name || '', project_type: p.project_type || 'other', location: p.location || '', description: p.description || '' })

function Settings({ project, workspaces, mayEdit, mayDelete, updateProject, moveProject, deleteProject, onMessage, navigate }) {
  const [form, setForm] = useState(() => pick(project))
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // 'move' | 'delete'
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(project))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('The project needs a name.'); return }
    const res = await updateProject(project.id, { ...form, name: form.name.trim(), location: form.location.trim(), description: form.description.trim() })
    onMessage(res.success ? { tone: 'ok', text: 'Project details saved.' } : { tone: 'error', text: res.error })
  }

  const exportJson = () => {
    const data = { app: 'SDH (Sphere Design Hub)', exported_at: new Date().toISOString(), project, designs: listForProject(project.id) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/[^\w-]+/g, '_')}_project.json`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  const archived = project.status === 'archived'

  return (
    <div className="space-y-6">
      <Panel index="01" title="Project details" actions={!mayEdit && <span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Read-only</span>}>
        <form onSubmit={save} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" error={error}><TextInput value={form.name} onChange={(e) => { set('name')(e); setError('') }} disabled={!mayEdit} /></Field>
          <Field label="Building type"><Dropdown value={form.project_type} onChange={set('project_type')} options={TYPES} disabled={!mayEdit} /></Field>
          <Field label="Location"><TextInput value={form.location} onChange={set('location')} disabled={!mayEdit} placeholder="e.g. Canary Wharf, London" /></Field>
          <Field label="Design code"><TextInput value="EN 1992-1-1 (Eurocode 2)" disabled /></Field>
          <div className="md:col-span-2"><Field label="Description"><TextArea rows={3} value={form.description} onChange={set('description')} disabled={!mayEdit} maxLength={500} /></Field></div>
          {mayEdit && (
            <div className="flex justify-end gap-2 md:col-span-2">
              <Btn disabled={!dirty} onClick={() => setForm(pick(project))}>Discard</Btn>
              <Btn type="submit" variant="primary" disabled={!dirty}><FiSave /> Save details</Btn>
            </div>
          )}
        </form>
      </Panel>

      <Panel index="02" title="Project actions" bodyClass="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
        <Row title={isPersonal(project) ? 'Move into an organisation' : 'Move project'}
          text={isPersonal(project) ? 'Share it with an organisation you belong to (your role there must be Editor or above).' : `It is in ${project.organisation_name}. Move it to another organisation or back to Personal.`}
          action={<Btn onClick={() => setDialog('move')} disabled={!mayEdit}><FiRepeat /> Move</Btn>} />
        <Row title={archived ? 'Restore project' : 'Archive project'}
          text={archived ? 'Bring it back to the active projects list.' : 'Hide it from the active list; nothing is deleted and it can be restored.'}
          action={<Btn disabled={!mayEdit} onClick={async () => {
            const res = await updateProject(project.id, { status: archived ? 'active' : 'archived' })
            onMessage(res.success ? { tone: 'ok', text: archived ? 'Project restored.' : 'Project archived.' } : { tone: 'error', text: res.error })
          }}>{archived ? <><FiRotateCcw /> Restore</> : <><FiArchive /> Archive</>}</Btn>} />
        <Row title="Export" text="Download the project record and its saved designs (inputs, results and reports) as JSON."
          action={<Btn onClick={exportJson}><FiDownload /> Export JSON</Btn>} />
      </Panel>

      {mayDelete && (
        <section className="rounded-md border border-red-300 dark:border-red-500/40 bg-white dark:bg-[#1f2937]">
          <header className="border-b border-red-200 dark:border-red-500/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
            <span className="font-mono">03</span> Danger zone
          </header>
          <Row title="Delete project" text="Removes the project. Its saved designs are kept and go back to Quick Design."
            action={<Btn variant="danger" onClick={() => setDialog('delete')}><FiTrash2 /> Delete</Btn>} />
        </section>
      )}

      {dialog === 'move' && (
        <MoveDialog project={project} workspaces={workspaces} onClose={() => setDialog(null)}
          onMove={async (target) => {
            const res = await moveProject(project.id, target)
            setDialog(null)
            if (res.success) navigate(`/workspace/${res.workspaceId}/projects/${project.id}?tab=settings`, { replace: true })
            onMessage(res.success ? { tone: 'ok', text: 'Project moved.' } : { tone: 'error', text: res.error })
          }} />
      )}
      {dialog === 'delete' && (
        <DeleteDialog project={project} onClose={() => setDialog(null)}
          onConfirm={async () => {
            const designs = listForProject(project.id)
            const res = await deleteProject(project.id)
            if (!res.success) { setDialog(null); onMessage({ tone: 'error', text: res.error }); return }
            designs.forEach((d) => assignToProject(d.element, d.id, null))
            navigate('/workspace/all/projects')
          }} />
      )}
    </div>
  )
}

function Row({ title, text, action }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-[#0F172A] dark:text-white">{title}</div>
        <p className="mt-0.5 max-w-2xl text-sm text-[#64748b] dark:text-[#94a3b8]">{text}</p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}

function MoveDialog({ project, workspaces, onClose, onMove }) {
  const targets = [
    ...(isPersonal(project) ? [] : [{ value: PERSONAL_WS, label: 'Personal (no organisation)' }]),
    ...workspaces.filter((w) => w.id !== project.workspace_id && can(w.userRole, 'project.create')).map((w) => ({ value: w.id, label: w.name })),
  ]
  const [to, setTo] = useState('')
  return (
    <Modal title="Move project" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!to} onClick={() => onMove(to)}>Move project</Btn></>}>
      <p>“{project.name}” is in <strong>{project.organisation_name || 'Personal'}</strong>.</p>
      {targets.length === 0 ? (
        <Notice tone="info">There is nowhere to move it: you are not in an organisation where your role is Editor or above. <Link to="/workspace/create" className="underline">Create an organisation</Link>.</Notice>
      ) : (
        <Field label="Move to"><Dropdown value={to} onChange={setTo} options={targets} placeholder="Select..." /></Field>
      )}
      {!isPersonal(project) && <Notice tone="warn">Members of {project.organisation_name} lose access unless they also belong to the destination.</Notice>}
    </Modal>
  )
}

function DeleteDialog({ project, onClose, onConfirm }) {
  const [confirm, setConfirm] = useState('')
  const n = listForProject(project.id).length
  return (
    <Modal title="Delete project" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" disabled={confirm.trim() !== project.name} onClick={onConfirm}>Delete project</Btn></>}>
      <Notice tone="error">This cannot be undone.</Notice>
      <p>{n ? <>Its {n} saved design{n === 1 ? '' : 's'} {n === 1 ? 'is' : 'are'} kept and moved back to Quick Design.</> : 'It has no saved designs.'}
        {project.organisation_name && <> Members of {project.organisation_name} lose it too.</>}</p>
      <Field label={<ConfirmLabel name={project.name} />}>
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} mono autoFocus />
      </Field>
    </Modal>
  )
}

