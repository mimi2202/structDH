import sys
import os
import re
import json
import math

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'engine'))

from models.schemas import (
    SlabDesignRequest, SlabDesignResult, DesignSummary,
    DesignForces, ReinforcementDetails, DeflectionResult,
    ShearResult, ComplianceCheck, CostBreakdown, OptimizationOption,
    ReportSection
)

from services.report_front_matter import (
    front_matter, ndp_partial_factors, ndp_alpha_cc_k_method, ndp_cover_rows,
    ndp_min_steel, ndp_shear_no_links, ndp_deflection, row as _fm_row,
)

try:
    from engine.two_way_slab_engine import (
        TwoWaySlabInput, TwoWaySlabDesigner, SupportCondition as _TWSupport,
        PanelType as _TWPanel, EdgeCondition as _TWEdge, PartitionMode as _TWPart,
        Material as _TWMaterial,
    )
    _TWO_WAY_ENGINE = True
except ImportError:
    try:
        from two_way_slab_engine import (
            TwoWaySlabInput, TwoWaySlabDesigner, SupportCondition as _TWSupport,
            PanelType as _TWPanel, EdgeCondition as _TWEdge, PartitionMode as _TWPart,
            Material as _TWMaterial,
        )
        _TWO_WAY_ENGINE = True
    except ImportError:
        _TWO_WAY_ENGINE = False

_EDGE_MAP = {
    "all_edges_continuous": "INTERIOR_PANEL",
    "one_short_discontinuous": "ONE_SHORT_EDGE_DISCONTINUOUS",
    "one_long_discontinuous": "ONE_LONG_EDGE_DISCONTINUOUS",
    "two_adjacent_discontinuous": "TWO_ADJACENT_EDGES_DISCONTINUOUS",
    "two_short_discontinuous": "TWO_SHORT_EDGES_DISCONTINUOUS",
    "two_long_discontinuous": "TWO_LONG_EDGES_DISCONTINUOUS",
    "three_edges_one_long_continuous": "THREE_EDGES_ONE_LONG_CONTINUOUS",
    "three_edges_one_short_continuous": "THREE_EDGES_ONE_SHORT_CONTINUOUS",
}

try:
    from engine.one_way_slab_engine import design_one_way_slab as _ow_design, OneWayInput as _OWInput
    _ONE_WAY_ENGINE = True
except ImportError:
    try:
        from one_way_slab_engine import design_one_way_slab as _ow_design, OneWayInput as _OWInput
        _ONE_WAY_ENGINE = True
    except ImportError:
        _ONE_WAY_ENGINE = False

def _enum(v):
    return v.value if hasattr(v, "value") else v


def parse_fck(grade):
    g = str(grade).upper().replace("C", "").replace("M", "")
    try:
        return float(g.split("/")[0])
    except (ValueError, IndexError):
        return 30.0


def parse_fy(grade):
    m = re.search(r"(\d{3})", str(grade))
    return float(m.group(1)) if m else 500.0


def resolve_rates(rates_db, region):
    root = rates_db.get("regions", rates_db)
    rb = root.get(region) or root.get("UK") or root.get("Nigeria") or {}
    mats = rb.get("materials", rb)
    concrete = mats.get("concrete", {}) or {}
    steel = mats.get("steel") or mats.get("reinforcement") or {}
    fw = mats.get("formwork", {}) or {}
    formwork_rate = fw.get("slab") or fw.get("flat_slab") or 15000
    return concrete, steel, formwork_rate


def _rate(table, key, default):
    if key in table:
        return table[key]
    for k, v in table.items():
        if str(k).lower() == str(key).lower():
            return v
    return default


def _slab_front_matter(request, compliance, two_way, inp, res):
    """
    REPORT IDENTIFICATION, 0. DESIGN BASIS AND SCOPE and 0b. NATIONALLY
    DETERMINED PARAMETERS USED, laid out as in the column report (see
    report_front_matter.py). Every statement below describes what the one-way
    or two-way engine actually does; anything it does not check is listed as
    not assessed rather than left out.
    """
    g = request.geometry
    checks = [(c.check, c.ratio, c.status) for c in compliance]
    cont = _enum(request.continuity).replace("_", " ")
    exposure = _enum(request.design_params.exposure_class)
    common_out = ("fire resistance (EN 1992-1-2); crack control (Cl. 7.3); punching and "
                  "concentrated loads; openings; the supporting beams, walls and columns; "
                  "disproportionate collapse (Approved Document A); lateral stability")

    if two_way:
        is_ssss = "elastic plate" in (res.analysis_method_used or "").lower()
        cover_entered = inp.cover_mm is not None
        method = ("Moments by elastic plate theory (Navier double sine series, nu = 0.2), "
                  "all four edges simply supported" if is_ssss else
                  f"Moments from Concrete Centre Table 8 coefficients for the edge condition "
                  f"'{cont}', interpolated at Ly/Lx = {res.aspect_ratio_r:.3f}")
        kw = dict(
            module="two-way slab",
            design=(f"Two-way solid slab supported on four sides ({cont}), Lx = {inp.lx_m:.2f} m, "
                    f"Ly = {inp.ly_m:.2f} m, h = {res.thickness_mm:.0f} mm."),
            design_tag="two-way",
            used_for=("design moments in both directions, flexural reinforcement, minimum steel, "
                      "bar selection, distribution steel, deflection by span/depth ratio and shear "
                      "without shear reinforcement, for one panel."),
            basis_of_design=(f"Uniformly distributed load on a rectangular panel. {method}. Flexure "
                             "with a fixed lever arm z = 0.9d (Cl. 6.1), minimum steel by Cl. 9.2.1.1, "
                             "deflection by span/effective depth on the short span (Cl. 7.4.2), shear "
                             "without shear reinforcement on a 1 m strip with V_Ed = w_Ed Lx/2 (Cl. 6.2.2)."),
            load_path=("The panel carries its load to the four edges, taken as line supports that do "
                       "not deflect, with the corners held down. The supporting beams or walls are "
                       "not designed here. Lateral stability is not assessed."),
            loading=("One load case: 1.35 Gk + 1.5 Qk over the whole panel (Eq. 6.10). "
                     + ("No adjacent panels: the plate solution applies to this panel alone."
                        if is_ssss else
                        "The Table 8 coefficients assume adjacent panels of similar span and load; "
                        "that is not checked, and pattern loading is not applied otherwise.")),
            not_assessed=(("cover for durability against the exposure class (cover was entered "
                           f"directly, so {exposure} does not change it); " if cover_entered else "")
                          + "corner torsion reinforcement; " + common_out + "."),
            cover=ndp_cover_rows(
                (f"Not applied: cover was entered directly ({inp.cover_mm:.0f} mm), so the exposure "
                 f"class entered ({exposure}) does not change it." if cover_entered else
                 f"c_min,dur = {res.c_min_dur_mm:.0f} mm for {exposure}, from the software's own "
                 "table (XC1 20, XC2 25, XC3 30, XC4 35 mm), at or above Table 4.4N at structural "
                 "class S4 in every class. Not the UK NA basis."),
                dev_mm=(inp.delta_c_dev_mm if cover_entered else res.delta_c_dev_mm),
                entered=cover_entered),
            alpha=_fm_row("EN 1992-1-1 Cl. 3.1.6(1)P",
                          "alpha_cc = 0.85 in f_cd = alpha_cc f_ck/gamma_c. UK NA: 0.85. CEN "
                          "recommended: 1.0. Flexure itself uses the fixed lever arm z = 0.9d.",
                          "fixed in software"),
        )
    else:
        kw = dict(
            module="one-way slab",
            design=(f"One-way solid slab ({cont}), span {inp.span_m:.2f} m, h = {g.thickness:.0f} mm, "
                    "designed as a 1 m strip."),
            design_tag="one-way",
            used_for=("design moments and shear for one span with the end conditions selected, "
                      "flexural reinforcement at span and support, minimum steel, bar selection, "
                      "deflection by span/depth ratio and shear without shear reinforcement, for "
                      "one 1 m strip."),
            basis_of_design=("Uniformly distributed load on a 1 m strip spanning one way. Moments and "
                             "shear by closed-form expressions for the end conditions selected "
                             "(section 5). Flexure by the K-method (Cl. 6.1), minimum steel by "
                             "Cl. 9.2.1.1, deflection by span/effective depth (Cl. 7.4.2), shear "
                             "without shear reinforcement (Cl. 6.2.2)."),
            load_path=("The strip spans one way onto its supports, taken as given by the end "
                       "conditions entered. The supporting beams or walls are not designed here. "
                       "Lateral stability is not assessed."),
            loading=("One load case: 1.35 Gk + 1.5 Qk on the whole span (Eq. 6.10). The slab is "
                     "designed as a single span: where it is continuous with other spans, their "
                     "effect enters only through the end condition selected, and pattern loading "
                     "is not applied. Area loads only."),
            not_assessed=(f"cover for durability against the exposure class (the {exposure} entered "
                          "is not used); " + common_out + "."),
            cover=ndp_cover_rows(
                f"Not applied: the one-way slab takes the clear cover entered and does not check "
                f"it against the exposure class ({exposure})."),
            alpha=ndp_alpha_cc_k_method(),
        )

    return front_matter(
        member="SLAB", member_label="not entered (slab panels have no ID field)",
        design=kw["design"], design_tag=kw["design_tag"], checks=checks,
        design_basis=request.design_basis, module=kw["module"], used_for=kw["used_for"],
        basis_of_design=kw["basis_of_design"], load_path=kw["load_path"], loading=kw["loading"],
        not_assessed=kw["not_assessed"],
        verification=[("Verification",
                       "No comparison with a published worked example is recorded for this module. "
                       "Hand-check the design moments and reinforcement before use.",
                       "not recorded")],
        ndp_rows=ndp_partial_factors() + [kw["alpha"]] + kw["cover"]
                 + [ndp_min_steel(), ndp_shear_no_links(), ndp_deflection()],
    )


