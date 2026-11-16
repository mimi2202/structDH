// /reports — every calculation report (saved design) the user can see, with
// its checking status (Draft / Checked / Issued), and the calculation package
// builder: one PDF for a project (cover, contents, design basis, summary, each
// full calculation trace).
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiSearch, FiExternalLink, FiDownload, FiCheckSquare, FiSend, FiRotateCcw, FiFileText, FiAlertTriangle } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import Dropdown from '../../components/Dropdown'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { listAllDesigns, designRoute, designState, ELEMENTS } from '../../utils/savedDesigns'
import { reportPeople } from '../../utils/reportCover'
import { getStatus, setStatus, STATUS } from '../../utils/reportStatus'
import { reportOf, packageOrder, packageCoverHtml } from '../../utils/calcPackage'
import { exportElementToPdf } from '../../utils/exportPdf'
import { ALL_WS } from '../../utils/projects'
import { can } from '../../utils/orgRbac'
import { Panel, Btn, Field, TextInput, Notice, Modal, Th, Empty } from '../org/orgUi'
import { fmtTs } from '../org/orgFormat'
import CalcPackage from './CalcPackage'
import DesignPdfHost from './DesignPdfHost'

const BLUEPRINT = {
  backgroundColor: '#0A2F44',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
  backgroundSize: '64px 64px, 64px 64px, 16px 16px, 16px 16px',
}
const QUICK = '__quick'

const STATUS_STYLE = {
  draft: 'border-slate-300 text-slate-600 dark:border-slate-500/50 dark:text-slate-300',
  checked: 'border-blue-300 text-blue-700 dark:border-blue-500/50 dark:text-blue-300',
  issued: 'border-emerald-300 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300',
}
const StatusChip = ({ st }) => (
  <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[st.status]}`}>
    {STATUS[st.status].label}{st.revision ? ` · Rev ${st.revision}` : ''}
  </span>
)
const Result = ({ s }) => (s
  ? <span className={`font-mono text-[11px] font-semibold uppercase ${s === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{s}</span>
  : <span className="text-[#94a3b8]">-</span>)

