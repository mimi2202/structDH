import React, { useEffect, useRef, useState } from "react";
import { FiLoader } from "react-icons/fi";

// Same progress bar the slab page (StructuralInput.jsx) shows while a design
// runs: jumps to 20%, then 45% once the request is in flight, and the page
// navigates to the results when it comes back. Hidden when not active.
export default function DesignProgressBar({ active, label = "Running design optimisation…" }) {
  // Mounted fresh on every run, so each one starts again from 20%.
  return active ? <Bar label={label} /> : null;
}

function Bar({ label }) {
  const [progress, setProgress] = useState(20);
  const ref = useRef(null);

  useEffect(() => {
    // The run buttons sit at the bottom of long forms and the bar at the top,
    // so bring it into view or the user never sees it.
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setProgress(45), 50);   // next tick, so the width transition animates
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={ref} className="mb-5">
      <div className="mb-2 flex items-center gap-3">
        <FiLoader className="animate-spin text-[#0A2F44] dark:text-[#66a4c2]" />
        <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-2 rounded-full bg-[#0A2F44] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
