// src/pages/StructuralInput.jsx — Slab Input (one-way + two-way), mockup-faithful
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiGrid, FiMinus, FiColumns, FiBox, FiSquare, FiActivity, FiLayers,
  FiSettings, FiHelpCircle, FiHome, FiChevronRight, FiChevronDown,
  FiFilePlus, FiFolder, FiSave, FiMoreVertical, FiInfo, FiRefreshCw,
  FiArrowRight, FiCheck, FiLoader, FiAlertTriangle,
} from "react-icons/fi";
import { slabAPI } from "../services/api";
import DesignProgressBar from "../components/ui/DesignProgressBar";

const INPUT_DRAFT_KEY = "structuralInputDraft";

/* ================================================================== */
/*  SHARED CLASS TOKENS  (your existing light/dark palette)           */
/* ================================================================== */
const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const SECTION_TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

/* ================================================================== */
/*  OPTION SETS                                                       */
/* ================================================================== */
const TWO_WAY_CONTINUITY = [
  { value: "all_edges_discontinuous", label: "Simply Supported (SSSS)", edges: { top: 0, right: 0, bottom: 0, left: 0 } },
  { value: "all_edges_continuous", label: "All Edges Continuous", edges: { top: 1, right: 1, bottom: 1, left: 1 } },
  { value: "one_short_discontinuous", label: "One Short Edge Discontinuous", edges: { top: 0, right: 1, bottom: 1, left: 1 } },
  { value: "one_long_discontinuous", label: "One Long Edge Discontinuous", edges: { top: 1, right: 0, bottom: 1, left: 1 } },
  { value: "two_adjacent_discontinuous", label: "Two Adjacent Edges Discontinuous", edges: { top: 0, right: 0, bottom: 1, left: 1 } },
  { value: "two_short_discontinuous", label: "Two Short Edges Discontinuous", edges: { top: 0, right: 1, bottom: 0, left: 1 } },
  { value: "two_long_discontinuous", label: "Two Long Edges Discontinuous", edges: { top: 1, right: 0, bottom: 1, left: 0 } },
  { value: "three_edges_one_long_continuous", label: "Three Edges Discontinuous (One Long Continuous)", edges: { top: 1, right: 0, bottom: 0, left: 0 } },
  { value: "three_edges_one_short_continuous", label: "Three Edges Discontinuous (One Short Continuous)", edges: { top: 0, right: 1, bottom: 0, left: 0 } },
];
const ONE_WAY_CONTINUITY = [
  { value: "simply_supported", label: "Simply Supported", support: "simple" },
  { value: "one_end_continuous", label: "One End Continuous", support: "one_fixed" },
  { value: "both_ends_continuous", label: "Both Ends Continuous", support: "both_fixed" },
  { value: "cantilever", label: "Cantilever", support: "cantilever" },
];
// NOTE: backend now has a matching OneWayContinuity enum + slab_type validator.

const CONCRETE_GRADES = [
  { value: "C20/25", label: "C20/25 (fck = 20 MPa)" },
  { value: "C25/30", label: "C25/30 (fck = 25 MPa)" },
  { value: "C30/37", label: "C30/37 (fck = 30 MPa)" },
  { value: "C35/45", label: "C35/45 (fck = 35 MPa)" },
  { value: "C40/50", label: "C40/50 (fck = 40 MPa)" },
];
const STEEL_GRADES = [
  { value: "B500", label: "B500B (fyk = 500 MPa)" },
  { value: "B460", label: "B460B (fyk = 460 MPa)" },
];
// BS8110 and ACI318 are blocked server-side (models/schemas.py); the BS-only
// grade sets and the multi-code dropdown that used to drive them are gone.
// EC2 is the only code this page can produce, so it's shown as a fixed
// label rather than a choice -- same treatment as the column and continuous
// slab input pages.
const DESIGN_CODES = [
  { value: "EC2", label: "EN 1992-1-1 (Eurocode 2)" },
];
const ANALYSIS_METHODS = [
  { value: "limit_state", label: "Limit State Method" },
  { value: "working_stress", label: "Working Stress Method" },
  { value: "elastic", label: "Elastic Analysis" },
];

// Values map to the engine's classify_occupancy() keys (anything else → office).
// qk = indicative imposed load, EN 1991-1-1 Table 6.2 — applied to the Live Load
// field on selection, but the user can still edit it freely afterwards.
const BUILDING_USES = [
  { value: "office", label: "Office", qk: 2.5 },
  { value: "residential", label: "Residential", qk: 1.5 },
  { value: "hotel", label: "Hotel", qk: 2.0 },
  { value: "education", label: "Education / School", qk: 3.0 },
  { value: "retail", label: "Retail", qk: 4.0 },
  { value: "shopping_mall", label: "Shopping Mall", qk: 5.0 },
  { value: "healthcare", label: "Healthcare", qk: 3.0 },
  { value: "hospital_ward", label: "Hospital — Ward", qk: 2.0 },
];

