// Bar shape sketch for bending schedules (BS 8666 shape codes), shared by the
// foundation, staircase-style and beam schedules. Drawn large enough to read
// in the PDF.
//   00 straight (A)   11 L-bar (A vertical, B foot)   21 U-bar (A leg, B, C leg)
//   51 closed link (A x B, C hooks)
import React from "react";

export default function BarShape({ code, dims }) {
  const stroke = "currentColor";
  const lab = { fontSize: 12, fill: "#475569" };
  const cls = "text-[#c0392b] dark:text-[#f87171]";
  if (code === "00") {
    return (
      <svg width="230" height="50" viewBox="0 0 230 50" className={cls}>
        <line x1="30" y1="22" x2="200" y2="22" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <text x="115" y="42" textAnchor="middle" {...lab}>{dims.A}</text>
      </svg>
    );
  }
  if (code === "21") {
    return (
      <svg width="230" height="70" viewBox="0 0 230 70" className={cls}>
        <polyline points="44,8 44,42 186,42 186,8" fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
        <text x="38" y="30" textAnchor="end" {...lab}>{dims.A}</text>
        <text x="115" y="60" textAnchor="middle" {...lab}>{dims.B}</text>
        <text x="192" y="30" {...lab}>{dims.C}</text>
      </svg>
    );
  }
  if (code === "51") {
    return (
      <svg width="230" height="84" viewBox="0 0 230 84" className={cls}>
        <rect x="80" y="10" width="62" height="54" rx="5" fill="none" stroke={stroke} strokeWidth="3" />
        <polyline points="124,10 142,10 142,28" fill="none" stroke={stroke} strokeWidth="3" />
        <line x1="128" y1="12" x2="114" y2="26" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <line x1="140" y1="24" x2="126" y2="38" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <text x="111" y="79" textAnchor="middle" {...lab}>{dims.A}</text>
        <text x="74" y="41" textAnchor="end" {...lab}>{dims.B}</text>
        <text x="150" y="41" {...lab}>hooks {dims.C}</text>
      </svg>
    );
  }
  return (
    <svg width="230" height="70" viewBox="0 0 230 70" className={cls}>
      <polyline points="60,6 60,42 150,42" fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <text x="54" y="28" textAnchor="end" {...lab}>{dims.A}</text>
      <text x="105" y="60" textAnchor="middle" {...lab}>{dims.B}</text>
    </svg>
  );
}
