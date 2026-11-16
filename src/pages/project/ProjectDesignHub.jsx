// /workspace/:workspaceId/projects/:projectId/design — a project's design hub
// (inside MainLayout, with the element sidebar). Opening it puts the element
// pages in project mode (utils/designMode.js): saves made from them belong to
// this project. Lists the project's designs; Team and Settings live on the
// project details page.
import React, { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowRight, FiExternalLink, FiSettings, FiLock, FiHome, FiMessageSquare, FiLayers, FiBarChart2, FiColumns, FiSquare, FiTriangle } from 'react-icons/fi'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { QUICK_ELEMENTS, startProjectDesign } from '../../utils/designMode'
import { listForProject, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'
import { ALL_WS } from '../../utils/projects'
import { can, roleLabel } from '../../utils/orgRbac'
import { Panel, Btn, Th, Empty, RoleBadge, SectionHeading, CARD_CLASS } from '../org/orgUi'
import { fmtTs, accountFor } from '../org/orgFormat'
import { ChatBubble } from '../../components/chat/ProjectChat'
import { useAuth } from '../../contexts/AuthContext'
import { getMembers } from '../../utils/orgStore'

const ICONS = { slab: FiLayers, 'continuous-slab': FiLayers, beam: FiBarChart2, 'continuous-beam': FiBarChart2, column: FiColumns, pad: FiSquare, combined: FiSquare, staircase: FiTriangle }

export default function ProjectDesignHub() {
  const { workspaceId, projectId } = useParams()
  const navigate = useNavigate()
  const { workspaces, listUserProjects } = useWorkspace()
  const { user } = useAuth()
  const project = listUserProjects(ALL_WS).find((p) => p.id === projectId) || null
  const role = project?.workspace_id ? workspaces.find((w) => w.id === project.workspace_id)?.userRole : 'owner'
  const mayDesign = !project?.workspace_id || can(role, 'project.edit')
  const detailsPath = `/workspace/${workspaceId}/projects/${projectId}`

  useEffect(() => {
    if (project && mayDesign) startProjectDesign(project)
  }, [project?.id, project?.name, mayDesign]) // eslint-disable-line react-hooks/exhaustive-deps

  // storage read per project
  const designs = useMemo(() => listForProject(projectId), [projectId])

  if (!project) {
    return (
      <Panel index="404" title="Project not found">
        <div className="flex flex-col items-start gap-3 text-sm text-[#334155] dark:text-[#cbd5e1]">
          <p className="flex items-center gap-2"><FiLock /> This project does not exist, or you do not have access to it.</p>
          <Link to="/workspace/all/projects"><Btn variant="primary">Your projects</Btn></Link>
        </div>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-[#94a3b8]">Project design hub</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0F172A] dark:text-white">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
            <span>{project.organisation_name || 'Personal project'}</span>
            {project.workspace_id && <RoleBadge role={role} />}
            {project.location && <span>· {project.location}</span>}
            {project.project_type && <span className="font-mono text-xs uppercase">· {project.project_type}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard"><Btn><FiHome /> Dashboard</Btn></Link>
          <Link to={`${detailsPath}?tab=discussion`} state={{ from: 'hub' }}><Btn><FiMessageSquare /> Discussion</Btn></Link>
          <Link to={detailsPath} state={{ from: 'hub' }}><Btn><FiSettings /> Project details, team &amp; settings</Btn></Link>
        </div>
      </div>

      {!mayDesign && (
        <Panel title="Read-only">
          <p className="text-sm text-[#334155] dark:text-[#cbd5e1]">
            Your role in {project.organisation_name} is {roleLabel(role)}: you can open this project&apos;s designs but not run new ones for it.
          </p>
        </Panel>
      )}

      {mayDesign && (
        <section>
        <SectionHeading index="01" title="Design an element for this project"
          actions={<span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Saves go to this project</span>} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ELEMENTS.map((el) => {
            const Icon = ICONS[el.key] || FiLayers
            return (
              <button key={el.key} type="button" data-element={el.key} onClick={() => navigate(el.path)}
                className={`group flex h-full flex-col p-4 text-left ${CARD_CLASS}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-[#cbd5e1] dark:border-[#475569] text-[#0A2F44] dark:text-[#66a4c2]"><Icon /></span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">{el.code}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#0F172A] dark:text-white">{el.label}</h3>
                <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">{el.summary}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold uppercase tracking-wider text-[#0A2F44] dark:text-[#66a4c2]">
                  Design <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>
        </section>
      )}

      <Panel index={mayDesign ? '02' : '01'} title={`Designs in this project · ${designs.length}`} bodyClass="">
        {designs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Empty>No designs in this project yet</Empty>
            <p className="-mt-4 text-sm text-[#64748b] dark:text-[#94a3b8]">Pick an element above, run the design and press <strong>Save</strong> on the results page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                <tr><Th>Design</Th><Th>Element</Th><Th>Result</Th><Th>By</Th><Th>Saved</Th><Th className="text-right" /></tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                {designs.map((d) => (
                  <tr key={`${d.element}-${d.id}`} data-design={d.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-[#0F172A] dark:text-white">{d.name || 'Untitled design'}</div>
                      {d.subtitle && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{d.subtitle}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">{ELEMENTS[d.element]?.label || d.element}</td>
                    <td className="px-4 py-2.5">
                      {d.status
                        ? <span className={`font-mono text-[11px] font-semibold uppercase ${d.status === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{d.status}</span>
                        : <span className="text-[#94a3b8]">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-[#0F172A] dark:text-white">{d.owner_name || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Btn size="sm" onClick={() => navigate(designRoute(d, d.element), { state: designState(d) })}><FiExternalLink /> Open</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ChatBubble project={project} user={user} designs={designs}
        members={project.workspace_id
          ? getMembers(project.workspace_id).filter((m) => m.status === 'active' && m.user_id)
            .map((m) => { const a = accountFor(m); return { id: m.user_id, name: a?.name || m.name, email: m.email, avatar: a?.avatar } })
          : [{ id: user.id, name: user.name || user.email, email: user.email, avatar: user.avatar }]} />
    </div>
  )
}
