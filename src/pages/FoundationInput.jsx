// src/pages/FoundationInput.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiHome, FiRefreshCw, FiLoader, FiInfo, FiAlertTriangle, FiCheckCircle,
} from "react-icons/fi";
import DesignProgressBar from "../components/ui/DesignProgressBar";
import Dropdown from "../components/Dropdown";
import { foundationAPI } from "../services/api";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const SECTION = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

// foundation types (only Pad is wired; others are visual tabs for now)
const FOUNDATION_TYPES = [
  { id: "pad", label: "Pad Footing", enabled: true },
  { id: "combined", label: "Combined Footing", enabled: true },
  { id: "strip", label: "Strip Footing", enabled: false },
  { id: "raft", label: "Raft Foundation", enabled: false },
  { id: "pile", label: "Pile Foundation", enabled: false },
  { id: "grillage", label: "Grillage Foundation", enabled: false },
];
const COL_SHAPES = ["Rectangular", "Circular"];
const FOOTING_SHAPES = ["Square", "Rectangular"];
const SOIL_TYPES = ["Medium Dense Sand", "Dense Sand", "Loose Sand", "Stiff Clay", "Firm Clay", "Soft Clay", "Rock"];
const CONCRETE = ["C20/25", "C25/30", "C30/37", "C35/45", "C40/50"];
const STEEL = ["B500", "B500B", "B460"];
const BAR_DIAS = [10, 12, 16, 20, 25];
const FIXITY = ["Fixed", "Pinned"];
// EN 1997-1 Annex A partial factors per design approach (recommended values).
const DESIGN_APPROACHES = {
  "DA1 - Combination 1": {
    sets: "A1 + M1 + R1",
    text: "Loads factored up (γG = 1.35, γQ = 1.5); soil strength and bearing resistance not factored (γφ' = γc' = γR = 1.0). Factors the loads, so it usually governs the structural design of the footing (bending, shear, punching).",
  },
  "DA1 - Combination 2": {
    sets: "A2 + M2 + R1",
    text: "Loads barely factored (γG = 1.0, γQ = 1.3); soil strength reduced instead (tan φ' / 1.25, c' / 1.25, cu / 1.4), bearing resistance γR = 1.0. Factors the soil, so it usually governs the footing size (geotechnical bearing). DA1 means checking both combinations and taking the worse; this is the UK National Annex choice.",
  },
  "DA2": {
    sets: "A1 + M1 + R2",
    text: "Loads factored up (γG = 1.35, γQ = 1.5); soil strength not factored; the calculated bearing resistance is divided by γR,v = 1.4. One combination covers both the structure and the soil.",
  },
  "DA3": {
    sets: "A1 (structural) / A2 (geotechnical) + M2 + R3",
    text: "Column loads factored up (γG = 1.35, γQ = 1.5), loads coming from the soil itself at 1.0 / 1.3; soil strength reduced (tan φ' / 1.25, c' / 1.25, cu / 1.4); resistance γR = 1.0.",
  },
};

const DEFAULTS = {
  foundation_type: "pad",
  project: "Residential Building", location: "Bangalore, India",
  // column / support (some display-only)
  column_shape: "Rectangular", column_x_mm: "400", column_y_mm: "400",
  // offset of the column centre from the footing centre (+x along L, +y along B)
  column_location: "Interior", offset_x_mm: "0", offset_y_mm: "0", fixity: "Fixed",
  // footing geometry
  footing_shape: "Square", footing_length_mm: "2000", footing_width_mm: "2000",
  footing_depth_mm: "500", pedestal_height_mm: "0", pedestal_size_mm: "0",
  depth_below_ground_mm: "1200",
  // soil & ground (display-only except allowable bearing)
  soil_type: "Medium Dense Sand", allowable_bearing_kN_m2: "200",
  unit_weight_soil: "18.0", ground_level_m: "0.00", water_table_m: "5.00",
  // materials
  concrete_grade_fck: "C25/30", steel_grade_fyk: "B500",
  cover_mm: "50", bar_dia_mm: "16",
  // loads — service + ultimate (engine uses ultimate)
  service_vertical_kN: "500", service_mx: "10", service_my: "5",
  ultimate_vertical_kN: "750", ultimate_mx: "15", ultimate_my: "7.5",
  // design & checks (display-only)
  design_approach: "DA1 - Combination 1", analysis_method: "Rigid (Base Pressure)",
  eccentricity_check: true, punching_check: true,
  min_reinf_ratio: "0.0013", max_reinf_ratio: "0.04",
  notes: "",
  // Printed on the first page of the Detailed Report. Blank stays blank.
  designer_name: "", designer_qualifications: "",
  checked_by: "", checker_qualifications: "",
  stability_responsible: "", independent_check: "",

  // Combined footing only -- two columns sharing one footing. Reuses
  // footing_length_mm/footing_width_mm/footing_depth_mm, column_x_mm/
  // column_y_mm, materials and detailing fields above; these are the ones
  // pad mode has no use for.
  column_spacing_m: "3.0", left_projection_m: "1.0",
  p1_axial_kN: "500", p1_mx: "0", p1_my: "0",
  p2_axial_kN: "350", p2_mx: "0", p2_my: "0",
  // SLS loads for the bearing check; blank -> the ULS load is used (conservative)
  p1_service_kN: "360", p2_service_kN: "250",
};

