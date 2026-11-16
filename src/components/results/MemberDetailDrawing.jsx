// src/components/results/MemberDetailDrawing.jsx
// Reinforcement drawings for engine/member_detailing.py (same conventions as
// FootingDetailDrawing / BeamDetailDrawing: bars red, dimensions grey, mm):
//   kind "elevation"  continuous beam / continuous slab: spans, supports,
//                     bottom and top bars with their extents and bends, links
//                     (beam) or distribution bars end-on (slab), callouts,
//                     span dimensions; beam: section at mid-span 1.
//   kind "panel"      one-/two-way slab plan: supports and continuous edges,
//                     bottom bars both ways, top bars along the edges.
//   kind "column"     storey stack with laps, link zones and floor levels,
//                     and the section of the bottom storey (cross-ties).
import React from "react";

const RED = "#c0392b";
const DIM = "#64748b";
const WRAP = "text-[#334155] dark:text-[#cbd5e1]";
const txt = { fontSize: 10, fill: "currentColor" };
const small = { fontSize: 9, fill: DIM };
const outline = { fill: "none", stroke: "currentColor", strokeWidth: 1.2 };
const bar = { fill: "none", stroke: RED, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" };

function HDim({ x1, x2, y, label }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM} strokeWidth="0.8" />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={DIM} strokeWidth="0.8" />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={DIM} strokeWidth="0.8" />
      <text x={(x1 + x2) / 2} y={y + 12} textAnchor="middle" {...small}>{label}</text>
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
      <text x={x - 6} y={ym} textAnchor="middle" transform={`rotate(-90 ${x - 6} ${ym})`} {...small}>{label}</text>
    </g>
  );
}
function Leader({ x1, y1, x2, y2, label, anchor = "start" }) {
  const dx = anchor === "end" ? -12 : 12;
  return (
    <g>
      <circle cx={x1} cy={y1} r="2" fill={RED} />
      <polyline points={`${x1},${y1} ${x2},${y2} ${x2 + dx},${y2}`} fill="none" stroke={DIM} strokeWidth="0.8" />
      <text x={x2 + dx + (anchor === "end" ? -3 : 3)} y={y2 + 3.5} textAnchor={anchor} {...txt} fontWeight="600">{label}</text>
    </g>
  );
}
function Hatch({ id, x, y, w, h }) {
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
const ticks = (x1, x2, s, cap = 40) => {
  const out = [];
  if (!(s > 0) || x2 < x1) return out;
  const n = Math.floor((x2 - x1) / s + 1e-9) + 1;
  const step = Math.max(1, Math.ceil(n / cap));
  for (let i = 0; i < n; i += step) out.push(x1 + i * s);
  return out;
};

/* ------------------------------------------------------------ elevation */
function Elevation({ g, uid }) {
  const slab = !!g.slab;
  const W = 760, x0 = 50, y0 = 70;
  const sx = W / g.overall_mm;
  const Hd = slab ? 46 : Math.min(130, Math.max(70, g.h_mm * sx * 3));
  const sy = Hd / g.h_mm;
  const X = (mm) => x0 + mm * sx;
  const Y = (mm) => y0 + mm * sy;
  const c = g.cover_mm;
  const yB = Y(g.h_mm - c - 8), yT = Y(c + 8);
  const a = g.support_width_mm;
  const tops = g.bars.filter((b) => b.layer === "top");
  const bots = g.bars.filter((b) => b.layer === "bottom");
  const H = y0 + Hd + 150;
  return (
    <svg viewBox={`0 0 ${x0 + W + 70} ${H}`} className={`w-full ${WRAP}`} role="img" aria-label={slab ? "Slab elevation" : "Beam elevation"}>
      <text x={x0} y={16} {...txt} fontWeight="700">ELEVATION</text>
      <rect x={X(0)} y={Y(0)} width={g.overall_mm * sx} height={Hd} {...outline} />
      {g.supports_x.map((xc, i) => <Hatch key={i} id={`${uid}s${i}`} x={X(xc - a / 2)} y={Y(g.h_mm)} w={a * sx} h={slab ? 30 : 20} />)}
      {/* links */}
      {(g.links || []).map((z, i) => ticks(z.x1, z.x2, z.spacing).map((xm, k) => (
        <line key={`${i}-${k}`} x1={X(xm)} y1={Y(c)} x2={X(xm)} y2={Y(g.h_mm - c)} stroke={RED} strokeWidth="0.9" opacity="0.75" />
      )))}
      {/* slab distribution bars, end-on */}
      {g.dist && ticks(c, g.overall_mm - c, g.dist.spacing, 70).map((xm, k) => <circle key={`db${k}`} cx={X(xm)} cy={yB - 4} r="1.8" fill={RED} />)}
      {g.dist && g.dist.top_ranges.flatMap(([r1, r2], i) => ticks(r1, r2, g.dist.spacing, 20).map((xm, k) => <circle key={`dt${i}-${k}`} cx={X(xm)} cy={yT + 4} r="1.8" fill={RED} />))}
      {/* bars */}
      {bots.map((b) => {
        const lp = (v) => v * sy;
        const pts = [
          ...(b.legL ? [`${X(b.x1)},${yB - lp(b.legL)}`] : []), `${X(b.x1)},${yB}`, `${X(b.x2)},${yB}`,
          ...(b.legR ? [`${X(b.x2)},${yB - lp(b.legR)}`] : []),
        ];
        return <polyline key={b.mark} points={pts.join(" ")} {...bar} />;
      })}
      {tops.map((b) => {
        const lp = (v) => v * sy;
        const y = b.dashed ? yT + 3 : yT;
        const pts = [
          ...(b.legL ? [`${X(b.x1)},${y + lp(b.legL)}`] : []), `${X(b.x1)},${y}`, `${X(b.x2)},${y}`,
          ...(b.legR ? [`${X(b.x2)},${y + lp(b.legR)}`] : []),
        ];
        return <polyline key={b.mark} points={pts.join(" ")} {...bar} strokeDasharray={b.dashed ? "6 3" : undefined} />;
      })}
      {/* callouts: bottom bars below, top bars above, staggered */}
      {bots.map((b, i) => {
        const xm = X((b.x1 + b.x2) / 2);
        return <Leader key={`lb${b.mark}`} x1={xm} y1={yB} x2={xm - 10} y2={Y(g.h_mm) + (slab ? 44 : 34) + (i % 2) * 14} label={b.label} anchor="end" />;
      })}
      {tops.map((b, i) => {
        const xm = X(b.x1 + (b.x2 - b.x1) * 0.35);
        const right = xm > x0 + W * 0.75;                 // near the right end: point left so the label stays on the drawing
        return <Leader key={`lt${b.mark}`} x1={xm} y1={b.dashed ? yT + 3 : yT} x2={right ? xm - 8 : xm + 8} y2={y0 - 16 - (i % 3) * 13} label={b.label} anchor={right ? "end" : "start"} />;
      })}
      {/* dimensions */}
      {g.spans_mm.map((L, j) => (
        <HDim key={j} x1={X(g.supports_x[j])} x2={X(g.supports_x[j + 1])} y={Y(g.h_mm) + (slab ? 88 : 76)} label={`${Math.round(L)}`} />
      ))}
      <HDim x1={X(0)} x2={X(g.overall_mm)} y={Y(g.h_mm) + (slab ? 112 : 100)} label={`${Math.round(g.overall_mm)} overall`} />
      <VDim x={X(g.overall_mm) + 18} y1={Y(0)} y2={Y(g.h_mm)} label={`${g.h_mm}`} />
      <text x={x0} y={H - 6} {...small}>
        {slab ? `Distribution bars Y${g.dist.phi} @ ${g.dist.spacing} shown end-on. ` : "Links at the spacing shown in the schedule; "}
        Lengths to scale; depth exaggerated ×{(sy / sx).toFixed(1)}. Hangers / laps dashed.
      </text>
    </svg>
  );
}

function BeamSection({ g }) {
  const b = g.b_mm, h = g.h_mm, c = g.cover_mm, lp = g.link_phi || 8;
  const s = Math.min(170 / b, 230 / h);
  const x0 = 60, y0 = 26;
  const X = (mm) => x0 + mm * s, Y = (mm) => y0 + mm * s;
  const row = (n, phi, y) => Array.from({ length: n }, (_, i) => {
    const a0 = c + lp + phi / 2, a1 = b - c - lp - phi / 2;
    return { x: n === 1 ? (a0 + a1) / 2 : a0 + (i * (a1 - a0)) / (n - 1), y, r: phi / 2 };
  });
  const bot = row(g.section.bottom.n, g.section.bottom.phi, h - c - lp - g.section.bottom.phi / 2);
  const top = row(g.section.top.n, g.section.top.phi, c + lp + g.section.top.phi / 2);
  return (
    <svg viewBox={`0 0 ${x0 + b * s + 60} ${y0 + h * s + 40}`} className={`w-full max-w-[300px] ${WRAP}`} role="img" aria-label="Section at mid-span">
      <text x={x0} y={14} {...txt} fontWeight="700">SECTION, MID-SPAN 1</text>
      <rect x={X(0)} y={Y(0)} width={b * s} height={h * s} {...outline} />
      <rect x={X(c + lp / 2)} y={Y(c + lp / 2)} width={(b - 2 * c - lp) * s} height={(h - 2 * c - lp) * s} rx="4" fill="none" stroke={RED} strokeWidth="1.6" />
      {bot.map((p, i) => <circle key={`b${i}`} cx={X(p.x)} cy={Y(p.y)} r={Math.max(3, p.r * s)} fill={RED} />)}
      {top.map((p, i) => <circle key={`t${i}`} cx={X(p.x)} cy={Y(p.y)} r={Math.max(2.5, p.r * s)} fill="none" stroke={RED} strokeWidth="1.6" />)}
      <HDim x1={X(0)} x2={X(b)} y={Y(h) + 12} label={`${b}`} />
      <VDim x={X(0) - 16} y1={Y(0)} y2={Y(h)} label={`${h}`} />
    </svg>
  );
}

/* ---------------------------------------------------------------- panel */
function Panel({ g, uid }) {
  const maxW = 440, maxH = 330;
  const s = Math.min(maxW / g.lx_mm, maxH / g.ly_mm);
  const groups = g.groups || [];
  // room outside the panel for top bars that run into the next panel
  const outX = Math.max(0, ...groups.filter((q) => q.layer === "top" && q.dir === "x" && q.fixed).map((q) => q.reach * s)) + g.support_width_mm * s / 2;
  const outY = Math.max(0, ...groups.filter((q) => q.layer === "top" && q.dir === "y" && q.fixed).map((q) => q.reach * s)) + g.support_width_mm * s / 2;
  const x0 = 50 + outX, y0 = 34 + outY;
  const W = g.lx_mm * s, H = g.ly_mm * s;
  const X = (mm) => x0 + mm * s, Y = (mm) => y0 + mm * s;
  const a = g.support_width_mm * s;
  const cont = (n, k) => n === 2 || (n === 1 && k === 0);
  // edges: x start = left, x end = right; y start = top, y end = bottom
  const edges = [
    { side: "left", on: true, cont: cont(g.x_cont_ends, 0) },
    { side: "right", on: true, cont: cont(g.x_cont_ends, 1) },
    { side: "top", on: !g.one_way, cont: !g.one_way && cont(g.y_cont_ends, 0) },
    { side: "bottom", on: !g.one_way, cont: !g.one_way && cont(g.y_cont_ends, 1) },
  ];
  const band = (e, i) => {
    if (!e.on) return null;
    const r = { left: [X(0) - a / 2, Y(0), a, H], right: [X(g.lx_mm) - a / 2, Y(0), a, H], top: [X(0), Y(0) - a / 2, W, a], bottom: [X(0), Y(g.ly_mm) - a / 2, W, a] }[e.side];
    return e.cont ? <Hatch key={i} id={`${uid}e${i}`} x={r[0]} y={r[1]} w={r[2]} h={r[3]} />
      : <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill="none" stroke={DIM} strokeDasharray="4 3" strokeWidth="0.8" />;
  };
  const lines = [];
  const tags = [];
  const tag = (key, x, y, mark) => tags.push(
    <g key={key}>
      <rect x={x - 11} y={y - 8} width="22" height="14" rx="3" fill="white" stroke={RED} strokeWidth="1" />
      <text x={x} y={y + 3} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={RED}>{mark}</text>
    </g>,
  );
  groups.forEach((gr, gi) => {
    if (gr.layer === "bottom" && gr.dir === "x") {
      [0.3, 0.5, 0.7].forEach((f, k) => lines.push(<line key={`bx${gi}${k}`} x1={X(0) - a / 2 + 2} y1={Y(g.ly_mm * f)} x2={X(g.lx_mm) + a / 2 - 2} y2={Y(g.ly_mm * f)} {...bar} />));
      tag(`tbx${gi}`, X(g.lx_mm * 0.62), Y(g.ly_mm * 0.5), gr.mark);
    } else if (gr.layer === "bottom" && gr.dir === "y") {
      [0.35, 0.5, 0.65].forEach((f, k) => lines.push(<line key={`by${gi}${k}`} x1={X(g.lx_mm * f)} y1={Y(0) + (g.one_way ? 2 : -a / 2 + 2)} x2={X(g.lx_mm * f)} y2={Y(g.ly_mm) - (g.one_way ? 2 : -a / 2 + 2)} {...bar} />));
      tag(`tby${gi}`, X(g.lx_mm * 0.5), Y(g.ly_mm * 0.3), gr.mark);
    } else if (gr.layer === "top") {
      const reach = gr.reach * s;
      const isX = gr.dir === "x";
      const start = gr.edge === "start";
      [0.12, 0.88].forEach((f, k) => {
        if (isX) {
          const yy = Y(g.ly_mm * f);
          const x1 = start ? X(0) - a / 2 - (gr.fixed ? reach : 0) : X(g.lx_mm) - reach;
          const x2 = start ? X(0) + reach : X(g.lx_mm) + a / 2 + (gr.fixed ? reach : 0);
          lines.push(<line key={`t${gi}${k}`} x1={x1} y1={yy} x2={x2} y2={yy} {...bar} strokeDasharray="6 3" />);
        } else {
          const xx = X(g.lx_mm * f);
          const y1 = start ? Y(0) - a / 2 - (gr.fixed ? reach : 0) : Y(g.ly_mm) - reach;
          const y2 = start ? Y(0) + reach : Y(g.ly_mm) + a / 2 + (gr.fixed ? reach : 0);
          lines.push(<line key={`t${gi}${k}`} x1={xx} y1={y1} x2={xx} y2={y2} {...bar} strokeDasharray="6 3" />);
        }
      });
      // one corner each: x start top-left, y start top-right, x end bottom-right, y end bottom-left
      const tx = isX ? (start ? X(0) + reach * 0.55 : X(g.lx_mm) - reach * 0.55) : (start ? X(g.lx_mm * 0.88) + 16 : X(g.lx_mm * 0.12) + 16);
      const ty = isX ? (start ? Y(g.ly_mm * 0.12) - 12 : Y(g.ly_mm * 0.88) - 12) : (start ? Y(0) + reach * 0.55 : Y(g.ly_mm) - reach * 0.55);
      tag(`tt${gi}`, tx, ty, gr.mark);
    }
  });
  const legendX = x0 + W + outX + 24;
  const svgW = legendX + 300;
  const svgH = Math.max(y0 + H + outY + 46, 60 + groups.length * 30);
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className={`w-full ${WRAP}`} role="img" aria-label="Slab plan">
      <text x={50} y={16} {...txt} fontWeight="700">PLAN</text>
      {edges.map(band)}
      <rect x={X(0)} y={Y(0)} width={W} height={H} {...outline} />
      {lines}
      {tags}
      <HDim x1={X(0)} x2={X(g.lx_mm)} y={Y(g.ly_mm) + (g.one_way ? 18 : a / 2 + 14)} label={`lx = ${Math.round(g.lx_mm)}`} />
      <VDim x={X(0) - a / 2 - 14} y1={Y(0)} y2={Y(g.ly_mm)} label={g.one_way ? `width ${Math.round(g.ly_mm)}` : `ly = ${Math.round(g.ly_mm)}`} />
      {/* legend: mark -> callout */}
      <text x={legendX} y={y0} {...txt} fontWeight="700">BARS</text>
      {groups.map((gr, i) => (
        <g key={`lg${i}`}>
          <rect x={legendX} y={y0 + 12 + i * 30} width="22" height="14" rx="3" fill="white" stroke={RED} strokeWidth="1" />
          <text x={legendX + 11} y={y0 + 23 + i * 30} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={RED}>{gr.mark}</text>
          <text x={legendX + 30} y={y0 + 23 + i * 30} {...txt} fontWeight="600">{gr.label}</text>
          <text x={legendX + 30} y={y0 + 35 + i * 30} {...small}>{gr.layer === "bottom" ? `bottom, spanning ${gr.dir}` : `top, ${gr.dir} ${gr.edge} edge (${gr.fixed ? "continuous" : "discontinuous"})`}</text>
        </g>
      ))}
      <text x={50} y={svgH - 6} {...small}>
        Bottom bars solid, top bars dashed (a few of each set drawn). Hatched edge = continuous support; dashed = discontinuous{g.one_way ? "; long edges free" : ""}. h = {g.h_mm} mm.
      </text>
    </svg>
  );
}

