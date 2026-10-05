// src/pages/FoundationResults.jsx
import React, { useState, useRef } from "react";
import { exportElementToPdf } from "../utils/exportPdf";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiFileText, FiX, FiAlertTriangle, FiDownload } from "react-icons/fi";
import Plot from "react-plotly.js";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const ACCENT = "#0A2F44", ACCENT_D = "#66a4c2";

export default function FoundationResults() {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const location = useLocation();
  const r = location.state?.designResult;
  const meta = location.state?.meta || {};
  const [showReport, setShowReport] = useState(false);

  if (!r) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#111827] px-6">
        <div className={`${CARD} p-8 text-center max-w-md`}>
          <FiAlertTriangle className="mx-auto mb-3 text-amber-500" size={28} />
          <p className={`mb-4 ${MAIN}`}>No design results. Run a foundation design first.</p>
          <button onClick={() => navigate("/foundation-input")} className="rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
            Go to Foundation Input
          </button>
        </div>
      </div>
    );
  }

  if (r.foundation_type === "combined") {
    return <CombinedFootingResults r={r} meta={meta} navigate={navigate} sheetRef={sheetRef}
      showReport={showReport} setShowReport={setShowReport} />;
  }

  const pass = r.status === "PASS";
  const g = r.geometry, sp = r.soil_pressure, fx = r.flexure.x, fy = r.flexure.y;
  const sx = r.one_way_shear.x, sy = r.one_way_shear.y, pn = r.punching, u = r.utilisation;

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] px-6 py-6">
      <div ref={sheetRef} className="mx-auto max-w-6xl space-y-5">
        {/* header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate("/foundation-input")} className={`flex items-center gap-2 text-sm ${SUB}`}>
            <FiArrowLeft size={16} /> Back to Input
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowReport(true)} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]">
              <FiFileText size={15} /> Detailed Report
            </button>
            <button onClick={() => exportElementToPdf(sheetRef.current, "PadFoundation")} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
              <FiDownload size={15} /> Download PDF
            </button>
          </div>
        </div>

        {/* title + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className={`${CARD} p-5`}>
            <div className="text-xs text-[#94a3b8] uppercase tracking-wide mb-1">Foundation Design Output · EN 1992-1-1 + EN 1997-1</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0A2F44] dark:text-[#66a4c2]">Pad Footing</h1>
              <span className={`text-sm ${SUB}`}>{r.load_case} loading{meta.project ? ` · ${meta.project}` : ""}{meta.location ? ` · ${meta.location}` : ""}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Mini label="Footing" value={`${g.footing_length_mm}×${g.footing_width_mm}`} />
              <Mini label="Thickness" value={`${g.footing_depth_mm} mm`} />
              <Mini label="qmax" value={`${sp.qmax} kN/m²`} />
              <Mini label="Overall util" value={`${u.overall_pct}%`} />
            </div>
          </div>

          <div className={`rounded-xl border p-5 ${pass ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}>
            <div className={TITLE}>Summary of Results</div>
            <div className="mt-3 flex items-center gap-3">
              {pass ? <FiCheckCircle className="text-green-600 dark:text-green-400" size={32} /> : <FiXCircle className="text-red-600 dark:text-red-400" size={32} />}
              <div className={`text-2xl font-bold ${pass ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{pass ? "SAFE" : "UNSAFE"}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              <SumLine label="Bearing" value={`${u.bearing_pct}%`} warn={u.bearing_pct > 100} />
              <SumLine label="Shear (max)" value={`${u.shear_pct}%`} warn={u.shear_pct > 100} />
              <SumLine label="Punching" value={`${u.punching_pct}%`} warn={u.punching_pct > 100} />
            </div>
          </div>
        </div>

        {/* 1. adopted geometry + 2. design results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="Foundation Geometry (Adopted)">
            <div className="flex items-center gap-4">
              <PlanSVG g={g} />
              <div className="flex-1 space-y-1.5">
                <KV label="Footing" value={`${g.footing_length_mm} × ${g.footing_width_mm} mm`} />
                <KV label="Thickness" value={`${g.footing_depth_mm} mm`} />
                <KV label="Column" value={`${g.column_x_mm} × ${g.column_y_mm} mm`} />
                <KV label="Projection a_x / a_y" value={`${g.projection_x_mm} / ${g.projection_y_mm} mm`} />
                <KV label="Eff. depth d_x / d_y" value={`${g.d_eff_x_mm} / ${g.d_eff_y_mm} mm`} />
                <KV label="Cover" value={`${g.cover_mm} mm`} />
              </div>
            </div>
          </Panel>

          <Panel title="Design Results (Ultimate)">
            <KV label="Avg pressure q0" value={`${sp.q0} kN/m²`} />
            <KV label="Max pressure qmax" value={`${sp.qmax} kN/m²`} strong warn={!sp.bearing_ok} />
            <KV label="Min pressure qmin" value={`${sp.qmin} kN/m²`} warn={!sp.uplift_ok} />
            <KV label="Allowable bearing" value={`${r.materials.allowable_bearing_kN_m2} kN/m²`} />
            <KV label="Bearing utilisation" value={`${u.bearing_pct}%`} strong warn={u.bearing_pct > 100} />
            <KV label="Design Mx / My" value={`${r.design_moments.Mx_kNm_per_m} / ${r.design_moments.My_kNm_per_m} kNm/m`} />
          </Panel>
        </div>

        {/* 3. reinforcement design */}
        <Panel title="Reinforcement Design (Bottom, Both Directions)">
          <Table
            head={["Direction", "d (mm)", "As,req (mm²/m)", "As,min", "As,prov", "Bar / Spacing", "Status"]}
            rows={[
              ["X", fx.d_eff_mm, fx.As_req, fx.As_min, fx.As_provided, `Y${fx.bar_dia}@${fx.spacing_mm}`, <Badge key="x" ok={fx.status === "OK"}>{fx.status}</Badge>],
              ["Y", fy.d_eff_mm, fy.As_req, fy.As_min, fy.As_provided, `Y${fy.bar_dia}@${fy.spacing_mm}`, <Badge key="y" ok={fy.status === "OK"}>{fy.status}</Badge>],
            ]}
          />
        </Panel>

        {/* 4. soil pressure 3D + 5. reinforcement layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="Soil Pressure Distribution (Ultimate)">
            <SoilPressure3D corners={sp.corners} g={g} allow={r.materials.allowable_bearing_kN_m2} />
            <p className={`mt-2 text-xs ${SUB}`}>qmax {sp.qmax} / qmin {sp.qmin} kN/m². {sp.bearing_ok ? "Within allowable." : "Exceeds allowable bearing."}</p>
          </Panel>

          <Panel title="Reinforcement Layout (Bottom)">
            <RebarLayout g={g} fx={fx} fy={fy} />
            <p className={`mt-2 text-xs ${SUB}`}>Bottom mesh: X {`Y${fx.bar_dia}@${fx.spacing_mm}`}, Y {`Y${fy.bar_dia}@${fy.spacing_mm}`}. Cover {g.cover_mm} mm.</p>
          </Panel>
        </div>

        {/* 6. shear checks */}
        <Panel title="Shear Checks">
          <Table
            head={["Check", "Direction", "VEd / vEd", "Resistance", "Status"]}
            rows={[
              ["One-way shear", "X", `${sx.VEd_kN_per_m} kN/m`, `${sx.VRdc_kN_per_m} kN/m`, <Badge key="sx" ok={sx.status === "OK"}>{sx.status}</Badge>],
              ["One-way shear", "Y", `${sy.VEd_kN_per_m} kN/m`, `${sy.VRdc_kN_per_m} kN/m`, <Badge key="sy" ok={sy.status === "OK"}>{sy.status}</Badge>],
              ["Punching (6.4)", "—", `${pn.vEd_MPa} MPa`, `${pn.vRdc_MPa} MPa`, <Badge key="pn" ok={pn.status === "OK"}>{pn.status}</Badge>],
            ]}
          />
        </Panel>

        {/* design summary chips */}
        <Panel title="Design Summary">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Chip label="Bearing" pct={u.bearing_pct} ok={sp.bearing_ok} />
            <Chip label="One-way shear" ok={sx.status === "OK" && sy.status === "OK"} />
            <Chip label="Punching" pct={u.punching_pct} ok={pn.status === "OK"} />
            <Chip label="Reinforcement" ok={fx.status === "OK" && fy.status === "OK"} />
            <Chip label="Uplift" ok={sp.uplift_ok} />
          </div>
        </Panel>

        <p className={`text-xs ${SUB} text-center pt-2`}>
          Computed per EN 1992-1-1 (§6.2, §6.4, §9.8) & EN 1997-1. Design on ULS loads. Validate against a trusted tool before real design.
        </p>
      </div>

      {showReport && <ReportModal r={r} onClose={() => setShowReport(false)} />}
    </div>
  );
}

