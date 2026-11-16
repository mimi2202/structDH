// src/components/Dropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";

/**
 * Custom dropdown matching the Sphere Design Hub palette (light + dark).
 *
 * Props:
 *   value     - current value (string | number)
 *   onChange  - (value) => void   OR  accepts an event-like { target: { value } }
 *   options   - array of strings | numbers, or { value, label } objects
 *   placeholder
 *   disabled
 *   className - extra classes for the trigger button
 */
export default function Dropdown({ value, onChange, options = [], placeholder = "Select…", disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef(null);

  const norm = options.map((o) =>
    typeof o === "object" && o !== null ? { value: o.value, label: o.label ?? String(o.value) } : { value: o, label: String(o) }
  );
  const selected = norm.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (v) => { if (typeof onChange === "function") onChange(v); setOpen(false); };

  const onKey = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!open) setOpen(true); else if (highlight >= 0) pick(norm[highlight].value); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, norm.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] px-3 py-2 text-sm text-left text-[#0F172A] dark:text-white transition focus:outline-none focus:ring-2 focus:ring-[#0A2F44]/30 dark:focus:ring-[#66a4c2]/30 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-[#0A2F44]/40 dark:hover:border-[#66a4c2]/40"} ${className}`}
      >
        <span className={selected ? "" : "text-[#94a3b8]"}>{selected ? selected.label : placeholder}</span>
        <FiChevronDown className={`ml-2 flex-shrink-0 text-[#64748b] dark:text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`} size={16} />
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          {norm.length === 0 && <li className="px-3 py-2 text-sm text-[#94a3b8]">No options</li>}
          {norm.map((o, i) => {
            const isSel = String(o.value) === String(value);
            return (
              <li
                key={String(o.value)}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                  highlight === i ? "bg-[#e6f0f5] dark:bg-[#1e3a4a]" : ""
                } ${isSel ? "font-semibold text-[#0A2F44] dark:text-[#66a4c2]" : "text-[#0F172A] dark:text-white"}`}
              >
                <span>{o.label}</span>
                {isSel && <FiCheck size={15} className="text-[#0A2F44] dark:text-[#66a4c2]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}