// src/components/results/FootingDetailDrawing.jsx
// Reinforcement drawing for a pad or combined footing, drawn from the
// backend's detailing data (det.drawing, det.layers, det.starters, det.links):
// a plan with one bar of each layer, its range and callout, and a section
// along L with the mats, starter bars and their links. Bottom bars are solid,
// top bars dashed. Lengths in mm, to scale unless the note says otherwise.
import React from "react";

const RED = "#c0392b";
const DIM = "#64748b";
const WRAP = "text-[#334155] dark:text-[#cbd5e1]";
const txt = { fontSize: 10, fill: "currentColor" };
const dimTxt = { fontSize: 9.5, fill: DIM };
const outline = { fill: "none", stroke: "currentColor", strokeWidth: 1.2 };
const bar = { fill: "none", stroke: RED, strokeWidth: 2.2, strokeLinejoin: "round" };

const isTop = (k) => k.startsWith("top");
const side = (l, combined) => (combined ? (isTop(l.key) ? " (T)" : " (B)") : "");

function Arrow({ x, y, dir }) {
  // dir: "up" | "down" | "left" | "right"
  const a = 4;
  const p = {
    up: `${x},${y} ${x - a},${y + 2 * a} ${x + a},${y + 2 * a}`,
    down: `${x},${y} ${x - a},${y - 2 * a} ${x + a},${y - 2 * a}`,
    left: `${x},${y} ${x + 2 * a},${y - a} ${x + 2 * a},${y + a}`,
    right: `${x},${y} ${x - 2 * a},${y - a} ${x - 2 * a},${y + a}`,
  }[dir];
  return <polygon points={p} fill={DIM} />;
}

/* dimension line with end ticks and a centred value */
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
      <text x={x - 5} y={ym} textAnchor="middle" transform={`rotate(-90 ${x - 5} ${ym})`} {...dimTxt}>{label}</text>
    </g>
  );
}

