// Global keyboard shortcuts (utils/shortcuts.js). Mounted once inside the
// router. Button shortcuts press the visible button marked data-shortcut on
// the current page; "go to" shortcuts are G then a letter; "?" shows the list.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { SHORTCUTS, GO_KEYS, keyLabel } from "../utils/shortcuts";

const typingIn = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// the page's own button for a shortcut: visible, enabled, not in an off-screen print copy
function findButton(name) {
  return [...document.querySelectorAll(`[data-shortcut="${name}"]`)].find((b) =>
    !b.disabled && b.offsetParent !== null && !b.closest("[data-pdf-host]") && !b.closest('[aria-hidden="true"]'));
}

export function Kbd({ children }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-[#cbd5e1] bg-[#f8fafc] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A] shadow-[inset_0_-1px_0_#cbd5e1] dark:border-[#475569] dark:bg-[#0f172a] dark:text-white">{children}</kbd>;
}

export function ShortcutKeys({ keys }) {
  const seq = keys[0] === "G";
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[10px] text-[#94a3b8]">{seq ? "then" : "+"}</span>}
          <Kbd>{keyLabel(k)}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export default function ShortcutLayer() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey) {
        const k = e.key.toLowerCase();
        const name = k === "enter" ? "run" : k === "s" ? "save" : k === "o" ? "open" : k === "p" ? "pdf" : null;
        if (!name) return;
        const btn = findButton(name) || (name === "run" ? findButton("next") : null);
        if (!btn) return;                       // nothing to do here: leave the browser's own action alone
        e.preventDefault();
        btn.click();
        return;
      }
      if (e.altKey || typingIn(e.target)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); setOpen((o) => !o); return; }
      if (e.key === "Escape") { setOpen(false); return; }
      const k = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 1200 && GO_KEYS[k]) {
        pendingG.current = 0;
        e.preventDefault();
        navigate(GO_KEYS[k]);
        return;
      }
      pendingG.current = k === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!open) return null;
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" data-shortcut-list
        className="mt-16 max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-[#e2e8f0] bg-white shadow-2xl dark:border-[#334155] dark:bg-[#1f2937]">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#334155]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0F172A] dark:text-white">Keyboard shortcuts</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"><FiX /></button>
        </div>
        <div className="space-y-4 px-4 py-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{g}</div>
              <ul className="divide-y divide-[#f1f5f9] dark:divide-[#263244]">
                {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                  <li key={s.keys.join("+")} className="flex items-center justify-between gap-3 py-1.5 text-sm text-[#0F172A] dark:text-white">
                    <span>{s.action}</span><ShortcutKeys keys={s.keys} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">The full list with where each one works is on the Help page.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
