// A calculation package: one document for a set of saved designs (usually a
// whole project) -- cover sheet, contents, design basis, summary table, then
// each design's full calculation report from the engine, numbered 1, 2, ...
// Rendered on screen as the preview and handed to utils/exportPdf.js for the
// PDF (.pdf-part starts a new page there; the cover HTML is the first page).
import React, { forwardRef } from 'react'
import ReportSections from '../../components/ReportSections'
import { ELEMENTS } from '../../utils/savedDesigns'
import { reportPeople, PRODUCT } from '../../utils/reportCover'
import { getStatus, STATUS } from '../../utils/reportStatus'
import { reportOf } from '../../utils/calcPackage'

const H2 = ({ n, children }) => (
  <h2 className="mb-3 border-b-2 border-[#0A2F44] pb-1 text-lg font-bold text-[#0A2F44] dark:border-[#66a4c2] dark:text-[#66a4c2]">
    {n && <span className="mr-2 font-mono">{n}</span>}{children}
  </h2>
)
const Cell = ({ children, className = '' }) => <td className={`border border-[#cbd5e1] dark:border-[#475569] px-2 py-1 align-top ${className}`}>{children}</td>
const HCell = ({ children }) => <th className="border border-[#cbd5e1] dark:border-[#475569] bg-[#f1f5f9] dark:bg-[#172030] px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide">{children}</th>

const CalcPackage = forwardRef(function CalcPackage({ project, designs }, ref) {
  const hasFoundation = designs.some((d) => d.element === 'foundation')
  return (
    <div ref={ref} className="space-y-10 text-[13px] text-[#0F172A] dark:text-white" data-calc-package>
      <section className="pdf-part">
        <H2>Contents</H2>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr><HCell>No.</HCell><HCell>Calculation</HCell><HCell>Element</HCell><HCell>Calc ID</HCell><HCell>Result</HCell><HCell>Status</HCell></tr></thead>
          <tbody>
            <tr><Cell className="font-mono">A</Cell><Cell>Design basis</Cell><Cell>-</Cell><Cell>-</Cell><Cell>-</Cell><Cell>-</Cell></tr>
            <tr><Cell className="font-mono">B</Cell><Cell>Summary of results</Cell><Cell>-</Cell><Cell>-</Cell><Cell>-</Cell><Cell>-</Cell></tr>
            {designs.map((d, i) => {
              const st = getStatus(d)
              return (
                <tr key={`${d.element}-${d.id}`}>
                  <Cell className="font-mono">{i + 1}</Cell>
                  <Cell>{d.name}</Cell>
                  <Cell>{ELEMENTS[d.element]?.label}</Cell>
                  <Cell className="font-mono">{reportPeople(reportOf(d)).calcId || '-'}</Cell>
                  <Cell className="font-mono">{d.status || '-'}</Cell>
                  <Cell>{STATUS[st.status].label}{st.revision ? ` (Rev ${st.revision})` : ''}</Cell>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="pdf-part">
        <H2 n="A">Design basis</H2>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {[
              ['Project', project?.name || 'Quick designs (no project)'],
              ['Organisation', project ? (project.organisation_name || 'Personal project') : '-'],
              ['Location', project?.location || '-'],
              ['Building type', project?.project_type || '-'],
              ['Basis of design', 'BS EN 1990 (with UK NA): ULS Eq. 6.10, SLS characteristic / quasi-permanent combinations'],
              ['Actions', 'BS EN 1991-1-1 (imposed loads and densities as entered in each calculation)'],
              ['Concrete design', 'BS EN 1992-1-1 (Eurocode 2) with UK National Annex'],
              ...(hasFoundation ? [['Geotechnical', 'BS EN 1997-1: bearing checked on SLS loads against the allowable pressure entered']] : []),
              ['Software', `${PRODUCT}; each calculation states its own inputs, assumptions and simplifications`],
            ].map(([k, v]) => (
              <tr key={k}><Cell className="w-48 font-semibold">{k}</Cell><Cell>{v}</Cell></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pdf-part">
        <H2 n="B">Summary of results</H2>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr><HCell>No.</HCell><HCell>Calculation</HCell><HCell>Element</HCell><HCell>Description</HCell><HCell>Designed by</HCell><HCell>Checked by</HCell><HCell>Result</HCell></tr></thead>
          <tbody>
            {designs.map((d, i) => {
              const people = reportPeople(reportOf(d))
              const st = getStatus(d)
              return (
                <tr key={`${d.element}-${d.id}`}>
                  <Cell className="font-mono">{i + 1}</Cell>
                  <Cell>{d.name}</Cell>
                  <Cell>{ELEMENTS[d.element]?.label}</Cell>
                  <Cell>{d.subtitle || '-'}</Cell>
                  <Cell>{people.designer}</Cell>
                  <Cell>{st.checked_by || people.checker}</Cell>
                  <Cell className={`font-mono font-semibold ${d.status === 'PASS' ? 'text-emerald-700 dark:text-emerald-400' : d.status === 'FAIL' ? 'text-red-700 dark:text-red-400' : ''}`}>{d.status || '-'}</Cell>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {designs.map((d, i) => {
        const report = reportOf(d)
        const people = reportPeople(report)
        const st = getStatus(d)
        return (
          <section key={`${d.element}-${d.id}`} className="pdf-part" data-package-part={d.name}>
            <H2 n={i + 1}>{d.name} &mdash; {ELEMENTS[d.element]?.label}</H2>
            <table className="mb-4 w-full border-collapse text-[12px]">
              <tbody>
                <tr><Cell className="w-40 font-semibold">Description</Cell><Cell>{d.subtitle || '-'}</Cell><Cell className="w-40 font-semibold">Result</Cell><Cell className="font-mono font-semibold">{d.status || '-'}</Cell></tr>
                <tr><Cell className="font-semibold">Designed by</Cell><Cell>{people.designer}</Cell><Cell className="font-semibold">Checked by</Cell><Cell>{st.checked_by || people.checker}</Cell></tr>
                <tr><Cell className="font-semibold">Calculation ID</Cell><Cell className="font-mono">{people.calcId || '-'}</Cell><Cell className="font-semibold">Status</Cell><Cell>{STATUS[st.status].label}{st.revision ? ` (Rev ${st.revision})` : ''}</Cell></tr>
              </tbody>
            </table>
            {report.length
              ? <ReportSections report={report} match={/./} heading={`Calculation ${i + 1}: full trace`} numberPrefix={String(i + 1)} force />
              : <p className="text-[#64748b]">This design was saved without a calculation report.</p>}
          </section>
        )
      })}
    </div>
  )
})

export default CalcPackage