// Combined footing: the pad defaults (2.0 m long) cannot hold column 2 at
// left projection + spacing, so lengthen the footing to project the same
// distance past column 2 when it would not fit.
const withCombinedLength = (f) => {
  const need = (2 * (parseFloat(f.left_projection_m) || 0) + (parseFloat(f.column_spacing_m) || 0)) * 1000;
  const g = need > (parseFloat(f.footing_length_mm) || 0)
    ? { ...f, foundation_type: "combined", footing_length_mm: String(Math.round(need)) }
    : { ...f, foundation_type: "combined" };
  // a lengthened footing is no longer square: no warning for a change we made
  return g.footing_length_mm !== f.footing_length_mm && shapeFix(g) ? { ...g, footing_shape: shapeFix(g) } : g;
};

// Location presets the column offset: Edge puts the column flush with the
// +x footing edge, Corner with the +x and +y edges.
const locationOffsets = (f, loc) => {
  const half = (len, c) => String(Math.max(((parseFloat(len) || 0) - (parseFloat(c) || 0)) / 2, 0));
  const cy = f.column_shape === "Circular" ? f.column_x_mm : f.column_y_mm;
  return {
    column_location: loc,
    offset_x_mm: loc === "Interior" ? "0" : half(f.footing_length_mm, f.column_x_mm),
    offset_y_mm: loc === "Corner" ? half(f.footing_width_mm, cy) : "0",
  };
};

// Square needs L = B; Rectangular needs L != B. Returns the shape the
// dimensions call for when the chosen one does not fit, else null.
const shapeFix = (f) => {
  const L = parseFloat(f.footing_length_mm), B = parseFloat(f.footing_width_mm);
  if (!(L > 0) || !(B > 0)) return null;
  if (f.footing_shape === "Square" && L !== B) return "Rectangular";
  if (f.footing_shape === "Rectangular" && L === B) return "Square";
  return null;
};

const DRAFT_KEY = "foundationInputDraft";

const gradeNum = (g) => parseFloat(String(g).replace(/[^0-9]/g, "").slice(0, 2)) || 25;

