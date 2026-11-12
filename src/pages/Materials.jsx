// src/pages/Materials.jsx — material data the designs use (renders inside
// MainLayout). Concrete and steel properties are the EC2 formulas the engines
// apply; the cover and fire tables are copies of the backend tables (keep in
// step); cost rates are read live from backend/engine/rates_db.json.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { slabAPI } from "../services/api";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const TH = `py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${SUB}`;
const TD = `py-2 pr-4 text-[13px] whitespace-nowrap ${MAIN}`;
const LINK = "font-medium text-[#0A2F44] hover:underline dark:text-[#66a4c2]";

/* which input page offers which grade (the dropdowns on each page) */
const ELS = ["Slab", "Cont. slab", "Beam", "Column", "Foundation", "Staircase"];
const CONCRETE_ON = {
  "C20/25": ["Slab", "Cont. slab", "Column", "Foundation", "Staircase"],
  "C25/30": ELS, "C30/37": ELS, "C35/45": ELS,
  "C40/50": ["Slab", "Cont. slab", "Column", "Foundation", "Staircase"],
  "C45/55": ["Column"], "C50/60": ["Column"],
};
const STEEL_ON = {
  B410: ["Slab", "Cont. slab", "Staircase (fyk 410)"],
  B460: ["Slab", "Cont. slab", "Beam", "Column", "Foundation", "Staircase (fyk 460)"],
  B500: ["Slab", "Cont. slab", "Beam", "Column", "Foundation", "Staircase (fyk 500)"],
};

// EC2 Table 3.1
const fctm = (fck) => (fck <= 50 ? 0.3 * fck ** (2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10));
const ecm = (fck) => 22 * ((fck + 8) / 10) ** 0.3;
// mass per metre as used in the bar schedules (backend/engine/foundation_detailing.py UNIT_MASS)
const BARS = [[6, 0.222], [8, 0.395], [10, 0.616], [12, 0.888], [16, 1.579], [20, 2.466], [25, 3.854], [32, 6.313], [40, 9.864]];
// c_min,dur (mm): slabs (backend two_way_slab_engine EXPOSURE_MIN_DUR_MM) and the continuous beam
// (continuous_beam_service C_MIN_DUR_S4, EC2 Table 4.4N, class S4)
const COVER = [["XC1", 20, 15], ["XC2", 25, 25], ["XC3", 30, 25], ["XC4", 35, 30], ["XD1", null, 35], ["XD2", null, 40], ["XD3", null, 45], ["XS1", null, 35], ["XS2", null, 40], ["XS3", null, 45]];
// EN 1992-1-2 Table 5.8 (backend continuous_slab_service FIRE_TABLE_5_8)
const FIRE = [[30, 60, 10], [60, 80, 20], [90, 100, 30], [120, 120, 40], [180, 150, 55], [240, 175, 65]];

