// /workspace/:workspaceId/projects  ("all", "personal" or an organisation id)
// Every project the user can see, with search / filters, and per-project
// actions: open the design hub, details, archive/restore and delete (subject
// to the role: personal projects by their owner; organisation projects by an
// Owner or Admin there).
import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiPlus, FiSearch, FiExternalLink, FiSettings, FiTrash2, FiArchive, FiRotateCcw } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { PERSONAL_WS, ALL_WS, projectWsId } from '../../utils/projects'
import { listForProject, assignToProject } from '../../utils/savedDesigns'
import { can } from '../../utils/orgRbac'
import { Panel, Btn, Field, TextInput, Notice, Modal, Th, Empty, ConfirmLabel } from '../org/orgUi'
import { fmtDate } from '../org/orgFormat'

const BLUEPRINT = {
  backgroundColor: '#0A2F44',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
}

const TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'other', label: 'Other' },
]

function Spec({ label, children }) {
  return (
    <div className="min-w-[110px] border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white tabular-nums">{children}</div>
    </div>
  )
}

export default function ProjectsPage() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { workspaces, listUserProjects, deleteProject, updateProject } = useWorkspace()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('active')
  const [deleting, setDeleting] = useState(null)
  const [msg, setMsg] = useState(null)
  const [, setVersion] = useState(0)

  const scope = workspaceId || ALL_WS
  const roleIn = Object.fromEntries(workspaces.map((w) => [w.id, w.userRole]))
  const everything = listUserProjects(ALL_WS)
  const inScope = listUserProjects(scope)
  const rows = inScope
    .filter((p) => (status === 'archived' ? p.status === 'archived' : p.status !== 'archived'))
    .filter((p) => type === 'all' || (p.project_type || 'other') === type)
    .filter((p) => `${p.name} ${p.location || ''} ${p.organisation_name || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .map((p) => ({ ...p, designs: listForProject(p.id) }))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))

  // Personal projects: their owner. Organisation projects: by role there.
  const mayDelete = (p) => (p.workspace_id ? can(roleIn[p.workspace_id], 'project.delete') : (!p.owner_id || p.owner_id === user?.id))
  const mayEdit = (p) => (p.workspace_id ? can(roleIn[p.workspace_id], 'project.edit') : (!p.owner_id || p.owner_id === user?.id))

  const scopeOptions = [
    { value: ALL_WS, label: 'All projects' },
    { value: PERSONAL_WS, label: 'Personal' },
    ...workspaces.map((w) => ({ value: w.id, label: w.name })),
  ]
  const newPath = `/workspace/${scope === ALL_WS ? PERSONAL_WS : scope}/projects/new`
  const totalDesigns = everything.reduce((n, p) => n + listForProject(p.id).length, 0)

  const setArchived = async (p, archived) => {
    const res = await updateProject(p.id, { status: archived ? 'archived' : 'active' })
    setMsg(res.success ? { tone: 'ok', text: archived ? `“${p.name}” archived.` : `“${p.name}” restored.` } : { tone: 'error', text: res.error })
    setVersion((v) => v + 1)
  }

  return (
    <AccountLayout title="Projects" subtitle="Personal projects and projects in your organisations">
      <div style={BLUEPRINT} className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Projects</h2>
            <p className="mt-1 text-sm text-white/70">Open a project to design in its hub. Personal projects can be moved into an organisation from their settings.</p>
          </div>
          <Link to={newPath}><Btn className="border border-white/30 bg-white/10 text-white hover:bg-white/20"><FiPlus /> New project</Btn></Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-y-3">
          <Spec label="Projects">{everything.filter((p) => p.status !== 'archived').length}</Spec>
          <Spec label="Personal">{everything.filter((p) => !p.workspace_id && p.status !== 'archived').length}</Spec>
          <Spec label="In organisations">{everything.filter((p) => p.workspace_id && p.status !== 'archived').length}</Spec>
          <Spec label="Archived">{everything.filter((p) => p.status === 'archived').length}</Spec>
          <Spec label="Saved designs">{totalDesigns}</Spec>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-8">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        <Panel index="01" title={`${status === 'archived' ? 'Archived' : 'Active'} projects · ${rows.length}`} bodyClass="">
          <div className="grid grid-cols-1 gap-2 border-b border-[#e2e8f0] dark:border-[#334155] p-3 md:grid-cols-[1fr_12rem_10rem_9rem]">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, location or organisation" className="pl-9" aria-label="Search projects" />
            </div>
            <Dropdown value={scope} onChange={(v) => navigate(`/workspace/${v}/projects`, { replace: true })} options={scopeOptions} />
            <Dropdown value={type} onChange={setType} options={TYPES} />
            <Dropdown value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} />
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Empty>{inScope.length ? 'No projects match' : 'No projects yet'}</Empty>
              {!inScope.length && <Link to={newPath}><Btn variant="primary"><FiPlus /> Create a project</Btn></Link>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                  <tr><Th>Project</Th><Th>Organisation</Th><Th>Type</Th><Th className="text-right">Designs</Th><Th className="text-right">Updated</Th><Th className="text-right">Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                  {rows.map((p) => {
                    const ws = projectWsId(p)
                    const pass = p.designs.filter((d) => d.status === 'PASS').length
                    return (
                      <tr key={p.id} data-project={p.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                        <td className="px-4 py-3">
                          <Link to={`/workspace/${ws}/projects/${p.id}/design`} className="text-sm font-semibold text-[#0A2F44] dark:text-[#66a4c2] hover:underline">{p.name}</Link>
                          <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{p.location || 'No location'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#0F172A] dark:text-white">{p.organisation_name || <span className="text-[#64748b] dark:text-[#94a3b8]">Personal</span>}</td>
                        <td className="px-4 py-3 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">{p.project_type || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[#0F172A] dark:text-white">
                          {p.designs.length}
                          {p.designs.length > 0 && <span className="ml-1 text-[11px] text-[#64748b]">({pass} pass)</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtDate(p.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Link to={`/workspace/${ws}/projects/${p.id}/design`}><Btn size="sm" variant="primary"><FiExternalLink /> Open</Btn></Link>
                            <Link to={`/workspace/${ws}/projects/${p.id}`} title="Details, team and settings"><Btn size="sm" aria-label="Project details"><FiSettings /></Btn></Link>
                            {mayEdit(p) && (
                              <Btn size="sm" title={p.status === 'archived' ? 'Restore' : 'Archive'} aria-label={p.status === 'archived' ? 'Restore project' : 'Archive project'}
                                onClick={() => setArchived(p, p.status !== 'archived')}>
                                {p.status === 'archived' ? <FiRotateCcw /> : <FiArchive />}
                              </Btn>
                            )}
                            {mayDelete(p) && (
                              <Btn size="sm" variant="dangerOutline" title="Delete project" aria-label="Delete project" onClick={() => { setMsg(null); setDeleting(p) }}><FiTrash2 /></Btn>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {deleting && (
        <DeleteDialog project={deleting} onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const designs = listForProject(deleting.id)
            const res = await deleteProject(deleting.id)
            // only once the project is gone: its designs go back to Quick Design
            if (res.success) designs.forEach((d) => assignToProject(d.element, d.id, null))
            setDeleting(null)
            setVersion((v) => v + 1)
            setMsg(res.success
              ? { tone: 'ok', text: `“${deleting.name}” deleted.${designs.length ? ` ${designs.length} saved design(s) moved to Quick Design.` : ''}` }
              : { tone: 'error', text: res.error || 'The project could not be deleted.' })
          }} />
      )}
    </AccountLayout>
  )
}

function DeleteDialog({ project, onClose, onConfirm }) {
  const [confirm, setConfirm] = useState('')
  const n = listForProject(project.id).length
  return (
    <Modal title="Delete project" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" disabled={confirm.trim() !== project.name} onClick={onConfirm}>Delete project</Btn></>}>
      <Notice tone="error">This cannot be undone.</Notice>
      <p>
        {n
          ? <>Its {n} saved design{n === 1 ? '' : 's'} {n === 1 ? 'is' : 'are'} kept and moved back to Quick Design.</>
          : 'It has no saved designs.'}
        {project.organisation_name && <> Members of {project.organisation_name} lose it too.</>}
      </p>
      <Field label={<ConfirmLabel name={project.name} />}>
        <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} mono autoFocus />
      </Field>
    </Modal>
  )
}
