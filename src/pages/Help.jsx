// src/pages/Help.jsx — what each element checks, how the inputs work, and
// what the software does NOT check (renders inside MainLayout).
// Keep this in step with the engines: every statement here describes what
// the backend actually does, including its limits.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown, FiSearch, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const LINK = "font-medium text-[#0A2F44] hover:underline dark:text-[#66a4c2]";

const VERSION = "1.0.0";

/* ---- what each element does: checks made, and what is left to the engineer ---- */
const ELEMENTS = [
  {
    name: "Slab: one-way and two-way", to: "/structural-input",
    checks: [
      "Design load from EN 1990 Eq. 6.10 with imposed load and downward wind; the leading action can be chosen or left on Auto (the larger case is used).",
      "Bending: required steel, minimum steel and the bars provided (EC2 6.1, 9.2.1.1). Two-way slabs use moment coefficients and design four locations: short and long span, midspan and continuous edges.",
      "Shear without shear reinforcement (EC2 6.2.2).",
      "Deflection by span / effective depth (EC2 7.4.2, Eq. 7.16).",
    ],
    limits: [
      "Wind uplift (suction) is not checked: wind is a downward pressure only.",
      "Cover is not checked against the exposure class on the one-way slab (the two-way slab checks it only when no cover is entered).",
      "No fire or crack-width check on these two; the continuous slab has both.",
    ],
  },
  {
    name: "Continuous one-way slab", to: "/continuous-slab",
    checks: [
      "Pattern loading: loaded spans carry the full design load, unloaded spans 1.35 Gk (EC2 5.1.3). Moments and shears are enveloped separately.",
      "Bending at every span and support, shear at each support (EC2 6.1, 6.2.2).",
      "Deflection by span / effective depth (EC2 7.4.2).",
      "Cover for the exposure class (EC2 4.4.1), fire resistance (EN 1992-1-2 Table 5.8) and crack control by bar spacing (EC2 7.3.3).",
    ],
    limits: [
      "Spans over 4.5 m are designed, with a note in the report.",
      "Crack control uses the ULS lever arm, which gives a steel stress about 3% lower than a cracked elastic section.",
    ],
  },
  {
    name: "Beam: simply supported", to: "/beam",
    checks: [
      "Bending: required and minimum steel and the bars provided (EC2 6.1). When the engine chooses the bar size it also checks the clear spacing between bars (EC2 8.2).",
      "Shear resistance and links (EC2 6.2).",
      "Deflection by span / effective depth (EC2 7.4.2).",
    ],
    limits: [
      "The crushing limit of the concrete struts (V_Rd,max) and the minimum link ratio are not checked. Check both by hand for heavily loaded or short beams.",
    ],
  },
  {
    name: "Beam: continuous", to: "/continuous-beam",
    checks: [
      "Analysis of the spans with the end supports taken both pinned and fixed; the worse of the two governs each section.",
      "Bending at spans and supports, shear and links.",
      "Deflection of every span with its own factor (single, end or interior span).",
      "Crack control by bar size or spacing (EC2 7.3.3) and cover for the exposure class and working life (EC2 4.4.1).",
    ],
    limits: [
      "No pattern loading: every span carries the full design load at once. Check alternate-span loading by hand where live load is large compared with dead load.",
      "The quasi-permanent factor for cracking is taken as 0.6.",
    ],
  },
  {
    name: "Column", to: "/column-input",
    checks: [
      "Axial, uniaxial or biaxial bending, with the load entered directly or taken down from the floors.",
      "Slenderness limit and second-order moments by nominal curvature (EC2 5.8.3.1, 5.8.8).",
      "N-M interaction for the section; biaxial interaction (EC2 5.8.9).",
      "Bar and link detailing limits (EC2 9.5). Section and bars can differ by storey.",
    ],
    limits: [
      "Fire resistance is not checked.",
    ],
  },
  {
    name: "Foundation: pad footing", to: "/foundation-input",
    checks: [
      "Bearing pressure on service loads plus the weight of the footing and the soil on it, with eccentricity and uplift.",
      "Bending at the column (or pedestal) face from the trapezoidal pressure; minimum and maximum steel.",
      "One-way shear at d from the face and punching shear around the column (EC2 6.2, 6.4.4).",
      "Anchorage of the bottom bars at the footing edge (EC2 9.8.2.2), a reinforcement drawing and a bar schedule with starter bars and links.",
      "Optional: size the footing from the allowable bearing pressure, deepening it until the checks pass.",
    ],
    limits: [
      "Bearing is a warning only: a footing that exceeds the allowable pressure still shows PASS overall. Read the Bearing tab.",
      "Edge and corner columns: the reduced punching perimeters are not modelled, so punching is reported as not applicable there. Check it by hand.",
      "The design approach (EN 1997-1) is not applied; bearing uses the allowable pressure you enter.",
      "Links are not scheduled for circular columns.",
    ],
  },
  {
    name: "Foundation: combined footing", to: "/foundation-input?type=combined",
    checks: [
      "Bearing on service loads; shear force and bending moment along the footing.",
      "Separate bottom (sagging) and top (hogging) longitudinal steel, and transverse steel.",
      "Shear at d from each face of each column; punching at each column (EC2 6.4.4).",
      "Optional sizing so the footing centre sits under the resultant of the two column loads.",
    ],
    limits: [
      "Two rectangular columns only.",
      "The engine does not add steel to pass shear; a shear failure needs a deeper footing.",
      "Bearing is a warning only, as for the pad footing.",
    ],
  },
  {
    name: "Staircase", to: "/staircase-design",
    checks: [
      "Flight and landing analysed as a frame pinned at both ends, per metre width.",
      "Bottom steel for the span, top steel where the flight meets the landing, distribution steel.",
      "Deflection (EC2 7.4.2) and shear including the axial force in the frame (EC2 6.2.2).",
      "Anchorage at the landing support, a to-scale section and a bar schedule.",
    ],
    limits: [
      "The pinned frame usually shows a small uplift at the landing support. It is reported as a warning, not a failure.",
      "The self-weight of the waist is taken on its thickness, without a slope factor.",
    ],
  },
];

