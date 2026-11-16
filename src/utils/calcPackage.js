// Helpers for calculation packages (pages/reports/CalcPackage.jsx): ordering,
// the report of a saved design, and the package cover page HTML.
import { ELEMENTS } from './savedDesigns'
import { PRODUCT } from './reportCover'
import { getStatus } from './reportStatus'
import { getSettings } from './appSettings'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const reportOf = (d) => d.state?.designResult?.report || []

const ORDER = Object.keys(ELEMENTS)
export const packageOrder = (designs) => [...designs].sort((a, b) =>
  ORDER.indexOf(a.element) - ORDER.indexOf(b.element) || String(a.saved_at).localeCompare(String(b.saved_at)))

const statusLine = (designs) => {
  const s = designs.map((d) => getStatus(d).status)
  if (s.every((x) => x === 'issued')) return 'Issued: every calculation is checked and issued'
  if (s.every((x) => x !== 'draft')) return 'Checked: every calculation has been checked'
  return `Preliminary: ${s.filter((x) => x === 'draft').length} of ${s.length} calculation(s) not yet checked`
}

// The first page (HTML, same classes as the element covers).
export function packageCoverHtml({ title, project, designs }) {
  const company = getSettings().company.trim()
  const settings = getSettings()
  const pass = designs.filter((d) => d.status === 'PASS').length
  const row = (k, v) => (v ? `<tr><td class="pc-k">${esc(k)}</td><td class="pc-v">${esc(v)}</td></tr>` : '')
  return `
<div class="pdf-cover">
  <div class="pc-top">${company ? `${esc(company)} &middot; ` : ''}${esc(PRODUCT)} &middot; Calculation Package</div>
  <h1 class="pc-title">${esc(title)}</h1>
  <div class="pc-sub">${esc([project?.organisation_name || (project ? 'Personal project' : ''), project?.location].filter(Boolean).join(' · '))}</div>
  <div class="pc-block">
    <div class="pc-h">This document</div>
    <p>Structural calculations for ${designs.length} element${designs.length === 1 ? '' : 's'}, each with the engine's full calculation trace.</p>
    <p><b>${esc(statusLine(designs))}</b></p>
  </div>
  <div class="pc-block">
    <div class="pc-h">Summary</div>
    <table class="pc-t">
      ${row('Calculations', String(designs.length))}
      ${row('Passing all checks', `${pass} of ${designs.length}`)}
      ${row('Design standard', 'BS EN 1992-1-1 (Eurocode 2) with UK National Annex')}
    </table>
  </div>
  <div class="pc-block">
    <div class="pc-h">Prepared by</div>
    <table class="pc-t">
      ${row('Designer', settings.designerName ? `${settings.designerName}${settings.designerQualifications ? `, ${settings.designerQualifications}` : ''}` : 'See each calculation')}
      ${row('Checker', settings.checkedBy ? `${settings.checkedBy}${settings.checkerQualifications ? `, ${settings.checkerQualifications}` : ''}` : 'See each calculation')}
      ${row('Generated', new Date().toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}
    </table>
  </div>
  <p class="pc-foot">Produced with ${esc(PRODUCT)}. The results are the software's own checks; the engineers named in each
  calculation are responsible for verifying them and for the design.</p>
</div>`
}