function Table({ head, rows, mono = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-[#e2e8f0] dark:border-[#334155]">{head.map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#f1f5f9] dark:border-[#334155]">
              {r.map((c, j) => <td key={j} className={`${TD} ${mono.includes(j) ? "font-mono" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rates() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { regions = [], version } = await slabAPI.getRegions();
        const data = await Promise.all(regions.map((r) => slabAPI.getRates(r)));
        if (live) setState({ version, data });
      } catch (e) {
        if (live) setState({ error: e.message === "Failed to fetch" ? "The design server is not reachable." : e.message });
      }
    })();
    return () => { live = false; };
  }, []);

  if (state.loading) return <p className={`mt-3 text-sm ${SUB}`}>Loading rates…</p>;
  if (state.error) return <p className="mt-3 text-sm text-red-600 dark:text-red-400">Could not load the cost rates: {state.error}</p>;
  const fmt = (v, cur) => (v == null ? "—" : `${cur} ${Number(v).toLocaleString()}`);
  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
        {state.data.map(({ region, rates }) => {
          const m = rates.materials || {}, cur = rates.currency || "";
          return (
            <div key={region}>
              <div className={`mb-1 text-sm font-semibold ${MAIN}`}>{region} <span className={`font-normal ${SUB}`}>({cur})</span></div>
              <Table head={["Item", "Rate"]} mono={[1]} rows={[
                ...Object.entries(m.concrete || {}).map(([g, v]) => [`Concrete ${g} (per m³)`, fmt(v, cur)]),
                ...Object.entries(m.reinforcement || m.steel || {}).map(([g, v]) => [`Reinforcement ${g} (per tonne)`, fmt(v, cur)]),
                ...Object.entries(m.formwork || {}).map(([g, v]) => [`Formwork, ${g.replace(/_/g, " ")} (per m²)`, fmt(v, cur)]),
              ]} />
            </div>
          );
        })}
      </div>
      <p className={`mt-3 text-xs ${SUB}`}>
        Rate table {state.version || ""}. Used for the slab and continuous slab cost breakdown (Region on the page); the design itself does not depend on it.
        A grade with no rate listed here is priced at a fixed fallback (105,000 per m³ of concrete, 950,000 per tonne of steel) in the region's currency,
        so add a rate for every grade you use. To change the rates, edit backend/engine/rates_db.json.
      </p>
    </>
  );
}

export default function Materials() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Materials</h1>
        <p className={`text-sm ${SUB}`}>
          The material values the designs use. To choose the grade every page starts from, see <Link to="/settings" className={LINK}>Settings</Link>.
        </p>
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Concrete (EN 1992-1-1 Table 3.1)</h2>
        <div className="mt-3">
          <Table mono={[1, 2, 3, 4, 5]}
            head={["Grade", "fck (MPa)", "fcd (MPa)", "fctm (MPa)", "fctk,0.05 (MPa)", "Ecm (GPa)", "Offered on"]}
            rows={Object.entries(CONCRETE_ON).map(([g, on]) => {
              const fck = Number(g.slice(1, 3));
              return [g, fck, (0.85 * fck / 1.5).toFixed(2), fctm(fck).toFixed(2), (0.7 * fctm(fck)).toFixed(2), ecm(fck).toFixed(1),
                <span key="on" className={`whitespace-normal text-xs ${SUB}`}>{on.length === ELS.length ? "All elements" : on.join(", ")}</span>];
            })} />
        </div>
        <p className={`mt-2 text-xs ${SUB}`}>
          fcd = α<sub>cc</sub> f<sub>ck</sub> / γ<sub>c</sub> with α<sub>cc</sub> = 0.85 and γ<sub>c</sub> = 1.5. Unit weight of reinforced concrete 25 kN/m³ unless entered on the page.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Reinforcing steel</h2>
          <div className="mt-3">
            <Table mono={[1, 2]} head={["Grade", "fyk (MPa)", "fyd (MPa)", "Offered on"]}
              rows={Object.entries(STEEL_ON).map(([g, on]) => {
                const fyk = Number(g.slice(1));
                return [g, fyk, (fyk / 1.15).toFixed(1), <span key="on" className={`whitespace-normal text-xs ${SUB}`}>{on.join(", ")}</span>];
              })} />
          </div>
          <p className={`mt-2 text-xs ${SUB}`}>fyd = fyk / γ<sub>s</sub>, γ<sub>s</sub> = 1.15. E<sub>s</sub> = 200 GPa. The staircase takes fyk as a number, so any value can be entered there.</p>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Bar sizes</h2>
          <div className="mt-3">
            <Table mono={[0, 1, 2, 3]} head={["Bar", "Area (mm²)", "Mass (kg/m)", "12 m bar (kg)"]}
              rows={BARS.map(([d, m]) => [`Y${d}`, (Math.PI * d * d / 4).toFixed(1), m.toFixed(3), (12 * m).toFixed(2)])} />
          </div>
          <p className={`mt-2 text-xs ${SUB}`}>Mass per metre as used in the bar schedules (7850 kg/m³).</p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Minimum cover for durability, c<sub>min,dur</sub> (mm)</h2>
          <div className="mt-3">
            <Table mono={[1, 2]} head={["Exposure", "Slabs", "Continuous beam"]}
              rows={COVER.map(([x, s, b]) => [x, s ?? "—", b])} />
          </div>
          <p className={`mt-2 text-xs ${SUB}`}>
            Slabs: the table used by the continuous slab and by the two-way slab when no cover is entered (at or above EC2 Table 4.4N, S4).
            Continuous beam: EC2 Table 4.4N, class S4; +10 mm for a 100-year working life. Nominal cover = c<sub>min</sub> + Δc<sub>dev</sub> (5 mm).
            Other elements use the cover you enter and do not check it against the exposure class.
          </p>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className={TITLE}>Fire resistance, one-way slabs (EN 1992-1-2 Table 5.8)</h2>
          <div className="mt-3">
            <Table mono={[1, 2]} head={["REI (min)", "Min. thickness hs (mm)", "Min. axis distance a (mm)"]}
              rows={FIRE.map(([r, h, a]) => [`REI ${r}`, h, a])} />
          </div>
          <p className={`mt-2 text-xs ${SUB}`}>Checked by the continuous slab only, with a = c<sub>nom</sub> + φ/2.</p>
        </section>
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Cost rates</h2>
        <Rates />
      </section>
    </div>
  );
}