def calculate_slab_design(request: SlabDesignRequest) -> SlabDesignResult:
    code = _enum(request.design_params.design_code)
    slab_type_val = _enum(request.slab_type)
    continuity_val = _enum(request.continuity)
    two_way = slab_type_val == "two_way"

    if two_way and code == "EC2" and _TWO_WAY_ENGINE and (continuity_val in _EDGE_MAP or continuity_val == "all_edges_discontinuous"):
        return _calculate_two_way_slab(request)

    if (not two_way) and code == "EC2" and _ONE_WAY_ENGINE:
        return _calculate_one_way_slab(request)

    # Every EC2 slab goes to one of the two engines above, and the request
    # model rejects every other code, so this line is reached only if an
    # engine module failed to import. The old non-EC2 fallback (BS 8110
    # coefficients, fixed d, no front matter) was removed on 2026-10-03
    # rather than left to run unreviewed.
    raise RuntimeError(
        f"No slab design engine for slab_type={slab_type_val}, continuity={continuity_val}, code={code} "
        f"(two-way engine loaded: {_TWO_WAY_ENGINE}, one-way engine loaded: {_ONE_WAY_ENGINE})."
    )


def _calculate_two_way_slab(request: SlabDesignRequest) -> SlabDesignResult:
    import math as _m

    g = request.geometry
    mats = request.materials
    loads = request.loads
    dp = request.design_params

    api_dead_extra = (loads.dead_load or 0) + (loads.floor_finish or 0) + (loads.additional_dead_load or 0)
    api_live = (loads.live_load or 0) + (loads.additional_live_load or 0)
    gk_finish = api_dead_extra if api_dead_extra > 0 else None
    gk_partition = 0.0 if api_dead_extra > 0 else None
    gk_services = 0.0 if api_dead_extra > 0 else None
    qk_imposed = api_live if api_live > 0 else None

    is_ssss = _enum(request.continuity) == "all_edges_discontinuous"
    edge = None if is_ssss else _TWEdge(_EDGE_MAP[_enum(request.continuity)])

    inp = TwoWaySlabInput(
        lx_m=g.span_lx,
        ly_m=g.span_ly,
        support_condition=_TWSupport.SSSS_2W if is_ssss else _TWSupport.TWO_WAY_BEAM_SUPPORTED,
        panel_type=_TWPanel.TWO_WAY,
        edge_condition=edge,
        concrete_grade=mats.concrete_grade,
        steel_grade=mats.steel_grade,
        building_use=getattr(request, "building_use", "office"),
        partition_mode=_TWPart.PERMANENT_GK,
        exposure_class=_enum(dp.exposure_class),
        thickness_mm=int(g.thickness) if g.thickness else None,
        cover_mm=g.clear_cover if g.clear_cover is not None else None,
        gk_finish_kN_m2=gk_finish,
        gk_partition_kN_m2=gk_partition,
        gk_services_kN_m2=gk_services,
        qk_imposed_kN_m2=qk_imposed,
        candidate_bar_diameters_mm=request.bar_diameters or None,
    )

    res = TwoWaySlabDesigner(inp).run()

    max_sag = max(res.MEd_x_pos_kN_m_per_m, res.MEd_y_pos_kN_m_per_m)
    max_hog = max(res.MEd_x_neg_kN_m_per_m, res.MEd_y_neg_kN_m_per_m)
    v_ed_kn = 0.5 * res.wEd_area_kN_m2 * inp.lx_m

    fck = res.coefficients_used.get("fck") if res.coefficients_used else None
    from_fck = None
    try:
        from_fck = float(str(mats.concrete_grade).upper().replace("C", "").replace("M", "").split("/")[0])
    except (ValueError, IndexError):
        from_fck = 30.0
    fck = from_fck
    b, d = 1000.0, res.d_mm
    as_prov_x = res.main_x.As_provided_mm2_per_m if res.main_x else 0.0
    rho = min(as_prov_x / (b * d), 0.02) if d else 0.0
    kf = min(2.0, 1 + _m.sqrt(200 / d)) if d else 1.0
    v_min = 0.035 * kf ** 1.5 * _m.sqrt(fck)
    v_rdc = max(0.12 * kf * (100 * rho * fck) ** (1 / 3), v_min) * b * d
    shear_status = "PASS" if v_ed_kn * 1000 <= v_rdc else "FAIL"

    rates_path = os.path.join(os.path.dirname(__file__), '..', 'engine', 'rates_db.json')
    try:
        with open(rates_path, 'r') as fp:
            rates_db = json.load(fp)
    except FileNotFoundError:
        rates_db = {}
    conc_tbl, steel_tbl, formwork_rate = resolve_rates(rates_db, request.region)
    concrete_rate = _rate(conc_tbl, mats.concrete_grade, 105000)
    steel_rate = _rate(steel_tbl, mats.steel_grade, 950000)
    volume_concrete = res.thickness_mm / 1000.0 * 1.0
    cost_concrete = volume_concrete * concrete_rate
    steel_weight = (as_prov_x + (res.main_y.As_provided_mm2_per_m if res.main_y else 0)) * 1.0 * 7850 / 1e6
    cost_steel = steel_weight * steel_rate / 1000
    cost_formwork = 1.0 * formwork_rate
    total_cost = cost_concrete + cost_steel + cost_formwork
    slab_area = inp.lx_m * inp.ly_m

    util = 0.0
    if res.main_x and res.As_req_x_main:
        util = min(res.As_req_x_main / res.main_x.As_provided_mm2_per_m, 1.0)

    bx = res.main_x.bar_dia_mm if res.main_x else 0
    sx = res.main_x.spacing_mm if res.main_x else 0

    summary = DesignSummary(
        status=res.overall_status, slab_type="Two-Way Slab",
        continuity=_enum(request.continuity).replace("_", " ").title(),
        span_lx=inp.lx_m, span_ly=inp.ly_m, thickness=res.thickness_mm, effective_depth=round(res.d_mm, 1), clear_cover=round(res.cover_mm, 1),
        concrete_grade=mats.concrete_grade, steel_grade=mats.steel_grade,
        selected_bar_diameter=bx, selected_spacing=sx,
        total_cost=round(total_cost * slab_area, 2), optimization_rank=1, utilization_ratio=round(util, 2),
    )

    design_forces = DesignForces(
        max_sagging_moment=round(max_sag, 2),
        max_hogging_moment=round(-max_hog, 2),
        max_shear_force=round(v_ed_kn, 2),
        ultimate_load=round(res.wEd_area_kN_m2, 2),
        service_load=round(res.Gk_total + res.Qk_total, 2),
    )

    reinforcement = ReinforcementDetails(
        bottom_steel={
            "direction": "Both Directions (Sagging)",
            "bar_diameter": bx, "spacing": sx,
            "area_provided": round(as_prov_x, 1), "area_required": round(res.As_target_x, 1),
        },
        top_steel={
            "direction": "Both Directions (Hogging / Supports)",
            "bar_diameter": bx, "spacing": sx,
            "area_provided": round(as_prov_x, 1), "area_required": round(res.As_req_x_neg, 1),
        },
    )

    deflection = DeflectionResult(
        actual_deflection=round(res.l_over_d_actual, 1),
        allowable_deflection=round(res.l_over_d_lim_final, 1),
        status=res.deflection_status,
        ratio=round(res.l_over_d_actual / res.l_over_d_lim_final, 2) if res.l_over_d_lim_final else 0,
    )

    shear = ShearResult(
        design_shear=round(v_ed_kn, 2), shear_resistance=round(v_rdc / 1000, 2),
        status=shear_status, ratio=round(v_ed_kn * 1000 / v_rdc, 2) if v_rdc else 0,
    )

    compliance = [
        ComplianceCheck(check="Bending — short span (x)", status=res.bending_status_x,
                        ratio=round(res.As_req_x_main / as_prov_x, 2) if as_prov_x else 0, limit=1.0),
        ComplianceCheck(check="Bending — long span (y)", status=res.bending_status_y,
                        ratio=round(res.As_req_y_main / res.main_y.As_provided_mm2_per_m, 2) if res.main_y and res.main_y.As_provided_mm2_per_m else 0, limit=1.0),
        ComplianceCheck(check="Minimum reinforcement", status=res.min_steel_status_x,
                        ratio=round(res.As_min / as_prov_x, 2) if as_prov_x else 0, limit=1.0, note="As,prov ≥ As,min"),
        ComplianceCheck(check="Deflection (span/depth)", status=res.deflection_status,
                        ratio=round(res.l_over_d_actual / res.l_over_d_lim_final, 2) if res.l_over_d_lim_final else 0, limit=1.0),
        ComplianceCheck(check="Shear (V_Ed / V_Rd,c)", status=shear_status,
                        ratio=round(v_ed_kn * 1000 / v_rdc, 2) if v_rdc else 0, limit=1.0),
    ]

    cost_breakdown = CostBreakdown(
        concrete={"volume": round(volume_concrete, 3), "rate": concrete_rate, "cost": round(cost_concrete, 2)},
        steel={"weight": round(steel_weight, 1), "rate": steel_rate / 1000, "cost": round(cost_steel, 2)},
        formwork={"area": 1.0, "rate": formwork_rate, "cost": round(cost_formwork, 2)},
        total=round(total_cost, 2),
        total_per_sqm=round(total_cost / slab_area, 2) if slab_area else 0,
    )

    optimization_options = [OptimizationOption(
        rank=1, thickness=res.thickness_mm, bar_diameter=bx, spacing=sx,
        cost=round(total_cost * slab_area, 2), status=res.overall_status, utilization_ratio=round(util, 2),
    )]

    report = (_slab_front_matter(request, compliance, True, inp, res)
              + _build_two_way_report(inp, res, fck, v_ed_kn, v_rdc, shear_status))

    return SlabDesignResult(
        task_id="completed", status="completed", summary=summary, design_forces=design_forces,
        reinforcement=reinforcement, deflection=deflection, shear=shear, compliance=compliance,
        cost_breakdown=cost_breakdown, optimization_options=optimization_options, report=report,
    )


