// src/components/results/BeamDetailDrawing.jsx
// Reinforcement drawing for a single-span beam from the backend detailing
// (det.drawing, det.schedule): an elevation with the supports, main and top
// bars (bent ends where the anchorage needs them), the links at their spacing
// and the bar callouts, and section A-A at mid-span (to scale) with the link,
// bars, cover and dimensions. Same conventions as FootingDetailDrawing: bars
// red, dimensions grey, lengths in mm.
import React from "react";

const RED = "#c0392b";
const DIM = "#64748b";
const WRAP = "text-[#334155] dark:text-[#cbd5e1]";
const txt = { fontSize: 10, fill: "currentColor" };
const dimTxt = { fontSize: 9.5, fill: DIM };
const outline = { fill: "none", stroke: "currentColor", strokeWidth: 1.2 };
const bar = { fill: "none", stroke: RED, strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" };

function HDim({ x1, x2, y, label }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM} strokeWidth="0.8" />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={DIM} strokeWidth="0.8" />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={DIM} strokeWidth="0.8" />
      <text x={(x1 + x2) / 2} y={y + 12} textAnchor="middle" {...dimTxt}>{label}</text>
    </g>
  );
}
function VDim({ x, y1, y2, label }) {
  const ym = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM} strokeWidth="0.8" />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke={DIM} strokeWidth="0.8" />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke={DIM} strokeWidth="0.8" />
      <text x={x - 6} y={ym} textAnchor="middle" transform={`rotate(-90 ${x - 6} ${ym})`} {...dimTxt}>{label}</text>
    </g>
  );
}
function Leader({ x1, y1, x2, y2, label, anchor = "start" }) {
  return (
    <g>
      <circle cx={x1} cy={y1} r="2" fill={RED} />
      <polyline points={`${x1},${y1} ${x2},${y2} ${x2 + (anchor === "end" ? -14 : 14)},${y2}`} fill="none" stroke={DIM} strokeWidth="0.8" />
      <text x={x2 + (anchor === "end" ? -17 : 17)} y={y2 + 3.5} textAnchor={anchor} {...txt} fontWeight="600">{label}</text>
    </g>
  );
}
function Hatch({ x, y, w, h, id }) {
  return (
    <g>
      <defs>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={DIM} strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} stroke={DIM} strokeWidth="0.8" />
    </g>
  );
}

