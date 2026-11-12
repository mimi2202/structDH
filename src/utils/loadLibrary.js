// src/utils/loadLibrary.js
// Load sets: named groups of characteristic loads kept in this browser
// (localStorage "load_sets"), made on the Load Cases page and applied to an
// element's input page by writing that page's sessionStorage draft, which the
// page reads when it opens (its other fields are left as they were).
//
// Two kinds:
//   area (kN/m2): slabs and staircase  -- finishes, extra dead, imposed, extra imposed, wind
//   line (kN/m):  beams                -- wall, finishes, extra dead, live, other live
// Values are characteristic (unfactored); self-weight is never part of a set,
// every element works its own out.
import { getSettings } from "./appSettings";

const KEY = "load_sets";

// EN 1991-1-1 imposed loads (indicative) by occupancy, and the EN 1990 Table
// A1.1 psi_2 the continuous-slab crack check uses for each
// (backend services/continuous_slab_service.py PSI2_BY_OCCUPANCY).
export const OCCUPANCY = [
  { value: "", label: "Custom (enter live load)" },
  { value: "residential", label: "Residential (1.5)", name: "Residential", qk: 1.5, psi2: 0.3 },
  { value: "office", label: "Office (2.5)", name: "Office", qk: 2.5, psi2: 0.3 },
  { value: "classroom", label: "Classroom / School (3.0)", name: "Classroom / school", qk: 3.0, psi2: 0.6 },
  { value: "retail", label: "Retail / Shop (4.0)", name: "Retail / shop", qk: 4.0, psi2: 0.6 },
  { value: "assembly", label: "Assembly / Public (5.0)", name: "Assembly / public", qk: 5.0, psi2: 0.6 },
  { value: "parking", label: "Parking (2.5)", name: "Parking", qk: 2.5, psi2: 0.6 },
  { value: "storage", label: "Storage (7.5)", name: "Storage", qk: 7.5, psi2: 0.8 },
];

export const AREA_FIELDS = [
  ["finishes", "Finishes"], ["extraDead", "Additional dead"],
  ["imposed", "Imposed (live)"], ["extraImposed", "Additional imposed"], ["wind", "Wind (downward)"],
];
export const LINE_FIELDS = [
  ["wall", "Wall"], ["finishes", "Finishes"], ["extraDead", "Additional dead"],
  ["live", "Live"], ["otherLive", "Other live"],
];

export const newLoadSet = (kind = "area") => ({
  id: `${Date.now()}`, kind, name: kind === "area" ? "New floor load" : "New beam load", occupancy: "",
  values: Object.fromEntries((kind === "area" ? AREA_FIELDS : LINE_FIELDS).map(([k]) => [k, 0])),
});

export function listLoadSets() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveLoadSets(sets) {
  try { localStorage.setItem(KEY, JSON.stringify(sets)); } catch { /* storage disabled */ }
}

const n = (v) => Math.max(Number(v) || 0, 0);
const str = (v) => String(+n(v).toFixed(3));

// grade fields of each page, so a draft created here still starts from the
// Settings default grades (a page treats an existing draft as work in progress)
const withGrades = (draft, concrete, steel, steelNumeric) => {
  const s = getSettings();
  const out = { ...draft };
  if (s.concreteGrade) out[concrete] = s.concreteGrade;
  if (s.steelGrade) out[steel] = steelNumeric ? s.steelGrade.replace(/\D/g, "") : s.steelGrade;
  return out;
};

function readDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
function writeDraft(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/* Where a set can go, what each page receives, and what it cannot take. */
export const TARGETS = [
  {
    id: "slab", label: "One-way / two-way slab", kind: "area", route: "/structural-input",
    notes: "All five loads are used.",
    apply: (v) => {
      const key = "structuralInputDraft", d = readDraft(key);
      const loads = { floorFinish: str(v.finishes), additionalDeadLoad: str(v.extraDead), liveLoad: str(v.imposed),
                      additionalLiveLoad: str(v.extraImposed), windLoad: str(v.wind) };
      writeDraft(key, d ? { ...d, ...loads } : withGrades(loads, "concreteGrade", "steelGrade"));
    },
  },
  {
    id: "continuous-slab", label: "Continuous slab", kind: "area", route: "/continuous-slab",
    notes: "Wind is not used (the continuous slab has no wind input). The occupancy, if set, also sets ψ2 for the crack check.",
    apply: (v, set) => {
      const key = "continuousSlabInputDraft", d = readDraft(key);
      const loads = { floorFinish: str(v.finishes), additionalDeadLoad: str(v.extraDead), liveLoad: str(v.imposed),
                      additionalLiveLoad: str(v.extraImposed), occupancy: set.occupancy || "" };
      writeDraft(key, d ? { ...d, ...loads } : withGrades(loads, "concreteGrade", "steelGrade"));
    },
  },
  {
    id: "staircase", label: "Staircase", kind: "area", route: "/staircase-design",
    notes: "The staircase has one dead and one imposed field: finishes + additional dead go into Finishes, imposed + additional imposed into Imposed. Wind is not used.",
    apply: (v) => {
      const key = "staircaseInputDraft", d = readDraft(key);
      const loads = { finishes_kN_m2: str(n(v.finishes) + n(v.extraDead)), qk_kN_m2: str(n(v.imposed) + n(v.extraImposed)) };
      writeDraft(key, d ? { ...d, ...loads } : withGrades(loads, "concrete", "fyk", true));
    },
  },
  {
    id: "beam", label: "Simply supported beam", kind: "line", route: "/beam",
    notes: "All five loads are used; self-weight is added by the page.",
    apply: (v) => applyBeam("ss", v),
  },
  {
    id: "continuous-beam", label: "Continuous beam", kind: "line", route: "/continuous-beam",
    notes: "Applied to every span; per-span overrides on the page are kept.",
    apply: (v) => applyBeam("cb", v),
  },
];

function applyBeam(mode, v) {
  const key = "beamInputDraft", d = readDraft(key) || {};
  const loads = { wallLoad: str(v.wall), finishes: str(v.finishes), additionalDeadLoad: str(v.extraDead),
                  liveLoad: str(v.live), otherLiveLoad: str(v.otherLive) };
  writeDraft(key, { ...d, [mode]: d[mode] ? { ...d[mode], ...loads } : withGrades(loads, "concreteGrade", "steelGrade") });
}

/** Characteristic totals of a set: G (dead), Q (imposed), W (wind). */
export function totals(set) {
  const v = set.values || {};
  return set.kind === "area"
    ? { G: n(v.finishes) + n(v.extraDead), Q: n(v.imposed) + n(v.extraImposed), W: n(v.wind) }
    : { G: n(v.wall) + n(v.finishes) + n(v.extraDead), Q: n(v.live) + n(v.otherLive), W: 0 };
}
