// src/pages/StaircaseInput.jsx
// Staircase (flight + landing, per metre width) following Structville 5.4.
// Defaults are the book's worked example (flight 2), so a first run can be
// compared with the book.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiTriangle, FiRefreshCw, FiLoader, FiInfo, FiAlertTriangle } from "react-icons/fi";
import DesignProgressBar from "../components/ui/DesignProgressBar";
import ResetButton from "../components/ui/ResetButton";
import { applySettings } from "../utils/appSettings";
import Dropdown from "../components/Dropdown";
import { staircaseAPI } from "../services/api";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const SECTION = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";

const CONCRETE = ["C20/25", "C25/30", "C30/37", "C35/45", "C40/50"];
const BARS = ["8", "10", "12", "16", "20"];
// which form fields the Settings page pre-fills (utils/appSettings.js)
const SETTINGS_MAP = { keys: "snake", concrete: "concrete", steel: "fyk", steelNumeric: true };
const DRAFT_KEY = "staircaseInputDraft";

const DEFAULTS = {
  member_id: "ST1",
  n_risers: "10", riser_mm: "150", going_mm: "250",
  flight_span_mm: "2515", landing_mm: "1200", thickness_mm: "175",
  width_mm: "885", support_width_mm: "230", n_members: "1",
  finishes_kN_m2: "1.2", qk_kN_m2: "3.0",
  concrete: "C25/30", fyk: "460", cover_mm: "25",
  main_bar_mm: "12", main_spacing_mm: "200", autoBars: false,
  top_bar_mm: "12", top_spacing_mm: "",
  dist_bar_mm: "10", dist_spacing_mm: "250",
  designer_name: "", designer_qualifications: "", checked_by: "", checker_qualifications: "",
  stability_responsible: "", independent_check: "",
};

const num = (v) => parseFloat(v);
const optNum = (v) => (num(v) > 0 ? num(v) : null);
const fckOf = (g) => parseFloat(String(g).replace(/^C/, ""));

