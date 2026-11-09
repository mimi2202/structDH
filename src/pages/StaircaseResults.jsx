// src/pages/StaircaseResults.jsx
import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiFileText, FiX, FiAlertTriangle, FiDownload } from "react-icons/fi";
import { exportElementToPdf } from "../utils/exportPdf";
import { buildCoverHtml } from "../utils/reportCover";
import ReportSections from "../components/ReportSections";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";

const TABS = ["Overview", "Loading & Analysis", "Flexural Design", "Deflection & Shear", "Detailing & Schedule"];
const TAB_NOTES = {
  "Overview": "geometry, reactions, the reinforcement adopted and the status of every check.",
  "Loading & Analysis": "loads on the flight and landing (EN 1991-1-1, EN 1990 Eq. 6.10) and the force-method analysis of the pinned frame: bending moment, shear and axial force.",
  "Flexural Design": "bottom steel for the span moment, top steel for the hogging moment at the landing junction, and distribution steel.",
  "Deflection & Shear": "span/effective depth check (EC2 7.4.2) and shear without shear reinforcement with the frame's axial force (EC2 6.2.2).",
  "Detailing & Schedule": "bar arrangement (EC2 9.3), anchorage at the landing support (EC2 9.2.1.4) and the reinforcement bending/quantity schedule.",
};
const f2 = (v, n = 2) => (v == null ? "-" : Number(v).toFixed(n));