export default function FoundationInput() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => {
    let f = DEFAULTS;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) f = { ...DEFAULTS, ...JSON.parse(saved) };
    } catch { /* private mode */ }
    return searchParams.get("type") === "combined" ? withCombinedLength(f) : f;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const reset = () => {
    setForm(DEFAULTS); setError(null);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* private mode */ }
  }, [form]);

  const num = (v) => parseFloat(v);
  const isCombined = form.foundation_type === "combined";
  // the combined engine takes rectangular columns only
  const circular = !isCombined && form.column_shape === "Circular";

  const designBasisPayload = () => ({
    designer_name: (form.designer_name || "").trim() || null,
    designer_qualifications: (form.designer_qualifications || "").trim() || null,
    checked_by: (form.checked_by || "").trim() || null,
    checker_qualifications: (form.checker_qualifications || "").trim() || null,
    stability_responsible: (form.stability_responsible || "").trim() || null,
    independent_check: form.independent_check || null,
  });

  const run = async () => {
    // Shape left at odds with the dimensions after the warning: follow the dimensions.
    const fixedShape = shapeFix(form);
    if (fixedShape) set({ footing_shape: fixedShape });
    const footingShape = fixedShape || form.footing_shape;
    if (isCombined) {
      if (!(num(form.p1_axial_kN) > 0) || !(num(form.p2_axial_kN) > 0)) { setError("Enter valid loads for both columns."); return; }
      if (!(num(form.footing_length_mm) > 0) || !(num(form.footing_width_mm) > 0)) { setError("Enter valid footing dimensions."); return; }
      if (!(num(form.column_spacing_m) > 0)) { setError("Enter a valid column spacing."); return; }
      setBusy(true); setError(null);
      try {
        const result = await foundationAPI.designCombined({
          column_1: { axial_load_kN: num(form.p1_axial_kN), moment_x_kNm: num(form.p1_mx) || 0, moment_y_kNm: num(form.p1_my) || 0,
                      service_axial_kN: num(form.p1_service_kN) > 0 ? num(form.p1_service_kN) : null },
          column_2: { axial_load_kN: num(form.p2_axial_kN), moment_x_kNm: num(form.p2_mx) || 0, moment_y_kNm: num(form.p2_my) || 0,
                      service_axial_kN: num(form.p2_service_kN) > 0 ? num(form.p2_service_kN) : null },
          column_spacing_m: num(form.column_spacing_m),
          left_projection_m: num(form.left_projection_m),
          footing_length_m: num(form.footing_length_mm) / 1000,
          footing_width_m: num(form.footing_width_mm) / 1000,
          footing_depth_mm: num(form.footing_depth_mm),
          column_x_mm: num(form.column_x_mm),
          column_y_mm: num(form.column_y_mm),
          concrete_grade_fck: gradeNum(form.concrete_grade_fck),
          steel_grade_fyk: gradeNum(form.steel_grade_fyk) < 100 ? 500 : gradeNum(form.steel_grade_fyk),
          allowable_bearing_kN_m2: num(form.allowable_bearing_kN_m2),
          cover_mm: num(form.cover_mm),
          bar_dia_mm: num(form.bar_dia_mm),
          design_basis: designBasisPayload(),
        });
        setBusy(false);
        navigate("/foundation-results", { state: { designResult: result, meta: {
          project: form.project, location: form.location, soil_type: form.soil_type,
          concrete_grade: form.concrete_grade_fck, steel_grade: form.steel_grade_fyk,
        } } });
      } catch (e) {
        setBusy(false);
        setError(e.message === "Failed to fetch"
          ? "Cannot reach the design engine. The backend may be waking up — try again in a minute."
          : e.message);
      }
      return;
    }

    if (!(num(form.ultimate_vertical_kN) > 0)) { setError("Enter a valid ultimate vertical load."); return; }
    if (!(num(form.footing_length_mm) > 0) || !(num(form.footing_width_mm) > 0)) { setError("Enter valid footing dimensions."); return; }
    setBusy(true); setError(null);
    try {
      const result = await foundationAPI.designPad({
        axial_load_kN: num(form.ultimate_vertical_kN),
        moment_x_kNm: num(form.ultimate_mx) || 0,
        moment_y_kNm: num(form.ultimate_my) || 0,
        footing_length_mm: num(form.footing_length_mm),
        footing_width_mm: num(form.footing_width_mm),
        footing_depth_mm: num(form.footing_depth_mm),
        column_x_mm: num(form.column_x_mm),
        column_y_mm: circular ? num(form.column_x_mm) : num(form.column_y_mm),
        column_shape: circular ? "circular" : "rectangular",
        column_offset_x_mm: num(form.offset_x_mm) || 0,
        column_offset_y_mm: num(form.offset_y_mm) || 0,
        column_fixity: form.fixity === "Pinned" ? "pinned" : "fixed",
        concrete_grade_fck: gradeNum(form.concrete_grade_fck),
        steel_grade_fyk: gradeNum(form.steel_grade_fyk) < 100 ? 500 : gradeNum(form.steel_grade_fyk),
        allowable_bearing_kN_m2: num(form.allowable_bearing_kN_m2),
        cover_mm: num(form.cover_mm),
        bar_dia_mm: num(form.bar_dia_mm),
        // SLS row for the bearing check; blank axial -> engine uses ULS
        service_axial_kN: num(form.service_vertical_kN) > 0 ? num(form.service_vertical_kN) : null,
        service_moment_x_kNm: num(form.service_vertical_kN) > 0 ? num(form.service_mx) || 0 : null,
        service_moment_y_kNm: num(form.service_vertical_kN) > 0 ? num(form.service_my) || 0 : null,
        design_basis: designBasisPayload(),
        // pass-through display context (not used by engine calc)
        _meta: { project: form.project, location: form.location, soil_type: form.soil_type,
                 footing_shape: footingShape, column_shape: form.column_shape },
      });
      setBusy(false);
      navigate("/foundation-results", { state: { designResult: result, meta: {
        project: form.project, location: form.location, soil_type: form.soil_type,
        concrete_grade: form.concrete_grade_fck, steel_grade: form.steel_grade_fyk,
      } } });
    } catch (e) {
      setBusy(false);
      setError(e.message === "Failed to fetch"
        ? "Cannot reach the design engine. The backend may be waking up — try again in a minute."
        : e.message);
    }
  };

  const steelK = gradeNum(form.steel_grade_fyk) < 100 ? 500 : gradeNum(form.steel_grade_fyk);

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      <header className="flex items-center gap-2.5 border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiHome size={15} /></div>
        <div>
          <div className={`text-sm font-bold ${MAIN}`}>Foundation Input (EC2)</div>
          <div className={`text-[11px] ${SUB}`}>EN 1992-1-1 + EN 1997-1 · kN, m</div>
        </div>
      </header>

      {/* foundation type selector */}
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-3">
        <div className="mb-2 text-xs text-[#94a3b8] uppercase tracking-wide">Select Foundation Type</div>
        <div className="flex flex-wrap gap-2">
          {FOUNDATION_TYPES.map((t) => (
            <button key={t.id} onClick={() => {
                if (!t.enabled) return;
                if (t.id === "combined") setForm((f) => withCombinedLength(f));
                else set({ foundation_type: t.id });
              }} disabled={!t.enabled}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                form.foundation_type === t.id ? "border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] text-[#0A2F44] dark:text-[#66a4c2]"
                : t.enabled ? "border-[#e2e8f0] dark:border-[#334155] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"
                : "border-[#e2e8f0] dark:border-[#334155] text-[#cbd5e1] dark:text-[#475569] cursor-not-allowed"}`}>
              {t.label}{!t.enabled && <span className="ml-1 text-[10px]">(soon)</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-6 py-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <DesignProgressBar active={busy} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="space-y-5 min-w-0">
            {/* 1. Column / Support */}
            <Card n={1} title={isCombined ? "Columns & Spacing (both columns share this size)" : "Column / Support Details"}>
              <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isCombined ? "2xl:grid-cols-5" : "2xl:grid-cols-6"}`}>
                {!isCombined && <div><label className={LABEL}>Column Shape</label><Dropdown value={form.column_shape} onChange={(v) => set({ column_shape: v })} options={COL_SHAPES} /></div>}
                {circular ? (
                  <Num label="Column diameter D" unit="mm" value={form.column_x_mm} onChange={(v) => set({ column_x_mm: v, column_y_mm: v })} live />
                ) : (
                  <>
                    <Num label="Column bx (along L)" unit="mm" value={form.column_x_mm} onChange={(v) => set({ column_x_mm: v })} live />
                    <Num label="Column by (along B)" unit="mm" value={form.column_y_mm} onChange={(v) => set({ column_y_mm: v })} live />
                  </>
                )}
                {isCombined ? (
                  <>
                    <Num label="Column spacing" unit="m" value={form.column_spacing_m} onChange={(v) => set({ column_spacing_m: v })} live />
                    <Num label="Left projection to column 1" unit="m" value={form.left_projection_m} onChange={(v) => set({ left_projection_m: v })} live />
                  </>
                ) : (
                  <>
                    <div><label className={LABEL}>Location</label><Dropdown value={form.column_location} onChange={(v) => setForm((f) => ({ ...f, ...locationOffsets(f, v) }))} options={["Interior", "Edge", "Corner"]} /></div>
                    <Num label="Offset ex (along L)" unit="mm" value={form.offset_x_mm} onChange={(v) => set({ offset_x_mm: v })} live />
                    <Num label="Offset ey (along B)" unit="mm" value={form.offset_y_mm} onChange={(v) => set({ offset_y_mm: v })} live />
                    <div><label className={LABEL}>Fixity</label><Dropdown value={form.fixity} onChange={(v) => set({ fixity: v })} options={FIXITY} /></div>
                  </>
                )}
              </div>
              {!isCombined && (
                <p className={`mt-2 text-xs ${SUB}`}>
                  Offsets are from the footing centre to the column centre; the footing takes N × offset as extra moment.
                  Edge / Corner set the column flush with the footing edge (re-pick after changing sizes).
                  {circular && " A circular column is designed for bending and shear at the face of the equal-area square (0.886D); punching uses the circular perimeter."}
                  {form.fixity === "Pinned" && " Pinned base: the column moments in the load table are not passed to the footing."}
                </p>
              )}
              {isCombined && (
                <p className={`mt-2 text-xs ${SUB}`}>Left projection + spacing must not exceed the footing length set in Footing Geometry below.</p>
              )}
            </Card>

            {/* 2. Footing Geometry */}
            <Card n={2} title="Footing Geometry">
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4">
                <div><label className={LABEL}>Footing Shape</label><Dropdown value={form.footing_shape} onChange={(v) => set({ footing_shape: v })} options={FOOTING_SHAPES} /></div>
                <Num label="Length (B × L)" unit="mm" value={form.footing_length_mm} onChange={(v) => set({ footing_length_mm: v })} live />
                <Num label="Width" unit="mm" value={form.footing_width_mm} onChange={(v) => set({ footing_width_mm: v })} live />
                <Num label="Thickness (h)" unit="mm" value={form.footing_depth_mm} onChange={(v) => set({ footing_depth_mm: v })} live />
                <Num label="Pedestal Height" unit="mm" value={form.pedestal_height_mm} onChange={(v) => set({ pedestal_height_mm: v })} />
                <Num label="Depth Below Ground" unit="mm" value={form.depth_below_ground_mm} onChange={(v) => set({ depth_below_ground_mm: v })} />
              </div>
              {shapeFix(form) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {form.footing_shape === "Square"
                      ? <>A square footing needs equal length and width ({form.footing_length_mm} ≠ {form.footing_width_mm} mm). Make them equal, or the shape will be changed to <b>Rectangular</b> when you design.</>
                      : <>Length and width are equal ({form.footing_length_mm} mm), so this footing is square. Choose <b>Square</b>, or it will be changed to Square when you design.</>}
                  </p>
                </div>
              )}
            </Card>

            {/* 3. Soil & Ground */}
            <Card n={3} title="Soil & Ground Conditions">
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4">
                <div><label className={LABEL}>Soil Type</label><Dropdown value={form.soil_type} onChange={(v) => set({ soil_type: v })} options={SOIL_TYPES} /></div>
                <Num label="Net Allowable Bearing" unit="kN/m²" value={form.allowable_bearing_kN_m2} onChange={(v) => set({ allowable_bearing_kN_m2: v })} live />
                <Num label="Unit Weight of Soil" unit="kN/m³" value={form.unit_weight_soil} onChange={(v) => set({ unit_weight_soil: v })} />
                <Num label="Ground Level" unit="m" value={form.ground_level_m} onChange={(v) => set({ ground_level_m: v })} />
                <Num label="Water Table Depth" unit="m" value={form.water_table_m} onChange={(v) => set({ water_table_m: v })} />
              </div>
            </Card>

            {/* 4. Materials */}
            <Card n={4} title="Material Properties">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className={LABEL}>Concrete Grade</label><Dropdown value={form.concrete_grade_fck} onChange={(v) => set({ concrete_grade_fck: v })} options={CONCRETE} /></div>
                <div><label className={LABEL}>Steel Grade</label><Dropdown value={form.steel_grade_fyk} onChange={(v) => set({ steel_grade_fyk: v })} options={STEEL} /></div>
                <Num label="Cover" unit="mm" value={form.cover_mm} onChange={(v) => set({ cover_mm: v })} live />
                <div><label className={LABEL}>Bar Dia (mm)</label><Dropdown value={form.bar_dia_mm} onChange={(v) => set({ bar_dia_mm: v })} options={BAR_DIAS} /></div>
              </div>
            </Card>

            {/* 5. Loads */}
            <Card n={5} title={isCombined ? "Column Loads (Service & Ultimate)" : "Load Input (Service & Ultimate)"}>
              {isCombined ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`text-left ${SUB} border-b border-[#e2e8f0] dark:border-[#334155]`}>
                          <th className="py-2 pr-3 font-medium">Column</th>
                          <th className="py-2 pr-3 font-medium">Service SLS (kN)</th>
                          <th className="py-2 pr-3 font-medium">Ultimate ULS (kN)</th>
                          <th className="py-2 pr-3 font-medium">Mx (kNm)</th>
                          <th className="py-2 pr-3 font-medium">My (kNm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#f1f5f9] dark:border-[#2a3646]">
                          <td className={`py-2 pr-3 font-semibold ${MAIN}`}>Column 1 (left)</td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p1_service_kN} onChange={(e) => set({ p1_service_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p1_axial_kN} onChange={(e) => set({ p1_axial_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p1_mx} onChange={(e) => set({ p1_mx: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p1_my} onChange={(e) => set({ p1_my: e.target.value })} /></td>
                        </tr>
                        <tr>
                          <td className={`py-2 pr-3 font-semibold ${MAIN}`}>Column 2 (right)</td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p2_service_kN} onChange={(e) => set({ p2_service_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p2_axial_kN} onChange={(e) => set({ p2_axial_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p2_mx} onChange={(e) => set({ p2_mx: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.p2_my} onChange={(e) => set({ p2_my: e.target.value })} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className={`mt-2 text-xs ${SUB}`}>Service loads (plus the footing self-weight) are used for the bearing check; leave blank to use the ULS load (conservative). Moments are ULS; for bearing they are scaled by each column's SLS/ULS ratio. The structural design uses the ULS loads.</p>
                </>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`text-left ${SUB} border-b border-[#e2e8f0] dark:border-[#334155]`}>
                          <th className="py-2 pr-3 font-medium">Load Type</th>
                          <th className="py-2 pr-3 font-medium">Vertical (kN)</th>
                          <th className="py-2 pr-3 font-medium">Mx (kNm)</th>
                          <th className="py-2 pr-3 font-medium">My (kNm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#f1f5f9] dark:border-[#2a3646]">
                          <td className={`py-2 pr-3 ${MAIN}`}>Service (SLS)</td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.service_vertical_kN} onChange={(e) => set({ service_vertical_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.service_mx} onChange={(e) => set({ service_mx: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.service_my} onChange={(e) => set({ service_my: e.target.value })} /></td>
                        </tr>
                        <tr>
                          <td className={`py-2 pr-3 font-semibold ${MAIN}`}>Ultimate (ULS) <span className="text-[10px] text-green-600 dark:text-green-400">← drives design</span></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.ultimate_vertical_kN} onChange={(e) => set({ ultimate_vertical_kN: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.ultimate_mx} onChange={(e) => set({ ultimate_mx: e.target.value })} /></td>
                          <td className="py-2 pr-3"><input type="number" className={INPUT} value={form.ultimate_my} onChange={(e) => set({ ultimate_my: e.target.value })} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className={`mt-2 text-xs ${SUB}`}>Bearing is checked on the Service (SLS) row plus the footing self-weight, because the allowable bearing pressure is a working (service) value. Leave the service vertical load blank to use the ULS row (conservative). Bending, shear and punching are designed on the Ultimate (ULS) row.</p>
                </>
              )}
            </Card>

            {/* 6. Design & Checks */}
            <Card n={6} title="Design & Check Settings">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div><label className={LABEL}>Design Approach</label><Dropdown value={form.design_approach} onChange={(v) => set({ design_approach: v })} options={["DA1 - Combination 1", "DA1 - Combination 2", "DA2", "DA3"]} /></div>
                <div><label className={LABEL}>Analysis Method</label><Dropdown value={form.analysis_method} onChange={(v) => set({ analysis_method: v })} options={["Rigid (Base Pressure)", "Flexible (Winkler)"]} /></div>
                <Num label="Min Reinf. Ratio" value={form.min_reinf_ratio} onChange={(v) => set({ min_reinf_ratio: v })} />
                <Num label="Max Reinf. Ratio" value={form.max_reinf_ratio} onChange={(v) => set({ max_reinf_ratio: v })} />
              </div>
              <div className="mt-3 flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.eccentricity_check} onChange={(e) => set({ eccentricity_check: e.target.checked })} className="h-4 w-4 accent-[#0A2F44]" /><span className={MAIN}>Eccentricity check</span></label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.punching_check} onChange={(e) => set({ punching_check: e.target.checked })} className="h-4 w-4 accent-[#0A2F44]" /><span className={MAIN}>Punching check</span></label>
              </div>
              {DESIGN_APPROACHES[form.design_approach] && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#111827] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#66a4c2]" />
                  <div className="text-xs">
                    <p className={`font-semibold ${MAIN}`}>{form.design_approach} · {DESIGN_APPROACHES[form.design_approach].sets}</p>
                    <p className={`mt-1 ${SUB}`}>{DESIGN_APPROACHES[form.design_approach].text}</p>
                    <p className={`mt-1 ${SUB}`}>Sets: A = actions (loads), M = soil strength, R = resistance. This app checks bearing against the allowable bearing pressure you enter, which already contains the soil's safety margin, so it uses the service loads and the design approach is recorded, not calculated. The structural design uses the ULS loads you enter.</p>
                  </div>
                </div>
              )}
            </Card>

            {/* 7. Notes */}
            <Card n={7} title="Notes & Attachments" optional>
              <textarea rows={3} className={INPUT} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Any notes or additional information…" />
            </Card>

            {/* 8. Design Basis */}
            <Card n={8} title="Design Basis" optional>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div><label className={LABEL}>Designed by</label>
                  <input className={INPUT} value={form.designer_name} onChange={(e) => set({ designer_name: e.target.value })} /></div>
                <div><label className={LABEL}>Designer's qualifications</label>
                  <input className={INPUT} value={form.designer_qualifications} onChange={(e) => set({ designer_qualifications: e.target.value })} /></div>
                <div><label className={LABEL}>Checked by</label>
                  <input className={INPUT} value={form.checked_by} onChange={(e) => set({ checked_by: e.target.value })} /></div>
                <div><label className={LABEL}>Checker's qualifications</label>
                  <input className={INPUT} value={form.checker_qualifications} onChange={(e) => set({ checker_qualifications: e.target.value })} /></div>
              </div>
              <div className="mt-4">
                <label className={LABEL}>Responsible for the stability of the structure</label>
                <input className={INPUT} value={form.stability_responsible} onChange={(e) => set({ stability_responsible: e.target.value })} />
              </div>
              <div className="mt-4">
                <label className={LABEL}>Independent check</label>
                <div className="flex flex-wrap gap-2">
                  {[["", "Not stated"], ["required", "Required"], ["completed", "Completed"]].map(([val, label]) => {
                    const on = (form.independent_check || "") === val;
                    return (
                      <button key={label} type="button" onClick={() => set({ independent_check: val })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          on ? "border-[#0A2F44] bg-[#e6f0f5] text-[#0A2F44] dark:border-[#66a4c2] dark:bg-[#1e3a4a] dark:text-[#66a4c2]"
                             : `border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:border-[#94a3b8]`}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                  These are printed on the first page of the Detailed Report. Left blank, the report says "not entered".
                  Nothing is filled in for you: who designed, who checked and whether an independent check is required
                  or done are your statements, and building control asks for them with a submission. The independent
                  check is never ticked automatically.
                </p>
              </div>
            </Card>
          </div>

          {/* right: live plan + summary */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className={SECTION}>Footing Plan (live)</h3></div>
              <div className="p-4"><FootingPlan form={form} isCombined={isCombined} /></div>
            </div>
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className={SECTION}>Input Summary</h3></div>
              <div className="p-5 space-y-2.5">
                <Sum label="Foundation" value={isCombined ? "Combined Footing" : "Pad Footing"} />
                <Sum label="Column" value={circular ? `Ø${form.column_x_mm} mm` : `${form.column_x_mm}×${form.column_y_mm} mm`} />
                <Sum label="Footing" value={`${form.footing_length_mm}×${form.footing_width_mm}×${form.footing_depth_mm}`} />
                <div className="my-2 border-t border-[#e2e8f0] dark:border-[#334155]" />
                <Sum label="Soil type" value={form.soil_type} />
                <Sum label="Allow. bearing" value={`${form.allowable_bearing_kN_m2} kN/m²`} />
                <div className="my-2 border-t border-[#e2e8f0] dark:border-[#334155]" />
                <Sum label="Concrete / Steel" value={`${form.concrete_grade_fck} · ${form.steel_grade_fyk}`} />
                <Sum label="Cover / Bar" value={`${form.cover_mm} / Ø${form.bar_dia_mm}`} />
                <div className="my-2 border-t border-[#e2e8f0] dark:border-[#334155]" />
                {isCombined ? (
                  <>
                    <Sum label="Spacing / Left proj." value={`${form.column_spacing_m} / ${form.left_projection_m} m`} />
                    <Sum label="P1 SLS / ULS" value={`${form.p1_service_kN || "-"} / ${form.p1_axial_kN} kN`} strong />
                    <Sum label="P2 SLS / ULS" value={`${form.p2_service_kN || "-"} / ${form.p2_axial_kN} kN`} strong />
                  </>
                ) : (
                  <>
                    <Sum label="ULS Vertical" value={`${form.ultimate_vertical_kN} kN`} strong />
                    <Sum label="ULS Mx / My" value={`${form.ultimate_mx} / ${form.ultimate_my} kNm`} />
                  </>
                )}
              </div>
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 rounded-lg bg-[#f0fdf4] dark:bg-[#052e16] p-3">
                  <FiCheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={15} />
                  <p className="text-xs text-green-700 dark:text-green-300">Engine uses fck={gradeNum(form.concrete_grade_fck)}, fyk={steelK}. Extra fields are recorded, not calculated.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* action bar at bottom, full width like other input pages */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e2e8f0] dark:border-[#334155] pt-5">
          <button onClick={reset} className={`flex items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-5 py-2.5 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}>
            <FiRefreshCw size={15} /> Reset
          </button>
          <button onClick={run} disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#0A2F44] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#082636] disabled:opacity-50">
            {busy ? <FiLoader className="animate-spin" size={15} /> : null} Save & Proceed to Design
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ n, title, optional, children }) {
  return (
    <div className={CARD}>
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3 flex items-center gap-2">
        <h2 className={SECTION}>{n}. {title}</h2>
        {optional && <span className="text-xs lowercase font-normal text-[#94a3b8]">(optional)</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function Num({ label, unit, value, onChange, live }) {
  return (
    <div>
      <label className={LABEL}>{label} {unit ? <span className="text-[#94a3b8]">({unit})</span> : null}
        {live && <span className="ml-1 text-[9px] text-green-600 dark:text-green-400">●</span>}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}
function Sum({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-xs ${SUB}`}>{label}</span>
      <span className={`text-xs text-right ${strong ? "font-bold text-[#0A2F44] dark:text-[#66a4c2]" : `font-medium ${MAIN}`}`}>{value}</span>
    </div>
  );
}

/* Live plan sketch: footing, column(s) and the key dimensions, drawn to scale from the form values.
   For combined footing it applies the same rule the backend validator does (column 2 must sit on the
   footing), so a layout that cannot be designed is visible before pressing Save & Proceed. */
function FootingPlan({ form, isCombined }) {
  const DIM = "var(--dim)";
  const pos = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x > 0 ? x : 0; };
  const L = pos(form.footing_length_mm), B = pos(form.footing_width_mm);
  const circ = !isCombined && form.column_shape === "Circular";
  const cx = pos(form.column_x_mm), cy = circ ? cx : pos(form.column_y_mm);
  const ox = isCombined ? 0 : parseFloat(form.offset_x_mm) || 0;
  const oy = isCombined ? 0 : parseFloat(form.offset_y_mm) || 0;
  const spacing = pos(form.column_spacing_m) * 1000;
  const lead = pos(form.left_projection_m) * 1000;

  if (!L || !B) {
    return <p className={`text-xs ${SUB}`}>Enter the footing length and width to see the plan.</p>;
  }

  const W = 300, H = 200, padX = 28, areaW = W - 2 * padX, areaH = 112, topY = 34;
  const s = Math.min(areaW / L, areaH / B);
  const fw = L * s, fh = B * s;
  const x0 = (W - fw) / 2, y0 = topY + (areaH - fh) / 2;
  const centres = isCombined ? [lead, lead + spacing] : [L / 2 + ox];
  const fits = !isCombined || lead + spacing <= L;
  const px = (mm) => Math.min(Math.max(x0 + mm * s, 0), W);
  const colW = Math.max(cx * s, 3), colH = Math.max(cy * s, 3);
  const midY = y0 + fh / 2;
  const colY = midY - oy * s;   // +y drawn upwards
  const dimY = y0 + fh + 16;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
        <defs>
          <marker id="fp-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={DIM} />
          </marker>
        </defs>
        <rect x={x0} y={y0} width={fw} height={fh} fill="currentColor" fillOpacity="0.25"
          stroke={fits ? "currentColor" : "#ef4444"} strokeWidth="1.6" />
        {centres.map((mm, i) => (
          <g key={i}>
            {circ
              ? <circle cx={px(mm)} cy={colY} r={colW / 2} fill={DIM} fillOpacity="0.9" />
              : <rect x={px(mm) - colW / 2} y={colY - colH / 2} width={colW} height={colH} fill={DIM} fillOpacity="0.9" />}
            {isCombined && (
              <text x={px(mm)} y={midY + colH / 2 + 11} fontSize="9" fill={DIM} textAnchor="middle">P{i + 1}</text>
            )}
          </g>
        ))}
        {isCombined && fits && spacing > 0 && (
          <g>
            <line x1={px(centres[0])} y1={y0 - 10} x2={px(centres[1])} y2={y0 - 10} stroke={DIM} strokeWidth="1"
              markerStart="url(#fp-arrow)" markerEnd="url(#fp-arrow)" />
            <text x={(px(centres[0]) + px(centres[1])) / 2} y={y0 - 14} fontSize="9" fill={DIM} textAnchor="middle">
              {(spacing / 1000).toFixed(2)} m
            </text>
          </g>
        )}
        <line x1={x0} y1={dimY} x2={x0 + fw} y2={dimY} stroke={DIM} strokeWidth="1"
          markerStart="url(#fp-arrow)" markerEnd="url(#fp-arrow)" />
        <text x={W / 2} y={dimY + 12} fontSize="9" fill={DIM} textAnchor="middle">L = {L} mm</text>
        <line x1={x0 - 12} y1={y0} x2={x0 - 12} y2={y0 + fh} stroke={DIM} strokeWidth="1"
          markerStart="url(#fp-arrow)" markerEnd="url(#fp-arrow)" />
        <text x={x0 - 16} y={midY} fontSize="9" fill={DIM} textAnchor="middle"
          transform={`rotate(-90 ${x0 - 16} ${midY})`}>B = {B} mm</text>
      </svg>
      {!fits && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Column 2 sits {((lead + spacing) / 1000).toFixed(2)} m from the left edge, beyond the {(L / 1000).toFixed(2)} m footing length.
        </p>
      )}
    </div>
  );
}