export default function StaircaseInput() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      return saved ? applySettings({ ...DEFAULTS, ...JSON.parse(saved) }, SETTINGS_MAP) : applySettings(DEFAULTS, { ...SETTINGS_MAP, fresh: true });
    } catch { return applySettings(DEFAULTS, { ...SETTINGS_MAP, fresh: true }); }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); }, [form]);

  const reset = () => { sessionStorage.removeItem(DRAFT_KEY); setForm(applySettings(DEFAULTS, { ...SETTINGS_MAP, fresh: true })); setError(null); };

  const run = async () => {
    for (const [k, label] of [["n_risers", "Number of risers"], ["riser_mm", "Riser"], ["going_mm", "Going"],
      ["flight_span_mm", "Flight span"], ["landing_mm", "Landing length"], ["thickness_mm", "Waist thickness"],
      ["width_mm", "Stair width"], ["support_width_mm", "Landing support width"]]) {
      if (!(num(form[k]) > 0)) { setError(`Enter a valid ${label.toLowerCase()}.`); return; }
    }
    setBusy(true); setError(null);
    try {
      const result = await staircaseAPI.design({
        member_id: (form.member_id || "").trim() || "ST1",
        n_risers: parseInt(form.n_risers, 10),
        riser_mm: num(form.riser_mm), going_mm: num(form.going_mm),
        flight_span_mm: num(form.flight_span_mm), landing_mm: num(form.landing_mm),
        thickness_mm: num(form.thickness_mm),
        finishes_kN_m2: num(form.finishes_kN_m2) || 0, qk_kN_m2: num(form.qk_kN_m2) || 0,
        fck: fckOf(form.concrete), fyk: num(form.fyk) || 500, cover_mm: num(form.cover_mm),
        main_bar_mm: num(form.main_bar_mm), main_spacing_mm: optNum(form.main_spacing_mm),
        auto_bars: !!form.autoBars,
        top_bar_mm: num(form.top_bar_mm), top_spacing_mm: optNum(form.top_spacing_mm),
        dist_bar_mm: num(form.dist_bar_mm), dist_spacing_mm: optNum(form.dist_spacing_mm),
        width_mm: num(form.width_mm), support_width_mm: num(form.support_width_mm),
        n_members: Math.max(1, parseInt(form.n_members, 10) || 1),
        design_basis: {
          designer_name: (form.designer_name || "").trim() || null,
          designer_qualifications: (form.designer_qualifications || "").trim() || null,
          checked_by: (form.checked_by || "").trim() || null,
          checker_qualifications: (form.checker_qualifications || "").trim() || null,
          stability_responsible: (form.stability_responsible || "").trim() || null,
          independent_check: form.independent_check || null,
        },
      });
      setBusy(false);
      navigate("/staircase-results", { state: { designResult: result, meta: {
        concrete: form.concrete, fyk: form.fyk,
      } } });
    } catch (e) {
      setBusy(false);
      setError(e.message === "Failed to fetch"
        ? "Cannot reach the design engine. The backend may be waking up — try again in a minute."
        : e.message);
    }
  };

  const rise = (num(form.n_risers) || 0) * (num(form.riser_mm) || 0);
  const going = Math.max((num(form.n_risers) || 1) - 1, 0) * (num(form.going_mm) || 0);
  const alpha = going > 0 ? (Math.atan(rise / going) * 180) / Math.PI : 0;
  const twoRG = 2 * (num(form.riser_mm) || 0) + (num(form.going_mm) || 0);

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      <header className="flex items-center gap-2.5 border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiTriangle size={15} /></div>
        <div>
          <div className={`text-sm font-bold ${MAIN}`}>Staircase Input (EC2)</div>
          <div className={`text-[11px] ${SUB}`}>Flight + landing, per metre width · EN 1992-1-1 · kN, m</div>
        </div>
        <div className="ml-auto"><ResetButton variant="top" onReset={reset} what="the staircase input" /></div>
      </header>

      <div className="w-full px-6 py-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <DesignProgressBar active={busy} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="space-y-5 min-w-0">
            <Card n={1} title="Project">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Text label="Member ID" value={form.member_id} onChange={(v) => set({ member_id: v })} />
              </div>
            </Card>

            <Card n={2} title="Geometry">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Num label="Number of risers" value={form.n_risers} onChange={(v) => set({ n_risers: v })} />
                <Num label="Riser" unit="mm" value={form.riser_mm} onChange={(v) => set({ riser_mm: v })} />
                <Num label="Going (tread)" unit="mm" value={form.going_mm} onChange={(v) => set({ going_mm: v })} />
                <Num label="Flight span (horizontal)" unit="mm" value={form.flight_span_mm} onChange={(v) => set({ flight_span_mm: v })} />
                <Num label="Landing length" unit="mm" value={form.landing_mm} onChange={(v) => set({ landing_mm: v })} />
                <Num label="Waist / landing thickness" unit="mm" value={form.thickness_mm} onChange={(v) => set({ thickness_mm: v })} />
                <Num label="Stair width" unit="mm" value={form.width_mm} onChange={(v) => set({ width_mm: v })} />
                <Num label="Landing support width (C)" unit="mm" value={form.support_width_mm} onChange={(v) => set({ support_width_mm: v })} />
              </div>
              <p className={`mt-3 text-xs ${SUB}`}>
                Flight span: horizontal distance from the centre of the top support (A) to where the flight meets the landing (B).
                Landing length: from B to the centre of the landing support (C). Treads = risers − 1.
                Stair width and the landing support (wall or beam at C) are used for detailing and the bar schedule.
              </p>
            </Card>

            <Card n={3} title="Loading">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Num label="Finishes" unit="kN/m²" value={form.finishes_kN_m2} onChange={(v) => set({ finishes_kN_m2: v })} />
                <Num label="Variable load qk" unit="kN/m²" value={form.qk_kN_m2} onChange={(v) => set({ qk_kN_m2: v })} />
              </div>
              <p className={`mt-3 text-xs ${SUB}`}>
                Self-weight is worked out: waist h × 25 (along the slope), steps ½ × riser × 25, landing h × 25.
                EN 1991-1-1 Table 6.2 gives 2 to 4 kN/m² for stairs. ULS = 1.35 gk + 1.5 qk.
              </p>
            </Card>

            <Card n={4} title="Materials & Reinforcement">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className={LABEL}>Concrete</label><Dropdown value={form.concrete} onChange={(v) => set({ concrete: v })} options={CONCRETE} /></div>
                <Num label="Steel fyk" unit="N/mm²" value={form.fyk} onChange={(v) => set({ fyk: v })} />
                <Num label="Cover" unit="mm" value={form.cover_mm} onChange={(v) => set({ cover_mm: v })} />
                <div><label className={LABEL}>Main bar (bottom)</label><Dropdown value={form.main_bar_mm} onChange={(v) => set({ main_bar_mm: v })} options={BARS} />
                  <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!form.autoBars} onChange={(e) => set({ autoBars: e.target.checked })} className="h-4 w-4 accent-[#0A2F44]" /><span>Let the engine choose the bar size</span></label>
                    <p className={`mt-1 text-[10px] ${SUB}`}>{form.autoBars ? "Each standard size is designed in turn; the passing one with the least steel is used and every option is listed in the report. The bar above is ignored." : "Only this bar is used. If it cannot carry the load, the design fails and says so."}</p></div>
                <Num label="Main spacing (blank = auto)" unit="mm" value={form.main_spacing_mm} onChange={(v) => set({ main_spacing_mm: v })} />
                <div />
                <div><label className={LABEL}>Top bar (at landing junction)</label><Dropdown value={form.top_bar_mm} onChange={(v) => set({ top_bar_mm: v })} options={BARS} /></div>
                <Num label="Top spacing (blank = auto)" unit="mm" value={form.top_spacing_mm} onChange={(v) => set({ top_spacing_mm: v })} />
                <div />
                <div><label className={LABEL}>Distribution bar</label><Dropdown value={form.dist_bar_mm} onChange={(v) => set({ dist_bar_mm: v })} options={BARS} /></div>
                <Num label="Distribution spacing (blank = auto)" unit="mm" value={form.dist_spacing_mm} onChange={(v) => set({ dist_spacing_mm: v })} />
                <Num label="No. of identical staircases (schedule)" value={form.n_members} onChange={(v) => set({ n_members: v })} />
              </div>
              <p className={`mt-3 text-xs ${SUB}`}>
                d = h − cover − φ/2 (cover as entered; cover for exposure and fire is not checked).
                Top steel is only designed if the frame analysis gives a hogging moment.
              </p>
            </Card>

            <Card n={5} title="Design Basis" optional>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <Text label="Designed by" value={form.designer_name} onChange={(v) => set({ designer_name: v })} />
                <Text label="Designer's qualifications" value={form.designer_qualifications} onChange={(v) => set({ designer_qualifications: v })} />
                <Text label="Checked by" value={form.checked_by} onChange={(v) => set({ checked_by: v })} />
                <Text label="Checker's qualifications" value={form.checker_qualifications} onChange={(v) => set({ checker_qualifications: v })} />
              </div>
              <div className="mt-4">
                <Text label="Responsible for the stability of the structure" value={form.stability_responsible} onChange={(v) => set({ stability_responsible: v })} />
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
              <p className={`mt-3 text-xs ${SUB}`}>Printed on the first page of the report. Left blank, the report says "not entered".</p>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className={SECTION}>Section (live)</h3></div>
              <div className="p-4"><StairSketch form={form} /></div>
            </div>
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-[#e2e8f0] dark:border-[#334155] px-5 py-3"><h3 className={SECTION}>Input Summary</h3></div>
              <div className="p-5 space-y-2.5">
                <Sum label="Rise / going" value={`${rise.toFixed(0)} / ${going.toFixed(0)} mm`} />
                <Sum label="Inclination α" value={`${alpha.toFixed(2)}°`} />
                <Sum label="2R + G" value={`${twoRG.toFixed(0)} mm`} />
                <Sum label="Span A–C" value={`${((num(form.flight_span_mm) || 0) + (num(form.landing_mm) || 0)).toFixed(0)} mm`} strong />
                <Sum label="h / cover" value={`${form.thickness_mm} / ${form.cover_mm} mm`} />
                <Sum label="Concrete / fyk" value={`${form.concrete} · ${form.fyk}`} />
              </div>
              <div className="px-5 pb-5">
                <div className="flex items-start gap-2 rounded-lg bg-[#e6f0f5] dark:bg-[#1e3a4a] p-3">
                  <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#cce1eb]" size={14} />
                  <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
                    Flight and landing analysed as one frame, pinned at both ends, by the force method (linear elastic, EC2 5.4).
                    Both supports must resist the horizontal thrust. Detailing and the bar schedule are on the results page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e2e8f0] dark:border-[#334155] pt-5">
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
function Num({ label, unit, value, onChange }) {
  return (
    <div>
      <label className={LABEL}>{label} {unit ? <span className="text-[#94a3b8]">({unit})</span> : null}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}
function Text({ label, value, onChange }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
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

/* Section through the flight and landing, to scale: steps, waist, landing and
   the two pinned supports of the analysis model. */
function StairSketch({ form }) {
  const n = Math.min(Math.max(parseInt(form.n_risers, 10) || 0, 1), 30);
  const R = num(form.riser_mm) || 0, G = num(form.going_mm) || 0;
  const L1 = num(form.flight_span_mm) || 0, L2 = num(form.landing_mm) || 0, h = num(form.thickness_mm) || 0;
  const Hf = n * R;
  if (!(L1 > 0 && L2 > 0 && Hf > 0)) return <p className={`text-xs ${SUB}`}>Enter the geometry.</p>;
  const W = 300, Hpx = 200, pad = 26;
  const sc = Math.min((W - 2 * pad) / (L1 + L2), (Hpx - 2 * pad) / (Hf + h));
  const X = (x) => pad + x * sc, Y = (y) => Hpx - pad - (y + h) * sc;
  // steps: start at the landing (B, y = 0) and climb towards A
  const treads = n - 1, x0 = L1 - treads * G;
  let d = `M ${X(L1 + L2)} ${Y(0)} L ${X(L1)} ${Y(0)}`;
  for (let i = 0; i < treads; i++) {
    const xr = L1 - i * G;
    d += ` L ${X(xr)} ${Y((i + 1) * R)} L ${X(xr - G)} ${Y((i + 1) * R)}`;
  }
  d += ` L ${X(Math.max(x0, 0))} ${Y(Hf)} L ${X(0)} ${Y(Hf)}`;
  const tri = (x, y) => `${X(x)},${Y(y) + 2} ${X(x) - 6},${Y(y) + 12} ${X(x) + 6},${Y(y) + 12}`;
  return (
    <svg viewBox={`0 0 ${W} ${Hpx}`} className="w-full h-auto">
      <path d={d} fill="none" stroke="#94a3b8" strokeWidth="1" />
      {/* waist soffit and landing soffit */}
      <line x1={X(0)} y1={Y(Hf - h)} x2={X(L1)} y2={Y(-h)} stroke="#0A2F44" strokeWidth="1.5" />
      <line x1={X(L1)} y1={Y(-h)} x2={X(L1 + L2)} y2={Y(-h)} stroke="#0A2F44" strokeWidth="1.5" />
      {/* analysis line */}
      <polyline points={`${X(0)},${Y(Hf - h / 2)} ${X(L1)},${Y(-h / 2)} ${X(L1 + L2)},${Y(-h / 2)}`} fill="none" stroke="#ef4444" strokeDasharray="4 3" strokeWidth="1" />
      <polygon points={tri(0, Hf - h)} fill="#0A2F44" />
      <polygon points={tri(L1 + L2, -h)} fill="#0A2F44" />
      <text x={X(0) - 4} y={Y(Hf - h) - 4} fontSize="10" fill="#0A2F44" textAnchor="end">A</text>
      <text x={X(L1)} y={Y(-h) + 14} fontSize="10" fill="#0A2F44" textAnchor="middle">B</text>
      <text x={X(L1 + L2) + 4} y={Y(-h) - 4} fontSize="10" fill="#0A2F44">C</text>
      <text x={(X(0) + X(L1)) / 2} y={Hpx - 4} fontSize="9" fill="#64748b" textAnchor="middle">{L1} mm</text>
      <text x={(X(L1) + X(L1 + L2)) / 2} y={Hpx - 4} fontSize="9" fill="#64748b" textAnchor="middle">{L2} mm</text>
    </svg>
  );
}
