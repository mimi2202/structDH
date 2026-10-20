// src/utils/exportPdf.js
// Browser print-to-PDF. No dependencies (no html2canvas -> no Tailwind-v4 oklch crash).
//
// Why it CLONES instead of printing in place:
//   The detailed-report modal is `position: fixed`. Fixed-position elements are
//   repainted on EVERY printed page, which is what produced 4 identical pages.
//   So we clone the content into a plain <div> appended directly to <body>
//   (no fixed/absolute ancestors), print that, then remove it.
//
// PRINT-PAGINATION FIX (rows silently disappearing, e.g. the Deflection
// section): the previous rule tried to prevent breaking inside <section>,
// <table>, and <tr> -- none of which exist in DetailedReport.jsx (it's all
// <div>s), so that rule was a no-op. The REAL bug is that CSS Grid rows
// (display: grid) that straddle a print page boundary get silently dropped
// by Chrome/WebKit's print engine -- this is a documented browser
// limitation, not just a visual artifact. Longer sections (like Deflection,
// with the most rows) are the most likely to land across a page break, which
// is exactly the symptom reported. Flexbox and table layouts paginate
// correctly, so on print we force every `.dr-row` from grid to flex, and
// mark rows (not whole sections) as break-inside: avoid so a single row's
// three columns can't split apart while the section as a whole still flows
// across pages normally.

let styleInjected = false;

function injectPrintStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
@media print {
  /* nothing prints except the cloned sheet */
  body > *:not(#__print_sheet) { display: none !important; }

  html, body {
    height: auto !important; overflow: visible !important;
    margin: 0 !important; padding: 0 !important; background: #fff !important;
  }

  #__print_sheet {
    display: block !important;
    position: static !important;          /* never fixed/absolute -> no repeats */
    width: 100% !important; max-width: 100% !important;
    margin: 0 !important; padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
  }

  /* neutralise any fixed/absolute/scroll containers inside the clone.
     Not inside SVG diagrams: in Chrome, height is also a geometry property
     of <rect>, so "height: auto" collapsed every rectangle to nothing (beam
     outline, cross-section, slab plan, column section all vanished). Not
     on utilisation bars either: an empty div with height:auto is 0 tall. */
  #__print_sheet *:not(svg):not(svg *):not(.pdf-keep-color) {
    position: static !important;
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    box-shadow: none !important;
  }

  /* force a clean light sheet regardless of dark mode */
  #__print_sheet, #__print_sheet * {
    color: #0f172a !important;
    border-color: #cbd5e1 !important;
  }
  #__print_sheet, #__print_sheet *:not(.pdf-keep-color) { background-color: transparent !important; }
  #__print_sheet table { background: #fff !important; }

  /* utilisation bars keep their fill: print-color-adjust stops Chrome
     dropping backgrounds when "Background graphics" is off; the track is
     forced light so a dark-mode page still prints a pale track */
  #__print_sheet .pdf-keep-color {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #__print_sheet .pdf-bar-track { background-color: #e2e8f0 !important; }

  /* chrome that should never print */
  #__print_sheet .cb-no-print,
  #__print_sheet .pdf-hide,
  #__print_sheet button { display: none !important; }

  /* --- pagination fix ---
     CSS Grid rows that straddle a page break can be dropped entirely in
     print. Force each report row to flexbox (which paginates reliably) and
     recreate the same 3-column layout with fixed widths, matching the
     on-screen grid-cols-[170px_1fr_190px]. */
  #__print_sheet .dr-row {
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: flex-start !important;
    gap: 1rem !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  #__print_sheet .dr-row > div:nth-child(1) { flex: 0 0 170px !important; width: 170px !important; }
  #__print_sheet .dr-row > div:nth-child(2) { flex: 1 1 auto !important; min-width: 0 !important; }
  #__print_sheet .dr-row > div:nth-child(3) { flex: 0 0 190px !important; width: 190px !important; }

  /* let a whole section flow across pages -- only individual rows are
     protected from splitting, not the entire (possibly page-length) block */
  #__print_sheet .dr-section { break-inside: auto !important; page-break-inside: auto !important; }

  /* avoid starting a section title at the very bottom of a page, orphaned
     from its first row */
  #__print_sheet .dr-section > div:first-child {
    break-after: avoid !important; page-break-after: avoid !important;
  }

  /* cover page (utils/reportCover.js): one page, then the section */
  #__print_sheet .pdf-cover {
    display: block !important;
    min-height: 255mm !important;
    break-after: page !important; page-break-after: always !important;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;
  }
  #__print_sheet .pdf-cover .pc-top { font-size: 10pt !important; letter-spacing: .08em; text-transform: uppercase; color: #475569 !important; border-bottom: 2px solid #0A2F44 !important; padding-bottom: 6pt; }
  #__print_sheet .pdf-cover .pc-title { font-size: 24pt !important; font-weight: 800 !important; margin: 28pt 0 4pt !important; color: #0A2F44 !important; }
  #__print_sheet .pdf-cover .pc-sub { font-size: 12pt !important; color: #475569 !important; margin-bottom: 18pt; }
  #__print_sheet .pdf-cover .pc-block { margin-top: 16pt; break-inside: avoid !important; }
  #__print_sheet .pdf-cover .pc-h { font-size: 9pt !important; font-weight: 700 !important; letter-spacing: .08em; text-transform: uppercase; color: #0A2F44 !important; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 3pt; margin-bottom: 6pt; }
  #__print_sheet .pdf-cover p { font-size: 11pt !important; line-height: 1.45; margin: 4pt 0 !important; }
  #__print_sheet .pdf-cover .pc-t { width: 100%; border-collapse: collapse; font-size: 10.5pt !important; }
  #__print_sheet .pdf-cover .pc-t td { padding: 3pt 0 !important; border-bottom: 1px solid #e2e8f0 !important; vertical-align: top; }
  #__print_sheet .pdf-cover .pc-k { width: 38%; color: #475569 !important; }
  #__print_sheet .pdf-cover .pc-v { font-weight: 600 !important; }
  #__print_sheet .pdf-cover .pc-foot { margin-top: 28pt !important; font-size: 9pt !important; color: #64748b !important; }

  #__print_sheet img.pdf-chart { display: block !important; width: 100% !important; height: auto !important; break-inside: avoid !important; }

  @page { size: A4; margin: 12mm; }
}
/* the sheet only exists for printing; keep it off screen while charts are captured */
@media screen { #__print_sheet { display: none !important; } }`;
  const el = document.createElement("style");
  el.setAttribute("data-print-style", "true");
  el.textContent = css;
  document.head.appendChild(el);
}