function Plan({ det }) {
  const g = det.drawing, combined = det.element === "combined";
  const sx = 300 / g.L_mm;
  const sy = Math.max(sx, 120 / g.B_mm);          // a narrow strip is stretched across B so the bars can be read
  const W = g.L_mm * sx, H = g.B_mm * sy;
  const alongL = det.layers.filter((l) => l.key.endsWith("_L"));
  const alongB = det.layers.filter((l) => l.key.endsWith("_B"));
  const ox = 34, oy = 30 + 14 * alongL.length;
  const c = g.cover_mm;
  const X = (mm) => ox + mm * sx, Y = (mm) => oy + mm * sy;
  const ped = g.pedestal;

  return (
    <svg viewBox={`0 0 ${ox + W + 150} ${oy + H + 34}`} className={`w-full max-w-[520px] ${WRAP}`} role="img" aria-label="Footing plan with reinforcement">
      <rect x={ox} y={oy} width={W} height={H} {...outline} />
      {g.columns.map((col, i) => (
        <g key={i}>
          {ped && <rect x={X(col.x_mm - ped.x_mm / 2)} y={Y(col.y_mm - ped.y_mm / 2)} width={ped.x_mm * sx} height={ped.y_mm * sy} {...outline} strokeDasharray="4 3" />}
          {col.shape === "circular"
            ? <ellipse cx={X(col.x_mm)} cy={Y(col.y_mm)} rx={col.cx_mm * sx / 2} ry={col.cy_mm * sy / 2} {...outline} fill="currentColor" fillOpacity="0.12" />
            : <rect x={X(col.x_mm - col.cx_mm / 2)} y={Y(col.y_mm - col.cy_mm / 2)} width={col.cx_mm * sx} height={col.cy_mm * sy} {...outline} fill="currentColor" fillOpacity="0.12" />}
        </g>
      ))}

      {/* bars along L: one bar drawn, its range across B, callout above */}
      {alongL.map((l, i) => {
        const y = oy + H * (0.68 - 0.36 * i), xr = ox + W * (0.2 + 0.17 * i), top = oy - 8 - 14 * i;
        return (
          <g key={l.key}>
            <polyline points={`${X(c)},${y - 10} ${X(c)},${y} ${X(g.L_mm - c)},${y} ${X(g.L_mm - c)},${y - 10}`} {...bar} strokeDasharray={isTop(l.key) ? "6 4" : undefined} />
            <line x1={xr} y1={Y(c)} x2={xr} y2={Y(g.B_mm - c)} stroke={DIM} strokeWidth="0.8" />
            <line x1={xr} y1={Y(c)} x2={xr} y2={top} stroke={DIM} strokeWidth="0.8" strokeDasharray="2 2" />
            <Arrow x={xr} y={Y(c)} dir="up" /><Arrow x={xr} y={Y(g.B_mm - c)} dir="down" />
            <circle cx={xr} cy={y} r="3" fill="currentColor" />
            <text x={xr + 4} y={top + 3} {...txt} fontWeight="600">{l.callout}{side(l, combined)}</text>
          </g>
        );
      })}
      {/* bars along B: one bar drawn, its range along L, callout at the right */}
      {alongB.map((l, j) => {
        const x = ox + W * (0.62 + 0.15 * j), yr = oy + H * (0.16 + 0.68 * j);
        return (
          <g key={l.key}>
            <polyline points={`${x + 10},${Y(c)} ${x},${Y(c)} ${x},${Y(g.B_mm - c)} ${x + 10},${Y(g.B_mm - c)}`} {...bar} strokeDasharray={isTop(l.key) ? "6 4" : undefined} />
            <line x1={X(c)} y1={yr} x2={X(g.L_mm - c)} y2={yr} stroke={DIM} strokeWidth="0.8" />
            <line x1={X(g.L_mm - c)} y1={yr} x2={ox + W + 10} y2={yr} stroke={DIM} strokeWidth="0.8" strokeDasharray="2 2" />
            <Arrow x={X(c)} y={yr} dir="left" /><Arrow x={X(g.L_mm - c)} y={yr} dir="right" />
            <circle cx={x} cy={yr} r="3" fill="currentColor" />
            <text x={ox + W + 13} y={yr + 3.5} {...txt} fontWeight="600">{l.callout}{side(l, combined)}</text>
          </g>
        );
      })}

      <HDim x1={ox} x2={ox + W} y={oy + H + 12} label={`L = ${Math.round(g.L_mm)}`} />
      <VDim x={ox - 12} y1={oy} y2={oy + H} label={`B = ${Math.round(g.B_mm)}`} />
      <text x={ox} y={12} {...txt} fontWeight="700">PLAN{sy > sx * 1.01 ? " (width B not to scale)" : ""}</text>
    </svg>
  );
}

