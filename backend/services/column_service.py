# backend/services/column_service.py
"""
Maps ColumnDesignRequest onto the validated column_engine and returns a
ColumnDesignResult.

The service holds no design logic of its own. This is deliberate: the
one-way slab and simply-supported beam both went wrong by growing a second,
divergent copy of the calculation inside their service layer. Everything
structural lives in column_engine.py; this module only translates shapes.
"""

from engine.column_engine import (
    Beam as EngBeam,
    ColumnEngine,
    ColumnInput as EngInput,
    FloorTemplate as EngFloor,
    LevelSpec as EngLevelSpec,
    Wall as EngWall,
)
from models.column_schemas import (
    ColBeam,
    ColFloorTemplate,
    ColumnDesignRequest,
    ColumnDesignResult,
)


def _wall(w) -> EngWall:
    return EngWall(
        present=w.present,
        thickness_m=w.thickness_m,
        density_kN_per_m3=w.density_kN_per_m3,
        opening_ratio=w.opening_ratio,
    )


def _beam(b: ColBeam) -> EngBeam:
    return EngBeam(width_m=b.width_m, depth_m=b.depth_m, wall=_wall(b.wall))


def _floor(f: ColFloorTemplate) -> EngFloor:
    return EngFloor(
        building_use=f.building_use,
        slab_thickness_m=f.slab_thickness_m,
        finishes_kN_per_m2=f.finishes_kN_per_m2,
        services_kN_per_m2=f.services_kN_per_m2,
        partitions_kN_per_m2=f.partitions_kN_per_m2,
        beam_x=_beam(f.beam_x),
        beam_y=_beam(f.beam_y),
        imposed_override_kN_per_m2=f.imposed_override_kN_per_m2,
    )


def _level_specs(req: ColumnDesignRequest):
    """Per-storey overrides, keyed by level name. Empty dict = one section."""
    out = {}
    for name, sp in (req.levels or {}).items():
        out[name] = EngLevelSpec(
            b_mm=sp.b_mm, h_mm=sp.h_mm,
            main_bar_dia_mm=sp.main_bar_dia_mm,
            n_bars_total=sp.n_bars_total,
            n_bars_b_face=sp.n_bars_b_face,
            n_bars_h_face=sp.n_bars_h_face,
            link_dia_mm=sp.link_dia_mm,
            storey_height_m=sp.storey_height_m,
            floor=_floor(sp.floor) if sp.floor is not None else None,
        )
    return out


def to_engine_input(req: ColumnDesignRequest) -> EngInput:
    g, rf, m, du, fa = (
        req.geometry, req.reinforcement, req.materials, req.durability, req.factors
    )
    el, an = req.effective_length, req.analysis

    # Only forward the fields the chosen method actually uses, so a value
    # left behind by a previous method cannot take precedence in the engine.
    use_k = el.method.value == "k_factors"
    use_direct = el.method.value == "direct"

    return EngInput(
        column_id=req.column_id,
        column_type=req.column_type.value,
        uniaxial_axis=req.uniaxial_axis.value,
        design_code=req.design_code.value if hasattr(req.design_code, "value") else str(req.design_code),
        b_mm=g.b_mm,
        h_mm=g.h_mm,
        storey_height_m=g.storey_height_m,
        clear_height_m=el.clear_height_m,
        end_condition=req.end_condition.value,
        braced=req.braced,
        k1_x=el.k1_x if use_k else None,
        k2_x=el.k2_x if use_k else None,
        k1_y=el.k1_y if use_k else None,
        k2_y=el.k2_y if use_k else None,
        l0_override_x_mm=el.l0_x_mm if use_direct else None,
        l0_override_y_mm=el.l0_y_mm if use_direct else None,
        main_bar_dia_mm=rf.main_bar_dia_mm,
        n_bars_total=rf.n_bars_total,
        n_bars_b_face=rf.n_bars_b_face,
        n_bars_h_face=rf.n_bars_h_face,
        link_dia_mm=rf.link_dia_mm,
        exposure_class=du.exposure_class,
        delta_c_dev_mm=du.delta_c_dev_mm,
        clear_cover_override_mm=du.clear_cover_override_mm,
        concrete_grade=m.concrete_grade,
        steel_grade=m.steel_grade,
        concrete_density_kN_per_m3=m.concrete_density_kN_per_m3,
        masonry_density_kN_per_m3=m.masonry_density_kN_per_m3,
        gamma_G=fa.gamma_G,
        gamma_Q=fa.gamma_Q,
        gamma_c=fa.gamma_c,
        gamma_s=fa.gamma_s,
        alpha_cc=fa.alpha_cc,
        left_x_m=g.left_x_m,
        right_x_m=g.right_x_m,
        top_y_m=g.top_y_m,
        bottom_y_m=g.bottom_y_m,
        number_of_typical_floors=req.number_of_typical_floors,
        level_specs=_level_specs(req),
        typical_floor=_floor(req.typical_floor),
        roof_floor=_floor(req.roof_floor),
        M01x_kNm=dict(req.M01x_kNm),
        M02x_kNm=dict(req.M02x_kNm),
        M01y_kNm=dict(req.M01y_kNm),
        M02y_kNm=dict(req.M02y_kNm),
        include_min_eccentricity=an.include_min_eccentricity,
        include_geometric_imperfections=an.include_geometric_imperfections,
        effective_creep_ratio=an.effective_creep_ratio,
        use_default_A_B=an.use_default_A_B,
        autosize_bars=an.autosize_bars,
        NEd_override_kN=req.NEd_override_kN,
        MEdx_override_kNm=req.MEdx_override_kNm,
        MEdy_override_kNm=req.MEdy_override_kNm,
        design_basis=req.design_basis.model_dump(),
    )


