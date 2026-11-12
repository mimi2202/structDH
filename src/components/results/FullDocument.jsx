// src/components/results/FullDocument.jsx
// The Overview tab of every results page is the whole design document: the
// summary, then each in-depth tab in full, then the complete calculation
// report, as numbered parts (1., 2., ... and n.1, n.2, ... inside the report).
// "Download" on the Overview therefore prints everything; the other tabs still
// print just themselves.
//
// Inside the document each tab's own "calculation trace" box is hidden
// (ReportSections reads InFullDocument), because the full report at the end
// already holds those sections: nothing is printed twice.
import React from "react";
import ReportSections from "../ReportSections";

import { InFullDocument } from "./fullDocumentContext";

const HEAD = "text-[15px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";

// parts: [{ title, node }] in order; report: the engine's report sections
export default function FullDocument({ parts, report }) {
  const all = [...parts.filter((p) => p && p.node)];
  if (report && report.length) all.push({ title: "Calculation Report", report: true });
  return (
    <InFullDocument.Provider value={true}>
      {/* sub-headings numbered n.1, n.2, ... inside each part; the cards' own fixed
          numbers (span.doc-n) are dropped here. Inline so it survives the PDF clone. */}
      <style>{`
        .pdf-doc { counter-reset: docpart; }
        .pdf-doc .pdf-part { counter-increment: docpart; counter-reset: docsub; }
        .pdf-doc .pdf-part .doc-h::before { counter-increment: docsub; content: counter(docpart) "." counter(docsub) "\\00a0\\00a0"; }
        .pdf-doc .doc-n { display: none !important; }
      `}</style>
      <div className="pdf-doc space-y-8">
        <nav className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-4 shadow-sm dark:border-[#334155] dark:bg-[#1f2937]">
          <div className={`${HEAD} mb-2 text-[12px]`}>Contents</div>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] text-[#0F172A] sm:grid-cols-2 dark:text-white">
            {all.map((p, i) => <li key={p.title}><span className="mr-2 font-semibold">{i + 1}.</span>{p.title}</li>)}
          </ol>
        </nav>
        {all.map((p, i) => (
          <section key={p.title} className="pdf-part space-y-5">
            <h2 className={`${HEAD} border-b-2 border-[#0A2F44] pb-1.5 dark:border-[#66a4c2]`}>{i + 1}. {p.title}</h2>
            {p.report
              ? <ReportSections report={report} match={/./} heading="Full calculation report (EN 1990 / EN 1991 / EN 1992)" numberPrefix={i + 1} force />
              : p.node}
          </section>
        ))}
      </div>
    </InFullDocument.Provider>
  );
}