// Charts drawn on a <canvas> do not survive the innerHTML copy (a copied
// canvas is empty, and a WebGL canvas such as the Plotly 3D soil-pressure
// surface cannot even be read back with toDataURL). So each chart is turned
// into a PNG from the live page and put in place of its copy. Plotly is only
// loaded when the page has a Plotly chart (same build react-plotly.js uses).
async function snapshotCharts(src, sheet) {
  const toImg = (url, maxW) => {
    const img = document.createElement("img");
    img.className = "pdf-chart";
    img.alt = "chart";
    img.src = url;
    if (maxW) img.style.maxWidth = `${maxW}px`;
    return img;
  };

  const plots = [...src.querySelectorAll(".js-plotly-plot")];
  if (plots.length) {
    const copies = [...sheet.querySelectorAll(".js-plotly-plot")];
    try {
      const Plotly = (await import("plotly.js/dist/plotly")).default;
      await Promise.all(plots.map(async (gd, i) => {
        if (!copies[i]) return;
        const w = gd.clientWidth || 600, h = gd.clientHeight || 300;
        const url = await Plotly.toImage(gd, { format: "png", width: w, height: h, scale: 2 });
        const img = toImg(url, w);
        await img.decode().catch(() => {});
        copies[i].replaceWith(img);
      }));
    } catch { /* leave the chart out rather than block the PDF */ }
  }

  // plain 2D canvases outside Plotly
  const canvases = [...src.querySelectorAll("canvas")].filter((c) => !c.closest(".js-plotly-plot"));
  const copies = [...sheet.querySelectorAll("canvas")].filter((c) => !c.closest(".js-plotly-plot"));
  canvases.forEach((c, i) => {
    try { if (copies[i]) copies[i].replaceWith(toImg(c.toDataURL("image/png"), c.clientWidth)); } catch { /* tainted */ }
  });
}

// cover: optional HTML for a first page (utils/reportCover.js buildCoverHtml)
export async function exportElementToPdf(element, filename = "report", cover = "") {
  if (!element) return;
  injectPrintStyle();

  // remove any stale sheet
  const stale = document.getElementById("__print_sheet");
  if (stale) stale.remove();

  // clone the content into a plain container on <body>
  const sheet = document.createElement("div");
  sheet.id = "__print_sheet";
  sheet.innerHTML = cover + element.innerHTML;
  document.body.appendChild(sheet);
  await snapshotCharts(element, sheet);

  const prevTitle = document.title;
  document.title = filename;          // becomes the default PDF filename

  const cleanup = () => {
    const s = document.getElementById("__print_sheet");
    if (s) s.remove();
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);        // fallback for browsers that skip afterprint
  }, 60);
}