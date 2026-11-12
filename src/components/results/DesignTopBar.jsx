// src/components/results/DesignTopBar.jsx
// The bar at the top of every results page: clickable breadcrumb on the left,
// New / Open / Save and a "more" menu on the right. Save asks for a project
// and design name; designs are kept in this browser (utils/savedDesigns.js)
// and are also listed on /saved-designs.
import React, { useImperativeHandle, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiHome, FiChevronRight, FiFilePlus, FiFolder, FiSave, FiMoreVertical, FiTrash2, FiX } from "react-icons/fi";
import {
  ELEMENTS, listDesigns, saveDesign, deleteDesign, designState, lastProject,
} from "../../utils/savedDesigns";

const CARD = "rounded-xl border bg-white dark:bg-[#0f172a] border-[#e2e8f0] dark:border-[#1f2937] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const HOVER = "hover:bg-[#f1f5f9] dark:hover:bg-[#1f2937]";
const INPUT = "w-full rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0b0f19] px-3 py-2 text-[13px] text-[#0F172A] dark:text-white focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none";

/* Breadcrumb: every stage but the last is a link ({ label, to } or { label, onClick }). */
export function Crumbs({ items }) {
  const link = "rounded px-1 -mx-1 cursor-pointer transition-colors hover:bg-[#e6f0f5] hover:text-[#0A2F44] dark:hover:bg-[#1e3a4a] dark:hover:text-[#66a4c2]";
  return (
    <nav aria-label="Breadcrumb" className={`hidden md:flex items-center gap-1.5 text-[13px] ${SUB}`}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        let node;
        if (last || (!c.to && !c.onClick)) node = <span className={last ? `font-medium ${MAIN}` : ""} aria-current={last ? "page" : undefined}>{c.label}</span>;
        else if (c.to) node = <Link to={c.to} className={link}>{c.label}</Link>;
        else node = <button type="button" onClick={c.onClick} className={link}>{c.label}</button>;
        return (
          <React.Fragment key={i}>
            {i > 0 && <FiChevronRight size={13} />}
            {node}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* One saved design per row: open on click, bin to delete. */
export function SavedDesignRows({ designs, onOpen, onDelete, showElement }) {
  return (
    <ul className="divide-y divide-[#e2e8f0] dark:divide-[#1f2937]">
      {designs.map((d) => (
        <li key={`${d.element || ""}${d.id}`} className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => onOpen(d)} className="min-w-0 flex-1 text-left">
            <div className={`truncate text-[13px] font-semibold ${MAIN}`}>
              {d.project ? `${d.project} — ` : ""}{d.name}
            </div>
            <div className={`truncate text-[11px] ${SUB}`}>
              {showElement && d.element ? `${ELEMENTS[d.element]?.label || d.element} · ` : ""}
              {new Date(d.saved_at).toLocaleString()}{d.subtitle ? ` · ${d.subtitle}` : ""}
              {d.status ? <> · <span className={d.status === "PASS" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{d.status}</span></> : null}
            </div>
          </button>
          <button onClick={() => onDelete(d)} aria-label={`Delete ${d.name}`}
            className={`rounded-md p-1.5 ${SUB} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20`}><FiTrash2 size={14} /></button>
        </li>
      ))}
    </ul>
  );
}

/**
 * element   key in ELEMENTS (which saved list this page reads and writes)
 * crumbs    [{ label, to | onClick }], the last one is the current page
 * onNew     start a new design (go to the input page)
 * save      { name, project, status, subtitle, state } for the design on screen;
 *           state defaults to the router state the page was opened with
 * onOpened  called after a saved design has been opened on this page
 * menu      extra [label, fn] rows for the "more" menu
 * ref       { save(), open() } so other buttons on the page can open the same dialogs
 */
export default function DesignTopBar({ element, crumbs, onNew, save, onOpened, menu = [], className = "", ref }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openList, setOpenList] = useState(null);   // saved designs shown by "Open", null = closed
  const [saveForm, setSaveForm] = useState(null);   // { project, name } while the Save dialog is open
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const label = ELEMENTS[element]?.label || "Design";

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const showOpen = () => setOpenList(listDesigns(element));
  const showSave = () => setSaveForm({ project: save.project || lastProject(), name: save.name || `${label} design` });
  useImperativeHandle(ref, () => ({ save: showSave, open: showOpen }));

  const confirmSave = (e) => {
    e.preventDefault();
    const project = saveForm.project.trim();
    const name = saveForm.name.trim() || save.name || `${label} design`;
    try {
      saveDesign(element, {
        project, name, status: save.status, subtitle: save.subtitle,
        route: location.pathname, state: save.state || location.state,
      });
      flash(`Saved: ${project ? `${project} — ` : ""}${name}`);
    } catch (err) {
      flash(err.message);
    }
    setSaveForm(null);
  };

  const openSaved = (d) => {
    setOpenList(null);
    navigate(location.pathname, { replace: true, state: designState(d) });
    onOpened?.(d);
  };

  const menuRows = [
    ["Open saved design", showOpen],
    ["Save design", showSave],
    ...menu,
    ["All saved designs", () => navigate("/saved-designs")],
  ];

  return (
    <>
      <header className={`cb-no-print flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1f2937] bg-white dark:bg-[#0b0f19] px-4 py-2.5 ${className}`}>
        <div className="flex items-center gap-6">
          <Link to="/dashboard" title="Dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiHome size={15} /></div>
            <span className={`text-sm font-bold ${MAIN}`}>Struct Design Hub</span>
          </Link>
          <Crumbs items={crumbs} />
        </div>
        <div className="flex items-center gap-1">
          <TopBtn icon={FiFilePlus} label="New" onClick={onNew} />
          <TopBtn icon={FiFolder} label="Open" onClick={showOpen} />
          <TopBtn icon={FiSave} label="Save" onClick={showSave} />
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="More actions" className={`ml-1 rounded-md p-1.5 ${SUB} ${HOVER}`}><FiMoreVertical size={16} /></button>
            {menuOpen && (
              <div className={`absolute right-0 z-40 mt-1 w-52 ${CARD} py-1`} onMouseLeave={() => setMenuOpen(false)}>
                {menuRows.map(([text, fn]) => (
                  <button key={text} onClick={() => { setMenuOpen(false); fn(); }}
                    className={`block w-full px-3 py-2 text-left text-[13px] ${MAIN} ${HOVER}`}>{text}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div role="status" className="cb-no-print fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-[#0A2F44] px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}

      {saveForm && (
        <div className="cb-no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4" onClick={() => setSaveForm(null)}>
          <form onSubmit={confirmSave} className={`${CARD} mt-16 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#1f2937]">
              <h3 className={`text-sm font-bold ${MAIN}`}>Save design</h3>
              <button type="button" onClick={() => setSaveForm(null)} aria-label="Close" className={SUB}><FiX size={16} /></button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="block">
                <span className={`mb-1 block text-xs font-medium ${SUB}`}>Project name</span>
                <input autoFocus value={saveForm.project} placeholder="e.g. Lekki Office Block"
                  onChange={(e) => setSaveForm({ ...saveForm, project: e.target.value })} className={INPUT} />
              </label>
              <label className="block">
                <span className={`mb-1 block text-xs font-medium ${SUB}`}>Design name</span>
                <input value={saveForm.name} onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })} className={INPUT} />
              </label>
              <p className={`text-[11px] ${SUB}`}>Kept in this browser only (up to 20 per element). Find it again under Open, or on the Saved Designs page.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e2e8f0] px-4 py-3 dark:border-[#1f2937]">
              <button type="button" onClick={() => setSaveForm(null)} className={`rounded-lg border border-[#e2e8f0] dark:border-[#1f2937] px-4 py-2 text-[13px] font-medium ${MAIN} ${HOVER}`}>Cancel</button>
              <button type="submit" className="rounded-lg bg-[#0A2F44] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#082636]">Save</button>
            </div>
          </form>
        </div>
      )}

      {openList && (
        <div className="cb-no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4" onClick={() => setOpenList(null)}>
          <div className={`${CARD} mt-16 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 dark:border-[#1f2937]">
              <h3 className={`text-sm font-bold ${MAIN}`}>Saved {label.toLowerCase()} designs</h3>
              <button onClick={() => setOpenList(null)} aria-label="Close" className={SUB}><FiX size={16} /></button>
            </div>
            {openList.length === 0 ? (
              <p className={`px-4 py-6 text-center text-[13px] ${SUB}`}>No saved {label.toLowerCase()} designs in this browser yet. Use Save on a result to keep it.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <SavedDesignRows designs={openList} onOpen={openSaved}
                  onDelete={(d) => { deleteDesign(element, d.id); setOpenList(listDesigns(element)); }} />
              </div>
            )}
            <div className={`flex items-center justify-between border-t border-[#e2e8f0] px-4 py-2 text-[11px] ${SUB} dark:border-[#1f2937]`}>
              <span>Designs are kept in this browser only (up to 20 per element).</span>
              <Link to="/saved-designs" className="font-medium text-[#0A2F44] hover:underline dark:text-[#66a4c2]">All saved designs</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TopBtn({ icon, label, onClick }) {
  const Icon = icon;
  return (
    <button onClick={onClick} className={`hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium ${SUB} ${HOVER}`}>
      <Icon size={15} /> {label}
    </button>
  );
}
