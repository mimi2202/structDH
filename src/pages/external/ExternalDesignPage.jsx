// /external-design — links to analysis and BIM software. They need the SDH
// desktop agent, which does not exist yet, so this page says what each link
// will do and that it is not available, instead of the old simulation (a
// hard-coded "agent not found", random progress, a download link to a domain
// that does not exist). Old pages/ExternalDesign.jsx kept on disk, unrouted.
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowDownCircle, FiArrowUpCircle, FiCpu, FiInfo, FiX } from 'react-icons/fi'
import AccountLayout from '../../components/layout/AccountLayout'
import { Panel, Btn, Notice, SectionHeading, CARD_CLASS } from '../org/orgUi'

const TOOLS = [
  {
    id: 'etabs', name: 'ETABS', vendor: 'CSI', kind: 'Building analysis', direction: 'in',
    summary: 'Bring member forces and geometry from the analysis model into element designs.',
    steps: ['Pick the ETABS model and load combinations', 'Map frames and shells to beams, columns and slabs', 'Run each element design with the analysis forces', 'Keep the link: re-import when the model changes'],
  },
  {
    id: 'sap2000', name: 'SAP2000', vendor: 'CSI', kind: 'General structural analysis', direction: 'in',
    summary: 'Import design actions (M, V, N) for beams and columns from a SAP2000 model.',
    steps: ['Select the SAP2000 model', 'Choose members and the envelope to use', 'Design them here; results show which member governs', 'Re-import after changes to the model'],
  },
  {
    id: 'tekla', name: 'Tekla Structures', vendor: 'Trimble', kind: 'Structural BIM / detailing', direction: 'out',
    summary: 'Send the designed reinforcement and bar schedules to the Tekla model for detailing.',
    steps: ['Pick the designs to send', 'Match them to Tekla parts', 'Create reinforcement from the designed bars', 'Bar marks follow the schedule in the report'],
  },
  {
    id: 'revit', name: 'Autodesk Revit', vendor: 'Autodesk', kind: 'BIM', direction: 'out',
    summary: 'Write member sizes and reinforcement back to Revit structural elements.',
    steps: ['Pick the designs to send', 'Match them to Revit elements', 'Update sizes and add reinforcement parameters', 'Flag elements whose design fails'],
  },
]

const Mark = ({ name }) => (
  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd5e1] font-mono text-xs font-bold text-[#0A2F44] dark:border-[#475569] dark:text-[#66a4c2]">
    {name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()}
  </span>
)

export default function ExternalDesignPage() {
  const [open, setOpen] = useState(null)

  return (
    <AccountLayout title="External Design" subtitle="Connect analysis and BIM software">
      <div className="space-y-6 p-4 sm:p-8">
        <Notice tone="info">
          External links run through the <strong>SDH desktop agent</strong>, which is still in development. Nothing below can connect yet; each card says what the link will do.
          Until then, enter forces from your analysis by hand on the element pages, or reuse them through <Link to="/load-cases" className="font-semibold underline">Load Cases</Link>.
        </Notice>

        <section>
          <SectionHeading index="01" title="Software" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpen(t)} data-tool={t.id}
                className={`flex h-full flex-col p-5 text-left ${CARD_CLASS}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Mark name={t.name} />
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">{t.name}</h3>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{t.vendor} · {t.kind}</p>
                    </div>
                  </div>
                  <span className="rounded border border-amber-300 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-500/50 dark:text-amber-300">Not available yet</span>
                </div>
                <p className="mt-3 text-sm text-[#334155] dark:text-[#cbd5e1]">{t.summary}</p>
                <div className="mt-auto flex items-center gap-1.5 pt-4 font-mono text-[11px] uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
                  {t.direction === 'in' ? <><FiArrowDownCircle /> Imports into SDH</> : <><FiArrowUpCircle /> Exports from SDH</>}
                </div>
              </button>
            ))}
          </div>
        </section>

        <Panel index="02" title="How the links will work">
          <ol className="space-y-2 text-sm text-[#334155] dark:text-[#cbd5e1]">
            {[
              'Install the SDH desktop agent on the computer that runs the other software.',
              'Sign in to the agent with your Sphere Design Hub account; it then appears as connected here.',
              'Start a link from a project: the agent reads or writes the model, and every exchange is recorded on the project.',
              'Designs made from imported forces show where the forces came from in their calculation report.',
            ].map((s, i) => (
              <li key={i} className="flex gap-3"><span className="font-mono text-xs text-[#0A2F44] dark:text-[#66a4c2]">{String(i + 1).padStart(2, '0')}</span><span>{s}</span></li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 border-t border-[#e2e8f0] pt-3 text-xs text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
            <FiCpu /> Agent status: <span className="font-mono font-semibold uppercase">not released</span>
          </p>
        </Panel>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null) }}>
          <div role="dialog" aria-modal="true" aria-label={open.name} className="w-full max-w-lg rounded-xl border border-[#e2e8f0] bg-white shadow-2xl dark:border-[#334155] dark:bg-[#1f2937]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#334155]">
              <div className="flex items-center gap-3"><Mark name={open.name} /><h2 className="text-sm font-semibold text-[#0F172A] dark:text-white">{open.name}</h2></div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"><FiX /></button>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-[#334155] dark:text-[#cbd5e1]">
              <p>{open.summary}</p>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Planned workflow</div>
              <ol className="space-y-1.5">
                {open.steps.map((s, i) => <li key={i} className="flex gap-3"><span className="font-mono text-xs text-[#0A2F44] dark:text-[#66a4c2]">{i + 1}</span>{s}</li>)}
              </ol>
              <Notice tone="warn"><span className="inline-flex items-center gap-1"><FiInfo /> Not available yet:</span> this needs the SDH desktop agent.</Notice>
            </div>
            <div className="flex justify-end border-t border-[#e2e8f0] px-4 py-3 dark:border-[#334155]"><Btn onClick={() => setOpen(null)}>Close</Btn></div>
          </div>
        </div>
      )}
    </AccountLayout>
  )
}