function Elevation({ det }) {
  const g = det.drawing;
  const main = det.schedule.find((r) => r.mark === "01");
  const top = det.schedule.find((r) => r.mark === "02");
  const links = det.schedule.find((r) => r.mark === "03");
  // horizontal to scale; depth exaggerated so the bars can be read (noted)
  const W = 640;
  const sx = W / g.overall_mm;
  const Hd = Math.min(150, Math.max(70, g.h_mm * sx * 3));
  const sy = Hd / g.h_mm;
  const x0 = 70, y0 = 60;
  const X = (mm) => x0 + mm * sx;
  const Y = (mm) => y0 + mm * sy;                  // mm from the top of the beam
  const c = g.cover_mm, lp = g.links.phi;
  const yTop = Y(c + lp + g.top.phi / 2);
  const yBot = Y(g.h_mm - c - lp - g.main.phi / 2);
  const yMain = g.main.position === "top" ? yTop : yBot;
  const yOther = g.main.position === "top" ? yBot : yTop;
  const a = g.support_width_mm;
  const supports = g.cantilever ? [{ x: 0 }] : [{ x: 0 }, { x: g.overall_mm - a }];
  const legPx = (g.main.leg_mm || 0) * sy;
  const xs = X(c), xe = X(g.overall_mm - c);
  const mainPath = g.main.leg_mm > 0 && g.main.position === "bottom"
    ? `${xs},${yMain - legPx} ${xs},${yMain} ${xe},${yMain} ${xe},${yMain - legPx}`
    : `${xs},${yMain} ${xe},${yMain}`;
  // links: every one when there are few, else every n-th (all drawn ticks are true positions)
  const firstLink = (g.cantilever ? a : a) + g.links.start_mm;
  const step = g.links.n > 45 ? Math.ceil(g.links.n / 45) : 1;
  const linkXs = [];
  for (let i = 0; i < g.links.n; i += step) linkXs.push(X(firstLink + i * g.links.spacing_mm));
  const midX = X(g.cantilever ? a + g.clear_mm / 2 : g.overall_mm / 2);
  const svgH = y0 + Hd + 132;

  return (
    <svg viewBox={`0 0 ${x0 + W + 90} ${svgH}`} className={`w-full ${WRAP}`} role="img" aria-label="Beam elevation">
      <text x={x0} y={18} {...txt} fontWeight="700">ELEVATION</text>
      {/* beam outline */}
      <rect x={X(0)} y={Y(0)} width={g.overall_mm * sx} height={Hd} {...outline} />
      {/* supports */}
      {supports.map((s, i) => <Hatch key={i} id={`sup${i}`} x={X(s.x)} y={Y(g.h_mm)} w={a * sx} h={22} />)}
      {g.cantilever && <Hatch id="supwall" x={X(0)} y={Y(0) - 26} w={a * sx} h={26} />}
      {/* links */}
      {linkXs.map((x, i) => <line key={i} x1={x} y1={Y(c)} x2={x} y2={Y(g.h_mm - c)} stroke={RED} strokeWidth="1" opacity="0.8" />)}
      {/* bars */}
      <polyline points={mainPath} {...bar} />
      <line x1={xs} y1={yOther} x2={xe} y2={yOther} {...bar} strokeDasharray={g.main.position === "top" ? "" : "7 4"} />
      {/* section mark A-A */}
      <line x1={midX} y1={Y(0) - 14} x2={midX} y2={Y(g.h_mm) + 14} stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 3 2 3" />
      <text x={midX + 4} y={Y(0) - 16} {...txt} fontWeight="700">A</text>
      <text x={midX + 4} y={Y(g.h_mm) + 24} {...txt} fontWeight="700">A</text>
      {/* callouts */}
      <Leader x1={X(g.overall_mm * 0.3)} y1={yMain} x2={X(g.overall_mm * 0.3) - 26} y2={g.main.position === "top" ? Y(0) - 30 : Y(g.h_mm) + 44}
        label={`${main.callout} (${g.main.position === "top" ? "T" : "B"})`} anchor="end" />
      <Leader x1={X(g.overall_mm * 0.7)} y1={yOther} x2={X(g.overall_mm * 0.7) + 20} y2={g.main.position === "top" ? Y(g.h_mm) + 44 : Y(0) - 30}
        label={`${top.callout} (${g.main.position === "top" ? "B" : "T"})`} />
      <Leader x1={linkXs[Math.floor(linkXs.length / 2)] || midX} y1={Y(g.h_mm / 2)} x2={(linkXs[Math.floor(linkXs.length / 2)] || midX) + 30} y2={Y(g.h_mm / 2) - 4}
        label={links.callout} />
      {/* dimensions */}
      <HDim x1={X(0)} x2={X(g.overall_mm)} y={Y(g.h_mm) + 62} label={`${Math.round(g.overall_mm)} overall`} />
      {!g.cantilever && <HDim x1={X(a / 2)} x2={X(g.overall_mm - a / 2)} y={Y(g.h_mm) + 84} label={`${Math.round(g.span_mm)} span (c/c of supports)`} />}
      {g.cantilever && <HDim x1={X(a / 2)} x2={X(g.overall_mm)} y={Y(g.h_mm) + 84} label={`${Math.round(g.span_mm)} span`} />}
      <VDim x={X(g.overall_mm) + 22} y1={Y(0)} y2={Y(g.h_mm)} label={`${g.h_mm}`} />
      {g.main.leg_mm > 0 && g.main.position === "bottom" && (
        <text x={xs + 4} y={yMain - legPx - 4} {...dimTxt}>leg {g.main.leg_mm}</text>
      )}
      <text x={x0} y={svgH - 6} {...dimTxt}>
        Links {g.links.spacing_mm} c/c from {g.links.start_mm} mm inside each support face{step > 1 ? ` (every ${step}th drawn)` : ""}. {g.main.position === "top" ? "Top bars solid = main tension (cantilever)." : "Bottom bars solid; top bars dashed."} Lengths to scale; depth exaggerated ×{(sy / sx).toFixed(1)}.
      </text>
    </svg>
  );
}

