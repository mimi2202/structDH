// src/components/results/SpanBMD.jsx
// Bending moment diagram of one span under uniform load, drawn the same way
// on every results page: on the tension side (sagging below the axis, hogging
// above), sagging filled blue and hogging red (diagramTheme.js).
//
//   MA, MB  hogging moment magnitude at the left / right end (0 = pinned or free)
//   Mpos    sagging moment at midspan
//   cantilever: free at the left, fixed at the right (M = -MB x^2)
// The curve is the parabola through -MA, +Mpos at midspan and -MB.
import React from "react";
import { DIAGRAM } from "./diagramTheme";

const fmt = (v) => (Number.isFinite(+v) ? (+v).toFixed(2) : "-");

export default function SpanBMD({ MA = 0, MB = 0, Mpos = 0, cantilever = false, leftLabel = "", rightLabel = "", caption = "", unit = "kNm/m" }) {
  const M = cantilever
    ? (xi) => -MB * xi * xi
    : (xi) => -MA * (1 - xi) - MB * xi + 4 * (Mpos + (MA + MB) / 2) * xi * (1 - xi);
  const x0 = 40, x1 = 420, base = 84;
  const pts = Array.from({ length: 81 }, (_, i) => i / 80);
  const peak = Math.max(1e-6, ...pts.map((xi) => Math.abs(M(xi))));
  const sc = 60 / peak;
  const X = (xi) => x0 + (x1 - x0) * xi, Y = (m) => base + m * sc;   // sagging (+) drawn below
  const part = (fn) => `M${X(0)},${base} ` + pts.map((xi) => `L${X(xi).toFixed(1)},${Y(fn(M(xi))).toFixed(1)}`).join(" ") + ` L${X(1)},${base} Z`;
  const { sagging: SAG, hogging: HOG, fillOpacity: OP } = DIAGRAM;
  const endTag = (xi, m, anchor) => (
    <text x={X(xi) + (anchor === "start" ? 6 : -6)} y={m > 0 ? Y(-m) - 6 : base - 6} fontSize="10" fontWeight="600"
      textAnchor={anchor} fill={m > 0 ? HOG : "currentColor"}>{m > 0 ? `−${fmt(m)}` : "0"}</text>
  );
  const MA_ = cantilever ? 0 : MA;
  return (
    <div className="text-[#475569] dark:text-[#94a3b8]">
      <svg viewBox="0 0 460 190" className="w-full">
        <path d={part((m) => Math.max(m, 0))} fill={SAG} fillOpacity={OP} stroke={SAG} strokeWidth="1.6" />
        <path d={part((m) => Math.min(m, 0))} fill={HOG} fillOpacity={OP} stroke={HOG} strokeWidth="1.6" />
        <line x1={x0} y1={base} x2={x1} y2={base} stroke="currentColor" strokeWidth="1" />
        {!cantilever && Mpos > 0 && (
          <text x={X(0.5)} y={Y(M(0.5)) + 15} fontSize="10" fontWeight="700" textAnchor="middle" fill={SAG}>+{fmt(Mpos)}</text>
        )}
        {endTag(0, MA_, "start")}
        {endTag(1, MB, "end")}
        <text x={x0} y={170} fontSize="9" textAnchor="start" fill="currentColor">{leftLabel}</text>
        <text x={x1} y={170} fontSize="9" textAnchor="end" fill="currentColor">{rightLabel}</text>
        <text x={(x0 + x1) / 2} y={184} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.8">
          {caption ? `${caption} · ` : ""}{unit}, sagging (+) below, hogging (−) above
        </text>
      </svg>
    </div>
  );
}