/* --------------------------------------------------------------- column */
function Column({ g }) {
  const st = g.stack;
  const H = g.storey_height_mm;
  const total = H * st.length;
  const sy = Math.min(460 / total, 0.12);
  const bmax = Math.max(...st.map((l) => l.h));
  const sxc = Math.max(56 / bmax, sy);
  const x0 = 120, y0 = 24;
  const Y = (mm) => y0 + (total - mm) * sy;           // mm above the base
  const colW = bmax * sxc;
  const els = [];
  st.forEach((l, k) => {
    const base = k * H;
    const w = l.h * sxc, xl = x0 + (colW - w) / 2;
    els.push(<rect key={`c${k}`} x={xl} y={Y(base + H)} width={w} height={H * sy} {...outline} />);
    els.push(<rect key={`f${k}`} x={x0 - 30} y={Y(base + H) - 3} width={colW + 60} height="6" fill="none" stroke={DIM} strokeWidth="0.8" />);
    // bars: storey height + lap into the next storey; offset inward a little on alternate storeys to show the lap
    const off = (k % 2 ? 4 : 0);
    const top = base + H + l.lap_mm;
    [xl + 5 + off, xl + w - 5 - off].forEach((xx, j) => els.push(<line key={`b${k}${j}`} x1={xx} y1={Y(base)} x2={xx} y2={Y(Math.min(top, total))} {...bar} />));
    // links: reduced zones at the bottom and top, normal between
    const zs = [[base, base + l.z_bot, l.s_red], [base + l.z_bot, base + H - l.z_top, l.s], [base + H - l.z_top, base + H, l.s_red]];
    zs.forEach(([a1, a2, s], z) => ticks(a1 + 50, a2 - 1, s, 14).forEach((m, i) => (
      els.push(<line key={`l${k}${z}${i}`} x1={xl + 2} y1={Y(m)} x2={xl + w - 2} y2={Y(m)} stroke={RED} strokeWidth="0.8" opacity="0.8" />)
    )));
    const ym = Y(base + H / 2);
    els.push(<text key={`t${k}`} x={x0 + colW + 40} y={ym - 10} {...txt} fontWeight="700">{l.level}</text>);
    els.push(<text key={`m${k}`} x={x0 + colW + 40} y={ym + 3} {...txt}>{l.main_callout} (main)</text>);
    els.push(<text key={`k${k}`} x={x0 + colW + 40} y={ym + 16} {...small}>{l.link_callout} (links, normal/reduced)</text>);
    if (l.lap_mm) els.push(<text key={`p${k}`} x={x0 - 34} y={Y(base + H + l.lap_mm / 2) + 3} textAnchor="end" {...small}>lap {l.lap_mm}</text>);
  });
  // section of the bottom storey
  const L0 = st[0];
  const s2 = Math.min(150 / L0.b, 200 / L0.h);
  const sx0 = x0 + colW + 290, sy0 = y0 + 30;
  const c = L0.cover + L0.link_phi + L0.phi / 2;
  const facePts = (n, len) => Array.from({ length: n }, (_, i) => c + (i * (len - 2 * c)) / (n - 1));
  const pts = [];
  facePts(L0.n_b_face, L0.b).forEach((x) => { pts.push([x, c]); pts.push([x, L0.h - c]); });
  facePts(L0.n_h_face, L0.h).slice(1, -1).forEach((y) => { pts.push([c, y]); pts.push([L0.b - c, y]); });
  return (
    <svg viewBox={`0 0 ${sx0 + L0.b * s2 + 120} ${Math.max(y0 + total * sy + 30, sy0 + L0.h * s2 + 60)}`} className={`w-full ${WRAP}`} role="img" aria-label="Column elevation and section">
      <text x={x0} y={14} {...txt} fontWeight="700">ELEVATION</text>
      {els}
      <text x={sx0} y={sy0 - 12} {...txt} fontWeight="700">SECTION ({L0.level})</text>
      <rect x={sx0} y={sy0} width={L0.b * s2} height={L0.h * s2} {...outline} />
      <rect x={sx0 + L0.cover * s2} y={sy0 + L0.cover * s2} width={(L0.b - 2 * L0.cover) * s2} height={(L0.h - 2 * L0.cover) * s2} rx="4" fill="none" stroke={RED} strokeWidth="1.6" />
      {L0.cross_ties ? facePts(L0.n_h_face, L0.h).slice(1, -1).map((y, i) => (
        <line key={`ct${i}`} x1={sx0 + c * s2} y1={sy0 + y * s2} x2={sx0 + (L0.b - c) * s2} y2={sy0 + y * s2} stroke={RED} strokeWidth="1.2" strokeDasharray="4 2" />
      )) : null}
      {pts.map(([x, y], i) => <circle key={`p${i}`} cx={sx0 + x * s2} cy={sy0 + y * s2} r={Math.max(3, (L0.phi / 2) * s2)} fill={RED} />)}
      <HDim x1={sx0} x2={sx0 + L0.b * s2} y={sy0 + L0.h * s2 + 12} label={`${L0.b}`} />
      <VDim x={sx0 - 14} y1={sy0} y2={sy0 + L0.h * s2} label={`${L0.h}`} />
      <text x={sx0} y={sy0 + L0.h * s2 + 40} {...small}>{L0.n_bars} Y{L0.phi}; links Y{L0.link_phi}{L0.cross_ties ? `; ${L0.cross_ties} cross-tie(s) per set` : ""}</text>
    </svg>
  );
}

export default function MemberDetailDrawing({ det }) {
  const g = det?.drawing;
  if (!g) return null;
  const uid = `md${det.element || "x"}`;
  if (g.kind === "panel") return <Panel g={g} uid={uid} />;
  if (g.kind === "column") return <Column g={g} />;
  return (
    <div className="space-y-4">
      <Elevation g={g} uid={uid} />
      {!g.slab && g.section && <div className="flex justify-center"><BeamSection g={g} /></div>}
    </div>
  );
}