function Section({ det }) {
  const g = det.drawing, st = det.starters, lk = det.links, combined = det.element === "combined";
  const c = g.cover_mm, ped = g.pedestal;
  const L = (k) => det.layers.find((l) => l.key === k);
  const bL = L("bottom_L"), bB = L("bottom_B"), tL = L("top_L"), tB = L("top_B");
  const proj = st ? st.projection_mm : Math.max(g.soil_above_mm, ped ? ped.h_mm : 0, 300);
  const s = Math.min(300 / g.L_mm, 250 / (g.h_mm + proj));
  const W = g.L_mm * s, H = g.h_mm * s;
  const ox = 46, top = 22 + proj * s, yb = top + H;
  const X = (mm) => ox + mm * s;
  const rightX = ox + W + 16;
  const cc = lk ? lk.column_cover_mm : 35;
  const stubW = (col) => (ped ? ped.x_mm : col.cx_mm);
  const matY = yb - c * s;                         // centre line of the bottom bars along L
  const dots = (layer, y) => Array.from({ length: Math.min(layer.n_bars, 80) }, (_, k) =>
    <circle key={k} cx={X(c + k * layer.spacing_mm)} cy={y} r="2.2" fill={RED} />);

  return (
    <svg viewBox={`0 0 ${rightX + 150} ${yb + 62}`} className={`w-full max-w-[520px] ${WRAP}`} role="img" aria-label="Footing section with reinforcement">
      <text x={ox} y={12} {...txt} fontWeight="700">SECTION ALONG L</text>

      {/* ground, blinding, concrete */}
      {g.soil_above_mm > 0 && <>
        <line x1={ox - 30} y1={top - g.soil_above_mm * s} x2={ox + W + 12} y2={top - g.soil_above_mm * s} stroke={DIM} strokeWidth="0.8" strokeDasharray="8 3 2 3" />
        <text x={ox - 30} y={top - g.soil_above_mm * s - 3} {...dimTxt}>GL</text>
      </>}
      <line x1={ox - 8} y1={yb + 2.5} x2={ox + W + 8} y2={yb + 2.5} stroke={DIM} strokeWidth="2" />
      <rect x={ox} y={top} width={W} height={H} {...outline} />
      {g.columns.map((col, i) => {
        const xc = X(col.x_mm), w = stubW(col) * s, colTop = top - proj * s;
        const xl = xc - (col.cx_mm / 2 - cc) * s, xr = xc + (col.cx_mm / 2 - cc) * s;   // starter bars, inside the column
        const lxl = xc - w / 2 + cc * s, lxr = xc + w / 2 - cc * s;                       // links, inside the stub / pedestal
        const foot = 300 * s, footY = matY - (bL.phi_mm + (bB ? bB.phi_mm : 0)) * s - 1;
        return (
          <g key={i}>
            {ped
              ? <polyline points={`${xc - w / 2},${top} ${xc - w / 2},${top - ped.h_mm * s} ${X(col.x_mm - col.cx_mm / 2)},${top - ped.h_mm * s} ${X(col.x_mm - col.cx_mm / 2)},${colTop} `} {...outline} />
              : <line x1={xc - w / 2} y1={top} x2={xc - w / 2} y2={colTop} stroke="currentColor" strokeWidth="1.2" />}
            {ped
              ? <polyline points={`${xc + w / 2},${top} ${xc + w / 2},${top - ped.h_mm * s} ${X(col.x_mm + col.cx_mm / 2)},${top - ped.h_mm * s} ${X(col.x_mm + col.cx_mm / 2)},${colTop} `} {...outline} />
              : <line x1={xc + w / 2} y1={top} x2={xc + w / 2} y2={colTop} stroke="currentColor" strokeWidth="1.2" />}
            {st && <>
              <polyline points={`${xl - foot},${footY} ${xl},${footY} ${xl},${colTop + 3}`} {...bar} strokeWidth="1.8" />
              <polyline points={`${xr + foot},${footY} ${xr},${footY} ${xr},${colTop + 3}`} {...bar} strokeWidth="1.8" />
            </>}
            {lk && Array.from({ length: lk.per_column }, (_, k) => {
              const y = top - (k * lk.spacing_mm + 50) * s;
              return y > colTop ? <line key={k} x1={lxl - 2} y1={y} x2={lxr + 2} y2={y} stroke={RED} strokeWidth="1.3" /> : null;
            })}
            {i === 0 && st && <VDim x={xc - w / 2 - 16} y1={colTop} y2={top} label={`${st.projection_mm}`} />}
          </g>
        );
      })}

      {/* bottom mat: bars along L as a U-bar, bars along B seen end-on */}
      <polyline points={`${X(c)},${matY - bL.leg_mm * s} ${X(c)},${matY} ${X(g.L_mm - c)},${matY} ${X(g.L_mm - c)},${matY - bL.leg_mm * s}`} {...bar} />
      {bB && dots(bB, matY - 5)}
      {/* top mat (combined): legs down */}
      {tL && <polyline points={`${X(c + 30)},${top + c * s + tL.leg_mm * s} ${X(c + 30)},${top + c * s} ${X(g.L_mm - c - 30)},${top + c * s} ${X(g.L_mm - c - 30)},${top + c * s + tL.leg_mm * s}`} {...bar} strokeDasharray="6 4" />}
      {tB && dots(tB, top + c * s + 5)}

      {/* callouts */}
      <line x1={X(g.L_mm * 0.08)} y1={matY} x2={X(g.L_mm * 0.08)} y2={yb + 12} stroke={DIM} strokeWidth="0.8" />
      <text x={X(g.L_mm * 0.08) - 6} y={yb + 22} {...txt} fontWeight="600">{bL.callout}{combined ? " (B)" : ""}</text>
      {bB && <>
        <line x1={X(c + Math.floor(bB.n_bars * 0.7) * bB.spacing_mm)} y1={matY - 5} x2={X(c + Math.floor(bB.n_bars * 0.7) * bB.spacing_mm)} y2={yb + 12} stroke={DIM} strokeWidth="0.8" />
        <text x={Math.min(X(c + Math.floor(bB.n_bars * 0.7) * bB.spacing_mm) - 6, ox + W - 60)} y={yb + 22} {...txt} fontWeight="600">{bB.callout}{combined ? " (B)" : ""}</text>
      </>}
      {tL && <>
        <line x1={X(g.L_mm - c - 30)} y1={top + c * s} x2={rightX + 12} y2={top + c * s} stroke={DIM} strokeWidth="0.8" strokeDasharray="2 2" />
        <text x={rightX + 15} y={top + c * s + 3} {...txt} fontWeight="600">{tL.callout} (T)</text>
      </>}
      {tB && <text x={rightX + 15} y={top + c * s + 16} {...txt} fontWeight="600">{tB.callout} (T)</text>}
      {st && (() => {
        const col = g.columns[g.columns.length - 1], x0 = X(col.x_mm) + stubW(col) * s / 2;
        const y1 = top - proj * s * 0.72, y2 = top - Math.min(lk ? lk.stub_mm * 0.5 : proj * 0.3, proj * 0.45) * s;
        return (
          <g>
            <line x1={x0 - cc * s} y1={y1} x2={x0 + 14} y2={y1} stroke={DIM} strokeWidth="0.8" strokeDasharray="2 2" />
            <text x={x0 + 17} y={y1 + 3} {...txt} fontWeight="600">{st.per_column}-Y{st.phi_mm}-{st.mark}</text>
            <text x={x0 + 17} y={y1 + 14} {...dimTxt}>starter bars, lap {st.lap_mm}</text>
            {lk && <>
              <line x1={x0 - cc * s} y1={y2} x2={x0 + 14} y2={y2} stroke={DIM} strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={x0 + 17} y={y2 + 3} {...txt} fontWeight="600">{lk.callout}</text>
              <text x={x0 + 17} y={y2 + 14} {...dimTxt}>links {lk.a_mm} × {lk.b_mm}</text>
            </>}
          </g>
        );
      })()}

      <VDim x={ox - 12} y1={top} y2={yb} label={`h = ${Math.round(g.h_mm)}`} />
      <HDim x1={ox} x2={ox + W} y={yb + 36} label={`L = ${Math.round(g.L_mm)}   (cover ${Math.round(c)})`} />
    </svg>
  );
}

export default function FootingDetailDrawing({ det }) {
  if (!det?.drawing || !det?.layers?.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
        <Plan det={det} />
        <Section det={det} />
      </div>
      <p className="mt-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
        Callouts: number - size - bar mark - spacing (mm). One bar of each layer is drawn in the plan with the range it is spread over.
        {det.element === "combined" ? " (B) bottom, solid; (T) top, dashed." : ""} Dimensions in mm.
      </p>
    </div>
  );
}
