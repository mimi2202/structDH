// src/utils/exportCsv.js
// Results as a CSV file that opens in Excel: blocks of label/value rows,
// tables, then the engine's calculation trace (either report row shape).

const cell = (v) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * blocks: [{ title, rows: [[a, b, ...], ...] }]  -- first row of a table may be its header
 * report: the engine's report array (appended as "Calculation trace")
 */
export function downloadCsv(filename, blocks, report) {
  const lines = [];
  for (const b of blocks) {
    if (!b.rows || !b.rows.length) continue;
    lines.push(cell(b.title));
    for (const r of b.rows) lines.push(r.map(cell).join(","));
    lines.push("");
  }
  if (report && report.length) {
    lines.push("Calculation trace");
    lines.push(["Section", "Reference", "Calculation", "Output"].join(","));
    for (const s of report) {
      for (const r of s.rows || []) {
        lines.push([s.title ?? s.section, r.reference ?? r.ref, r.calculation ?? r.calc, r.output ?? r.out].map(cell).join(","));
      }
    }
  }
  // BOM so Excel reads the file as UTF-8 (², φ, ≤ ...)
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// object -> [[label, value]] for a block; nested objects become "x.as required"
// rows, arrays of plain values are joined, arrays of objects are skipped
export const objectRows = (obj, prefix = "") => Object.entries(obj || {}).flatMap(([k, v]) => {
  const label = prefix + k.replace(/_/g, " ");
  if (v === null || typeof v !== "object") return [[label, v]];
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== "object") ? [[label, v.join("; ")]] : [];
  return objectRows(v, `${label}.`);
});
