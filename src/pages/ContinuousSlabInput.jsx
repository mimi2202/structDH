// src/pages/ContinuousSlabInput.jsx — Continuous One-Way Slab Input
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiHome, FiChevronRight, FiRefreshCw, FiSave, FiArrowRight,
  FiLoader, FiAlertTriangle, FiInfo, FiPlus, FiTrash2,
} from "react-icons/fi";
import DesignProgressBar from "../components/ui/DesignProgressBar";
import Dropdown from "../components/Dropdown";
import { continuousSlabAPI } from "../services/api";

const DRAFT_KEY = "continuousSlabInputDraft";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const SECTION_TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

const CONCRETE_GRADES = ["C20/25", "C25/30", "C30/37", "C35/45", "C40/50"];
const STEEL_GRADES = ["B500", "B460"];
const SUPPORTS = [
  { value: "pinned", label: "Pinned" },
  { value: "fixed", label: "Fixed" },
];
const BAR_DIAS = [8, 10, 12, 16, 20];
// Region only selects the cost-rate table (backend rates_db.json); it does not change the design.
const REGIONS = ["Nigeria", "UK"];
const EXPOSURE_CLASSES = ["XC1", "XC2", "XC3", "XC4"];
const FIRE_RATINGS = [0, 30, 60, 90, 120, 180, 240];   // minutes, EN 1992-1-2 Table 5.8 (0 = not checked)
const CRACK_LIMITS = ["0.2", "0.3", "0.4"];            // mm
// EN 1991-1-1 (indicative) imposed loads by occupancy -- picking one fills in
// the live load, which stays editable. Also sent to the backend, where it sets
// psi_2 for the crack check ("Custom" = not stated, psi_2 = 0.6 assumed).
const OCCUPANCY = [
  { value: "", label: "Custom (enter live load)" },
  { value: "residential", label: "Residential (1.5)", qk: 1.5 },
  { value: "office", label: "Office (2.5)", qk: 2.5 },
  { value: "classroom", label: "Classroom / School (3.0)", qk: 3.0 },
  { value: "retail", label: "Retail / Shop (4.0)", qk: 4.0 },
  { value: "assembly", label: "Assembly / Public (5.0)", qk: 5.0 },
  { value: "parking", label: "Parking (2.5)", qk: 2.5 },
  { value: "storage", label: "Storage (7.5)", qk: 7.5 },
];

const DEFAULTS = {
  spans: ["4.0", "4.0", "4.0"],
  startSupport: "pinned",
  endSupport: "pinned",
  thickness: "175",
  clearCover: "25",
  concreteGrade: "C30/37",
  steelGrade: "B500",
  unitWeightConcrete: "25",
  floorFinish: "1.0",
  liveLoad: "3.0",
  additionalDeadLoad: "0",
  additionalLiveLoad: "0",
  mainBarDia: "12",
  designCode: "EC2",
  occupancy: "",
  region: "Nigeria",
  exposureClass: "XC3",
  fireRating: "60",
  crackWidthLimit: "0.3",

  // Printed on the first page of the Detailed Report. Blank stays blank.
  designerName: "", designerQualifications: "",
  checkedBy: "", checkerQualifications: "",
  stabilityResponsible: "", independentCheck: "",
};

const numOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export default function ContinuousSlabInput() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSpan = (i, v) =>
    setForm((f) => {
      const spans = [...f.spans];
      spans[i] = v;
      return { ...f, spans };
    });
  const addSpan = () => setForm((f) => ({ ...f, spans: [...f.spans, "4.0"] }));
  const removeSpan = (i) =>
    setForm((f) => ({ ...f, spans: f.spans.filter((_, idx) => idx !== i) }));

  const totalLength = form.spans.reduce((a, s) => a + (parseFloat(s) || 0), 0);
  const ff = parseFloat(form.floorFinish) || 0;
  const ll = parseFloat(form.liveLoad) || 0;
  const adl = parseFloat(form.additionalDeadLoad) || 0;
  const all_ = parseFloat(form.additionalLiveLoad) || 0;
  const totalLoad = ff + ll + adl + all_;

  const reset = () => {
    if (!window.confirm("Reset all fields to defaults?")) return;
    setForm(DEFAULTS);
    setError(null);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const run = async () => {
    const spans = form.spans.map((s) => parseFloat(s)).filter((n) => Number.isFinite(n) && n > 0);
    if (spans.length < 1) {
      setError("Enter at least one span length.");
      return;
    }
    const oversized = spans.filter((s) => s > 4.5);
    if (oversized.length) {
      setError(`Span length(s) ${oversized.join(", ")} m exceed the practical one-way slab limit of 4.5 m.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // continuousSlabAPI reads spanLengths; this page keeps them in form.spans.
      const result = await continuousSlabAPI.startDesign({ ...form, spanLengths: form.spans });
      setBusy(false);
      navigate("/continuous-slab-results", { state: { designResult: result, form } });
    } catch (e) {
      setBusy(false);
      setError(
        e.message === "Failed to fetch"
          ? "Cannot reach the design engine. Make sure the backend is running at http://localhost:8000"
          : e.message
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      <header className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-2.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white">
              <FiHome size={15} />
            </div>
            <span className={`text-sm font-bold ${MAIN}`}>Struct Design Hub</span>
          </div>
          <nav className={`hidden md:flex items-center gap-1.5 text-[13px] ${SUB}`}>
            <span>Slab Design</span>
            <FiChevronRight size={13} />
            <span className={`font-medium ${MAIN}`}>Continuous One-Way Slab</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <DesignProgressBar active={busy} />

        <div className="space-y-5">
          {/* 1. SPANS */}
          <div className={CARD}>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className={SECTION_TITLE}>1. Spans</h2>
                <button onClick={addSpan} className="flex items-center gap-1 text-xs font-medium text-[#0A2F44] dark:text-[#66a4c2] hover:underline">
                  <FiPlus size={13} /> Add span
                </button>
              </div>
              <div className="space-y-2">
                {form.spans.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`w-16 text-xs ${SUB}`}>Span {i + 1}</span>
                    <input type="number" step="0.1" value={s} onChange={(e) => setSpan(i, e.target.value)} className={INPUT} />
                    <span className={`text-xs ${SUB}`}>m</span>
                    {form.spans.length > 1 && (
                      <button onClick={() => removeSpan(i)} className="text-red-500 hover:text-red-700">
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-xs ${SUB}`}>Total length: {totalLength.toFixed(2)} m. Each span must be &le; 4.5 m.</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Start support</label>
                  <Dropdown value={form.startSupport} onChange={(v) => set({ startSupport: v })} options={SUPPORTS} />
                </div>
                <div>
                  <label className={LABEL}>End support</label>
                  <Dropdown value={form.endSupport} onChange={(v) => set({ endSupport: v })} options={SUPPORTS} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. GEOMETRY & MATERIALS */}
          <div className={CARD}>
            <div className="p-5">
              <h2 className={`mb-4 ${SECTION_TITLE}`}>2. Geometry &amp; Materials</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <label className={LABEL}>Thickness <span className="text-[#94a3b8]">(mm)</span></label>
                  <input type="number" step="5" value={form.thickness} onChange={(e) => set({ thickness: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Clear cover <span className="text-[#94a3b8]">(mm)</span></label>
                  <input type="number" step="5" value={form.clearCover} onChange={(e) => set({ clearCover: e.target.value })} className={INPUT} />
                  <p className={`mt-1 text-[10px] ${SUB}`}>+5 mm fixing tolerance (fixed)</p>
                </div>
                <div>
                  <label className={LABEL}>Main bar &Oslash; <span className="text-[#94a3b8]">(mm)</span></label>
                  <Dropdown value={form.mainBarDia} onChange={(v) => set({ mainBarDia: v })} options={BAR_DIAS.map((d) => ({ value: String(d), label: `\u00d8${d}` }))} />
                </div>
                <div>
                  <label className={LABEL}>Concrete grade</label>
                  <Dropdown value={form.concreteGrade} onChange={(v) => set({ concreteGrade: v })} options={CONCRETE_GRADES.map((g) => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className={LABEL}>Steel grade</label>
                  <Dropdown value={form.steelGrade} onChange={(v) => set({ steelGrade: v })} options={STEEL_GRADES.map((g) => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className={LABEL}>Design code</label>
                  <div className="flex h-[38px] items-center rounded-lg border border-[#e2e8f0] px-3 font-mono text-sm dark:border-[#334155]">
                    <span className={MAIN}>EN 1992-1-1 (Eurocode 2)</span>
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Region</label>
                  <Dropdown value={form.region} onChange={(v) => set({ region: v })} options={REGIONS.map((r) => ({ value: r, label: r }))} />
                  <p className={`mt-1 text-[10px] ${SUB}`}>Cost rates only</p>
                </div>
                <div>
                  <label className={LABEL}>Exposure class</label>
                  <Dropdown value={form.exposureClass} onChange={(v) => set({ exposureClass: v })} options={EXPOSURE_CLASSES.map((c) => ({ value: c, label: c }))} />
                  <p className={`mt-1 text-[10px] ${SUB}`}>Cover check, EC2 4.4.1</p>
                </div>
                <div>
                  <label className={LABEL}>Fire resistance</label>
                  <Dropdown value={form.fireRating} onChange={(v) => set({ fireRating: v })} options={FIRE_RATINGS.map((r) => ({ value: String(r), label: r ? `REI ${r}` : "None (not checked)" }))} />
                  <p className={`mt-1 text-[10px] ${SUB}`}>EN 1992-1-2 Table 5.8</p>
                </div>
                <div>
                  <label className={LABEL}>Crack width limit <span className="text-[#94a3b8]">(mm)</span></label>
                  <Dropdown value={form.crackWidthLimit} onChange={(v) => set({ crackWidthLimit: v })} options={CRACK_LIMITS.map((w) => ({ value: w, label: w }))} />
                  <p className={`mt-1 text-[10px] ${SUB}`}>EC2 7.3.3 (stricter of this and Table 7.1N)</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. LOADS */}
          <div className={CARD}>
            <div className="p-5">
              <h2 className={`mb-4 ${SECTION_TITLE}`}>3. Loads</h2>
              <div className="mb-4">
                <label className={LABEL}>Occupancy</label>
                <Dropdown value={form.occupancy} onChange={(v) => {
                  const o = OCCUPANCY.find((x) => x.value === v);
                  set({ occupancy: v, ...(o && o.qk !== undefined ? { liveLoad: String(o.qk) } : {}) });
                }} options={OCCUPANCY.map((o) => ({ value: o.value, label: o.label }))} />
                <p className={`mt-1 text-[10px] ${SUB}`}>Fills in the live load below (EN 1991-1-1, indicative); edit it freely.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Floor finish / additional DL <span className="text-[#94a3b8]">(kN/m²)</span></label>
                  <input type="number" step="0.5" value={form.floorFinish} onChange={(e) => set({ floorFinish: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Live load <span className="text-[#94a3b8]">(kN/m²)</span></label>
                  <input type="number" step="0.5" value={form.liveLoad} onChange={(e) => set({ liveLoad: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Extra dead load <span className="text-[#94a3b8]">(kN/m²)</span></label>
                  <input type="number" step="0.5" value={form.additionalDeadLoad} onChange={(e) => set({ additionalDeadLoad: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Extra live load <span className="text-[#94a3b8]">(kN/m²)</span></label>
                  <input type="number" step="0.5" value={form.additionalLiveLoad} onChange={(e) => set({ additionalLiveLoad: e.target.value })} className={INPUT} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] px-3 py-2 dark:border-[#475569] dark:bg-[#334155]">
                <span className={`text-xs ${SUB}`}>Total superimposed load</span>
                <span className="font-mono text-sm font-bold text-[#0A2F44] dark:text-[#66a4c2]">{totalLoad.toFixed(2)} kN/m²</span>
              </div>
            </div>
          </div>

          {/* 4. DESIGN BASIS */}
          <div className={CARD}>
            <div className="p-5">
              <h2 className={`mb-4 ${SECTION_TITLE}`}>
                4. Design Basis <span className="ml-1 lowercase font-normal text-[#94a3b8]">(optional)</span>
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL}>Designed by</label>
                  <input className={INPUT} value={form.designerName} onChange={(e) => set({ designerName: e.target.value })} /></div>
                <div><label className={LABEL}>Designer's qualifications</label>
                  <input className={INPUT} value={form.designerQualifications} onChange={(e) => set({ designerQualifications: e.target.value })} /></div>
                <div><label className={LABEL}>Checked by</label>
                  <input className={INPUT} value={form.checkedBy} onChange={(e) => set({ checkedBy: e.target.value })} /></div>
                <div><label className={LABEL}>Checker's qualifications</label>
                  <input className={INPUT} value={form.checkerQualifications} onChange={(e) => set({ checkerQualifications: e.target.value })} /></div>
              </div>
              <div className="mt-4">
                <label className={LABEL}>Responsible for the stability of the structure</label>
                <input className={INPUT} value={form.stabilityResponsible} onChange={(e) => set({ stabilityResponsible: e.target.value })} />
              </div>
              <div className="mt-4">
                <label className={LABEL}>Independent check</label>
                <div className="flex flex-wrap gap-2">
                  {[["", "Not stated"], ["required", "Required"], ["completed", "Completed"]].map(([val, label]) => {
                    const on = (form.independentCheck || "") === val;
                    return (
                      <button key={label} type="button" onClick={() => set({ independentCheck: val })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          on ? "border-[#0A2F44] bg-[#e6f0f5] text-[#0A2F44] dark:border-[#66a4c2] dark:bg-[#1e3a4a] dark:text-[#66a4c2]"
                             : `border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:border-[#94a3b8]`}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] p-3 dark:bg-[#1e3a4a]">
                <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
                <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                  These are printed on the first page of the Detailed Report. Left blank, the report says "not entered".
                  Nothing is filled in for you: who designed, who checked and whether an independent check is required
                  or done are your statements, and building control asks for them with a submission. The independent
                  check is never ticked automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] p-3 dark:bg-[#1e3a4a]">
            <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" />
            <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
              Moments and shears are derived from a continuous-beam finite-element analysis with every node a support,
              not single-span coefficients. The governing values come from an envelope across multiple load patterns
              (all spans loaded, alternate spans, and adjacent pairs at each support).
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={reset} className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm dark:border-[#334155] ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}>
            <FiRefreshCw size={15} /> Reset
          </button>
          <button onClick={run} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white hover:bg-[#082636] disabled:opacity-50">
            {busy ? <FiLoader className="animate-spin" size={15} /> : null}
            {busy ? "Designing…" : "Run Design"} <FiArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}