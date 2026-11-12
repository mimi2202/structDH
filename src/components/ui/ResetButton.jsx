// src/components/ui/ResetButton.jsx
// The Reset button of every element's input page, with its own confirmation
// dialog (instead of the browser's window.confirm). onReset runs only after
// the user confirms.
//   variant "top"    : small button for the page header (top right)
//   variant "footer" : outlined button for the action bar at the bottom
// Pass className + children to restyle it; title / message / confirmLabel
// reuse the dialog for other destructive actions (Settings: clear saved designs).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiRefreshCw, FiAlertTriangle } from "react-icons/fi";

const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const STYLES = {
  top: `flex items-center gap-1.5 rounded-md border border-[#e2e8f0] dark:border-[#334155] px-2.5 py-1.5 text-xs font-medium ${SUB} hover:bg-[#f1f5f9] hover:text-[#0A2F44] dark:hover:bg-[#334155] dark:hover:text-white transition-colors`,
  footer: `flex items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors`,
};

export default function ResetButton({ onReset, variant = "footer", className, children, what = "this page", title, message, confirmLabel = "Reset" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const confirm = () => { setOpen(false); onReset(); };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || STYLES[variant]}>
        {children || <><FiRefreshCw size={variant === "top" ? 13 : 15} /> Reset</>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title"
            className="w-full max-w-sm rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl dark:border-[#334155] dark:bg-[#1f2937]"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <FiAlertTriangle size={18} />
              </div>
              <div>
                <h3 id="reset-title" className="text-sm font-bold text-[#0F172A] dark:text-white">{title || "Reset all inputs?"}</h3>
                <p className={`mt-1 text-[13px] leading-snug ${SUB}`}>
                  {message || `Every field on ${what} goes back to its default value. What you have entered will be lost.`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setOpen(false)}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[13px] font-medium text-[#0F172A] hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-white dark:hover:bg-[#334155]">
                Cancel
              </button>
              <button type="button" onClick={confirm}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700">
                <FiRefreshCw size={14} /> {confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