// Main bar diameters offered for the slab (mm)
const MAIN_BARS = [
  { value: "8", label: "\u00d88" }, { value: "10", label: "\u00d810" },
  { value: "12", label: "\u00d812" }, { value: "16", label: "\u00d816" },
  { value: "20", label: "\u00d820" },
];

const NAV = [
  { id: "slab", label: "Slab", icon: FiGrid },
  { id: "beam", label: "Beam", icon: FiMinus },
  { id: "column", label: "Column", icon: FiColumns },
  { id: "footing", label: "Footing", icon: FiBox },
  { id: "wall", label: "Wall", icon: FiSquare },
  { id: "loads", label: "Load Cases", icon: FiActivity },
  { id: "materials", label: "Materials", icon: FiLayers },
  { id: "settings", label: "Settings", icon: FiSettings },
];

const DEFAULTS = {
  slabType: "two-way",
  continuity: "all_edges_continuous",
  spanLx: "4000",   // mm  (short span)
  spanLy: "5000",   // mm  (long span)
  thickness: "175", // mm
  clearCover: "25", // mm — backend always adds a fixed +5mm detailing tolerance on top of this; not user-configurable
  mainBarDia: "12", // mm assumed main bar
  concreteGrade: "C30/37",
  steelGrade: "B500",
  unitWeightConcrete: "25",
  unitWeightSteel: "78.5",
  // NOTE: no standalone "dead load" / "permanent load" field on purpose —
  // the backend derives permanent load (self-weight) from thickness x unit
  // weight automatically. Only extra/superimposed loads are entered here.
  floorFinish: "1.0",
  liveLoad: "3.0",
  additionalDeadLoad: "0",
  additionalLiveLoad: "0",
  designCode: "EC2",
  analysisMethod: "limit_state",
  buildingUse: "office",
  serviceabilityCheck: true,
  exposureClass: "XC3",
  crackWidthLimit: "0.3",
  fireRating: "60",
  deflectionLimit: "250",

  // Printed on the first page of the Detailed Report. Blank stays blank.
  designerName: "", designerQualifications: "",
  checkedBy: "", checkerQualifications: "",
  stabilityResponsible: "", independentCheck: "",
};

