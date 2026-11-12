// src/pages/LoadCases.jsx — load sets and the load factors the engines use
// (renders inside MainLayout). Load sets are kept in this browser
// (utils/loadLibrary.js); "Use on" writes the set into an input page's draft
// and opens that page. The factor tables are a read-out of the engines:
// changing them here would not change a design, so they are not editable.
import Dropdown from "../components/Dropdown";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiCopy, FiTrash2, FiArrowRight } from "react-icons/fi";
import ResetButton from "../components/ui/ResetButton";
import {
  OCCUPANCY, AREA_FIELDS, LINE_FIELDS, TARGETS, newLoadSet, listLoadSets, saveLoadSets, totals,
} from "../utils/loadLibrary";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const INPUT = "w-full rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0b0f19] px-3 py-2 text-sm text-[#0F172A] dark:text-white focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none";
const BTN = `flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-3 py-1.5 text-[13px] font-medium ${MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors`;
const TH = `py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide ${SUB}`;
const TD = `py-2 pr-4 text-[13px] ${MAIN}`;

const f2 = (v) => Number(v || 0).toFixed(2);
const newId = () => `${Date.now()}`;

// load factors as the engines apply them (keep in step with the backend)
const FACTORS = [
  ["γG, permanent", "1.35", "EN 1990 Eq. 6.10", "All elements"],
  ["γQ, variable", "1.50", "EN 1990 Eq. 6.10", "All elements"],
  ["ψ0, imposed (accompanying)", "0.7 (storage 1.0)", "EN 1990 Table A1.1", "One-way / two-way slab, when wind is entered"],
  ["ψ0, wind (accompanying)", "0.6", "EN 1990 Table A1.1", "One-way / two-way slab, when wind is entered"],
  ["ψ2, quasi-permanent", "by occupancy (table below); 0.6 if not stated", "EN 1990 Table A1.1", "Continuous slab crack check"],
  ["ψ2, quasi-permanent", "0.6 (assumed)", "EN 1990 Table A1.1", "Continuous beam crack check"],
  ["Service = ULS / factor", "1.36 (editable on the page)", "", "Foundations, when no service load is entered"],
];
const PATTERNS = [
  ["Continuous slab", "Loaded spans carry 1.35 Gk + 1.5 Qk, unloaded spans 1.35 Gk (EC2 5.1.3). Moments and shears are enveloped separately."],
  ["Continuous beam", "No pattern loading: every span carries the full design load. End supports are taken both pinned and fixed and the worse governs."],
  ["One-way / two-way slab", "Single span (one-way) or moment coefficients (two-way); the leading action is chosen or left on Auto."],
];