/* ---------- 3D soil pressure (tilted plane from corner pressures) ---------- */
function SoilPressure3D({ corners, g, allow }) {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const axFont = dark ? "#94a3b8" : "#64748b";
  const gridC = dark ? "#334155" : "#e2e8f0";
  // corners: c1(+ex,+ey) c2(+ex,-ey) c3(-ex,+ey) c4(-ex,-ey)
  // map to a bilinear surface over footing [0..L] x [0..B]
  const L = g.footing_length_mm / 1000, B = g.footing_width_mm / 1000;
  const N = 12;
  const x = [], y = [], z = [];
  for (let j = 0; j <= N; j++) y.push((B * j) / N);
  for (let i = 0; i <= N; i++) x.push((L * i) / N);
  for (let j = 0; j <= N; j++) {
    const row = [];
    const ty = j / N; // 0..1 across B (ey axis)
    for (let i = 0; i <= N; i++) {
      const tx = i / N; // 0..1 across L (ex axis)
      // bilinear: +ex side at tx=1, +ey side at ty=1
      const top = corners.c3 * (1 - tx) + corners.c1 * tx; // +ey edge
      const bot = corners.c4 * (1 - tx) + corners.c2 * tx; // -ey edge
      row.push(bot * (1 - ty) + top * ty);
    }
    z.push(row);
  }
  return (
    <div data-pdf-skip="3D interaction surface — view interactively in the app">
    <Plot
      data={[{
        type: "surface", x, y, z, colorscale: "Jet", showscale: true,
        colorbar: { title: "kN/m²", thickness: 10, len: 0.7 },
      }]}
      layout={{
        autosize: true, height: 300, margin: { l: 0, r: 0, t: 0, b: 0 },
        scene: {
          xaxis: { title: { text: "L (m)", font: { size: 10, color: axFont } }, tickfont: { size: 9, color: axFont }, gridcolor: gridC, showbackground: false },
          yaxis: { title: { text: "B (m)", font: { size: 10, color: axFont } }, tickfont: { size: 9, color: axFont }, gridcolor: gridC, showbackground: false },
          zaxis: { title: { text: "q (kN/m²)", font: { size: 10, color: axFont } }, tickfont: { size: 9, color: axFont }, gridcolor: gridC, showbackground: false },
          camera: { eye: { x: 1.5, y: 1.5, z: 1.0 } },
        },
        paper_bgcolor: "rgba(0,0,0,0)",
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
    </div>
  );
}

/* ---------- combined footing (two columns, one footing) ---------- */
function CombinedFootingResults({ r, meta, navigate, sheetRef, showReport, setShowReport }) {
  const pass = r.status === "PASS";
  const col = r.columns, g = r.geometry, sp = r.soil_pressure;
  const lo = r.longitudinal, tr = r.transverse, sh = r.shear, pn = r.punching, u = r.utilisation;

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] px-6 py-6">
      <div ref={sheetRef} className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate("/foundation-input")} className={`flex items-center gap-2 text-sm ${SUB}`}>
            <FiArrowLeft size={16} /> Back to Input
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowReport(true)} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]">
              <FiFileText size={15} /> Detailed Report
            </button>
            <button onClick={() => exportElementToPdf(sheetRef.current, "CombinedFooting")} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-4 py-2 text-sm font-medium text-white hover:bg-[#082636]">
              <FiDownload size={15} /> Download PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className={`${CARD} p-5`}>
            <div className="text-xs text-[#94a3b8] uppercase tracking-wide mb-1">Foundation Design Output · EN 1992-1-1 + EN 1997-1</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0A2F44] dark:text-[#66a4c2]">Combined Footing</h1>
              <span className={`text-sm ${SUB}`}>{r.case_type}{meta.project ? ` · ${meta.project}` : ""}{meta.location ? ` · ${meta.location}` : ""}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Mini label="Footing" value={`${g.footing_length_mm}×${g.footing_width_mm}`} />
              <Mini label="Thickness" value={`${g.footing_depth_mm} mm`} />
              <Mini label="qmax" value={`${sp.qmax} kN/m²`} />
              <Mini label="Overall util" value={`${u.overall_pct}%`} />
            </div>
          </div>

          <div className={`rounded-xl border p-5 ${pass ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}>
            <div className={TITLE}>Summary of Results</div>
            <div className="mt-3 flex items-center gap-3">
              {pass ? <FiCheckCircle className="text-green-600 dark:text-green-400" size={32} /> : <FiXCircle className="text-red-600 dark:text-red-400" size={32} />}
              <div className={`text-2xl font-bold ${pass ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{pass ? "SAFE" : "UNSAFE"}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              <SumLine label="Bearing" value={`${u.bearing_pct}%`} warn={u.bearing_pct > 100} />
              <SumLine label="Shear" value={`${u.shear_pct}%`} warn={u.shear_pct > 100} />
              <SumLine label="Punching" value={`${u.punching_pct}%`} warn={u.punching_pct > 100} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="Columns & Resultant">
            <KV label="Column 1 (left)" value={`${col.column_1.axial_load_kN} kN, at ${col.column_1.position_m} m`} />
            <KV label="Column 2 (right)" value={`${col.column_2.axial_load_kN} kN, at ${col.column_2.position_m} m`} />
            <KV label="Spacing" value={`${col.spacing_m} m`} />
            <KV label="Total load W" value={`${col.total_load_kN} kN`} strong />
            <KV label="Resultant location" value={`${col.resultant_position_m} m from left edge`} />
            <KV label="Mx,total / My,total" value={`${r.moments.Mx_total_kNm} / ${r.moments.My_total_kNm} kNm`} />
          </Panel>

          <Panel title="Geometry & Design Results">
            <KV label="Footing" value={`${g.footing_length_mm} × ${g.footing_width_mm} mm`} />
            <KV label="Thickness" value={`${g.footing_depth_mm} mm`} />
            <KV label="Effective depth, long. / trans." value={`${g.d_long_mm} / ${g.d_trans_mm} mm`} />
            <KV label="Max pressure qmax" value={`${sp.qmax} kN/m²`} strong warn={!sp.bearing_ok} />
            <KV label="Min pressure qmin" value={`${sp.qmin} kN/m²`} warn={!sp.uplift_ok} />
            <KV label="Allowable bearing" value={`${r.materials.allowable_bearing_kN_m2} kN/m²`} />
          </Panel>
        </div>

        <Panel title="Flexural Reinforcement">
          <Table
            head={["Direction", "M (kNm)", "d (mm)", "As,req", "As,min", "As,prov", "Bar / Spacing", "Status"]}
            rows={[
              ["Longitudinal", lo.Mmax_kNm, lo.d_eff_mm, lo.As_req, lo.As_min, lo.As_provided, `Y${lo.bar_dia}@${lo.spacing_mm}`, <Badge key="lo" ok={lo.status === "OK"}>{lo.status}</Badge>],
              ["Transverse", tr.M_kNm, tr.d_eff_mm, tr.As_req, tr.As_min, tr.As_provided, `Y${tr.bar_dia}@${tr.spacing_mm}`, <Badge key="tr" ok={tr.status === "OK"}>{tr.status}</Badge>],
            ]}
          />
          <p className={`mt-2 text-xs ${SUB}`}>
            Longitudinal moment is the governing value found along the footing length (max at {lo.location_m} m from the left edge),
            not a simple column-face cantilever -- the soil pressure varies linearly along the length once there is a net moment.
          </p>
        </Panel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="Soil Pressure Distribution (Ultimate)">
            <SoilPressure3D corners={sp.corners} g={g} allow={r.materials.allowable_bearing_kN_m2} />
            <p className={`mt-2 text-xs ${SUB}`}>qmax {sp.qmax} / qmin {sp.qmin} kN/m². {sp.bearing_ok ? "Within allowable." : "Exceeds allowable bearing."}</p>
          </Panel>

          <Panel title="Shear Checks">
            <Table
              head={["Check", "VEd / vEd", "Resistance", "Status"]}
              rows={[
                ["One-way shear", `${sh.VEd_kN} kN`, `${sh.VRdc_kN} kN`, <Badge key="sh" ok={sh.status === "OK"}>{sh.status}</Badge>],
                ["Punching (6.4)", `${pn.vEd_MPa} MPa`, `${pn.vRdc_MPa} MPa`, <Badge key="pn" ok={pn.status === "OK"}>{pn.status}</Badge>],
              ]}
            />
            <p className={`mt-2 text-xs ${SUB}`}>Punching is checked around the more heavily loaded column.</p>
          </Panel>
        </div>

        <Panel title="Design Summary">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Chip label="Bearing" pct={u.bearing_pct} ok={sp.bearing_ok} />
            <Chip label="One-way shear" ok={sh.status === "OK"} />
            <Chip label="Punching" pct={u.punching_pct} ok={pn.status === "OK"} />
            <Chip label="Reinforcement" ok={lo.status === "OK" && tr.status === "OK"} />
            <Chip label="Uplift" ok={sp.uplift_ok} />
          </div>
        </Panel>

        <p className={`text-xs ${SUB} text-center pt-2`}>
          Computed per EN 1992-1-1 (§6.2, §6.4, §9.8) & EN 1997-1. Design on ULS loads. Validate against a trusted tool before real design.
        </p>
      </div>

      {showReport && <ReportModal r={r} onClose={() => setShowReport(false)} title="Detailed Calculation Report — Combined Footing" />}
    </div>
  );
}

/* ---------- plan diagram ---------- */
function PlanSVG({ g }) {
  const VB = 120, pad = 12, draw = VB - 2 * pad;
  const L = g.footing_length_mm, B = g.footing_width_mm;
  const s = draw / Math.max(L, B);
  const w = L * s, h = B * s, x0 = (VB - w) / 2, y0 = (VB - h) / 2;
  const cw = g.column_x_mm * s, ch = g.column_y_mm * s;
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-[120px] flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
      <rect x={x0} y={y0} width={w} height={h} className="fill-[#eef2f6] dark:fill-[#0f172a]" stroke={ACCENT} strokeWidth="1.5" />
      <rect x={VB / 2 - cw / 2} y={VB / 2 - ch / 2} width={cw} height={ch} fill={ACCENT} opacity="0.7" />
      <text x={VB / 2} y={y0 + h + 9} textAnchor="middle" fontSize="8" className="fill-[#64748b] dark:fill-[#94a3b8]">{L}×{B}</text>
    </svg>
  );
}