export default function StaircaseResults() {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const { state } = useLocation();
  const r = state?.designResult;
  const meta = state?.meta || {};
  const [tab, setTab] = useState("Overview");
  const [showReport, setShowReport] = useState(false);

  if (!r) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#111827] px-6">
        <div className={`${CARD} p-8 text-center max-w-md`}>
          <FiAlertTriangle className="mx-auto mb-3 text-amber-500" size={28} />
          <p className={`mb-4 ${MAIN}`}>No design results. Run a staircase design first.</p>
          <button onClick={() => navigate("/staircase-design")} className="rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
            Go to Staircase Input
          </button>
        </div>
      </div>
    );
  }

  const pass = r.status === "PASS";
  const g = r.geometry, ld = r.loads, an = r.analysis, b = r.bottom, t = r.top, ds = r.distribution;
  const df = r.deflection, sh = r.shear;
  const bars = (x) => (x ? `Y${x.bar} @ ${x.spacing}` : "none");

  const download = () => exportElementToPdf(sheetRef.current, `Staircase-${r.member_id}-${tab}`, buildCoverHtml({
    element: "Staircase", member: r.member_id, section: tab, sectionNote: TAB_NOTES[tab],
    description: "Flight and landing designed per metre width to BS EN 1992-1-1: "
      + "the flight and landing analysed as one frame pinned at both ends by the force method.",
    project: meta.project, location: meta.location,
    facts: [
      ["Geometry", `${g.n_risers} risers × ${g.riser_mm} mm, going ${g.going_mm} mm, h = ${g.thickness_mm} mm`],
      ["Spans", `flight ${g.flight_span_m} m + landing ${g.landing_m} m`],
      ["Materials", `fck ${r.materials.fck}, fyk ${r.materials.fyk} N/mm²`],
      ["Bottom / top / distribution", `${bars(b)} / ${bars(t)} / ${bars(ds)}`],
      ["Governing utilisation", f2(r.utilisation.governing, 3)],
    ],
    status: r.status, report: r.report,
  }));

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] px-4 sm:px-6 2xl:px-10 py-6">
      <div ref={sheetRef} className="w-full space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate("/staircase-design")} className={`flex items-center gap-2 text-sm ${SUB}`}>
            <FiArrowLeft size={16} /> Back to Input
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowReport(true)} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]">
              <FiFileText size={15} /> Detailed Report
            </button>
            <button onClick={download} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
              <FiDownload size={15} /> Download PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className={`${CARD} p-5`}>
            <div className="text-xs text-[#94a3b8] uppercase tracking-wide mb-1">Staircase Design Output · EN 1992-1-1</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0A2F44] dark:text-[#66a4c2]">Staircase {r.member_id}</h1>
              <span className={`text-sm ${SUB}`}>{[meta.project, meta.location].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Mini label="Span A–C" value={`${f2(g.flight_span_m + g.landing_m, 3)} m`} />
              <Mini label="Waist h" value={`${g.thickness_mm} mm`} />
              <Mini label="M sag / M hog" value={`${f2(an.M_sag_kNm)} / ${f2(an.M_hog_kNm)} kNm`} />
              <Mini label="Thrust H" value={`${f2(an.H_kN)} kN`} />
            </div>
          </div>
          <div className={`rounded-xl border p-5 ${pass ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}>
            <div className={TITLE}>Summary of Results</div>
            <div className="mt-3 flex items-center gap-3">
              {pass ? <FiCheckCircle className="text-green-600 dark:text-green-400" size={32} /> : <FiXCircle className="text-red-600 dark:text-red-400" size={32} />}
              <div className={`text-2xl font-bold ${pass ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{pass ? "SAFE" : "UNSAFE"}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              {r.checks.map((c) => <SumLine key={c.check} label={c.check} value={f2(c.ratio, 3)} warn={c.status !== "OK"} />)}
            </div>
          </div>
        </div>

        {r.warnings?.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">{r.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
          </div>
        )}

        <TabBar tab={tab} setTab={setTab} />

        {tab === "Overview" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="Geometry & Reactions">
                <KV label="Risers × riser" value={`${g.n_risers} × ${g.riser_mm} = ${f2(g.rise_m * 1000, 0)} mm`} />
                <KV label="Treads × going" value={`${g.n_treads} × ${g.going_mm} = ${f2(g.going_m * 1000, 0)} mm`} />
                <KV label="Inclination α" value={`${f2(g.alpha_deg)}°`} />
                <KV label="Flight span / sloping length" value={`${g.flight_span_m} / ${g.sloping_length_m} m`} />
                <KV label="Landing" value={`${g.landing_m} m`} />
                <KV label="VA / VC" value={`${f2(an.VA_kN, 3)} / ${f2(an.VC_kN, 3)} kN`} warn={an.VC_kN < 0 || an.VA_kN < 0} />
                <KV label="Horizontal thrust H" value={`${f2(an.H_kN, 3)} kN`} strong />
              </Panel>
              <Panel title="Reinforcement Adopted (per m width)">
                <KV label="Bottom (span)" value={`${bars(b)} (${f2(b.As_prov, 0)} mm²/m)`} strong />
                <KV label="Top at B" value={t ? `${bars(t)} (${f2(t.As_prov, 0)} mm²/m)` : "not required (no hogging)"} strong={!!t} />
                <KV label="Distribution" value={`${bars(ds)} (${f2(ds.As_prov, 0)} mm²/m)`} />
                <KV label="Effective depth d" value={`${b.d_mm} mm`} />
              </Panel>
            </div>
            <Panel title="Design Summary">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {r.checks.map((c) => <Chip key={c.check} label={c.check} ratio={c.ratio} ok={c.status === "OK"} />)}
              </div>
            </Panel>
            <Panel title="Bending Moment (kNm/m)">
              <FrameDiagram pts={an.diagram} field="M" g={g} />
            </Panel>
          </>
        )}

        {tab === "Loading & Analysis" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="Loads (EN 1991-1-1)">
                <KV label="Waist h × 25 (along slope)" value={`${f2(ld.g_waist, 3)} kN/m²`} />
                <KV label="Steps ½ × R × 25" value={`${f2(ld.g_steps, 3)} kN/m²`} />
                <KV label="Finishes" value={`${f2(ld.finishes, 3)} kN/m²`} />
                <KV label="gk flight / landing" value={`${f2(ld.gk_flight, 3)} / ${f2(ld.gk_landing, 3)} kN/m²`} />
                <KV label="qk" value={`${f2(ld.qk, 3)} kN/m²`} />
                <KV label="n flight / landing (1.35gk + 1.5qk)" value={`${f2(ld.n_flight, 3)} / ${f2(ld.n_landing, 3)} kN/m`} strong />
              </Panel>
              <Panel title="Analysis Results">
                <KV label="H (force method)" value={`${f2(an.H_kN, 3)} kN`} strong />
                <KV label="VA / VC" value={`${f2(an.VA_kN, 3)} / ${f2(an.VC_kN, 3)} kN`} />
                <KV label="Max sagging" value={`${f2(an.M_sag_kNm, 3)} kNm at x = ${f2(an.x_sag_m, 3)} m`} />
                <KV label="Moment at B" value={`${f2(an.M_B_kNm, 3)} kNm`} />
                <KV label="Max hogging" value={`${f2(an.M_hog_kNm, 3)} kNm`} />
              </Panel>
            </div>
            <Panel title="Bending Moment (kNm/m, drawn on the tension side)"><FrameDiagram pts={an.diagram} field="M" g={g} /></Panel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="Shear Force (kN/m)"><FrameDiagram pts={an.diagram} field="V" g={g} /></Panel>
              <Panel title="Axial Force (kN/m, tension +)"><FrameDiagram pts={an.diagram} field="N" g={g} /></Panel>
            </div>
            <ReportSections report={r.report} match={/Geometry|Loading|Analysis/i} heading="Loading and analysis — calculation" />
          </>
        )}

        {tab === "Flexural Design" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FlexPanel title="Bottom Steel (span)" f={b} />
              {t ? <FlexPanel title="Top Steel at B (hogging)" f={t} /> : (
                <Panel title="Top Steel"><p className={`text-sm ${SUB}`}>No hogging moment anywhere: not required.</p></Panel>
              )}
            </div>
            <Panel title="Distribution Steel (EC2 9.3.1.1(2))">
              <KV label="Required ≥ 20% of main" value={`${f2(ds.As_req, 1)} mm²/m`} />
              <KV label="Provided" value={`${bars(ds)} = ${f2(ds.As_prov, 0)} mm²/m`} strong />
              <KV label="Spacing limit" value={`${ds.s_max} mm`} />
              <KV label="Status" value={ds.status} warn={ds.status !== "OK"} />
            </Panel>
            <ReportSections report={r.report} match={/Flexural/i} heading="Flexural design — calculation" />
          </>
        )}

        {tab === "Deflection & Shear" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="Deflection (span / depth)">
                <KV label="ρ = As,prov / bd" value={f2(df.rho, 6)} />
                <KV label={`Basic L/d (Eq. ${df.branch}, K = 1.0)`} value={f2(df.basic, 3)} />
                <KV label="310/σs (cap 1.5)" value={`${f2(df.F3_raw, 3)} → ${f2(df.F3, 3)}`} />
                <KV label="Allowable L/d" value={f2(df.allowable, 3)} strong />
                <KV label="Actual L/d" value={`${f2(df.L_mm, 0)} / ${b.d_mm} = ${f2(df.actual, 3)}`} strong warn={df.status !== "OK"} />
                <KV label="Status" value={df.status} warn={df.status !== "OK"} />
              </Panel>
              <Panel title="Shear (no shear reinforcement)">
                <KV label="Governing section" value={`x = ${f2(sh.x, 3)} m (${sh.member})`} />
                <KV label="V_Ed / N_Ed" value={`${f2(sh.VEd, 3)} / ${f2(sh.NEd, 3)} kN`} />
                <KV label="σcp (compression +)" value={`${f2(sh.sigma_cp, 4)} N/mm²`} />
                <KV label={`k / ρl (${sh.face} steel)`} value={`${f2(sh.k, 3)} / ${f2(sh.rho, 6)}`} />
                <KV label="V_Rd,c" value={`${f2(sh.VRdc_kN, 3)} kN`} strong />
                <KV label="V_Ed / V_Rd,c" value={`${f2(sh.ratio, 3)} ${sh.status}`} warn={sh.status !== "OK"} strong />
              </Panel>
            </div>
            <ReportSections report={r.report} match={/Deflection|Shear/i} heading="Deflection and shear — calculation" />
          </>
        )}

        {tab === "Detailing & Schedule" && <DetailingTab r={r} />}

        <p className={`text-xs ${SUB}`}>
          Computed per EN 1992-1-1 (design and detailing), with the frame solved exactly by the force method.
          Validate against a trusted tool before real design.
        </p>
      </div>
      {showReport && <ReportModal r={r} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function FlexPanel({ title, f }) {
  return (
    <Panel title={title}>
      <KV label="M_Ed" value={`${f2(f.M, 3)} kNm/m (x = ${f2(f.x, 3)} m, ${f.member})`} strong />
      <KV label="d" value={`${f.d_mm} mm`} />
      <KV label="K" value={`${f2(f.K, 4)} (limit 0.167)`} warn={f.K > 0.167} />
      <KV label="z" value={f.z_mm != null ? `${f2(f.z_mm, 1)} mm${f.z_capped ? " (0.95d)" : ""}` : "-"} />
      <KV label="As,req / As,min" value={`${f2(f.As_req, 1)} / ${f2(f.As_min, 1)} mm²/m`} />
      <KV label="Provided" value={`Y${f.bar} @ ${f.spacing} = ${f2(f.As_prov, 0)} mm²/m`} strong />
      <KV label="Status" value={f.status} warn={f.status !== "OK"} />
    </Panel>
  );
}

/* Member diagram drawn on the frame, like the book's figures: A at the top
   left, B at the foot of the flight, C at the end of the landing. Values are
   offset perpendicular to each member; positive moments (sagging) are drawn
   below the member (tension side). */
function FrameDiagram({ pts, field, g }) {
  if (!pts?.length) return null;
  const L1 = g.flight_span_m, L2 = g.landing_m, Hf = g.rise_m;
  const W = 720, H = 300, pad = 50;
  const maxV = Math.max(...pts.map((p) => Math.abs(p[field])), 1e-9);
  const sc = Math.min((W - 2 * pad) / (L1 + L2), (H - 2 * pad) / (Hf + 1.0));
  const off = (0.55 / maxV);       // diagram depth: 0.55 m at the peak
  const X = (x) => pad + x * sc, Y = (y) => H - pad - 0.5 * sc - y * sc;
  const Ls = Math.hypot(L1, Hf), c = L1 / Ls, s = Hf / Ls;
  // normal pointing "below" each member (world coords, y up)
  const nrm = (p) => (p.member === "flight" ? [-s, -c] : [0, -1]);
  const pos = (p) => { const [nx, ny] = nrm(p); const v = p[field] * off; return [X(p.x + nx * v), Y(p.y + ny * v)]; };
  const fl = pts.filter((p) => p.member === "flight"), la = pts.filter((p) => p.member === "landing");
  const area = (arr) => {
    if (!arr.length) return "";
    const a = arr[0], z = arr[arr.length - 1];
    return [`${X(a.x)},${Y(a.y)}`, ...arr.map((p) => pos(p).join(",")), `${X(z.x)},${Y(z.y)}`].join(" ");
  };
  // labelled values: ends of each member and the extreme
  const hi = pts.reduce((m, p) => (p[field] > m[field] ? p : m), pts[0]);
  const lo = pts.reduce((m, p) => (p[field] < m[field] ? p : m), pts[0]);
  const B_left = fl[fl.length - 1], B_right = la[0];
  const labels = [pts[0], B_left, B_right, pts[pts.length - 1], hi, lo].filter(Boolean)
    // one label per position and value (M is continuous at B; V and N jump)
    .filter((p, i, arr) => arr.findIndex((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q[field] - p[field]) < 1e-3) === i)
    .filter((p) => Math.abs(p[field]) > maxV * 0.02);
  const unit = field === "M" ? "kNm" : "kN";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <polygon points={area(fl)} fill="#0A2F44" fillOpacity="0.12" stroke="#0A2F44" strokeWidth="1" />
      <polygon points={area(la)} fill="#0A2F44" fillOpacity="0.12" stroke="#0A2F44" strokeWidth="1" />
      <polyline points={`${X(0)},${Y(Hf)} ${X(L1)},${Y(0)} ${X(L1 + L2)},${Y(0)}`} fill="none" stroke="#0F172A" strokeWidth="2.5" />
      {[[0, Hf], [L1 + L2, 0]].map(([x, y], i) => (
        <polygon key={i} points={`${X(x)},${Y(y)} ${X(x) - 8},${Y(y) + 14} ${X(x) + 8},${Y(y) + 14}`} fill="none" stroke="#2563eb" strokeWidth="2" />
      ))}
      <text x={X(0) - 10} y={Y(Hf) - 6} fontSize="13" fontWeight="700" fill="#0F172A" textAnchor="end">A</text>
      <text x={X(L1)} y={Y(0) - 10} fontSize="13" fontWeight="700" fill="#0F172A" textAnchor="middle">B</text>
      <text x={X(L1 + L2) + 10} y={Y(0) - 6} fontSize="13" fontWeight="700" fill="#0F172A">C</text>
      {labels.map((p, i) => {
        const [px, py] = pos(p);
        return <text key={i} x={px} y={py + (p[field] > 0 ? 13 : -5)} fontSize="11" fill="#b91c1c" textAnchor="middle">{f2(p[field], 3)} {unit}</text>;
      })}
    </svg>
  );
}

