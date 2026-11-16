// Add this to src/services/api.js (same file as slabAPI)
// Sends nested request matching backend BeamDesignRequest.

const API_BASE = "https://structdh-1.onrender.com";

export const beamAPI = {
  startDesign: async (formData) => {
    const request = {
      beam_id: formData.beamId || "B1",
      design_code: formData.designCode,                 // EC2 | BS8110 | ACI318
      support_condition: formData.supportCondition,     // e.g. both_ends_simply_supported
      top_restraint: formData.topRestraint,             // continuous | one_end_discontinuous | both_ends_discontinuous
      geometry: {
        span: parseFloat(formData.span),                // mm
        width: parseFloat(formData.width),              // mm
        depth: parseFloat(formData.depth),              // mm
        effective_cover: parseFloat(formData.effectiveCover),
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
      bar_diameters: [16, 20, 25, 32],
      link_diameter: 8,
      region: formData.region || "UK",
    };

    const res = await fetch(`${API_BASE}/api/beam/design/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(
        err?.detail ? (typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) : `Request failed: ${res.status}`
      );
    }
    return res.json();
  },
};