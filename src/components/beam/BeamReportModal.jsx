// src/components/beam/BeamReportModal.jsx
//
// PRINT/PDF FIX: this used to be a separate ~90-line implementation with its
// own print CSS -- a `visibility: hidden/visible` + `position: absolute`
// hack applied to a modal whose ancestor is `fixed inset-0`. That's the
// exact bug already diagnosed and fixed for the slab report (see the header
// comment in DetailedReport.jsx / exportPdf.js): a fixed-position ancestor
// gets repainted identically on every printed page, so whatever happened to
// be scrolled into view at print time (here: sections 7-9) repeated on every
// page while everything scrolled out of view (sections 1-6, most of 10)
// never printed at all.
//
// Rather than re-patch a second, parallel implementation that will just
// drift out of sync again the next time the shared report component
// changes, this is now a thin wrapper around DetailedReport -- the same
// component already fixed for slabs (clone-to-static-div export via
// exportElementToPdf, dr-row/dr-section grid-to-flex pagination fix). Any
// future fix to DetailedReport now applies to beams automatically.
import React from "react";
import DetailedReport from "../DetailedReport";

export default function BeamReportModal({ report, summary, onClose }) {
  const subtitle = summary
    ? [summary.beam_id, summary.design_code].filter(Boolean).join(" \u00b7 ")
    : "";

  return (
    <DetailedReport
      report={report}
      heading="Detailed Calculation Report"
      subtitle={subtitle}
      onClose={onClose}
    />
  );
}