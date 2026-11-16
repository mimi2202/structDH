// /saved-designs — every design saved in this browser that the user can see:
// quick designs and designs in their projects. Open (results page) or delete.
// (Old pages/SavedDesigns.jsx kept on disk, unrouted.)
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiSearch, FiExternalLink, FiTrash2, FiFileText } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { listAllDesigns, deleteDesign, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'
import { ALL_WS, projectWsId } from '../../utils/projects'
import { Panel, Btn, TextInput, Modal, Th, Empty } from '../org/orgUi'
import { fmtTs } from '../org/orgFormat'

const QUICK = '__quick'

export default function SavedDesignsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { listUserProjects } = useWorkspace()
  const [, setVersion] = useState(0)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [element, setElement] = useState('all')
  const [deleting, setDeleting] = useState(null)

  const projects = listUserProjects(ALL_WS)
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]))
  const designs = listAllDesigns().filter((d) => (d.project_id ? !!projectById[d.project_id] : (!d.owner_id || d.owner_id === user?.id)))
  const rows = designs.filter((d) => `${d.name} ${d.subtitle || ''} ${projectById[d.project_id]?.name || ''}`.toLowerCase().includes(q.trim().toLowerCase())
    && (scope === 'all' || (scope === QUICK ? !d.project_id : d.project_id === scope))
    && (element === 'all' || d.element === element))
  const mine = (d) => !d.owner_id || d.owner_id === user?.id

  return (
    <AccountLayout title="Saved Designs" subtitle="Every design you have saved, in projects and as quick designs">
      <div className="space-y-4 p-4 sm:p-8">
        <Panel index="01" title={`Saved designs · ${rows.length}`} bodyClass=""
          actions={<Link to="/reports"><Btn size="sm"><FiFileText /> Reports &amp; packages</Btn></Link>}>
          <div className="grid grid-cols-1 gap-2 border-b border-[#e2e8f0] p-3 dark:border-[#334155] md:grid-cols-[1fr_13rem_12rem]">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or project" className="pl-9" aria-label="Search saved designs" />
            </div>
            <Dropdown value={scope} onChange={setScope}
              options={[{ value: 'all', label: 'All designs' }, { value: QUICK, label: 'Quick designs' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
            <Dropdown value={element} onChange={setElement}
              options={[{ value: 'all', label: 'All elements' }, ...Object.entries(ELEMENTS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Empty>{designs.length ? 'No designs match' : 'No saved designs yet'}</Empty>
              {!designs.length && <Link to="/quick-design"><Btn variant="primary">Start a design</Btn></Link>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] dark:border-[#334155] dark:bg-[#172030]">
                  <tr><Th>Design</Th><Th>Element</Th><Th>Project</Th><Th>Result</Th><Th>Saved</Th><Th className="text-right">Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                  {rows.map((d) => {
                    const p = projectById[d.project_id]
                    return (
                      <tr key={`${d.element}-${d.id}`} data-saved={d.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-[#0F172A] dark:text-white">{d.name || 'Untitled design'}</div>
                          {d.subtitle && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{d.subtitle}</div>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">{ELEMENTS[d.element]?.label || d.element}</td>
                        <td className="px-4 py-2.5 text-sm">
                          {p ? <Link to={`/workspace/${projectWsId(p)}/projects/${p.id}/design`} className="text-[#0A2F44] hover:underline dark:text-[#66a4c2]">{p.name}</Link>
                            : <Link to="/quick-design" className="text-[#64748b] hover:underline dark:text-[#94a3b8]">Quick design</Link>}
                        </td>
                        <td className="px-4 py-2.5">
                          {d.status
                            ? <span className={`font-mono text-[11px] font-semibold uppercase ${d.status === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{d.status}</span>
                            : <span className="text-[#94a3b8]">-</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <Btn size="sm" onClick={() => navigate(designRoute(d, d.element), { state: designState(d) })}><FiExternalLink /> Open</Btn>
                            {mine(d) && <Btn size="sm" variant="dangerOutline" aria-label="Delete design" onClick={() => setDeleting(d)}><FiTrash2 /></Btn>}
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
        <Modal title="Delete design" onClose={() => setDeleting(null)}
          footer={<><Btn onClick={() => setDeleting(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => { deleteDesign(deleting.element, deleting.id); setDeleting(null); setVersion((v) => v + 1) }}>Delete</Btn></>}>
          <p>Delete “{deleting.name || 'Untitled design'}”? The saved result and its report are removed from this browser.</p>
        </Modal>
      )}
    </AccountLayout>
  )
}