def design_column(req: ColumnDesignRequest) -> ColumnDesignResult:
    eng_in = to_engine_input(req)
    subframe_rows = []
    if req.frame.derive_moments and req.column_type.value != "axial" \
            and req.NEd_override_kN is None:
        # Derive the first-order end moments from the frame geometry rather
        # than asking the user for them.
        from services.column_frame_bridge import build_subframe, subframe_report
        res, trace = build_subframe(req)
        eng_in.M01x_kNm = dict(res.M01x)
        eng_in.M02x_kNm = dict(res.M02x)
        eng_in.M01y_kNm = dict(res.M01y)
        eng_in.M02y_kNm = dict(res.M02y)
        subframe_rows = subframe_report(res, trace)

    engine = ColumnEngine(eng_in)
    raw = engine.run()
    if subframe_rows:
        at = next((i + 1 for i, sec in enumerate(raw["report"])
                   if sec["title"].startswith("6.")), len(raw["report"]))
        raw["report"].insert(at, {"title": "6b. DESIGN MOMENTS FROM SUB-FRAME",
                                  "rows": subframe_rows})
    _attach_bar_detailing(raw)
    return ColumnDesignResult.model_validate(raw)


def _attach_bar_detailing(raw: dict) -> None:
    """Bar marks, schedule and drawing data per storey (engine/member_detailing.py);
    a report section is appended."""
    from engine.member_detailing import column_detailing
    s = raw["summary"]
    levels = []
    for lv in raw["levels"]:
        d = lv.get("detailing") or {}
        levels.append({
            "level": lv["level"], "b": lv["b_mm"], "h": lv["h_mm"], "cover": lv.get("cover_mm", s["cover_mm"]),
            "n_bars": int(lv["n_bars"]), "phi": float(lv["bar_dia_mm"]),
            "n_b_face": int(d.get("n_bars_b_face", 2)), "n_h_face": int(d.get("n_bars_h_face", 2)),
            "link_phi": float(lv.get("link_dia_mm", s["link_dia_mm"])),
            "s_max": float(d.get("s_max_mm", 200)), "s_red": float(d.get("s_reduced_mm", 120)),
        })
    det = column_detailing(levels=levels, storey_height_mm=s["storey_height_m"] * 1000,
                           fck=raw["materials"]["fck"], fyk=raw["materials"]["fyk"])
    raw["report"].append({"title": "Detailing and Bar Schedule",
                          "rows": [{"reference": x["ref"], "calculation": x["calc"], "output": x["out"]} for x in det.pop("report_rows")]})
    raw["bar_detailing"] = det
calculate_column_design = design_column