function Spec({ label, children }) {
  return (
    <div className="min-w-[100px] border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-white tabular-nums">{children}</div>
    </div>
  )
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const { workspaces, listUserProjects } = useWorkspace()
  const [, setVersion] = useState(0)
  const [msg, setMsg] = useState(null)
  const [statusFor, setStatusFor] = useState(null)
  const [printing, setPrinting] = useState(null) // calculation package: { title, project, designs }
  const [pdfDesign, setPdfDesign] = useState(null) // one design's Overview report
  const printRef = useRef(null)
  const tab = params.get('tab') === 'package' ? 'package' : 'register'

  // Projects the user can see, and every report that belongs to them or is
  // one of the user's own quick designs.
  const projects = listUserProjects(ALL_WS)
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]))
  const roleIn = Object.fromEntries(workspaces.map((w) => [w.id, w.userRole]))
  // (re-read from storage on every render; `version` bumps a render after changes)
  const reports = listAllDesigns().filter((d) => (d.project_id
    ? !!projectById[d.project_id]
    : (!d.owner_id || d.owner_id === user?.id)))

  // May change the checking status: quick designs -> their owner; project
  // designs -> the project owner (personal) or Editor and above (organisation).
  const mayReview = (d) => {
    if (!d.project_id) return !d.owner_id || d.owner_id === user?.id
    const p = projectById[d.project_id]
    return p.workspace_id ? can(roleIn[p.workspace_id], 'project.edit') : (!p.owner_id || p.owner_id === user?.id)
  }

  const counts = reports.reduce((c, d) => { c[getStatus(d).status] += 1; return c }, { draft: 0, checked: 0, issued: 0 })

  // Download: render the package off screen, then hand it to the PDF exporter.
  useEffect(() => {
    if (!printing || !printRef.current) return
    const { title, project, designs } = printing
    exportElementToPdf(printRef.current, title.replace(/[^\w-]+/g, '_'), packageCoverHtml({ title, project, designs }))
      .finally(() => setPrinting(null))
  }, [printing])

  // PDF from the register = the design's full Overview report (as its results page downloads it)
  const downloadOne = (d) => { setMsg({ tone: 'info', text: `Preparing the report for “${d.name}”…` }); setPdfDesign(d) }

  return (
    <AccountLayout title="Reports" subtitle="Calculation reports, checking status and calculation packages">
      <div style={BLUEPRINT} className="border-b border-black/20 px-4 pt-6 sm:px-8">
        <h2 className="text-2xl font-semibold text-white">Reports</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Every saved design is a calculation report. Record who checked it and when it was issued. PDF gives a design's full report with its drawings and charts; the calculation package gives the detailed calculations of a whole project in one document.
        </p>
        <div className="mt-5 flex flex-wrap gap-y-3 pb-4">
          <Spec label="Reports">{reports.length}</Spec>
          <Spec label="Draft">{counts.draft}</Spec>
          <Spec label="Checked">{counts.checked}</Spec>
          <Spec label="Issued">{counts.issued}</Spec>
          <Spec label="Failing">{reports.filter((d) => d.status === 'FAIL').length}</Spec>
        </div>
        <nav className="-mb-px flex gap-1" aria-label="Report sections">
          {[['register', 'Report register'], ['package', 'Calculation package (detailed)']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setParams(id === 'register' ? {} : { tab: id }, { replace: true })}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${id === tab ? 'border-[#66a4c2] text-white' : 'border-transparent text-white/60 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-4 p-4 sm:p-8">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {tab === 'register'
          ? <Register reports={reports} projects={projects} projectById={projectById} mayReview={mayReview}
              onOpen={(d) => navigate(designRoute(d, d.element), { state: designState(d) })}
              onDownload={downloadOne} onStatus={(d) => { setMsg(null); setStatusFor(d) }} busy={!!printing || !!pdfDesign} />
          : <PackageBuilder reports={reports} projects={projects} projectById={projectById}
              onDownload={(job) => setPrinting(job)} busy={!!printing} />}
      </div>

      {statusFor && (
        <StatusDialog design={statusFor} user={user} onClose={() => setStatusFor(null)}
          onDone={(text) => { setStatusFor(null); setMsg({ tone: 'ok', text }); setVersion((v) => v + 1) }} />
      )}

      {/* off-screen copy used for PDF downloads from the register */}
      {pdfDesign && <DesignPdfHost design={pdfDesign} onDone={(err) => { setPdfDesign(null); setMsg(err ? { tone: 'error', text: err } : null) }} />}

      {printing && (
        <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 w-[1000px]">
          <CalcPackage ref={printRef} project={printing.project} designs={printing.designs} />
        </div>
      )}
    </AccountLayout>
  )
}

