// src/components/beam/ContinuousBeamForm.jsx
// Continuous beam input form, extracted from pages/ContinuousBeamInput.jsx so it can be
// rendered either standalone (route /continuous-beam) or embedded inside BeamInput's
// beam-type toggle. Submit always routes to /continuous-beam-results, because the
// continuous result shape differs from the simply-supported one.
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiInfo, FiRefreshCw, FiArrowRight, FiLoader, FiAlertTriangle, FiPlus, FiMinus } from "react-icons/fi";
import { continuousBeamAPI } from "../../services/api";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

const CONT_BEAM_DRAFT_KEY = "structai:continuousBeamInput:draft";

const DESIGN_CODES = [{ value: "EC2", label: "EN 1992-1-1 (Eurocode 2)" }, { value: "BS8110", label: "BS 8110:1997" }];
const CONCRETE_EC = [{ value: "C25/30", label: "C25/30 (fck 25)" }, { value: "C30/37", label: "C30/37 (fck 30)" }, { value: "C35/45", label: "C35/45 (fck 35)" }];
const STEEL_EC = [{ value: "B500", label: "B500B (fyk 500)" }, { value: "B460", label: "B460B (fyk 460)" }];
const CONCRETE_BS = [{ value: "M20", label: "M20" }, { value: "M25", label: "M25" }, { value: "M30", label: "M30" }];
const STEEL_BS = [{ value: "Fe415", label: "Fe415" }, { value: "Fe500", label: "Fe500" }];
const EXPOSURE = [{ value: "XC1", label: "XC1 — Dry" }, { value: "XC2", label: "XC2 — Wet" }, { value: "XC3", label: "XC3 — Moderate" }, { value: "XC4", label: "XC4 — Cyclic" }];
const SUPPORT_OPTS = [{ value: "simple", label: "Simple" }, { value: "continuous", label: "Continuous" }];

const DEFAULTS = {
  beamId: "CB1", designCode: "EC2", analysisMethod: "Linear Elastic",
  nSpans: 3, spanLengths: ["6000", "4000", "6000"],
  width: "300", depth: "500", effectiveDepth: "450", cover: "25",
  concreteGrade: "C25/30", steelGrade: "B500", unitWeightConcrete: "25", unitWeightSteel: "78.5",
  selfWeightAuto: true, wallLoad: "10", finishes: "1.5", additionalDeadLoad: "1.2", liveLoad: "5", otherLiveLoad: "0",
  perSpan: false, spanLoads: [],
  endSupport: "simple",
  designWorkingLife: "50", exposureClass: "XC1", crackedSectionSls: true,
  notes: "",
  region: "Nigeria",
};

