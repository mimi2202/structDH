import React, { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiDownload, FiChevronRight } from "react-icons/fi";
import { exportElementToPdf } from "../utils/exportPdf";
import BeamReportModal from "../components/beam/BeamReportModal";
import { useDesignMeta } from "../contexts/DesignMetaContext";

const DIM = "var(--dim)";
const DIM_WRAP = "text-[#475569] dark:text-[#94a3b8] [--dim:#0A2F44] dark:[--dim:#66a4c2]";
const CARD = "rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937]";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const ACCENT = "text-[#0A2F44] dark:text-[#66a4c2]";
const HEAD = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const RED = "#ef4444";
const GREEN = "#16a34a";

const f = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : "\u2014");
const isPass = (s) => s === "PASS" || s === "OK";

const TABS = ["Overview", "Flexural Design", "Shear Design", "Deflection"];

export default function BeamResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state?.designResult;
  const sheetRef = useRef(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState("Overview");
  const { setDesignMeta } = useDesignMeta();

  useEffect(() => {
    if (!data?.summary) return;
    setDesignMeta({
      designCode: data.summary.design_code,
      analysisMethod: data.summary.analysis,
      concreteGrade: data.summary.concrete_grade,
      steelGrade: data.summary.steel_grade,
    });
    return () => setDesignMeta(null);
  }, [data, setDesignMeta]);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className={`${CARD} p-8 text-center max-w-md`}>
          <p className={`mb-4 ${MAIN}`}>No beam results. Run a beam design first.</p>
          <button onClick={() => navigate("/beam")} className="rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
            Back to Input
          </button>
        </div>
      </div>
    );
  }

  const { summary, materials, loads, forces, capacity, reinforcement, sls, notes, report,
          flexure_detail: fd, shear_detail: shd, deflection_detail: dd } = data;
  const pass = isPass(summary.status);
  const r = reinforcement;
  const codeShort = (summary.design_code || "").includes("1992") || (summary.design_code || "").includes("EC2") ? "EC2" : summary.design_code;
  const bw = summary.width;
  const d_eff = summary.effective_depth;
  const ctx = { summary, materials, loads, forces, capacity, reinforcement, sls, notes, report, fd, shd, dd, pass, r, codeShort, bw, d_eff, sheetRef, setReportOpen, reportOpen, navigate };

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] pb-10">
      <div ref={sheetRef} className="px-6 pt-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#0A2F44] dark:text-[#66a4c2] uppercase tracking-tight">
              Simply Supported Beam Output ({codeShort})
            </h1>
            <p className={`text-sm ${SUB}`}>{summary.beam_id} {"\u00b7"} Design Code: {summary.design_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-[#0A2F44] dark:border-[#66a4c2] px-3 py-1.5 text-[12px] font-medium text-[#0A2F44] dark:text-[#66a4c2] hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a]">
              <FiFileText size={14} /> Detailed Report (PDF)
            </button>
            <button onClick={() => exportElementToPdf(sheetRef.current, `Beam-${summary.beam_id || "report"}`)} className="flex items-center gap-1.5 rounded-lg bg-[#0A2F44] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#082636]">
              <FiDownload size={14} /> Download Report
            </button>
          </div>
        </div>

        <div className={`${CARD} mb-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-x divide-[#e2e8f0] dark:divide-[#334155]`}>
          <Strip label="Beam ID" value={summary.beam_id} />
          <Strip label="Support Condition" value={summary.support_condition} />
          <Strip label="Span (L)" value={`${summary.span} mm`} />
          <Strip label="Section" value={`${summary.width} x ${summary.depth}`} />
          <Strip label="Concrete" value={summary.concrete_grade} />
          <Strip label="Reinforcement" value={summary.steel_grade} />
          <Strip label="Analysis" value={summary.analysis} />
          <Strip label="Units" value="kN, mm" />
        </div>

        {/* TABS -- Overview below is completely untouched from before; these
            are ADDITIONAL views only, not a replacement or reorganization. */}
        <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[#e2e8f0] dark:border-[#334155]">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                tab === t ? "border-[#0A2F44] dark:border-[#66a4c2] text-[#0A2F44] dark:text-[#66a4c2]"
                          : `border-transparent ${SUB} hover:text-[#0F172A] dark:hover:text-white`}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            <Card n="1" title="Geometry">
              <div className="flex flex-col items-center gap-5">
                <ElevationSVG span={summary.span} />
                <CrossSectionSVG width={summary.width} depth={summary.depth} rein={r} />
              </div>
              <p className={`mt-2 text-center text-[11px] ${SUB}`}>All dimensions in mm</p>
            </Card>

            <Card n="2" title="Loading Diagram (Characteristic)">
              <LoadingSVG span={summary.span} wk={loads.total_service} />
              <p className={`mt-1 text-center text-[11px] ${SUB}`}>(Includes self weight)</p>
            </Card>

            <Card n="3" title="Materials">
              <Table
                head={["Material", "Grade", "Design Value"]}
                rows={[
                  ["Concrete", summary.concrete_grade, `f_ck = ${f(materials.fck, 0)} MPa,  f_cd = ${f(materials.fcd, 1)} MPa`],
                  ["Reinforcement", summary.steel_grade, `f_yk = ${f(materials.fyk, 0)} MPa,  f_yd = ${f(materials.fyd, 0)} MPa`],
                  ["Modular Ratio (n)", "-", f(materials.modular_ratio, 1)],
                  ["Unit Weight of Concrete (\u03b3c)", "-", `${f(materials.unit_weight_concrete, 1)} kN/m\u00b3`],
                ]}
              />
            </Card>

            <Card n="4" title="Load Summary (Characteristic)">
              <LoadTable loads={loads} />
            </Card>

            <Card n="5" title="Design Situations (ULS)">
              <Table
                head={["Situation", "Action Combination (EN 1990)", "Design UDL, w_d (kN/m)"]}
                rows={[["Persistent / Transient", forces.ultimate_combo, f(forces.design_udl)]]}
              />
            </Card>

            <Card n="6" title="Design Results (ULS)">
              <KV rows={[
                ["Design UDL, w_d", `${f(forces.design_udl)} kN/m`],
                ["Maximum Bending Moment, M_Ed", `${f(forces.max_moment)} kN\u00b7m`],
                ["Maximum Shear Force, V_Ed", `${f(forces.max_shear)} kN`],
              ]} />
            </Card>

            <Card n="7" title="Flexural Design (EC2 \u00a76.1)">
              {fd ? (
                <div className="space-y-1.5">
                  <DRow label="Section type" value={fd.is_t_beam ? `T-beam, b_eff = ${f(fd.beff_mm, 0)} mm` : `Rectangular, b = ${f(bw, 0)} mm`} />
                  <DRow label="K = M_Ed / (b\u00b7d\u00b2\u00b7f_ck)" value={`${f(forces.max_moment)}\u00d710\u2076 / (${f(fd.beff_mm, 0)}\u00d7${f(d_eff, 0)}\u00b2\u00d7${f(materials.fck, 0)})`} result={`K = ${f(fd.K, 4)}`} />
                  <DRow label="Compression steel check" value={`K = ${f(fd.K, 4)} vs K' = ${f(fd.K_balanced, 3)}`} result={fd.K <= fd.K_balanced ? "singly reinforced" : "compression steel required"} ok={fd.K <= fd.K_balanced} />
                  <DRow label="Lever arm, z" value={`d(0.5+\u221a(0.25\u2212K/${codeShort === "EC2" ? "1.134" : "0.9"}))`} result={`z = ${f(fd.z_mm, 1)} mm (\u2264 0.95d)`} />
                  <DRow label="Neutral axis, x" value={`x = ${f(fd.neutral_axis_mm, 1)} mm`} result={fd.is_t_beam ? (fd.neutral_axis_in_flange ? "within flange \u2014 OK" : "below flange \u2014 review") : "\u2014"} ok={!fd.is_t_beam || fd.neutral_axis_in_flange} />
                  <DRow label="A_s,min (EC2 \u00a79.2.1.1)" value="max(0.26 f_ctm/f_yk\u00b7b\u00b7d, 0.0013\u00b7b\u00b7d)" result={`${f(fd.as_min_mm2, 0)} mm\u00b2`} />
                  <DRow label="A_s,req vs A_s,provided" value={`${f(r.tension.area_required, 0)} vs ${f(r.tension.area_provided, 0)} mm\u00b2`} result={r.tension.label} ok={r.tension.area_provided >= r.tension.area_required} />
                  <div className="mt-2 flex items-center justify-between rounded-md bg-[#f8fafc] dark:bg-[#0b0f19] px-3 py-2">
                    <span className={`text-xs font-semibold ${SUB}`}>M_Ed / M_Rd</span>
                    <span className={`text-sm font-bold ${capacity.utilization_bending <= 1 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {f(forces.max_moment)} / {f(capacity.moment_resistance)} kN\u00b7m &nbsp;({f(capacity.utilization_bending)})
                    </span>
                  </div>
                </div>
              ) : (
                <KVStatus rows={[
                  ["Design Bending Resistance, M_Rd", `${f(capacity.moment_resistance)} kN\u00b7m`, null],
                  ["Utilisation (Bending)", f(capacity.utilization_bending), capacity.utilization_bending <= 1],
                ]} />
              )}
            </Card>

            <Card n="7b" title="Shear Design (EC2 \u00a76.2.2)">
              {shd ? (
                <div className="space-y-1.5">
                  <DRow label="Steel ratio, \u03c1_l = A_s,prov/(b\u00b7d)" value="\u2264 0.02" result={`\u03c1_l = ${f(shd.rho_l, 5)}`} />
                  <DRow label="Size factor, k = 1+\u221a(200/d)" value="\u2264 2.0" result={`k = ${f(shd.k_factor, 3)}`} />
                  {codeShort === "EC2" && <>
                    <DRow label="C_Rd,c = 0.18/\u03b3_c" value="0.18/1.50" result={`${f(shd.C_Rdc, 3)}`} />
                    <DRow label="v_min = 0.035\u00b7k^1.5\u00b7\u221af_ck" value="" result={`${f(shd.v_min_mpa, 3)} MPa`} />
                  </>}
                  <DRow label="v_Ed = V_Ed/(b\u00b7d)" value="" result={`${f(shd.v_ed_mpa, 3)} MPa`} />
                  <DRow label="v_Rd,c = max(main term, v_min)" value="" result={`${f(shd.v_rdc_mpa, 3)} MPa`} ok={shd.v_ed_mpa <= shd.v_rdc_mpa} />
                  <div className="mt-2 flex items-center justify-between rounded-md bg-[#f8fafc] dark:bg-[#0b0f19] px-3 py-2">
                    <span className={`text-xs font-semibold ${SUB}`}>V_Ed / V_Rd,c</span>
                    <span className={`text-sm font-bold ${!shd.links_required ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {f(forces.max_shear)} / {f(capacity.shear_resistance)} kN &nbsp;({shd.links_required ? "links required" : "min. links only"})
                    </span>
                  </div>
                </div>
              ) : (
                <KVStatus rows={[["Design Shear Resistance, V_Rd,c", `${f(capacity.shear_resistance)} kN`, null],
                                  ["Utilisation (Shear)", f(capacity.utilization_shear), capacity.utilization_shear <= 1]]} />
              )}
            </Card>

            <Card n="8" title="Summary of Results">
              <KVStatus rows={[
                ["Deflection Check (SLS)", `${f(sls.deflection_actual, 1)} mm`, isPass(sls.deflection_status)],
                ["Crack Width, w_k", `${f(sls.crack_width, 2)} mm`, isPass(sls.crack_status)],
              ]} />
              <div className={`mt-3 flex items-center justify-between rounded-md px-3 py-2 ${pass ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                <span className={`text-sm font-semibold ${MAIN}`}>Overall Status</span>
                <span className={`text-base font-extrabold ${pass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {pass ? "SAFE" : "REVIEW"}
                </span>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card n="9" title="Bending Moment Diagram (Design)">
              <BMDSVG mMax={forces.max_moment} span={summary.span} />
            </Card>

            <Card n="10" title="Shear Force Diagram (Design)">
              <SFDSVG vMax={forces.max_shear} span={summary.span} />
            </Card>

            <Card n="11" title="Reinforcement Details">
              <div className="flex items-start gap-4">
                <CrossSectionSVG width={summary.width} depth={summary.depth} rein={r} big />
                <div className="flex-1">
                  <Table
                    head={["Reinforcement", "Details"]}
                    rows={[
                      ["Tension Reinforcement (Bottom)", `${r.tension.label} (A_s,prov = ${f(r.tension.area_provided, 0)} mm\u00b2)`],
                      ["Compression Reinforcement (Top)", `${r.compression.label} (A_s,prov = ${f(r.compression.area_provided, 0)} mm\u00b2)`],
                      ["Shear Reinforcement (Stirrups)", r.stirrups.label],
                      ["Clear Cover (Bottom / Top / Sides)", `${r.cover} / ${r.cover} / ${r.cover} mm`],
                    ]}
                  />
                </div>
              </div>
            </Card>

            <Card n="12" title="Deflection Design (EC2 \u00a77.4.2, two-stage)">
              {dd ? (
                <div className="space-y-1.5">
                  <DRow label="Structural system factor, K" value="EC2 Table 7.4N" result={`K = ${f(dd.K_sys, 2)}`} />
                  <DRow label="\u03c1 = A_s,req/(b\u00b7d)" value="" result={`\u03c1 = ${f(dd.rho, 5)}`} />
                  <DRow label="\u03c1\u2080 = \u221af_ck/1000" value="" result={`\u03c1\u2080 = ${f(dd.rho0, 5)}`} />
                  <DRow label="Branch" value={dd.rho <= dd.rho0 ? "\u03c1 \u2264 \u03c1\u2080" : "\u03c1 > \u03c1\u2080"} result={dd.rho <= dd.rho0 ? "lightly reinforced (A)" : "heavily reinforced (B)"} />
                  <DRow label="(L/d)_basic" value="EC2 \u00a77.4.2 formula" result={f(dd.ld_basic, 2)} />
                  <DRow label="Base check (actual vs basic, before enhancement)" value="" result={dd.base_status} ok={dd.base_status === "PASS"} />
                  <DRow label="Enhancement factor, F3" value={dd.enhanced ? "base check failed \u2192 F3 = A_s,prov/A_s,req (\u22641.5)" : "base check already passes \u2014 not required"} result={`F3 = ${f(dd.F3, 3)}`} />
                  <DRow label="Allowable (L/d) = basic \u00d7 F3" value="" result={f(sls.deflection_limit, 2)} />
                  <div className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 ${isPass(sls.deflection_status) ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                    <span className={`text-xs font-semibold ${SUB}`}>Actual L/d vs Allowable</span>
                    <span className={`text-sm font-bold ${isPass(sls.deflection_status) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {f(sls.deflection_actual, 2)} / {f(sls.deflection_limit, 2)} &nbsp;({sls.deflection_status})
                    </span>
                  </div>
                </div>
              ) : (
                <KVStatus rows={[["Deflection Check (SLS)", `${f(sls.deflection_actual, 1)} mm`, isPass(sls.deflection_status)]]} />
              )}
              <div className="mt-3 border-t border-[#f1f5f9] dark:border-[#334155] pt-3">
                <Table
                  head={["Check", "Limit (EC2)", "Calculated", "Status"]}
                  rows={[
                    ["Crack Width, w_k", `${f(sls.crack_limit, 2)} mm`, `${f(sls.crack_width, 2)} mm`, <Stat key="c" ok={isPass(sls.crack_status)} />],
                  ]}
                />
              </div>
            </Card>

            <Card n="13" title="Notes">
              <ul className="space-y-1.5">
                {(notes || []).map((nn, i) => (
                  <li key={i} className={`flex gap-2 text-[12px] ${SUB}`}>
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#94a3b8]" /> {nn}
                  </li>
                ))}
              </ul>
            </Card>

            <Card n="14" title="Detailed Report">
              <p className={`text-[12px] ${SUB} mb-3`}>
                Full calculation trace: every formula with numeric substitution, code references and pass/fail checks.
                {Array.isArray(report) && report.length > 0
                  ? ` ${report.length} sections, ${report.reduce((n, s) => n + (s.rows?.length || 0), 0)} rows.`
                  : ""}
              </p>
              <button onClick={() => setReportOpen(true)} className="mb-2 flex w-full items-center justify-between rounded-lg bg-[#0A2F44] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#082636]">
                <span className="flex items-center gap-2"><FiFileText size={15} /> View Full Calculation Report</span>
                <FiChevronRight size={16} />
              </button>
              <button onClick={() => exportElementToPdf(sheetRef.current, `Beam-${summary.beam_id || "report"}`)} className="flex w-full items-center justify-between rounded-lg border border-[#0A2F44] dark:border-[#66a4c2] px-4 py-2.5 text-sm font-medium text-[#0A2F44] dark:text-[#66a4c2] hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a]">
                <span className="flex items-center gap-2"><FiFileText size={15} /> Export Summary Sheet (PDF)</span>
                <FiChevronRight size={16} />
              </button>
            </Card>
          </div>
        </div>

        )}

        {tab === "Flexural Design" && <FlexuralTab ctx={ctx} />}
        {tab === "Shear Design" && <ShearTab ctx={ctx} />}
        {tab === "Deflection" && <DeflectionTab ctx={ctx} />}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => navigate("/beam")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium ${SUB} hover:bg-[#e2e8f0] dark:hover:bg-[#334155]`}>
            <FiArrowLeft size={15} /> Back to Input
          </button>
        </div>
      </div>

      {reportOpen && (
        <BeamReportModal report={report} summary={summary} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}

function FlexuralTab({ ctx }) {
  const { summary, materials, forces, capacity, reinforcement: r, fd, codeShort, bw, d_eff } = ctx;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <Card n="" title="Flexural Design \u2014 Full Derivation (EC2 \u00a76.1)">
        {fd ? (
          <div className="space-y-1.5">
            <DRow label="Section type" value={fd.is_t_beam ? `T-beam, b_eff = ${f(fd.beff_mm, 0)} mm` : `Rectangular, b = ${f(bw, 0)} mm`} />
            <DRow label="K = M_Ed / (b\u00b7d\u00b2\u00b7f_ck)" value={`${f(forces.max_moment)}\u00d710\u2076 / (${f(fd.beff_mm, 0)}\u00d7${f(d_eff, 0)}\u00b2\u00d7${f(materials.fck, 0)})`} result={`K = ${f(fd.K, 4)}`} />
            <DRow label="Compression steel check" value={`K = ${f(fd.K, 4)} vs K' = ${f(fd.K_balanced, 3)}`} result={fd.K <= fd.K_balanced ? "singly reinforced" : "compression steel required"} ok={fd.K <= fd.K_balanced} />
            <DRow label="Lever arm, z" value={`d(0.5+\u221a(0.25\u2212K/${codeShort === "EC2" ? "1.134" : "0.9"}))`} result={`z = ${f(fd.z_mm, 1)} mm (\u2264 0.95d)`} />
            <DRow label="Neutral axis, x" value={`x = ${f(fd.neutral_axis_mm, 1)} mm`} result={fd.is_t_beam ? (fd.neutral_axis_in_flange ? "within flange \u2014 OK" : "below flange \u2014 review") : "\u2014 (rectangular section)"} ok={!fd.is_t_beam || fd.neutral_axis_in_flange} />
            <DRow label="A_s,min (EC2 \u00a79.2.1.1)" value="max(0.26 f_ctm/f_yk\u00b7b\u00b7d, 0.0013\u00b7b\u00b7d)" result={`${f(fd.as_min_mm2, 0)} mm\u00b2`} />
            <DRow label="A_s,req vs A_s,provided" value={`${f(r.tension.area_required, 0)} vs ${f(r.tension.area_provided, 0)} mm\u00b2`} result={r.tension.label} ok={r.tension.area_provided >= r.tension.area_required} />
            <div className="mt-2 flex items-center justify-between rounded-md bg-[#f8fafc] dark:bg-[#0b0f19] px-3 py-2">
              <span className={`text-xs font-semibold ${SUB}`}>M_Ed / M_Rd</span>
              <span className={`text-sm font-bold ${capacity.utilization_bending <= 1 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {f(forces.max_moment)} / {f(capacity.moment_resistance)} kN\u00b7m &nbsp;({f(capacity.utilization_bending)})
              </span>
            </div>
          </div>
        ) : (
          <p className={`text-[12px] ${SUB}`}>Detailed flexural derivation isn't available for this result yet -- re-run the design after updating the backend.</p>
        )}
      </Card>
      <Card n="" title="Bending Moment Diagram (Design)">
        <BMDSVG mMax={forces.max_moment} span={summary.span} />
      </Card>
    </div>
  );
}

function ShearTab({ ctx }) {
  const { summary, forces, capacity, shd, codeShort } = ctx;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <Card n="" title="Shear Design \u2014 Full Derivation (EC2 \u00a76.2.2)">
        {shd ? (
          <div className="space-y-1.5">
            <DRow label="Steel ratio, \u03c1_l = A_s,prov/(b\u00b7d)" value="\u2264 0.02" result={`\u03c1_l = ${f(shd.rho_l, 5)}`} />
            <DRow label="Size factor, k = 1+\u221a(200/d)" value="\u2264 2.0" result={`k = ${f(shd.k_factor, 3)}`} />
            {codeShort === "EC2" && <>
              <DRow label="C_Rd,c = 0.18/\u03b3_c" value="0.18/1.50" result={`${f(shd.C_Rdc, 3)}`} />
              <DRow label="v_min = 0.035\u00b7k^1.5\u00b7\u221af_ck" value="" result={`${f(shd.v_min_mpa, 3)} MPa`} />
            </>}
            <DRow label="v_Ed = V_Ed/(b\u00b7d)" value="" result={`${f(shd.v_ed_mpa, 3)} MPa`} />
            <DRow label="v_Rd,c = max(main term, v_min)" value="" result={`${f(shd.v_rdc_mpa, 3)} MPa`} ok={shd.v_ed_mpa <= shd.v_rdc_mpa} />
            <div className="mt-2 flex items-center justify-between rounded-md bg-[#f8fafc] dark:bg-[#0b0f19] px-3 py-2">
              <span className={`text-xs font-semibold ${SUB}`}>V_Ed / V_Rd,c</span>
              <span className={`text-sm font-bold ${!shd.links_required ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                {f(forces.max_shear)} / {f(capacity.shear_resistance)} kN &nbsp;({shd.links_required ? "links required" : "min. links only"})
              </span>
            </div>
          </div>
        ) : (
          <p className={`text-[12px] ${SUB}`}>Detailed shear derivation isn't available for this result yet -- re-run the design after updating the backend.</p>
        )}
      </Card>
      <Card n="" title="Shear Force Diagram (Design)">
        <SFDSVG vMax={forces.max_shear} span={summary.span} />
      </Card>
    </div>
  );
}

function DeflectionTab({ ctx }) {
  const { summary, sls, dd } = ctx;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <Card n="" title="Deflection Design \u2014 Full Derivation (EC2 \u00a77.4.2, two-stage)">
        {dd ? (
          <div className="space-y-1.5">
            <DRow label="Structural system factor, K" value="EC2 Table 7.4N" result={`K = ${f(dd.K_sys, 2)}`} />
            <DRow label="\u03c1 = A_s,req/(b\u00b7d)" value="" result={`\u03c1 = ${f(dd.rho, 5)}`} />
            <DRow label="\u03c1\u2080 = \u221af_ck/1000" value="" result={`\u03c1\u2080 = ${f(dd.rho0, 5)}`} />
            <DRow label="Branch" value={dd.rho <= dd.rho0 ? "\u03c1 \u2264 \u03c1\u2080" : "\u03c1 > \u03c1\u2080"} result={dd.rho <= dd.rho0 ? "lightly reinforced (A)" : "heavily reinforced (B)"} />
            <DRow label="(L/d)_basic" value="EC2 \u00a77.4.2 formula" result={f(dd.ld_basic, 2)} />
            <DRow label="Base check (actual vs basic, before enhancement)" value="" result={dd.base_status} ok={dd.base_status === "PASS"} />
            <DRow label="Enhancement factor, F3" value={dd.enhanced ? "base check failed \u2192 F3 = A_s,prov/A_s,req (\u22641.5)" : "base check already passes \u2014 not required"} result={`F3 = ${f(dd.F3, 3)}`} />
            <DRow label="Allowable (L/d) = basic \u00d7 F3" value="" result={f(sls.deflection_limit, 2)} />
            <div className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 ${isPass(sls.deflection_status) ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              <span className={`text-xs font-semibold ${SUB}`}>Actual L/d vs Allowable</span>
              <span className={`text-sm font-bold ${isPass(sls.deflection_status) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {f(sls.deflection_actual, 2)} / {f(sls.deflection_limit, 2)} &nbsp;({sls.deflection_status})
              </span>
            </div>
          </div>
        ) : (
          <p className={`text-[12px] ${SUB}`}>Detailed deflection derivation isn't available for this result yet -- re-run the design after updating the backend.</p>
        )}
      </Card>
      <Card n="" title="Deflected Shape">
        <DeflectedShapeSVG defl={sls.deflection_actual} span={summary.span} />
      </Card>
    </div>
  );
}

function Strip({ label, value }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">{label}</div>
      <div className={`text-[12px] font-semibold ${MAIN} leading-tight mt-0.5`}>{value}</div>
    </div>
  );
}
function Card({ n, title, children }) {
  return (
    <section className={CARD}>
      <header className="flex items-center gap-2 border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5">
        {n && <span className="flex h-5 w-5 items-center justify-center rounded bg-[#e6f0f5] dark:bg-[#1e3a4a] text-[11px] font-bold text-[#0A2F44] dark:text-[#66a4c2]">{n}</span>}
        <h3 className={HEAD}>{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Table({ head, rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
            {head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[#f1f5f9] dark:border-[#263244]">
              {row.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? `font-medium ${MAIN}` : SUB} font-mono`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LoadTable({ loads }) {
  const comps = loads.components || [];
  const dead = comps.filter((c) => c.kind === "DL");
  const live = comps.filter((c) => c.kind === "LL");
  const descFor = (name) => {
    if (/self/i.test(name)) return "Self weight of beam";
    if (/wall/i.test(name)) return "Masonry / wall load";
    if (/finish/i.test(name)) return "Floor finishes";
    if (/additional/i.test(name)) return "MEP / services";
    if (/^live/i.test(name)) return "Imposed load";
    if (/other/i.test(name)) return "Partitions / equipment";
    return "";
  };
  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
            <th className="px-3 py-2 font-semibold">Load Type</th>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 font-semibold text-right">Value (kN/m)</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {dead.map((c, i) => (
            <tr key={`d${i}`} className="border-t border-[#f1f5f9] dark:border-[#263244]">
              <td className={`px-3 py-1.5 ${MAIN}`}>{c.name}</td>
              <td className={`px-3 py-1.5 ${SUB}`}>{descFor(c.name)}</td>
              <td className={`px-3 py-1.5 text-right ${MAIN}`}>{f(c.value)}</td>
            </tr>
          ))}
          <TotalRow label="TOTAL DEAD LOAD (G_k)" value={loads.total_dead} />
          {live.map((c, i) => (
            <tr key={`l${i}`} className="border-t border-[#f1f5f9] dark:border-[#263244]">
              <td className={`px-3 py-1.5 ${MAIN}`}>{c.name}</td>
              <td className={`px-3 py-1.5 ${SUB}`}>{descFor(c.name)}</td>
              <td className={`px-3 py-1.5 text-right ${MAIN}`}>{f(c.value)}</td>
            </tr>
          ))}
          <TotalRow label="TOTAL LIVE LOAD (Q_k)" value={loads.total_live} />
          <TotalRow label="TOTAL SERVICE LOAD (G_k + Q_k)" value={loads.total_service} strong />
        </tbody>
      </table>
    </div>
  );
}
function TotalRow({ label, value, strong }) {
  return (
    <tr className={`border-t border-[#f1f5f9] dark:border-[#263244] ${strong ? "bg-[#e6f0f5] dark:bg-[#1e3a4a]" : "bg-[#f8fafc] dark:bg-[#0b0f19]"}`}>
      <td className={`px-3 py-1.5 font-semibold ${strong ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`} colSpan={2}>{label}</td>
      <td className={`px-3 py-1.5 text-right font-mono font-bold ${strong ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{f(value)}</td>
    </tr>
  );
}
function KV({ rows }) {
  return (
    <div className="divide-y divide-[#f1f5f9] dark:divide-[#263244]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <span className={`text-[12px] ${SUB}`}>{r[0]}</span>
          <span className={`text-[12px] font-mono font-semibold ${MAIN}`}>{r[1]}</span>
        </div>
      ))}
    </div>
  );
}
function DRow({ label, value, result, ok }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] py-1.5 last:border-0 dark:border-[#263244]">
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] font-medium ${MAIN}`}>{label}</div>
        {value ? <div className={`font-mono text-[11px] ${SUB}`}>{value}</div> : null}
      </div>
      <div className={`flex-shrink-0 whitespace-nowrap text-right font-mono text-[12px] font-semibold ${
        ok === undefined ? MAIN : ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}>
        {result}
      </div>
    </div>
  );
}
function KVStatus({ rows }) {
  return (
    <div className="divide-y divide-[#f1f5f9] dark:divide-[#263244]">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <span className={`text-[12px] ${SUB}`}>{r[0]}</span>
          <span className="flex items-center gap-3">
            <span className={`text-[12px] font-mono font-semibold ${MAIN}`}>{r[1]}</span>
            {r[2] != null && <Stat ok={r[2]} />}
          </span>
        </div>
      ))}
    </div>
  );
}
function Stat({ ok }) {
  return <span className={`text-[11px] font-bold ${ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{ok ? "OK" : "FAIL"}</span>;
}

function ElevationSVG({ span }) {
  return (
    <div className={DIM_WRAP}>
      <svg viewBox="0 0 260 150" className="w-full max-w-[700px]">
        <rect x="30" y="34" width="200" height="34" fill="#cbd5e1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M30,68 l-13,18 h26 z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M230,68 l-13,18 h26 z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <line x1="10" y1="86" x2="24" y2="86" stroke="currentColor" strokeWidth="1.4" />
        <line x1="216" y1="86" x2="230" y2="86" stroke="currentColor" strokeWidth="1.4" />
        <line x1="30" y1="112" x2="230" y2="112" stroke={DIM} strokeWidth="1.5" markerStart="url(#ar)" markerEnd="url(#ar)" />
        <text x="130" y="130" fontSize="15" fontWeight="600" fill={DIM} textAnchor="middle">{span} mm</text>
        <defs><marker id="ar" markerWidth="9" markerHeight="9" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={DIM} /></marker></defs>
      </svg>
    </div>
  );
}
function CrossSectionSVG({ width, depth, rein, big }) {
  const nb = rein?.tension?.count || 3;
  const bw = big ? 70 : 90;
  const bh = big ? 110 : 145;
  const x0 = big ? 30 : 40, y0 = 20;
  const xs = Array.from({ length: nb }, (_, i) => x0 + 16 + (i * (bw - 32)) / (nb - 1 || 1));
  const topN = rein?.compression?.count || 2;
  const xt = Array.from({ length: topN }, (_, i) => x0 + 16 + (i * (bw - 32)) / (topN - 1 || 1));
  return (
    <div className={DIM_WRAP}>
      <svg viewBox={`0 0 ${bw + 90} ${bh + 55}`} className={big ? "w-[130px]" : "w-full max-w-[380px]"}>
        <rect x={x0} y={y0} width={bw} height={bh} fill="#e2e8f0" stroke="currentColor" strokeWidth="1.8" />
        <rect x={x0 + 8} y={y0 + 8} width={bw - 16} height={bh - 16} fill="none" stroke="#ef4444" strokeWidth="1.1" strokeDasharray="4 3" />
        {xs.map((x, i) => <circle key={`b${i}`} cx={x} cy={y0 + bh - 16} r="5" fill="#ef4444" />)}
        {xt.map((x, i) => <circle key={`t${i}`} cx={x} cy={y0 + 16} r="4.2" fill="#ef4444" />)}
        <line x1={x0} y1={y0 + bh + 16} x2={x0 + bw} y2={y0 + bh + 16} stroke={DIM} strokeWidth="1.4" markerStart="url(#cx)" markerEnd="url(#cx)" />
        <text x={x0 + bw / 2} y={y0 + bh + 34} fontSize="14" fontWeight="600" fill={DIM} textAnchor="middle">{width}</text>
        <line x1={x0 + bw + 16} y1={y0} x2={x0 + bw + 16} y2={y0 + bh} stroke={DIM} strokeWidth="1.4" markerStart="url(#cx)" markerEnd="url(#cx)" />
        <text x={x0 + bw + 36} y={y0 + bh / 2} fontSize="14" fontWeight="600" fill={DIM} textAnchor="middle" transform={`rotate(90 ${x0 + bw + 36} ${y0 + bh / 2})`}>{depth}</text>
        <defs><marker id="cx" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={DIM} /></marker></defs>
      </svg>
    </div>
  );
}
function LoadingSVG({ span, wk }) {
  const x0 = 40, x1 = 320;
  const arrows = [];
  for (let x = x0; x <= x1; x += 20) arrows.push(x);
  return (
    <div className={DIM_WRAP}>
      <svg viewBox="0 0 360 120" className="w-full">
        <text x={(x0 + x1) / 2} y="14" fontSize="11" fill={DIM} textAnchor="middle">w_k = {f(wk)} kN/m</text>
        <line x1={x0} y1="24" x2={x1} y2="24" stroke="#3b82f6" strokeWidth="1.4" />
        {arrows.map((x, i) => <line key={i} x1={x} y1="24" x2={x} y2="46" stroke="#3b82f6" strokeWidth="1" markerEnd="url(#ld)" />)}
        <rect x={x0} y="48" width={x1 - x0} height="16" fill="#cbd5e1" stroke="currentColor" strokeWidth="1" />
        <path d={`M${x0},64 l-10,13 h20 z`} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d={`M${x1},64 l-10,13 h20 z`} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1={x0} y1="98" x2={x1} y2="98" stroke={DIM} strokeWidth="1" markerStart="url(#lda)" markerEnd="url(#lda)" />
        <text x={(x0 + x1) / 2} y="112" fontSize="10" fill={DIM} textAnchor="middle">{span} mm</text>
        <defs>
          <marker id="ld" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto"><path d="M0,0 L3,5 L6,0 Z" fill="#3b82f6" /></marker>
          <marker id="lda" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker>
        </defs>
      </svg>
    </div>
  );
}
function BMDSVG({ mMax, span }) {
  const x0 = 40, x1 = 340, base = 40, depth = 80;
  const mid = (x0 + x1) / 2;
  return (
    <div className={DIM_WRAP}>
      <svg viewBox="0 0 380 170" className="w-full">
        <path d={`M${x0},${base} Q${mid},${base + 2 * depth} ${x1},${base} Z`} fill={RED} fillOpacity="0.75" stroke={RED} strokeWidth="1.4" />
        <text x={mid} y={base + depth + 4} fontSize="13" fill="#fff" textAnchor="middle" fontWeight="bold">+</text>
        <text x={mid} y={base - 8} fontSize="11" fill={RED} textAnchor="middle" fontWeight="bold">M_Ed,max = {f(mMax)} kN\u00b7m</text>
        <text x={x0 - 4} y={base + 4} fontSize="10" fill="currentColor" textAnchor="end">0</text>
        <text x={x1 + 4} y={base + 4} fontSize="10" fill="currentColor">0</text>
        <line x1={x0} y1={base + depth + 22} x2={x1} y2={base + depth + 22} stroke={DIM} strokeWidth="1" markerStart="url(#bm)" markerEnd="url(#bm)" />
        <text x={mid} y={base + depth + 36} fontSize="10" fill={DIM} textAnchor="middle">{span} mm</text>
        <defs><marker id="bm" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      </svg>
    </div>
  );
}
function DeflectedShapeSVG({ defl, span }) {
  return (
    <div className={DIM_WRAP}>
      <svg viewBox="0 0 380 130" className="w-full">
        <line x1="30" y1="30" x2="350" y2="30" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
        <path d="M30,30 Q190,80 350,30" fill="none" stroke="#6366f1" strokeWidth="2" />
        <line x1="190" y1="30" x2="190" y2="70" stroke="currentColor" strokeWidth="1" />
        <text x="196" y="52" fontSize="10" fill="#6366f1">δ = {f(defl, 2)} mm</text>
        <line x1="30" y1="100" x2="350" y2="100" stroke={DIM} strokeWidth="1" markerStart="url(#defl)" markerEnd="url(#defl)" />
        <text x="190" y="114" fontSize="10" fill={DIM} textAnchor="middle">{span} mm</text>
        <defs><marker id="defl" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      </svg>
    </div>
  );
}

function SFDSVG({ vMax, span }) {
  const x0 = 40, x1 = 340, mid = 60, h = 42;
  const cx = (x0 + x1) / 2;
  return (
    <div className={DIM_WRAP}>
      <svg viewBox="0 0 380 150" className="w-full">
        <line x1={x0} y1={mid} x2={x1} y2={mid} stroke="currentColor" strokeWidth="1" />
        <polygon points={`${x0},${mid} ${x0},${mid - h} ${cx},${mid}`} fill={RED} fillOpacity="0.75" stroke={RED} strokeWidth="1.3" />
        <polygon points={`${cx},${mid} ${x1},${mid + h} ${x1},${mid}`} fill={GREEN} fillOpacity="0.75" stroke={GREEN} strokeWidth="1.3" />
        <text x={x0 - 4} y={mid - h - 4} fontSize="10" fill={RED}>+{f(vMax)} kN</text>
        <text x={x1 + 4} y={mid + h + 12} fontSize="10" fill={GREEN} textAnchor="end">-{f(vMax)} kN</text>
        <text x={x0 - 6} y={mid + 4} fontSize="10" fill="currentColor" textAnchor="end">0</text>
        <line x1={x0} y1={mid + h + 22} x2={x1} y2={mid + h + 22} stroke={DIM} strokeWidth="1" markerStart="url(#sf)" markerEnd="url(#sf)" />
        <text x={cx} y={mid + h + 36} fontSize="10" fill={DIM} textAnchor="middle">{span} mm</text>
        <defs><marker id="sf" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      </svg>
    </div>
  );
}