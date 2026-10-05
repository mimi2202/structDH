// src/pages/ColumnInput.jsx — EC2 column input
//
// Payload matches models/column_schemas.py:ColumnDesignRequest exactly.
// Nested groups (geometry / effective_length / analysis / reinforcement /
// materials / durability / factors) are not cosmetic — the backend rejects a
// flat body.
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiHome, FiLoader, FiInfo, FiAlertTriangle, FiCheck,
  FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import DesignProgressBar from "../components/ui/DesignProgressBar";
import Dropdown from "../components/Dropdown";
import { columnAPI } from "../services/api";

const DRAFT_KEY = "columnInputDraft";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155]";
const INPUT = "w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] font-mono text-sm disabled:opacity-50";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const SECTION = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const MAIN = "text-[#0F172A] dark:text-white";
const ACCENT = "#0A2F44", ACCENT_D = "#66a4c2";

const COLUMN_TYPES = [
  { value: "axial", label: "Axially Loaded" },
  { value: "uniaxial", label: "Uniaxially Loaded" },
  { value: "biaxial", label: "Biaxially Loaded" },
];
const END_CONDITIONS = [
  { value: "fixed-fixed", label: "Fixed–Fixed (K = 0.5)" },
  { value: "fixed-pinned", label: "Fixed–Pinned (K = 0.7)" },
  { value: "pinned-pinned", label: "Pinned–Pinned (K = 1.0)" },
  { value: "fixed-free", label: "Fixed–Free (K = 2.0)" },
];
const BRACING = [{ value: "braced", label: "Braced" }, { value: "unbraced", label: "Unbraced" }];
const UNIAXIAL_AXES = [
  { value: "x", label: "About x — section depth h resists it" },
  { value: "y", label: "About y — section width b resists it" },
];
const EL_METHODS = [
  { value: "idealised", label: "Idealised K from end condition" },
  { value: "k_factors", label: "Joint flexibilities k₁, k₂ (Eq. 5.15 / 5.16)" },
  { value: "direct", label: "Enter l₀ directly per axis" },
];
const EXPOSURE = ["X0", "XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3", "XS1", "XS2", "XS3"];
const CONCRETE = ["C20/25", "C25/30", "C30/37", "C35/45", "C40/50", "C45/55", "C50/60"];
const STEEL = ["B500", "B460"];
const BAR_DIAS = [12, 16, 20, 25, 32];
const LINK_DIAS = [6, 8, 10, 12];
const BUILDING_USES = [
  "office", "residential", "corridor", "stairs", "retail", "shopping_mall",
  "hospital_ward", "school_classroom", "library_reading", "library_stack",
  "parking_cars", "storage_light", "storage_heavy", "gymnasium", "balcony",
  "plant_room", "roof_no_access", "roof_access",
];

// Design actions are never typed in. N_Ed comes from the take-down and the
// first-order moments from the sub-frame, so there is no Moments step at all.
const STEPS_FULL = ["Column", "Section", "Slenderness", "Floors", "Review"];
const STEPS_AXIAL = STEPS_FULL;

const beamDefault = () => ({
  width_m: "0.23", depth_m: "0.45",
  wall_present: false, wall_thickness_m: "0.15",
  wall_density_kN_per_m3: "", wall_opening_ratio: "0",
});
const floorDefault = (use, imposed, walls) => ({
  building_use: use, slab_thickness_m: "0.15",
  finishes_kN_per_m2: "1.0", services_kN_per_m2: "0.5", partitions_kN_per_m2: "1.0",
  imposed_override_kN_per_m2: imposed,
  beam_x: { ...beamDefault(), wall_present: walls },
  beam_y: { ...beamDefault(), wall_present: walls },
});

const DEFAULTS = {
  column_id: "C1", column_type: "biaxial", uniaxial_axis: "x", design_code: "EC2",
  end_condition: "fixed-fixed", bracing: "braced",
  storey_height_m: "3.5",

  b_mm: "300", h_mm: "500",
  left_x_m: "4.0", right_x_m: "5.0", top_y_m: "3.5", bottom_y_m: "3.5",

  // 4, not 8. Auto-size treats this count as a floor rather than a
  // starting suggestion, so a default of 8 would stop it from ever
  // proposing a smaller cage to anyone who left the field alone.
  main_bar_dia_mm: 20, n_bars_total: "4", link_dia_mm: 8,

  concrete_grade: "C25/30", steel_grade: "B500",
  concrete_density_kN_per_m3: "25", masonry_density_kN_per_m3: "20",

  exposure_class: "XC1", delta_c_dev_mm: "10", cover_mode: "derived",
  clear_cover_override_mm: "35",

  el_method: "idealised", clear_height_m: "",
  k1_x: "0.1", k2_x: "1.0", k1_y: "0.1", k2_y: "1.0",
  l0_x_mm: "", l0_y_mm: "",

  autosize_bars: false,
  include_min_eccentricity: true,
  include_geometric_imperfections: true,
  effective_creep_ratio: "2.0",
  use_default_A_B: true,

  base_fixed: false,
  cracked_beam_stiffness: true,
  // Both blank by design: the backend applies 1/6 and 300 mm on its own when
  // these are omitted, so an empty box here means "use that default", not zero.
  crank_max_slope: "",
  crank_zone_mm: "",

  load_mode: "takedown",              // takedown | direct
  // In direct mode: "ends" sends first order end moments and lets the engine
  // add imperfections and second order; "final" sends M_Ed already complete.
  // Without this, direct mode sent no end moments at all, so factor C in
  // lambda_lim always fell back to its 0.7 default and columns were
  // over-classified as slender.
  direct_moment_mode: "ends",         // ends | final
  NEd_override_kN: "",

  number_of_typical_floors: "3",
  typical_floor: floorDefault("office", "3.0", true),
  roof_floor: floorDefault("roof_no_access", "0.75", false),

  // Printed on the design basis page of the report. Blank stays blank.
  designer_name: "", designer_qualifications: "",
  checked_by: "", checker_qualifications: "",
  stability_responsible: "",
  independent_check: "",          // "" | "required" | "completed"; never set for the user

  // Per-storey edits, keyed by level name. Absent means "inherit".
  levelEdits: {},
};

/*
 * Python's round() sends an exact half to the even neighbour; Math.round sends
 * it up. The engine uses round(), so the preview must too. Otherwise six bars
 * in a square section, where the ratio lands exactly on 2.5, are drawn rotated
 * against the cage the engine actually builds.
 */
const roundHalfEven = (x) => {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
};

/* engine's bar distribution, mirrored so the preview shows the real cage */
function distributeBars(nTotal, b, h) {
  let n = Math.max(4, parseInt(nTotal) || 4);
  if (n % 2 === 1) n += 1;
  const s = n / 2 + 2;
  let nH = roundHalfEven((s * h) / (b + h));
  nH = Math.max(2, Math.min(s - 2, nH));
  return { nB: s - nH, nH, used: 2 * (s - nH) + 2 * nH - 4 };
}

const numOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/*
 * A storey's total and its b-face count fix its h-face count. Corners are
 * shared, so 2*nB + 2*nH - 4 = total, which leaves one free number once the
 * total is chosen. Six bars can only be 2 on the b-face and 3 on the h-face,
 * or 3 and 2.
 */
function faceSplit(total, nBInput) {
  let n = Math.max(4, parseInt(total) || 4);
  if (n % 2 === 1) n += 1;
  const s = n / 2 + 2;
  const hi = s - 2;
  const nB = parseInt(nBInput);
  if (!Number.isFinite(nB)) return { total: n, hi, nB: null, nH: null, ok: false };
  return { total: n, hi, nB, nH: s - nB, ok: nB >= 2 && nB <= hi };
}

/* What is wrong with a ticked storey's face split, or null if nothing is. */
function levelFaceProblem(form, lvl) {
  const e = form.levelEdits[lvl];
  if (!e || !e.custom || !e._customFaces) return null;
  const total = numOrNull(e.n_bars_total) ?? parseInt(form.n_bars_total);
  const f = faceSplit(total, e.n_bars_b_face);
  if (f.nB === null) return "enter how many bars go on the b-face";
  if (!f.ok) return `${f.total} bars allow between 2 and ${f.hi} on the b-face`;
  return null;
}