/* ================================================================== */
/*  MAIN                                                              */
/* ================================================================== */
const StructuralInput = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem(INPUT_DRAFT_KEY);
      if (!saved) return DEFAULTS;
      const parsed = JSON.parse(saved);
      // BS8110/ACI318 are blocked server-side. A draft saved before that
      // existed could still carry one, which would otherwise 422 silently
      // until Reset is pressed -- normalize it here instead.
      if (parsed.designCode && parsed.designCode !== "EC2") parsed.designCode = "EC2";
      return { ...DEFAULTS, ...parsed };
    } catch {
      return DEFAULTS;
    }
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isOptimising, setIsOptimising] = useState(false);
  const [error, setError] = useState(null);

  // Persist every change so navigating to /slab-results and back restores it.
  useEffect(() => {
    try {
      sessionStorage.setItem(INPUT_DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) -- draft just won't persist
    }
  }, [formData]);

  const set = (patch) => setFormData((prev) => ({ ...prev, ...patch }));
  const twoWay = formData.slabType === "two-way";
  const continuityOptions = twoWay ? TWO_WAY_CONTINUITY : ONE_WAY_CONTINUITY;
  const continuityLabel = continuityOptions.find((o) => o.value === formData.continuity)?.label || "—";

  const handleSlabType = (type) =>
    set({ slabType: type, continuity: type === "two-way" ? "all_edges_continuous" : "simply_supported" });

  // derived loads
  const ff = parseFloat(formData.floorFinish) || 0;
  const ll = parseFloat(formData.liveLoad) || 0;
  const adl = parseFloat(formData.additionalDeadLoad) || 0;
  const all_ = parseFloat(formData.additionalLiveLoad) || 0;
  const totalLoad = ff + ll + adl + all_;   // self-weight added on the backend

  const handleReset = () => {
    if (window.confirm("Reset all fields to defaults?")) {
      setFormData(DEFAULTS);
      setError(null);
      try {
        sessionStorage.removeItem(INPUT_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  };

  const handleValidate = () => {
    setIsValidating(true);
    setError(null);
    setTimeout(() => {
      setIsValidating(false);
      const lx = parseFloat(formData.spanLx); // mm
      const ly = parseFloat(formData.spanLy); // mm
      const t = parseFloat(formData.thickness);
      const cover = parseFloat(formData.clearCover);
      if (!lx || lx <= 0 || (twoWay && (!ly || ly <= 0))) return setError("Span values must be greater than zero.");
      if (twoWay && lx > ly) return setError("Lx (short span) must be less than or equal to Ly (long span).");
      if (t < 100) return setError("Slab thickness must be at least 100 mm.");
      if (cover < 15) return setError("Clear cover must be at least 15 mm.");
      const barGuess = parseFloat(formData.mainBarDia) || 12;
      const d = t - (cover + 5) - barGuess / 2;   // matches backend: cover + fixed 5mm tolerance, minus half the bar
      const ratio = lx / d;
      if (ratio > 40) return setError(`Span/depth ratio (${ratio.toFixed(1)}) exceeds 40. Increase thickness.`);
      window.alert("Validation passed. All inputs are within acceptable ranges.");
    }, 400);
  };

  const handleOptimise = async () => {
    const lx = parseFloat(formData.spanLx), ly = parseFloat(formData.spanLy);
    if (!(lx > 0) || (twoWay && !(ly > 0))) {
      setError("Enter valid span dimensions (mm).");
      return;
    }
    if (twoWay && lx > ly) {
      setError("Lx (short span) must not be greater than Ly (long span). Swap the values or correct your entry.");
      return;
    }
    setIsOptimising(true);
    setError(null);
    try {
      const result = await slabAPI.startDesign(formData);
      setIsOptimising(false);
      navigate("/slab-results", { state: { designResult: result, formData } });
    } catch (e) {
      setIsOptimising(false);
      setError(
        e.message === "Failed to fetch"
          ? "Cannot reach the design engine. Make sure the backend is running at http://localhost:8000"
          : e.message
      );
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f3f4f6] dark:bg-[#111827]">
      {/* <Sidebar active="slab" navigate={navigate} /> */}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar twoWay={twoWay} navigate={navigate} onReset={handleReset} />

        <div className="flex-1 px-6 py-6">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          <DesignProgressBar active={isOptimising} />

          {/* page title */}
          <div className="mb-5">
            <h1 className={`text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]`}>
              {twoWay ? "Two-Way Slab Input" : "One-Way Slab Input"}
            </h1>
            <p className={`text-sm ${SUB}`}>Enter slab details, material properties, loads and support conditions.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ===================== LEFT: FORM ===================== */}
            <div className="lg:col-span-2 space-y-5">
              {/* 1. SLAB BEHAVIOR */}
              <Section n="1" title="Slab Behavior">
                <div className="grid grid-cols-2 gap-4">
                  <BehaviorCard type="two-way" selected={formData.slabType} onClick={() => handleSlabType("two-way")} />
                  <BehaviorCard type="one-way" selected={formData.slabType} onClick={() => handleSlabType("one-way")} />
                </div>
              </Section>

              {/* 2. CONTINUITY */}
              <Section n="2" title={`Slab Continuity (Support Conditions)`} info>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {continuityOptions.map((opt) => (
                    <ContinuityCard key={opt.value} option={opt} twoWay={twoWay} selected={formData.continuity} onClick={() => set({ continuity: opt.value })} />
                  ))}
                </div>
              </Section>

              {/* 3. GEOMETRY */}
              <Section n="3" title="Geometry" info>
                <div className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                  <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                    {twoWay ? "Ly is the longer span of the slab. Lx is the shorter span of the slab." : "L is the clear span of the slab."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {twoWay && (
                    <Field label="Long Span (Ly)" unit="mm" value={formData.spanLy} onChange={(v) => set({ spanLy: v })} step="50" />
                  )}
                  <Field label={twoWay ? "Short Span (Lx)" : "Span (L)"} unit="mm" value={formData.spanLx} onChange={(v) => set({ spanLx: v })} step="50" />
                  <Field label="Thickness (t)" unit="mm" value={formData.thickness} onChange={(v) => set({ thickness: v })} step="5" />
                  <div>
                    <Field label="Clear Cover" unit="mm" value={formData.clearCover} onChange={(v) => set({ clearCover: v })} step="5" />
                    <p className={`mt-1 text-[10px] ${SUB}`}>
                      +5 mm fixing tolerance (fixed) &rarr; detail at {(parseFloat(formData.clearCover) || 0) + 5} mm
                    </p>
                  </div>
                  <div>
                    <label className={LABEL}>Main Bar &Oslash; <span className="text-[#94a3b8]">(mm)</span></label>
                    <Dropdown value={formData.mainBarDia} onChange={(e) => set({ mainBarDia: e.target.value })} options={MAIN_BARS} />
                    <p className={`mt-1 text-[10px] ${SUB}`}>Used for d = h &minus; c &minus; &phi;/2</p>
                  </div>
                </div>
              </Section>

              {/* 4. MATERIALS */}
              <Section n="4" title="Material Properties" info>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Concrete Grade</label>
                    <Dropdown value={formData.concreteGrade} onChange={(e) => set({ concreteGrade: e.target.value })} options={CONCRETE_GRADES} />
                  </div>
                  <div>
                    <label className={LABEL}>Steel Grade</label>
                    <Dropdown value={formData.steelGrade} onChange={(e) => set({ steelGrade: e.target.value })} options={STEEL_GRADES} />
                  </div>
                  <Field label="Unit Weight of Concrete" unit="kN/m³" value={formData.unitWeightConcrete} onChange={(v) => set({ unitWeightConcrete: v })} step="0.5" />
                  <Field label="Unit Weight of Steel" unit="kN/m³" value={formData.unitWeightSteel} onChange={(v) => set({ unitWeightSteel: v })} step="0.5" />
                </div>
              </Section>

              {/* 5. LOADS */}
              <Section n="5" title="Loads" info>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Floor Finish / Additional DL" unit="kN/m²" value={formData.floorFinish} onChange={(v) => set({ floorFinish: v })} step="0.5" />
                  <div>
                    <Field label="Live Load (LL)" unit="kN/m²" value={formData.liveLoad} onChange={(v) => set({ liveLoad: v })} step="0.5" />
                    <p className={`mt-1 text-[10px] ${SUB}`}>Auto-set from Building Use (EN 1991-1-1 Table 6.2) &mdash; edit freely.</p>
                  </div>
                  <Field label="Extra Dead Load" unit="kN/m²" value={formData.additionalDeadLoad} onChange={(v) => set({ additionalDeadLoad: v })} step="0.5" />
                  <Field label="Extra Live Load" unit="kN/m²" value={formData.additionalLiveLoad} onChange={(v) => set({ additionalLiveLoad: v })} step="0.5" />
                  <div>
                    <label className={LABEL}>Total Load (DL + LL)</label>
                    <div className="flex items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#475569] bg-[#f1f5f9] dark:bg-[#334155] px-3 py-2">
                      <span className="font-mono text-sm font-bold text-[#0A2F44] dark:text-[#66a4c2]">{totalLoad.toFixed(2)}</span>
                      <span className={`text-xs ${SUB}`}>kN/m²</span>
                    </div>
                  </div>
                </div>
              </Section>

              {/* 6. DESIGN PREFERENCES */}
              <Section n="6" title="Design Preferences" optional info>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className={LABEL}>Design Code</label>
                    <div className="flex h-[42px] items-center rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3 font-mono text-sm">
                      <span className={MAIN}>{DESIGN_CODES[0].label}</span>
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Analysis Method</label>
                    <Dropdown value={formData.analysisMethod} onChange={(e) => set({ analysisMethod: e.target.value })} options={ANALYSIS_METHODS} />
                  </div>
                  <div>
                    <label className={LABEL}>Building Use</label>
                    <Dropdown value={formData.buildingUse} onChange={(e) => {
                      const u = BUILDING_USES.find((o) => o.value === e.target.value);
                      set({ buildingUse: e.target.value, ...(u && u.qk != null ? { liveLoad: String(u.qk) } : {}) });
                    }} options={BUILDING_USES} />
                  </div>
                  <div>
                    <label className={LABEL}>Serviceability Check</label>
                    <div className="flex h-[42px] items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3">
                      <span className={`text-xs ${SUB}`}>Deflection &amp; crack width</span>
                      <Toggle checked={formData.serviceabilityCheck} onChange={(c) => set({ serviceabilityCheck: c })} />
                    </div>
                  </div>
                </div>
              </Section>

              {/* 7. DESIGN BASIS */}
              <Section n="7" title="Design Basis" optional>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={LABEL}>Designed by</label>
                    <input className={INPUT} value={formData.designerName} onChange={(e) => set({ designerName: e.target.value })} /></div>
                  <div><label className={LABEL}>Designer's qualifications</label>
                    <input className={INPUT} value={formData.designerQualifications} onChange={(e) => set({ designerQualifications: e.target.value })} /></div>
                  <div><label className={LABEL}>Checked by</label>
                    <input className={INPUT} value={formData.checkedBy} onChange={(e) => set({ checkedBy: e.target.value })} /></div>
                  <div><label className={LABEL}>Checker's qualifications</label>
                    <input className={INPUT} value={formData.checkerQualifications} onChange={(e) => set({ checkerQualifications: e.target.value })} /></div>
                </div>
                <div className="mt-4">
                  <label className={LABEL}>Responsible for the stability of the structure</label>
                  <input className={INPUT} value={formData.stabilityResponsible} onChange={(e) => set({ stabilityResponsible: e.target.value })} />
                </div>
                <div className="mt-4">
                  <label className={LABEL}>Independent check</label>
                  <div className="flex flex-wrap gap-2">
                    {[["", "Not stated"], ["required", "Required"], ["completed", "Completed"]].map(([val, label]) => {
                      const on = (formData.independentCheck || "") === val;
                      return (
                        <button key={label || "none"} type="button" onClick={() => set({ independentCheck: val })}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            on ? "border-[#0A2F44] bg-[#e6f0f5] text-[#0A2F44] dark:border-[#66a4c2] dark:bg-[#1e3a4a] dark:text-[#66a4c2]"
                               : `border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:border-[#94a3b8]`}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                  <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                    These are printed on the first page of the Detailed Report. Left blank, the report says "not entered".
                    Nothing is filled in for you: who designed, who checked and whether an independent check is required
                    or done are your statements, and building control asks for them with a submission. The independent
                    check is never ticked automatically.
                  </p>
                </div>
              </Section>
            </div>

            {/* ===================== RIGHT: INTELLIGENCE ===================== */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <RightCard title="Slab Preview">
                  <div className="rounded-lg bg-[#f8fafc] dark:bg-[#1e293b] p-3">
                    <SlabPreview3D lx={formData.spanLx} ly={formData.spanLy} t={formData.thickness} twoWay={twoWay} />
                  </div>
                </RightCard>

                <RightCard title={twoWay ? "Plan View (Ly is the longer side)" : "Plan View"}>
                  <PlanView lx={formData.spanLx} ly={formData.spanLy} twoWay={twoWay} />
                </RightCard>

                <RightCard title="Input Summary">
                  <div className="space-y-1.5">
                    <SumRow label="Slab Type" value={twoWay ? "Two-Way Slab" : "One-Way Slab"} />
                    <SumRow label="Slab Continuity" value={continuityLabel} />
                    {twoWay && <SumRow label="Long Span (Ly)" value={`${formData.spanLy} mm`} />}
                    <SumRow label={twoWay ? "Short Span (Lx)" : "Span (L)"} value={`${formData.spanLx} mm`} />
                    <SumRow label="Thickness (t)" value={`${formData.thickness} mm`} />
                    <SumRow label="Concrete Grade" value={formData.concreteGrade} />
                    <SumRow label="Steel Grade" value={formData.steelGrade} />
                    <SumRow label="Floor Finish / Additional DL" value={`${ff.toFixed(2)} kN/m²`} />
                    <SumRow label="Live Load (LL)" value={`${ll.toFixed(2)} kN/m²`} />
                    <SumRow label="Total Load (DL + LL)" value={`${totalLoad.toFixed(2)} kN/m²`} strong />
                    <SumRow label="Design Code" value={DESIGN_CODES.find((c) => c.value === formData.designCode)?.label.split(" (")[0] || formData.designCode} />
                    <SumRow label="Analysis Method" value={ANALYSIS_METHODS.find((m) => m.value === formData.analysisMethod)?.label || formData.analysisMethod} />
                  </div>
                </RightCard>
              </div>
            </div>
          </div>
        </div>

        {/* footer actions */}
        <div className="border-t border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button onClick={handleReset} className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors`}>
              <FiRefreshCw size={15} /> Reset
            </button>
            <button onClick={handleValidate} disabled={isValidating} className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors disabled:opacity-50`}>
              {isValidating ? <FiLoader className="animate-spin" size={15} /> : <FiSave size={15} />} Save
            </button>
            <button onClick={handleOptimise} disabled={isOptimising} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-[#082636] transition-colors disabled:opacity-50">
              {isOptimising ? <FiLoader className="animate-spin" size={15} /> : null}
              {isOptimising ? "Optimising…" : "Proceed to Design"} <FiArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  SHELL                                                             */
/* ================================================================== */
function Sidebar({ active, navigate }) {
  return (
    <aside className="hidden md:flex w-44 shrink-0 flex-col border-r border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937]">
      <nav className="flex-1 space-y-1 p-3 pt-4">
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = id === active;
          return (
            <button
              key={id}
              onClick={() => navigate(`/${id}`)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                on
                  ? "bg-[#e6f0f5] dark:bg-[#1e3a4a] text-[#0A2F44] dark:text-[#66a4c2]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-[#e2e8f0] dark:border-[#334155] p-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]">
          <FiHelpCircle size={16} /> Help
        </button>
      </div>
    </aside>
  );
}

function TopBar({ twoWay, navigate, onReset }) {
  return (
    <header className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-2.5">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiHome size={15} /></div>
          <span className={`text-sm font-bold ${MAIN}`}>Struct Design Hub</span>
        </div>
        <nav className={`hidden md:flex items-center gap-1.5 text-[13px] ${SUB}`}>
          <span>Slab Design</span><FiChevronRight size={13} />
          <span>{twoWay ? "Two-Way Slab" : "One-Way Slab"}</span><FiChevronRight size={13} />
          <span className={`font-medium ${MAIN}`}>Input</span>
        </nav>
      </div>
      <div className="flex items-center gap-1">
        <TopBtn icon={FiFilePlus} label="New" onClick={onReset} />
        <TopBtn icon={FiFolder} label="Open" />
        <TopBtn icon={FiSave} label="Save" />
        <button className={`ml-1 rounded-md p-1.5 ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}><FiMoreVertical size={16} /></button>
      </div>
    </header>
  );
}

function TopBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ================================================================== */
/*  SECTION + FIELD PRIMITIVES                                        */
/* ================================================================== */
function Section({ n, title, info, optional, children }) {
  return (
    <div className={CARD}>
      <div className="p-5">
        <div className="mb-4 flex items-center gap-1.5">
          <h2 className={SECTION_TITLE}>{n}. {title}{optional ? <span className="ml-1 lowercase font-normal text-[#94a3b8]">(optional)</span> : null}</h2>
          {info && <FiInfo size={13} className="text-[#94a3b8]" />}
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, unit, value, onChange, step }) {
  return (
    <div>
      <label className={LABEL}>{label} {unit ? <span className="text-[#94a3b8]">({unit})</span> : null}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}

function RightCard({ title, children }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SumRow({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-xs ${SUB}`}>{label}</span>
      <span className={`text-xs ${strong ? "font-bold text-[#0A2F44] dark:text-[#66a4c2]" : `font-medium ${MAIN}`}`}>{value}</span>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#0A2F44]" : "bg-gray-300 dark:bg-gray-600"}`}>
      <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

/* Custom dropdown (click-outside to close) */
function Dropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-3 py-2 text-left hover:border-[#94a3b8] dark:hover:border-[#475569] focus:outline-none focus:ring-2 focus:ring-[#0A2F44] transition-colors">
        <span className={`font-mono text-sm ${MAIN}`}>{sel?.label || "Select…"}</span>
        <FiChevronDown className={`text-[#64748b] dark:text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] shadow-lg">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange({ target: { value: o.value } }); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a] ${
                o.value === value ? "bg-[#e6f0f5] dark:bg-[#1e3a4a] font-medium text-[#0A2F44] dark:text-[#66a4c2]" : `${MAIN}`}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  SELECTION CARDS  (with diagrams)                                  */
/* ================================================================== */
function BehaviorCard({ type, selected, onClick }) {
  const on = selected === type;
  const isTwo = type === "two-way";
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border p-4 text-center transition-all ${
        on ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a] ring-1 ring-[#0A2F44] dark:ring-[#66a4c2]"
           : "border-[#e2e8f0] dark:border-[#334155] hover:border-[#94a3b8] dark:hover:border-[#475569]"}`}>
      <div className="mb-2 flex justify-start">
        <Radio on={on} />
      </div>
      <div className={`mx-auto h-16 ${on ? "text-[#0A2F44] dark:text-[#66a4c2]" : "text-[#94a3b8]"}`}>
        {isTwo ? <TwoWayGlyph /> : <OneWayGlyph />}
      </div>
      <p className={`mt-2 text-sm font-semibold ${on ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{isTwo ? "Two-Way Slab" : "One-Way Slab"}</p>
    </button>
  );
}

function ContinuityCard({ option, twoWay, selected, onClick }) {
  const on = selected === option.value;
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border p-3 text-center transition-all ${
        on ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a] ring-1 ring-[#0A2F44] dark:ring-[#66a4c2]"
           : "border-[#e2e8f0] dark:border-[#334155] hover:border-[#94a3b8] dark:hover:border-[#475569]"}`}>
      <div className="mb-2 flex justify-start"><Radio on={on} small /></div>
      <div className={`mx-auto h-12 ${on ? "text-[#0A2F44] dark:text-[#66a4c2]" : "text-[#94a3b8]"}`}>
        {twoWay ? <EdgeGlyph edges={option.edges} /> : <BeamGlyph support={option.support} />}
      </div>
      <p className={`mt-2 text-[11px] font-medium leading-tight ${on ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{option.label}</p>
    </button>
  );
}

function Radio({ on, small }) {
  const s = small ? 14 : 16;
  return (
    <span className={`flex items-center justify-center rounded-full border-2 ${on ? "border-[#0A2F44] dark:border-[#66a4c2]" : "border-[#cbd5e1] dark:border-[#475569]"}`} style={{ width: s, height: s }}>
      {on && <span className="rounded-full bg-[#0A2F44] dark:bg-[#66a4c2]" style={{ width: s / 2.2, height: s / 2.2 }} />}
    </span>
  );
}

/* ================================================================== */
/*  GLYPHS  (currentColor → adapt to selected/dark)                   */
/* ================================================================== */
function TwoWayGlyph() {
  return (
    <svg viewBox="0 0 110 70" className="h-full w-full">
      <rect x="22" y="10" width="66" height="48" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="44" y1="10" x2="44" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="66" y1="10" x2="66" y2="58" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="22" y1="26" x2="88" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="22" y1="42" x2="88" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {[18, 62].map((y, i) => <path key={`h${i}`} d={`M10,${y + 16} l6,-3 v6 z`} fill="currentColor" />)}
      {[40].map((x) => <path key="v" d={`M${x + 15},2 l-3,6 h6 z`} fill="currentColor" />)}
    </svg>
  );
}
function OneWayGlyph() {
  return (
    <svg viewBox="0 0 110 70" className="h-full w-full">
      {[6, 10, 14].map((y, i) => <line key={i} x1="22" y1={y} x2="88" y2={y} stroke="currentColor" strokeWidth="1" opacity="0.6" />)}
      <rect x="22" y="18" width="66" height="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
      {[30, 55, 80].map((x) => <path key={x} d={`M${x},2 v10 m-3,-4 l3,4 l3,-4`} stroke="currentColor" strokeWidth="1.4" fill="none" />)}
      <path d="M22,28 l-7,12 h14 z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M88,28 l-7,12 h14 z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="40" x2="30" y2="40" stroke="currentColor" strokeWidth="1.4" />
      <line x1="80" y1="40" x2="102" y2="40" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function EdgeGlyph({ edges }) {
  const x0 = 20, y0 = 10, x1 = 90, y1 = 50;
  const ln = (on) => ({ strokeWidth: on ? 2.6 : 1, strokeDasharray: on ? "0" : "3 2", opacity: on ? 1 : 0.7 });
  return (
    <svg viewBox="0 0 110 60" className="h-full w-full">
      <line x1={x0 + 16} y1={y0} x2={x0 + 16} y2={y1} stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <line x1={x0 + 38} y1={y0} x2={x0 + 38} y2={y1} stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <line x1={x0} y1={y0 + 13} x2={x1} y2={y0 + 13} stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <line x1={x0} y1={y0 + 26} x2={x1} y2={y0 + 26} stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="currentColor" {...ln(edges.top)} />
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="currentColor" {...ln(edges.bottom)} />
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke="currentColor" {...ln(edges.left)} />
      <line x1={x1} y1={y0} x2={x1} y2={y1} stroke="currentColor" {...ln(edges.right)} />
    </svg>
  );
}
function BeamGlyph({ support }) {
  const fixed = (x) => <g><line x1={x} y1="14" x2={x} y2="40" stroke="currentColor" strokeWidth="2" />{[16, 22, 28, 34].map((y) => <line key={y} x1={x} y1={y} x2={x - 6} y2={y + 4} stroke="currentColor" strokeWidth="1" />)}</g>;
  const tri = (x) => <path d={`M${x},27 l-7,11 h14 z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" />;
  return (
    <svg viewBox="0 0 110 50" className="h-full w-full">
      <rect x="20" y="20" width="70" height="7" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
      {support === "simple" && (<>{tri(22)}{tri(88)}</>)}
      {support === "one_fixed" && (<>{fixed(20)}{tri(88)}</>)}
      {support === "both_fixed" && (<>{fixed(20)}{fixed(90)}</>)}
      {support === "cantilever" && (<>{fixed(20)}<line x1="90" y1="20" x2="100" y2="20" stroke="currentColor" strokeWidth="2" /></>)}
    </svg>
  );
}

/* ================================================================== */
/*  RIGHT-PANEL DRAWINGS (parametric, mm labels)                      */
/* ================================================================== */
function SlabPreview3D({ lx, ly, t, twoWay }) {
  const Lx = Number(lx) || 0, Ly = Number(ly) || 0;
  const ratio = twoWay && Ly ? Math.min(Math.max(Ly / (Lx || 1), 0.4), 1.2) : 0.45;
  const dx = Math.round(ratio * 55), dy = Math.round(dx * 0.55);
  const x0 = 55, x1 = 250, yTop = 70, th = 22, yBot = yTop + th;
  const topF = `${x0},${yTop} ${x1},${yTop} ${x1 + dx},${yTop - dy} ${x0 + dx},${yTop - dy}`;
  const frontF = `${x0},${yTop} ${x1},${yTop} ${x1},${yBot} ${x0},${yBot}`;
  const rightF = `${x1},${yTop} ${x1 + dx},${yTop - dy} ${x1 + dx},${yBot - dy} ${x1},${yBot}`;
  // DIM is theme-aware: navy in light, light-blue in dark (set via the wrapper class below)
  const DIM = "var(--dim)";
  return (
    <svg viewBox="0 0 320 150" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="ai" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      <polygon points={topF} fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.1" />
      <polygon points={frontF} fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.1" />
      <polygon points={rightF} fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.1" />
      {/* thickness */}
      <line x1={x1 + dx + 10} y1={yTop - dy} x2={x1 + dx + 10} y2={yBot - dy} stroke={DIM} strokeWidth="1" markerStart="url(#ai)" markerEnd="url(#ai)" />
      <text x={x1 + dx + 14} y={yTop - dy + th / 2 + 3} fontSize="9" fill={DIM}>t</text>
      <text x={x1 + dx + 14} y={yTop - dy + th / 2 + 14} fontSize="8" fill={DIM}>{t} mm</text>
      {/* Lx */}
      <line x1={x0} y1={yBot + 14} x2={x1} y2={yBot + 14} stroke={DIM} strokeWidth="1" markerStart="url(#ai)" markerEnd="url(#ai)" />
      <text x={(x0 + x1) / 2} y={yBot + 28} fontSize="8.5" fill={DIM} textAnchor="middle">{twoWay ? "Short Span (Lx)" : "Span (L)"}  {Lx} mm</text>
      {/* Ly */}
      {twoWay && (<>
        <line x1={x0} y1={yBot + 32} x2={x0 + dx} y2={yBot + 32 - dy} stroke={DIM} strokeWidth="1" markerStart="url(#ai)" markerEnd="url(#ai)" />
        <text x={(x0 + x1) / 2} y={yBot + 44} fontSize="8.5" fill={DIM} textAnchor="middle">Long Span (Ly)  {Ly} mm</text>
      </>)}
    </svg>
  );
}

function PlanView({ lx, ly, twoWay }) {
  const DIM = "var(--dim)";
  return (
    <svg viewBox="0 0 230 130" className="w-full [--dim:#0A2F44] dark:[--dim:#66a4c2] [--grid:#99c2d6] dark:[--grid:#3f5a6b]">
      <rect x="35" y="20" width="140" height="80" fill={DIM} fillOpacity="0.06" stroke={DIM} strokeWidth="2" />
      {twoWay ? (
        <>
          <line x1="105" y1="20" x2="105" y2="100" stroke="var(--grid)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="35" y1="60" x2="175" y2="60" stroke="var(--grid)" strokeWidth="1" strokeDasharray="4 3" />
        </>
      ) : (
        [55, 75, 95, 115, 135, 155].map((x) => <line key={x} x1={x} y1="20" x2={x} y2="100" stroke="var(--grid)" strokeWidth="1" />)
      )}
      {/* Lx bottom */}
      <line x1="35" y1="112" x2="175" y2="112" stroke={DIM} strokeWidth="1" />
      <text x="105" y="124" fontSize="9" fill={DIM} textAnchor="middle">{twoWay ? "Lx (Short Span)" : "L (Span)"}  {Number(lx) || 0} mm</text>
      {/* Ly right */}
      {twoWay && (<>
        <line x1="188" y1="20" x2="188" y2="100" stroke={DIM} strokeWidth="1" />
        <text x="195" y="62" fontSize="9" fill={DIM} transform="rotate(90 195 62)" textAnchor="middle">Ly (Long Span)  {Number(ly) || 0} mm</text>
      </>)}
    </svg>
  );
}

export default StructuralInput;