def _build_two_way_report(inp, res, fck, v_ed_kn, v_rdc, shear_status):
    R = lambda ref, calc, out: {"reference": ref, "calculation": calc, "output": out}
    mat = _TWMaterial(concrete_grade=inp.concrete_grade, steel_grade=inp.steel_grade)
    fyk = mat.fyk
    fyd = mat.fyd
    fcd = mat.fcd
    fctm = mat.fctm
    b = 1000.0
    d = res.d_mm
    z = res.z_mm
    is_ssss = "elastic plate" in (res.analysis_method_used or "").lower()
    main_bar = res.main_x.bar_dia_mm if res.main_x else (inp.main_bar_diameter_mm or 12)
    sec = []

    sec.append({"title": "1. Design Basis and References", "rows": [
        R("EN 1990", "Basis of structural design \u2014 ULS combination Eq. 6.10", "adopted"),
        R("EN 1991-1-1", "Actions: densities, self-weight (\u00a73.2.1), imposed loads (Table 6.2)", "adopted"),
        R("EN 1992-1-1", "Concrete design \u2014 \u00a76.1 flexure, \u00a76.2.2 shear, \u00a77.4.2 deflection, \u00a79.2.1.1 min steel", "adopted"),
        R("UK NA", "National Annex to EN 1992-1-1", "adopted"),
        R("Concrete Centre Table 8" if not is_ssss else "Elastic plate theory",
          "two-way panel supported on four sides, uniformly distributed load" if not is_ssss
          else "no continuity on any edge -- moments from Navier double sine-series, not a coefficient table",
          res.analysis_method_used),
        R("Design panel", f"Lx (short span) = {inp.lx_m:.2f} m ; Ly (long span) = {inp.ly_m:.2f} m", f"r = Ly/Lx = {res.aspect_ratio_r:.3f}"),
    ]})

    geom_rows = [
        R("Geometry", f"Lx = {inp.lx_m:.2f} m ; Ly = {inp.ly_m:.2f} m ; overall thickness h = {res.thickness_mm:.0f} mm", f"h = {res.thickness_mm:.0f} mm"),
    ]
    if inp.cover_mm is not None:
        geom_rows += [
            R("Cover input", f"clear cover specified by user, Cc = {inp.cover_mm:.0f} mm", f"Cc,input = {inp.cover_mm:.0f} mm"),
            R("Tolerance", "a fixed 5 mm fixing/detailing allowance is added to the clear cover specified above -- this is not user-editable", f"+{inp.delta_c_dev_mm:.0f} mm"),
            R("Cover used", f"Cc,used = Cc,input + {inp.delta_c_dev_mm:.0f} mm = {inp.cover_mm:.0f} + {inp.delta_c_dev_mm:.0f}", f"Cc = {res.cover_mm:.0f} mm"),
        ]
    else:
        geom_rows += [
            R("EC2 \u00a74.4.1.2", f"c_min,b = max(main bar \u03c6, 20) = max({main_bar:.0f}, 20)", f"c_min,b = {res.c_min_b_mm:.0f} mm"),
            R("EC2 \u00a74.4.1.2", f"c_min,dur (exposure {inp.exposure_class})", f"c_min,dur = {res.c_min_dur_mm:.0f} mm"),
            R("EC2 \u00a74.4.1.2", f"c_min = max(c_min,b , c_min,dur , 10) = max({res.c_min_b_mm:.0f}, {res.c_min_dur_mm:.0f}, 10)", f"c_min = {res.c_min_mm:.0f} mm"),
            R("EC2 \u00a74.4.1.2", f"c_nom = c_min + \u0394c_dev = {res.c_min_mm:.0f} + {res.delta_c_dev_mm:.0f} (auto-derived -- no user cover supplied)", f"Cc = {res.cover_mm:.0f} mm"),
        ]
    geom_rows += [
        R("Bar assumed", f"governing main bar \u03c6 = {main_bar:.0f} mm  \u2192  \u03c6/2 = {main_bar/2:.1f} mm", f"\u03c6 = {main_bar:.0f} mm"),
        R("EC2 \u00a76.1", f"d = h \u2212 Cc \u2212 \u03c6/2 = {res.thickness_mm:.0f} \u2212 {res.cover_mm:.0f} \u2212 {main_bar/2:.1f}", f"d = {d:.0f} mm"),
        R("EC2 \u00a76.1", f"z = 0.9d (fixed lever-arm assumption for two-way slabs, not iterated via K) = 0.9 \u00d7 {d:.0f}", f"z = {z:.0f} mm"),
        R("EC2 Table 3.1", f"f_ctm = 0.30 \u00d7 f_ck^(2/3) = 0.30 \u00d7 {fck:.0f}^(2/3) = 0.30 \u00d7 {fck**(2/3):.3f}", f"f_ctm = {fctm:.2f} MPa"),
        R("EC2 \u00a73.1.6", f"f_cd = \u03b1_cc\u00b7f_ck/\u03b3_c = {mat.alpha_cc:.2f} \u00d7 {fck:.0f}/1.50", f"f_cd = {fcd:.2f} MPa"),
        R("EC2 \u00a73.2.7", f"f_yd = f_yk/\u03b3_s = {fyk:.0f}/1.15", f"f_yd = {fyd:.1f} MPa"),
    ]
    sec.append({"title": "2. Geometry, Cover and Materials", "rows": geom_rows})

    sec.append({"title": "3. Permanent Loads (Load Analysis)", "rows": [
        R("EN 1991-1-1 \u00a73.2.1", f"Self-weight of slab = \u03b3_c \u00d7 h = 25 kN/m\u00b3 \u00d7 {res.thickness_mm/1000:.3f}m", f"{res.gk_self_kN_m2:.2f} kN/m\u00b2"),
        R("User input / auto default", "Weight of finishes", f"{res.gk_finish_kN_m2:.2f} kN/m\u00b2"),
        R("User input / auto default", "Partition allowance", f"{res.gk_partition_kN_m2:.2f} kN/m\u00b2"),
        R("User input / auto default", "Services allowance", f"{res.gk_services_kN_m2:.2f} kN/m\u00b2"),
        R("Total dead load", f"G_k = self-weight + finishes + partition + services = {res.gk_self_kN_m2:.2f} + {res.gk_finish_kN_m2:.2f} + {res.gk_partition_kN_m2:.2f} + {res.gk_services_kN_m2:.2f}", f"G_k = {res.Gk_total:.2f} kN/m\u00b2"),
    ]})

    sec.append({"title": "4. Variable Load on Slab", "rows": [
        R("EN 1991-1-1 Table 6.2", f"Leading variable action (imposed load), based on building use ({inp.building_use})", f"{res.qk_imposed_kN_m2:.2f} kN/m\u00b2"),
        R("Total variable load", "Q_k = imposed load (no separate extra live load input in this engine)", f"Q_k = {res.Qk_total:.2f} kN/m\u00b2"),
    ]})

    pg, pq = 1.35 * res.Gk_total, 1.50 * res.Qk_total
    sec.append({"title": "5. Ultimate Limit State Combination", "rows": [
        R("EN 1990 Eq. 6.10", "w_Ed = \u03b3_Gk\u00b7G_k + \u03b3_Qk\u00b7Q_k", "combination adopted"),
        R("Partial factors", "\u03b3_Gk = 1.35 (permanent) ; \u03b3_Qk = 1.50 (variable)", "EN 1990 Table A1.2(B)"),
        R("Substitution", f"w_Ed = (1.35 \u00d7 {res.Gk_total:.2f}) + (1.50 \u00d7 {res.Qk_total:.2f}) = {pg:.4f} + {pq:.4f}", f"w_Ed = {res.wEd_area_kN_m2:.4f} kN/m\u00b2"),
    ]})

    if is_ssss:
        moment_rows = [
            R("Elastic plate theory", "Navier double sine-series solution for a rectangular plate simply supported on all four edges, no continuity anywhere so no coefficient table applies", res.analysis_method_used),
            R("Governing assumption", "Poisson's ratio \u03bd = 0.20 ; series evaluated at panel centre (x=Lx/2, y=Ly/2) for maximum sagging moment", "9\u00d79 term series (odd m,n)"),
            R("Series form", "w(x,y) = \u03a3\u03a3 Wmn\u00b7sin(m\u03c0x/Lx)\u00b7sin(n\u03c0y/Ly) ; Mx = \u2212(\u2202\u00b2w/\u2202x\u00b2 + \u03bd\u00b7\u2202\u00b2w/\u2202y\u00b2), My = \u2212(\u2202\u00b2w/\u2202y\u00b2 + \u03bd\u00b7\u2202\u00b2w/\u2202x\u00b2)", "evaluated numerically"),
            R("Moment", f"M_x,pos = \u03a3\u03a3 term at panel centre, w_Ed = {res.wEd_area_kN_m2:.2f} kN/m\u00b2", f"M_x,pos = {res.MEd_x_pos_kN_m_per_m:.2f} kNm/m"),
            R("Moment", "M_x,neg -- no continuous edge anywhere, hogging is exactly zero by definition", f"M_x,neg = {res.MEd_x_neg_kN_m_per_m:.2f} kNm/m"),
            R("Moment", f"M_y,pos = \u03a3\u03a3 term at panel centre", f"M_y,pos = {res.MEd_y_pos_kN_m_per_m:.2f} kNm/m"),
            R("Moment", "M_y,neg -- no continuous edge anywhere, hogging is exactly zero by definition", f"M_y,neg = {res.MEd_y_neg_kN_m_per_m:.2f} kNm/m"),
        ]
    else:
        moment_rows = [
            R("Concrete Centre Table 8", f"edge condition selected, coefficients interpolated at r = {res.aspect_ratio_r:.3f} (clamped 1.0\u20132.0 for table lookup)", "interpolated"),
            R("\u03b1_x,neg", f"short-span hogging coefficient at continuous edge, interpolated at r = {res.aspect_ratio_r:.3f}", f"\u03b1_x,neg = {res.alpha_x_neg or 0:.4f}"),
            R("\u03b1_x,pos", f"short-span sagging coefficient at mid-span, interpolated at r = {res.aspect_ratio_r:.3f}", f"\u03b1_x,pos = {res.alpha_x_pos or 0:.4f}"),
            R("\u03b1_y,neg", "long-span hogging coefficient (constant across r for a given edge condition)", f"\u03b1_y,neg = {res.alpha_y_neg or 0:.4f}"),
            R("\u03b1_y,pos", "long-span sagging coefficient (constant across r for a given edge condition)", f"\u03b1_y,pos = {res.alpha_y_pos or 0:.4f}"),
            R("Moment", f"M_x,neg = \u03b1_x,neg \u00d7 w_Ed \u00d7 Lx\u00b2 = {res.alpha_x_neg or 0:.4f} \u00d7 {res.wEd_area_kN_m2:.2f} \u00d7 {inp.lx_m:.2f}\u00b2", f"M_x,neg = {res.MEd_x_neg_kN_m_per_m:.2f} kNm/m"),
            R("Moment", f"M_x,pos = \u03b1_x,pos \u00d7 w_Ed \u00d7 Lx\u00b2 = {res.alpha_x_pos or 0:.4f} \u00d7 {res.wEd_area_kN_m2:.2f} \u00d7 {inp.lx_m:.2f}\u00b2", f"M_x,pos = {res.MEd_x_pos_kN_m_per_m:.2f} kNm/m"),
            R("Moment", f"M_y,neg = \u03b1_y,neg \u00d7 w_Ed \u00d7 Lx\u00b2 = {res.alpha_y_neg or 0:.4f} \u00d7 {res.wEd_area_kN_m2:.2f} \u00d7 {inp.lx_m:.2f}\u00b2  (note: uses Lx\u00b2, not Ly\u00b2, per the source table convention)", f"M_y,neg = {res.MEd_y_neg_kN_m_per_m:.2f} kNm/m"),
            R("Moment", f"M_y,pos = \u03b1_y,pos \u00d7 w_Ed \u00d7 Lx\u00b2 = {res.alpha_y_pos or 0:.4f} \u00d7 {res.wEd_area_kN_m2:.2f} \u00d7 {inp.lx_m:.2f}\u00b2", f"M_y,pos = {res.MEd_y_pos_kN_m_per_m:.2f} kNm/m"),
        ]
    sec.append({"title": "6. Two-Way Moment Analysis", "rows": moment_rows})

    x_rows = [
        R("EC2 \u00a76.2.3", f"A_s,x,pos = M_x,pos\u00d710\u2076/(f_yd\u00b7z) = ({res.MEd_x_pos_kN_m_per_m:.2f} \u00d7 10\u2076)/({fyd:.1f} \u00d7 {z:.0f})", f"A_s,x,pos = {res.As_req_x_pos:.0f} mm\u00b2/m"),
    ]
    if res.MEd_x_neg_kN_m_per_m > 0:
        x_rows.append(R("EC2 \u00a76.2.3", f"A_s,x,neg = M_x,neg\u00d710\u2076/(f_yd\u00b7z) = ({res.MEd_x_neg_kN_m_per_m:.2f} \u00d7 10\u2076)/({fyd:.1f} \u00d7 {z:.0f})", f"A_s,x,neg = {res.As_req_x_neg:.0f} mm\u00b2/m"))
    x_rows.append(R("Governing", f"A_s,x,main = max(A_s,x,pos , A_s,x,neg) = max({res.As_req_x_pos:.0f} , {res.As_req_x_neg:.0f})", f"A_s,x,main = {res.As_req_x_main:.0f} mm\u00b2/m"))
    sec.append({"title": "7. Flexural Reinforcement \u2014 Short Span (X)", "rows": x_rows})

    y_rows = [
        R("EC2 \u00a76.2.3", f"A_s,y,pos = M_y,pos\u00d710\u2076/(f_yd\u00b7z) = ({res.MEd_y_pos_kN_m_per_m:.2f} \u00d7 10\u2076)/({fyd:.1f} \u00d7 {z:.0f})", f"A_s,y,pos = {res.As_req_y_pos:.0f} mm\u00b2/m"),
    ]
    if res.MEd_y_neg_kN_m_per_m > 0:
        y_rows.append(R("EC2 \u00a76.2.3", f"A_s,y,neg = M_y,neg\u00d710\u2076/(f_yd\u00b7z) = ({res.MEd_y_neg_kN_m_per_m:.2f} \u00d7 10\u2076)/({fyd:.1f} \u00d7 {z:.0f})", f"A_s,y,neg = {res.As_req_y_neg:.0f} mm\u00b2/m"))
    y_rows.append(R("Governing", f"A_s,y,main = max(A_s,y,pos , A_s,y,neg) = max({res.As_req_y_pos:.0f} , {res.As_req_y_neg:.0f})", f"A_s,y,main = {res.As_req_y_main:.0f} mm\u00b2/m"))
    sec.append({"title": "8. Flexural Reinforcement \u2014 Long Span (Y)", "rows": y_rows})

    gov = "concrete tensile strength basis" if res.As_min_1 >= res.As_min_2 else "0.13% minimum basis"
    sec.append({"title": "9. Minimum Reinforcement Check", "rows": [
        R("EC2 \u00a79.2.1.1", "A_s,min = max( 0.26\u00b7f_ctm/f_yk\u00b7b\u00b7d , 0.0013\u00b7b\u00b7d )  \u2014 same d used for both directions", "As,min formula"),
        R("Basis 1 \u2014 concrete tensile strength", f"0.26 \u00d7 f_ctm/f_yk \u00d7 b\u00b7d = 0.26 \u00d7 {fctm:.2f}/{fyk:.0f} \u00d7 {b:.0f}\u00d7{d:.0f}", f"{res.As_min_1:.0f} mm\u00b2/m"),
        R("Basis 2 \u2014 0.13% of section", f"0.0013 \u00d7 b\u00b7d = 0.0013 \u00d7 {b:.0f}\u00d7{d:.0f}", f"{res.As_min_2:.0f} mm\u00b2/m"),
        R("Governing", f"A_s,min = max({res.As_min_1:.0f} , {res.As_min_2:.0f})  \u2190 {gov} governs", f"A_s,min = {res.As_min:.0f} mm\u00b2/m"),
        R("Target \u2014 X", f"A_s,target,x = max(A_s,x,main , A_s,min) = max({res.As_req_x_main:.0f} , {res.As_min:.0f})", f"A_s,target,x = {res.As_target_x:.0f} mm\u00b2/m"),
        R("Target \u2014 Y", f"A_s,target,y = max(A_s,y,main , A_s,min) = max({res.As_req_y_main:.0f} , {res.As_min:.0f})", f"A_s,target,y = {res.As_target_y:.0f} mm\u00b2/m"),
    ]})

    s_max = min(3 * res.thickness_mm, 400)
    bar_rows = []
    if res.main_x:
        Ab_x = math.pi * res.main_x.bar_dia_mm ** 2 / 4.0
        bar_rows += [
            R("Bar area \u2014 X", f"A_bar = \u03c0\u03c6\u00b2/4 = \u03c0 \u00d7 {res.main_x.bar_dia_mm}\u00b2/4", f"A_bar = {Ab_x:.1f} mm\u00b2"),
            R("Spacing required \u2014 X", f"s \u2264 A_bar \u00d7 1000/A_s,target,x = {Ab_x:.1f} \u00d7 1000/{res.As_target_x:.0f}", f"adopt s = {res.main_x.spacing_mm} mm"),
            R("Provided \u2014 X", f"A_s,prov,x = A_bar \u00d7 (1000/s) = {Ab_x:.1f} \u00d7 (1000/{res.main_x.spacing_mm})", f"A_s,prov,x = {res.main_x.As_provided_mm2_per_m:.0f} mm\u00b2/m"),
            R("Check \u2014 X", f"A_s,prov,x \u2265 A_s,target,x \u2192 {res.main_x.As_provided_mm2_per_m:.0f} \u2265 {res.As_target_x:.0f}", "OK" if res.main_x.As_provided_mm2_per_m >= res.As_target_x else "INCREASE STEEL"),
            R("EC2 \u00a79.3.1.1 \u2014 X", f"max spacing = min(3h, 400) = min({3*res.thickness_mm:.0f}, 400) = {s_max:.0f} mm ; provided {res.main_x.spacing_mm} mm", "OK" if res.main_x.spacing_mm <= s_max else "SPACING TOO WIDE"),
            R("Provide \u2014 X (short span)", f"T{res.main_x.bar_dia_mm} @ {res.main_x.spacing_mm} mm c/c", f"T{res.main_x.bar_dia_mm} @ {res.main_x.spacing_mm}"),
        ]
    if res.main_y:
        Ab_y = math.pi * res.main_y.bar_dia_mm ** 2 / 4.0
        bar_rows += [
            R("Bar area \u2014 Y", f"A_bar = \u03c0\u03c6\u00b2/4 = \u03c0 \u00d7 {res.main_y.bar_dia_mm}\u00b2/4", f"A_bar = {Ab_y:.1f} mm\u00b2"),
            R("Spacing required \u2014 Y", f"s \u2264 A_bar \u00d7 1000/A_s,target,y = {Ab_y:.1f} \u00d7 1000/{res.As_target_y:.0f}", f"adopt s = {res.main_y.spacing_mm} mm"),
            R("Provided \u2014 Y", f"A_s,prov,y = A_bar \u00d7 (1000/s) = {Ab_y:.1f} \u00d7 (1000/{res.main_y.spacing_mm})", f"A_s,prov,y = {res.main_y.As_provided_mm2_per_m:.0f} mm\u00b2/m"),
            R("Check \u2014 Y", f"A_s,prov,y \u2265 A_s,target,y \u2192 {res.main_y.As_provided_mm2_per_m:.0f} \u2265 {res.As_target_y:.0f}", "OK" if res.main_y.As_provided_mm2_per_m >= res.As_target_y else "INCREASE STEEL"),
            R("EC2 \u00a79.3.1.1 \u2014 Y", f"max spacing = min(3h, 400) = {s_max:.0f} mm ; provided {res.main_y.spacing_mm} mm", "OK" if res.main_y.spacing_mm <= s_max else "SPACING TOO WIDE"),
            R("Provide \u2014 Y (long span)", f"T{res.main_y.bar_dia_mm} @ {res.main_y.spacing_mm} mm c/c", f"T{res.main_y.bar_dia_mm} @ {res.main_y.spacing_mm}"),
        ]
    sec.append({"title": "10. Bar Selection \u2014 X and Y", "rows": bar_rows})

    if res.dist_x or res.dist_y:
        dist_rows = [
            R("Note", "this engine also computes a third, tertiary steel layer using one-way-slab distribution-steel rules (>=50% of main steel, not less than T8@250). For a genuine two-way slab, X and Y are both primary reinforcement directions -- confirm with your design basis whether a separate distribution layer is actually required here, or whether this section should be disregarded.", ""),
            R("Target \u2014 X", f"0.50 \u00d7 A_s,prov,x = 0.50 \u00d7 {res.main_x.As_provided_mm2_per_m:.0f}" if res.main_x else "-", f"{res.dist_target_x:.0f} mm\u00b2/m"),
            R("Target \u2014 Y", f"0.50 \u00d7 A_s,prov,y = 0.50 \u00d7 {res.main_y.As_provided_mm2_per_m:.0f}" if res.main_y else "-", f"{res.dist_target_y:.0f} mm\u00b2/m"),
            R("Minimum", "not less than T8 @ 250 = \u03c0\u00d78\u00b2/4 \u00d7 1000/250", f"{res.dist_minimum:.0f} mm\u00b2/m"),
        ]
        if res.dist_x:
            dist_rows.append(R("Provided \u2014 X", f"T{res.dist_x.bar_dia_mm} @ {res.dist_x.spacing_mm} mm c/c", f"{res.dist_x.As_provided_mm2_per_m:.0f} mm\u00b2/m"))
        if res.dist_y:
            dist_rows.append(R("Provided \u2014 Y", f"T{res.dist_y.bar_dia_mm} @ {res.dist_y.spacing_mm} mm c/c", f"{res.dist_y.As_provided_mm2_per_m:.0f} mm\u00b2/m"))
        sec.append({"title": "11. Distribution Steel (Tertiary Layer)", "rows": dist_rows})

    branch = "A (\u03c1 \u2264 \u03c1\u2080, lightly reinforced)" if res.rho <= res.rho_0 else "B (\u03c1 > \u03c1\u2080, heavily reinforced)"
    deflection_rows = [
        R("Note", "for two-way spanning slabs, the check is carried out based on the shorter span (Lx)", ""),
        R("Note", "K = 1.0 simply supported / 1.5 interior span / 1.3 end span / 0.4 cantilever \u2014 graded here by how many edges remain continuous (engineering judgement, see engine notes)", f"K = {res.K_deflection:.2f}"),
        R("Basic span/depth ratio", f"\u03c1 = A_s,x,main/(b\u00b7d) = {res.As_req_x_main:.0f}/({b:.0f}\u00d7{d:.0f})", f"\u03c1 = {res.rho:.5f}"),
        R("Basic span/depth ratio", f"\u03c1\u2080 = 10\u207b\u00b3 \u00d7 \u221af_ck = 10\u207b\u00b3 \u00d7 \u221a{fck:.0f}", f"\u03c1\u2080 = {res.rho_0:.5f}"),
        R("Branch", f"\u03c1 = {res.rho:.5f} vs \u03c1\u2080 = {res.rho_0:.5f}", f"branch {branch}"),
        R("EC2 \u00a77.4.2 \u2014 Branch A", f"Eq. 7.16a: K[11 + 1.5\u221af_ck\u00b7(\u03c1\u2080/\u03c1) + 3.2\u221af_ck\u00b7(\u03c1\u2080/\u03c1 \u2212 1)^1.5] with \u03c1\u2080/\u03c1 = {res.rho_0:.5f}/{max(res.rho,1e-9):.5f}", f"{res.l_over_d_lim_branch_A:.2f}" if res.rho <= res.rho_0 else "not used (ρ > ρ₀)"),
        R("EC2 \u00a77.4.2 \u2014 Branch B", f"Eq. 7.16b (\u03c1' = 0): K[11 + 1.5\u221af_ck\u00b7\u03c1\u2080/\u03c1] = {res.K_deflection:.2f}[11 + 1.5\u221a{fck:.0f}\u00d7{res.rho_0:.5f}/{max(res.rho,1e-9):.5f}]", f"{res.l_over_d_lim_branch_B:.2f}" if res.rho > res.rho_0 else "not used (ρ ≤ ρ₀)"),
        R("Basic limit selected", f"(L/d)_basic = branch {'A' if res.rho <= res.rho_0 else 'B'}", f"{res.l_over_d_lim_basic:.2f}"),
        R("Actual deflection", f"(L/d)_actual = Lx/d = {inp.lx_m*1000:.0f}/{d:.0f}", f"{res.l_over_d_actual:.2f}"),
        R("Base check", f"(L/d)_actual {'\u2264' if res.deflection_base_status == 'PASS' else '>'} (L/d)_basic (before any enhancement) \u2192 {res.l_over_d_actual:.2f} {'\u2264' if res.deflection_base_status == 'PASS' else '>'} {res.l_over_d_lim_basic:.2f}",
          res.deflection_base_status),
    ]
    if res.deflection_enhanced:
        deflection_rows += [
            R("Enhancement factor", f"base check failed \u2192 F3 = A_s,prov,x/A_s,x,main = {res.main_x.As_provided_mm2_per_m:.0f}/{res.As_req_x_main:.0f}  (\u2264 1.5)" if res.main_x and res.As_req_x_main else "F3 = 1.0 (no governing moment)", f"F3 = {res.F3:.3f}"),
            R("Allowable span/depth ratio", f"(L/d)_allow = (L/d)_basic \u00d7 F3 = {res.l_over_d_lim_basic:.2f} \u00d7 {res.F3:.3f}", f"{res.l_over_d_lim_final:.2f}"),
        ]
    else:
        deflection_rows.append(
            R("Enhancement factor", "base check already passes \u2014 F3 not required", "F3 not applied")
        )
    deflection_rows.append(
        R("Verdict", f"(L/d)_actual {'<' if res.deflection_status == 'PASS' else '>'} allowable (L/d) \u2192 {res.l_over_d_actual:.2f} {'<' if res.deflection_status == 'PASS' else '>'} {res.l_over_d_lim_final:.2f}",
          "Deflection is okay" if res.deflection_status == "PASS" else "Deflection is NOT okay \u2014 increase depth or steel")
    )
    sec.append({"title": "12. Check for Deflection", "rows": deflection_rows})

    sec.append({"title": "13. Shear Check (EC2 \u00a76.2.2)", "rows": [
        R("Note", f"the engine itself flags shear as '{res.shear_status}' for two-way panels (punching shear on column-supported slabs is a separate check not covered here) -- the verification below is computed independently in the service layer as a standard one-way-strip EC2 \u00a76.2.2 check along the short span, for reference", ""),
        R("Design shear", f"V_Ed \u2248 0.5 \u00d7 w_Ed \u00d7 Lx = 0.5 \u00d7 {res.wEd_area_kN_m2:.2f} \u00d7 {inp.lx_m:.2f}", f"V_Ed = {v_ed_kn:.2f} kN/m"),
        R("EC2 \u00a76.2.2", f"V_Rd,c per EC2 \u00a76.2.2, using A_s,prov,x and d as computed above", f"V_Rd,c = {v_rdc/1000:.2f} kN/m"),
        R("Verdict", f"V_Rd,c {'>' if shear_status == 'PASS' else '\u2264'} V_Ed \u2192 {v_rdc/1000:.2f} {'>' if shear_status == 'PASS' else '\u2264'} {v_ed_kn:.2f}", shear_status),
    ]})

    summary_rows = [
        R("Section", f"h = {res.thickness_mm:.0f} mm ; d = {d:.0f} mm ; z = {z:.0f} mm ; cover used = {res.cover_mm:.0f} mm", f"{res.thickness_mm:.0f} mm slab"),
        R("Panel", f"Lx = {inp.lx_m:.2f} m ; Ly = {inp.ly_m:.2f} m ; r = {res.aspect_ratio_r:.3f}", res.analysis_method_used),
        R("Loading", f"G_k = {res.Gk_total:.2f} ; Q_k = {res.Qk_total:.2f} \u2192 w_Ed = {res.wEd_area_kN_m2:.2f} kN/m\u00b2", f"w_Ed = {res.wEd_area_kN_m2:.2f} kN/m\u00b2"),
        R("Actions", f"M_x: +{res.MEd_x_pos_kN_m_per_m:.2f} / \u2212{res.MEd_x_neg_kN_m_per_m:.2f} kNm/m ; M_y: +{res.MEd_y_pos_kN_m_per_m:.2f} / \u2212{res.MEd_y_neg_kN_m_per_m:.2f} kNm/m", "ULS"),
        R("Steel \u2014 X", f"A_s,target,x = {res.As_target_x:.0f} mm\u00b2/m \u2192 provided {res.main_x.As_provided_mm2_per_m:.0f} mm\u00b2/m" if res.main_x else "-",
          f"T{res.main_x.bar_dia_mm} @ {res.main_x.spacing_mm}" if res.main_x else "-"),
        R("Steel \u2014 Y", f"A_s,target,y = {res.As_target_y:.0f} mm\u00b2/m \u2192 provided {res.main_y.As_provided_mm2_per_m:.0f} mm\u00b2/m" if res.main_y else "-",
          f"T{res.main_y.bar_dia_mm} @ {res.main_y.spacing_mm}" if res.main_y else "-"),
        R("Deflection", f"actual {res.l_over_d_actual:.2f} vs allowable {res.l_over_d_lim_final:.2f}", res.deflection_status),
        R("Shear", f"V_Ed {v_ed_kn:.2f} vs V_Rd,c {v_rdc/1000:.2f} kN/m", shear_status),
        R("Bending / min steel checks", f"x: {res.bending_status_x}/{res.min_steel_status_x}  y: {res.bending_status_y}/{res.min_steel_status_y}", ""),
        R("Overall", "all ULS and SLS checks", res.overall_status),
    ]
    for n in res.notes:
        summary_rows.append(R("Note", n, ""))
    summary_rows += [
        R("Note", "Effective depth and lever arm use a single d/z for both directions -- standard simplification for slabs where the two reinforcement layers are close together relative to overall depth.", ""),
        R("Note", "Cover = clear cover input + fixed detailing tolerance (or fully auto-derived from exposure class if no cover was supplied).", ""),
    ]
    sec.append({"title": "14. Design Summary", "rows": summary_rows})

    return sec


