// /quick-design — design one element on its own (no project), with the same
// engines and reports as inside a project. Saved results are listed here and
// can be added to a project later.
import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiFolderPlus, FiExternalLink, FiTrash2, FiLayers, FiBarChart2, FiColumns, FiSquare, FiTriangle } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { QUICK_ELEMENTS, startQuickDesign } from '../../utils/designMode'
import { listUnassigned, assignToProject, deleteDesign, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'
import { PERSONAL_WS, ALL_WS, projectWsId } from '../../utils/projects'
import { can } from '../../utils/orgRbac'
import { Panel, Btn, Field, TextInput, Notice, Modal, Th, Empty, SectionHeading, CARD_CLASS } from '../org/orgUi'
import { fmtTs } from '../org/orgFormat'

const ICONS = { slab: FiLayers, 'continuous-slab': FiLayers, beam: FiBarChart2, 'continuous-beam': FiBarChart2, column: FiColumns, pad: FiSquare, combined: FiSquare, staircase: FiTriangle }

const BLUEPRINT = {
  backgroundColor: '#0A2F44',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
}

// Which quick element a saved design belongs to (pad and combined footings
// share one saved list).
const quickKeyFor = (d) => {
  if (d.element === 'foundation') return /"foundation_type":"combined"|"combined"/.test(JSON.stringify(d.state || {})) ? 'combined' : 'pad'
  return QUICK_ELEMENTS.find((e) => e.saved === d.element)?.key || d.element
}

const StatusTag = ({ status }) => (
  status ? (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${status === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'PASS' ? 'bg-emerald-500' : 'bg-red-500'}`} />{status}
    </span>
  ) : <span className="font-mono text-[11px] text-[#94a3b8]">-</span>
)

export default function QuickDesignHome() {
  const navigate = useNavigate()
  const { workspaces, listUserProjects, createProject } = useWorkspace()
  const [version, setVersion] = useState(0)
  const [assigning, setAssigning] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [msg, setMsg] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- version re-reads storage
  const designs = useMemo(() => listUnassigned(), [version])

  const start = (el) => {
    startQuickDesign(el.key)
    navigate(el.path)
  }

  const open = (d) => {
    startQuickDesign(quickKeyFor(d))
    navigate(designRoute(d, d.element), { state: designState(d) })
  }

  // Projects the user may add designs to: own personal ones, and those in
  // organisations where the role allows editing projects.
  const roleIn = Object.fromEntries(workspaces.map((w) => [w.id, w.userRole]))
  const targets = listUserProjects(ALL_WS)
    .filter((p) => p.status !== 'archived' && (!p.workspace_id || can(roleIn[p.workspace_id], 'project.edit')))
  const orgChoices = workspaces.filter((w) => can(w.userRole, 'project.create'))

  return (
    <AccountLayout title="Quick Design" subtitle="One element, no project set-up">
      <div style={BLUEPRINT} className="px-4 py-6 sm:px-8">
        <h2 className="text-2xl font-semibold text-white">Quick design</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/75">
          Design a single element on its own, with the same Eurocode 2 engines and calculation reports as a project.
          Save the result, and add it to a project whenever you need to.
        </p>
        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['01', 'Pick an element', 'Slab to staircase, below.'],
            ['02', 'Design and save', 'Run the design; use Save on the results page.'],
            ['03', 'Add to a project', 'From the list below, when you are ready.'],
          ].map(([n, t, s]) => (
            <li key={n} className="rounded border border-white/15 bg-white/5 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-[#66a4c2]">{n}</span>
                <span className="text-sm font-semibold text-white">{t}</span>
              </div>
              <p className="mt-0.5 text-xs text-white/60">{s}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-6 p-4 sm:p-8">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        <section>
        <SectionHeading index="01" title={`Choose an element · ${QUICK_ELEMENTS.length}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ELEMENTS.map((el) => {
            const Icon = ICONS[el.key] || FiLayers
            const count = designs.filter((d) => quickKeyFor(d) === el.key).length
            return (
              <button key={el.key} type="button" onClick={() => start(el)} data-element={el.key}
                className={`group flex h-full flex-col p-4 text-left ${CARD_CLASS}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-[#cbd5e1] dark:border-[#475569] text-[#0A2F44] dark:text-[#66a4c2]"><Icon /></span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">{el.code}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#0F172A] dark:text-white">{el.label}</h3>
                <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">{el.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {el.checks.map((c) => (
                    <li key={c} className="rounded border border-[#e2e8f0] dark:border-[#334155] px-1.5 py-0.5 font-mono text-[10px] text-[#475569] dark:text-[#cbd5e1]">{c}</li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">{count ? `${count} saved` : ''}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#0A2F44] dark:text-[#66a4c2]">
                    Start <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        </section>

        <Panel index="02" title={`Your quick designs · ${designs.length}`} bodyClass=""
          actions={<span className="font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]">Not in a project</span>}>
          {designs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Empty>No quick designs saved yet</Empty>
              <p className="-mt-4 text-sm text-[#64748b] dark:text-[#94a3b8]">Run a design and press <strong>Save</strong> on its results page; it appears here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
                  <tr><Th>Design</Th><Th>Element</Th><Th>Result</Th><Th>Saved</Th><Th className="text-right">Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                  {designs.map((d) => (
                    <tr key={`${d.element}-${d.id}`} data-design={d.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-[#0F172A] dark:text-white">{d.name || 'Untitled design'}</div>
                        {d.subtitle && <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{d.subtitle}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs uppercase text-[#475569] dark:text-[#cbd5e1]">
                        {QUICK_ELEMENTS.find((e) => e.key === quickKeyFor(d))?.label || ELEMENTS[d.element]?.label || d.element}
                      </td>
                      <td className="px-4 py-2.5"><StatusTag status={d.status} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Btn size="sm" onClick={() => open(d)}><FiExternalLink /> Open</Btn>
                          <Btn size="sm" variant="primary" onClick={() => { setMsg(null); setAssigning(d) }}><FiFolderPlus /> Add to project</Btn>
                          <Btn size="sm" variant="dangerOutline" onClick={() => setDeleting(d)} aria-label="Delete design"><FiTrash2 /></Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {assigning && (
        <AssignDialog design={assigning} targets={targets} orgChoices={orgChoices} onClose={() => setAssigning(null)}
          onAssign={async ({ mode, projectId, name, org }) => {
            let project = targets.find((p) => p.id === projectId)
            if (mode === 'new') {
              const res = await createProject(org, { name, project_type: 'other', description: `Created from quick design "${assigning.name || ''}"` })
              if (!res.success) return res.error
              project = res.project
            }
            try {
              assignToProject(assigning.element, assigning.id, project)
            } catch (e) {
              return e.message
            }
            setAssigning(null)
            setVersion((v) => v + 1)
            setMsg({ tone: 'ok', text: <>“{assigning.name}” added to <Link className="font-semibold underline" to={`/workspace/${projectWsId(project)}/projects/${project.id}/design`}>{project.name}</Link>.</> })
            return null
          }} />
      )}

      {deleting && (
        <Modal title="Delete design" onClose={() => setDeleting(null)}
          footer={<><Btn onClick={() => setDeleting(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => { deleteDesign(deleting.element, deleting.id); setDeleting(null); setVersion((v) => v + 1) }}>Delete</Btn></>}>
          <p>Delete “{deleting.name || 'Untitled design'}”? The saved result and report are removed from this browser.</p>
        </Modal>
      )}
    </AccountLayout>
  )
}

function AssignDialog({ design, targets, orgChoices, onClose, onAssign }) {
  const [mode, setMode] = useState(targets.length ? 'existing' : 'new')
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState(design.project && !targets.some((p) => p.name === design.project) ? design.project : '')
  const [org, setOrg] = useState(PERSONAL_WS)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (mode === 'existing' && !projectId) { setError('Choose a project.'); return }
    if (mode === 'new' && !name.trim()) { setError('Give the new project a name.'); return }
    setBusy(true)
    const err = await onAssign({ mode, projectId, name: name.trim(), org })
    setBusy(false)
    if (err) setError(err)
  }

  const radio = (value, label) => (
    <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${mode === value ? 'border-[#0A2F44] bg-[#f0f7fb] dark:border-[#66a4c2] dark:bg-[#172f3d]' : 'border-[#cbd5e1] dark:border-[#475569]'} ${value === 'existing' && !targets.length ? 'pointer-events-none opacity-50' : ''}`}>
      <input type="radio" name="assign-mode" value={value} checked={mode === value} onChange={() => { setMode(value); setError('') }} />
      {label}
    </label>
  )

  return (
    <Modal title="Add to project" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit} disabled={busy}>Add to project</Btn></>}>
      <p>“{design.name || 'Untitled design'}” moves out of quick designs and into the project’s Design Work.</p>
      <div className="flex gap-2">{radio('existing', 'Existing project')}{radio('new', 'New project')}</div>
      {mode === 'existing' ? (
        <Field label="Project" error={error}>
          <Dropdown value={projectId} onChange={(v) => { setProjectId(v); setError('') }} placeholder="Select a project"
            options={targets.map((p) => ({ value: p.id, label: `${p.name} · ${p.organisation_name || 'Personal'}` }))} />
        </Field>
      ) : (
        <>
          <Field label="Project name" error={error}>
            <TextInput value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder="e.g. Riverside Duplex" autoFocus />
          </Field>
          <Field label="Organisation">
            <Dropdown value={org} onChange={setOrg}
              options={[{ value: PERSONAL_WS, label: 'Personal (no organisation)' }, ...orgChoices.map((w) => ({ value: w.id, label: w.name }))]} />
          </Field>
        </>
      )}
    </Modal>
  )
}