export default function LoadCases() {
  const navigate = useNavigate();
  const [sets, setSets] = useState(listLoadSets);
  const [selId, setSelId] = useState(() => listLoadSets()[0]?.id || null);
  const sel = sets.find((s) => s.id === selId) || null;

  const store = (next, id = selId) => { setSets(next); saveLoadSets(next); setSelId(id); };
  const update = (patch) => store(sets.map((s) => (s.id === selId ? { ...s, ...patch } : s)));
  const setValue = (k, v) => update({ values: { ...sel.values, [k]: v } });
  const add = (kind) => { const s = newLoadSet(kind); store([...sets, s], s.id); };
  const duplicate = () => { const s = { ...sel, id: newId(), name: `${sel.name} (copy)`, values: { ...sel.values } }; store([...sets, s], s.id); };
  const remove = () => { const next = sets.filter((s) => s.id !== selId); store(next, next[0]?.id || null); };
  const pickOccupancy = (value) => {
    const o = OCCUPANCY.find((x) => x.value === value);
    update({ occupancy: value, ...(o?.qk != null ? { values: { ...sel.values, imposed: o.qk } } : {}) });
  };
  const applyTo = (t) => {
    t.apply(sel.values, sel);
    navigate(t.route);
  };

  const fields = sel?.kind === "line" ? LINE_FIELDS : AREA_FIELDS;
  const unit = sel?.kind === "line" ? "kN/m" : "kN/m²";
  const t = sel ? totals(sel) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Load Cases</h1>
        <p className={`text-sm ${SUB}`}>
          Define loads once and apply them to an element. Values are characteristic (unfactored); self-weight is added by each element.
        </p>
      </div>

      {/* ---------------- load sets ---------------- */}
      <section className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-3 dark:border-[#334155]">
          <h2 className={TITLE}>Load sets</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => add("area")} className={BTN}><FiPlus size={14} /> Floor / slab set (kN/m²)</button>
            <button type="button" onClick={() => add("line")} className={BTN}><FiPlus size={14} /> Beam set (kN/m)</button>
          </div>
        </div>

        {sets.length === 0 ? (
          <p className={`px-5 py-8 text-center text-sm ${SUB}`}>
            No load sets yet. Add a floor / slab set for slabs and staircases, or a beam set for beams.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
            <ul className="border-b border-[#e2e8f0] md:border-b-0 md:border-r dark:border-[#334155]">
              {sets.map((s) => {
                const tt = totals(s);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => setSelId(s.id)}
                      className={`w-full border-l-2 px-4 py-2.5 text-left transition-colors ${s.id === selId
                        ? "border-[#0A2F44] bg-[#e6f0f5] dark:border-[#66a4c2] dark:bg-[#1e3a4a]"
                        : "border-transparent hover:bg-[#f8fafc] dark:hover:bg-[#263244]"}`}>
                      <div className={`truncate text-[13px] font-semibold ${MAIN}`}>{s.name || "Untitled"}</div>
                      <div className={`text-[11px] ${SUB}`}>
                        {s.kind === "line" ? "Beam, kN/m" : "Floor / slab, kN/m²"} · G {f2(tt.G)} · Q {f2(tt.Q)}{tt.W ? ` · W ${f2(tt.W)}` : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {sel && (
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>Name</label>
                    <input className={INPUT} value={sel.name} onChange={(e) => update({ name: e.target.value })} />
                  </div>
                  {sel.kind === "area" && (
                    <div>
                      <label className={LABEL}>Occupancy (fills the imposed load)</label>
                      <Dropdown value={sel.occupancy || ""} onChange={(v) => pickOccupancy(v)}
                        options={OCCUPANCY.map((o) => ({ value: o.value, label: o.label }))} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {fields.map(([k, label]) => (
                    <div key={k}>
                      <label className={LABEL}>{label} <span className="font-normal opacity-70">({unit})</span></label>
                      <input type="number" min="0" step="0.1" className={INPUT} value={sel.values[k] ?? 0}
                        onChange={(e) => setValue(k, e.target.value)} />
                    </div>
                  ))}
                </div>

                <div className={`rounded-lg bg-[#f8fafc] px-4 py-3 text-[13px] dark:bg-[#0b0f19] ${MAIN}`}>
                  <div>Characteristic totals: G<sub>k</sub> = {f2(t.G)}, Q<sub>k</sub> = {f2(t.Q)}{sel.kind === "area" ? <>, W<sub>k</sub> = {f2(t.W)}</> : null} {unit} (self-weight not included)</div>
                  <div className={`mt-1 font-mono text-xs ${SUB}`}>
                    1.35 G<sub>k</sub> + 1.5 Q<sub>k</sub> = {f2(1.35 * t.G + 1.5 * t.Q)} {unit}
                    {t.W > 0 && <> · wind leading 1.35 G<sub>k</sub> + 1.5 W<sub>k</sub> + 1.5×0.7 Q<sub>k</sub> = {f2(1.35 * t.G + 1.5 * t.W + 1.05 * t.Q)} {unit}</>}
                  </div>
                </div>

                <div>
                  <div className={LABEL}>Use on</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {TARGETS.filter((x) => x.kind === sel.kind).map((x) => (
                      <button key={x.id} type="button" onClick={() => applyTo(x)} title={x.notes}
                        className="group rounded-lg border border-[#e2e8f0] p-3 text-left transition-colors hover:border-[#0A2F44] hover:bg-[#e6f0f5] dark:border-[#334155] dark:hover:border-[#66a4c2] dark:hover:bg-[#1e3a4a]">
                        <div className={`flex items-center justify-between text-[13px] font-semibold ${MAIN}`}>{x.label} <FiArrowRight size={14} /></div>
                        <div className={`mt-0.5 text-[11px] leading-snug ${SUB}`}>{x.notes}</div>
                      </button>
                    ))}
                  </div>
                  <p className={`mt-2 text-[11px] ${SUB}`}>Opens the input page with these loads filled in; the other fields there are kept.</p>
                </div>

                <div className="flex gap-2 border-t border-[#e2e8f0] pt-4 dark:border-[#334155]">
                  <button type="button" onClick={duplicate} className={BTN}><FiCopy size={14} /> Duplicate</button>
                  <ResetButton onReset={remove} title="Delete this load set?" confirmLabel="Delete"
                    message={`"${sel.name}" will be removed. Designs already run with it are not affected.`}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
                    <FiTrash2 size={14} /> Delete
                  </ResetButton>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------------- read-outs of the engines ---------------- */}
      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Load factors used in the designs</h2>
        <p className={`mt-1 text-xs ${SUB}`}>These are the values the design engines apply. They are shown for reference and cannot be changed here.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[#e2e8f0] dark:border-[#334155]">
              {["Factor", "Value", "Source", "Used by"].map((h) => <th key={h} className={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {FACTORS.map((r, i) => (
                <tr key={i} className="border-b border-[#f1f5f9] dark:border-[#334155]">
                  {r.map((c, j) => <td key={j} className={`${TD} ${j === 1 ? "font-mono" : ""} ${j > 1 ? SUB : ""}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-3 text-xs ${SUB}`}>
          Slab with wind: imposed leading 1.35 G<sub>k</sub> + 1.5 Q<sub>k</sub> + 1.5×0.6 W<sub>k</sub>, wind leading 1.35 G<sub>k</sub> + 1.5 W<sub>k</sub> + 1.5×0.7 Q<sub>k</sub>; Auto uses the larger.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Imposed load by occupancy</h2>
          <table className="mt-3 w-full">
            <thead><tr className="border-b border-[#e2e8f0] dark:border-[#334155]">
              {["Occupancy", "Qk (kN/m²)", "ψ2"].map((h) => <th key={h} className={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {OCCUPANCY.filter((o) => o.value).map((o) => (
                <tr key={o.value} className="border-b border-[#f1f5f9] dark:border-[#334155]">
                  <td className={TD}>{o.name}</td><td className={`${TD} font-mono`}>{o.qk.toFixed(1)}</td><td className={`${TD} font-mono`}>{o.psi2}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`mt-2 text-xs ${SUB}`}>EN 1991-1-1 values (indicative) as offered on the continuous slab page; ψ2 from EN 1990 Table A1.1. The one-way / two-way slab page has its own building-use list.</p>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>How each element arranges the load</h2>
          <dl className="mt-3 space-y-3">
            {PATTERNS.map(([k, v]) => (
              <div key={k}>
                <dt className={`text-[13px] font-semibold ${MAIN}`}>{k}</dt>
                <dd className={`text-[13px] leading-snug ${SUB}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
