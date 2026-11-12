// src/pages/Settings.jsx — app-wide preferences (renders inside MainLayout).
// Everything here is stored in this browser (utils/appSettings.js) and is
// read by the input pages and the PDF cover; nothing is sent to the backend.
import Dropdown from "../components/Dropdown";
import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiDownload, FiUpload, FiTrash2, FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../contexts/ThemeContext";
import ResetButton from "../components/ui/ResetButton";
import { getSettings, saveSettings, SETTINGS_DEFAULTS, COMMON_CONCRETE, COMMON_STEEL } from "../utils/appSettings";
import { ELEMENTS, listDesigns } from "../utils/savedDesigns";
import { listLoadSets, saveLoadSets } from "../utils/loadLibrary";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const INPUT = "w-full rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0b0f19] px-3 py-2 text-sm text-[#0F172A] dark:text-white focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none";
const BTN = `flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors`;

const designKey = (el) => `saved_designs_${el}`;
const counts = () => Object.keys(ELEMENTS).map((el) => [el, listDesigns(el).length]);

export default function Settings() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [s, setS] = useState(getSettings);
  const [savedAt, setSavedAt] = useState(null);
  const [saved, setSaved] = useState(counts);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const total = saved.reduce((a, [, n]) => a + n, 0);

  // every change is stored straight away
  const set = (patch) => {
    const next = { ...s, ...patch };
    setS(next); saveSettings(next); setSavedAt(new Date());
  };

  const exportData = () => {
    const data = {
      app: "SDH (Structural Design Hub)", exported_at: new Date().toISOString(), settings: s,
      saved_designs: Object.fromEntries(Object.keys(ELEMENTS).map((el) => [el, listDesigns(el)])),
      load_sets: listLoadSets(),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `sdh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setNote(`Exported settings, ${total} saved design${total === 1 ? "" : "s"} and ${listLoadSets().length} load set${listLoadSets().length === 1 ? "" : "s"}.`);
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || (!data.settings && !data.saved_designs && !data.load_sets)) throw new Error("not a backup file");
      if (data.settings) { const next = { ...SETTINGS_DEFAULTS, ...data.settings }; setS(next); saveSettings(next); }
      let n = 0;
      for (const el of Object.keys(ELEMENTS)) {
        const list = data.saved_designs?.[el];
        if (!Array.isArray(list)) continue;
        // imported designs are added to the ones already here (same id = same design)
        const have = listDesigns(el);
        const ids = new Set(have.map((d) => d.id));
        const merged = [...have, ...list.filter((d) => d && d.id && !ids.has(d.id))]
          .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at))).slice(0, 20);
        n += merged.length - have.length;
        localStorage.setItem(designKey(el), JSON.stringify(merged));
      }
      // load sets: added to the ones here (same id = same set)
      let nl = 0;
      if (Array.isArray(data.load_sets)) {
        const have = listLoadSets();
        const ids = new Set(have.map((x) => x.id));
        const add = data.load_sets.filter((x) => x && x.id && !ids.has(x.id));
        nl = add.length;
        saveLoadSets([...have, ...add]);
      }
      setSaved(counts());
      setNote(`Imported ${file.name}: settings ${data.settings ? "replaced" : "unchanged"}, ${n} design${n === 1 ? "" : "s"} and ${nl} load set${nl === 1 ? "" : "s"} added.`);
    } catch (err) {
      setNote(`Could not import ${file.name}: ${err.message}.`);
    }
  };

  const clearDesigns = () => {
    for (const el of Object.keys(ELEMENTS)) { try { localStorage.removeItem(designKey(el)); } catch { /* ignore */ } }
    setSaved(counts());
    setNote("All saved designs deleted from this browser.");
  };

  const text = (label, key, placeholder) => (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={INPUT} value={s[key]} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
    </div>
  );
  const pick = (label, key, options) => (
    <div>
      <label className={LABEL}>{label}</label>
      <Dropdown value={s[key]} onChange={(v) => set({ [key]: v })}
        options={[{ value: "", label: "Each page's own default" }, ...options]} />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]">Settings</h1>
          <p className={`text-sm ${SUB}`}>Preferences for this browser. They are saved as you type.</p>
        </div>
        {savedAt && (
          <span role="status" className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
            <FiCheck size={14} /> Saved {savedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Report identity</h2>
        <p className={`mt-1 mb-4 text-xs ${SUB}`}>
          The company name is printed at the top of every PDF cover page. The designer and checker fill the
          Design Basis fields of each input page when those are blank; you can still change them per design.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">{text("Company / practice name", "company", "e.g. Okoye & Partners Consulting Engineers")}</div>
          {text("Designed by", "designerName", "Name")}
          {text("Designer's qualifications", "designerQualifications", "e.g. B.Eng, MNSE, COREN")}
          {text("Checked by", "checkedBy", "Name")}
          {text("Checker's qualifications", "checkerQualifications", "e.g. M.Sc, FNSE")}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Design defaults</h2>
        <p className={`mt-1 mb-4 text-xs ${SUB}`}>
          Used when an input page is opened for the first time in a session, or after Reset. A design you are part-way
          through keeps its own grades. Only grades that every element offers are listed.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pick("Concrete grade", "concreteGrade", COMMON_CONCRETE)}
          {pick("Steel grade", "steelGrade", COMMON_STEEL)}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Appearance</h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className={`text-sm font-medium ${MAIN}`}>Theme</div>
            <div className={`text-xs ${SUB}`}>PDF reports always print on a light page.</div>
          </div>
          <div className="flex rounded-lg border border-[#e2e8f0] p-0.5 dark:border-[#334155]">
            {[{ label: "Light", dark: false, icon: FiSun }, { label: "Dark", dark: true, icon: FiMoon }].map(({ label, dark, icon }) => {
              const Icon = icon;
              return (
              <button key={label} type="button" aria-pressed={isDarkMode === dark}
                onClick={() => { if (isDarkMode !== dark) toggleDarkMode(); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isDarkMode === dark ? "bg-[#0A2F44] text-white" : `${SUB} hover:bg-[#f1f5f9] dark:hover:bg-[#334155]`}`}>
                <Icon size={14} /> {label}
              </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className={TITLE}>Saved designs and backup</h2>
        <p className={`mt-1 mb-3 text-xs ${SUB}`}>
          Saved designs and load sets live only in this browser (up to 20 designs per element). Export a backup file to keep
          them or move them to another computer. <Link to="/saved-designs" className="font-medium text-[#0A2F44] hover:underline dark:text-[#66a4c2]">Open Saved Designs</Link>
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {saved.map(([el, n]) => (
            <span key={el} className={`rounded-md bg-[#f1f5f9] px-2.5 py-1 text-xs dark:bg-[#0b0f19] ${MAIN}`}>
              {ELEMENTS[el].label}: <b>{n}</b>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={exportData} className={BTN}><FiDownload size={15} /> Export backup</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={BTN}><FiUpload size={15} /> Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          {total > 0 && (
            <ResetButton onReset={clearDesigns} title="Delete all saved designs?" confirmLabel="Delete all"
              message={`${total} saved design${total === 1 ? "" : "s"} will be removed from this browser. Export a backup first if you may need them.`}
              className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
              <FiTrash2 size={15} /> Delete all saved designs
            </ResetButton>
          )}
        </div>
        {note && <p role="status" className={`mt-3 text-xs ${MAIN}`}>{note}</p>}
      </section>
    </div>
  );
}
