// Detailing tab body shared by the continuous beam, slabs and column (the
// footing, beam and staircase pages have their own): warnings, the drawing,
// anchorage at simple supports, bar callouts, the bending / quantity schedule
// with shape sketches, and the report's "Detailing and Bar Schedule" trace.
// det comes from backend/engine/member_detailing.py.
import React from "react";
import BarShape from "./BarShape";
import ReportSections from "../ReportSections";

const CARD = "rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937]";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const HEAD = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";

function Card({ title, children }) {
  return (
    <section className={CARD}>
      <header className="border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5"><h3 className={`doc-h ${HEAD}`}>{title}</h3></header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155]">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] uppercase tracking-wide text-[#94a3b8]">
            {head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[#f1f5f9] dark:border-[#263244]">
              {row.map((c, j) => <td key={j} className={`px-3 py-2 font-mono ${j === 0 ? `font-medium ${MAIN}` : SUB}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Badge = ({ ok }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ok ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{ok ? "OK" : "NOT OK"}</span>
);

export default function DetailingSchedule({ det, report, drawing }) {
  if (!det) return <Card title="Detailing & Schedule"><p className={`text-sm ${SUB}`}>Run the design again to get the detailing and bar schedule.</p></Card>;
  if (det.not_available) return <Card title="Detailing & Schedule"><p className={`text-sm ${SUB}`}>{det.not_available}</p></Card>;
  const dias = det.summary.by_diameter.map((e) => e.type_size);
  const anch = (det.anchorage || []).filter((a) => a.straight_ok !== undefined);
  return (
    <div className="space-y-5" data-detailing>
      {det.warnings?.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {det.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {drawing && <Card title="Reinforcement Drawing">{drawing}</Card>}

      {anch.length > 0 && (
        <Card title="Anchorage at Simple Supports (EC2 9.2.1.4)">
          <Table
            head={["Bars", "F_E", "σ_sd", "l_b,rqd", "l_b,min", "Straight l_bd", "In support", "Leg", "Status"]}
            rows={anch.map((a) => [
              a.label, `${a.F_E_kN.toFixed(2)} kN`, `${a.sigma_s_MPa.toFixed(1)} MPa`, `${a.lb_rqd_mm.toFixed(0)} mm`, `${a.lb_min_mm.toFixed(0)} mm`,
              `${a.lbd_straight_mm.toFixed(0)} mm`, `${a.available_mm.toFixed(0)} mm`, a.straight_ok ? "straight" : `${a.leg_mm} mm`, <Badge key="b" ok={a.status === "OK"} />,
            ])}
          />
          <p className={`mt-2 text-xs ${SUB}`}>F_E = V_Ed/2 with cot θ = 1; bars are bent up when a straight bar does not fit in the support (leg ≥ 5φ).</p>
        </Card>
      )}

      <Card title="Bar Callouts (Drawing)">
        <div className="divide-y divide-[#f1f5f9] dark:divide-[#263244]">
          {det.schedule.map((r) => (
            <div key={r.mark} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className={`text-[12px] ${SUB}`}>{r.description}</span>
              <span className={`font-mono text-[12px] font-semibold ${MAIN}`}>{r.callout}</span>
            </div>
          ))}
        </div>
        <p className={`mt-2 text-xs ${SUB}`}>number - size - bar mark - spacing (mm).</p>
      </Card>

      <Card title="Reinforcement Bending / Quantity Schedule">
        <Table
          head={["S/No", "Mark", "Location", "Size", "No.", "Members", "Shape (mm)", "Code", "Length (m)", "Total (m)", ...dias.map((d) => `${d} (kg)`)]}
          rows={[
            ...det.schedule.map((b, i) => [
              i + 1, b.mark, <span key="loc" className="inline-block w-40 whitespace-normal font-sans text-xs leading-snug">{b.description}</span>, b.type_size, b.n_bars, b.n_members,
              <BarShape key={b.mark} code={b.shape_code} dims={b.dims_mm} />, b.shape_code, b.length_m.toFixed(3), b.total_length_m.toFixed(2),
              ...dias.map((d) => (d === b.type_size ? b.mass_kg.toFixed(2) : "")),
            ]),
            ["", "", "", "", "", "", "", "", "", "TOTAL (kg)", ...det.summary.by_diameter.map((e) => e.mass_kg.toFixed(2))],
            ["", "", "", "", "", "", "", "", "", "TOTAL (tonnes)", ...det.summary.by_diameter.map((e) => e.tonnes.toFixed(4))],
            ["", "", "", "", "", "", "", "", "", "Pieces (12 m)", ...det.summary.by_diameter.map((e) => `${e.pieces_12m} pcs`)],
          ]}
        />
        <p className={`mt-2 text-xs ${SUB}`}>Cut length = sum of the shape dimensions (BS 8666 bend deductions not applied). Total {det.summary.total_mass_kg} kg.</p>
      </Card>
      <ReportSections report={report} match={/Detailing and Bar Schedule/i} heading="Detailing and bar schedule — calculation" />
    </div>
  );
}