/* ---- how to use the inputs that most often raise questions ---- */
const GUIDES = [
  {
    q: "Live load, imposed load and wind: which load is the slab designed for?",
    a: [
      "Imposed load is the Eurocode name for live load, so Q in the formulas is the Live Load you entered. Wind (W) is a downward pressure, for a roof slab; leave it at 0 for an internal floor.",
      "Two totals are worked out. Imposed leading: 1.35 G + 1.5 Q + 1.5 × 0.6 × W. Wind leading: 1.35 G + 1.5 W + 1.5 × 0.7 × Q. The leading load is taken in full and the other is reduced, because both are unlikely to peak together.",
      "Auto uses the larger total. Wind leads when W is more than 0.75 × Q; below that, imposed leads. With W = 0 the dropdown has no effect.",
    ],
  },
  {
    q: "\"Let the engine choose the bar size\"",
    a: [
      "Ticked: each standard bar size is designed in turn and the passing one that needs the least steel is used. Every option is listed in the report under Bar Size Selection.",
      "Not ticked: only the bar you chose is used. If it cannot carry the load the design fails and says so; no other bar is substituted.",
    ],
  },
  {
    q: "\"Size the footing for me\" (foundations)",
    a: [
      "The plan area is taken from the service load and the allowable bearing pressure, less the weight of the footing and the soil on it, rounded up to 100 mm. The depth you enter is a starting depth; it is increased by 50 mm at a time until every check passes.",
      "For a combined footing the centre is placed under the resultant of the two column loads, so the pressure is uniform.",
      "Not available when the column is offset from the footing centre.",
    ],
  },
  {
    q: "Service load and the ULS / SLS factor (foundations)",
    a: [
      "Bearing is checked on service loads; bending, shear and punching on ultimate loads. If you leave the service load blank, it is taken as the ultimate load divided by the factor (default 1.36).",
    ],
  },
  {
    q: "Saving and reopening a design",
    a: [
      "On any results page press Save and give the design a project name and a design name. It is kept in this browser only, up to 20 per element.",
      "Reopen it from Open on a results page or from Saved Designs in the sidebar. To keep designs safe or move them to another computer, use Export backup on the Settings page.",
    ],
  },
  {
    q: "PDF reports",
    a: [
      "Download prints the tab you are on, behind a cover page. The Overview tab is the complete numbered document: summary, every check in full and the calculation report.",
      "The cover shows the designer and checker entered on the input page, and the company name from Settings. A blank field prints \"Not entered\".",
    ],
  },
  {
    q: "Reset",
    a: [
      "Reset (top right of every input page) returns every field to its default after you confirm. The designer, checker and default grades from Settings are filled in again.",
    ],
  },
];

const GLOSSARY = [
  ["G_k, Q_k, W_k", "Characteristic (unfactored) dead, imposed and wind load."],
  ["ULS / SLS", "Ultimate limit state (strength, factored loads) / serviceability limit state (deflection, cracking, bearing; unfactored loads)."],
  ["M_Ed, V_Ed, N_Ed", "Design bending moment, shear force and axial force."],
  ["M_Rd, V_Rd,c", "Bending resistance; shear resistance without shear reinforcement."],
  ["d", "Effective depth: from the compression face to the centre of the tension steel."],
  ["K", "M / (b d² f_ck), the measure of how hard the section works in bending."],
  ["A_s,req / A_s,prov", "Steel area required by the design / provided by the bars chosen."],
  ["Utilisation", "Demand divided by capacity. Above 1.00 the check fails."],
  ["Callout 10-Y16-01-200", "10 bars, 16 mm high-yield, bar mark 01, at 200 mm spacing."],
];

