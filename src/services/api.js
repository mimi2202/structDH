// src/services/api.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// FastAPI/Pydantic validation errors come back as
//   { detail: [{ type, loc, msg, input, ctx }, ...] }
// -- `detail` is an ARRAY of error objects, not a string. Every API function
// below used to do `JSON.stringify(err.detail)` as a fallback, which dumped
// the entire raw array -- including the full echoed request body -- straight
// into the UI's error box. This extracts just the human-readable `.msg`
// field(s) instead, and strips the "Value error, " prefix Pydantic adds for
// custom ValueError-raised messages.
function extractErrorMessage(errBody, fallback) {
  if (!errBody) return fallback;
  const { detail } = errBody;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => {
        if (!d || typeof d.msg !== "string") return null;
        const msg = d.msg.replace(/^Value error,\s*/, "");
        // Pydantic's `loc` names the offending field. Dropping it leaves
        // messages like "Input should be greater than or equal to 0" with
        // nothing to act on, which is the difference between a two-second
        // fix and hunting through five steps of a form.
        const loc = Array.isArray(d.loc)
          ? d.loc.filter((x) => x !== "body" && typeof x !== "number").join(" \u2192 ")
          : "";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  return fallback;
}

// Endpoint paths in one place. The continuous beam router is mounted bare
// (APIRouter() with no prefix) and gets "/api/continuous-beam" from
// include_router in server.py, so its full path is assembled here.
const ENDPOINTS = {
  slab: "/api/slab/design/sync",
  column: "/api/column/design/sync",
  columnHealth: "/api/column/health",
  beam: "/api/beam/design/sync",
  continuousBeam: "/api/continuous-beam/design/sync",
  continuousSlab: "/api/continuous-slab/design/sync",
  padFoundation: "/api/foundation/pad/design/sync",
  combinedFoundation: "/api/foundation/combined/design/sync",
};

export const slabAPI = {
  startDesign: async (formData) => {
    const request = {
      slab_type: formData.slabType === 'one-way' ? 'one_way' : 'two_way',
      continuity: formData.continuity,
      geometry: {
        span_lx: parseFloat(formData.spanLx) / 1000,
        span_ly: parseFloat(formData.spanLy) / 1000,
        thickness: parseFloat(formData.thickness),
        clear_cover: parseFloat(formData.clearCover)
      },
      materials: {
        concrete_grade: formData.concreteGrade,
        steel_grade: formData.steelGrade,
        unit_weight_concrete: parseFloat(formData.unitWeightConcrete),
        unit_weight_steel: parseFloat(formData.unitWeightSteel)
      },
      loads: {
        floor_finish: parseFloat(formData.floorFinish),
        live_load: parseFloat(formData.liveLoad),
        additional_dead_load: parseFloat(formData.additionalDeadLoad),
        additional_live_load: parseFloat(formData.additionalLiveLoad)
      },
      design_params: {
        design_code: formData.designCode,
        analysis_method: formData.analysisMethod,
        exposure_class: formData.exposureClass,
        fire_rating: parseInt(formData.fireRating),
        crack_width_limit: parseFloat(formData.crackWidthLimit),
        deflection_limit: parseInt(formData.deflectionLimit)
      },
      bar_diameters: (() => {
        const main = parseInt(formData.mainBarDia) || 12;
        return [main, ...[10, 12, 16, 20].filter((d) => d !== main)];
      })(),
      use_ai: false,
      region: "Nigeria",
      building_use: formData.buildingUse || "office",
      design_basis: {
        designer_name: (formData.designerName || "").trim() || null,
        designer_qualifications: (formData.designerQualifications || "").trim() || null,
        checked_by: (formData.checkedBy || "").trim() || null,
        checker_qualifications: (formData.checkerQualifications || "").trim() || null,
        stability_responsible: (formData.stabilityResponsible || "").trim() || null,
        independent_check: formData.independentCheck || null,
      }
    };

    const response = await fetch(`${API_BASE}${ENDPOINTS.slab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error("Design request failed →", error);
      throw new Error(extractErrorMessage(error, `Request failed: ${response.status}`));
    }

    return response.json();
  },

  getRates: async (region = 'Nigeria') => {
    const response = await fetch(`${API_BASE}/api/rates/${region}`);
    if (!response.ok) throw new Error('Failed to fetch rates');
    return response.json();
  }
};

export const columnAPI = {
  /**
   * @param {object} request - body built by ColumnInput.jsx buildRequest(),
   *                           already shaped as ColumnDesignRequest.
   */
  startDesign: async (request) => {
    const response = await fetch(`${API_BASE}${ENDPOINTS.column}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(extractErrorMessage(error, "Column design failed."));
    }
    return response.json();
  },

  health: async () => {
    const response = await fetch(`${API_BASE}${ENDPOINTS.columnHealth}`);
    if (!response.ok) throw new Error("Column module is not responding.");
    return response.json();
  },
};

export const beamAPI = {
  startDesign: async (formData) => {
    const request = {
      beam_id: formData.beamId || "B1",
      design_code: formData.designCode,
      support_condition: formData.supportCondition,
      top_restraint: formData.topRestraint,
      geometry: {
        span: parseFloat(formData.span),
        width: parseFloat(formData.width),
        depth: parseFloat(formData.depth),
        effective_cover: parseFloat(formData.effectiveCover),
        left_adjacent_spacing: parseFloat(formData.leftAdjacentSpacing) || 0,
        right_adjacent_spacing: parseFloat(formData.rightAdjacentSpacing) || 0,
        slab_thickness: parseFloat(formData.slabThickness) || 0,
      },
      materials: {
        concrete_grade: formData.concreteGrade,
        steel_grade: formData.steelGrade,
        unit_weight_concrete: parseFloat(formData.unitWeightConcrete),
        unit_weight_steel: parseFloat(formData.unitWeightSteel),
      },
      loads: {
        self_weight_auto: !!formData.selfWeightAuto,
        wall_load: parseFloat(formData.wallLoad) || 0,
        finishes: parseFloat(formData.finishes) || 0,
        additional_dead_load: parseFloat(formData.additionalDeadLoad) || 0,
        live_load: parseFloat(formData.liveLoad) || 0,
        other_live_load: parseFloat(formData.otherLiveLoad) || 0,
      },
      bar_diameters: formData.barDiameters || [16, 20, 25, 32],
      link_diameter: parseInt(formData.linkDiameter) || 8,
      region: formData.region || "Nigeria",
      design_basis: {
        designer_name: (formData.designerName || "").trim() || null,
        designer_qualifications: (formData.designerQualifications || "").trim() || null,
        checked_by: (formData.checkedBy || "").trim() || null,
        checker_qualifications: (formData.checkerQualifications || "").trim() || null,
        stability_responsible: (formData.stabilityResponsible || "").trim() || null,
        independent_check: formData.independentCheck || null,
      }
    };

    const res = await fetch(`${API_BASE}${ENDPOINTS.beam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(err, `Request failed: ${res.status}`));
    }
    return res.json();
  },

  /**
   * Continuous beam design.
   *
   * BeamInput.jsx merged the continuous beam form into the beam page and
   * builds the finished ContinuousBeamRequest in buildContinuousPayload(),
   * so this is a pass-through. Do not re-map camelCase form fields here:
   * the argument is already the API body.
   *
   * @param {object} request - already shaped as ContinuousBeamRequest.
   */
  startContinuousDesign: async (request) => {
    const res = await fetch(`${API_BASE}${ENDPOINTS.continuousBeam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(err, `Request failed: ${res.status}`));
    }
    return res.json();
  },
};

/**
 * Legacy: takes raw camelCase form state and maps it, for the standalone
 * continuous beam page that predates the merge into BeamInput.jsx. New code
 * should call beamAPI.startContinuousDesign with a finished body instead.
 * Both post to the same endpoint.
 */
export const continuousBeamAPI = {
  startDesign: async (form) => {
    const request = {
      beam_id: form.beamId || "CB1",
      design_code: form.designCode,
      analysis_method: form.analysisMethod || "Linear Elastic",
      geometry: {
        n_spans: parseInt(form.nSpans),
        span_lengths: form.spanLengths.map((v) => parseFloat(v)),
        width: parseFloat(form.width),
        depth: parseFloat(form.depth),
        effective_depth: form.effectiveDepth ? parseFloat(form.effectiveDepth) : null,
        cover: parseFloat(form.cover),
      },
      materials: {
        concrete_grade: form.concreteGrade,
        steel_grade: form.steelGrade,
        unit_weight_concrete: parseFloat(form.unitWeightConcrete),
        unit_weight_steel: parseFloat(form.unitWeightSteel),
      },
      loads: {
        self_weight_auto: !!form.selfWeightAuto,
        wall_load: parseFloat(form.wallLoad) || 0,
        finishes: parseFloat(form.finishes) || 0,
        additional_dead_load: parseFloat(form.additionalDeadLoad) || 0,
        live_load: parseFloat(form.liveLoad) || 0,
        other_live_load: parseFloat(form.otherLiveLoad) || 0,
      },
      span_loads: form.spanLoads && form.spanLoads.length ? form.spanLoads : null,
      end_support: form.endSupport || "simple",
      design_params: {
        design_working_life: parseInt(form.designWorkingLife) || 50,
        exposure_class: form.exposureClass || "XC1",
        cracked_section_sls: form.crackedSectionSls !== false,
      },
      bar_diameters: form.barDiameters || [16, 20, 25, 32],
      link_diameter: parseInt(form.linkDiameter) || 8,
      region: form.region || "Nigeria",
      design_basis: {
        designer_name: (form.designerName || "").trim() || null,
        designer_qualifications: (form.designerQualifications || "").trim() || null,
        checked_by: (form.checkedBy || "").trim() || null,
        checker_qualifications: (form.checkerQualifications || "").trim() || null,
        stability_responsible: (form.stabilityResponsible || "").trim() || null,
        independent_check: form.independentCheck || null,
      },
    };
    return beamAPI.startContinuousDesign(request);
  },
};

export const continuousSlabAPI = {
  startDesign: async (form) => {
    const request = {
      span_lengths: (form.spanLengths || []).map((v) => parseFloat(v)),
      start_support: form.startSupport || "pinned",
      end_support: form.endSupport || "pinned",
      geometry_thickness: parseFloat(form.thickness),
      clear_cover: parseFloat(form.clearCover),
      materials: {
        concrete_grade: form.concreteGrade,
        steel_grade: form.steelGrade,
        unit_weight_concrete: parseFloat(form.unitWeightConcrete) || 25,
        unit_weight_steel: parseFloat(form.unitWeightSteel) || 78.5,
      },
      loads: {
        dead_load: parseFloat(form.deadLoad) || 0,
        floor_finish: parseFloat(form.floorFinish) || 0,
        live_load: parseFloat(form.liveLoad) || 0,
        additional_dead_load: parseFloat(form.additionalDeadLoad) || 0,
        additional_live_load: parseFloat(form.additionalLiveLoad) || 0,
      },
      design_params: {
        design_code: form.designCode || "EC2",
        analysis_method: form.analysisMethod || "limit_state",
        exposure_class: form.exposureClass || "XC3",
        // 0 min is a real choice ("no fire check"), so don't let || turn it into 60
        fire_rating: Number.isNaN(parseInt(form.fireRating)) ? 60 : parseInt(form.fireRating),
        crack_width_limit: parseFloat(form.crackWidthLimit) || 0.3,
        deflection_limit: parseInt(form.deflectionLimit) || 250,
      },
      bar_diameters: form.barDiameters || [10, 12, 16],
      cover_tolerance: parseFloat(form.coverTolerance) || 5,
      // "Custom" ("") means occupancy not stated -> backend assumes psi_2 = 0.6
      occupancy: form.occupancy || null,
      main_bar_dia: parseInt(form.mainBarDia) || 12,
      region: form.region || "Nigeria",
      design_basis: {
        designer_name: (form.designerName || "").trim() || null,
        designer_qualifications: (form.designerQualifications || "").trim() || null,
        checked_by: (form.checkedBy || "").trim() || null,
        checker_qualifications: (form.checkerQualifications || "").trim() || null,
        stability_responsible: (form.stabilityResponsible || "").trim() || null,
        independent_check: form.independentCheck || null,
      }
    };

    const res = await fetch(`${API_BASE}${ENDPOINTS.continuousSlab}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(extractErrorMessage(err, `Request failed: ${res.status}`));
    }
    return res.json();
  },
};

export const foundationAPI = {
  designPad: async (payload) => {
    // payload already carries engine fields; strip the display-only _meta
    const { _meta, ...request } = payload;
    const res = await fetch(`${API_BASE}${ENDPOINTS.padFoundation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, "Design failed."));
    }
    return res.json();
  },

  designCombined: async (payload) => {
    const res = await fetch(`${API_BASE}${ENDPOINTS.combinedFoundation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, "Design failed."));
    }
    return res.json();
  },
};