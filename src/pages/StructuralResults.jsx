// src/pages/StructuralResults.jsx
import React, { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DetailedReport from "../components/DetailedReport";
import { exportElementToPdf } from "../utils/exportPdf";
import { buildCoverHtml } from "../utils/reportCover";
import { listDesigns, saveDesign, deleteDesign } from "../utils/savedDesigns";
import { downloadCsv, objectRows } from "../utils/exportCsv";
import { slabAPI } from "../services/api";
import {
  FiHome, FiChevronRight, FiFilePlus, FiFolder, FiSave, FiMoreVertical,
  FiArrowLeft, FiArrowRight, FiCheck, FiDownload, FiFileText,
  FiAlertTriangle, FiXCircle, FiShield, FiInfo, FiTrash2, FiX,
} from "react-icons/fi";

/* ================================================================== */
/*  THEME TOKENS                                                      */
/* ================================================================== */
const CARD =
  "rounded-xl border bg-white dark:bg-[#0f172a] border-[#e2e8f0] dark:border-[#1f2937] shadow-sm";
const PAGE = "bg-[#f3f4f6] dark:bg-[#0b0f19]";
const TXT_MAIN = "text-[#0F172A] dark:text-white";
const TXT_SUB = "text-[#64748b] dark:text-[#94a3b8]";
const ACCENT = "text-[#0A2F44] dark:text-[#66a4c2]";
const ROW_BORDER = "border-[#f1f5f9] dark:border-[#1f2937]";

const TABS = ["Overview", "Flexural Design", "Shear Design", "Deflection", "Reinforcement Summary"];
// what each tab holds, for the cover page of its PDF
const TAB_NOTES = {
  "Overview": "geometry, loads, design moments, reinforcement and the status of every check.",
  "Flexural Design": "the bending design in full for each direction: K, lever arm, tension and minimum steel, bars provided (EC2 6.1).",
  "Shear Design": "the shear check against the resistance without shear reinforcement (EC2 6.2.2).",
  "Deflection": "the span/depth deflection check in full (EC2 7.4.2).",
  "Reinforcement Summary": "the bars provided in each direction, with spacing and area.",
};

/* ================================================================== */
/*  PURE HELPERS                                                      */
/* ================================================================== */
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const num = (v, d = 2) => (typeof v === "number" ? v.toFixed(d) : "0");
const fmtCur = (v) => v?.toLocaleString("en-NG", { maximumFractionDigits: 2 }) ?? "0";

function parseNum(str, re) {
  const m = String(str || "").match(re);
  return m ? Number(m[1]) : null;
}

/* EC2 display-side derivation. Backend detail fields, if present, should override. */
function deriveEC2({ summary, forces, reinf, shear, defl }) {
  const fck = parseNum(summary.concrete_grade, /C(\d+)/) || 30;
  const fyk = parseNum(summary.steel_grade, /B?(\d{3})/) || 500;
  const b = 1000;
  const d = Number(summary.effective_depth) || 0;
  const h = Number(summary.thickness) || 0;
  const Lx = Number(summary.span_lx) || 0;
  const Ly = Number(summary.span_ly) || 0;
  const spans = [Lx, Ly].filter(Boolean);
  const Lshort = (spans.length ? Math.min(...spans) : 0) * 1000;

  const bottomAs = Number(reinf.bottom_steel?.area_provided) || 0;
  const topAs = Number(reinf.top_steel?.area_provided) || 0;

  const fctm = 0.3 * Math.pow(fck, 2 / 3);
  const AsMin = Math.max((0.26 * fctm * b * d) / fyk, 0.0013 * b * d);
  const AsMax = 0.04 * b * h;

  const flex = (M, AsProv) => {
    const Mabs = Math.abs(Number(M) || 0);
    const Mn = Mabs * 1e6;
    const K = d ? Mn / (b * d * d * fck) : 0;
    const z = Math.min((0.5 + Math.sqrt(Math.max(0.25 - K / 1.134, 0))) * d, 0.95 * d);
    const AsReq = z ? Mn / (0.87 * fyk * z) : 0;
    const MRd = AsProv ? (0.87 * fyk * AsProv * z) / 1e6 : 0;
    return { M: Mabs, K, z, AsReq, AsGov: Math.max(AsReq, AsMin), MRd, util: MRd ? Mabs / MRd : 0 };
  };
  const sagging = flex(forces.max_sagging_moment, bottomAs);
  const hogging = flex(forces.max_hogging_moment, topAs);

  // one-way shear (EC2 6.2.2)
  const k = Math.min(1 + Math.sqrt(200 / (d || 1)), 2);
  const rhoL = Math.min(bottomAs / (b * d || 1), 0.02);
  const CRdc = 0.12;
  const vMin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
  const vRdc = Math.max(CRdc * k * Math.cbrt(100 * rhoL * fck), vMin);
  const VRdcDerived = (vRdc * b * d) / 1000;
  const VEd = Number(forces.max_shear_force) || Number(shear.design_shear) || 0;
  const vEd = d ? (VEd * 1000) / (b * d) : 0;
  const VRd = Number(shear.shear_resistance) || VRdcDerived;
  const shearUtil = VRd ? VEd / VRd : 0;

  // deflection — span/effective-depth (EC2 7.4.2)
  const rho = sagging.AsGov / (b * d || 1);
  const rho0 = Math.sqrt(fck) / 1000;
  const Kdef = 1.5; // interior panel
  const basicLd =
    rho <= rho0
      ? Kdef * (11 + 1.5 * Math.sqrt(fck) * (rho0 / rho) + 3.2 * Math.sqrt(fck) * Math.pow(Math.max(rho0 / rho - 1, 0), 1.5))
      : Kdef * (11 + 1.5 * Math.sqrt(fck) * (rho0 / Math.max(rho - rho0, 1e-9)));
  const steelFactor = Math.min(bottomAs / (sagging.AsGov || 1), 1.5);
  const allowLd = basicLd * steelFactor;
  const actualLd = d ? Lshort / d : 0;
  const deflUtil = allowLd ? actualLd / allowLd : 0;
  const actualDefl = Number(defl.actual_deflection) || 0;
  const allowDefl = Number(defl.allowable_deflection) || Lshort / 250;

  return {
    fck, fyk, b, d, h, Lshort, fctm, AsMin, AsMax, bottomAs, topAs,
    sagging, hogging,
    k, rhoL, CRdc, vMin, vRdc, VRdcDerived, VEd, vEd, VRd, shearUtil,
    rho, rho0, Kdef, basicLd, steelFactor, allowLd, actualLd, deflUtil, actualDefl, allowDefl,
  };
}

/* ================================================================== */
/*  MAIN                                                              */
/* ================================================================== */
const StructuralResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const [reportOpen, setReportOpen] = useState(false);
  const sheetRef = useRef(null);
  const [openList, setOpenList] = useState(null);     // saved designs shown by "Open", null = closed
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [liveResult, setLiveResult] = useState(null);   // overrides location.state after a re-run
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState("");
  const { workspaceId, projectId } = useParams();

  // Workspace-aware back navigation: return to the scoped slab input when we
  // have workspace/project context, otherwise just go back to wherever we came from.
  const goToInput = () => {
    if (workspaceId && projectId) {
      navigate(`/workspace/${workspaceId}/projects/${projectId}/slab-input`);
    } else {
      navigate(-1);
    }
  };

  const originalFormData = location.state?.formData;
  const rawData = liveResult || location.state?.designResult;

  const handleIncreaseThickness = async (newThicknessMm) => {
    if (!originalFormData) {
      setRerunError("Can't re-run: this page wasn't given the original design inputs.");
      return;
    }
    setRerunning(true);
    setRerunError("");
    try {
      const result = await slabAPI.startDesign({ ...originalFormData, thickness: newThicknessMm });
      setLiveResult(result);
      setTab("Deflection");
      setReportOpen(false);
    } catch (e) {
      setRerunError(e.message || "Re-run failed.");
    } finally {
      setRerunning(false);
    }
  };

  if (!rawData) {
    return (
      <div className={`min-h-screen ${PAGE} flex items-center justify-center`}>
        <div className="text-center">
          <FiAlertTriangle className="text-6xl text-yellow-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${TXT_MAIN} mb-2`}>No Design Results</h2>
          <p className={`${TXT_SUB} mb-6`}>Please run a design optimisation first.</p>
          <button onClick={() => goToInput()} className="px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors">
            <FiArrowLeft className="inline mr-2" /> Back to Design
          </button>
        </div>
      </div>
    );
  }

  const summary = rawData.summary || {};
  const forces = rawData.design_forces || {};
  const reinf = rawData.reinforcement || {};
  const defl = rawData.deflection || {};
  const shear = rawData.shear || {};
  const compliance = rawData.compliance || [];
  const cost = rawData.cost_breakdown || {};
  const warnings = rawData.warnings || [];
  const D = deriveEC2({ summary, forces, reinf, shear, defl });
  const isPass = summary.status === "PASS" || !summary.status;

  const ctx = { summary, forces, reinf, defl, shear, compliance, cost, D, isPass };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Save / Open: designs kept in this browser (utils/savedDesigns.js)
  const saveCurrent = () => {
    const name = `${summary.slab_type || "Slab"} ${[summary.span_lx, summary.span_ly].filter((v) => v != null).join(" × ")} m, h ${summary.thickness} mm`;
    try {
      saveDesign("slab", {
        name, status: summary.status,
        subtitle: [summary.concrete_grade, summary.steel_grade, summary.continuity].filter(Boolean).join(" · "),
        designResult: rawData, formData: originalFormData || null,
      });
      flash(`Saved: ${name}`);
    } catch (e) {
      flash(e.message);
    }
  };
  const openSaved = (d) => {
    setOpenList(null);
    setLiveResult(null);
    setTab("Overview");
    navigate(location.pathname, { replace: true, state: { designResult: d.designResult, formData: d.formData } });
  };

  // Export: the results and the calculation trace as a CSV for Excel
  const exportResults = () => downloadCsv(`Slab-${summary.slab_type || "results"}`, [
    { title: "Summary", rows: objectRows(summary) },
    { title: "Design forces", rows: objectRows(forces) },
    { title: "Reinforcement", rows: objectRows(reinf) },
    { title: "Deflection", rows: objectRows(defl) },
    { title: "Shear", rows: objectRows(shear) },
    { title: "Checks", rows: compliance.length ? [["Check", "Ratio", "Limit", "Status"], ...compliance.map((c) => [c.check, c.ratio, c.limit, c.status])] : [] },
    { title: "Warnings", rows: warnings.map((w) => [typeof w === "string" ? w : w.message || JSON.stringify(w)]) },
  ], rawData.report);

  // prints the tab on screen behind a cover page
  const downloadPdf = () => exportElementToPdf(sheetRef.current, `Slab-${tab}`, buildCoverHtml({
    element: /slab/i.test(summary.slab_type || "") ? summary.slab_type : `${summary.slab_type || ""} Slab`.trim(), section: tab, sectionNote: TAB_NOTES[tab],
    description: `${summary.slab_type || "Reinforced concrete"} slab${summary.continuity ? ` (${summary.continuity})` : ""} designed to BS EN 1992-1-1 for bending, shear and deflection.`,
    facts: [
      ["Spans lx × ly", [summary.span_lx, summary.span_ly].filter((v) => v != null).join(" × ") + " m"],
      ["Thickness / effective depth", `${summary.thickness} / ${summary.effective_depth} mm`],
      ["Materials", [summary.concrete_grade, summary.steel_grade].filter(Boolean).join(", ")],
      ["Utilisation", summary.utilization_ratio],
    ],
    status: summary.status, report: rawData.report,
  }));

  return (
    <div className={`min-h-screen ${PAGE}`}>
      {/* top app bar */}
      <header className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1f2937] bg-white dark:bg-[#0b0f19] px-4 py-2.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiHome size={15} /></div>
            <span className={`text-sm font-bold ${TXT_MAIN}`}>Struct Design Hub</span>
          </div>
          <nav className={`hidden md:flex items-center gap-1.5 text-[13px] ${TXT_SUB}`}>
            <span>Slab Design</span><FiChevronRight size={13} />
            <span>{summary.slab_type || "Slab"}</span><FiChevronRight size={13} />
            <span className="font-medium text-[#0F172A] dark:text-white">Results</span>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <TopBtn icon={FiFilePlus} label="New" onClick={() => goToInput()} />
          <TopBtn icon={FiFolder} label="Open" onClick={() => setOpenList(listDesigns("slab"))} />
          <TopBtn icon={FiSave} label="Save" onClick={saveCurrent} />
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="More actions" className={`ml-1 rounded-md p-1.5 ${TXT_SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}><FiMoreVertical size={16} /></button>
            {menuOpen && (
              <div className={`absolute right-0 z-40 mt-1 w-52 ${CARD} py-1`} onMouseLeave={() => setMenuOpen(false)}>
                {[
                  ["Open saved design", () => setOpenList(listDesigns("slab"))],
                  ["Save design", saveCurrent],
                  ["Detailed report", () => setReportOpen(true)],
                  ["Download report (PDF)", downloadPdf],
                  ["Export results (CSV)", exportResults],
                ].map(([label, fn]) => (
                  <button key={label} onClick={() => { setMenuOpen(false); fn(); }}
                    className={`block w-full px-3 py-2 text-left text-[13px] ${TXT_MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}>{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main ref={sheetRef} className="mx-auto max-w-[1400px] p-5">
        {/* page header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={`text-lg font-bold ${TXT_MAIN}`}>SLAB DESIGN RESULTS</h1>
            <p className={`text-[13px] ${TXT_SUB}`}>{summary.slab_type || "Slab"} • {summary.continuity || ""} • EN 1992-1-1 (EC2)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setReportOpen(true)} className={`flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] bg-white dark:bg-[#0f172a] px-3 py-1.5 text-[13px] font-medium ${TXT_MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}><FiFileText size={15} /> Detailed Report</button>
            <button onClick={downloadPdf} className="flex items-center gap-1.5 rounded-lg bg-[#0A2F44] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#082636] transition-colors">
              <FiDownload size={15} /> Download Report
            </button>
          </div>
        </div>

        {/* input warnings — the design used YOUR values; these need review */}
        {warnings.length > 0 && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
            <div className="mb-2 flex items-center gap-2">
              <FiAlertTriangle className="text-amber-600 dark:text-amber-400" size={18} />
              <span className="text-[13px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Input warnings &mdash; your values were used as entered
              </span>
            </div>
            <ul className="ml-6 list-disc space-y-1.5">
              {warnings.map((w, i) => {
                const isError = String(w).trim().toUpperCase().startsWith("ERROR");
                return (
                  <li key={i} className={`text-[12px] ${isError
                    ? "font-semibold text-red-700 dark:text-red-400"
                    : "text-amber-800 dark:text-amber-300"}`}>
                    {String(w).replace(/^(WARNING|ERROR):\s*/i, "")}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              The design has been carried out with the values you entered. Review these points before construction.
            </p>
          </div>
        )}

        {/* tabs */}
        <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[#e2e8f0] dark:border-[#1f2937]">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                tab === t ? "border-[#0A2F44] dark:border-[#66a4c2] text-[#0A2F44] dark:text-[#66a4c2]"
                          : `border-transparent ${TXT_SUB} hover:text-[#0F172A] dark:hover:text-white`}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && <OverviewTab ctx={ctx} />}
        {tab === "Flexural Design" && <FlexuralTab ctx={ctx} />}
        {tab === "Shear Design" && <ShearTab ctx={ctx} />}
        {tab === "Deflection" && <DeflectionTab ctx={ctx} />}
        {tab === "Reinforcement Summary" && <ReinforcementTab ctx={ctx} />}

        {/* footer */}
        <div className="mt-5 flex items-center justify-between border-t border-[#e2e8f0] dark:border-[#1f2937] pt-4">
          <button onClick={() => goToInput()} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium ${TXT_SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}>
            <FiArrowLeft size={15} /> Back to Input
          </button>
          <div className="flex gap-2">
            <button onClick={saveCurrent} className={`rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] bg-white dark:bg-[#0f172a] px-4 py-2 text-[13px] font-medium ${TXT_MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}>Save Results</button>
            <button onClick={exportResults} title="CSV file: opens in Excel" className="flex items-center gap-1.5 rounded-lg bg-[#0A2F44] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#082636]">Export Results <FiArrowRight size={15} /></button>
          </div>
        </div>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-[#0A2F44] px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}

      {openList && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4" onClick={() => setOpenList(null)}>
          <div className={`${CARD} mt-16 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#1f2937]">
              <h3 className={`text-sm font-bold ${TXT_MAIN}`}>Saved slab designs</h3>
              <button onClick={() => setOpenList(null)} aria-label="Close" className={TXT_SUB}><FiX size={16} /></button>
            </div>
            {openList.length === 0 ? (
              <p className={`px-4 py-6 text-center text-[13px] ${TXT_SUB}`}>No saved slab designs in this browser yet. Use Save on a result to keep it.</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-[#e2e8f0] overflow-y-auto dark:divide-[#1f2937]">
                {openList.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => openSaved(d)} className="min-w-0 flex-1 text-left">
                      <div className={`truncate text-[13px] font-semibold ${TXT_MAIN}`}>{d.name}</div>
                      <div className={`truncate text-[11px] ${TXT_SUB}`}>
                        {new Date(d.saved_at).toLocaleString()} · {d.subtitle} ·{" "}
                        <span className={d.status === "PASS" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{d.status}</span>
                      </div>
                    </button>
                    <button onClick={() => { deleteDesign("slab", d.id); setOpenList(listDesigns("slab")); }}
                      aria-label={`Delete ${d.name}`} className={`rounded-md p-1.5 ${TXT_SUB} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20`}><FiTrash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className={`border-t border-[#e2e8f0] px-4 py-2 text-[11px] ${TXT_SUB} dark:border-[#1f2937]`}>Designs are kept in this browser only (up to 20).</p>
          </div>
        </div>
      )}

      {rerunError && (
        <div className="fixed bottom-4 right-4 z-[70] rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-[13px] text-red-700 shadow-lg dark:border-red-700 dark:bg-red-900/40 dark:text-red-300">
          {rerunError}
        </div>
      )}

      {reportOpen && (
        <DetailedReport
          report={rawData.report || []}
          heading="Slab — Detailed Calculation Report"
          subtitle={`${summary.slab_type || "Slab"} · ${summary.concrete_grade || ""}`}
          onClose={() => setReportOpen(false)}
          overallStatus={summary.status}
          currentThickness={summary.thickness}
          onIncreaseThickness={handleIncreaseThickness}
          isRerunning={rerunning}
        />
      )}
    </div>
  );
};

/* ================================================================== */
/*  TABS                                                              */
/* ================================================================== */
function OverviewTab({ ctx }) {
  const { summary, forces, reinf, defl, shear, compliance, cost, isPass } = ctx;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SlabSummaryCard summary={summary} />
        <DesignChecksCard compliance={compliance} summary={summary} isPass={isPass} />
        <SlabPreviewCard summary={summary} />
      </div>
      <DesignForcesCard forces={forces} shear={shear} defl={defl} className="mt-4" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReinforcementCard reinf={reinf} />
            <DeflectionShearCard defl={defl} shear={shear} />
          </div>
          <LayoutCard summary={summary} reinf={reinf} />
        </div>
        <div className="space-y-4">
          <DesignInputCard summary={summary} forces={forces} />
          <CostCard cost={cost} />
        </div>
      </div>
    </>
  );
}

function FlexuralTab({ ctx }) {
  const { summary, forces, D } = ctx;
  const rows = [
    { loc: "Midspan — Sagging", dir: "Both Directions", layer: "Bottom", r: D.sagging, prov: D.bottomAs },
    { loc: "Support — Hogging", dir: "Both Directions", layer: "Top", r: D.hogging, prov: D.topAs },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SlabSummaryCard summary={summary} />
        <div className="lg:col-span-2">
          <Card number="" title="Flexural Capacity">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.loc} className="rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] p-3">
                  <p className={`text-[12px] font-semibold ${TXT_MAIN}`}>{row.loc}</p>
                  <p className={`mb-2 text-[11px] ${TXT_SUB}`}>{row.layer} steel · {row.dir}</p>
                  <Row label="Applied M_Ed" value={`${f(row.r.M)} kNm/m`} />
                  <Row label="Capacity M_Rd" value={`${f(row.r.MRd)} kNm/m`} />
                  <Gauge label="Utilization" value={row.r.util} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <DesignForcesCard forces={forces} shear={ctx.shear} defl={ctx.defl} className="mt-4" />

      <Card number="" title="Flexural Design Calculation — EN 1992-1-1 §6.1" className="mt-4">
        <p className={`mb-3 text-[11px] ${TXT_SUB}`}>
          Rectangular section, b = 1000 mm, d = {f(D.d, 0)} mm, f<sub>ck</sub> = {D.fck} MPa, f<sub>yk</sub> = {D.fyk} MPa. A<sub>s,min</sub> = {f(D.AsMin, 0)} mm²/m, A<sub>s,max</sub> = {f(D.AsMax, 0)} mm²/m.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className={`border-b ${ROW_BORDER} text-[10px] uppercase tracking-wide ${TXT_SUB}`}>
                {["Location", "M_Ed (kNm/m)", "K", "z (mm)", "As,req", "As,prov", "Util", "Status"].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ok = row.r.util <= 1 && row.prov >= row.r.AsGov;
                return (
                  <tr key={row.loc} className={`border-b ${ROW_BORDER}`}>
                    <td className={`px-2 py-2 font-medium ${TXT_MAIN}`}>{row.loc}</td>
                    <td className={`px-2 py-2 ${TXT_SUB}`}>{f(row.r.M)}</td>
                    <td className={`px-2 py-2 ${TXT_SUB}`}>{f(row.r.K, 4)}</td>
                    <td className={`px-2 py-2 ${TXT_SUB}`}>{f(row.r.z, 1)}</td>
                    <td className={`px-2 py-2 ${TXT_SUB}`}>{f(row.r.AsGov, 0)}</td>
                    <td className={`px-2 py-2 ${TXT_MAIN}`}>{f(row.prov, 0)}</td>
                    <td className={`px-2 py-2 ${TXT_SUB}`}>{f(row.r.util)}</td>
                    <td className="px-2 py-2"><StatusPill ok={ok} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card number="" title="Bending Moment Diagram" className="mt-4">
        <MomentDiagram sagging={D.sagging.M} hogging={D.hogging.M} continuity={summary.continuity} />
      </Card>
    </>
  );
}

function ShearTab({ ctx }) {
  const { summary, forces, shear, D } = ctx;
  const ok = D.shearUtil <= 1;
  const linksNeeded = D.vEd > D.vRdc;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SlabSummaryCard summary={summary} />
        <div className="lg:col-span-2">
          <Card number="" title="Shear Check">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] p-3">
                <Row label="Design Shear V_Ed" value={`${f(D.VEd)} kN/m`} />
                <Row label="Shear Resistance V_Rd,c" value={`${f(D.VRd)} kN/m`} />
                <Gauge label="Utilization" value={D.shearUtil} />
              </div>
              <div className="rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] p-3 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  {ok ? <FiCheck className="text-green-500" /> : <FiXCircle className="text-red-500" />}
                  <span className={`text-sm font-bold ${ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{ok ? "SECTION ADEQUATE" : "SECTION INADEQUATE"}</span>
                </div>
                <p className={`mt-2 text-[12px] ${TXT_SUB}`}>
                  {linksNeeded
                    ? "v_Ed exceeds v_Rd,c — shear reinforcement required."
                    : "v_Ed ≤ v_Rd,c — no shear reinforcement required (typical for slabs)."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DesignForcesCard forces={forces} shear={shear} defl={ctx.defl} className="mt-4" />

      <Card number="" title="Shear Capacity Derivation — EN 1992-1-1 §6.2.2" className="mt-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
          <CalcRow label="Effective depth, d" value={`${f(D.d, 0)} mm`} />
          <CalcRow label="Depth factor, k = 1 + √(200/d) ≤ 2" value={f(D.k, 3)} />
          <CalcRow label="Tension steel ratio, ρ_l ≤ 0.02" value={f(D.rhoL, 4)} />
          <CalcRow label="C_Rd,c = 0.18 / γc" value={f(D.CRdc, 3)} />
          <CalcRow label="v_min = 0.035 k^1.5 √f_ck" value={`${f(D.vMin, 3)} MPa`} />
          <CalcRow label="v_Rd,c = C_Rd,c·k·(100 ρ_l f_ck)^⅓" value={`${f(D.vRdc, 3)} MPa`} />
          <CalcRow label="Design shear stress, v_Ed" value={`${f(D.vEd, 3)} MPa`} />
          <CalcRow label="V_Rd,c = v_Rd,c · b · d" value={`${f(D.VRdcDerived, 2)} kN/m`} />
        </div>
      </Card>

      <Card number="" title="Shear Force Diagram" className="mt-4">
        <ShearDiagram v={D.VEd} />
      </Card>
    </>
  );
}

function DeflectionTab({ ctx }) {
  const { summary, forces, defl, shear, D } = ctx;
  const ok = D.deflUtil <= 1;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SlabSummaryCard summary={summary} />
        <div className="lg:col-span-2">
          <Card number="" title="Deflection Check">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] p-3">
                <Row label="Actual deflection" value={`${f(D.actualDefl, 2)} mm`} />
                <Row label="Allowable (span/250)" value={`${f(D.allowDefl, 2)} mm`} />
                <Gauge label="δ utilization" value={D.allowDefl ? D.actualDefl / D.allowDefl : 0} />
              </div>
              <div className="rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] p-3">
                <Row label="Actual L/d" value={f(D.actualLd, 1)} />
                <Row label="Allowable L/d" value={f(D.allowLd, 1)} />
                <Gauge label="L/d utilization" value={D.deflUtil} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {ok ? <FiCheck className="text-green-500" /> : <FiXCircle className="text-red-500" />}
              <span className={`text-sm font-bold ${ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{ok ? "PASS" : "FAIL"}</span>
            </div>
          </Card>
        </div>
      </div>

      <DesignForcesCard forces={forces} shear={shear} defl={defl} className="mt-4" />

      <Card number="" title="Span / Effective-Depth Method — EN 1992-1-1 §7.4.2" className="mt-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
          <CalcRow label="Reference ratio, ρ₀ = √f_ck × 10⁻³" value={f(D.rho0, 4)} />
          <CalcRow label="Required tension ratio, ρ" value={f(D.rho, 4)} />
          <CalcRow label="Structural system factor, K" value={f(D.Kdef, 2)} />
          <CalcRow label="Basic limit, (L/d)_basic" value={f(D.basicLd, 1)} />
          <CalcRow label="Steel-stress factor, A_s,prov/A_s,req ≤ 1.5" value={f(D.steelFactor, 2)} />
          <CalcRow label="Allowable, (L/d)_allow" value={f(D.allowLd, 1)} />
          <CalcRow label="Actual, L/d = L_short/d" value={f(D.actualLd, 1)} />
          <CalcRow label="Short span used" value={`${f(D.Lshort, 0)} mm`} />
        </div>
      </Card>

      <Card number="" title="Deflected Shape" className="mt-4">
        <DeflectionDiagram defl={D.actualDefl} span={D.Lshort / 1000} />
      </Card>
    </>
  );
}

function ReinforcementTab({ ctx }) {
  const { summary, forces, reinf, D } = ctx;
  const checks = [
    ["Min. area (A_s,min)", `${f(D.AsMin, 0)} mm²/m`, D.bottomAs >= D.AsMin],
    ["Max. area (A_s,max)", `${f(D.AsMax, 0)} mm²/m`, D.bottomAs <= D.AsMax],
    ["Max. spacing (3h ≤ 400 mm)", `${Math.min(3 * D.h, 400)} mm`, (Number(reinf.bottom_steel?.spacing) || 0) <= Math.min(3 * D.h, 400)],
    ["Required A_s (sagging)", `${f(D.sagging.AsGov, 0)} mm²/m`, D.bottomAs >= D.sagging.AsGov],
    ["Required A_s (hogging)", `${f(D.hogging.AsGov, 0)} mm²/m`, D.topAs >= D.hogging.AsGov],
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SlabSummaryCard summary={summary} />
        <div className="lg:col-span-2 space-y-4">
          <ReinforcementCard reinf={reinf} />
          <Card number="" title="Detailing & Adequacy Checks">
            <div className="space-y-2">
              {checks.map(([label, val, ok]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className={`text-[13px] ${TXT_SUB}`}>{label}</span>
                  <span className="flex items-center gap-2">
                    <span className={`text-[12px] ${TXT_MAIN}`}>{val}</span>
                    <StatusPill ok={ok} />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LayoutCard summary={summary} reinf={reinf} />
        </div>
        <DesignInputCard summary={summary} forces={forces} />
      </div>
    </>
  );
}

/* ================================================================== */
/*  REUSABLE CARDS                                                    */
/* ================================================================== */
function SlabSummaryCard({ summary }) {
  return (
    <Card number="1" title="Slab Summary">
      <Row label="Slab Type" value={summary.slab_type || "N/A"} />
      <Row label="Continuity" value={summary.continuity || "N/A"} />
      <Row label={/two/i.test(summary.slab_type || "") ? "Span Lx" : "Span (L)"} value={`${summary.span_lx ?? 0} m`} />
      {/two/i.test(summary.slab_type || "") && summary.span_ly ? <Row label="Span Ly" value={`${summary.span_ly} m`} /> : null}
      <Row label="Thickness" value={`${summary.thickness ?? 0} mm`} />
      <Row label="Effective Depth" value={`${summary.effective_depth ?? 0} mm`} />
      <Row label="Concrete" value={summary.concrete_grade || "N/A"} />
      <Row label="Steel" value={summary.steel_grade || "N/A"} />
    </Card>
  );
}

function DesignChecksCard({ compliance, summary, isPass }) {
  const icon = (s) => (s === "FAIL" ? <FiXCircle className="text-red-500" /> : s === "WARNING" ? <FiAlertTriangle className="text-yellow-500" /> : <FiCheck className="text-green-500" />);
  return (
    <Card number="2" title="Design Check Summary">
      <div className="space-y-2">
        {compliance.length ? compliance.map((c, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className={`flex items-center gap-2 text-[13px] ${TXT_SUB}`}>{icon(c.status)} {c.check}</span>
            <span className="flex items-center gap-2">
              <span className={`text-[11px] ${TXT_SUB}`}>{c.ratio?.toFixed(2)}/{c.limit?.toFixed(1)}</span>
              <span className={`text-[11px] font-bold ${c.status === "PASS" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{c.status}</span>
            </span>
          </div>
        )) : <p className={`text-sm ${TXT_SUB}`}>No compliance data available</p>}
      </div>
      <div className={`mt-4 rounded-lg border p-4 text-center ${isPass ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"}`}>
        <div className={`mb-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${isPass ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}><FiShield size={14} /> Overall Design Status</div>
        <div className={`text-2xl font-bold ${isPass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{isPass ? "SAFE" : "REVIEW"}</div>
        <p className={`mt-0.5 text-[11px] ${isPass ? "text-green-700 dark:text-green-500" : "text-red-700 dark:text-red-500"}`}>
          {isPass ? "All design checks are satisfied." : "One or more checks require review."}
          {summary.utilization_ratio != null && ` • Utilization ${summary.utilization_ratio.toFixed(2)}`}
        </p>
      </div>
    </Card>
  );
}

function SlabPreviewCard({ summary }) {
  return (
    <Card number="3" title="Slab Preview">
      <SlabPreview3D lx={summary.span_lx} ly={summary.span_ly} t={summary.thickness} twoWay={/two/i.test(summary.slab_type || "")} />
      <p className={`mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide ${TXT_SUB}`}>Section View (Along Span Lx)</p>
      <SectionView span={summary.span_lx} t={summary.thickness} />
    </Card>
  );
}

function DesignForcesCard({ forces, shear, defl, className = "" }) {
  return (
    <Card number="4" title="Design Forces" className={className}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
        <div>
          <MiniHead>Loads</MiniHead>
          <Row label="Ultimate Load" value={`${num(forces.ultimate_load)} kN/m²`} />
          <Row label="Service Load" value={`${num(forces.service_load)} kN/m²`} />
        </div>
        <div>
          <MiniHead>Moment &amp; Shear (Factored)</MiniHead>
          <Row label="Max Sagging Moment" value={`${num(forces.max_sagging_moment)} kNm/m`} />
          <Row label="Max Hogging Moment" value={`${num(forces.max_hogging_moment)} kNm/m`} />
          <Row label="Max Shear Force" value={`${num(forces.max_shear_force)} kN/m`} />
        </div>
        <div>
          <MiniHead>Capacity</MiniHead>
          <Row label="Shear Resistance" value={`${num(shear.shear_resistance)} kN/m`} />
          <Row label="Allowable Deflection" value={`${num(defl.allowable_deflection, 1)} mm`} />
        </div>
      </div>
    </Card>
  );
}

function ReinforcementCard({ reinf }) {
  const b = reinf.bottom_steel || {}, t = reinf.top_steel || {};
  const rows = [["Bottom Steel", b], ["Top Steel", t]];
  return (
    <Card number="5" title="Reinforcement Design">
      <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#1f2937]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
              {["Location", "Bar", "Spacing", "Area (mm²/m)"].map((h) => <th key={h} className="px-2.5 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, s]) => (
              <tr key={name} className={`border-t ${ROW_BORDER} text-[12px] ${TXT_SUB}`}>
                <td className={`px-2.5 py-2 font-medium ${TXT_MAIN}`}>{name}<span className={`block text-[10px] ${TXT_SUB}`}>{s.direction || ""}</span></td>
                <td className="px-2.5 py-2">Y{s.bar_diameter ?? "?"}</td>
                <td className="px-2.5 py-2">{s.spacing ?? "?"} mm c/c</td>
                <td className="px-2.5 py-2">{s.area_provided ?? "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DeflectionShearCard({ defl, shear }) {
  const icon = (s) => (s === "PASS" || !s ? <FiCheck className="text-green-500" /> : <FiXCircle className="text-red-500" />);
  return (
    <Card number="6" title="Deflection & Shear">
      <MiniHead>Deflection Check</MiniHead>
      <Row label="Actual" value={`${num(defl.actual_deflection, 1)} mm`} />
      <Row label="Allowable" value={`${num(defl.allowable_deflection, 1)} mm`} />
      <div className="mt-1.5 flex items-center gap-2">{icon(defl.status)}<span className={`text-sm font-bold ${defl.status === "PASS" || !defl.status ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{defl.status || "PASS"}</span></div>
      <div className="mt-3">
        <MiniHead>Shear Check</MiniHead>
        <Row label="Design Shear" value={`${num(shear.design_shear)} kN/m`} />
        <Row label="Resistance" value={`${num(shear.shear_resistance)} kN/m`} />
        <div className="mt-1.5 flex items-center gap-2">{icon(shear.status)}<span className={`text-sm font-bold ${shear.status === "PASS" || !shear.status ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>{shear.status || "PASS"}</span></div>
      </div>
    </Card>
  );
}

function LayoutCard({ summary, reinf }) {
  const t = reinf.top_steel || {}, b = reinf.bottom_steel || {};
  return (
    <Card number="7" title="Reinforcement Layout">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className={`mb-1 text-center text-[11px] font-semibold uppercase tracking-wide ${TXT_SUB}`}>Top Reinforcement (Negative)</p>
          <RebarLayout position="top" dia={t.bar_diameter} spacing={t.spacing} span={summary.span_lx} t={summary.thickness} />
        </div>
        <div>
          <p className={`mb-1 text-center text-[11px] font-semibold uppercase tracking-wide ${TXT_SUB}`}>Bottom Reinforcement (Positive)</p>
          <RebarLayout position="bottom" dia={b.bar_diameter} spacing={b.spacing} span={summary.span_lx} t={summary.thickness} />
        </div>
      </div>

      <div className="mt-6 border-t border-[#f1f5f9] pt-4 dark:border-[#1f2937]">
        <p className={`mb-1 text-center text-[11px] font-semibold uppercase tracking-wide ${TXT_SUB}`}>
          Section Through Slab &mdash; Bar Arrangement
        </p>
        <RebarSection summary={summary} top={t} bottom={b} />
      </div>
    </Card>
  );
}

function DesignInputCard({ summary, forces }) {
  return (
    <Card number="8" title="Design Input Summary">
      <Row label="Slab Type" value={summary.slab_type || "N/A"} />
      <Row label="Continuity" value={summary.continuity || "N/A"} />
      <Row label={/two/i.test(summary.slab_type || "") ? "Span Lx" : "Span (L)"} value={`${summary.span_lx ?? 0} m`} />
      {/two/i.test(summary.slab_type || "") && summary.span_ly ? <Row label="Span Ly" value={`${summary.span_ly} m`} /> : null}
      <Row label="Thickness" value={`${summary.thickness ?? 0} mm`} />
      <Row label="Effective Depth" value={`${summary.effective_depth ?? 0} mm`} />
      <Row label="Concrete Grade" value={summary.concrete_grade || "N/A"} />
      <Row label="Steel Grade" value={summary.steel_grade || "N/A"} />
      <Row label="Ultimate Load" value={`${num(forces.ultimate_load)} kN/m²`} />
      <Row label="Design Code" value="EN 1992-1-1 (EC2)" />
      <Row label="Analysis Method" value="Limit State Method" />
    </Card>
  );
}

function CostCard({ cost }) {
  return (
    <Card number="9" title="Cost Summary">
      <Row label="Concrete" value={`₦${fmtCur(cost.concrete?.cost)}`} />
      <Row label="Steel" value={`₦${fmtCur(cost.steel?.cost)}`} />
      <Row label="Formwork" value={`₦${fmtCur(cost.formwork?.cost)}`} />
      <Row label="Total Cost" value={`₦${fmtCur(cost.total)}`} bold />
      <Row label="Per m²" value={`₦${fmtCur(cost.total_per_sqm)}`} />
    </Card>
  );
}

/* ================================================================== */
/*  PRIMITIVES                                                        */
/* ================================================================== */
function Card({ number, title, children, className = "" }) {
  return (
    <section className={`${CARD} ${className}`}>
      <header className="flex items-center gap-1.5 px-5 pt-4 pb-3">
        <h3 className={`text-[11px] font-bold uppercase tracking-wide ${ACCENT}`}>{number ? `${number}. ` : ""}{title}</h3>
        <FiInfo className="text-[#cbd5e1] dark:text-[#475569]" size={12} />
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between border-b ${ROW_BORDER} py-1.5 last:border-0`}>
      <span className={`text-[13px] ${TXT_SUB}`}>{label}</span>
      <span className={`text-[13px] ${bold ? "font-bold" : "font-medium"} ${TXT_MAIN}`}>{value}</span>
    </div>
  );
}

function CalcRow({ label, value }) {
  return (
    <div className={`flex items-center justify-between border-b ${ROW_BORDER} py-1.5`}>
      <span className={`text-[12px] ${TXT_SUB}`}>{label}</span>
      <span className={`text-[12px] font-medium ${TXT_MAIN}`}>{value}</span>
    </div>
  );
}

function MiniHead({ children }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-[#64748b]">{children}</p>;
}

function StatusPill({ ok }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}

function Gauge({ label, value = 0 }) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const bar = value <= 0.85 ? "bg-green-500" : value <= 1 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-[11px] ${TXT_SUB}`}>{label}</span>
        <span className={`text-[11px] font-bold ${TXT_MAIN}`}>{f(value)}</span>
      </div>
      <div className="pdf-keep-color pdf-bar-track h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0] dark:bg-[#1f2937]">
        <div className={`pdf-keep-color h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TopBtn({ icon, label, onClick }) {
  const Icon = icon;
  return (
    <button onClick={onClick} className={`hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium ${TXT_SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}>
      <Icon size={15} /> {label}
    </button>
  );
}

function OutlineBtn({ icon, label }) {
  const Icon = icon;
  return (
    <button className={`flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] bg-white dark:bg-[#0f172a] px-3 py-1.5 text-[13px] font-medium ${TXT_MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]`}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ================================================================== */
/*  DIAGRAMS  (parametric, currentColor → dark-mode aware)            */
/* ================================================================== */
function MomentDiagram({ sagging = 0, hogging = 0, continuity = "" }) {
  const peak = Math.max(Math.abs(sagging), Math.abs(hogging), 1);
  const x0 = 50, x1 = 470, base = 95;
  const scale = 55 / peak;
  const sag = sagging * scale;
  const dipPx = Math.min(2 * sag, 46);

  const c = String(continuity || "").toLowerCase().replace(/\s+/g, "_");
  const isCantilever = c.includes("cantilever");
  const isOneEnd = c.includes("one_end") || c.includes("one end");
  const isBothEnds = c.includes("both_end") || c.includes("both end");

  let hogA = hogging, hogB = hogging;
  let labelA = "A", labelB = "B";
  if (isOneEnd) {
    hogA = 0;
    hogB = hogging;
    labelA = "Simple";
    labelB = "Continuous";
  } else if (isCantilever) {
    hogA = 0;
    hogB = hogging;
    labelA = "Free End";
    labelB = "Fixed End";
  } else if (isBothEnds) {
    labelA = "Continuous";
    labelB = "Continuous";
  }

  const hA = hogA * scale;
  const hB = hogB * scale;

  const labelFor = (v) => (v > 0 ? `-${f(v)}` : f(v));
  const hogLabelA = labelFor(hogA);
  const hogLabelB = labelFor(hogB);

  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 580 190" className="w-full">
        <line x1={x0} y1={base} x2={x1} y2={base} stroke="currentColor" strokeWidth="1" />
        <path
          d={`M${x0},${base} L${x0},${base - hA} Q${(x0 + x1) / 2},${base + dipPx} ${x1},${base - hB} L${x1},${base} Z`}
          fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.6"
        />
        <text x={x0} y={base - hA - 6} fontSize="10" fill="#ef4444" textAnchor="middle">{hogLabelA}</text>
        <text x={x1} y={base - hB - 6} fontSize="10" fill="#ef4444" textAnchor="middle">{hogLabelB}</text>
        {!isCantilever && (
          <text x={(x0 + x1) / 2} y={base + dipPx + 16} fontSize="10" fill="#0ea5e9" textAnchor="middle">+{f(sagging)}</text>
        )}
        <text x={x0 - 6} y={base + 14} fontSize="9" fill="currentColor" textAnchor="end">{labelA}</text>
        <text x={x1 + 6} y={base + 14} fontSize="9" fill="currentColor" textAnchor="start">{labelB}</text>
        <text x={(x0 + x1) / 2} y={182} fontSize="9" fill="currentColor" fillOpacity="0.7" textAnchor="middle">Bending Moment (kNm/m)</text>
      </svg>
      {(isOneEnd || isCantilever) && (
        <p className="mt-1 text-[10px] italic text-[#94a3b8] dark:text-[#64748b]">
          Left/right placement of the {isCantilever ? "fixed end" : "continuous end"} is a display convention, the engine doesn't track physical orientation, only the magnitude.
        </p>
      )}
    </div>
  );
}

function ShearDiagram({ v = 0 }) {
  const x0 = 50, x1 = 470, base = 90, h = 50;
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 520 170" className="w-full">
        <line x1={x0} y1={base} x2={x1} y2={base} stroke="currentColor" strokeWidth="1" />
        <polygon points={`${x0},${base} ${x0},${base - h} ${(x0 + x1) / 2},${base}`} fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.4" />
        <polygon points={`${(x0 + x1) / 2},${base} ${x1},${base + h} ${x1},${base}`} fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.4" />
        <text x={x0} y={base - h - 6} fontSize="10" fill="#10b981" textAnchor="middle">+{f(v)}</text>
        <text x={x1} y={base + h + 14} fontSize="10" fill="#10b981" textAnchor="middle">-{f(v)}</text>
        <text x={(x0 + x1) / 2} y={base + 60} fontSize="9" fill="currentColor" fillOpacity="0.7" textAnchor="middle">Shear Force (kN/m)</text>
      </svg>
    </div>
  );
}

function DeflectionDiagram({ defl = 0, span = 0 }) {
  const x0 = 50, x1 = 470, top = 50, drop = 45;
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 520 150" className="w-full">
        <line x1={x0} y1={top} x2={x1} y2={top} stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
        <path d={`M${x0},${top} Q${(x0 + x1) / 2},${top + drop * 2} ${x1},${top}`} fill="none" stroke="#6366f1" strokeWidth="2" />
        <line x1={(x0 + x1) / 2} y1={top} x2={(x0 + x1) / 2} y2={top + drop} stroke="currentColor" strokeWidth="1" />
        <text x={(x0 + x1) / 2 + 6} y={top + drop / 2} fontSize="10" fill="#6366f1">δ = {f(defl, 2)} mm</text>
        <text x={(x0 + x1) / 2} y={top + drop * 2 + 18} fontSize="9" fill="currentColor" fillOpacity="0.7" textAnchor="middle">Deflected shape · L = {f(span, 1)} m</text>
      </svg>
    </div>
  );
}

function SlabPreview3D({ lx, ly, t, twoWay: twoWayProp }) {
  const Lx = Number(lx) || 0, Ly = Number(ly) || 0;
  const twoWay = twoWayProp !== undefined ? twoWayProp : Ly > 0;
  const ratio = twoWay ? Math.min(Math.max(Ly / (Lx || 1), 0.35), 1.1) : 0.4;
  const dx = Math.round(ratio * 60), dy = Math.round(dx * 0.6);
  const x0 = 55, x1 = 280, yTop = 95, th = 26, yBot = yTop + th;
  const topF = `${x0},${yTop} ${x1},${yTop} ${x1 + dx},${yTop - dy} ${x0 + dx},${yTop - dy}`;
  const frontF = `${x0},${yTop} ${x1},${yTop} ${x1},${yBot} ${x0},${yBot}`;
  const rightF = `${x1},${yTop} ${x1 + dx},${yTop - dy} ${x1 + dx},${yBot - dy} ${x1},${yBot}`;
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 360 165" className="w-full">
        <defs><marker id="arP" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor" /></marker></defs>
        <polygon points={topF} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.1" />
        <polygon points={frontF} fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.1" />
        <polygon points={rightF} fill="currentColor" fillOpacity="0.42" stroke="currentColor" strokeWidth="1.1" />
        <line x1={x0 - 12} y1={yTop} x2={x0 - 12} y2={yBot} stroke="currentColor" strokeWidth="1" markerStart="url(#arP)" markerEnd="url(#arP)" />
        <text x={x0 - 16} y={(yTop + yBot) / 2 + 3} fontSize="9" fill="currentColor" textAnchor="end">{t || 0} mm</text>
        <line x1={x0} y1={yBot + 16} x2={x1} y2={yBot + 16} stroke="currentColor" strokeWidth="1" markerStart="url(#arP)" markerEnd="url(#arP)" />
        <text x={(x0 + x1) / 2} y={yBot + 12} fontSize="9" fill="currentColor" textAnchor="middle">{Lx} m</text>
        <text x={(x0 + x1) / 2} y={yBot + 30} fontSize="8" fill="currentColor" fillOpacity="0.7" textAnchor="middle">Lx (Span)</text>
        {twoWay && (<>
          <line x1={x1 + 6} y1={yBot + 2} x2={x1 + dx + 6} y2={yBot - dy + 2} stroke="currentColor" strokeWidth="1" markerStart="url(#arP)" markerEnd="url(#arP)" />
          <text x={x1 + dx + 12} y={yBot - dy / 2 + 4} fontSize="8" fill="currentColor" textAnchor="start">{Ly} m (Ly)</text>
        </>)}
      </svg>
    </div>
  );
}

function SectionView({ span, t }) {
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 360 116" className="w-full">
        <defs>
          <marker id="arS" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor" /></marker>
          <pattern id="hatchS" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.8" /></pattern>
        </defs>
        <rect x="45" y="34" width="270" height="24" fill="url(#hatchS)" stroke="currentColor" strokeWidth="1.1" />
        <path d="M45,58 l-7,11 l14,0 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
        <path d="M315,58 l-7,11 l14,0 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
        <line x1="31" y1="69" x2="59" y2="69" stroke="currentColor" strokeWidth="1" />
        <line x1="301" y1="69" x2="329" y2="69" stroke="currentColor" strokeWidth="1" />
        <line x1="34" y1="34" x2="34" y2="58" stroke="currentColor" strokeWidth="1" markerStart="url(#arS)" markerEnd="url(#arS)" />
        <text x="30" y="49" fontSize="9" fill="currentColor" textAnchor="end">{t || 0} mm</text>
        <line x1="45" y1="90" x2="315" y2="90" stroke="currentColor" strokeWidth="1" markerStart="url(#arS)" markerEnd="url(#arS)" />
        <text x="180" y="86" fontSize="9" fill="currentColor" textAnchor="middle">{Number(span) || 0} m</text>
        <text x="180" y="104" fontSize="8" fill="currentColor" fillOpacity="0.7" textAnchor="middle">Lx (Span)</text>
      </svg>
    </div>
  );
}

function RebarSection({ summary = {}, top = {}, bottom = {} }) {
  const h = Number(summary.thickness) || 150;          // mm
  const d = Number(summary.effective_depth) || 0;      // mm
  const botDia = Number(bottom.bar_diameter) || 10;
  const topDia = Number(top.bar_diameter) || botDia;
  const botSp = Number(bottom.spacing) || 150;
  const topSp = Number(top.spacing) || botSp;

  // Prefer the cover the engine actually used; fall back to c = h - d - phi/2
  // only when the backend hasn't supplied it.
  const coverFromBackend = Number(summary.clear_cover);
  const coverDerived = d ? Math.max(Math.round(h - d - botDia / 2), 10) : 25;
  const cover = Number.isFinite(coverFromBackend) && coverFromBackend > 0 ? coverFromBackend : coverDerived;
  const coverIsDerived = !(Number.isFinite(coverFromBackend) && coverFromBackend > 0);

  // drawing frame
  const X0 = 55, X1 = 395, Y0 = 34;
  const H = 96;                                        // slab depth on screen
  const Y1 = Y0 + H;
  const mm2px = H / h;                                 // vertical scale
  const cPx = Math.min(Math.max(cover * mm2px, 7), 20);

  // TRUE bar count across the 1 m strip (no clamping) — radius adapts so the
  // drawing stays legible even at tight spacings.
  const inner = X1 - X0 - 52;
  const nBot = Math.max(Math.round(1000 / botSp) + 1, 2);
  const nTop = Math.max(Math.round(1000 / topSp) + 1, 2);
  const gapBot = inner / (nBot - 1 || 1);
  const gapTop = inner / (nTop - 1 || 1);
  const rBot = Math.min(Math.max(botDia * mm2px * 0.9, 2.0), 7, gapBot * 0.38);
  const rTop = Math.min(Math.max(topDia * mm2px * 0.9, 1.8), 6.5, gapTop * 0.38);
  const yBot = Y1 - cPx - rBot;
  const yTop = Y0 + cPx + rTop;
  const xs = (n) => Array.from({ length: n }, (_, i) => X0 + 26 + (i * inner) / (n - 1 || 1));
  const botXs = xs(nBot), topXs = xs(nTop);

  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 460 208" className="w-full">
        <defs>
          <marker id="arSec" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
          </marker>
          <pattern id="hatchSec" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.45" />
          </pattern>
        </defs>

        {/* concrete section */}
        <rect x={X0} y={Y0} width={X1 - X0} height={H} fill="url(#hatchSec)" stroke="currentColor" strokeWidth="1.3" />

        {/* effective depth line */}
        <line x1={X0 + 12} y1={Y0} x2={X0 + 12} y2={yBot} stroke="currentColor" strokeWidth="0.9"
              strokeDasharray="3 2" markerStart="url(#arSec)" markerEnd="url(#arSec)" />
        <text x={X0 + 17} y={(Y0 + yBot) / 2 + 3} fontSize="8.5" fill="currentColor">d = {d ? Math.round(d) : "—"} mm</text>

        {/* overall thickness */}
        <line x1={X0 - 16} y1={Y0} x2={X0 - 16} y2={Y1} stroke="currentColor" strokeWidth="1"
              markerStart="url(#arSec)" markerEnd="url(#arSec)" />
        <text x={X0 - 20} y={(Y0 + Y1) / 2 + 3} fontSize="9" fill="currentColor" textAnchor="end">h = {h} mm</text>

        {/* cover call-outs */}
        <line x1={X1 + 14} y1={Y1} x2={X1 + 14} y2={yBot} stroke="#ef4444" strokeWidth="0.9"
              markerStart="url(#arSec)" markerEnd="url(#arSec)" />
        <text x={X1 + 18} y={(Y1 + yBot) / 2 + 3} fontSize="8" fill="#ef4444">c = {cover} mm</text>

        {/* bottom bars (tension) */}
        {botXs.map((x, i) => <circle key={`b${i}`} cx={x} cy={yBot} r={rBot} fill="#ef4444" />)}
        {/* top bars */}
        {topXs.map((x, i) => <circle key={`t${i}`} cx={x} cy={yTop} r={rTop} fill="#0A2F44" className="dark:fill-[#66a4c2]" />)}

        {/* spacing dimension between two bottom bars */}
        {botXs.length > 1 && (
          <>
            <line x1={botXs[0]} y1={Y1 + 14} x2={botXs[1]} y2={Y1 + 14} stroke="#ef4444" strokeWidth="0.9"
                  markerStart="url(#arSec)" markerEnd="url(#arSec)" />
            <text x={(botXs[0] + botXs[1]) / 2} y={Y1 + 11} fontSize="8" fill="#ef4444" textAnchor="middle">{botSp}</text>
          </>
        )}

        {/* labels */}
        <text x={X0 + 26} y={yTop - rTop - 6} fontSize="9" fill="currentColor" fontWeight="600">
          Top: Y{topDia} @ {topSp} mm c/c
        </text>
        <text x={X0 + 26} y={Y1 + 30} fontSize="9" fill="#ef4444" fontWeight="600">
          Bottom: Y{botDia} @ {botSp} mm c/c
        </text>

        {/* strip width note */}
        <line x1={X0} y1={Y1 + 44} x2={X1} y2={Y1 + 44} stroke="currentColor" strokeWidth="1"
              markerStart="url(#arSec)" markerEnd="url(#arSec)" />
        <text x={(X0 + X1) / 2} y={Y1 + 41} fontSize="8.5" fill="currentColor" textAnchor="middle">1000 mm design strip</text>
        <text x={(X0 + X1) / 2} y={Y1 + 57} fontSize="8" fill="currentColor" fillOpacity="0.7" textAnchor="middle">
          Section perpendicular to the main span &middot; {nBot} bars per metre bottom, {nTop} top
          {coverIsDerived ? " \u00b7 cover derived from d" : ""}
        </text>
      </svg>
    </div>
  );
}

function RebarLayout({ position = "top", dia, spacing, span, t }) {
  const barY = position === "top" ? 44 : 58, hook = position === "top" ? 7 : -7;
  const spanMm = (Number(span) || 0) * 1000;
  let count = spacing ? Math.floor(spanMm / Number(spacing)) : 9;
  count = Math.min(Math.max(count, 6), 13);
  const x0 = 40, x1 = 280;
  const ticks = Array.from({ length: count }, (_, i) => x0 + (i * (x1 - x0)) / (count - 1));
  const mid = `arR${position}`;
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 320 116" className="w-full">
        <defs><marker id={mid} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor" /></marker></defs>
        <rect x="32" y="34" width="256" height="30" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.1" />
        <line x1={x0} y1={barY} x2={x1} y2={barY} stroke="#ef4444" strokeWidth="2" />
        <line x1={x0} y1={barY} x2={x0} y2={barY + hook} stroke="#ef4444" strokeWidth="2" />
        <line x1={x1} y1={barY} x2={x1} y2={barY + hook} stroke="#ef4444" strokeWidth="2" />
        {ticks.map((x, i) => <circle key={i} cx={x} cy={barY} r="2.1" fill="#ef4444" />)}
        <line x1="24" y1="34" x2="24" y2="64" stroke="currentColor" strokeWidth="1" markerStart={`url(#${mid})`} markerEnd={`url(#${mid})`} />
        <text x="20" y="52" fontSize="8" fill="currentColor" textAnchor="end">{t || 0} mm</text>
        <line x1="32" y1="84" x2="288" y2="84" stroke="currentColor" strokeWidth="1" markerStart={`url(#${mid})`} markerEnd={`url(#${mid})`} />
        <text x="160" y="80" fontSize="8" fill="currentColor" textAnchor="middle">{Number(span) || 0} m — Lx</text>
        <text x="160" y="102" fontSize="9" fill="#ef4444" textAnchor="middle" fontWeight="600">Y{dia ?? "?"} @ {spacing ?? "?"} mm c/c</text>
      </svg>
    </div>
  );
}

export default StructuralResults;