export default function ColumnInput() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return DEFAULTS;
      // A draft saved before the face split moved to Step 4 still carries
      // custom_faces / n_bars_b_face / n_bars_h_face at the top level, and a
      // spread merge lets those stale keys beat the new defaults. Drop them
      // on the way in rather than bumping DRAFT_KEY, so the rest survives.
      const { custom_faces, n_bars_b_face, n_bars_h_face, ...rest } = JSON.parse(saved);
      // A storey ticked for a face split before the total came back holds a
      // b-face and an h-face and no total. Turn that into a total plus a
      // b-face count, so the storey opens as the cage the engineer entered.
      if (rest.levelEdits) {
        const migrated = {};
        for (const [k, v] of Object.entries(rest.levelEdits)) {
          if (v && v._customFaces && v.n_bars_h_face !== undefined) {
            const { n_bars_h_face: hFace, ...keep } = v;
            const nb = parseInt(v.n_bars_b_face), nh = parseInt(hFace);
            migrated[k] = nb >= 2 && nh >= 2
              ? { ...keep, n_bars_total: String(2 * (nb + nh) - 4) } : keep;
          } else migrated[k] = v;
        }
        rest.levelEdits = migrated;
      }
      return { ...DEFAULTS, ...rest };
    } catch { return DEFAULTS; }
  });
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* private mode */ }
  }, [form]);


  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFloor = (which, patch) => setForm((f) => ({ ...f, [which]: { ...f[which], ...patch } }));
  // Per-storey edits. `which` is the level name.
  const setLevel = (lvl, patch) =>
    setForm((f) => ({ ...f, levelEdits: { ...f.levelEdits, [lvl]: { ...(f.levelEdits[lvl] || {}), ...patch } } }));
  const setLevelFloor = (lvl, patch) =>
    setForm((f) => {
      const cur = f.levelEdits[lvl] || {};
      return { ...f, levelEdits: { ...f.levelEdits, [lvl]: { ...cur, floor: { ...(cur.floor || {}), ...patch } } } };
    });
  const setLevelBeam = (lvl, axis, patch) =>
    setForm((f) => {
      const cur = f.levelEdits[lvl] || {};
      const fl = cur.floor || {};
      return { ...f, levelEdits: { ...f.levelEdits, [lvl]: { ...cur, floor: { ...fl, [axis]: { ...(fl[axis] || {}), ...patch } } } } };
    });

  const setBeam = (which, axis, patch) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [axis]: { ...f[which][axis], ...patch } } }));

  const isAxial = form.column_type === "axial";
  const STEPS = isAxial ? STEPS_AXIAL : STEPS_FULL;
  const stepName = (i) => STEPS[i];

  // Switching to an axial column shortens the flow; clamp so the current
  // index cannot point past the end and render nothing.
  useEffect(() => {
    setStep((cur) => Math.min(cur, STEPS.length - 1));
    setMaxReached((m) => Math.min(m, STEPS.length - 1));
  }, [STEPS.length]);
  const isBiaxial = form.column_type === "biaxial";
  const isUniaxial = form.column_type === "uniaxial";
  const uniAx = form.uniaxial_axis === "y" ? "y" : "x";
  const directLoad = form.load_mode === "direct";
  const useFinalMEd = directLoad && form.direct_moment_mode === "final";

  // With a direct N_Ed the engine works at a single level it names "Design",
  // so the moment table keys must match that.
  const levels = useMemo(() => {
    if (form.load_mode === "direct") return ["Design"];
    const n = parseInt(form.number_of_typical_floors) || 0;
    const arr = [];
    for (let i = n; i >= 1; i--) arr.push(`Typical_Floor_${i}`);
    arr.push("Roof");
    return arr;
  }, [form.number_of_typical_floors, form.load_mode]);

  const layout = useMemo(
    () => distributeBars(form.n_bars_total, parseFloat(form.b_mm) || 1, parseFloat(form.h_mm) || 1),
    [form.n_bars_total, form.b_mm, form.h_mm]
  );

  /* ---------- per-step validity ---------- */
  const pos = (v) => parseFloat(v) > 0;
  const stepValid = (i) => {
    const s = STEPS_FULL.indexOf(STEPS[i]);
    if (s === 0) return !!form.column_id.trim() && pos(form.storey_height_m);
    if (s === 1) {
      const base = pos(form.b_mm) && pos(form.h_mm) && (parseInt(form.n_bars_total) || 0) >= 4;
      const trib = directLoad || (pos(form.left_x_m) && pos(form.right_x_m) && pos(form.top_y_m) && pos(form.bottom_y_m));
      const cover = form.cover_mode === "derived" || pos(form.clear_cover_override_mm);
      return base && trib && cover;
    }
    if (s === 2) {
      if (form.el_method === "k_factors")
        return [form.k1_x, form.k2_x, form.k1_y, form.k2_y].every((v) => numOrNull(v) !== null);
      if (form.el_method === "direct") return pos(form.l0_x_mm) && pos(form.l0_y_mm);
      return true;
    }
    if (s === 3) {
      if (directLoad) return pos(form.NEd_override_kN);
      if ((parseInt(form.number_of_typical_floors) || 0) < 1) return false;
      return !levels.some((l) => levelFaceProblem(form, l));
    }
    return true;
  };
  // Say what is wrong, not just which step. A face split that does not add up
  // sits inside a collapsed storey row, so "complete Floors" alone would leave
  // the engineer hunting for it.
  const invalidMessage = (bad, doing) => {
    if (STEPS[bad] === "Floors") {
      const found = levels
        .map((l) => { const m = levelFaceProblem(form, l); return m ? `${l.replace(/_/g, " ")}: ${m}.` : null; })
        .find(Boolean);
      if (found) return found;
    }
    return `Complete "${STEPS[bad]}" before ${doing}.`;
  };
  const firstInvalidBefore = (target) => {
    for (let s = 0; s < target; s++) if (!stepValid(s)) return s;
    return -1;
  };
  const goTo = (target) => {
    setError(null);
    if (target <= step) { setStep(target); return; }
    const bad = firstInvalidBefore(target);
    if (bad === -1) { setStep(target); setMaxReached((m) => Math.max(m, target)); }
    else { setStep(bad); setError(invalidMessage(bad, "moving on")); }
  };

  /* ---------- payload ---------- */
  const buildRequest = () => {
    const f = form;
    const beam = (b) => ({
      width_m: parseFloat(b.width_m),
      depth_m: parseFloat(b.depth_m),
      wall: {
        present: !!b.wall_present,
        thickness_m: numOrNull(b.wall_thickness_m) ?? 0.15,
        density_kN_per_m3: numOrNull(b.wall_density_kN_per_m3),
        opening_ratio: numOrNull(b.wall_opening_ratio) ?? 0,
      },
    });
    const floor = (fl) => ({
      building_use: fl.building_use,
      slab_thickness_m: parseFloat(fl.slab_thickness_m),
      finishes_kN_per_m2: parseFloat(fl.finishes_kN_per_m2),
      services_kN_per_m2: parseFloat(fl.services_kN_per_m2),
      partitions_kN_per_m2: parseFloat(fl.partitions_kN_per_m2),
      imposed_override_kN_per_m2: numOrNull(fl.imposed_override_kN_per_m2),
      beam_x: beam(fl.beam_x),
      beam_y: beam(fl.beam_y),
    });

    // Moments are derived by the sub-frame, never sent from here.
    const M01x = {}, M02x = {}, M01y = {}, M02y = {};

    // Per-storey edits. Only levels ticked "custom" are sent, and within
    // those only the fields actually filled in -- everything else inherits,
    // which is what the backend's None-means-fall-back contract expects.
    const levelsOut = {};
    if (!directLoad) {
      for (const lvl of levels) {
        const e = f.levelEdits[lvl];
        if (!e || !e.custom) continue;
        const spec = {};
        const pairs = [["b_mm", e.b_mm], ["h_mm", e.h_mm],
                       ["main_bar_dia_mm", e.main_bar_dia_mm],
                       ["link_dia_mm", e.link_dia_mm],
                       ["storey_height_m", e.storey_height_m]];
        // A total and a face split describe the same cage, so only one goes
        // out. With faces ticked, the engineer's total and b-face count fix
        // the h-face, and the request carries both face counts. Run is blocked
        // while the split does not add up, so this never sends half a pair.
        if (e._customFaces) {
          const total = numOrNull(e.n_bars_total) ?? parseInt(f.n_bars_total);
          const split = faceSplit(total, e.n_bars_b_face);
          if (split.ok) {
            spec.n_bars_b_face = split.nB;
            spec.n_bars_h_face = split.nH;
          }
        } else {
          pairs.push(["n_bars_total", e.n_bars_total]);
        }
        for (const [k, v] of pairs) {
          const n = numOrNull(v);
          if (n !== null) spec[k] = k === "n_bars_total" ? parseInt(n) : n;
        }
        if (e._ownLoads) {
          const base = f.typical_floor;
          const fl = e.floor || {};
          // The per-storey beam block holds overrides only, so an empty box
          // must fall back to the typical floor rather than become NaN.
          const bm = (which) => {
            const b0 = base[which], own = fl[which] || {};
            const pick = (k, dflt) => {
              const v = numOrNull(own[k]);
              if (v !== null) return v;
              const t = numOrNull(b0[k]);
              return t !== null ? t : dflt;
            };
            return {
              width_m: pick("width_m", 0.23),
              depth_m: pick("depth_m", 0.45),
              wall: {
                present: own.wall_present === undefined ? !!b0.wall_present : !!own.wall_present,
                thickness_m: pick("wall_thickness_m", 0.15),
                // null here means "use the masonry density from step 1"
                density_kN_per_m3: numOrNull(own.wall_density_kN_per_m3)
                  ?? numOrNull(b0.wall_density_kN_per_m3),
                opening_ratio: pick("wall_opening_ratio", 0),
              },
            };
          };
          spec.floor = {
            building_use: fl.building_use ?? base.building_use,
            slab_thickness_m: numOrNull(fl.slab_thickness_m) ?? parseFloat(base.slab_thickness_m),
            finishes_kN_per_m2: numOrNull(fl.finishes_kN_per_m2) ?? parseFloat(base.finishes_kN_per_m2),
            services_kN_per_m2: numOrNull(fl.services_kN_per_m2) ?? parseFloat(base.services_kN_per_m2),
            partitions_kN_per_m2: numOrNull(fl.partitions_kN_per_m2) ?? parseFloat(base.partitions_kN_per_m2),
            imposed_override_kN_per_m2: numOrNull(fl.imposed_override_kN_per_m2)
              ?? numOrNull(base.imposed_override_kN_per_m2),
            beam_x: bm("beam_x"),
            beam_y: bm("beam_y"),
          };
        }
        if (Object.keys(spec).length) levelsOut[lvl] = spec;
      }
    }

    const el = { method: f.el_method, clear_height_m: numOrNull(f.clear_height_m) };
    if (f.el_method === "k_factors") {
      el.k1_x = numOrNull(f.k1_x); el.k2_x = numOrNull(f.k2_x);
      el.k1_y = numOrNull(f.k1_y); el.k2_y = numOrNull(f.k2_y);
    } else if (f.el_method === "direct") {
      el.l0_x_mm = numOrNull(f.l0_x_mm); el.l0_y_mm = numOrNull(f.l0_y_mm);
    }

    return {
      column_id: f.column_id,
      column_type: f.column_type,
      uniaxial_axis: uniAx,
      design_code: f.design_code,
      design_basis: {
        designer_name: (f.designer_name || "").trim() || null,
        designer_qualifications: (f.designer_qualifications || "").trim() || null,
        checked_by: (f.checked_by || "").trim() || null,
        checker_qualifications: (f.checker_qualifications || "").trim() || null,
        stability_responsible: (f.stability_responsible || "").trim() || null,
        independent_check: f.independent_check || null,
      },
      end_condition: f.end_condition,
      braced: f.bracing === "braced",
      geometry: {
        b_mm: parseFloat(f.b_mm), h_mm: parseFloat(f.h_mm),
        storey_height_m: parseFloat(f.storey_height_m),
        left_x_m: parseFloat(f.left_x_m) || 0, right_x_m: parseFloat(f.right_x_m) || 0,
        top_y_m: parseFloat(f.top_y_m) || 0, bottom_y_m: parseFloat(f.bottom_y_m) || 0,
      },
      effective_length: el,
      levels: levelsOut,
      ...(numOrNull(f.crank_max_slope) !== null
        ? { crank_max_slope: numOrNull(f.crank_max_slope) } : {}),
      ...(numOrNull(f.crank_zone_mm) !== null
        ? { crank_zone_mm: numOrNull(f.crank_zone_mm) } : {}),
      frame: {
        derive_moments: true,
        base_fixed: !!f.base_fixed,
        cracked_beam_stiffness: !!f.cracked_beam_stiffness,
      },
      analysis: {
        autosize_bars: !!f.autosize_bars,
        include_min_eccentricity: !!f.include_min_eccentricity,
        include_geometric_imperfections: !!f.include_geometric_imperfections,
        effective_creep_ratio: numOrNull(f.effective_creep_ratio) ?? 2.0,
        use_default_A_B: !!f.use_default_A_B,
      },
      reinforcement: {
        main_bar_dia_mm: parseFloat(f.main_bar_dia_mm),
        n_bars_total: parseInt(f.n_bars_total),
        // The base column always lets the engine distribute now; face
        // splits are per storey. The schema still accepts these two, so a
        // payload saved before the move keeps working.
        n_bars_b_face: null,
        n_bars_h_face: null,
        link_dia_mm: parseFloat(f.link_dia_mm),
      },
      materials: {
        concrete_grade: f.concrete_grade, steel_grade: f.steel_grade,
        concrete_density_kN_per_m3: numOrNull(f.concrete_density_kN_per_m3) ?? 25,
        masonry_density_kN_per_m3: numOrNull(f.masonry_density_kN_per_m3) ?? 20,
      },
      durability: {
        exposure_class: f.exposure_class,
        delta_c_dev_mm: numOrNull(f.delta_c_dev_mm) ?? 10,
        clear_cover_override_mm:
          f.cover_mode === "manual" ? numOrNull(f.clear_cover_override_mm) : null,
      },
      number_of_typical_floors: directLoad ? 0 : parseInt(f.number_of_typical_floors),
      typical_floor: floor(f.typical_floor),
      roof_floor: floor(f.roof_floor),
      M01x_kNm: M01x, M02x_kNm: M02x, M01y_kNm: M01y, M02y_kNm: M02y,
      NEd_override_kN: directLoad ? numOrNull(f.NEd_override_kN) : null,
      MEdx_override_kNm: null,
      MEdy_override_kNm: null,
    };
  };

  const run = async () => {
    const bad = firstInvalidBefore(STEPS.length - 1);
    if (bad !== -1) { setStep(bad); setError(invalidMessage(bad, "running")); return; }
    setBusy(true); setError(null);
    try {
      const result = await columnAPI.startDesign(buildRequest());
      setBusy(false);
      navigate("/column-results", { state: { designResult: result } });
    } catch (e) {
      setBusy(false);
      setError(e.message === "Failed to fetch"
        ? "Cannot reach the design engine. If you run it on your own machine, check the backend terminal and that nothing else is using its port. On the hosted version it may be waking up, so try again in a minute."
        : e.message);
    }
  };

  const reset = () => {
    if (!window.confirm("Reset all fields to defaults?")) return;
    setForm(DEFAULTS); setStep(0); setMaxReached(0); setError(null);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      <header className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2F44] text-white"><FiHome size={15} /></div>
          <div>
            <div className={`text-sm font-bold ${MAIN}`}>Column Input (EC2)</div>
            <div className={`text-[11px] ${SUB}`}>EN 1992-1-1 · kN, mm, m</div>
          </div>
        </div>
        <button onClick={reset} className={`text-xs ${SUB} hover:underline`}>Reset</button>
      </header>

      <div className="border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1f2937] px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          {STEPS.map((label, i) => {
            const done = i < step && stepValid(i);
            const active = i === step;
            const reachable = i <= maxReached || i <= step;
            return (
              <React.Fragment key={label}>
                <button type="button" onClick={() => goTo(i)} disabled={!reachable && i > step}
                  className={`flex items-center gap-2 ${reachable || i <= step ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    active ? "bg-[#0A2F44] text-white"
                      : done ? "bg-green-500 text-white"
                      : "bg-[#e2e8f0] dark:bg-[#334155] text-[#64748b] dark:text-[#94a3b8]"}`}>
                    {done ? <FiCheck size={14} /> : i + 1}
                  </span>
                  <span className={`hidden text-xs font-medium sm:block ${active ? "text-[#0A2F44] dark:text-[#66a4c2]" : SUB}`}>{label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-[#e2e8f0] dark:bg-[#334155]" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <DesignProgressBar active={busy} />

        {stepName(step) === "Column" && <StepColumn form={form} set={set} directLoad={directLoad} isUniaxial={isUniaxial} />}
        {stepName(step) === "Section" && <StepSection form={form} set={set} layout={layout} directLoad={directLoad} />}
        {stepName(step) === "Slenderness" && <StepSlenderness form={form} set={set} />}
        {stepName(step) === "Floors" && <StepFloors form={form} set={set} setFloor={setFloor} setBeam={setBeam} setLevel={setLevel} setLevelFloor={setLevelFloor} setLevelBeam={setLevelBeam} levels={levels} directLoad={directLoad} isAxial={isAxial} />}
        {stepName(step) === "Review" && <StepReview form={form} levels={levels} layout={layout} isAxial={isAxial} isBiaxial={isBiaxial} directLoad={directLoad} useFinalMEd={useFinalMEd} />}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className={`flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm dark:border-[#334155] ${SUB} disabled:opacity-40`}>
            <FiChevronLeft size={15} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => goTo(step + 1)}
              className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white hover:bg-[#082636]">
              Next <FiChevronRight size={15} />
            </button>
          ) : (
            <button onClick={run} disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white hover:bg-[#082636] disabled:opacity-50">
              {busy ? <FiLoader className="animate-spin" size={15} /> : null} Run Column Design
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= STEP 1 ================= */
function StepColumn({ form, set, directLoad, isUniaxial }) {
  return (
    <div className="space-y-5">
      <Card title="Column & Classification">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LABEL}>Column ID</label><input className={INPUT} value={form.column_id} onChange={(e) => set({ column_id: e.target.value })} /></div>
          <div><label className={LABEL}>Column Type</label><Dropdown value={form.column_type} onChange={(v) => set({ column_type: v })} options={COLUMN_TYPES} /></div>
          <div><label className={LABEL}>Design Code</label>
            <div className="flex h-[38px] items-center rounded-lg border border-[#e2e8f0] px-3 font-mono text-sm dark:border-[#334155]">
              <span className={MAIN}>EN 1992-1-1 (Eurocode 2)</span>
            </div>
          </div>
          <div><label className={LABEL}>Bracing</label><Dropdown value={form.bracing} onChange={(v) => set({ bracing: v })} options={BRACING} /></div>
          <div><label className={LABEL}>End Condition</label><Dropdown value={form.end_condition} onChange={(v) => set({ end_condition: v })} options={END_CONDITIONS} /></div>
          <Num label="Storey Height" unit="m" value={form.storey_height_m} onChange={(v) => set({ storey_height_m: v })} step="0.1" />
        </div>
        {isUniaxial && (
          <>
            <p className={`mt-4 mb-1 text-xs font-semibold ${SUB}`}>Which axis carries the moment?</p>
            <div className="max-w-md">
              <Dropdown value={form.uniaxial_axis} onChange={(v) => set({ uniaxial_axis: v })} options={UNIAXIAL_AXES} />
            </div>
            <Note>
              A uniaxial column must say which way it bends. The other axis still gets minimum
              eccentricity and, if slender, a second-order moment — it is checked, just not for an
              applied moment.
            </Note>
          </>
        )}
      </Card>

      <Card title="Source of Design Actions">
        <div className="flex flex-wrap gap-2">
          <Pill on={!directLoad} onClick={() => set({ load_mode: "takedown" })}>Load take-down from building</Pill>
          <Pill on={directLoad} onClick={() => set({ load_mode: "direct" })}>Enter N_Ed directly</Pill>
        </div>
        <Note>
          {directLoad
            ? "N_Ed is entered on the Loads step. Tributary spans and floor build-ups are not used, so leave them at their defaults."
            : "N_Ed is built up from tributary area and floor loads. Fill in the tributary spans on the next step."}
        </Note>
      </Card>

      <Card title="Materials">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LABEL}>Concrete Grade</label><Dropdown value={form.concrete_grade} onChange={(v) => set({ concrete_grade: v })} options={CONCRETE} /></div>
          <div><label className={LABEL}>Steel Grade</label><Dropdown value={form.steel_grade} onChange={(v) => set({ steel_grade: v })} options={STEEL} /></div>
          <Num label="Concrete density" unit="kN/m³" value={form.concrete_density_kN_per_m3} onChange={(v) => set({ concrete_density_kN_per_m3: v })} step="0.5" />
          <Num label="Masonry density" unit="kN/m³" value={form.masonry_density_kN_per_m3} onChange={(v) => set({ masonry_density_kN_per_m3: v })} step="0.5" />
        </div>
      </Card>

      <Card title="Design Basis (optional)">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LABEL}>Designed by</label>
            <input className={INPUT} value={form.designer_name} onChange={(e) => set({ designer_name: e.target.value })} /></div>
          <div><label className={LABEL}>Designer's qualifications</label>
            <input className={INPUT} value={form.designer_qualifications} onChange={(e) => set({ designer_qualifications: e.target.value })} /></div>
          <div><label className={LABEL}>Checked by</label>
            <input className={INPUT} value={form.checked_by} onChange={(e) => set({ checked_by: e.target.value })} /></div>
          <div><label className={LABEL}>Checker's qualifications</label>
            <input className={INPUT} value={form.checker_qualifications} onChange={(e) => set({ checker_qualifications: e.target.value })} /></div>
        </div>
        <div className="mt-4">
          <label className={LABEL}>Responsible for the stability of the structure</label>
          <input className={INPUT} value={form.stability_responsible} onChange={(e) => set({ stability_responsible: e.target.value })} />
        </div>
        <div className="mt-4">
          <label className={LABEL}>Independent check</label>
          <div className="flex flex-wrap gap-2">
            <Pill on={!form.independent_check} onClick={() => set({ independent_check: "" })}>Not stated</Pill>
            <Pill on={form.independent_check === "required"} onClick={() => set({ independent_check: "required" })}>Required</Pill>
            <Pill on={form.independent_check === "completed"} onClick={() => set({ independent_check: "completed" })}>Completed</Pill>
          </div>
        </div>
        <Note>
          These are printed on the first page of the Detailed Report. Left blank, the report says
          "not entered". Nothing is filled in for you: who designed, who checked and whether an
          independent check is required or done are your statements, and building control asks
          for them with a submission. The independent check is never ticked automatically.
        </Note>
      </Card>
    </div>
  );
}

/* ================= STEP 2 ================= */
function StepSection({ form, set, layout, directLoad }) {
  const manual = form.cover_mode === "manual";
  const nTyped = parseInt(form.n_bars_total) || 0;
  return (
    <div className="space-y-5">
      <Card title="Section & Reinforcement">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[200px_1fr]">
          <SectionSVG b={parseFloat(form.b_mm) || 0} h={parseFloat(form.h_mm) || 0}
            cover={manual ? parseFloat(form.clear_cover_override_mm) || 0 : 30}
            dia={parseFloat(form.main_bar_dia_mm) || 16} link={parseFloat(form.link_dia_mm) || 8}
            nB={layout.nB} nH={layout.nH} />
          <div className="grid grid-cols-2 gap-4">
            <Num label="Width b" unit="mm" value={form.b_mm} onChange={(v) => set({ b_mm: v })} step="25" />
            <Num label="Depth h" unit="mm" value={form.h_mm} onChange={(v) => set({ h_mm: v })} step="25" />
            <div><label className={LABEL}>Main bar Ø (mm)</label><Dropdown value={form.main_bar_dia_mm} onChange={(v) => set({ main_bar_dia_mm: v })} options={BAR_DIAS} /></div>
            <div><label className={LABEL}>Link Ø (mm)</label><Dropdown value={form.link_dia_mm} onChange={(v) => set({ link_dia_mm: v })} options={LINK_DIAS} /></div>
            <Num label="Total number of bars" value={form.n_bars_total} onChange={(v) => set({ n_bars_total: v })} step="2" />
            <div />
          </div>
        </div>

        {nTyped >= 4 && (
          <p className={`mt-3 text-xs ${SUB}`}>
            Distributed as {layout.nB} per b-face and {layout.nH} per h-face, corners shared, giving {layout.used} bars.
            {layout.used !== nTyped && ` Rounded up from ${nTyped} to keep the cage symmetric.`}
          </p>
        )}
        <Note>
          Placing the bars face by face is a per-storey setting, on the Floors step.
          Tick a storey there and the two face fields appear for that storey alone.
        </Note>
      </Card>

      <Card title="Cover & Durability">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={LABEL}>Exposure Class</label><Dropdown value={form.exposure_class} onChange={(v) => set({ exposure_class: v })} options={EXPOSURE} /></div>
          <Num label="Δc_dev" unit="mm" value={form.delta_c_dev_mm} onChange={(v) => set({ delta_c_dev_mm: v })} step="5" disabled={manual} />
        </div>
        <div className="mt-3 flex gap-2">
          <Pill on={!manual} onClick={() => set({ cover_mode: "derived" })}>Derive c_nom from exposure class</Pill>
          <Pill on={manual} onClick={() => set({ cover_mode: "manual" })}>Enter cover directly</Pill>
        </div>
        {manual ? (
          <div className="mt-3 max-w-[240px]">
            <Num label="Nominal cover c_nom" unit="mm" value={form.clear_cover_override_mm} onChange={(v) => set({ clear_cover_override_mm: v })} step="5" />
          </div>
        ) : (
          <Note>c_nom = c_min + Δc_dev, with c_min = max(bar Ø, link Ø, c_min,dur, 10 mm). Table 4.4N gives 15 mm for XC1 at structural class S4.</Note>
        )}
      </Card>

      {!directLoad && (
        <Card title="Tributary Spans">
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[200px_1fr]">
            <TributarySVG lx={parseFloat(form.left_x_m)} rx={parseFloat(form.right_x_m)} ty={parseFloat(form.top_y_m)} by={parseFloat(form.bottom_y_m)} />
            <div>
              <div className="grid grid-cols-2 gap-4">
                <Num label="Left span (x)" unit="m" value={form.left_x_m} onChange={(v) => set({ left_x_m: v })} step="0.5" />
                <Num label="Right span (x)" unit="m" value={form.right_x_m} onChange={(v) => set({ right_x_m: v })} step="0.5" />
                <Num label="Top span (y)" unit="m" value={form.top_y_m} onChange={(v) => set({ top_y_m: v })} step="0.5" />
                <Num label="Bottom span (y)" unit="m" value={form.bottom_y_m} onChange={(v) => set({ bottom_y_m: v })} step="0.5" />
              </div>
              <Note>Four beams frame into the column. Each delivers w·L/2, so the x pair contributes w·(left + right)/2 and the y pair w·(top + bottom)/2. Beam spans come from these values, not from a separate field.</Note>
              <SpanSymmetryHint form={form} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Unequal spans either side of a column give unbalanced beam end moments,
 * which is the usual source of column moment. Equal spans therefore sit oddly
 * with a biaxial design, and this flags that.
 *
 * It is a warning and not a block on purpose. Moments also come from pattern
 * loading on equal spans, from wind, and from unequal beam sizes, so equal
 * spans are perfectly legitimate. And in this engine the tributary spans only
 * produce N_Ed — the moments are entered separately — so blocking here would
 * reject valid input without changing any result.
 */
function SpanSymmetryHint({ form }) {
  const eq = (a, b) => {
    const x = parseFloat(a), y = parseFloat(b);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
  };
  const xSym = eq(form.left_x_m, form.right_x_m);
  const ySym = eq(form.top_y_m, form.bottom_y_m);
  const type = form.column_type;
  let msg = null;

  if (type === "biaxial" && xSym && ySym) {
    msg = "Both span pairs are equal, which usually gives a balanced frame and little applied moment either way. If the moments come from pattern loading or wind rather than geometry that is fine — otherwise check whether this column is really biaxial.";
  } else if (type === "biaxial" && (xSym || ySym)) {
    msg = `The ${xSym ? "x" : "y"} spans are equal, so that direction is balanced. A biaxial design expects moment about both axes; confirm where the ${xSym ? "x" : "y"} moment comes from.`;
  } else if (type === "uniaxial") {
    const bendAx = form.uniaxial_axis === "y" ? "y" : "x";
    const bendSym = bendAx === "x" ? xSym : ySym;
    if (bendSym) {
      msg = `You are designing for moment about ${bendAx}, but the ${bendAx} spans are equal, so that direction is balanced. Check the axis selection on step 1.`;
    }
  } else if (type === "axial" && (!xSym || !ySym)) {
    msg = "The spans are unequal, which normally produces a moment at the column. An axial design ignores applied moments and uses minimum eccentricity only — consider uniaxial or biaxial.";
  }

  if (!msg) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:bg-amber-900/20">
      <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" size={14} />
      <p className="text-xs text-amber-800 dark:text-amber-300">{msg}</p>
    </div>
  );
}

/* ================= STEP 3 ================= */
function StepSlenderness({ form, set }) {
  const m = form.el_method;
  return (
    <div className="space-y-5">
      <Card title="Effective Length l₀">
        <div className="max-w-md"><label className={LABEL}>Method</label>
          <Dropdown value={m} onChange={(v) => set({ el_method: v })} options={EL_METHODS} />
        </div>
        <div className="mt-4 max-w-[240px]">
          <Num label="Clear height between restraints" unit="m" value={form.clear_height_m} onChange={(v) => set({ clear_height_m: v })} step="0.05" />
          <p className={`mt-1 text-[10px] ${SUB}`}>Leave blank to use the storey height.</p>
        </div>

        {m === "idealised" && <Note>l₀ = K · l, with K taken from the end condition on step 1. Quick, but it cannot give a different l₀ about each axis.</Note>}

        {m === "k_factors" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Num label="k₁ (x)" value={form.k1_x} onChange={(v) => set({ k1_x: v })} step="0.05" />
              <Num label="k₂ (x)" value={form.k2_x} onChange={(v) => set({ k2_x: v })} step="0.05" />
              <Num label="k₁ (y)" value={form.k1_y} onChange={(v) => set({ k1_y: v })} step="0.05" />
              <Num label="k₂ (y)" value={form.k2_y} onChange={(v) => set({ k2_y: v })} step="0.05" />
            </div>
            <Note>Joint flexibility k = (θ/M)·(EI/l) at each end. EN 1992-1-1 Cl. 5.8.3.2 treats k = 0 as theoretical only, so values below 0.1 are raised to 0.1. A base on a footing designed to resist moment takes k₂ = 1.0.</Note>
          </>
        )}

        {m === "direct" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 md:max-w-md">
              <Num label="l₀ about x" unit="mm" value={form.l0_x_mm} onChange={(v) => set({ l0_x_mm: v })} step="50" />
              <Num label="l₀ about y" unit="mm" value={form.l0_y_mm} onChange={(v) => set({ l0_y_mm: v })} step="50" />
            </div>
            <Note>Use this when l₀ comes from a frame analysis or a separate stability study.</Note>
          </>
        )}
      </Card>

      <Card title="Frame &amp; Moment Derivation">
        <div className="space-y-3">
          <Check label="Foundation designed to resist moment (fixed base)" checked={form.base_fixed} onChange={(v) => set({ base_fixed: v })} />
          <Check label="Halve beam stiffness for cracking when sharing the joint moment" checked={form.cracked_beam_stiffness} onChange={(v) => set({ cracked_beam_stiffness: v })} />
        </div>
        <Note>
          Halving beam stiffness raises the column's share of the out-of-balance moment, so it
          is the conservative choice and matches EC2 practice. Published BS 8110 examples
          usually take the full I/L; untick to compare against one.
        </Note>
      </Card>

      <Card title="Reinforcement Selection">
        <Check label="Let the engine choose the bars" checked={form.autosize_bars}
          onChange={(v) => set({ autosize_bars: v })} />
        <Note>
          {form.autosize_bars
            ? "Each storey gets the smallest cage that passes every check, within the section you set. Sections are never changed — if nothing fits, the result says the section is too small. The bars on step 2 become a starting point rather than the design, and the results page lists every option that works so you can take a bigger cage for bar continuity."
            : "The engine checks the bars you specified on step 2 and on any storey you edited. It will not tell you if they are larger than necessary — tick this to have it propose a size instead."}
        </Note>
      </Card>

      <Card title="Analysis Options">
        <div className="space-y-3">
          <Check label="Include minimum eccentricity e₀ = max(h/30, 20 mm)" checked={form.include_min_eccentricity} onChange={(v) => set({ include_min_eccentricity: v })} />
          <Check label="Include geometric imperfections eᵢ = l₀/400 (Cl. 5.2)" checked={form.include_geometric_imperfections} onChange={(v) => set({ include_geometric_imperfections: v })} />
          <Check label="Use code default A = 0.7 and B = 1.1 for λlim" checked={form.use_default_A_B} onChange={(v) => set({ use_default_A_B: v })} />
        </div>
        {!form.use_default_A_B && (
          <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:bg-amber-900/20">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              A and B will be computed from the creep ratio and the provided steel. That raises λlim,
              so more columns classify as short and second-order effects are skipped. Cl. 5.8.3.1 permits
              it, but B needs A_s, which is not known when slenderness is first classified.
            </p>
          </div>
        )}
        <div className="mt-4 max-w-[240px]">
          <Num label="Effective creep ratio φ_ef" value={form.effective_creep_ratio} onChange={(v) => set({ effective_creep_ratio: v })} step="0.1" />
        </div>
      </Card>
    </div>
  );
}

/* ================= STEP 4 ================= */
function StepFloors({ form, set, setFloor, setBeam, setLevel, setLevelFloor, setLevelBeam,
                     levels, directLoad, isAxial }) {
  return (
    <div className="space-y-5">
      {directLoad ? (
        <Card title="Design Actions">
          <div className="max-w-[240px]">
            <Num label="N_Ed" unit="kN" value={form.NEd_override_kN} onChange={(v) => set({ NEd_override_kN: v })} step="10" />
          </div>
          <Note>
            Moments are not entered. The engine derives them from the frame: the beams at
            each joint carry fixed end moments wL²/12, and any out-of-balance is shared
            between the members meeting there in proportion to stiffness.
          </Note>
        </Card>
      ) : (
        <>
          <Card title="Building">
            <div className="max-w-[240px]">
              <Num label="Number of typical floors" value={form.number_of_typical_floors} onChange={(v) => set({ number_of_typical_floors: v })} step="1" />
            </div>
            <Note>
              Set the floor count first, then edit any storey below. Each one starts from the
              typical floor and the section on step 2 — you only fill in what differs.
            </Note>
          </Card>

          <FloorCard title="Typical Floor — the starting point for every storey"
            which="typical_floor" floor={form.typical_floor} setFloor={setFloor} setBeam={setBeam} />
          <FloorCard title="Roof" which="roof_floor" floor={form.roof_floor} setFloor={setFloor} setBeam={setBeam} />

          <Card title="Per-Storey Edits">
            <Note>
              A storey left as "inherits" uses the section and bars from step 2 and the
              template above. Tick a storey to give it its own section, cage or loads.
            </Note>
            <SectionGrowthWarning form={form} levels={levels} />
            <CrankZoneFields form={form} set={set} />
            <div className="mt-3 space-y-2">
              {levels.map((lvl) => (
                <LevelRow key={lvl} lvl={lvl} form={form}
                  setLevel={setLevel} setLevelFloor={setLevelFloor} setLevelBeam={setLevelBeam} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * A column that gets bigger as it goes up is almost always a typo, so this
 * says so rather than blocking it -- there are legitimate reasons (a transfer
 * structure, a setback) and the engine does not care either way.
 */
/**
 * Optional. Left blank, the backend applies its own defaults (1/6 slope,
 * 300 mm zone) -- these boxes only matter once an engineer has checked an
 * actual crank detail and wants to design against that instead.
 */
function CrankZoneFields({ form, set }) {
  return (
    <div className="mt-3 rounded-lg border border-[#e2e8f0] p-3 dark:border-[#334155]">
      <p className={`mb-2 text-xs font-semibold ${MAIN}`}>
        Bar crank limits <span className={`font-normal ${SUB}`}>(optional)</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Num label="Max crank slope, rise:run" value={form.crank_max_slope}
          placeholder="1 / 6 \u2248 0.167" onChange={(v) => set({ crank_max_slope: v })} step="0.01" />
        <Num label="Assumed crank zone" unit="mm" value={form.crank_zone_mm}
          placeholder="300" onChange={(v) => set({ crank_zone_mm: v })} step="10" />
      </div>
      <Note>
        Leave both blank to use the defaults: a 1-in-6 slope over an assumed 300 mm
        above the lap. Change these only once an engineer has checked the actual
        crank detail on this job and it allows something different \u2014 a wider
        zone or a shallower slope lets a bigger section step pass between two
        storeys; tightening either makes the check stricter.
      </Note>
    </div>
  );
}

function SectionGrowthWarning({ form, levels }) {
  const secOf = (lvl) => {
    const e = form.levelEdits[lvl] || {};
    const b = e.custom ? (parseFloat(e.b_mm) || parseFloat(form.b_mm)) : parseFloat(form.b_mm);
    const h = e.custom ? (parseFloat(e.h_mm) || parseFloat(form.h_mm)) : parseFloat(form.h_mm);
    return { b, h, area: b * h };
  };
  const bad = [];
  // `levels` runs top down, so each entry should be no larger than the next.
  for (let i = 0; i < levels.length - 1; i++) {
    const up = secOf(levels[i]), down = secOf(levels[i + 1]);
    if (Number.isFinite(up.area) && Number.isFinite(down.area) && up.area > down.area + 1) {
      bad.push(`${levels[i].replace(/_/g, " ")} (${up.b}×${up.h}) is larger than ${levels[i + 1].replace(/_/g, " ")} (${down.b}×${down.h})`);
    }
  }
  if (!bad.length) return null;
  return (
    <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:bg-amber-900/20">
      <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
        A storey is larger than the one beneath it
      </p>
      <ul className="ml-4 list-disc text-xs text-amber-800 dark:text-amber-300">
        {bad.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        Usually a typo. Leave it if the frame really does that.
      </p>
    </div>
  );
}

function LevelRow({ lvl, form, setLevel, setLevelFloor, setLevelBeam }) {
  const e = form.levelEdits[lvl] || {};
  const custom = !!e.custom;
  const open = !!e._open;
  const label = lvl.replace(/_/g, " ");
  const sec = custom && (e.b_mm || e.h_mm)
    ? `${e.b_mm || form.b_mm}×${e.h_mm || form.h_mm}`
    : `${form.b_mm}×${form.h_mm}`;
  const totalIn = numOrNull(e.n_bars_total) ?? parseInt(form.n_bars_total);
  const split = faceSplit(totalIn, e.n_bars_b_face);
  const problem = levelFaceProblem(form, lvl);
  const barDia = e.main_bar_dia_mm || form.main_bar_dia_mm;
  const bars = custom && e._customFaces
    ? (split.ok
        ? `${split.total}Ø${barDia} (${split.nB}/b, ${split.nH}/h)`
        : `${split.total}Ø${barDia} (faces?)`)
    : custom && (e.n_bars_total || e.main_bar_dia_mm)
      ? `${e.n_bars_total || form.n_bars_total}Ø${barDia}`
      : `${form.n_bars_total}Ø${form.main_bar_dia_mm}`;
  // Ticking starts from the split the engine would have chosen for this
  // storey, so nothing changes until the engineer edits the b-face count.
  const toggleFaces = (on) => {
    if (!on) { setLevel(lvl, { _customFaces: false }); return; }
    const bb = parseFloat(e.b_mm) || parseFloat(form.b_mm) || 1;
    const hh = parseFloat(e.h_mm) || parseFloat(form.h_mm) || 1;
    setLevel(lvl, { _customFaces: true, n_bars_b_face: String(distributeBars(totalIn, bb, hh).nB) });
  };
  const fl = e.floor || {};
  const ownLoads = !!e._ownLoads;

  return (
    <div className={`rounded-lg border ${custom
      ? "border-[#0A2F44] dark:border-[#66a4c2]"
      : "border-[#e2e8f0] dark:border-[#334155]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={custom} className="h-4 w-4 accent-[#0A2F44]"
            onChange={(ev) => setLevel(lvl, { custom: ev.target.checked, _open: ev.target.checked })} />
          <span className={`text-sm font-medium ${MAIN}`}>{label}</span>
        </label>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xs ${SUB}`}>
            {custom ? `${sec} · ${bars}${ownLoads ? " · own loads" : ""}` : "inherits"}
          </span>
          {custom && (
            <button type="button" onClick={() => setLevel(lvl, { _open: !open })}
              className={`text-xs ${SUB} hover:underline`}>{open ? "hide" : "edit"}</button>
          )}
        </div>
      </div>

      {custom && open && (
        <div className="border-t border-[#e2e8f0] px-3 py-3 dark:border-[#334155]">
          <p className={`mb-2 text-xs font-semibold ${SUB}`}>
            Section &amp; bars — greyed numbers are inherited from step 2
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Num label="b" unit="mm" value={e.b_mm ?? ""} placeholder={form.b_mm} onChange={(v) => setLevel(lvl, { b_mm: v })} step="25" />
            <Num label="h" unit="mm" value={e.h_mm ?? ""} placeholder={form.h_mm} onChange={(v) => setLevel(lvl, { h_mm: v })} step="25" />
            <div>
              <label className={LABEL}>Bar Ø <span className="text-[#94a3b8]">(mm)</span></label>
              <Dropdown value={e.main_bar_dia_mm ?? form.main_bar_dia_mm}
                onChange={(v) => setLevel(lvl, { main_bar_dia_mm: v })} options={BAR_DIAS} />
            </div>
            <Num label="No. of bars" value={e.n_bars_total ?? ""} placeholder={form.n_bars_total} onChange={(v) => setLevel(lvl, { n_bars_total: v })} step="2" />
            <div>
              <label className={LABEL}>Link Ø <span className="text-[#94a3b8]">(mm)</span></label>
              <Dropdown value={e.link_dia_mm ?? form.link_dia_mm}
                onChange={(v) => setLevel(lvl, { link_dia_mm: v })} options={LINK_DIAS} />
            </div>
          </div>
          <Check label="Set bars per face manually, this storey only"
            checked={!!e._customFaces} small
            onChange={toggleFaces} />
          {e._customFaces && (
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Num label="Bars on b-face" value={e.n_bars_b_face ?? ""} placeholder="2"
                  onChange={(v) => setLevel(lvl, { n_bars_b_face: v })} step="1" />
                <div>
                  <label className={LABEL}>Bars on h-face <span className="text-[#94a3b8]">(from the total)</span></label>
                  <div className="flex h-[38px] items-center rounded-lg border border-[#e2e8f0] px-3 font-mono text-sm dark:border-[#334155]">
                    <span className={MAIN}>{split.nH !== null && split.nH >= 0 ? split.nH : "?"}</span>
                  </div>
                </div>
              </div>
              {problem ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {problem.charAt(0).toUpperCase() + problem.slice(1)}. Change the number of bars or the b-face count.
                </p>
              ) : (
                <p className={`mt-1 text-xs ${SUB}`}>
                  {split.total} bars: {split.nB} on each b-face and {split.nH} on each h-face, corners shared.
                  For this total the b-face can be 2 to {split.hi}.
                  {split.total !== totalIn ? ` ${totalIn} rounded up to ${split.total} to keep the cage symmetric.` : ""}
                  {form.autosize_bars
                    ? " Auto-size leaves this storey alone and checks the cage as entered."
                    : ""}
                </p>
              )}
            </div>
          )}

          <Num label="Storey height" unit="m" value={e.storey_height_m ?? ""}
            placeholder={form.storey_height_m}
            onChange={(v) => setLevel(lvl, { storey_height_m: v })} step="0.1" />

          <Check label="This storey carries different loads" checked={ownLoads}
            onChange={(v) => setLevel(lvl, { _ownLoads: v })} />
          {ownLoads && (
            <div className="mt-2 rounded-lg border border-[#e2e8f0] p-3 dark:border-[#334155]">
              <p className={`mb-2 text-[11px] ${SUB}`}>
                Greyed numbers are what this storey inherits from the Typical Floor.
                Leave a box empty to keep it; type to override just that one.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div><label className={LABEL}>Building use</label>
                  <Dropdown value={fl.building_use ?? form.typical_floor.building_use}
                    onChange={(v) => setLevelFloor(lvl, { building_use: v })} options={BUILDING_USES} /></div>
                <Num label="Slab thickness" unit="m" value={fl.slab_thickness_m ?? ""}
                  placeholder={form.typical_floor.slab_thickness_m}
                  onChange={(v) => setLevelFloor(lvl, { slab_thickness_m: v })} step="0.01" />
                <Num label="Imposed override" unit="kN/m²" value={fl.imposed_override_kN_per_m2 ?? ""}
                  placeholder={form.typical_floor.imposed_override_kN_per_m2}
                  onChange={(v) => setLevelFloor(lvl, { imposed_override_kN_per_m2: v })} step="0.25" />
                <Num label="Finishes" unit="kN/m²" value={fl.finishes_kN_per_m2 ?? ""}
                  placeholder={form.typical_floor.finishes_kN_per_m2}
                  onChange={(v) => setLevelFloor(lvl, { finishes_kN_per_m2: v })} step="0.25" />
                <Num label="Services" unit="kN/m²" value={fl.services_kN_per_m2 ?? ""}
                  placeholder={form.typical_floor.services_kN_per_m2}
                  onChange={(v) => setLevelFloor(lvl, { services_kN_per_m2: v })} step="0.25" />
                <Num label="Partitions" unit="kN/m²" value={fl.partitions_kN_per_m2 ?? ""}
                  placeholder={form.typical_floor.partitions_kN_per_m2}
                  onChange={(v) => setLevelFloor(lvl, { partitions_kN_per_m2: v })} step="0.25" />
              </div>
              <p className={`mt-3 mb-1 text-[11px] ${SUB}`}>
                Both beam pairs carry load into the column, so a wall on only one of
                them must be set on that one alone.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <BeamBlock label="X-direction pair (left + right)"
                  b={form.typical_floor.beam_x} inherit={fl.beam_x || {}}
                  onChange={(pp) => setLevelBeam(lvl, "beam_x", pp)} />
                <BeamBlock label="Y-direction pair (top + bottom)"
                  b={form.typical_floor.beam_y} inherit={fl.beam_y || {}}
                  onChange={(pp) => setLevelBeam(lvl, "beam_y", pp)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FloorCard({ title, which, floor, setFloor, setBeam }) {
  return (
    <Card title={title}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div><label className={LABEL}>Building use</label><Dropdown value={floor.building_use} onChange={(v) => setFloor(which, { building_use: v })} options={BUILDING_USES} /></div>
        <Num label="Slab thickness" unit="m" value={floor.slab_thickness_m} onChange={(v) => setFloor(which, { slab_thickness_m: v })} step="0.01" />
        <Num label="Imposed override" unit="kN/m²" value={floor.imposed_override_kN_per_m2} onChange={(v) => setFloor(which, { imposed_override_kN_per_m2: v })} step="0.25" />
        <Num label="Finishes" unit="kN/m²" value={floor.finishes_kN_per_m2} onChange={(v) => setFloor(which, { finishes_kN_per_m2: v })} step="0.25" />
        <Num label="Services" unit="kN/m²" value={floor.services_kN_per_m2} onChange={(v) => setFloor(which, { services_kN_per_m2: v })} step="0.25" />
        <Num label="Partitions" unit="kN/m²" value={floor.partitions_kN_per_m2} onChange={(v) => setFloor(which, { partitions_kN_per_m2: v })} step="0.25" />
      </div>
      <p className={`mt-4 mb-2 text-xs font-semibold ${SUB}`}>Beam pairs framing into the column</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BeamBlock label="X-direction pair (left + right)" b={floor.beam_x} onChange={(p) => setBeam(which, "beam_x", p)} />
        <BeamBlock label="Y-direction pair (top + bottom)" b={floor.beam_y} onChange={(p) => setBeam(which, "beam_y", p)} />
      </div>
    </Card>
  );
}

/**
 * `inherit` turns the block into override mode: fields sit blank and show the
 * inherited value greyed as a placeholder, so an empty box reads as "same as
 * the typical floor" rather than as something you forgot to fill in.
 */
function BeamBlock({ label, b, onChange, inherit }) {
  const own = inherit || {};
  const val = (k) => (inherit ? (own[k] ?? "") : b[k]);
  const ph = (k) => (inherit ? b[k] : undefined);
  const wallOn = inherit ? (own.wall_present ?? b.wall_present) : b.wall_present;
  return (
    <div className="rounded-lg border border-[#e2e8f0] p-3 dark:border-[#334155]">
      <div className={`mb-2 text-xs font-semibold ${MAIN}`}>{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="width" unit="m" value={val("width_m")} placeholder={ph("width_m")} onChange={(v) => onChange({ width_m: v })} step="0.01" />
        <Num label="depth" unit="m" value={val("depth_m")} placeholder={ph("depth_m")} onChange={(v) => onChange({ depth_m: v })} step="0.01" />
      </div>
      <Check
        label={inherit
          ? `Wall on these beams${own.wall_present === undefined ? "  (inherited)" : ""}`
          : "Wall on these beams"}
        checked={!!wallOn} onChange={(v) => onChange({ wall_present: v })} small />
      {wallOn && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Num label="thickness" unit="m" value={val("wall_thickness_m")} placeholder={ph("wall_thickness_m")} onChange={(v) => onChange({ wall_thickness_m: v })} step="0.05" />
          <Num label="density" unit="kN/m³" value={val("wall_density_kN_per_m3")}
            placeholder={inherit ? (b.wall_density_kN_per_m3 || form_masonry_hint) : undefined}
            onChange={(v) => onChange({ wall_density_kN_per_m3: v })} step="1" />
          <Num label="openings" unit="0–0.9" value={val("wall_opening_ratio")} placeholder={ph("wall_opening_ratio")} onChange={(v) => onChange({ wall_opening_ratio: v })} step="0.1" />
        </div>
      )}
    </div>
  );
}

// Blank wall density falls back to the masonry density on step 1.
const form_masonry_hint = "step 1 masonry density";

/* ================= STEP 6 ================= */
function StepReview({ form, levels, layout, isAxial, isBiaxial, directLoad, useFinalMEd }) {
  const elLabel = EL_METHODS.find((m) => m.value === form.el_method)?.label;
  return (
    <div className="space-y-5">
      <Card title="Review">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
          <RV label="Column" value={`${form.column_id} · ${form.column_type}${form.column_type === "uniaxial" ? ` (about ${form.uniaxial_axis})` : ""}`} />
          <RV label="End / bracing" value={`${form.end_condition} · ${form.bracing}`} />
          <RV label="Storey height" value={`${form.storey_height_m} m`} />
          <RV label="Section" value={`${form.b_mm} × ${form.h_mm} mm`} />
          <RV label="Bars" value={`${layout.used} × Ø${form.main_bar_dia_mm}`} />
          <RV label="Links" value={`Ø${form.link_dia_mm}`} />
          <RV label="Materials" value={`${form.concrete_grade} · ${form.steel_grade}`} />
          <RV label="Cover" value={form.cover_mode === "manual" ? `${form.clear_cover_override_mm} mm (manual)` : `derived · ${form.exposure_class}`} />
          <RV label="Effective length" value={elLabel} />
          <RV label="Clear height" value={form.clear_height_m ? `${form.clear_height_m} m` : "= storey height"} />
          <RV label="λlim factors" value={form.use_default_A_B ? "A = 0.7, B = 1.1 (default)" : "computed"} />
          <RV label="Imperfections" value={form.include_geometric_imperfections ? "included" : "omitted"} />
          <RV label="Actions" value={directLoad
            ? `N_Ed = ${form.NEd_override_kN} kN (direct)`
            : `take-down · ${form.number_of_typical_floors} typical + roof`} />
          <RV label="Moments" value="derived by sub-frame" />
          <RV label="Bar selection" value={form.autosize_bars ? "engine chooses" : "as specified"} />
          <RV label="Per-storey edits" value={(() => {
            const n = levels.filter((l) => form.levelEdits[l]?.custom).length;
            return n ? `${n} of ${levels.length} storeys edited` : "none — one section throughout";
          })()} />
          <RV label="Base" value={form.base_fixed ? "fixed" : "pinned"} />
          <RV label="Designed by" value={form.designer_name.trim() || "not entered"} />
          {!directLoad && <RV label="Tributary" value={`x ${form.left_x_m}/${form.right_x_m}, y ${form.top_y_m}/${form.bottom_y_m} m`} />}
        </div>
      </Card>

      <div className="rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] p-3 dark:bg-[#1e3a4a]">
        <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">
          Section capacity is solved by strain compatibility, so M_Rd varies with N_Ed rather than being a
          single figure. Results include the full N–M interaction curve for both axes. Check the design
          against your own calculations before using it on real work.
        </p>
      </div>
    </div>
  );
}

/* ================= SHARED ================= */
function Card({ title, children }) {
  return (
    <div className={CARD}>
      <div className="border-b border-[#e2e8f0] px-5 py-3 dark:border-[#334155]"><h2 className={SECTION}>{title}</h2></div>
      <div className="p-5">{children}</div>
    </div>
  );
}
function Num({ label, unit, value, onChange, step, disabled, placeholder }) {
  return (
    <div>
      <label className={LABEL}>{label} {unit ? <span className="text-[#94a3b8]">({unit})</span> : null}</label>
      <input type="number" step={step} value={value} disabled={disabled}
        placeholder={placeholder === undefined || placeholder === null ? undefined : String(placeholder)}
        onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}
function Check({ label, checked, onChange, small }) {
  return (
    <label className={`mt-2 flex cursor-pointer items-center gap-2 ${small ? "text-xs" : "text-sm"}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#0A2F44]" />
      <span className={SUB}>{label}</span>
    </label>
  );
}
function Pill({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? "border-[#0A2F44] bg-[#e6f0f5] text-[#0A2F44] dark:border-[#66a4c2] dark:bg-[#1e3a4a] dark:text-[#66a4c2]"
           : `border-[#e2e8f0] dark:border-[#334155] ${SUB} hover:border-[#94a3b8]`}`}>
      {children}
    </button>
  );
}
function Note({ children }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-[#0A2F44] bg-[#e6f0f5] p-3 dark:bg-[#1e3a4a]">
      <FiInfo className="mt-0.5 flex-shrink-0 text-[#0A2F44] dark:text-[#66a4c2]" size={14} />
      <p className="text-xs text-[#0A2F44] dark:text-[#cce1eb]">{children}</p>
    </div>
  );
}
function RV({ label, value }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</div><div className={`text-sm font-medium ${MAIN}`}>{value}</div></div>;
}

/* bar layout mirrors distribute_bars() in column_engine.py */
function SectionSVG({ b, h, cover, dia, link, nB, nH }) {
  const VB = 200, pad = 30, draw = VB - 2 * pad;
  if (!(b > 0) || !(h > 0)) {
    return <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[#cbd5e1] text-xs text-[#94a3b8] dark:border-[#475569]">Enter b and h</div>;
  }
  const scale = draw / Math.max(b, h);
  const w = b * scale, ht = h * scale, x0 = (VB - w) / 2, y0 = (VB - ht) / 2;
  const inset = (cover + link + dia / 2) * scale;
  const xL = x0 + inset, xR = x0 + w - inset, yT = y0 + inset, yB = y0 + ht - inset;
  const lerp = (a, z, t) => a + (z - a) * t;
  const bars = [];
  for (let i = 0; i < nB; i++) {
    const t = nB === 1 ? 0.5 : i / (nB - 1);
    bars.push([lerp(xL, xR, t), yT]); bars.push([lerp(xL, xR, t), yB]);
  }
  for (let i = 1; i < nH - 1; i++) {
    const t = i / (nH - 1);
    bars.push([xL, lerp(yT, yB, t)]); bars.push([xR, lerp(yT, yB, t)]);
  }
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[200px]" xmlns="http://www.w3.org/2000/svg">
      <rect x={x0} y={y0} width={w} height={ht} className="fill-[#eef2f6] dark:fill-[#0f172a]" stroke={ACCENT} strokeWidth="1.5" />
      <rect x={xL - dia * scale * 0.5} y={yT - dia * scale * 0.5}
        width={xR - xL + dia * scale} height={yB - yT + dia * scale}
        fill="none" stroke={ACCENT_D} strokeWidth="0.8" strokeDasharray="3 2" />
      {bars.map(([bx, by], i) => <circle key={i} cx={bx} cy={by} r={Math.max(2, Math.min(5, dia * scale * 0.5))} fill={ACCENT} />)}
      <text x={VB / 2} y={y0 + ht + 18} textAnchor="middle" fontSize="10" className="fill-[#64748b] dark:fill-[#94a3b8]">b = {b}</text>
      <text x={x0 - 16} y={VB / 2} textAnchor="middle" fontSize="10" transform={`rotate(-90 ${x0 - 16} ${VB / 2})`} className="fill-[#64748b] dark:fill-[#94a3b8]">h = {h}</text>
      <text x={VB / 2} y={y0 - 12} textAnchor="middle" fontSize="9" className="fill-[#94a3b8]">{2 * nB + 2 * nH - 4} bars</text>
    </svg>
  );
}

function TributarySVG({ lx, rx, ty, by }) {
  if (!(lx > 0) || !(rx > 0) || !(ty > 0) || !(by > 0)) {
    return <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-[#cbd5e1] text-xs text-[#94a3b8] dark:border-[#475569]">Enter spans</div>;
  }
  const VB = 200;
  const cx = VB * (lx / (lx + rx)), cy = VB * (ty / (ty + by));
  const x0 = cx / 2, x1 = cx + (VB - cx) / 2;
  const y0 = cy / 2, y1 = cy + (VB - cy) / 2;
  const At = ((lx + rx) / 2) * ((ty + by) / 2);
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full max-w-[200px]" xmlns="http://www.w3.org/2000/svg">
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0}
        className="fill-[#e6f0f5] dark:fill-[#1e3a4a]" stroke={ACCENT_D} strokeWidth="0.8" strokeDasharray="3 2" />
      <line x1={cx} y1="0" x2={cx} y2={VB} stroke="#cbd5e1" strokeWidth="0.6" />
      <line x1="0" y1={cy} x2={VB} y2={cy} stroke="#cbd5e1" strokeWidth="0.6" />
      <rect x={cx - 6} y={cy - 6} width="12" height="12" fill={ACCENT} />
      <text x={VB / 2} y={VB - 4} textAnchor="middle" fontSize="9" className="fill-[#64748b] dark:fill-[#94a3b8]">Aₜ = {At.toFixed(2)} m²</text>
    </svg>
  );
}