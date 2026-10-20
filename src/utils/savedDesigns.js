// src/utils/savedDesigns.js
// Designs saved from a results page, kept in this browser's localStorage
// (there is no design store on the backend). One list per element, newest
// first, capped so a full report per entry cannot fill the storage quota.

const MAX_PER_ELEMENT = 20;
const key = (element) => `saved_designs_${element}`;

export function listDesigns(element) {
  try {
    return JSON.parse(localStorage.getItem(key(element)) || "[]");
  } catch {
    return [];
  }
}

// entry: { name, status, subtitle, designResult, formData }
// Returns the saved entry, or throws with a readable message.
export function saveDesign(element, entry) {
  const saved = { id: `${Date.now()}`, saved_at: new Date().toISOString(), ...entry };
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