/* ---------- rebar layout ---------- */
function RebarLayout({ g, fx, fy }) {
  const VB = 260, pad = 22, draw = VB - 2 * pad;
  const L = g.footing_length_mm, B = g.footing_width_mm;
  const s = draw / Math.max(L, B);
  const w = L * s, h = B * s, x0 = (VB - w) / 2, y0 = (VB - h) / 2;
  const nx = Math.max(2, Math.floor(L / fx.spacing_mm));
  const ny = Math.max(2, Math.floor(B / fy.spacing_mm));
  const barsX = [], barsY = [];
  for (let i = 0; i <= nx; i++) barsX.push(x0 + (w * i) / nx);       // bars running Y, spaced along X
  for (let j = 0; j <= ny; j++) barsY.push(y0 + (h * j) / ny);       // bars running X, spaced along Y
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[260px] mx-auto" xmlns="http://www.w3.org/2000/svg">
      <rect x={x0} y={y0} width={w} height={h} className="fill-[#eef2f6] dark:fill-[#0f172a]" stroke={ACCENT} strokeWidth="1.5" />
      {barsY.map((yy, i) => <line key={"h" + i} x1={x0} y1={yy} x2={x0 + w} y2={yy} stroke={ACCENT_D} strokeWidth="0.8" />)}
      {barsX.map((xx, i) => <line key={"v" + i} x1={xx} y1={y0} x2={xx} y2={y0 + h} stroke={ACCENT} strokeWidth="0.8" opacity="0.6" />)}
      <text x={VB / 2} y={y0 + h + 14} textAnchor="middle" fontSize="9" className="fill-[#64748b] dark:fill-[#94a3b8]">X: Y{fx.bar_dia}@{fx.spacing_mm} · Y: Y{fy.bar_dia}@{fy.spacing_mm}</text>
    </svg>
  );
}

