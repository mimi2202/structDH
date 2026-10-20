// src/components/ReportSections.jsx
// The engine's own calculation trace, filtered to the sections a results
// tab is about (e.g. a "Shear" tab shows the report's shear sections). Rows
// come in two shapes -- {reference, calculation, output} (slabs, beams,
// columns) and {ref, calc, out} (foundations) -- and are read either way.
// Uses the dr-section / dr-row classes so exportPdf.js paginates it the same
// way as the Detailed Report.
import React from "react";

const sectionTitle = (s) => s.title ?? s.section ?? "";

export default function ReportSections({ report, match, heading = "Calculation trace" }) {
  const sections = (report || []).filter((s) => match.test(sectionTitle(s)));
  if (!sections.length) return null;
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm dark:border-[#334155] dark:bg-[#1f2937]">
      <div className="border-b border-[#e2e8f0] px-5 py-3 dark:border-[#334155]">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">{heading}</h3>
      </div>
      <div className="space-y-5 p-5">
        {sections.map((s, i) => (
          <div key={i} className="dr-section">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">{sectionTitle(s)}</div>
            {(s.rows || []).map((r, j) => (
              <div key={j} className="dr-row grid grid-cols-1 gap-1 border-b border-[#f1f5f9] py-1.5 text-[12px] last:border-0 sm:grid-cols-[170px_1fr_190px] sm:gap-4 dark:border-[#263244]">
                <div className="font-mono text-[11px] text-[#64748b] dark:text-[#94a3b8]">{r.reference ?? r.ref}</div>
                <div className="whitespace-pre-line font-mono text-[#0F172A] dark:text-white">{r.calculation ?? r.calc}</div>
                <div className="whitespace-pre-line font-mono font-semibold text-[#0A2F44] sm:text-right dark:text-[#66a4c2]">{r.output ?? r.out}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
