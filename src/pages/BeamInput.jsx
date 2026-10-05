// src/pages/BeamInput.jsx — Beam Input: Simply Supported + Continuous (in-place toggle)
//
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiChevronDown, FiInfo, FiRefreshCw, FiSave,
  FiArrowRight, FiLoader, FiAlertTriangle, FiPlus, FiMinus,
} from "react-icons/fi";
import DesignProgressBar from "../components/ui/DesignProgressBar";
import { beamAPI } from "../services/api";

const RESULTS_SIMPLE = "/beam-results";
const RESULTS_CONTINUOUS = "/continuous-beam-results";
const DRAFT_KEY = "beamInputDraft";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

const BEAM_TYPES = [
  {
    value: "simply_supported",
    label: "Simply Supported Beam",
    desc: "Single span beam with selectable end conditions (fixed, pinned, cantilever)",
    icon: "pin_pin",
  },
  {
    value: "continuous",
    label: "Continuous Beam",
    desc: "Multi-span continuous beam with pattern loading and support moments",
    icon: "continuous",
  },
];

const SUPPORTS = [
  { value: "both_ends_fixed", label: "Both Ends Fixed", glyph: "fixed_fixed" },
  { value: "one_fixed_one_simple", label: "One End Fixed, One Simply Supported", glyph: "fixed_pin" },
  { value: "one_fixed_one_free", label: "One End Fixed, One Free", glyph: "cantilever" },
  { value: "both_ends_simply_supported", label: "Both Ends Simply Supported", glyph: "pin_pin" },
];
const TOP_RESTRAINTS = [
  { value: "continuous", label: "Continuous", note: "Beam is continuous with slab over supports." },
  { value: "one_end_discontinuous", label: "One End Discontinuous", note: "Slab is continuous on one end only." },
  { value: "both_ends_discontinuous", label: "Both Ends Discontinuous", note: "Slab is discontinuous on both ends." },
];
// end_support in ContinuousBeamRequest: "simple" | "continuous"
const END_SUPPORTS = [
  { value: "simple", label: "Simple (Pinned) End Supports", note: "No hogging restraint at the two outer supports.", glyph: "pin_pin" },
  { value: "continuous", label: "Continuous End Supports", note: "Outer supports monolithic — hogging developed at ends.", glyph: "fixed_fixed" },
];

// EC2 only for now: the backend rejects BS8110 / ACI318 for beams (see the
// design-code validators in beam_schemas.py / continuous_beam_schemas.py).
// The isBS branches below are left in place for when BS 8110 is implemented.
const DESIGN_CODES = [
  { value: "EC2", label: "EN 1992-1-1 (Eurocode 2)" },
];
// A draft saved before the EC2-only change can still carry BS8110 (and its
// M25 / Fe500 grades), which the backend now rejects -- reset it to EC2.
const ec2Draft = (defaults, saved) => {
  const d = { ...defaults, ...(saved || {}) };
  if (d.designCode !== "EC2") {
    d.designCode = "EC2";
    d.concreteGrade = defaults.concreteGrade;
    d.steelGrade = defaults.steelGrade;
  }
  return d;
};
const ANALYSIS_METHODS = [
  { value: "Linear Elastic", label: "Linear Elastic" },
  { value: "Redistributed", label: "Linear Elastic + Redistribution" },
];
const CONCRETE_EC = [
  { value: "C25/30", label: "C25/30 (fck = 25 MPa)" },
  { value: "C30/37", label: "C30/37 (fck = 30 MPa)" },
  { value: "C35/45", label: "C35/45 (fck = 35 MPa)" },
];
const STEEL_EC = [{ value: "B500", label: "B500B (fyk = 500 MPa)" }, { value: "B460", label: "B460B (fyk = 460 MPa)" }];
const CONCRETE_BS = [{ value: "M20", label: "M20 (fcu = 20 MPa)" }, { value: "M25", label: "M25 (fcu = 25 MPa)" }, { value: "M30", label: "M30 (fcu = 30 MPa)" }];
const STEEL_BS = [{ value: "Fe415", label: "Fe415 (fy = 415 MPa)" }, { value: "Fe500", label: "Fe500 (fy = 500 MPa)" }];

// Bar diameters offered for a beam. The selected diameter is sent FIRST in
// bar_diameters[]; the rest follow as fallbacks in this order. The engine
// iterates the list as given — it must not sort it.
const BEAM_BARS = [12, 16, 20, 25, 32];
const LINK_BARS = [{ value: "8", label: "\u00d88" }, { value: "10", label: "\u00d810" }, { value: "12", label: "\u00d812" }];
const EXPOSURE_CLASSES = [
  { value: "XC1", label: "XC1 — Dry / permanently wet" },
  { value: "XC2", label: "XC2 — Wet, rarely dry" },
  { value: "XC3", label: "XC3 — Moderate humidity" },
  { value: "XC4", label: "XC4 — Cyclic wet and dry" },
  { value: "XD1", label: "XD1 — Chlorides, moderate humidity" },
  { value: "XS1", label: "XS1 — Airborne salt" },
];
const WORKING_LIVES = [{ value: "50", label: "50 years" }, { value: "100", label: "100 years" }];

// Design basis: free text, all blank by default. independentCheck is
// "" | "required" | "completed" and is never set for the user.
const DESIGN_BASIS_DEFAULTS = {
  designerName: "", designerQualifications: "",
  checkedBy: "", checkerQualifications: "",
  stabilityResponsible: "",
  independentCheck: "",
};

const DEFAULTS = {
  // ---- simply supported ----
  beamId: "B1",
  designCode: "EC2",
  supportCondition: "both_ends_simply_supported",
  topRestraint: "continuous",
  span: "6000", width: "300", depth: "500", effectiveCover: "25",
  leftAdjacentSpacing: "0", rightAdjacentSpacing: "0", slabThickness: "0",
  concreteGrade: "C25/30", steelGrade: "B500",
  unitWeightConcrete: "25", unitWeightSteel: "78.5",
  selfWeightAuto: true,
  wallLoad: "10", finishes: "1.5", additionalDeadLoad: "1.2",
  liveLoad: "3", otherLiveLoad: "2",
  region: "Nigeria",
  ...DESIGN_BASIS_DEFAULTS,
};