/* ---------- report modal ---------- */
function ReportModal({ r, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${CARD} max-h-[85vh] w-full max-w-3xl overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-5 py-3">
          <h3 className={TITLE}>{title || "Detailed Calculation Report — Pad Footing"}</h3>
          <button onClick={onClose} className={SUB}><FiX size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          {(r.report || []).map((sec, i) => (
            <div key={i}>
              <h4 className={`mb-2 text-sm font-bold ${MAIN}`}>{sec.section}</h4>
              <table className="w-full text-xs">
                <tbody>
                  {sec.rows.map((row, j) => (
                    <tr key={j} className="border-b border-[#f1f5f9] dark:border-[#2a3646]">
                      <td className={`py-1.5 pr-3 ${SUB} whitespace-nowrap align-top`} style={{ width: "24%" }}>{row.ref}</td>
                      <td className={`py-1.5 pr-3 font-mono ${MAIN}`}>{row.calc}</td>
                      <td className="py-1.5 font-mono font-semibold text-[#0A2F44] dark:text-[#66a4c2] text-right whitespace-nowrap">{row.out}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
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
    <div className="flex items-center justify-between py-1.5 border-b border-[#f1f5f9] dark:border-[#2a3646] last:border-0">
      <span className={`text-xs ${SUB}`}>{label}</span>
      <span className={`text-xs ${strong ? "font-bold" : "font-medium"} ${warn ? "text-red-600 dark:text-red-400" : MAIN}`}>{value}</span>
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
function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className={`text-left ${SUB} border-b border-[#e2e8f0] dark:border-[#334155]`}>
          {head.map((h, i) => <th key={i} className="py-2 pr-3 font-medium whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody className={MAIN}>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#f1f5f9] dark:border-[#2a3646]">
              {row.map((c, j) => <td key={j} className="py-2 pr-3 font-mono whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Badge({ ok, children }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ok ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>{children}</span>;
}
function Chip({ label, pct, ok }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${ok ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}>
      {ok ? <FiCheckCircle className="text-green-600 dark:text-green-400" size={18} /> : <FiXCircle className="text-red-600 dark:text-red-400" size={18} />}
      <span className={`text-[11px] text-center ${MAIN}`}>{label}</span>
      {pct != null && <span className={`text-[11px] font-semibold ${ok ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>{pct}%</span>}
    </div>
  );
}