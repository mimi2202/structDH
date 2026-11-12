// src/utils/savedDesigns.js
// Designs saved from a results page, kept in this browser's localStorage
// (there is no design store on the backend). One list per element, newest
// first, capped so a full report per entry cannot fill the storage quota.

const MAX_PER_ELEMENT = 20;
const key = (element) => `saved_designs_${element}`;
const LAST_PROJECT_KEY = "saved_designs_last_project";

// every element that can save a design: label for lists, results route to reopen it on
export const ELEMENTS = {
  slab: { label: "Slab", route: "/slab-results" },
  "continuous-slab": { label: "Continuous Slab", route: "/continuous-slab-results" },
  beam: { label: "Beam", route: "/beam-results" },
  "continuous-beam": { label: "Continuous Beam", route: "/continuous-beam-results" },
  column: { label: "Column", route: "/column-results" },
  foundation: { label: "Foundation", route: "/foundation-results" },
  staircase: { label: "Staircase", route: "/staircase-results" },
};

// Where and with what router state a saved design reopens. Entries saved
// before `route`/`state` existed (slab only) kept designResult/formData.
export const designRoute = (d, element) => d.route || ELEMENTS[element]?.route;
export const designState = (d) => d.state || { designResult: d.designResult, formData: d.formData };

// All saved designs of every element, newest first, each tagged with its element.
export function listAllDesigns() {
  return Object.keys(ELEMENTS)
    .flatMap((element) => listDesigns(element).map((d) => ({ ...d, element })))
    .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
}

// the project name typed at the last save, offered again at the next one
export function lastProject() {
  try { return localStorage.getItem(LAST_PROJECT_KEY) || ""; } catch { return ""; }
}

export function listDesigns(element) {
  try {
    return JSON.parse(localStorage.getItem(key(element)) || "[]");
  } catch {
    return [];
  }
}

// entry: { project, name, status, subtitle, route, state }
// Returns the saved entry, or throws with a readable message.
export function saveDesign(element, entry) {
  const saved = { id: `${Date.now()}`, saved_at: new Date().toISOString(), ...entry };
  try { if (entry.project) localStorage.setItem(LAST_PROJECT_KEY, entry.project); } catch { /* storage disabled */ }
  let list = [saved, ...listDesigns(element)].slice(0, MAX_PER_ELEMENT);
  // drop the oldest until it fits
  for (;;) {
    try {
      localStorage.setItem(key(element), JSON.stringify(list));
      return saved;
    } catch {
      if (list.length <= 1) throw new Error("Browser storage is full or disabled; the design could not be saved.");
      list = list.slice(0, -1);
    }
  }
}

export function deleteDesign(element, id) {
  try {
    localStorage.setItem(key(element), JSON.stringify(listDesigns(element).filter((d) => d.id !== id)));
  } catch { /* storage disabled */ }
}