const CB_DEFAULTS = {
  beamId: "CB1",
  designCode: "EC2",
  analysisMethod: "Linear Elastic",
  nSpans: 3,
  spanLengths: ["5000", "6000", "5000", "5000", "5000", "5000", "5000", "5000"],
  width: "300",
  depth: "550",
  effectiveDepth: "",      // blank -> null -> engine derives it iteratively
  cover: "25",
  endSupport: "simple",
  concreteGrade: "C25/30",
  steelGrade: "B500",
  unitWeightConcrete: "25",
  unitWeightSteel: "78.5",
  selfWeightAuto: true,
  wallLoad: "10",
  finishes: "1.5",
  additionalDeadLoad: "1.2",
  liveLoad: "3",
  otherLiveLoad: "2",
  perSpanLoads: false,
  spanLoads: [],           // [{ index, wall_load, finishes, ... }] built on demand
  mainBarDia: "16",
  linkDiameter: "8",
  workingLife: "50",
  exposureClass: "XC1",
  crackedSectionSls: true,
  region: "Nigeria",
  ...DESIGN_BASIS_DEFAULTS,
};

const MAX_SPANS = 8;
const MIN_SPANS = 2;

const BeamInput = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Continuous is preselected when we arrive via /continuous-beam (e.g. the
  // "Back to Input" button on ContinuousBeamResults) or via nav state.
  const initialMode =
    location.state?.beamMode === "continuous" ||
    location.pathname.startsWith("/continuous-beam")
      ? "continuous"
      : "simply_supported";

  const [mode, setMode] = useState(initialMode);
  const [f, setF] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      return saved ? ec2Draft(DEFAULTS, JSON.parse(saved).ss) : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  const [c, setC] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      return saved ? ec2Draft(CB_DEFAULTS, JSON.parse(saved).cb) : CB_DEFAULTS;
    } catch { return CB_DEFAULTS; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  const setCb = (p) => setC((prev) => ({ ...prev, ...p }));
  const continuous = mode === "continuous";

  // Persist both drafts so navigating to results and back restores the form.
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ss: f, cb: c })); } catch { /* private mode */ }
  }, [f, c]);

  /* ---------------- simply supported derived ---------------- */
  const isBS = f.designCode === "BS8110";
  const concreteOpts = isBS ? CONCRETE_BS : CONCRETE_EC;
  const steelOpts = isBS ? STEEL_BS : STEEL_EC;
  const handleCode = (code) => set({ designCode: code, concreteGrade: code === "BS8110" ? "M25" : "C25/30", steelGrade: code === "BS8110" ? "Fe500" : "B500" });

  const selfW = f.selfWeightAuto ? (parseFloat(f.width) / 1000) * (parseFloat(f.depth) / 1000) * (parseFloat(f.unitWeightConcrete) || 0) : 0;
  const dl = selfW + (parseFloat(f.wallLoad) || 0) + (parseFloat(f.finishes) || 0) + (parseFloat(f.additionalDeadLoad) || 0);
  const ll = (parseFloat(f.liveLoad) || 0) + (parseFloat(f.otherLiveLoad) || 0);
  const service = dl + ll;

  /* ---------------- continuous derived ---------------- */
  const cIsBS = c.designCode === "BS8110";
  const cConcreteOpts = cIsBS ? CONCRETE_BS : CONCRETE_EC;
  const cSteelOpts = cIsBS ? STEEL_BS : STEEL_EC;
  const handleCbCode = (code) => setCb({ designCode: code, concreteGrade: code === "BS8110" ? "M25" : "C25/30", steelGrade: code === "BS8110" ? "Fe500" : "B500" });

  const cSelfW = c.selfWeightAuto ? (parseFloat(c.width) / 1000) * (parseFloat(c.depth) / 1000) * (parseFloat(c.unitWeightConcrete) || 0) : 0;
  const cDl = cSelfW + (parseFloat(c.wallLoad) || 0) + (parseFloat(c.finishes) || 0) + (parseFloat(c.additionalDeadLoad) || 0);
  const cLl = (parseFloat(c.liveLoad) || 0) + (parseFloat(c.otherLiveLoad) || 0);
  const cService = cDl + cLl;
  const activeSpans = c.spanLengths.slice(0, c.nSpans);
  const totalLength = activeSpans.reduce((a, v) => a + (parseFloat(v) || 0), 0);

  // Chosen bar first, remaining offered diameters after it as fallbacks.
  const barOrder = (() => {
    const chosen = parseInt(c.mainBarDia, 10);
    return [chosen, ...BEAM_BARS.filter((b) => b !== chosen)];
  })();

  const setSpanCount = (n) => {
    const next = Math.min(MAX_SPANS, Math.max(MIN_SPANS, n));
    setCb({ nSpans: next });
  };
  const setSpanLength = (i, v) => {
    const arr = [...c.spanLengths];
    arr[i] = v;
    setCb({ spanLengths: arr });
  };
  const setSpanLoad = (i, key, v) => {
    const arr = [...(c.spanLoads || [])];
    while (arr.length < c.nSpans) arr.push({ index: arr.length + 1 });
    arr[i] = { ...arr[i], index: i + 1, [key]: v };
    setCb({ spanLoads: arr });
  };
  const spanLoadVal = (i, key) => (c.spanLoads?.[i]?.[key] ?? "");

  const reset = () => {
    if (!window.confirm("Reset all fields?")) return;
    if (continuous) setC(CB_DEFAULTS); else setF(DEFAULTS);
    setError(null);
  };

  /* ---------------- submit: simply supported ---------------- */
  const proceedSimple = async () => {
    setBusy(true); setError(null);
    try {
      const result = await beamAPI.startDesign(f);
      navigate(RESULTS_SIMPLE, { state: { designResult: result } });
    } catch (e) {
      setError(e.message || "Design request failed.");
    } finally { setBusy(false); }
  };

  /* ---------------- submit: continuous ---------------- */
  const buildContinuousPayload = () => {
    const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
    const optNum = (v) => { if (v === "" || v === null || v === undefined) return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

    const spanLoads = c.perSpanLoads
      ? activeSpans.map((_, i) => ({
          index: i + 1,
          wall_load: optNum(spanLoadVal(i, "wall_load")),
          finishes: optNum(spanLoadVal(i, "finishes")),
          additional_dead_load: optNum(spanLoadVal(i, "additional_dead_load")),
          live_load: optNum(spanLoadVal(i, "live_load")),
          other_live_load: optNum(spanLoadVal(i, "other_live_load")),
        }))
      : null;

    return {
      beam_id: c.beamId,
      design_code: c.designCode,
      analysis_method: c.analysisMethod,
      geometry: {
        n_spans: c.nSpans,
        span_lengths: activeSpans.map((v) => num(v)),
        width: num(c.width),
        depth: num(c.depth),
        effective_depth: optNum(c.effectiveDepth),
        cover: num(c.cover),
      },
      materials: {
        concrete_grade: c.concreteGrade,
        steel_grade: c.steelGrade,
        unit_weight_concrete: num(c.unitWeightConcrete, 25),
        unit_weight_steel: num(c.unitWeightSteel, 78.5),
      },
      loads: {
        self_weight_auto: !!c.selfWeightAuto,
        wall_load: num(c.wallLoad),
        finishes: num(c.finishes),
        additional_dead_load: num(c.additionalDeadLoad),
        live_load: num(c.liveLoad),
        other_live_load: num(c.otherLiveLoad),
      },
      span_loads: spanLoads,
      end_support: c.endSupport,
      design_params: {
        design_working_life: parseInt(c.workingLife, 10) || 50,
        exposure_class: c.exposureClass,
        cracked_section_sls: !!c.crackedSectionSls,
      },
      bar_diameters: barOrder,
      link_diameter: parseInt(c.linkDiameter, 10) || 8,
      region: c.region,
      design_basis: {
        designer_name: (c.designerName || "").trim() || null,
        designer_qualifications: (c.designerQualifications || "").trim() || null,
        checked_by: (c.checkedBy || "").trim() || null,
        checker_qualifications: (c.checkerQualifications || "").trim() || null,
        stability_responsible: (c.stabilityResponsible || "").trim() || null,
        independent_check: c.independentCheck || null,
      },
    };
  };

  const validateContinuous = () => {
    if (c.nSpans < MIN_SPANS || c.nSpans > MAX_SPANS) return `Number of spans must be between ${MIN_SPANS} and ${MAX_SPANS}.`;
    for (let i = 0; i < c.nSpans; i += 1) {
      const L = parseFloat(activeSpans[i]);
      if (!(L > 0)) return `Span ${i + 1} length must be greater than zero.`;
    }
    if (!(parseFloat(c.width) > 0)) return "Beam width must be greater than zero.";
    if (!(parseFloat(c.depth) > 0)) return "Overall depth must be greater than zero.";
    if (!(parseFloat(c.cover) > 0)) return "Cover must be greater than zero.";
    const dGuess = parseFloat(c.depth) - (parseFloat(c.cover) + 5) - parseInt(c.linkDiameter, 10) - parseInt(c.mainBarDia, 10) / 2;
    if (!(dGuess > 0)) return "Overall depth is too small for the chosen cover, links and main bar.";
    return null;
  };

  const proceedContinuous = async () => {
    const problem = validateContinuous();
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      // NOTE: confirm this function name in src/services/api.js
      const result = await beamAPI.startContinuousDesign(buildContinuousPayload());
      navigate(RESULTS_CONTINUOUS, { state: { designResult: result } });
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Cannot reach the design engine. Make sure the backend is running at http://localhost:8000"
          : e.message || "Design request failed."
      );
    } finally { setBusy(false); }
  };

  const supportLabel = SUPPORTS.find((s) => s.value === f.supportCondition)?.label || "—";
  const endSupportLabel = END_SUPPORTS.find((s) => s.value === c.endSupport)?.label || "—";

  return (
    <div className="flex flex-col">
      <div className="flex-1">
        {/* BEAM TYPE SELECTOR — toggles content in place */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-[#0A2F44] dark:text-[#66a4c2] uppercase tracking-wide mb-3">Select Beam Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BEAM_TYPES.map((bt) => {
              const on = bt.value === mode;
              return (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => { setMode(bt.value); setError(null); }}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    on
                      ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a] ring-1 ring-[#0A2F44]"
                      : "border-[#e2e8f0] dark:border-[#334155] hover:border-[#94a3b8] dark:hover:border-[#475569] bg-white dark:bg-[#1f2937]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${on ? "bg-[#0A2F44]/10 dark:bg-[#0A2F44]/20" : "bg-[#f1f5f9] dark:bg-[#334155]"}`}>
                      <BeamTypeGlyph kind={bt.icon} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${on ? "text-[#0A2F44] dark:text-[#66a4c2]" : "text-[#0F172A] dark:text-white"}`}>{bt.label}</p>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{bt.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <DesignProgressBar active={busy} />

        <div className="mb-5">
          <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">
            {continuous ? "Continuous Beam Input" : "Simply Supported Beam Input"}
          </h1>
          <p className={`text-sm ${SUB}`}>
            {continuous
              ? "Enter span arrangement, section, material properties and loads. Pattern loading is applied by the engine."
              : "Enter beam details, material properties, loads and support conditions."}
          </p>
        </div>

        {continuous ? (
          /* ============================ CONTINUOUS ============================ */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              {/* 1. GENERAL */}
              <Section n="1" title="General">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Beam Name / ID</label>
                    <input className={INPUT} value={c.beamId} onChange={(e) => setCb({ beamId: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>Design Code</label>
                    <Dropdown value={c.designCode} onChange={(e) => handleCbCode(e.target.value)} options={DESIGN_CODES} />
                  </div>
                  <div>
                    <label className={LABEL}>Analysis Method</label>
                    <Dropdown value={c.analysisMethod} onChange={(e) => setCb({ analysisMethod: e.target.value })} options={ANALYSIS_METHODS} />
                  </div>
                  <div>
                    <label className={LABEL}>Region</label>
                    <input className={INPUT} value={c.region} onChange={(e) => setCb({ region: e.target.value })} />
                  </div>
                </div>
              </Section>

              {/* 2. SPANS */}
              <Section n="2" title="Span Arrangement" info>
                <div className="mb-4 flex items-center gap-3">
                  <span className={`text-xs font-semibold ${SUB}`}>Number of Spans</span>
                  <div className="flex items-center gap-2">
                    <StepBtn onClick={() => setSpanCount(c.nSpans - 1)} disabled={c.nSpans <= MIN_SPANS} icon={FiMinus} />
                    <span className={`w-10 text-center font-mono text-sm font-bold ${MAIN}`}>{c.nSpans}</span>
                    <StepBtn onClick={() => setSpanCount(c.nSpans + 1)} disabled={c.nSpans >= MAX_SPANS} icon={FiPlus} />
                  </div>
                  <span className={`text-[11px] ${SUB}`}>({MIN_SPANS}–{MAX_SPANS})</span>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {activeSpans.map((v, i) => (
                    <Field key={i} label={`Span L${i + 1}`} unit="mm" value={v} onChange={(val) => setSpanLength(i, val)} step="100" />
                  ))}
                </div>
                <p className={`mt-2 text-[11px] ${SUB}`}>
                  Total length = {totalLength.toFixed(0)} mm over {c.nSpans + 1} supports.
                </p>

                <p className={`mb-2 mt-5 text-xs font-semibold ${SUB}`}>2.1 End Support Condition</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {END_SUPPORTS.map((s) => (
                    <SelectCard key={s.value} selected={c.endSupport === s.value} onClick={() => setCb({ endSupport: s.value })} label={s.label} sub={s.note} glyph={<BeamGlyph kind={s.glyph} />} />
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                  <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                    Interior supports are always continuous. The engine applies the standard load patterns
                    (all spans loaded, alternate spans, and adjacent pairs at each support) and takes the envelope.
                  </p>
                </div>
              </Section>

              {/* 3. SECTION GEOMETRY */}
              <Section n="3" title="Section Geometry">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Field label="Width (b)" unit="mm" value={c.width} onChange={(v) => setCb({ width: v })} step="25" />
                  <Field label="Overall Depth (D)" unit="mm" value={c.depth} onChange={(v) => setCb({ depth: v })} step="25" />
                  <div>
                    <Field label="Cover" unit="mm" value={c.cover} onChange={(v) => setCb({ cover: v })} step="5" />
                    <p className={`mt-1 text-[10px] ${SUB}`}>
                      +5 mm fixing tolerance (fixed) &rarr; detail at {(parseFloat(c.cover) || 0) + 5} mm
                    </p>
                  </div>
                  <div>
                    <Field label="Effective Depth (d)" unit="mm" value={c.effectiveDepth} onChange={(v) => setCb({ effectiveDepth: v })} step="5" />
                    <p className={`mt-1 text-[10px] ${SUB}`}>Leave blank to let the engine derive d from the selected bar.</p>
                  </div>
                </div>
              </Section>

              {/* 4. MATERIALS */}
              <Section n="4" title="Materials">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={LABEL}>Concrete Grade</label><Dropdown value={c.concreteGrade} onChange={(e) => setCb({ concreteGrade: e.target.value })} options={cConcreteOpts} /></div>
                  <div><label className={LABEL}>Steel Grade</label><Dropdown value={c.steelGrade} onChange={(e) => setCb({ steelGrade: e.target.value })} options={cSteelOpts} /></div>
                  <Field label="Unit Weight of Concrete" unit="kN/m³" value={c.unitWeightConcrete} onChange={(v) => setCb({ unitWeightConcrete: v })} step="0.5" />
                  <Field label="Unit Weight of Steel" unit="kN/m³" value={c.unitWeightSteel} onChange={(v) => setCb({ unitWeightSteel: v })} step="0.5" />
                </div>
              </Section>

              {/* 5. DESIGN BASIS */}
              <DesignBasisSection n="5" v={c} onChange={setCb} />

              {/* 6. LOADS */}
              <Section n="6" title="Loads" info>
                <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="px-3 py-2 font-semibold">Load Type</th>
                        <th className="px-3 py-2 font-semibold">Value (kN/m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[#f1f5f9] dark:border-[#334155]">
                        <td className={`px-3 py-2 ${MAIN}`}>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={c.selfWeightAuto} onChange={(e) => setCb({ selfWeightAuto: e.target.checked })} />
                            Beam Self Weight <span className={`text-xs ${SUB}`}>(auto)</span>
                          </label>
                        </td>
                        <td className={`px-3 py-2 font-mono ${SUB}`}>{cSelfW.toFixed(2)}</td>
                      </tr>
                      <LoadRow label="Wall Load (Uniform)" value={c.wallLoad} onChange={(v) => setCb({ wallLoad: v })} />
                      <LoadRow label="Finishes" value={c.finishes} onChange={(v) => setCb({ finishes: v })} />
                      <LoadRow label="Additional Dead Load (DDL)" value={c.additionalDeadLoad} onChange={(v) => setCb({ additionalDeadLoad: v })} />
                      <TotalRow label="Total Dead Load (DL)" value={cDl} />
                      <LoadRow label="Live Load (LL)" value={c.liveLoad} onChange={(v) => setCb({ liveLoad: v })} />
                      <LoadRow label="Other Live Load" value={c.otherLiveLoad} onChange={(v) => setCb({ otherLiveLoad: v })} />
                      <TotalRow label="Total Live Load (LL)" value={cLl} />
                      <TotalRow label="Total Service Load (DL + LL)" value={cService} strong />
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[11px] ${SUB}`}>These values apply to every span unless per-span overrides are enabled below.</p>

                <div className="mt-4 flex items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3 py-2">
                  <div>
                    <p className={`text-xs font-semibold ${MAIN}`}>Per-span load overrides</p>
                    <p className={`text-[11px] ${SUB}`}>Leave a cell blank to inherit the value above.</p>
                  </div>
                  <Toggle checked={c.perSpanLoads} onChange={(v) => setCb({ perSpanLoads: v })} />
                </div>

                {c.perSpanLoads && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
                          <th className="px-3 py-2 font-semibold">Span</th>
                          <th className="px-2 py-2 font-semibold">Wall</th>
                          <th className="px-2 py-2 font-semibold">Finishes</th>
                          <th className="px-2 py-2 font-semibold">Extra DL</th>
                          <th className="px-2 py-2 font-semibold">LL</th>
                          <th className="px-2 py-2 font-semibold">Other LL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSpans.map((_, i) => (
                          <tr key={i} className="border-t border-[#f1f5f9] dark:border-[#334155]">
                            <td className={`px-3 py-2 font-semibold ${MAIN}`}>L{i + 1}</td>
                            {["wall_load", "finishes", "additional_dead_load", "live_load", "other_live_load"].map((k) => (
                              <td key={k} className="px-2 py-1.5">
                                <input type="number" step="0.5" placeholder="—" value={spanLoadVal(i, k)} onChange={(e) => setSpanLoad(i, k, e.target.value)} className={`${INPUT} py-1`} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* 7. REINFORCEMENT & DESIGN PARAMS */}
              <Section n="7" title="Reinforcement &amp; Design Parameters" info>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className={LABEL}>Preferred Main Bar &Oslash; <span className="text-[#94a3b8]">(mm)</span></label>
                    <Dropdown
                      value={c.mainBarDia}
                      onChange={(e) => setCb({ mainBarDia: e.target.value })}
                      options={BEAM_BARS.map((b) => ({ value: String(b), label: `\u00d8${b}` }))}
                    />
                    <p className={`mt-1 text-[10px] ${SUB}`}>Tried first; {barOrder.slice(1).map((b) => `\u00d8${b}`).join(", ")} used as fallbacks in that order.</p>
                  </div>
                  <div>
                    <label className={LABEL}>Link &Oslash; <span className="text-[#94a3b8]">(mm)</span></label>
                    <Dropdown value={c.linkDiameter} onChange={(e) => setCb({ linkDiameter: e.target.value })} options={LINK_BARS} />
                  </div>
                  <div>
                    <label className={LABEL}>Exposure Class</label>
                    <Dropdown value={c.exposureClass} onChange={(e) => setCb({ exposureClass: e.target.value })} options={EXPOSURE_CLASSES} />
                  </div>
                  <div>
                    <label className={LABEL}>Design Working Life</label>
                    <Dropdown value={c.workingLife} onChange={(e) => setCb({ workingLife: e.target.value })} options={WORKING_LIVES} />
                  </div>
                  <div>
                    <label className={LABEL}>Cracked Section (SLS)</label>
                    <div className="flex h-[42px] items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3">
                      <span className={`text-xs ${SUB}`}>Use cracked stiffness</span>
                      <Toggle checked={c.crackedSectionSls} onChange={(v) => setCb({ crackedSectionSls: v })} />
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            {/* RIGHT — continuous */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <RightCard title="Beam Preview — Elevation">
                  <ContinuousElevation lengths={activeSpans} endSupport={c.endSupport} />
                </RightCard>
                <RightCard title="Cross Section">
                  <CrossSection width={c.width} depth={c.depth} />
                </RightCard>
                <RightCard title="Input Summary">
                  <div className="space-y-1.5">
                    <SumRow label="Beam Name / ID" value={c.beamId} />
                    <SumRow label="No. of Spans" value={c.nSpans} />
                    <SumRow label="Span Lengths" value={`${activeSpans.join(", ")} mm`} />
                    <SumRow label="Total Length" value={`${totalLength.toFixed(0)} mm`} />
                    <SumRow label="End Supports" value={endSupportLabel} />
                    <SumRow label="Width (b)" value={`${c.width} mm`} />
                    <SumRow label="Overall Depth (D)" value={`${c.depth} mm`} />
                    <SumRow label="Cover" value={`${c.cover} mm`} />
                    <SumRow label="Effective Depth (d)" value={c.effectiveDepth ? `${c.effectiveDepth} mm` : "auto"} />
                    <SumRow label="Concrete Grade" value={c.concreteGrade} />
                    <SumRow label="Steel Grade" value={c.steelGrade} />
                    <SumRow label="Main Bar" value={`\u00d8${c.mainBarDia}`} />
                    <SumRow label="Total Dead Load (DL)" value={`${cDl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Live Load (LL)" value={`${cLl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Service Load" value={`${cService.toFixed(2)} kN/m`} strong />
                    <SumRow label="Design Code" value={c.designCode} />
                  </div>
                </RightCard>
              </div>
            </div>
          </div>
        ) : (
          /* ========================= SIMPLY SUPPORTED ========================= */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              {/* 1. GENERAL */}
              <Section n="1" title="General">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Beam Name / ID</label>
                    <input className={INPUT} value={f.beamId} onChange={(e) => set({ beamId: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>Design Code</label>
                    <Dropdown value={f.designCode} onChange={(e) => handleCode(e.target.value)} options={DESIGN_CODES} />
                  </div>
                </div>
              </Section>

              {/* 2. SUPPORT CONDITIONS */}
              <Section n="2" title="Support Conditions" info>
                <p className={`mb-2 text-xs font-semibold ${SUB}`}>2.1 Select End Support Condition</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {SUPPORTS.map((s) => (
                    <SelectCard key={s.value} selected={f.supportCondition === s.value} onClick={() => set({ supportCondition: s.value })} label={s.label} glyph={<BeamGlyph kind={s.glyph} />} />
                  ))}
                </div>
                <p className={`mb-2 mt-5 text-xs font-semibold ${SUB}`}>2.2 Slab Continuity (Top Restraint)</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {TOP_RESTRAINTS.map((r) => (
                    <SelectCard key={r.value} selected={f.topRestraint === r.value} onClick={() => set({ topRestraint: r.value })} label={r.label} sub={r.note} glyph={<RestraintGlyph value={r.value} />} />
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                  <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">Top restraint from continuous slab affects negative moment capacity and deflection.</p>
                </div>
              </Section>

              {/* 3. GEOMETRY */}
              <Section n="3" title="Geometry">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Field label="Span (L)" unit="mm" value={f.span} onChange={(v) => set({ span: v })} step="100" />
                  <Field label="Width (b)" unit="mm" value={f.width} onChange={(v) => set({ width: v })} step="25" />
                  <Field label="Overall Depth (D)" unit="mm" value={f.depth} onChange={(v) => set({ depth: v })} step="25" />
                  <Field label="Effective Cover (c_c)" unit="mm" value={f.effectiveCover} onChange={(v) => set({ effectiveCover: v })} step="5" />
                  <Field label="Slab Thickness (flange)" unit="mm" value={f.slabThickness} onChange={(v) => set({ slabThickness: v })} step="25" />
                  <Field label="Left Adjacent Spacing" unit="mm" value={f.leftAdjacentSpacing} onChange={(v) => set({ leftAdjacentSpacing: v })} step="50" />
                  <Field label="Right Adjacent Spacing" unit="mm" value={f.rightAdjacentSpacing} onChange={(v) => set({ rightAdjacentSpacing: v })} step="50" />
                </div>
                <p className="mt-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Leave adjacent spacings at 0 to design a rectangular section. Enter the centre-to-centre spacing of adjacent beams to design as a T-beam (EC2 Cl. 5.3.2.1).
                </p>
              </Section>

              {/* 4. MATERIALS */}
              <Section n="4" title="Materials">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={LABEL}>Concrete Grade</label><Dropdown value={f.concreteGrade} onChange={(e) => set({ concreteGrade: e.target.value })} options={concreteOpts} /></div>
                  <div><label className={LABEL}>Steel Grade</label><Dropdown value={f.steelGrade} onChange={(e) => set({ steelGrade: e.target.value })} options={steelOpts} /></div>
                  <Field label="Unit Weight of Concrete" unit="kN/m³" value={f.unitWeightConcrete} onChange={(v) => set({ unitWeightConcrete: v })} step="0.5" />
                  <Field label="Unit Weight of Steel" unit="kN/m³" value={f.unitWeightSteel} onChange={(v) => set({ unitWeightSteel: v })} step="0.5" />
                </div>
              </Section>

              {/* 5. DESIGN BASIS */}
              <DesignBasisSection n="5" v={f} onChange={set} />

              {/* 6. LOADS */}
              <Section n="6" title="Loads">
                <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="px-3 py-2 font-semibold">Load Type</th>
                        <th className="px-3 py-2 font-semibold">Value (kN/m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[#f1f5f9] dark:border-[#334155]">
                        <td className={`px-3 py-2 ${MAIN}`}>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={f.selfWeightAuto} onChange={(e) => set({ selfWeightAuto: e.target.checked })} />
                            Beam Self Weight <span className={`text-xs ${SUB}`}>(auto)</span>
                          </label>
                        </td>
                        <td className={`px-3 py-2 font-mono ${SUB}`}>{selfW.toFixed(2)}</td>
                      </tr>
                      <LoadRow label="Wall Load (Uniform)" value={f.wallLoad} onChange={(v) => set({ wallLoad: v })} />
                      <LoadRow label="Finishes" value={f.finishes} onChange={(v) => set({ finishes: v })} />
                      <LoadRow label="Additional Dead Load (DDL)" value={f.additionalDeadLoad} onChange={(v) => set({ additionalDeadLoad: v })} />
                      <TotalRow label="Total Dead Load (DL)" value={dl} />
                      <LoadRow label="Live Load (LL)" value={f.liveLoad} onChange={(v) => set({ liveLoad: v })} />
                      <LoadRow label="Other Live Load" value={f.otherLiveLoad} onChange={(v) => set({ otherLiveLoad: v })} />
                      <TotalRow label="Total Live Load (LL)" value={ll} />
                      <TotalRow label="Total Service Load (DL + LL)" value={service} strong />
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[11px] ${SUB}`}>Factored loads are computed per the selected design code.</p>
              </Section>
            </div>

            {/* RIGHT — simply supported */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <RightCard title="Beam Preview — Elevation">
                  <ElevationView support={f.supportCondition} span={f.span} depth={f.depth} />
                </RightCard>
                <RightCard title="Cross Section">
                  <CrossSection width={f.width} depth={f.depth} />
                </RightCard>
                <RightCard title="Input Summary">
                  <div className="space-y-1.5">
                    <SumRow label="Beam Name / ID" value={f.beamId} />
                    <SumRow label="Support Condition" value={supportLabel} />
                    <SumRow label="Slab Continuity" value={TOP_RESTRAINTS.find((r) => r.value === f.topRestraint)?.label} />
                    <SumRow label="Span (L)" value={`${f.span} mm`} />
                    <SumRow label="Width (b)" value={`${f.width} mm`} />
                    <SumRow label="Overall Depth (D)" value={`${f.depth} mm`} />
                    <SumRow label="Effective Cover" value={`${f.effectiveCover} mm`} />
                    <SumRow label="Concrete Grade" value={f.concreteGrade} />
                    <SumRow label="Steel Grade" value={f.steelGrade} />
                    <SumRow label="Total Dead Load (DL)" value={`${dl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Live Load (LL)" value={`${ll.toFixed(2)} kN/m`} />
                    <SumRow label="Total Service Load" value={`${service.toFixed(2)} kN/m`} strong />
                    <SumRow label="Design Code" value={f.designCode} />
                  </div>
                </RightCard>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <button onClick={reset} className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}><FiRefreshCw size={15} /> Reset</button>
          <button className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}><FiSave size={15} /> Save</button>
          <button onClick={continuous ? proceedContinuous : proceedSimple} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-[#082636] disabled:opacity-50">
            {busy ? <FiLoader className="animate-spin" size={15} /> : null}{busy ? "Designing…" : "Proceed to Design"} <FiArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- shell + primitives ---------- */
function Section({ n, title, info, children }) {
  return (
    <div className={CARD}><div className="p-5">
      <div className="mb-4 flex items-center gap-1.5"><h2 className={TITLE}>{n}. {title}</h2>{info && <FiInfo size={13} className="text-[#94a3b8]" />}</div>
      {children}
    </div></div>
  );
}
// Same fields, wording and styling as the Design Basis card in ColumnInput.jsx.
function DesignBasisSection({ n, v, onChange }) {
  return (
    <Section n={n} title="Design Basis (optional)">
      <div className="grid grid-cols-2 gap-4">
        <div><label className={LABEL}>Designed by</label>
          <input className={INPUT} value={v.designerName} onChange={(e) => onChange({ designerName: e.target.value })} /></div>
        <div><label className={LABEL}>Designer's qualifications</label>
          <input className={INPUT} value={v.designerQualifications} onChange={(e) => onChange({ designerQualifications: e.target.value })} /></div>
        <div><label className={LABEL}>Checked by</label>
          <input className={INPUT} value={v.checkedBy} onChange={(e) => onChange({ checkedBy: e.target.value })} /></div>
        <div><label className={LABEL}>Checker's qualifications</label>
          <input className={INPUT} value={v.checkerQualifications} onChange={(e) => onChange({ checkerQualifications: e.target.value })} /></div>
      </div>
      <div className="mt-4">
        <label className={LABEL}>Responsible for the stability of the structure</label>
        <input className={INPUT} value={v.stabilityResponsible} onChange={(e) => onChange({ stabilityResponsible: e.target.value })} />
      </div>
      <div className="mt-4">
        <label className={LABEL}>Independent check</label>
        <div className="flex flex-wrap gap-2">
          <Pill on={!v.independentCheck} onClick={() => onChange({ independentCheck: "" })}>Not stated</Pill>
          <Pill on={v.independentCheck === "required"} onClick={() => onChange({ independentCheck: "required" })}>Required</Pill>
          <Pill on={v.independentCheck === "completed"} onClick={() => onChange({ independentCheck: "completed" })}>Completed</Pill>
        </div>
      </div>
      <Note>
        These are printed on the first page of the Detailed Report. Left blank, the report says
        "not entered". Nothing is filled in for you: who designed, who checked and whether an
        independent check is required or done are your statements, and building control asks
        for them with a submission. The independent check is never ticked automatically.
      </Note>
    </Section>
  );
}
function Pill({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? "border-[#0A2F44] bg-[#e6f0f5] text-[#0A2F44] dark:border-[#66a4c2] dark:bg-[#1e3a4a] dark:text-[#66a4c2]"
           : `border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:border-[#94a3b8]`}`}>
      {children}
    </button>
  );
}
function Note({ children }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] p-3 dark:bg-[#1e3a4a]">
      <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#66a4c2]" size={14} />
      <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">{children}</p>
    </div>
  );
}
function Field({ label, unit, value, onChange, step }) {
  return <div><label className={LABEL}>{label} {unit ? <span className="text-[#94a3b8]">({unit})</span> : null}</label><input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} /></div>;
}
function RightCard({ title, children }) {
  return <div className={`${CARD} overflow-hidden`}><div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className="text-xs font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">{title}</h3></div><div className="p-5">{children}</div></div>;
}
function SumRow({ label, value, strong }) {
  return <div className="flex items-center justify-between gap-3"><span className={`text-xs ${SUB}`}>{label}</span><span className={`text-xs ${strong ? "font-bold text-[#0A2F44] dark:text-[#66a4c2]" : `font-medium ${MAIN}`}`}>{value}</span></div>;
}
function LoadRow({ label, value, onChange }) {
  return (
    <tr className="border-t border-[#f1f5f9] dark:border-[#334155]">
      <td className={`px-3 py-2 ${MAIN}`}>{label}</td>
      <td className="px-3 py-1.5"><input type="number" step="0.5" value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} py-1`} /></td>
    </tr>
  );
}
function TotalRow({ label, value, strong }) {
  return (
    <tr className={`border-t border-[#f1f5f9] dark:border-[#334155] ${strong ? "bg-[#e6f0f5] dark:bg-[#1e3a4a]" : "bg-[#f8fafc] dark:bg-[#0b0f19]"}`}>
      <td className={`px-3 py-2 font-semibold ${strong ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{label}</td>
      <td className={`px-3 py-2 font-mono font-bold ${strong ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{value.toFixed(2)}</td>
    </tr>
  );
}
function SelectCard({ selected, onClick, label, sub, glyph }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border p-3 text-left transition-all ${selected ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a] ring-1 ring-[#0A2F44] dark:ring-[#66a4c2]" : "border-[#e2e8f0] dark:border-[#334155] hover:border-[#94a3b8] dark:hover:border-[#475569]"}`}>
      <span className={`mb-2 block ${selected ? "text-[#0A2F44] dark:text-[#66a4c2]" : "text-[#94a3b8]"}`}>{glyph}</span>
      <p className={`text-[11px] font-semibold leading-tight ${selected ? "text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{label}</p>
      {sub && <p className={`mt-1 text-[10px] ${SUB}`}>{sub}</p>}
    </button>
  );
}
function StepBtn({ onClick, disabled, icon }) {
  const Icon = icon;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] disabled:opacity-40 disabled:cursor-not-allowed`}>
      <Icon size={15} />
    </button>
  );
}
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#0A2F44]" : "bg-gray-300 dark:bg-gray-600"}`}>
      <span className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

/* ---------- dropdown ---------- */
function Dropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-3 py-2 text-left hover:border-[#94a3b8] dark:hover:border-[#475569] focus:outline-none focus:ring-2 focus:ring-[#0A2F44]">
        <span className={`font-mono text-sm ${MAIN}`}>{sel?.label || "Select…"}</span>
        <FiChevronDown className={`text-[#64748b] dark:text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] shadow-lg">
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange({ target: { value: o.value } }); setOpen(false); }} className={`w-full px-3 py-2 text-left text-sm hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a] ${o.value === value ? "bg-[#e6f0f5] dark:bg-[#1e3a4a] font-medium text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- glyphs & previews ---------- */
function BeamTypeGlyph({ kind }) {
  if (kind === "continuous") {
    return (
      <svg viewBox="0 0 80 40" className="w-10 h-10">
        <line x1="10" y1="20" x2="70" y2="20" stroke="currentColor" strokeWidth="2" className="text-[#0A2F44] dark:text-[#66a4c2]" />
        <circle cx="10" cy="20" r="3" fill="currentColor" className="text-[#64748b] dark:text-[#94a3b8]" />
        <circle cx="35" cy="20" r="3" fill="currentColor" className="text-[#64748b] dark:text-[#94a3b8]" />
        <circle cx="60" cy="20" r="3" fill="currentColor" className="text-[#64748b] dark:text-[#94a3b8]" />
        <path d="M10,28 l-5,8 h10 z" fill="currentColor" fillOpacity="0.3" className="text-[#64748b] dark:text-[#94a3b8]" />
        <path d="M35,28 l-5,8 h10 z" fill="currentColor" fillOpacity="0.3" className="text-[#64748b] dark:text-[#94a3b8]" />
        <path d="M60,28 l-5,8 h10 z" fill="currentColor" fillOpacity="0.3" className="text-[#64748b] dark:text-[#94a3b8]" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 40" className="w-10 h-10">
      <rect x="15" y="18" width="50" height="6" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" className="text-[#0A2F44] dark:text-[#66a4c2]" />
      <path d="M15,28 l-5,8 h10 z" fill="currentColor" fillOpacity="0.3" className="text-[#64748b] dark:text-[#94a3b8]" />
      <path d="M65,28 l-5,8 h10 z" fill="currentColor" fillOpacity="0.3" className="text-[#64748b] dark:text-[#94a3b8]" />
    </svg>
  );
}

function pin(x) { return `M${x},30 l-7,11 h14 z`; }
function BeamGlyph({ kind }) {
  const fixed = (x) => <g><line x1={x} y1="14" x2={x} y2="40" stroke="currentColor" strokeWidth="2" />{[16, 22, 28, 34].map((y) => <line key={y} x1={x} y1={y} x2={x - 6} y2={y + 4} stroke="currentColor" strokeWidth="1" />)}</g>;
  return (
    <svg viewBox="0 0 110 48" className="h-10 w-full">
      <rect x="20" y="22" width="70" height="8" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
      {kind === "fixed_fixed" && (<>{fixed(20)}{fixed(90)}</>)}
      {kind === "fixed_pin" && (<>{fixed(20)}<path d={pin(88)} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" /></>)}
      {kind === "cantilever" && (<>{fixed(20)}<line x1="90" y1="22" x2="100" y2="22" stroke="currentColor" strokeWidth="2" /></>)}
      {kind === "pin_pin" && (<><path d={pin(22)} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" /><path d={pin(88)} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" /></>)}
    </svg>
  );
}
function RestraintGlyph({ value }) {
  const tri = (x) => <path d={`M${x},26 l-6,9 h12 z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2" />;
  return (
    <svg viewBox="0 0 120 44" className="h-9 w-full">
      <line x1="14" y1="14" x2="106" y2="14" stroke="currentColor" strokeWidth={value === "continuous" ? 2.4 : 1} strokeDasharray={value === "continuous" ? "0" : "4 2"} />
      <rect x="14" y="22" width="92" height="6" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      {tri(30)}{tri(90)}
      {value === "one_end_discontinuous" && <line x1="14" y1="14" x2="40" y2="14" stroke="currentColor" strokeWidth="2.4" strokeDasharray="0" />}
    </svg>
  );
}
function ElevationView({ support, span, depth }) {
  const DIM = "var(--dim)";
  const layouts = {
    both_ends_fixed: [["f", 60], ["f", 440]],
    one_fixed_one_simple: [["f", 60], ["t", 440]],
    one_fixed_one_free: [["f", 60]],
    both_ends_simply_supported: [["t", 60], ["t", 440]],
  };
  const ends = layouts[support] || [["t", 60], ["t", 440]];
  return (
    <svg viewBox="0 0 500 120" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="be" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      <rect x="60" y="34" width="380" height="22" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
      {[110, 170, 230, 290, 350, 410].map((x) => <line key={`t${x}`} x1={x} y1="22" x2={x} y2="34" stroke="currentColor" strokeWidth="1.2" markerStart="url(#be)" />)}
      {ends.map(([kind, x], i) => kind === "f"
        ? <g key={`s${i}`} stroke="currentColor"><line x1={x} y1="34" x2={x} y2="74" strokeWidth="2" />{[38, 46, 54, 62, 70].map((y) => <line key={y} x1={x} y1={y} x2={x - 7} y2={y + 5} strokeWidth="1" />)}</g>
        : <path key={`s${i}`} d={`M${x},74 l-9,13 h18 z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" />
      )}
      <line x1="60" y1="100" x2="440" y2="100" stroke={DIM} strokeWidth="1" markerStart="url(#be)" markerEnd="url(#be)" />
      <text x="250" y="114" fontSize="10" fill={DIM} textAnchor="middle">L = {span} mm</text>
      <line x1="452" y1="34" x2="452" y2="56" stroke={DIM} strokeWidth="1" markerStart="url(#be)" markerEnd="url(#be)" />
      <text x="458" y="48" fontSize="9" fill={DIM}>D = {depth} mm</text>
    </svg>
  );
}
function ContinuousElevation({ lengths, endSupport }) {
  const DIM = "var(--dim)";
  const lens = lengths.map((l) => Math.max(parseFloat(l) || 0, 1));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const x0 = 40, W = 420;
  const nodes = [x0];
  let acc = x0;
  lens.forEach((l) => { acc += (l / total) * W; nodes.push(acc); });
  const last = nodes.length - 1;
  const fixedEnd = endSupport === "continuous";
  return (
    <svg viewBox="0 0 500 130" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="ce" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      {/* UDL arrows */}
      {Array.from({ length: 18 }, (_, i) => x0 + (i * W) / 17).map((x, i) => (
        <line key={`a${i}`} x1={x} y1="16" x2={x} y2="30" stroke="currentColor" strokeWidth="1" markerEnd="url(#ce)" />
      ))}
      <line x1={x0} y1="16" x2={nodes[last]} y2="16" stroke="currentColor" strokeWidth="1.2" />
      {/* beam */}
      <rect x={x0} y="36" width={nodes[last] - x0} height="18" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
      {/* supports */}
      {nodes.map((x, i) => {
        const isEnd = i === 0 || i === last;
        if (isEnd && fixedEnd) {
          return (
            <g key={`s${i}`} stroke="currentColor">
              <line x1={x} y1="36" x2={x} y2="76" strokeWidth="2" />
              {[40, 48, 56, 64, 72].map((y) => <line key={y} x1={x} y1={y} x2={x - 6} y2={y + 4} strokeWidth="1" />)}
            </g>
          );
        }
        return (
          <g key={`s${i}`}>
            <path d={`M${x},54 l-7,11 h14 z`} fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" />
            {i !== 0 && <line x1={x - 9} y1="68" x2={x + 9} y2="68" stroke="currentColor" strokeWidth="1.2" />}
          </g>
        );
      })}
      {/* support labels */}
      {nodes.map((x, i) => <text key={`n${i}`} x={x} y="88" fontSize="8" fill={DIM} textAnchor="middle">S{i + 1}</text>)}
      {/* span dimensions */}
      {nodes.slice(0, -1).map((x, i) => (
        <g key={`d${i}`}>
          <line x1={x} y1="104" x2={nodes[i + 1]} y2="104" stroke={DIM} strokeWidth="1" markerStart="url(#ce)" markerEnd="url(#ce)" />
          <text x={(x + nodes[i + 1]) / 2} y="118" fontSize="8" fill={DIM} textAnchor="middle">L{i + 1} = {lengths[i]}</text>
        </g>
      ))}
    </svg>
  );
}
function CrossSection({ width, depth }) {
  const DIM = "var(--dim)";
  return (
    <svg viewBox="0 0 200 160" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="cs" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      <rect x="55" y="20" width="90" height="115" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.4" />
      <rect x="64" y="29" width="72" height="97" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" />
      {[72, 100, 128].map((x) => <circle key={`b${x}`} cx={x} cy={120} r="3.2" fill="#ef4444" />)}
      {[80, 120].map((x) => <circle key={`t${x}`} cx={x} cy={34} r="2.6" fill="#ef4444" />)}
      <line x1="55" y1="146" x2="145" y2="146" stroke={DIM} strokeWidth="1" markerStart="url(#cs)" markerEnd="url(#cs)" />
      <text x="100" y="157" fontSize="9" fill={DIM} textAnchor="middle">{width} mm</text>
      <line x1="160" y1="20" x2="160" y2="135" stroke={DIM} strokeWidth="1" markerStart="url(#cs)" markerEnd="url(#cs)" />
      <text x="166" y="80" fontSize="9" fill={DIM} transform="rotate(90 166 80)" textAnchor="middle">{depth} mm</text>
    </svg>
  );
}

export default BeamInput;