function Section({ det }) {
  const g = det.drawing;
  const s = Math.min(200 / g.b_mm, 260 / g.h_mm);
  const x0 = 70, y0 = 30;
  const X = (mm) => x0 + mm * s, Y = (mm) => y0 + mm * s;
  const c = g.cover_mm, lp = g.links.phi;
  const barsAt = (n, phi, yMm) => {
    const inner0 = c + lp + phi / 2, inner1 = g.b_mm - c - lp - phi / 2;
    return Array.from({ length: n }, (_, i) => ({ x: n === 1 ? (inner0 + inner1) / 2 : inner0 + (i * (inner1 - inner0)) / (n - 1), y: yMm, r: phi / 2 }));
  };
  const topY = c + lp + g.top.phi / 2, botY = g.h_mm - c - lp - g.main.phi / 2;
  const mainBars = barsAt(g.main.n, g.main.phi, g.main.position === "top" ? c + lp + g.main.phi / 2 : botY);
  const otherBars = barsAt(g.top.n, g.top.phi, g.main.position === "top" ? g.h_mm - c - lp - g.top.phi / 2 : topY);
  const main = det.schedule.find((r) => r.mark === "01");
  const top = det.schedule.find((r) => r.mark === "02");
  const links = det.schedule.find((r) => r.mark === "03");
  const W = g.b_mm * s, H = g.h_mm * s;
  const right = X(g.b_mm);

  return (
    <svg viewBox={`0 0 ${x0 + W + 190} ${y0 + H + 60}`} className={`w-full max-w-[460px] ${WRAP}`} role="img" aria-label="Section A-A">
      <text x={x0} y={16} {...txt} fontWeight="700">SECTION A-A</text>
      <rect x={X(0)} y={Y(0)} width={W} height={H} {...outline} />
      <rect x={X(c + lp / 2)} y={Y(c + lp / 2)} width={(g.b_mm - 2 * c - lp) * s} height={(g.h_mm - 2 * c - lp) * s} rx={Math.max(3, 2 * lp * s)}
        fill="none" stroke={RED} strokeWidth={Math.max(1.5, lp * s)} />
      {mainBars.map((b, i) => <circle key={`m${i}`} cx={X(b.x)} cy={Y(b.y)} r={Math.max(3, b.r * s)} fill={RED} />)}
      {otherBars.map((b, i) => <circle key={`o${i}`} cx={X(b.x)} cy={Y(b.y)} r={Math.max(2.5, b.r * s)} fill="none" stroke={RED} strokeWidth="2" />)}
      <Leader x1={X(mainBars[mainBars.length - 1].x)} y1={Y(mainBars[0].y)} x2={right + 22} y2={Y(mainBars[0].y)} label={main.callout} />
      <Leader x1={X(otherBars[otherBars.length - 1].x)} y1={Y(otherBars[0].y)} x2={right + 22} y2={Y(otherBars[0].y)} label={top.callout} />
      <Leader x1={X(g.b_mm - c - lp / 2)} y1={Y(g.h_mm / 2)} x2={right + 22} y2={Y(g.h_mm / 2)} label={links.callout} />
      <HDim x1={X(0)} x2={X(g.b_mm)} y={Y(g.h_mm) + 14} label={`${g.b_mm}`} />
      <VDim x={X(0) - 18} y1={Y(0)} y2={Y(g.h_mm)} label={`${g.h_mm}`} />
      <text x={X(0)} y={Y(g.h_mm) + 44} {...dimTxt}>nominal cover to links {c} mm · to scale</text>
    </svg>
  );
}

export default function BeamDetailDrawing({ det }) {
  return (
    <div className="space-y-4">
      <Elevation det={det} />
      <div className="flex justify-center"><Section det={det} /></div>
    </div>
  );
}
