// src/utils/reportCover.js
// Cover page for the "Download" PDF of a results page. Says what the document
// is (element, member, which section of the results it holds, the key facts)
// and who is behind it (designer, checker, stability, independent check).
//
// The "who" is read from the engine's own report rows, which every element
// labels the same way ("Designer", "Checked by", ...), but whose row shape
// differs between engines ({reference, calculation, output} for slabs, beams
// and columns; {ref, calc, out} for foundations) -- so rows are normalised
// first. Nothing is invented: a blank field prints "Not entered".

const PRODUCT = "SDH (Structural Design Hub)";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function reportRows(report) {
  return (report || []).flatMap((s) => (s.rows || []).map((r) => ({
    ref: String(r.reference ?? r.ref ?? r.label ?? "").trim(),
    calc: String(r.calculation ?? r.calc ?? r.value ?? "").trim(),
    out: String(r.output ?? r.out ?? r.result ?? "").trim(),
  })));
}

function field(rows, ref) {
  const r = rows.find((x) => x.ref.toLowerCase() === ref.toLowerCase());
  return r ? r.calc : "";
}

// "Name: not entered" / "Organisation or individual: not entered" -> "Not entered"
const person = (v) => (!v || /not entered/i.test(v) ? "Not entered" : v);

function independentCheck(v) {
  if (!v) return "Not stated";
  if (/\[X\]\s*Required/i.test(v)) return "Required";
  if (/\[X\]\s*Completed/i.test(v)) return "Completed";
  return "Not stated";
}

/**
 * opts:
 *   element      "Simply Supported Beam"            what was designed
 *   member       "B1"                                member / reference (optional)
 *   section      "Shear Design"                      the tab being downloaded
 *   sectionNote  one sentence on what that section holds
 *   description  one or two sentences on the element and the design
 *   facts        [[label, value], ...]               key inputs / results
 *   status       "PASS" | "FAIL" | other             overall result
 *   project, location                                optional
 *   report       the engine's report array (for the people and the run ID)
 */
export function buildCoverHtml(opts) {
  const rows = reportRows(opts.report);
  const calcId = field(rows, "Calculation ID");
  const generated = field(rows, "Generated")
    || new Date().toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const status = String(opts.status || "").toUpperCase();
  const statusText = status === "PASS" || status === "SAFE" ? "All checks satisfied"
    : status ? "One or more checks not satisfied -- see the results" : "";

  const kv = (pairs) => pairs.filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<tr><td class="pc-k">${esc(k)}</td><td class="pc-v">${esc(v)}</td></tr>`).join("");

  const people = [
    ["Designed by", person(field(rows, "Designer"))],
    ["Checked by", person(field(rows, "Checked by"))],
    ["Responsible for stability", person(field(rows, "Responsible for stability"))],
    ["Independent check", independentCheck(field(rows, "Independent check"))],
  ];

  return `
<div class="pdf-cover">
  <div class="pc-top">${esc(PRODUCT)} &middot; Structural Engineering Calculation</div>
  <h1 class="pc-title">${esc(opts.element)} Design</h1>
  <div class="pc-sub">${esc([opts.member, opts.project, opts.location].filter(Boolean).join(" · "))}</div>

  <div class="pc-block">
    <div class="pc-h">This document</div>
    <p><b>${esc(opts.section)}</b>${opts.sectionNote ? ` &mdash; ${esc(opts.sectionNote)}` : ""}</p>
    ${opts.description ? `<p>${esc(opts.description)}</p>` : ""}
  </div>

  ${opts.facts && opts.facts.length ? `
  <div class="pc-block">
    <div class="pc-h">Design summary</div>
    <table class="pc-t">${kv(opts.facts)}${status ? kv([["Result", `${status}${statusText ? ` (${statusText})` : ""}`]]) : ""}</table>
  </div>` : ""}

  <div class="pc-block">
    <div class="pc-h">Prepared by</div>
    <table class="pc-t">${kv(people)}</table>
  </div>

  <div class="pc-block">
    <div class="pc-h">Record</div>
    <table class="pc-t">${kv([
      ["Design standard", "BS EN 1992-1-1 (Eurocode 2)" + (opts.extraStandard ? `, ${opts.extraStandard}` : "")],
      ["Calculation ID", calcId],
      ["Generated", generated],
    ])}</table>
  </div>

  <p class="pc-foot">Produced with ${esc(PRODUCT)}. The results are the software's own checks; the designer named
  above is responsible for verifying them and for the design. The full calculation trace is in the Detailed Report.</p>
</div>`;
}