function Register({ reports, projects, projectById, mayReview, onOpen, onDownload, onStatus, busy }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [element, setElement] = useState('all')
  const [result, setResult] = useState('all')
  const [status, setStatusF] = useState('all')

  const rows = reports.filter((d) => {
    const st = getStatus(d).status
    const text = `${d.name} ${d.subtitle || ''} ${projectById[d.project_id]?.name || ''} ${reportPeople(reportOf(d)).calcId}`.toLowerCase()
    return text.includes(q.trim().toLowerCase())
      && (scope === 'all' || (scope === QUICK ? !d.project_id : d.project_id === scope))
      && (element === 'all' || d.element === element)
      && (result === 'all' || d.status === result)
      && (status === 'all' || st === status)
  })

  return (
    <Panel index="01" title={`Report register · ${rows.length}`} bodyClass="">
      <div className="grid grid-cols-1 gap-2 border-b border-[#e2e8f0] dark:border-[#334155] p-3 lg:grid-cols-[1fr_12rem_11rem_8rem_9rem]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, project or calc ID" className="pl-9" aria-label="Search reports" />
        </div>
        <Dropdown value={scope} onChange={setScope} options={[{ value: 'all', label: 'All projects' }, { value: QUICK, label: 'Quick designs' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
        <Dropdown value={element} onChange={setElement} options={[{ value: 'all', label: 'All elements' }, ...Object.entries(ELEMENTS).map(([k, v]) => ({ value: k, label: v.label }))]} />
        <Dropdown value={result} onChange={setResult} options={[{ value: 'all', label: 'Any result' }, { value: 'PASS', label: 'Pass' }, { value: 'FAIL', label: 'Fail' }]} />
        <Dropdown value={status} onChange={setStatusF} options={[{ value: 'all', label: 'Any status' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Empty>{reports.length ? 'No reports match' : 'No reports yet'}</Empty>
          {!reports.length && <p className="-mt-4 text-sm text-[#64748b] dark:text-[#94a3b8]">Run a design (Quick Design or a project's design hub) and press Save on its results page.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#172030]">
              <tr><Th>Calc ID</Th><Th>Report</Th><Th>Project</Th><Th>Result</Th><Th>Designed by</Th><Th>Status</Th><Th>Saved</Th><Th className="text-right">Actions</Th></tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
              {rows.map((d) => {
                const people = reportPeople(reportOf(d))
                const st = getStatus(d)
                return (
                  <tr key={`${d.element}-${d.id}`} data-report={d.name} className="hover:bg-[#f8fafc] dark:hover:bg-[#172030]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#475569] dark:text-[#cbd5e1]">{people.calcId || '-'}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-[#0F172A] dark:text-white">{d.name}</div>
                      <div className="font-mono text-[11px] uppercase text-[#64748b] dark:text-[#94a3b8]">{ELEMENTS[d.element]?.label}{d.subtitle ? ` · ${d.subtitle}` : ''}</div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-[#0F172A] dark:text-white">{projectById[d.project_id]?.name || <span className="text-[#64748b]">Quick design</span>}</td>
                    <td className="px-4 py-2.5"><Result s={d.status} /></td>
                    <td className="px-4 py-2.5 text-sm text-[#0F172A] dark:text-white">{people.designer}</td>
                    <td className="px-4 py-2.5">
                      <StatusChip st={st} />
                      {st.checked_by && st.status !== 'draft' && <div className="mt-0.5 text-[11px] text-[#64748b]">by {st.checked_by}</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-[#64748b] dark:text-[#94a3b8]">{fmtTs(d.saved_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Btn size="sm" onClick={() => onOpen(d)}><FiExternalLink /> Open</Btn>
                        <Btn size="sm" onClick={() => onDownload(d)} disabled={busy} aria-label="Download PDF"><FiDownload /> PDF</Btn>
                        {mayReview(d) && <Btn size="sm" variant="primary" onClick={() => onStatus(d)}><FiCheckSquare /> Status</Btn>}
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
  )
}

function StatusDialog({ design, user, onClose, onDone }) {
  const st = getStatus(design)
  const [person, setPerson] = useState(user?.name || '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const people = reportPeople(reportOf(design))
  const selfCheck = (design.owner_id && design.owner_id === user?.id) || (people.designer !== 'Not entered' && people.designer.toLowerCase().includes((person || '#').toLowerCase()))

  const act = (action, text) => {
    if (action !== 'draft' && !person.trim()) { setError('Enter the name to record.'); return }
    try {
      setStatus(design, action, person.trim(), note.trim())
      onDone(text)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal title="Checking status" onClose={onClose} width="max-w-xl"
      footer={<>
        <Btn onClick={onClose}>Cancel</Btn>
        {st.status !== 'draft' && <Btn onClick={() => act('draft', `“${design.name}” set back to Draft.`)}><FiRotateCcw /> Back to draft</Btn>}
        {st.status !== 'issued' && <Btn variant="primary" onClick={() => act('check', `“${design.name}” marked as checked.`)}><FiCheckSquare /> Mark checked</Btn>}
        {st.status === 'checked' && <Btn variant="primary" onClick={() => act('issue', `“${design.name}” issued.`)}><FiSend /> Issue</Btn>}
      </>}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[#0F172A] dark:text-white">{design.name}</span>
        <StatusChip st={st} />
      </div>
      <p className="text-xs">Draft → Checked (a second engineer has checked it) → Issued (released for use; the revision letter moves on each time it is issued again).</p>
      <Field label="Name to record (checker / issuer)" error={error}><TextInput value={person} onChange={(e) => { setPerson(e.target.value); setError('') }} /></Field>
      <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked against hand calc; spans per drawing S-101" /></Field>
      {selfCheck && st.status === 'draft' && (
        <Notice tone="warn"><span className="inline-flex items-center gap-1"><FiAlertTriangle /> You appear to be the designer.</span> A check should normally be done by someone else; it will be recorded as you enter it.</Notice>
      )}
      {st.history?.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">History</div>
          <ul className="max-h-40 space-y-1 overflow-auto font-mono text-[11px]">
            {st.history.map((h, i) => (
              <li key={i}>{fmtTs(h.at)} · {h.action}{h.revision ? ` (Rev ${h.revision})` : ''} · {h.person || '-'}{h.note ? ` · ${h.note}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function PackageBuilder({ reports, projects, projectById, onDownload, busy }) {
  const withDesigns = projects.filter((p) => reports.some((d) => d.project_id === p.id))
  const [scope, setScope] = useState(withDesigns[0]?.id || (reports.some((d) => !d.project_id) ? QUICK : ''))
  const inScope = packageOrder(reports.filter((d) => (scope === QUICK ? !d.project_id : d.project_id === scope)))
  const [picked, setPicked] = useState(() => new Set(inScope.map((d) => `${d.element}:${d.id}`)))
  const [prevScope, setPrevScope] = useState(scope)
  if (prevScope !== scope) { // new project: select all of its reports
    setPrevScope(scope)
    setPicked(new Set(inScope.map((d) => `${d.element}:${d.id}`)))
  }
  const designs = inScope.filter((d) => picked.has(`${d.element}:${d.id}`))
  const project = scope === QUICK ? null : projectById[scope] || null
  const title = project ? `${project.name} — Calculation Package` : 'Quick Designs — Calculation Package'
  const toggle = (k) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const drafts = designs.filter((d) => getStatus(d).status === 'draft').length

  if (!reports.length) return <Panel title="Calculation package"><Empty>No reports to package yet</Empty></Panel>

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <Panel index="01" title="Contents">
          <Field label="Project">
            <Dropdown value={scope} onChange={setScope} placeholder="Select a project"
              options={[...withDesigns.map((p) => ({ value: p.id, label: p.name })), ...(reports.some((d) => !d.project_id) ? [{ value: QUICK, label: 'Quick designs (no project)' }] : [])]} />
          </Field>
          <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
            <span>Calculations · {designs.length} of {inScope.length}</span>
            <span className="flex gap-2">
              <button type="button" className="underline" onClick={() => setPicked(new Set(inScope.map((d) => `${d.element}:${d.id}`)))}>All</button>
              <button type="button" className="underline" onClick={() => setPicked(new Set())}>None</button>
            </span>
          </div>
          <ul className="mt-2 max-h-80 divide-y divide-[#e2e8f0] overflow-auto rounded border border-[#e2e8f0] dark:divide-[#334155] dark:border-[#334155]">
            {inScope.map((d) => {
              const k = `${d.element}:${d.id}`
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                    <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} data-pick={d.name} />
                    <span className="min-w-0 flex-1 truncate text-[#0F172A] dark:text-white">{d.name}</span>
                    <span className="font-mono text-[10px] uppercase text-[#64748b]">{ELEMENTS[d.element]?.label}</span>
                    <Result s={d.status} />
                  </label>
                </li>
              )
            })}
          </ul>
        </Panel>
        {drafts > 0 && designs.length > 0 && (
          <Notice tone="warn">{drafts} of {designs.length} calculation(s) are still Draft. The cover will say the package is preliminary.</Notice>
        )}
        <Btn variant="primary" className="w-full" disabled={!designs.length || busy}
          onClick={() => onDownload({ title, project, designs })}>
          <FiDownload /> Download calculation package (PDF)
        </Btn>
      </div>

      <Panel index="02" title="Preview" bodyClass="p-6" actions={<span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-[#94a3b8]"><FiFileText /> {designs.length} calculation(s)</span>}>
        {designs.length === 0 ? <Empty>Select at least one calculation</Empty> : (
          <>
            <div className="mb-8 rounded border border-dashed border-[#cbd5e1] dark:border-[#475569] p-4 text-sm" data-package-cover>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#64748b]">Cover page</div>
              <div className="mt-1 text-lg font-bold text-[#0A2F44] dark:text-[#66a4c2]">{title}</div>
              <div className="text-[#64748b]">{designs.length} calculation(s) · {designs.filter((d) => d.status === 'PASS').length} passing · {drafts ? 'Preliminary' : 'Checked'}</div>
            </div>
            <CalcPackage project={project} designs={designs} />
          </>
        )}
      </Panel>
    </div>
  )
}