function ReportModal({ r, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${CARD} max-h-[85vh] w-full max-w-4xl overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-5 py-3">
          <h3 className={TITLE}>Detailed Calculation Report — Staircase</h3>
          <button onClick={onClose} className={SUB}><FiX size={18} /></button>
        </div>
        <div className="p-5"><ReportSections report={r.report} match={/./} heading="Calculation report" /></div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className={CARD}>
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className={TITLE}>{title}</h3></div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function KV({ label, value, strong, warn }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#f1f5f9] dark:border-[#2a3646] last:border-0">
      <span className={`text-xs ${SUB}`}>{label}</span>
      <span className={`text-xs text-right ${strong ? "font-bold" : "font-medium"} ${warn ? "text-red-600 dark:text-red-400" : MAIN}`}>{value}</span>
    </div>
  );
}
function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] dark:bg-[#111827] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</div>
      <div className={`text-sm font-semibold ${MAIN}`}>{value}</div>
    </div>
  );
}
function SumLine({ label, value, warn }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${SUB}`}>{label}</span>
      <span className={`text-xs font-semibold ${warn ? "text-red-600 dark:text-red-400" : MAIN}`}>{value}</span>
    </div>
  );
}
function Chip({ label, ratio, ok }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${ok ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}>
      {ok ? <FiCheckCircle className="text-green-600 dark:text-green-400" size={18} /> : <FiXCircle className="text-red-600 dark:text-red-400" size={18} />}
      <span className={`text-[11px] text-center ${MAIN}`}>{label}</span>
      {ratio != null && <span className={`text-[11px] font-semibold ${ok ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{f2(ratio, 3)}</span>}
    </div>
  );
}
function TabBar({ tab, setTab }) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-[#e2e8f0] dark:border-[#334155]">
      {TABS.map((x) => (
        <button key={x} onClick={() => setTab(x)}
          className={`-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
            tab === x ? "border-[#0A2F44] dark:border-[#66a4c2] text-[#0A2F44] dark:text-[#66a4c2]"
                      : `border-transparent ${SUB} hover:text-[#0F172A] dark:hover:text-white`}`}>
          {x}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- detailing (book 9.9 / 10.6)
function DetailingTab({ r }) {
  const det = r.detailing;
  if (!det) return <Panel title="Detailing & Schedule"><p className={`text-sm ${SUB}`}>Run the design again to get the detailing and bar schedule.</p></Panel>;
  const a = det.anchorage_C, lm = det.lbd_main;
  const dias = det.summary.by_diameter.map((e) => e.type_size);
  const th = "px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#334155]";
  const td = `px-2 py-1.5 align-middle border-b border-[#f1f5f9] dark:border-[#334155] ${MAIN}`;
  return (
    <>
      <Panel title="Section A–B–C">
        <StairSection r={r} />
        <p className={`mt-2 text-xs ${SUB}`}>
          Schematic, to scale. Solid = bottom bars, dashed = top bars. The landing top bar (02) crosses at the knee into the flight soffit,
          {` ${f2(det.x_cross_mm, 0)} mm past B ((h − 2c)/tan θ).`}
        </p>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Bar Callouts (Drawing)">
          {det.schedule.map((b) => <KV key={b.mark} label={`Mark ${b.mark}`} value={b.callout} strong />)}
          <p className={`mt-2 text-xs ${SUB}`}>number, size, bar mark, spacing (mm) and layer (B / T / NB / NT).</p>
        </Panel>
        <Panel title="Anchorage (EC2 8.4, 9.2.1.4)">
          <KV label="l_bd main bars at f_yd" value={`${f2(lm.lbd_mm, 0)} mm (α2 = ${f2(lm.alpha2, 3)})`} />
          <KV label="Leg into floor slab at A" value={`max(500, l_bd) = ${det.leg_slab_mm} mm`} />
          <KV label="Hogging zone at B" value={`flight ${f2(det.hog_flight_mm, 0)} / landing ${f2(det.hog_landing_mm, 0)} mm`} />
          <KV label="F_E at C = |V|·a_l/z + N" value={`${f2(a.VEd_kN, 3)}·${f2(a.a_l_mm, 0)}/${f2(a.z_mm, 1)} + ${f2(a.NEd_kN, 3)} = ${f2(a.FE_kN, 3)} kN/m`} />
          <KV label="σ = F_E / A_s,prov" value={`${f2(a.sigma_MPa, 1)} N/mm²`} />
          <KV label="l_bd required / available (t − c)" value={`${f2(a.lbd_mm, 0)} / ${f2(a.available_mm, 0)} mm`} strong warn={a.status !== "OK"} />
          <KV label="Status" value={a.status} warn={a.status !== "OK"} />
        </Panel>
      </div>

      <Panel title="Reinforcement Bending / Quantity Schedule">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["S/No", "Bar mark", "Type & size", "No. of bars", "No. of members", "Shape", "Length (m)", "Total length (m)", ...dias.map((d) => `${d} (kg)`)].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {det.schedule.map((b, i) => (
                <tr key={b.mark}>
                  <td className={td}>{i + 1}</td><td className={td}>{b.mark}</td>
                  <td className={td}>{b.type_size}</td><td className={td}>{b.n_bars}</td><td className={td}>{b.n_members}</td>
                  <td className={td}><BarSketch b={b} /></td>
                  <td className={td}>{b.length_m.toFixed(3)}</td><td className={td}>{b.total_length_m.toFixed(3)}</td>
                  {dias.map((d) => <td key={d} className={td}>{d === b.type_size ? b.mass_kg.toFixed(2) : ""}</td>)}
                </tr>
              ))}
              {[["TOTAL (kg)", (e) => e.mass_kg.toFixed(2)], ["TOTAL (tonnes)", (e) => e.tonnes.toFixed(4)], ["Pieces (12 m)", (e) => `${e.pieces_12m} pcs`]].map(([lab, fn]) => (
                <tr key={lab}><td className={`${td} text-right font-semibold`} colSpan={9}>{lab}</td>
                  {det.summary.by_diameter.map((e) => <td key={e.type_size} className={`${td} font-semibold`}>{fn(e)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-2 text-xs ${SUB}`}>
          Cut length = sum of the shape dimensions (BS 8666 bend deductions not applied). Bars across the width = floor((W − 2c)/s) + 1.
          Total {det.summary.total_mass_kg} kg for {det.schedule[0]?.n_members} staircase(s).
        </p>
      </Panel>
      <ReportSections report={r.report} match={/Detailing/i} heading="Detailing and bar schedule — calculation" />
    </>
  );
}

function BarSketch({ b }) {
  const segs = b.sketch.map(([k, ang]) => ({ len: b.dims_mm[k], ang: (ang * Math.PI) / 180 }));
  const maxL = Math.max(...segs.map((s) => s.len));
  let x = 0, y = 0;
  const pts = [[0, 0]], labs = [];
  segs.forEach((s) => {
    const L = 14 + 76 * Math.sqrt(s.len / maxL);
    const nx = x + L * Math.cos(s.ang), ny = y - L * Math.sin(s.ang);
    labs.push({ x: (x + nx) / 2, y: (y + ny) / 2, t: s.len, vert: Math.abs(Math.sin(s.ang)) > 0.99 });
    x = nx; y = ny; pts.push([x, y]);
  });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 26, y0 = Math.min(...ys) - 14, w = Math.max(...xs) - x0 + 26, hgt = Math.max(...ys) - y0 + 14;
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${hgt}`} width={Math.min(w * 1.1, 230)} height={Math.max(hgt * 1.1, 22)} className="text-[#0A2F44] dark:text-[#66a4c2]">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" />
      {labs.map((l, i) => (
        <text key={i} x={l.vert ? l.x + 4 : l.x} y={l.vert ? l.y + 3 : l.y - 4} fontSize="9" textAnchor={l.vert ? "start" : "middle"} fill="currentColor">{l.t}</text>
      ))}
    </svg>
  );
}

function StairSection({ r }) {
  const det = r.detailing, g = r.geometry;
  const L1 = g.flight_span_m * 1000, L2 = g.landing_m * 1000, Hf = g.rise_m * 1000;
  const h = g.thickness_mm, c = g.cover_mm, t = det.support_width_mm;
  const th = Math.atan2(Hf, L1), co = Math.cos(th), si = Math.sin(th);
  const dims = Object.fromEntries(det.schedule.map((b) => [b.mark, b.dims_mm]));
  const xAt = (off, yv) => L1 * (1 - (yv + off / co) / Hf);   // x where the line `off` below the flight top reaches level yv
  const down = (p, L) => [p[0] + L * co, p[1] - L * si];
  const up = (p, L) => [p[0] - L * co, p[1] + L * si];
  const xC = L1 + L2, xEnd = xC + t / 2 - c;
  const slabL = Math.max(dims["01"].A, dims["04"].A) + 150;
  const outline = [[-slabL, Hf], [0, Hf], [L1, 0], [xC + t / 2, 0], [xC + t / 2, -h - 300], [xC - t / 2, -h - 300], [xC - t / 2, -h],
    [xAt(h, -h), -h], [xAt(h, Hf - h), Hf - h], [-slabL, Hf - h]];
  const yA = Hf - h + c;
  const p01 = [xAt(h - c, yA), yA], q01 = [xAt(h - c, -h + c), -h + c];
  const b01 = [[p01[0] - dims["01"].A, yA], p01, q01, [xEnd, -h + c], [xEnd, -h + c + dims["01"].D]];
  const p02 = [xAt(h - c, -c), -c];
  const b02 = [up(p02, dims["02"].A), p02, [xEnd, -c], [xEnd, -c - dims["02"].C]];
  const p03 = [xAt(c, -c), -c];
  const b03 = [up(p03, dims["03"].A), p03, [p03[0] + dims["03"].B, -c]];
  const p04 = [xAt(c, Hf - c), Hf - c];
  const b04 = [[p04[0] - dims["04"].A, Hf - c], p04, down(p04, dims["04"].B)];
  const all = [...outline, ...b01, ...b02, ...b03, ...b04];
  const minX = Math.min(...all.map((p) => p[0])) - 150, maxX = Math.max(...all.map((p) => p[0])) + 250;
  const minY = Math.min(...all.map((p) => p[1])) - 250, maxY = Math.max(...all.map((p) => p[1])) + 250;
  const P = (pts) => pts.map(([x, y]) => `${x},${-y}`).join(" ");
  const lab = (pts, i, text, dy) => {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    return <text x={(x1 + x2) / 2} y={-(y1 + y2) / 2 + dy} fontSize="90" textAnchor="middle" fill="#dc2626">{text}</text>;
  };
  const steps = [];
  for (let i = 0; i < g.n_treads; i++) {
    const x = L1 - (g.n_treads - i) * g.going_mm, y = Hf - (i + 1) * g.riser_mm;
    if (x >= 0) steps.push(`M${x},${-(y + g.riser_mm)} L${x},${-y} L${x + g.going_mm},${-y}`);
  }
  const axis = "fill-[#0A2F44] dark:fill-[#66a4c2]";
  return (
    <svg viewBox={`${minX} ${-maxY} ${maxX - minX} ${maxY - minY}`} className="w-full h-auto max-h-[420px]">
      <polygon points={P(outline)} fill="#e2e8f0" stroke="#64748b" strokeWidth="8" />
      <path d={steps.join(" ")} fill="none" stroke="#94a3b8" strokeWidth="6" />
      <polyline points={P(b01)} fill="none" stroke="#dc2626" strokeWidth="14" />
      <polyline points={P(b02)} fill="none" stroke="#dc2626" strokeWidth="14" strokeDasharray="60 30" />
      <polyline points={P(b03)} fill="none" stroke="#b91c1c" strokeWidth="14" strokeDasharray="60 30" />
      <polyline points={P(b04)} fill="none" stroke="#b91c1c" strokeWidth="14" strokeDasharray="60 30" />
      {lab(b01, 1, "01", 170)}{lab(b02, 1, "02", -50)}{lab(b03, 0, "03", -70)}{lab(b04, 1, "04", -70)}
      <text x={0} y={-Hf - 80} fontSize="100" textAnchor="middle" className={axis}>A</text>
      <text x={L1} y={h + 160} fontSize="100" textAnchor="middle" className={axis}>B</text>
      <text x={xC} y={h + 430} fontSize="100" textAnchor="middle" className={axis}>C</text>
      <text x={L1 + L2 / 2} y={h / 2 + 30} fontSize="70" textAnchor="middle" fill="#64748b">06 (T&amp;B)</text>
      <text x={L1 * 0.3} y={-Hf * 0.7 + 330} fontSize="70" textAnchor="middle" fill="#64748b">05 (NB/NT)</text>
    </svg>
  );
}