function Row({ title, sub, children, open, onToggle }) {
  return (
    <div className="border-b border-[#e2e8f0] last:border-b-0 dark:border-[#334155]">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-[#f8fafc] dark:hover:bg-[#263244]">
        <span>
          <span className={`block text-sm font-semibold ${MAIN}`}>{title}</span>
          {sub && <span className={`block text-xs ${SUB}`}>{sub}</span>}
        </span>
        <FiChevronDown className={`flex-shrink-0 transition-transform ${SUB} ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

export default function Help() {
  const [open, setOpen] = useState({});
  const [query, setQuery] = useState("");
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const q = query.trim().toLowerCase();
  const hit = (...parts) => !q || parts.flat().join(" ").toLowerCase().includes(q);

  const elements = ELEMENTS.filter((e) => hit(e.name, e.checks, e.limits));
  const guides = GUIDES.filter((g) => hit(g.q, g.a));
  const glossary = GLOSSARY.filter((g) => hit(g));
  const isOpen = (k) => (q ? true : !!open[k]);      // a search opens every match

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Help</h1>
        <p className={`text-sm ${SUB}`}>What each element checks, how the inputs work, and what is left for you to check.</p>
      </div>

      <div className="relative">
        <FiSearch className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${SUB}`} size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help (e.g. punching, wind, save)"
          aria-label="Search help"
          className="w-full rounded-lg border border-[#e2e8f0] bg-white py-2.5 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#0A2F44] focus:outline-none dark:border-[#334155] dark:bg-[#1f2937] dark:text-white dark:focus:border-[#66a4c2]" />
      </div>

      {!q && (
        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Getting started</h2>
          <ol className={`mt-3 list-decimal space-y-1.5 pl-5 text-sm ${MAIN}`}>
            <li>Pick an element in the sidebar and fill in the input page. Fields start from sensible defaults.</li>
            <li>Press the proceed button at the bottom. The design runs and opens the results page.</li>
            <li>Read the Overview, then the tab for each check. A failed check is named, with the numbers behind it.</li>
            <li>Press Save to keep the design, or Download for a PDF with a cover page.</li>
          </ol>
          <p className={`mt-3 text-xs ${SUB}`}>
            Set your company, designer and checker once in <Link to="/settings" className={LINK}>Settings</Link>; they then appear on every report.
            All designs are to Eurocode 2 (BS EN 1992-1-1); units are kN, m and mm.
          </p>
        </section>
      )}

      {elements.length > 0 && (
        <section className={CARD}>
          <h2 className={`${TITLE} px-5 pt-5 pb-2`}>What each element checks</h2>
          {elements.map((e) => (
            <Row key={e.name} title={e.name} sub={`${e.checks.length} checks · ${e.limits.length} thing${e.limits.length === 1 ? "" : "s"} to check yourself`}
              open={isOpen(e.name)} onToggle={() => toggle(e.name)}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400"><FiCheckCircle size={13} /> Checked by the software</div>
                  <ul className={`list-disc space-y-1.5 pl-4 text-[13px] leading-snug ${MAIN}`}>{e.checks.map((c) => <li key={c}>{c}</li>)}</ul>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"><FiAlertTriangle size={13} /> Not checked, or simplified</div>
                  <ul className={`list-disc space-y-1.5 pl-4 text-[13px] leading-snug ${MAIN}`}>{e.limits.map((c) => <li key={c}>{c}</li>)}</ul>
                </div>
              </div>
              <Link to={e.to} className={`mt-3 inline-block text-xs ${LINK}`}>Open the input page</Link>
            </Row>
          ))}
        </section>
      )}

      {guides.length > 0 && (
        <section className={CARD}>
          <h2 className={`${TITLE} px-5 pt-5 pb-2`}>Using the inputs</h2>
          {guides.map((g) => (
            <Row key={g.q} title={g.q} open={isOpen(g.q)} onToggle={() => toggle(g.q)}>
              <div className={`space-y-2 text-[13px] leading-snug ${MAIN}`}>{g.a.map((p) => <p key={p}>{p}</p>)}</div>
            </Row>
          ))}
        </section>
      )}

      {glossary.length > 0 && (
        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Symbols and terms</h2>
          <dl className="mt-3 divide-y divide-[#f1f5f9] dark:divide-[#334155]">
            {glossary.map(([term, def]) => (
              <div key={term} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[190px_1fr] sm:gap-4">
                <dt className={`font-mono text-[13px] font-semibold ${MAIN}`}>{term}</dt>
                <dd className={`text-[13px] ${SUB}`}>{def}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {q && !elements.length && !guides.length && !glossary.length && (
        <p className={`${CARD} p-6 text-center text-sm ${SUB}`}>Nothing in Help matches "{query}".</p>
      )}

      <p className={`text-xs ${SUB}`}>
        SDH (Structural Design Hub) version {VERSION}. The results are the software's own checks; the engineer named on the
        report is responsible for verifying them and for the design.
      </p>
    </div>
  );
}