def _calculate_one_way_slab(request: SlabDesignRequest) -> SlabDesignResult:
    g = request.geometry
    mats = request.materials
    loads = request.loads

    inp = _OWInput(
        span_m=g.span_lx,
        continuity=_enum(request.continuity),
        thickness_mm=g.thickness,
        clear_cover_mm=g.clear_cover,
        concrete_grade=mats.concrete_grade,
        steel_grade=mats.steel_grade,
        bar_diameters=request.bar_diameters or [10, 12, 16],
        floor_finish=loads.floor_finish or 0.0,
        additional_dead_load=loads.additional_dead_load or 0.0,
        live_load=loads.live_load or 0.0,
        additional_live_load=loads.additional_live_load or 0.0,
        gamma_concrete=mats.unit_weight_concrete or 25.0,
    )

    res = _ow_design(inp)
    sf, pf = res.span_face, res.support_face
    b = 1000.0

    as_prov_span = sf.bar.As_prov if sf.bar else 0.0
    as_prov_supp = pf.bar.As_prov if pf.bar else 0.0
    util = min(sf.As_req / as_prov_span, 1.0) if as_prov_span else 0.0

    rates_path = os.path.join(os.path.dirname(__file__), '..', 'engine', 'rates_db.json')
    try:
        with open(rates_path, 'r') as fp:
            rates_db = json.load(fp)
    except FileNotFoundError:
        rates_db = {}
    conc_tbl, steel_tbl, formwork_rate = resolve_rates(rates_db, request.region)
    concrete_rate = _rate(conc_tbl, mats.concrete_grade, 105000)
    steel_rate = _rate(steel_tbl, mats.steel_grade, 950000)
    volume_concrete = res.d_mm and (request.geometry.thickness / 1000.0 * 1.0)
    cost_concrete = volume_concrete * concrete_rate
    steel_weight = (as_prov_span + as_prov_supp) * 1.0 * 7850 / 1e6
    cost_steel = steel_weight * steel_rate / 1000
    cost_formwork = 1.0 * formwork_rate
    total_cost = cost_concrete + cost_steel + cost_formwork
    slab_area = g.span_lx * g.span_ly

    bx = sf.bar.bar_dia if sf.bar else 0
    sx = sf.bar.spacing if sf.bar else 0

    summary = DesignSummary(
        status=res.overall_status, slab_type="One-Way Slab",
        continuity=_enum(request.continuity).replace("_", " ").title(),
        span_lx=g.span_lx, span_ly=None, thickness=request.geometry.thickness,
        effective_depth=round(res.d_mm, 1), clear_cover=round(res.cover_mm, 1),
        concrete_grade=mats.concrete_grade, steel_grade=mats.steel_grade,
        selected_bar_diameter=bx, selected_spacing=sx,
        total_cost=round(total_cost * slab_area, 2), optimization_rank=1, utilization_ratio=round(util, 2),
    )

    design_forces = DesignForces(
        max_sagging_moment=round(sf.M_kNm, 2),
        max_hogging_moment=round(-pf.M_kNm, 2) if pf.M_kNm else 0.0,
        max_shear_force=round(res.V_ed_kN, 2),
        ultimate_load=round(res.w_ed, 2),
        service_load=round(res.g_k + res.q_k, 2),
    )

    reinforcement = ReinforcementDetails(
        bottom_steel={
            "direction": "Main (Span / Sagging)",
            "bar_diameter": bx, "spacing": sx,
            "area_provided": round(as_prov_span, 1), "area_required": round(sf.As_req, 1),
        },
        top_steel={
            "direction": "Main (Support / Hogging)",
            "bar_diameter": pf.bar.bar_dia if pf.bar else 0, "spacing": pf.bar.spacing if pf.bar else 0,
            "area_provided": round(as_prov_supp, 1), "area_required": round(pf.As_req, 1),
        },
    )

    deflection = DeflectionResult(
        actual_deflection=round(res.actual_slenderness, 1),
        allowable_deflection=round(res.slenderness_limit, 1),
        status=res.deflection_status,
        ratio=round(res.actual_slenderness / res.slenderness_limit, 2) if res.slenderness_limit else 0,
    )

    shear = ShearResult(
        design_shear=round(res.V_ed_kN, 2),
        shear_resistance=round(res.v_rdc * b * res.d_mm / 1000.0, 2),
        status=res.shear_status,
        ratio=round(res.v_ed / res.v_rdc, 2) if res.v_rdc else 0,
    )

    compliance = [
        ComplianceCheck(check="Flexure — span (sagging)", status="PASS" if as_prov_span >= sf.As_req else "FAIL",
                        ratio=round(sf.As_req / as_prov_span, 2) if as_prov_span else 0, limit=1.0),
        ComplianceCheck(check="Flexure — support (hogging)",
                        status="PASS" if (pf.M_kNm == 0 or as_prov_supp >= pf.As_req) else "FAIL",
                        ratio=round(pf.As_req / as_prov_supp, 2) if as_prov_supp else 0, limit=1.0),
        ComplianceCheck(check="Minimum reinforcement", status="PASS" if as_prov_span >= sf.As_min else "FAIL",
                        ratio=round(sf.As_min / as_prov_span, 2) if as_prov_span else 0, limit=1.0, note="As,prov ≥ As,min"),
        ComplianceCheck(check="Deflection (span/depth)", status=res.deflection_status,
                        ratio=round(res.actual_slenderness / res.slenderness_limit, 2) if res.slenderness_limit else 0, limit=1.0),
        ComplianceCheck(check="Shear (v_Ed / v_Rd,c)", status=res.shear_status,
                        ratio=round(res.v_ed / res.v_rdc, 2) if res.v_rdc else 0, limit=1.0),
    ]

    cost_breakdown = CostBreakdown(
        concrete={"volume": round(volume_concrete, 3), "rate": concrete_rate, "cost": round(cost_concrete, 2)},
        steel={"weight": round(steel_weight, 1), "rate": steel_rate / 1000, "cost": round(cost_steel, 2)},
        formwork={"area": 1.0, "rate": formwork_rate, "cost": round(cost_formwork, 2)},
        total=round(total_cost, 2),
        total_per_sqm=round(total_cost, 2),
    )

    optimization_options = [OptimizationOption(
        rank=1, thickness=request.geometry.thickness, bar_diameter=bx, spacing=sx,
        cost=round(total_cost * slab_area, 2), status=res.overall_status, utilization_ratio=round(util, 2),
    )]

    report = _slab_front_matter(request, compliance, False, inp, res) + _build_one_way_report(request, res, inp)

    return SlabDesignResult(
        task_id="completed", status="completed", summary=summary, design_forces=design_forces,
        reinforcement=reinforcement, deflection=deflection, shear=shear, compliance=compliance,
        cost_breakdown=cost_breakdown, optimization_options=optimization_options, report=report,
    )