const ContinuousBeamForm = ({ showHeader = true }) => {
  const navigate = useNavigate();
  const [f, setF] = useState(() => {
    try {
      const saved = sessionStorage.getItem(CONT_BEAM_DRAFT_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    try {
      sessionStorage.setItem(CONT_BEAM_DRAFT_KEY, JSON.stringify(f));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) -- draft just won't persist
    }
  }, [f]);

  const isBS = f.designCode === "BS8110";
  const concreteOpts = isBS ? CONCRETE_BS : CONCRETE_EC;
  const steelOpts = isBS ? STEEL_BS : STEEL_EC;

  const setSpanCount = (n) => {
    n = Math.max(2, Math.min(8, n));
    const arr = [...f.spanLengths];
    while (arr.length < n) arr.push(arr[arr.length - 1] || "6000");
    arr.length = n;
    set({ nSpans: n, spanLengths: arr });
  };
  const setSpanLen = (i, v) => { const arr = [...f.spanLengths]; arr[i] = v; set({ spanLengths: arr }); };

  const selfW = f.selfWeightAuto ? (parseFloat(f.width) / 1000) * (parseFloat(f.depth) / 1000) * (parseFloat(f.unitWeightConcrete) || 0) : 0;
  const dl = selfW + (parseFloat(f.wallLoad) || 0) + (parseFloat(f.finishes) || 0) + (parseFloat(f.additionalDeadLoad) || 0);
  const ll = (parseFloat(f.liveLoad) || 0) + (parseFloat(f.otherLiveLoad) || 0);
  const service = dl + ll;

  const reset = () => {
    if (window.confirm("Reset all fields?")) {
      setF(DEFAULTS);
      setError(null);
      try {
        sessionStorage.removeItem(CONT_BEAM_DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  };

  const proceed = async () => {
    setBusy(true); setError(null);
    try {
      const result = await continuousBeamAPI.startDesign(f);
      navigate("/continuous-beam-results", { state: { designResult: result } });
    } catch (e) { setError(e.message || "Design request failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="mb-5">
          <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Continuous Beam Input</h1>
          <p className={`text-sm ${SUB}`}>Enter required inputs for the continuous beam design in accordance with the selected code.</p>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <FiAlertTriangle className="mt-0.5 text-red-600 dark:text-red-400" /><p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* 1. GENERAL */}
          <Section n="1" title="General">
            <div className="grid grid-cols-3 gap-4">
              <div><label className={LABEL}>Beam Name / ID</label><input className={INPUT} value={f.beamId} onChange={(e) => set({ beamId: e.target.value })} /></div>
              <div><label className={LABEL}>Design Code</label><Dropdown value={f.designCode} onChange={(e) => set({ designCode: e.target.value, concreteGrade: e.target.value === "BS8110" ? "M25" : "C25/30", steelGrade: e.target.value === "BS8110" ? "Fe500" : "B500" })} options={DESIGN_CODES} /></div>
              <div><label className={LABEL}>Analysis Method</label><input className={INPUT} value={f.analysisMethod} onChange={(e) => set({ analysisMethod: e.target.value })} /></div>
            </div>
          </Section>

          {/* 2. GEOMETRY */}
          <Section n="2" title="Geometry">
            <div className="mb-3 flex items-center gap-3">
              <label className={LABEL + " mb-0"}>Number of Spans</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setSpanCount(f.nSpans - 1)} className="rounded-md border border-[#e2e8f0] dark:border-[#334155] p-1.5 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"><FiMinus size={13} /></button>
                <span className={`w-8 text-center font-mono text-sm ${MAIN}`}>{f.nSpans}</span>
                <button onClick={() => setSpanCount(f.nSpans + 1)} className="rounded-md border border-[#e2e8f0] dark:border-[#334155] p-1.5 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"><FiPlus size={13} /></button>
              </div>
            </div>
            <label className={LABEL}>Span Lengths (mm)</label>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {f.spanLengths.map((v, i) => (
                <div key={i}>
                  <span className={`mb-1 block text-[10px] ${SUB}`}>L{i + 1}</span>
                  <input type="number" step="100" value={v} onChange={(e) => setSpanLen(i, e.target.value)} className={INPUT} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Width (b)" unit="mm" value={f.width} onChange={(v) => set({ width: v })} step="25" />
              <Field label="Overall Depth (D)" unit="mm" value={f.depth} onChange={(v) => set({ depth: v })} step="25" />
              <Field label="Effective Depth (d)" unit="mm" value={f.effectiveDepth} onChange={(v) => set({ effectiveDepth: v })} step="5" />
              <Field label="Cover" unit="mm" value={f.cover} onChange={(v) => set({ cover: v })} step="5" />
            </div>
          </Section>

          {/* 3. MATERIALS */}
          <Section n="3" title="Materials">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Concrete Grade</label><Dropdown value={f.concreteGrade} onChange={(e) => set({ concreteGrade: e.target.value })} options={concreteOpts} /></div>
              <div><label className={LABEL}>Steel Grade</label><Dropdown value={f.steelGrade} onChange={(e) => set({ steelGrade: e.target.value })} options={steelOpts} /></div>
              <Field label="Unit Weight of Concrete" unit="kN/m³" value={f.unitWeightConcrete} onChange={(v) => set({ unitWeightConcrete: v })} step="0.5" />
              <Field label="Unit Weight of Steel" unit="kN/m³" value={f.unitWeightSteel} onChange={(v) => set({ unitWeightSteel: v })} step="0.5" />
            </div>
          </Section>

          {/* 4. LOADS */}
          <Section n="4" title="Loads (Characteristic, kN/m)">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL}>Beam Self Weight (auto)</label>
                <div className="flex items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#475569] bg-[#f1f5f9] dark:bg-[#334155] px-3 py-2">
                  <span className="font-mono text-sm font-bold text-[#0A2F44] dark:text-[#66a4c2]">{selfW.toFixed(2)}</span>
                  <input type="checkbox" checked={f.selfWeightAuto} onChange={(e) => set({ selfWeightAuto: e.target.checked })} />
                </div>
              </div>
              <Field label="Wall Load" value={f.wallLoad} onChange={(v) => set({ wallLoad: v })} step="0.5" />
              <Field label="Finishes / Add. DL" value={f.finishes} onChange={(v) => set({ finishes: v })} step="0.5" />
              <Field label="Additional Dead Load" value={f.additionalDeadLoad} onChange={(v) => set({ additionalDeadLoad: v })} step="0.5" />
              <Field label="Live Load" value={f.liveLoad} onChange={(v) => set({ liveLoad: v })} step="0.5" />
              <Field label="Other Live Load" value={f.otherLiveLoad} onChange={(v) => set({ otherLiveLoad: v })} step="0.5" />
            </div>
            <div className="mt-3 rounded-lg border border-[#0A2F44]/20 dark:border-[#66a4c2]/20 bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3 text-sm">
              <div className="flex justify-between"><span className={SUB}>Total Dead (Gk)</span><span className={`font-mono font-bold ${MAIN}`}>{dl.toFixed(2)} kN/m</span></div>
              <div className="flex justify-between"><span className={SUB}>Total Live (Qk)</span><span className={`font-mono font-bold ${MAIN}`}>{ll.toFixed(2)} kN/m</span></div>
              <div className="flex justify-between"><span className="font-semibold text-[#0A2F44] dark:text-[#66a4c2]">Total Service (Gk + Qk)</span><span className="font-mono font-bold text-[#0A2F44] dark:text-[#66a4c2]">{service.toFixed(2)} kN/m</span></div>
            </div>
            <p className={`mt-2 text-[11px] ${SUB}`}>These are the global default loads applied to every span. Per-span overrides can be wired via the <code>spanLoads</code> field.</p>
          </Section>

          {/* 5. SUPPORT CONDITIONS */}
          <Section n="5" title="Support Conditions">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div><label className={LABEL}>End Support</label><Dropdown value={f.endSupport} onChange={(e) => set({ endSupport: e.target.value })} options={SUPPORT_OPTS} /></div>
            </div>
            <p className={`mt-2 text-[11px] ${SUB}`}>Intermediate supports are treated as continuous (monolithic) per the coefficient method.</p>
          </Section>

          {/* 6. DESIGN PARAMETERS */}
          <Section n="6" title="Design Parameters">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Design Working Life (yrs)" value={f.designWorkingLife} onChange={(v) => set({ designWorkingLife: v })} step="10" />
              <div><label className={LABEL}>Exposure Class</label><Dropdown value={f.exposureClass} onChange={(e) => set({ exposureClass: e.target.value })} options={EXPOSURE} /></div>
              <div>
                <label className={LABEL}>Cracked Section (SLS)</label>
                <div className="flex h-[42px] items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3">
                  <span className={`text-xs ${SUB}`}>Use for deflection</span>
                  <input type="checkbox" checked={f.crackedSectionSls} onChange={(e) => set({ crackedSectionSls: e.target.checked })} />
                </div>
              </div>
            </div>
          </Section>

          {/* 7. NOTES */}
          <Section n="7" title="Notes & Assumptions">
            <ul className={`mb-3 ml-5 list-disc space-y-1 text-[13px] ${SUB}`}>
              <li>All dimensions in mm; forces in kN, moments in kNm.</li>
              <li>Beam assumed prismatic over all spans (constant section).</li>
              <li>Self-weight is auto-calculated from the section and concrete unit weight.</li>
              <li>Moments/shears from continuous-beam coefficients; intermediate supports monolithic.</li>
            </ul>
            <label className={LABEL}>Additional notes (optional)</label>
            <textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Project-specific assumptions, references, etc."
              className="w-full resize-none rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-3 py-2 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]" />
          </Section>
        </div>

        {/* RIGHT SUMMARY */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            <RightCard title="Continuous Beam Layout">
              <BeamLayout nSpans={f.nSpans} lengths={f.spanLengths} />
            </RightCard>
            <RightCard title="Cross Section">
              <CrossSection width={f.width} depth={f.depth} eff={f.effectiveDepth} cover={f.cover} />
            </RightCard>
            <RightCard title="Input Summary">
              <div className="space-y-1.5">
                <SumRow label="Beam ID" value={f.beamId} />
                <SumRow label="Design Code" value={f.designCode} />
                <SumRow label="No. of Spans" value={f.nSpans} />
                <SumRow label="Spans (mm)" value={f.spanLengths.join(" / ")} />
                <SumRow label="Section" value={`${f.width} × ${f.depth} mm`} />
                <SumRow label="Eff. Depth" value={`${f.effectiveDepth} mm`} />
                <SumRow label="Concrete" value={f.concreteGrade} />
                <SumRow label="Steel" value={f.steelGrade} />
                <SumRow label="Total Dead (Gk)" value={`${dl.toFixed(2)} kN/m`} />
                <SumRow label="Total Live (Qk)" value={`${ll.toFixed(2)} kN/m`} />
                <SumRow label="Total Service" value={`${service.toFixed(2)} kN/m`} strong />
                <SumRow label="End Support" value={f.endSupport} />
                <SumRow label="Exposure" value={f.exposureClass} />
              </div>
            </RightCard>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e2e8f0] dark:border-[#334155] pt-4">
        <button onClick={reset} className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}><FiRefreshCw size={15} /> Reset</button>
        <button onClick={proceed} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white shadow-md hover:bg-[#082636] disabled:opacity-50">
          {busy ? <FiLoader className="animate-spin" size={15} /> : null}{busy ? "Designing…" : "Save & Continue to Design"} <FiArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

/* ---------- primitives ---------- */
function Section({ n, title, children }) {
  return <div className={CARD}><div className="p-5"><div className="mb-4"><h2 className={TITLE}>{n}. {title}</h2></div>{children}</div></div>;
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
function Dropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-[#0A2F44]">
        <span className={`font-mono text-sm ${MAIN}`}>{sel?.label || "Select…"}</span><FiChevronDown className={`text-[#64748b] dark:text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] shadow-lg">
        {options.map((o) => <button key={o.value} type="button" onClick={() => { onChange({ target: { value: o.value } }); setOpen(false); }} className={`w-full px-3 py-2 text-left text-sm hover:bg-[#e6f0f5] dark:hover:bg-[#1e3a4a] ${o.value === value ? "bg-[#e6f0f5] dark:bg-[#1e3a4a] font-medium text-[#0A2F44] dark:text-[#66a4c2]" : MAIN}`}>{o.label}</button>)}
      </div>}
    </div>
  );
}

/* ---------- cross section diagram (matched to BeamInput CrossSection: same 200x160 viewBox,
   w-full, solid 0.45 fill, red stirrup + red bars, identical dimension lines) ---------- */
function CrossSection({ width, depth }) {
  const DIM = "var(--dim)";
  return (
    <svg viewBox="0 0 200 160" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="cbf-cs" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      {/* concrete outline */}
      <rect x="55" y="20" width="90" height="115" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.4" />
      {/* link / stirrup */}
      <rect x="64" y="29" width="72" height="97" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" />
      {/* bottom bars (tension) */}
      {[72, 100, 128].map((x) => <circle key={`b${x}`} cx={x} cy={120} r="3.2" fill="#ef4444" />)}
      {/* top bars */}
      {[80, 120].map((x) => <circle key={`t${x}`} cx={x} cy={34} r="2.6" fill="#ef4444" />)}
      {/* width dim */}
      <line x1="55" y1="146" x2="145" y2="146" stroke={DIM} strokeWidth="1" markerStart="url(#cbf-cs)" markerEnd="url(#cbf-cs)" />
      <text x="100" y="157" fontSize="9" fill={DIM} textAnchor="middle">{width} mm</text>
      {/* depth dim */}
      <line x1="160" y1="20" x2="160" y2="135" stroke={DIM} strokeWidth="1" markerStart="url(#cbf-cs)" markerEnd="url(#cbf-cs)" />
      <text x="166" y="80" fontSize="9" fill={DIM} transform="rotate(90 166 80)" textAnchor="middle">{depth} mm</text>
    </svg>
  );
}

/* ---------- continuous beam layout (matched to BeamInput ElevationView: same 500x120 viewBox,
   beam x60->440 / y34 h22, six UDL load arrows, triangle supports at y74 — but placed at EVERY
   node, with per-span L1..Ln labels and a total-span dimension line) ---------- */
function BeamLayout({ nSpans, lengths }) {
  const DIM = "var(--dim)";
  const n = Math.max(1, parseInt(nSpans) || 1);
  const total = lengths.slice(0, n).reduce((s, v) => s + (parseFloat(v) || 0), 0) || 1;
  const x0 = 60, x1 = 440, W = x1 - x0;
  const nodes = [x0];
  let acc = x0;
  for (let i = 0; i < n; i++) { acc += ((parseFloat(lengths[i]) || 0) / total) * W; nodes.push(acc); }
  return (
    <svg viewBox="0 0 500 120" className="w-full text-[#94a3b8] dark:text-[#64748b] [--dim:#0A2F44] dark:[--dim:#66a4c2]">
      <defs><marker id="cbf-be" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={DIM} /></marker></defs>
      {/* beam */}
      <rect x={x0} y="34" width={W} height="22" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
      {/* UDL load arrows (same positions as SS ElevationView) */}
      {[110, 170, 230, 290, 350, 410].map((x) => <line key={`a${x}`} x1={x} y1="22" x2={x} y2="34" stroke="currentColor" strokeWidth="1.2" markerStart="url(#cbf-be)" />)}
      {/* triangular supports at every node (ends + interior) */}
      {nodes.map((x, i) => <path key={`s${i}`} d={`M${x},74 l-9,13 h18 z`} fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.4" />)}
      {/* per-span labels L1..Ln */}
      {nodes.slice(0, -1).map((x, i) => (
        <text key={`l${i}`} x={(x + nodes[i + 1]) / 2} y="70" fontSize="10" fill={DIM} textAnchor="middle">L{i + 1}</text>
      ))}
      {/* total span dimension line (same y as SS span dim) */}
      <line x1={x0} y1="100" x2={x1} y2="100" stroke={DIM} strokeWidth="1" markerStart="url(#cbf-be)" markerEnd="url(#cbf-be)" />
      <text x={(x0 + x1) / 2} y="114" fontSize="10" fill={DIM} textAnchor="middle">Total L = {Math.round(total)} mm</text>
    </svg>
  );
}

export default ContinuousBeamForm;