// src/pages/BeamInput.jsx — Simply Supported + Continuous Beam, mockup-faithful
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiChevronDown, FiInfo, FiRefreshCw, FiSave,
  FiArrowRight, FiLoader, FiAlertTriangle, FiPlus, FiTrash2,
} from "react-icons/fi";
import { beamAPI, continuousBeamAPI } from "../services/api";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

const INPUT_DRAFT_KEY_SS = "beamInputDraft";
const INPUT_DRAFT_KEY_CB = "continuousBeamInputDraft";
const BEAM_TYPE_KEY = "beamInputActiveType";

const BEAM_TYPES = [
  {
    value: "simply_supported",
    label: "Simply Supported Beam",
    desc: "Single span beam with selectable end conditions (fixed, pinned, cantilever)",
    icon: "pin_pin"
  },
  {
    value: "continuous",
    label: "Continuous Beam",
    desc: "Multi-span continuous beam with moment redistribution and support conditions",
    icon: "continuous"
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
const DESIGN_CODES = [
  { value: "EC2", label: "EN 1992-1-1 (Eurocode 2)" },
];
const CONCRETE_EC = [
  { value: "C25/30", label: "C25/30 (fck = 25 MPa)" },
  { value: "C30/37", label: "C30/37 (fck = 30 MPa)" },
  { value: "C35/45", label: "C35/45 (fck = 35 MPa)" },
];
const STEEL_EC = [{ value: "B500", label: "B500B (fyk = 500 MPa)" }, { value: "B460", label: "B460B (fyk = 460 MPa)" }];
const CONCRETE_BS = [{ value: "M20", label: "M20 (fcu = 20 MPa)" }, { value: "M25", label: "M25 (fcu = 25 MPa)" }, { value: "M30", label: "M30 (fcu = 30 MPa)" }];
const STEEL_BS = [{ value: "Fe415", label: "Fe415 (fy = 415 MPa)" }, { value: "Fe500", label: "Fe500 (fy = 500 MPa)" }];

// Continuous beam -- matches continuous_beam_schemas.py exactly
const END_SUPPORTS = [
  { value: "simple", label: "Simple (Pinned Ends)" },
  { value: "continuous", label: "Continuous (Both Ends)" },
];
const EXPOSURE_CLASSES = [
  { value: "XC1", label: "XC1" }, { value: "XC2", label: "XC2" },
  { value: "XC3", label: "XC3" }, { value: "XC4", label: "XC4" },
];
const CB_BAR_SETS = [[16, 20, 25], [20, 25, 32], [16, 20, 25, 32]];
const SS_BAR_SETS = [[20, 25, 16], [16, 20, 25], [20, 25, 32], [16, 20, 25, 32]];

const DEFAULTS = {
  beamId: "B1",
  designCode: "EC2",
  supportCondition: "both_ends_simply_supported",
  topRestraint: "continuous",
  span: "6000", width: "300", depth: "500", effectiveCover: "25",
  leftAdjacentSpacing: "0", rightAdjacentSpacing: "0", slabThickness: "0",
  concreteGrade: "M25", steelGrade: "Fe500",
  unitWeightConcrete: "25", unitWeightSteel: "78.5",
  selfWeightAuto: true,
  wallLoad: "10", finishes: "1.5", additionalDeadLoad: "1.2",
  liveLoad: "3", otherLiveLoad: "2",
  barDiameters: [20, 25, 16],
  linkDiameter: 8,
  region: "Nigeria",
};

const CB_DEFAULTS = {
  beamId: "CB1",
  designCode: "EC2",
  analysisMethod: "Linear Elastic",
  nSpans: 3,
  spanLengths: ["4000", "5000", "4500"],
  width: "225", depth: "450", effectiveDepth: "",
  cover: "25",
  concreteGrade: "C30/37", steelGrade: "B500",
  unitWeightConcrete: "25", unitWeightSteel: "78.5",
  selfWeightAuto: true,
  wallLoad: "10", finishes: "1.5", additionalDeadLoad: "1.2",
  liveLoad: "3", otherLiveLoad: "2",
  endSupport: "simple",
  designWorkingLife: "50", exposureClass: "XC1", crackedSectionSls: true,
  barDiameters: [20, 25, 16],
  linkDiameter: 8,
  region: "Nigeria",
};

const BeamInput = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [beamType, setBeamType] = useState(() => {
    // The route itself is the strongest signal -- /continuous-beam always
    // means the user is here for a continuous beam (e.g. navigating back
    // from ContinuousBeamResults.jsx), regardless of whatever type was
    // used in a previous session.
    if (location.pathname.includes("continuous-beam")) return "continuous";
    if (location.pathname === "/beam") {
      try {
        const saved = sessionStorage.getItem(BEAM_TYPE_KEY);
        if (saved === "simply_supported" || saved === "continuous") return saved;
      } catch {}
    }
    return "simply_supported";
  });

  const [f, setF] = useState(() => {
    try {
      const saved = sessionStorage.getItem(INPUT_DRAFT_KEY_SS);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  const [cb, setCb] = useState(() => {
    try {
      const saved = sessionStorage.getItem(INPUT_DRAFT_KEY_CB);
      return saved ? { ...CB_DEFAULTS, ...JSON.parse(saved) } : CB_DEFAULTS;
    } catch { return CB_DEFAULTS; }
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  const setCB = (p) => setCb((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    try { sessionStorage.setItem(INPUT_DRAFT_KEY_SS, JSON.stringify(f)); } catch {}
  }, [f]);
  useEffect(() => {
    try { sessionStorage.setItem(INPUT_DRAFT_KEY_CB, JSON.stringify(cb)); } catch {}
  }, [cb]);

  const isBS = f.designCode === "BS8110";
  const concreteOpts = isBS ? CONCRETE_BS : CONCRETE_EC;
  const steelOpts = isBS ? STEEL_BS : STEEL_EC;
  const handleCode = (code) => set({ designCode: code, concreteGrade: code === "BS8110" ? "M25" : "C25/30", steelGrade: code === "BS8110" ? "Fe500" : "B500" });

  // self weight (kN/m) = b·h·γc
  const selfW = f.selfWeightAuto ? (parseFloat(f.width) / 1000) * (parseFloat(f.depth) / 1000) * (parseFloat(f.unitWeightConcrete) || 0) : 0;
  const dl = selfW + (parseFloat(f.wallLoad) || 0) + (parseFloat(f.finishes) || 0) + (parseFloat(f.additionalDeadLoad) || 0);
  const ll = (parseFloat(f.liveLoad) || 0) + (parseFloat(f.otherLiveLoad) || 0);
  const service = dl + ll;

  // continuous beam derived values
  const cbSelfW = cb.selfWeightAuto ? (parseFloat(cb.width) / 1000) * (parseFloat(cb.depth) / 1000) * (parseFloat(cb.unitWeightConcrete) || 0) : 0;
  const cbDl = cbSelfW + (parseFloat(cb.wallLoad) || 0) + (parseFloat(cb.finishes) || 0) + (parseFloat(cb.additionalDeadLoad) || 0);
  const cbLl = (parseFloat(cb.liveLoad) || 0) + (parseFloat(cb.otherLiveLoad) || 0);
  const cbTotalLen = cb.spanLengths.reduce((a, b) => a + (parseFloat(b) || 0), 0);

  const reset = () => {
    if (window.confirm("Reset all fields?")) {
      if (beamType === "simply_supported") { setF(DEFAULTS); } else { setCb(CB_DEFAULTS); }
      setError(null);
    }
  };

  const setSpan = (i, v) => {
    const s = [...cb.spanLengths];
    s[i] = v;
    setCB({ spanLengths: s, nSpans: s.length });
  };
  const addSpan = () => setCB({ spanLengths: [...cb.spanLengths, "4000"], nSpans: cb.spanLengths.length + 1 });
  const removeSpan = (i) => {
    if (cb.spanLengths.length <= 2) return;   // schema requires n_spans >= 2
    const s = cb.spanLengths.filter((_, j) => j !== i);
    setCB({ spanLengths: s, nSpans: s.length });
  };

  const proceed = async () => {
    setBusy(true); setError(null);
    try {
      if (beamType === "simply_supported") {
        const result = await beamAPI.startDesign(f);
        navigate("/beam-results", { state: { designResult: result, formData: f } });
      } else {
        const lens = cb.spanLengths.map((v) => parseFloat(v));
        if (cb.spanLengths.length < 2 || lens.some((v) => !v || v <= 0)) {
          setError("A continuous beam needs at least 2 spans, each greater than 0.");
          setBusy(false);
          return;
        }
        const result = await continuousBeamAPI.startDesign(cb);
        navigate("/continuous-beam-results", { state: { designResult: result, formData: cb } });
      }
    } catch (e) {
      setError(e.message || "Design request failed.");
    } finally { setBusy(false); }
  };

  const supportLabel = SUPPORTS.find((s) => s.value === f.supportCondition)?.label || "—";

  return (
    <div className="flex flex-col">
      <div className="flex-1">
          {/* BEAM TYPE SELECTOR */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-[#0A2F44] dark:text-[#66a4c2] uppercase tracking-wide mb-3">Select Beam Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BEAM_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => {
                    setBeamType(bt.value);
                    setError(null);
                    try { sessionStorage.setItem(BEAM_TYPE_KEY, bt.value); } catch {}
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    beamType === bt.value
                      ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a] ring-1 ring-[#0A2F44]"
                      : "border-[#e2e8f0] dark:border-[#334155] hover:border-[#94a3b8] dark:hover:border-[#475569] bg-white dark:bg-[#1f2937]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      beamType === bt.value
                        ? "bg-[#0A2F44]/10 dark:bg-[#0A2F44]/20"
                        : "bg-[#f1f5f9] dark:bg-[#334155]"
                    }`}>
                      <BeamTypeGlyph kind={bt.icon} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${
                        beamType === bt.value
                          ? "text-[#0A2F44] dark:text-[#66a4c2]"
                          : "text-[#0F172A] dark:text-white"
                      }`}>
                        {bt.label}
                      </p>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{bt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <FiAlertTriangle className="mt-0.5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="mb-5">
            <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">
              {beamType === "simply_supported" ? "Simply Supported Beam Input" : "Continuous Beam Input"}
            </h1>
            <p className={`text-sm ${SUB}`}>
              {beamType === "simply_supported"
                ? "Enter beam details, material properties, loads and support conditions."
                : "Multi-span continuous beam · stiffness-method (FEM) analysis · EC2."}
            </p>
          </div>

          {beamType === "simply_supported" ? (
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
                  <div>
                    <label className={LABEL}>Bar Set (mm, main bar first)</label>
                    <Dropdown value={f.barDiameters.join(",")} onChange={(e) => set({ barDiameters: e.target.value.split(",").map(Number) })}
                      options={SS_BAR_SETS.map((b) => ({ value: b.join(","), label: b.join(", ") }))} />
                  </div>
                  <Field label="Link Diameter" unit="mm" value={f.linkDiameter} onChange={(v) => set({ linkDiameter: v })} step="2" />
                </div>
              </Section>

              {/* 5. LOADS */}
              <Section n="5" title="Loads">
                <div className="overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="px-3 py-2 font-semibold">Load Type</th>
                        <th className="px-3 py-2 font-semibold">Value (kN/m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={`border-t border-[#f1f5f9] dark:border-[#334155]`}>
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

            {/* RIGHT */}
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
                    <SumRow label="Bar Set" value={f.barDiameters.join(", ") + " mm"} />
                    <SumRow label="Link Diameter" value={`${f.linkDiameter} mm`} />
                    <SumRow label="Total Dead Load (DL)" value={`${dl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Live Load (LL)" value={`${ll.toFixed(2)} kN/m`} />
                    <SumRow label="Total Service Load" value={`${service.toFixed(2)} kN/m`} strong />
                    <SumRow label="Design Code" value={f.designCode} />
                  </div>
                </RightCard>
              </div>
            </div>
          </div>
          ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              {/* 1. GENERAL */}
              <Section n="1" title="General">
                <div>
                  <label className={LABEL}>Beam Name / ID</label>
                  <input className={INPUT} value={cb.beamId} onChange={(e) => setCB({ beamId: e.target.value })} />
                </div>
              </Section>

              {/* 2. SPANS */}
              <Section n="2" title="Spans" info>
                <div className="mb-3 flex items-center justify-between">
                  <label className={LABEL}>Span Lengths (mm)</label>
                  <button onClick={addSpan} className="flex items-center gap-1.5 rounded-lg bg-[#e6f0f5] px-2.5 py-1 text-xs font-medium text-[#0A2F44] hover:bg-[#d4e6ef] dark:bg-[#1e3a4a] dark:text-[#66a4c2]">
                    <FiPlus size={13} /> Add span
                  </button>
                </div>
                <div className="space-y-2">
                  {cb.spanLengths.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`w-16 text-xs font-semibold ${SUB}`}>Span {i + 1}</span>
                      <input type="number" step="100" min="0" className={INPUT} value={v} onChange={(e) => setSpan(i, e.target.value)} />
                      <button
                        onClick={() => removeSpan(i)}
                        disabled={cb.spanLengths.length <= 2}
                        className="rounded-lg p-2 text-[#64748b] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/20"
                        title="Remove span"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className={`mt-3 text-[11px] ${SUB}`}>{cb.spanLengths.length} spans (min 2, max 8) · total length {cbTotalLen.toFixed(0)} mm</p>
              </Section>

              {/* 3. SECTION & MATERIALS */}
              <Section n="3" title="Section & Materials">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Field label="Width (b)" unit="mm" value={cb.width} onChange={(v) => setCB({ width: v })} step="25" />
                  <Field label="Overall Depth (D)" unit="mm" value={cb.depth} onChange={(v) => setCB({ depth: v })} step="25" />
                  <Field label="Cover" unit="mm" value={cb.cover} onChange={(v) => setCB({ cover: v })} step="5" />
                  <div>
                    <label className={LABEL}>Concrete Grade</label>
                    <Dropdown value={cb.concreteGrade} onChange={(e) => setCB({ concreteGrade: e.target.value })} options={CONCRETE_EC} />
                  </div>
                  <div>
                    <label className={LABEL}>Steel Grade</label>
                    <Dropdown value={cb.steelGrade} onChange={(e) => setCB({ steelGrade: e.target.value })} options={STEEL_EC} />
                  </div>
                  <div>
                    <label className={LABEL}>Bar Set (mm, main bar first)</label>
                    <Dropdown value={cb.barDiameters.join(",")} onChange={(e) => setCB({ barDiameters: e.target.value.split(",").map(Number) })}
                      options={CB_BAR_SETS.map((b) => ({ value: b.join(","), label: b.join(", ") }))} />
                  </div>
                  <Field label="Link Diameter" unit="mm" value={cb.linkDiameter} onChange={(v) => setCB({ linkDiameter: v })} step="2" />
                  <div>
                    <label className={LABEL}>Effective Depth (optional override)</label>
                    <input type="number" step="5" placeholder="auto from cover/link/bar" className={INPUT} value={cb.effectiveDepth} onChange={(e) => setCB({ effectiveDepth: e.target.value })} />
                  </div>
                </div>
                <p className={`mt-2 text-[11px] ${SUB}`}>Leave Effective Depth blank to derive it automatically from overall depth, cover, link, and bar diameter. If set, it's used directly in every flexure, shear, and deflection calculation.</p>
              </Section>

              {/* 4. LOADS */}
              <Section n="4" title="Loads (per metre, applied across all spans unless overridden)">
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
                            <input type="checkbox" checked={cb.selfWeightAuto} onChange={(e) => setCB({ selfWeightAuto: e.target.checked })} />
                            Beam Self Weight <span className={`text-xs ${SUB}`}>(auto)</span>
                          </label>
                        </td>
                        <td className={`px-3 py-2 font-mono ${SUB}`}>{cbSelfW.toFixed(2)}</td>
                      </tr>
                      <LoadRow label="Wall Load (Uniform)" value={cb.wallLoad} onChange={(v) => setCB({ wallLoad: v })} />
                      <LoadRow label="Finishes" value={cb.finishes} onChange={(v) => setCB({ finishes: v })} />
                      <LoadRow label="Additional Dead Load" value={cb.additionalDeadLoad} onChange={(v) => setCB({ additionalDeadLoad: v })} />
                      <TotalRow label="Total Dead Load (DL)" value={cbDl} />
                      <LoadRow label="Live Load (LL)" value={cb.liveLoad} onChange={(v) => setCB({ liveLoad: v })} />
                      <LoadRow label="Other Live Load" value={cb.otherLiveLoad} onChange={(v) => setCB({ otherLiveLoad: v })} />
                      <TotalRow label="Total Live Load (LL)" value={cbLl} />
                      <TotalRow label="Total Service Load (DL + LL)" value={cbDl + cbLl} strong />
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[11px] ${SUB}`}>Per-span load overrides are available via the API's span_loads field; not yet exposed here.</p>
              </Section>
            </div>

            {/* RIGHT */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <RightCard title="Beam Preview — Span Layout">
                  <ContinuousElevationView spans={cb.spanLengths} depth={cb.depth} />
                </RightCard>
                <RightCard title="Cross Section">
                  <CrossSection width={cb.width} depth={cb.depth} />
                </RightCard>
                <RightCard title="Input Summary">
                  <div className="space-y-1.5">
                    <SumRow label="Beam Name / ID" value={cb.beamId} />
                    <SumRow label="Spans" value={cb.spanLengths.length} />
                    <SumRow label="Span Lengths" value={cb.spanLengths.join(", ") + " mm"} />
                    <SumRow label="Width (b)" value={`${cb.width} mm`} />
                    <SumRow label="Overall Depth (D)" value={`${cb.depth} mm`} />
                    <SumRow label="Cover" value={`${cb.cover} mm`} />
                    <SumRow label="Effective Depth" value={cb.effectiveDepth ? `${cb.effectiveDepth} mm (override)` : "auto"} />
                    <SumRow label="Concrete Grade" value={cb.concreteGrade} />
                    <SumRow label="Steel Grade" value={cb.steelGrade} />
                    <SumRow label="Bar Set" value={cb.barDiameters.join(", ") + " mm"} />
                    <SumRow label="Link Diameter" value={`${cb.linkDiameter} mm`} />
                    <SumRow label="Total Dead Load (DL)" value={`${cbDl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Live Load (LL)" value={`${cbLl.toFixed(2)} kN/m`} />
                    <SumRow label="Total Service Load" value={`${(cbDl + cbLl).toFixed(2)} kN/m`} strong />
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
            <button onClick={proceed} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-[#082636] disabled:opacity-50">
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
function ContinuousElevationView({ spans, depth }) {
  const DIM = "var(--dim)";
  const lens = spans.map((s) => parseFloat(s) || 1);
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const x0 = 40, W = 400;
  const nodes = [x0];
  let acc = x0;
  lens.forEach((l) => { acc += (l / total) * W; nodes.push(acc); });
  return (
    <svg viewBox="0 0 480 110" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <rect x={nodes[0]} y="34" width={nodes[nodes.length - 1] - nodes[0]} height="18" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
      {nodes.map((x, i) => (
        <path key={i} d={`M${x},52 l-8,12 h16 z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.3" />
      ))}
      {lens.map((l, i) => {
        const xa = nodes[i], xb = nodes[i + 1];
        return <text key={i} x={(xa + xb) / 2} y="88" fontSize="9" fill={DIM} textAnchor="middle">{l.toFixed(0)}</text>;
      })}
      <text x={(nodes[0] + nodes[nodes.length - 1]) / 2} y="102" fontSize="9" fill={DIM} fillOpacity="0.7" textAnchor="middle">span lengths (mm)</text>
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