def _build_one_way_report(request, res, inp):
    R = lambda ref, calc, out: {"reference": ref, "calculation": calc, "output": out}
    sf, pf = res.span_face, res.support_face
    cont = _enum(request.continuity).replace("_", " ").title()

    g = request.geometry
    mats = request.materials
    b = 1000.0
    h = g.thickness
    d = res.d_mm
    cover = res.cover_mm
    fck = parse_fck(mats.concrete_grade)
    fyk = parse_fy(mats.steel_grade)
    fyd = fyk / 1.15
    fcd = fck / 1.5
    fctm = 0.30 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)
    gamma_c = mats.unit_weight_concrete or 25.0
    phi = sf.bar.bar_dia if sf.bar else (inp.bar_diameters[0] if inp.bar_diameters else 12)
    exposure = _enum(request.design_params.exposure_class)
    L = inp.span_m

    sec = []

    sec.append({"title": "1. Design Basis and References", "rows": [
        R("EN 1990", "Basis of structural design \u2014 ULS combination Eq. 6.10", "adopted"),
        R("EN 1991-1-1", "Actions: densities, self-weight (\u00a73.2.1), imposed loads (Table 6.2)", "adopted"),
        R("EN 1992-1-1", "Concrete design \u2014 \u00a76.1 flexure, \u00a76.2.2 shear, \u00a77.4.2 deflection, \u00a79.2.1.1 min steel", "adopted"),
        R("UK NA", "National Annex to EN 1992-1-1", "adopted"),
        R("Design strip", "one-way slab designed as a 1 m wide strip spanning one direction", f"b = {b:.0f} mm"),
        R("Support", f"continuity = {cont}", f"Lx = {L:.2f} m"),
    ]})

    sec.append({"title": "2. Geometry, Cover and Materials", "rows": [
        R("Geometry", f"span Lx = {L:.2f} m ; overall thickness h = {h:.0f} mm", f"h = {h:.0f} mm"),
        R("Cover input", f"clear cover specified by user, Cc = {g.clear_cover:.0f} mm", f"Cc,input = {g.clear_cover:.0f} mm"),
        R("Tolerance", "a fixed 5 mm fixing/detailing allowance is added to the clear cover specified above -- this is not user-editable", "+5 mm"),
        R("Cover used", f"Cc,used = Cc,input + 5 mm = {g.clear_cover:.0f} + 5", f"Cc = {cover:.0f} mm"),
        R("Bar assumed", f"main bar \u03c6 = {phi:.0f} mm  \u2192  \u03c6/2 = {phi/2:.1f} mm", f"\u03c6 = {phi:.0f} mm"),
        R("EC2 \u00a76.1", f"d = h \u2212 Cc \u2212 \u03c6/2 = {h:.0f} \u2212 {cover:.0f} \u2212 {phi/2:.1f}", f"d = {d:.0f} mm"),
        R("EC2 Table 3.1", f"f_ctm = 0.30 \u00d7 f_ck^(2/3) = 0.30 \u00d7 {fck:.0f}^(2/3) = 0.30 \u00d7 {fck**(2/3):.3f}", f"f_ctm = {fctm:.2f} MPa"),
        R("EC2 \u00a73.1.6", f"f_cd = f_ck/\u03b3_c = {fck:.0f}/1.50", f"f_cd = {fcd:.2f} MPa"),
        R("EC2 \u00a73.2.7", f"f_yd = f_yk/\u03b3_s = {fyk:.0f}/1.15", f"f_yd = {fyd:.1f} MPa"),
    ]})

    sw = res.self_weight
    ff = inp.floor_finish or 0.0
    pa = inp.additional_dead_load or 0.0
    ll = inp.live_load or 0.0
    al = inp.additional_live_load or 0.0
    sec.append({"title": "3. Permanent Loads (Load Analysis)", "rows": [
        R("EN 1991-1-1 \u00a73.2.1", f"Self-weight of slab = \u03b3_c \u00d7 h = {gamma_c:.0f} kN/m\u00b3 \u00d7 {h/1000:.2f}m", f"{sw:.2f} kN/m\u00b2"),
        R("User input", "Weight of finishes (assume)", f"{ff:.2f} kN/m\u00b2"),
        R("User input", "Partition allowance", f"{pa:.2f} kN/m\u00b2"),
        R("Total dead load", f"G_k = Self-weight + Weight of finishes + Partition allowance = {sw:.2f} + {ff:.2f} + {pa:.2f}", f"G_k = {res.g_k:.2f} kN/m\u00b2"),
    ]})

    sec.append({"title": "4. Variable Load on Slab", "rows": [
        R("EN 1991-1-1 Table 6.2", f"Leading variable action (imposed load), based on building use", f"{ll:.2f} kN/m\u00b2"),
        R("User input", "Extra live load", f"{al:.2f} kN/m\u00b2"),
        R("Total variable load", f"Q_k = imposed + extra live load = {ll:.2f} + {al:.2f}", f"Q_k = {res.q_k:.2f} kN/m\u00b2"),
    ]})

    pg, pq = 1.35 * res.g_k, 1.50 * res.q_k
    sec.append({"title": "4. Ultimate Limit State Combination", "rows": [
        R("EN 1990 Eq. 6.10", "w_u = \u03b3_Gk\u00b7G_k + \u03b3_Qk\u00b7Q_k", "combination adopted"),
        R("Partial factors", "\u03b3_Gk = 1.35 (permanent) ; \u03b3_Qk = 1.50 (variable)", "EN 1990 Table A1.2(B)"),
        R("Substitution", f"w_u = (1.35 \u00d7 {res.g_k:.2f}) + (1.50 \u00d7 {res.q_k:.2f}) = {pg:.4f} + {pq:.4f}", f"w_u = {res.w_ed:.4f} kN/m\u00b2"),
        R("Design line load", f"1 m strip: w = {res.w_ed:.2f} kN/m\u00b2 \u00d7 1.00 m", f"w = {res.w_ed:.2f} kN/m"),
    ]})

    c_sag = sf.M_kNm / (res.w_ed * L ** 2) if (res.w_ed and L) else 0.0
    c_hog = pf.M_kNm / (res.w_ed * L ** 2) if (res.w_ed and L) else 0.0
    c_v = res.V_ed_kN / (res.w_ed * L) if (res.w_ed and L) else 0.0
    continuity_val = _enum(request.continuity)

    span_captions = {
        "simply_supported": "single coefficient span: M_Ed = c \u00d7 w \u00d7 Lx\u00b2 ; for a simply-supported slab, c = 0.125",
        "one_end_continuous": "single coefficient span: M_Ed = c \u00d7 w \u00d7 Lx\u00b2 ; one end continuous, one end simply supported, c = 9/128",
        "both_ends_continuous": "single coefficient span: M_Ed = c \u00d7 w \u00d7 Lx\u00b2 ; both ends continuous, c = 1/24",
        "cantilever": "single coefficient span: M_Ed = c \u00d7 w \u00d7 Lx\u00b2 ; cantilever has no midspan sagging, c = 0",
    }
    hogging_captions = {
        "simply_supported": "since it is a single span, there is no need to add a hogging moment -- it will always be zero for a simply-supported single span",
        "one_end_continuous": "one end continuous: hogging develops at the continuous support only, c = 1/8",
        "both_ends_continuous": "both ends continuous: hogging develops at both supports, c = 1/12",
        "cantilever": "cantilever: hogging (fixed-end moment) governs, there is no sagging span moment to report, c = 1/2",
    }
    shear_captions = {
        "simply_supported": "c = 0.5 for simply supported, i.e. w\u00b7Lx/2",
        "one_end_continuous": "c = 0.625 for one end continuous (peak shear occurs at the continuous end)",
        "both_ends_continuous": "c = 0.5 for both ends continuous, i.e. w\u00b7Lx/2",
        "cantilever": "c = 1.0 for a cantilever, full reaction is taken at the fixed end",
    }

    span_row = R("EC2 \u00a75.4", span_captions.get(continuity_val, span_captions["simply_supported"]), f"c = {c_sag:.4f}")
    hog_row = R("Hogging", hogging_captions.get(continuity_val, hogging_captions["simply_supported"]), f"M_hog = {pf.M_kNm:.2f} kNm/m")
    shear_row = R("Shear", f"V_Ed = c \u00d7 w \u00d7 Lx = {c_v:.3f} \u00d7 {res.w_ed:.2f} \u00d7 {L:.2f}  ({shear_captions.get(continuity_val, shear_captions['simply_supported'])})", f"V_Ed = {res.V_ed_kN:.2f} kN/m")

    moment_rows = [span_row]
    if continuity_val == "cantilever":
        moment_rows.append(R("Span (sagging)", "cantilever: no midspan sagging moment", f"M_Ed = {sf.M_kNm:.2f} kNm/m"))
    else:
        moment_rows.append(R("Span (sagging)", f"M_Ed = c \u00d7 w \u00d7 Lx\u00b2 = {c_sag:.4f} \u00d7 {res.w_ed:.2f} \u00d7 {L:.2f}\u00b2", f"M_Ed = {sf.M_kNm:.2f} kNm/m"))
        if continuity_val == "simply_supported":
            moment_rows.append(R("Equivalent form", f"M_Ed = w\u00b7Lx\u00b2/8 = ({res.w_ed:.2f} \u00d7 {L**2:.2f})/8 \u2014 maximum moment at mid-span", f"{res.w_ed*L**2/8:.2f} kNm/m"))
    moment_rows.append(hog_row)
    moment_rows.append(shear_row)

    sec.append({"title": "5. Design Moments (Closed-Form)", "rows": moment_rows})

    root = max(0.25 - sf.k / 1.134, 0.0)
    sec.append({"title": "6. Flexural Reinforcement \u2014 Span", "rows": [
        R("Effective depth", f"d = h \u2212 Cc \u2212 \u03c6/2, assuming \u03c6{phi:.0f}mm bars will be employed", f"d = {h:.0f} \u2212 {cover:.0f} \u2212 {phi/2:.1f} = {d:.0f} mm ; b = {b:.0f} mm"),
        R("EC2 \u00a76.1", f"K = M_Ed/(f_ck\u00b7b\u00b7d\u00b2) = ({sf.M_kNm:.2f} \u00d7 10\u2076)/({fck:.0f} \u00d7 {b:.0f} \u00d7 {d:.0f}\u00b2) = {sf.M_kNm*1e6:.4g}/{fck*b*d**2:.4g}", f"K = {sf.k:.4f}"),
        R("Compression steel check", f"K = {sf.k:.4f} {'<' if sf.singly else '\u2265'} 0.167", "K < 0.167 \u2192 singly reinforced, no compression reinforcement required" if sf.singly else "K \u2265 0.167 \u2192 compression reinforcement required"),
        R("EC2 \u00a76.1", f"Z = d(0.5 + \u221a(0.25 \u2212 K/1.134)) = {d:.0f}(0.5 + \u221a(0.25 \u2212 {sf.k:.4f}/1.134)) = {d:.0f}(0.5 + \u221a{root:.4f})", f"Z = {sf.z_mm:.1f} mm \u2264 0.95d"),
        R("EC2 \u00a76.1", f"A_s = M_Ed/(0.87\u00b7f_yk\u00b7Z) = ({sf.M_kNm:.2f} \u00d7 10\u2076)/(0.87 \u00d7 {fyk:.0f} \u00d7 {sf.z_mm:.1f})", f"A_s = {sf.As:.0f} mm\u00b2/m"),
    ]})

    bd = b * d
    t1 = 0.26 * fctm / fyk * bd
    t2 = 0.0013 * bd
    gov = "concrete tensile strength basis" if t1 >= t2 else "0.13% minimum basis"
    sec.append({"title": "7. Minimum Reinforcement Check", "rows": [
        R("EC2 \u00a79.2.1.1", "A_s,min = max( 0.26\u00b7f_ctm/f_yk\u00b7b\u00b7d , 0.0013\u00b7b\u00b7d )  \u2014 formula used strictly, with f_ctm from EC2 Table 3.1", "As,min formula"),
        R("Basis 1 \u2014 concrete tensile strength", f"0.26 \u00d7 f_ctm/f_yk \u00d7 b\u00b7d = 0.26 \u00d7 {fctm:.2f}/{fyk:.0f} \u00d7 {bd:.0f}", f"{t1:.0f} mm\u00b2/m"),
        R("Basis 2 \u2014 0.13% of section", f"0.0013 \u00d7 b\u00b7d = 0.0013 \u00d7 {bd:.0f}", f"{t2:.0f} mm\u00b2/m"),
        R("Governing", f"A_s,min = max({t1:.0f} , {t2:.0f})  \u2190 {gov} governs", f"A_s,min = {sf.As_min:.0f} mm\u00b2/m"),
        R("Required", f"A_s,req = max(A_s , A_s,min) = max({sf.As:.0f} , {sf.As_min:.0f})  \u2192 {'bending governs' if sf.As >= sf.As_min else 'minimum steel governs'}", f"A_s,req = {sf.As_req:.0f} mm\u00b2/m"),
    ]})

    if sf.bar:
        Ab = math.pi * sf.bar.bar_dia ** 2 / 4.0
        s_max = min(3 * h, 400)
        sec.append({"title": "8. Bar Selection \u2014 Span", "rows": [
            R("Bar area", f"A_bar = \u03c0\u03c6\u00b2/4 = \u03c0 \u00d7 {sf.bar.bar_dia:.0f}\u00b2/4", f"A_bar = {Ab:.1f} mm\u00b2"),
            R("Spacing required", f"s \u2264 A_bar \u00d7 1000/A_s,req = {Ab:.1f} \u00d7 1000/{sf.As_req:.0f} = {Ab*1000/sf.As_req if sf.As_req else 0:.0f} mm", f"adopt s = {sf.bar.spacing:.0f} mm"),
            R("Provided", f"A_s,prov = A_bar \u00d7 (1000/s) = {Ab:.1f} \u00d7 (1000/{sf.bar.spacing:.0f})", f"A_s,prov = {sf.bar.As_prov:.0f} mm\u00b2/m"),
            R("Check", f"A_s,prov \u2265 A_s,req \u2192 {sf.bar.As_prov:.0f} \u2265 {sf.As_req:.0f}", "OK" if sf.bar.As_prov >= sf.As_req else "INCREASE STEEL"),
            R("EC2 \u00a79.3.1.1", f"max spacing = min(3h , 400) = min({3*h:.0f} , 400) = {s_max:.0f} mm ; provided {sf.bar.spacing:.0f} mm", "OK" if sf.bar.spacing <= s_max else "SPACING TOO WIDE"),
            R("Provide", f"\u03c6{sf.bar.bar_dia:.0f} @ {sf.bar.spacing:.0f} mm c/c (bottom, main direction)", f"T{sf.bar.bar_dia:.0f} @ {sf.bar.spacing:.0f}"),
        ]})

    if pf.M_kNm > 0:
        rows = [
            R("EC2 \u00a76.1", f"K = M_hog/(f_ck\u00b7b\u00b7d\u00b2) = ({pf.M_kNm:.2f} \u00d7 10\u2076)/({fck:.0f} \u00d7 {b:.0f} \u00d7 {d:.0f}\u00b2)", f"K = {pf.k:.4f}"),
            R("Lever arm", f"Z = d(0.5 + \u221a(0.25 \u2212 {pf.k:.4f}/1.134)) \u2264 0.95d", f"Z = {pf.z_mm:.1f} mm"),
            R("EC2 \u00a76.1", f"A_s = M_hog/(0.87\u00b7f_yk\u00b7Z) = ({pf.M_kNm:.2f} \u00d7 10\u2076)/(0.87 \u00d7 {fyk:.0f} \u00d7 {pf.z_mm:.1f})", f"A_s = {pf.As:.0f} mm\u00b2/m"),
            R("Required", f"A_s,req = max({pf.As:.0f} , A_s,min {pf.As_min:.0f})", f"A_s,req = {pf.As_req:.0f} mm\u00b2/m"),
        ]
        if pf.bar:
            rows.append(R("Provide", f"\u03c6{pf.bar.bar_dia:.0f} @ {pf.bar.spacing:.0f} mm c/c (top, over support)", f"A_s,prov = {pf.bar.As_prov:.0f} mm\u00b2/m"))
        sec.append({"title": "9. Flexural Reinforcement \u2014 Support (Hogging)", "rows": rows})

    As_prov_span = sf.bar.As_prov if sf.bar else 0.0
    As_req_span = sf.As_req
    K_note = "K = 1.0 (simply supported) / 1.5 (interior span) / 1.3 (end span) / 0.4 (cantilever)"
    deflection_rows = [
        R("Note", "for slabs, most especially two-way spanning slabs, checks are carried out based on the shorter span", ""),
        R("Note", K_note, f"K = {res.K_sys:.2f} ({cont})"),
        R("Note", "compression reinforcement \u03c1' is taken as 0", "\u03c1' = 0"),
        R("Basic span/depth ratio", f"\u03c1 = A_s,required/(b\u00b7d) = {As_req_span:.0f}/{bd:.0f}", f"\u03c1 = {res.rho:.5f}"),
        R("Basic span/depth ratio", f"\u03c1\u2080 = 10\u207b\u00b3 \u00d7 \u221af_ck = 10\u207b\u00b3 \u00d7 \u221a{fck:.0f}", f"\u03c1\u2080 = {res.rho0:.5f}"),
        R("Branch", f"\u03c1 = {res.rho:.5f} vs \u03c1\u2080 = {res.rho0:.5f}",
          "\u03c1 < \u03c1\u2080 \u2192 use lightly-reinforced formula" if res.rho <= res.rho0 else "\u03c1 > \u03c1\u2080 \u2192 use heavily-reinforced formula"),
        R("EC2 \u00a77.4.2", ("(L/d) = K[11 + 1.5\u221af_ck\u00b7(\u03c1\u2080/\u03c1) + 3.2\u221af_ck\u00b7(\u03c1\u2080/\u03c1 \u2212 1)^(3/2)]" if res.rho <= res.rho0
                             else "(L/d) = K[11 + 1.5\u221af_ck\u00b7\u03c1\u2080/(\u03c1 \u2212 \u03c1') + \u221af_ck/12\u00b7\u221a(\u03c1'/\u03c1\u2080)]  , \u03c1' = 0"),
          f"(L/d) = {res.ld_basic:.2f}"),
        R("Base check", f"(L/d)actual {'\u2264' if res.deflection_base_status == 'PASS' else '>'} (L/d)basic \u2192 {res.actual_slenderness:.2f} {'\u2264' if res.deflection_base_status == 'PASS' else '>'} {res.ld_basic:.2f}",
          res.deflection_base_status),
    ]
    if res.deflection_enhanced:
        deflection_rows += [
            R("Enhancement factor", f"F3 = A_s,prov/A_s,req = {As_prov_span:.0f}/{As_req_span:.0f}  (\u2264 1.5)", f"F3 = {res.beta_s:.3f}"),
            R("Allowable Span/Depth ratio", f"allowable (L/d) = F3 \u00d7 (L/d)basic = {res.beta_s:.3f} \u00d7 {res.ld_basic:.2f}", f"{res.slenderness_limit:.2f}"),
        ]
    else:
        deflection_rows.append(
            R("Enhancement factor", "base check already passes \u2014 F3 not required", "F3 not applied")
        )
    deflection_rows += [
        R("Actual deflection", f"(L/d)actual = Lx/d = {L*1000:.0f}/{d:.0f}", f"{res.actual_slenderness:.2f}"),
        R("Verdict", f"(L/d)actual {'<' if res.deflection_status == 'PASS' else '>'} allowable (L/d)  \u2192  {res.actual_slenderness:.2f} {'<' if res.deflection_status == 'PASS' else '>'} {res.slenderness_limit:.2f}",
          "Deflection is okay" if res.deflection_status == "PASS" else "Deflection is NOT okay \u2014 increase depth or steel"),
    ]
    sec.append({"title": "10. Check for Deflection", "rows": deflection_rows})

    rho_l = min(As_prov_span / bd, 0.02) if bd else 0.0
    k_raw = 1 + math.sqrt(200 / d) if d else 1.0
    k_sh = min(k_raw, 2.0)
    C_Rdc = 0.18 / 1.5
    inner = 100 * rho_l * fck
    v_main = C_Rdc * k_sh * inner ** (1 / 3)
    v_min = 0.035 * k_sh ** 1.5 * math.sqrt(fck)
    VRdc_kN = res.v_rdc * b * d / 1000.0
    sec.append({"title": "11. Shear Verification", "rows": [
        R("Maximum shear at support", f"V_Ed = \u03b2s \u00d7 n \u00d7 Lx = 0.5 \u00d7 {res.w_ed:.2f} \u00d7 {L:.2f}  (or n\u00b7Lx/2)", f"V_Ed = {res.V_ed_kN:.2f} kN/m"),
        R("v_Ed", f"v_Ed = V_Ed/(b\u00b7d) = ({res.V_ed_kN:.2f} \u00d7 10\u00b3)/({b:.0f} \u00d7 {d:.0f})", f"v_Ed = {res.v_ed:.3f} MPa"),
        R("Steel ratio", f"\u03c1_i = A_s,provided/(b\u00b7d) = {As_prov_span:.0f}/{bd:.0f}  (\u2264 0.02)", f"\u03c1_i = {rho_l:.5f}"),
        R("Size factor", f"k = 1 + \u221a(200/d) = 1 + \u221a(200/{d:.0f})  (\u2264 2.0)", f"k = {k_sh:.3f}"),
        R("EC2 \u00a76.2.2", f"C_Rd,c = 0.18/\u03b3_c = 0.18/1.50", f"C_Rd,c = {C_Rdc:.3f}"),
        R("Axial stress", "\u03c3_cp = N_Ed/A_c ; take N_Ed = 0 for a slab (\u2264 0.2\u00b7f_cd)", "\u03c3_cp = 0.000 MPa"),
        R("Axial factor", "k_i = 0.15", "k_i\u00b7\u03c3_cp = 0.000 MPa"),
        R("EC2 \u00a76.2.2", "V_Rd,c = [C_Rd,c\u00b7k\u00b7(100\u00b7\u03c1_i\u00b7f_ck)^(1/3) + k_i\u00b7\u03c3_cp]\u00b7bw\u00b7d  \u2265  (v_min + k_i\u00b7\u03c3_cp)\u00b7bw\u00b7d", "governing expression"),
        R("Main term", f"C_Rd,c\u00b7k\u00b7(100\u00b7\u03c1_i\u00b7f_ck)^(1/3) = {C_Rdc:.3f} \u00d7 {k_sh:.3f} \u00d7 (100 \u00d7 {rho_l:.5f} \u00d7 {fck:.0f})^(1/3)", f"{v_main:.3f} MPa"),
        R("v_min", f"v_min = 0.035\u00b7k^(3/2)\u00b7f_ck^(1/2) = 0.035 \u00d7 {k_sh:.3f}^1.5 \u00d7 \u221a{fck:.0f}", f"{v_min:.3f} MPa"),
        R("Governing", f"v_Rd,c = max({v_main:.3f} , {v_min:.3f})", f"v_Rd,c = {res.v_rdc:.3f} MPa"),
        R("Resistance", f"V_Rd,c = v_Rd,c \u00b7 b \u00b7 d = {res.v_rdc:.3f} \u00d7 {b:.0f} \u00d7 {d:.0f} / 10\u00b3", f"V_Rd,c = {VRdc_kN:.2f} kN/m"),
        R("Verdict", f"if V_Rd,c > V_Ed, no shear reinforcement is required  \u2192  {VRdc_kN:.2f} {'>' if res.shear_status == 'PASS' else '\u2264'} {res.V_ed_kN:.2f}", res.shear_status),
        R("Note", "shear reinforcement is rarely required in solid slabs supported by beams; no further shear checks are performed on slabs", ""),
    ]})

    rows = [
        R("Section", f"h = {h:.0f} mm ; d = {d:.0f} mm ; cover used = {cover:.0f} mm", f"{h:.0f} mm slab"),
        R("Loading", f"G_k = {res.g_k:.2f} ; Q_k = {res.q_k:.2f} \u2192 w_u = {res.w_ed:.2f} kN/m\u00b2", f"w_u = {res.w_ed:.2f} kN/m\u00b2"),
        R("Actions", f"M_Ed = {sf.M_kNm:.2f} kNm/m ; M_hog = {pf.M_kNm:.2f} kNm/m ; V_Ed = {res.V_ed_kN:.2f} kN/m", "ULS"),
        R("Span steel", f"A_s,req = {sf.As_req:.0f} mm\u00b2/m \u2192 provided {sf.bar.As_prov:.0f} mm\u00b2/m" if sf.bar else f"A_s,req = {sf.As_req:.0f} mm\u00b2/m",
          f"T{sf.bar.bar_dia:.0f} @ {sf.bar.spacing:.0f}" if sf.bar else "-"),
        R("Deflection", f"actual {res.actual_slenderness:.2f} vs allowable {res.slenderness_limit:.2f}", res.deflection_status),
        R("Shear", f"v_Ed {res.v_ed:.3f} vs v_Rd,c {res.v_rdc:.3f} MPa", res.shear_status),
        R("Overall", "all ULS and SLS checks", res.overall_status),
    ]
    rows += [R("Note", n, "") for n in res.notes]
    sec.append({"title": "12. Design Summary", "rows": rows})

    renumbered = []
    for i, s in enumerate(sec, start=1):
        t = s["title"]
        if "." in t[:3]:
            t = t.split(". ", 1)[-1]
        renumbered.append({"title": f"{i}. {t}", "rows": s["rows"]})
    return renumbered