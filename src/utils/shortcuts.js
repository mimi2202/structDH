// Keyboard shortcuts: one list, read by the shortcut layer
// (components/ShortcutLayer.jsx) and by the Help page. "Mod" is Ctrl on
// Windows / Linux and Cmd on a Mac. Two-key "go to" shortcuts are pressed one
// after the other (G, then the letter) and are ignored while typing in a field.
// Button shortcuts press the page's own button (data-shortcut="..."), so they
// do exactly what clicking it does.

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
export const MOD = IS_MAC ? "⌘" : "Ctrl";

export const SHORTCUTS = [
  { group: "Design", keys: ["Mod", "Enter"], action: "Run the design", where: "Element input pages. On the column page it moves to the next step, then runs on the last one. Works while typing in a field." },
  { group: "Results", keys: ["Mod", "S"], action: "Save the design", where: "Results pages (opens the Save dialog)." },
  { group: "Results", keys: ["Mod", "O"], action: "Open a saved design", where: "Results pages." },
  { group: "Results", keys: ["Mod", "P"], action: "Download the PDF of the open tab", where: "Results pages (Overview = the full report)." },
  { group: "Go to", keys: ["G", "D"], action: "Dashboard", go: "/dashboard" },
  { group: "Go to", keys: ["G", "N"], action: "New design (Quick Design)", go: "/quick-design" },
  { group: "Go to", keys: ["G", "P"], action: "Projects", go: "/workspace/all/projects" },
  { group: "Go to", keys: ["G", "R"], action: "Reports", go: "/reports" },
  { group: "Go to", keys: ["G", "S"], action: "Saved designs", go: "/saved-designs" },
  { group: "Go to", keys: ["G", "O"], action: "Organisations", go: "/organisations" },
  { group: "Go to", keys: ["G", "L"], action: "Load cases", go: "/load-cases" },
  { group: "Go to", keys: ["G", "M"], action: "Materials", go: "/materials" },
  { group: "Go to", keys: ["G", "H"], action: "Help", go: "/help" },
  { group: "General", keys: ["?"], action: "Show this list of shortcuts", where: "Anywhere except while typing in a field." },
  { group: "General", keys: ["Esc"], action: "Close a dialog or menu" },
];

export const keyLabel = (k) => (k === "Mod" ? MOD : k);

// "go to" target for the letter pressed after G
export const GO_KEYS = Object.fromEntries(SHORTCUTS.filter((s) => s.go).map((s) => [s.keys[1].toLowerCase(), s.go]));
