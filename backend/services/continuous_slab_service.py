# backend/services/continuous_slab_service.py
import sys, os, json, math

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'engine'))

from models.schemas import (
    ContinuousSlabRequest, ContinuousSlabResult, DesignSummary, EnvelopeOut,
    SpanDesignOut, SupportDesignOut, DeflectionResult, ShearResult,
    ComplianceCheck, CostBreakdown, DiagramOut, ReportSection,
)

from services.report_front_matter import (
    front_matter, ndp_partial_factors, ndp_alpha_cc_k_method, ndp_cover_rows,
    ndp_min_steel, ndp_shear_no_links, ndp_deflection, row as _fm_row,
)

try:
    from engine.continuous_one_way_slab_engine import design_continuous_slab, ContinuousInput
    from engine.two_way_slab_engine import EXPOSURE_MIN_DUR_MM
except ImportError:
    from continuous_one_way_slab_engine import design_continuous_slab, ContinuousInput
    from two_way_slab_engine import EXPOSURE_MIN_DUR_MM

# EN 1992-1-2 Table 5.8, one-way solid slabs: REI (min) -> (min thickness h_s, min axis distance a), mm
FIRE_TABLE_5_8 = {30: (60, 10), 60: (80, 20), 90: (100, 30), 120: (120, 40), 180: (150, 55), 240: (175, 65)}
# EC2 Table 7.3N: max bar spacing (mm) by steel stress sigma_s (MPa) for w_k = 0.4 / 0.3 / 0.2 mm (None = not permitted)
CRACK_TABLE_7_3N = [(160, 300, 300, 200), (200, 300, 250, 150), (240, 250, 200, 100),
                    (280, 200, 150, 50), (320, 150, 100, None), (360, 100, 50, None)]
# EC2 Table 7.1N recommended w_max (reinforced members, quasi-permanent combination), mm
W_MAX_7_1N = {"XC1": 0.4, "XC2": 0.3, "XC3": 0.3, "XC4": 0.3}
# EN 1990 Table A1.1 psi_2 by occupancy (keys as sent by ContinuousSlabInput.jsx)
PSI2_BY_OCCUPANCY = {"residential": 0.3, "office": 0.3, "classroom": 0.6, "assembly": 0.6,
                     "retail": 0.6, "parking": 0.6, "storage": 0.8}
PSI2_UNSTATED = 0.6


def _enum(v):
    return v.value if hasattr(v, "value") else v


def _load_rates():
    path = os.path.join(os.path.dirname(__file__), '..', 'engine', 'rates_db.json')
    try:
        with open(path) as fp:
            return json.load(fp)
    except FileNotFoundError:
        return {}


def _rate(table, key, default):
    if key in table:
        return table[key]
    for k, v in table.items():
        if str(k).lower() == str(key).lower():
            return v
    return default


def _resolve_rates(db, region):
    regions = db.get("regions", {})
    r = regions.get(region) or regions.get("UK") or {}
    mats = r.get("materials", {})
    return mats.get("concrete", {}), mats.get("reinforcement", {}), mats.get("formwork", {}).get("flat_slab", 0)


def calculate_continuous_slab(request: ContinuousSlabRequest) -> ContinuousSlabResult:
    mats = request.materials
    loads = request.loads

    inp = ContinuousInput(
        span_lengths_m=request.span_lengths,
        start_support=_enum(request.start_support),
        end_support=_enum(request.end_support),
        thickness_mm=request.geometry_thickness,
        clear_cover_mm=request.clear_cover,
        concrete_grade=mats.concrete_grade,
        steel_grade=mats.steel_grade,
        bar_diameters=request.bar_diameters or [10, 12, 16],
        dead_load=loads.dead_load or 0.0,
        floor_finish=loads.floor_finish or 0.0,
        additional_dead_load=loads.additional_dead_load or 0.0,
        live_load=loads.live_load or 0.0,
        additional_live_load=loads.additional_live_load or 0.0,
        gamma_concrete=mats.unit_weight_concrete or 25.0,
    )

    res = design_continuous_slab(inp)
    b = 1000.0
    dfc_rows, dfc_checks = _durability_fire_crack(request, res)
    overall = "FAIL" if (res.overall_status == "FAIL" or any(c.status == "FAIL" for c in dfc_checks)) else res.overall_status

    gov_span = max(res.spans, key=lambda s: s.M_sag_kNm)
    gov_bar = gov_span.bar
    total_len = sum(request.span_lengths)

    db = _load_rates()
    conc_tbl, steel_tbl, formwork_rate = _resolve_rates(db, request.region)
    concrete_rate = _rate(conc_tbl, mats.concrete_grade, 105000)
    steel_rate = _rate(steel_tbl, mats.steel_grade, 950000)
    volume_concrete = request.geometry_thickness / 1000.0 * total_len
    cost_concrete = volume_concrete * concrete_rate
    as_span = max((s.bar.As_prov for s in res.spans if s.bar), default=0.0)
    as_supp = max((s.bar.As_prov for s in res.supports if s.bar), default=0.0)
    steel_weight = (as_span + as_supp) * total_len * 7850 / 1e6
    cost_steel = steel_weight * steel_rate / 1000
    cost_formwork = total_len * formwork_rate
    total_cost = cost_concrete + cost_steel + cost_formwork

    util = min(gov_span.As_req / gov_bar.As_prov, 1.0) if (gov_bar and gov_bar.As_prov) else 0.0

    summary = DesignSummary(
        status=overall, slab_type="Continuous One-Way Slab",
        continuity=f"{res.n_spans} spans ({_enum(request.start_support)}–{_enum(request.end_support)})",
        span_lx=request.span_lengths[0], span_ly=total_len,
        thickness=request.geometry_thickness, effective_depth=round(res.d_mm, 1), clear_cover=round(res.cover_mm, 1),
        concrete_grade=mats.concrete_grade, steel_grade=mats.steel_grade,
        selected_bar_diameter=gov_bar.bar_dia if gov_bar else 0,
        selected_spacing=gov_bar.spacing if gov_bar else 0,
        total_cost=round(total_cost, 2), optimization_rank=1, utilization_ratio=round(util, 2),
    )

    envelope = EnvelopeOut(
        max_sagging_moment=round(res.env_sag_kNm, 2),
        max_hogging_moment=round(-res.env_hog_kNm, 2),
        max_shear_force=round(res.env_shear_kN, 2),
        ultimate_load=round(res.w_ed, 2),
        service_load=round(res.g_k + res.q_k, 2),
    )

    spans_out = [SpanDesignOut(
        index=s.index, length=s.length_m, max_sagging_moment=round(s.M_sag_kNm, 2),
        area_required=round(s.As_req, 1), area_provided=round(s.bar.As_prov, 1) if s.bar else 0,
        bar_diameter=s.bar.bar_dia if s.bar else 0, spacing=s.bar.spacing if s.bar else 0, status=s.status,
    ) for s in res.spans]

    supports_out = [SupportDesignOut(
        index=s.index, position=s.position, hogging_moment=round(s.M_hog_kNm, 2),
        shear=round(s.shear_kN, 2), shear_reduced=round(getattr(s, 'shear_reduced_kN', 0.0), 2),
        area_required=round(s.As_req, 1), area_provided=round(s.bar.As_prov, 1) if s.bar else 0,
        bar_diameter=s.bar.bar_dia if s.bar else 0, spacing=s.bar.spacing if s.bar else 0, status=s.status,
    ) for s in res.supports]

    deflection = DeflectionResult(
        actual_deflection=round(res.actual_slenderness, 1),
        allowable_deflection=round(res.slenderness_limit, 1),
        status=res.deflection_status,
        ratio=round(res.actual_slenderness / res.slenderness_limit, 2) if res.slenderness_limit else 0,
    )

    shear = ShearResult(
        design_shear=round(res.env_shear_kN, 2),
        shear_resistance=round(res.v_rdc * b * res.d_mm / 1000.0, 2),
        status=res.shear_status,
        ratio=round(res.v_ed / res.v_rdc, 2) if res.v_rdc else 0,
    )

    compliance = (
        [ComplianceCheck(check=f"Flexure — span {s.index}", status=s.status,
                         ratio=round(s.area_required / s.area_provided, 2) if s.area_provided else 0, limit=1.0)
         for s in spans_out] +
        [ComplianceCheck(check=f"Flexure — {s.position}", status=s.status,
                         ratio=round(s.area_required / s.area_provided, 2) if s.area_provided else 0, limit=1.0)
         for s in supports_out if s.hogging_moment > 0] +
        [ComplianceCheck(check="Deflection (span/depth)", status=res.deflection_status,
                         ratio=round(res.actual_slenderness / res.slenderness_limit, 2) if res.slenderness_limit else 0, limit=1.0),
         ComplianceCheck(check="Shear (v_Ed / v_Rd,c)", status=res.shear_status,
                         ratio=round(res.v_ed / res.v_rdc, 2) if res.v_rdc else 0, limit=1.0)]
        + dfc_checks
    )

    cost_breakdown = CostBreakdown(
        concrete={"volume": round(volume_concrete, 3), "rate": concrete_rate, "cost": round(cost_concrete, 2)},
        steel={"weight": round(steel_weight, 1), "rate": steel_rate / 1000, "cost": round(cost_steel, 2)},
        formwork={"area": round(total_len, 2), "rate": formwork_rate, "cost": round(cost_formwork, 2)},
        total=round(total_cost, 2),
        total_per_sqm=round(total_cost / total_len, 2) if total_len else 0,
    )

    diagram = DiagramOut(
        x=[round(v, 3) for v in res.x_m],
        bmd=[round(v, 2) for v in res.bmd_kNm],
        sfd=[round(v, 2) for v in res.sfd_kN],
    )

    report = _front_matter(request, res, compliance) + _build_report(request, res, dfc_rows, dfc_checks, overall)

    return ContinuousSlabResult(
        task_id="completed", status="completed", summary=summary, envelope=envelope,
        spans=spans_out, supports=supports_out, deflection=deflection, shear=shear,
        compliance=compliance, cost_breakdown=cost_breakdown, diagram=diagram, report=report,
    )


def _s_max_7_3N(sigma_s, w_col):
    """Max bar spacing from EC2 Table 7.3N, linear between rows. w_col: 1 = 0.4 mm,
    2 = 0.3 mm, 3 = 0.2 mm. Returns 0 where the table gives no permitted spacing."""
    rows = [(r[0], r[w_col]) for r in CRACK_TABLE_7_3N]
    if sigma_s <= rows[0][0]:
        return float(rows[0][1])
    for (s1, v1), (s2, v2) in zip(rows, rows[1:]):
        if sigma_s <= s2:
            if v1 is None or v2 is None:
                return 0.0
            return v1 + (v2 - v1) * (sigma_s - s1) / (s2 - s1)
    return 0.0


def _durability_fire_crack(request, res):
    """
    Cover for exposure (EC2 4.4.1), fire resistance by tabulated data
    (EN 1992-1-2 Table 5.8) and crack control without direct calculation
    (EC2 7.3.3). Returns report rows plus one compliance entry per check;
    each check also feeds the overall PASS/FAIL.
    """
    R = lambda ref, calc, out: {"reference": ref, "calculation": calc, "output": out}
    dp = request.design_params
    h = request.geometry_thickness
    exposure = _enum(dp.exposure_class)
    c_nom_prov = res.cover_mm                      # clear cover + the fixed 5 mm the engine adds
    dc_dev = res.cover_mm - request.clear_cover    # = 5 mm
    located = [(f"Span {s.index}", s, s.M_sag_kNm) for s in res.spans] + \
              [(sp.position, sp, sp.M_hog_kNm) for sp in res.supports if sp.M_hog_kNm > 0.01]   # pinned ends come back as ~1e-15, not 0
    phi_max = max((x.bar.bar_dia for x in list(res.spans) + list(res.supports) if x.bar), default=12)
    phi_bot = max((s.bar.bar_dia for s in res.spans if s.bar), default=12)
    rows, checks = [], []

    # ---- cover for durability and bond ----
    c_min_b = float(phi_max)
    c_min_dur = EXPOSURE_MIN_DUR_MM.get(exposure, 20.0)
    c_min = max(c_min_b, c_min_dur, 10.0)
    c_nom_req = c_min + dc_dev
    cov_ok = c_nom_prov >= c_nom_req - 1e-6
    rows += [
        R("EC2 4.4.1.2(3)", f"c_min,b = largest bar φ = {phi_max:.0f} mm", f"c_min,b = {c_min_b:.0f} mm"),
        R("EC2 4.4.1.2(5)", f"c_min,dur for exposure {exposure} (same table as the two-way slab module; at or above Table 4.4N S4 in every class)", f"c_min,dur = {c_min_dur:.0f} mm"),
        R("EC2 Eq. 4.2", f"c_min = max(c_min,b ; c_min,dur ; 10) = max({c_min_b:.0f} ; {c_min_dur:.0f} ; 10)", f"c_min = {c_min:.0f} mm"),
        R("EC2 4.4.1.3", f"c_nom,req = c_min + Δc_dev = {c_min:.0f} + {dc_dev:.0f}  vs  c_nom,prov = {request.clear_cover:.0f} + {dc_dev:.0f} = {c_nom_prov:.0f} mm",
          "PASS" if cov_ok else f"FAIL -- increase clear cover to ≥ {c_min:.0f} mm"),
    ]
    checks.append(ComplianceCheck(check=f"Cover for exposure {exposure}", status="PASS" if cov_ok else "FAIL",
                                  ratio=round(c_nom_req / c_nom_prov, 2) if c_nom_prov else 0, limit=1.0))

    # ---- fire resistance, tabulated data ----
    R_min = int(dp.fire_rating or 0)
    if R_min <= 0:
        rows.append(R("EN 1992-1-2", "no fire resistance period specified", "not checked"))
    else:
        key = next((k for k in sorted(FIRE_TABLE_5_8) if k >= R_min), None)
        if key is None:
            rows.append(R("EN 1992-1-2 Table 5.8", f"REI {R_min} is beyond the table (max REI 240)", "FAIL -- outside tabulated data"))
            checks.append(ComplianceCheck(check=f"Fire REI {R_min}", status="FAIL", ratio=0, limit=1.0))
        else:
            hs, a_req = FIRE_TABLE_5_8[key]
            a_prov = c_nom_prov + phi_bot / 2.0
            fire_ok = h >= hs and a_prov >= a_req - 1e-6
            rows += [
                R("EN 1992-1-2 Table 5.8", f"one-way solid slab, REI {key}" + (f" (next tabulated period above REI {R_min})" if key != R_min else ""), f"h_s ≥ {hs} mm ; a ≥ {a_req} mm"),
                R("EN 1992-1-2 5.7.3(1)", "Table 5.8 applies to continuous slabs; this design uses linear elastic moments with no redistribution", "applies"),
                R("Thickness", f"h = {h:.0f} mm vs h_s = {hs} mm", "PASS" if h >= hs else "FAIL"),
                R("Axis distance", f"a = c_nom + φ/2 = {c_nom_prov:.0f} + {phi_bot:.0f}/2 = {a_prov:.0f} mm vs a = {a_req} mm (bottom span bars)",
                  "PASS" if a_prov >= a_req - 1e-6 else "FAIL"),
            ]
            if key >= 90:
                rows.append(R("EN 1992-1-2 5.7.3(3)", "REI ≥ 90: top reinforcement over each intermediate support should extend ≥ 0.3·l_eff from the support centre", "detailing -- not checked"))
            checks.append(ComplianceCheck(check=f"Fire REI {key} (Table 5.8)", status="PASS" if fire_ok else "FAIL",
                                          ratio=round(max(hs / h, a_req / a_prov), 2), limit=1.0))

    # ---- crack control without direct calculation ----
    w_user = float(dp.crack_width_limit or 0.3)
    w_rec = W_MAX_7_1N.get(exposure, 0.3)
    w_lim = min(w_user, w_rec)
    occ = (getattr(request, "occupancy", None) or "").strip().lower()
    psi2 = PSI2_BY_OCCUPANCY.get(occ, PSI2_UNSTATED)
    qp_ratio = (res.g_k + psi2 * res.q_k) / res.w_ed if res.w_ed else 0.0
    w_col = 1 if w_lim >= 0.4 else 2 if w_lim >= 0.3 else 3 if w_lim >= 0.2 else None
    exempt = h <= 200 and w_lim >= w_rec
    rows += [
        R("EC2 Table 7.1N", f"recommended w_max for {exposure} = {w_rec} mm ; limit entered = {w_user} mm", f"w_lim = {w_lim} mm (stricter of the two)"),
        R("EN 1990 Table A1.1", (f"occupancy '{occ}': ψ2 = {psi2}" if occ in PSI2_BY_OCCUPANCY else f"occupancy not stated: ψ2 = {psi2} assumed (categories C/D/F) -- choose an occupancy for A/B (0.3) or storage (0.8)"), f"ψ2 = {psi2}"),
        R("Quasi-permanent", f"(G_k + ψ2·Q_k)/w_Ed = ({res.g_k:.2f} + {psi2}×{res.q_k:.2f})/{res.w_ed:.2f}", f"= {qp_ratio:.3f}"),
    ]
    if w_col is None:
        rows.append(R("EC2 7.3.3", f"w_lim = {w_lim} mm is below the 0.2 mm column of Table 7.3N; needs a direct crack-width calculation (EC2 7.3.4), not implemented", "FAIL -- not covered"))
        checks.append(ComplianceCheck(check=f"Crack control (w ≤ {w_lim} mm)", status="FAIL", ratio=0, limit=1.0))
    else:
        worst, crack_ok = 0.0, True
        for label, x, M in located:
            if not x.bar or not x.z_mm:
                continue
            sigma = (M * qp_ratio * 1e6) / (x.z_mm * x.bar.As_prov) if M > 0 else 0.0
            s_max = _s_max_7_3N(sigma, w_col)
            ok = s_max > 0 and x.bar.spacing <= s_max + 1e-6
            crack_ok = crack_ok and ok
            worst = max(worst, x.bar.spacing / s_max if s_max else 9.99)
            rows.append(R(f"Table 7.3N -- {label}",
                          f"σ_s = M_Ed·(qp)/(z·A_s,prov) = {M:.2f}×{qp_ratio:.3f}×10⁶/({x.z_mm:.0f}×{x.bar.As_prov:.0f}) = {sigma:.0f} MPa → s_max = {s_max:.0f} mm ; provided T{x.bar.bar_dia}@{x.bar.spacing}",
                          ("PASS" if ok else "FAIL") + (" (for information)" if exempt else "")))
        if exempt:
            rows.append(R("EC2 7.3.3(1)", f"h = {h:.0f} mm ≤ 200 mm and w_lim is the Table 7.1N value: no specific measures to control cracking are necessary (detailing to EC2 9.3)", "PASS"))
            status = "PASS"
        else:
            status = "PASS" if crack_ok else "FAIL"
        checks.append(ComplianceCheck(check=f"Crack control (w ≤ {w_lim} mm)", status=status,
                                      ratio=0 if exempt else round(worst, 2), limit=1.0))
    return rows, checks


def _front_matter(request, res, compliance):
    """
    REPORT IDENTIFICATION, 0. DESIGN BASIS AND SCOPE and 0b. NATIONALLY
    DETERMINED PARAMETERS USED, laid out as in the column report (see
    report_front_matter.py), stating what this engine actually does.
    """
    dp = request.design_params
    exposure = _enum(dp.exposure_class)
    n = res.n_spans
    ends = f"{_enum(request.start_support)} to {_enum(request.end_support)}"
    c_min_dur = EXPOSURE_MIN_DUR_MM.get(exposure, 20.0)
    return front_matter(
        member="SLAB", member_label="not entered (slab strips have no ID field)",
        design=(f"Continuous one-way solid slab, {n} spans ({ends}), "
                f"spans {', '.join(f'{L:.2f}' for L in request.span_lengths)} m, "
                f"h = {request.geometry_thickness:.0f} mm, designed as a 1 m strip."),
        design_tag="continuous",
        checks=[(c.check, c.ratio, c.status) for c in compliance],
        design_basis=request.design_basis,
        module="continuous slab",
        used_for=("moment and shear envelopes from pattern loading, span and support "
                  "reinforcement, minimum steel, deflection by span/depth ratio, shear without "
                  "shear reinforcement, cover for exposure, fire resistance by tabulated data and "
                  "crack control by bar spacing, for one 1 m strip."),
        basis_of_design=(f"Uniformly distributed load on a 1 m strip continuous over {n} spans. "
                         "Linear elastic analysis by the direct stiffness method with no "
                         "redistribution; envelope over the load patterns of section 4. Flexure by "
                         "the K-method (Cl. 6.1), minimum steel by Cl. 9.2.1.1, deflection by "
                         "span/effective depth on the governing span (Cl. 7.4.2), shear without "
                         "shear reinforcement at d from the support face (Cl. 6.2.1(8), 6.2.2), "
                         "cover by Cl. 4.4.1, fire by EN 1992-1-2 Table 5.8, crack control by "
                         "Cl. 7.3.3."),
        load_path=("The strip spans one way over its supports, taken as rigid line supports that "
                   "do not settle, with the end conditions entered. The supporting beams or walls "
                   "are not designed here. Lateral stability is not assessed."),
        loading=("Loaded spans 1.35 Gk + 1.5 Qk, unloaded spans 1.35 Gk (Cl. 5.1.3(1)P). "
                 "Patterns: all spans loaded, alternate spans loaded, and each pair of adjacent "
                 "spans loaded (section 4); not every combination. Area loads only."),
        not_assessed=("punching and concentrated loads; openings; curtailment of top steel "
                      "(including the 0.3 l_eff extension for REI 90 and above); the supporting "
                      "beams, walls and columns; disproportionate collapse (Approved Document A); "
                      "lateral stability."),
        verification=[
            ("Verification, analysis",
             "The moment solver reproduces textbook continuous-beam coefficients: 2 equal spans, "
             "support -wL^2/8 and span 9wL^2/128; 3 equal spans, support -wL^2/10 and end span "
             "0.080wL^2.", "coefficients"),
            ("Verification, hand checks",
             "Hand checks made during development: 3 spans of 4 m, h = 200 mm (support and span "
             "moments and shears); unequal spans against an independent solver; the cover, fire "
             "and crack checks of section 10b (3 October 2026). These are development records, "
             "not a published worked example.", "recorded"),
        ],
        ndp_rows=ndp_partial_factors() + [ndp_alpha_cc_k_method()]
                 + ndp_cover_rows(
                     f"c_min,dur = {c_min_dur:.0f} mm for {exposure}, from the software's own table "
                     "(XC1 20, XC2 25, XC3 30, XC4 35 mm), at or above Table 4.4N at structural "
                     "class S4 in every class. Checked in section 10b. Not the UK NA basis.")
                 + [ndp_min_steel(), ndp_shear_no_links(), ndp_deflection(),
                    _fm_row("EN 1992-1-1 Cl. 5.1.3(1)P",
                            "Load arrangements: alternate spans loaded and any two adjacent spans "
                            "loaded (the recommended set), plus all spans loaded. The UK NA value "
                            "was not checked here.", "EN text"),
                    _fm_row("EN 1992-1-2 Table 5.8",
                            "Minimum thickness h_s and axis distance a for one-way slabs, "
                            "recommended values. The UK NA to EN 1992-1-2 was not checked here.",
                            "EN text"),
                    _fm_row("EN 1992-1-1 Table 7.1N, 7.3N",
                            "w_max = 0.4 mm (XC1), 0.3 mm (XC2 to XC4); maximum bar spacing from "
                            "Table 7.3N. Recommended values; the UK NA value was not checked here.",
                            "EN text"),
                    _fm_row("EN 1990 Table A1.1",
                            f"psi_2 from the occupancy entered, or {PSI2_UNSTATED} where none is "
                            "stated. Recommended values; the UK NA to EN 1990 was not checked here.",
                            "EN text")],
    )


def _build_report(request, res, dfc_rows, dfc_checks, overall):
    R = lambda ref, calc, out: {"reference": ref, "calculation": calc, "output": out}
    fyd = res.fyk / 1.15
    fcd = res.fck / 1.5
    sec = []

    # ---------------- 1. Geometry & Cover ----------------
    sec.append({"title": "1. Geometry & Cover", "rows": [
        R("Cover input", f"clear cover specified by user, Cc = {request.clear_cover:.0f} mm", f"Cc,input = {request.clear_cover:.0f} mm"),
        R("Tolerance", "a fixed 5 mm fixing/detailing allowance is added to the clear cover specified above -- this is not user-editable", "+5 mm"),
        R("Cover used", f"Cc,used = Cc,input + 5 mm = {request.clear_cover:.0f} + 5", f"Cc = {res.cover_mm:.0f} mm"),
        R("EC2 §6.1", f"d = h − Cc − φ/2 = {request.geometry_thickness:.0f} − {res.cover_mm:.0f} − φ/2", f"d = {res.d_mm:.0f} mm"),
        R("Spans", f"{res.n_spans} spans: {', '.join(f'{L:.2f}' for L in request.span_lengths)} m (each ≤ 4.5 m, the practical one-way slab limit)", f"{_enum(request.start_support)}–{_enum(request.end_support)}"),
    ]})

    # ---------------- 2. Materials ----------------
    sec.append({"title": "2. Materials", "rows": [
        R("EC2 Table 3.1", f"f_ctm = {res.fctm:.2f} MPa (grade {request.materials.concrete_grade})", f"f_ctm = {res.fctm:.2f} MPa"),
        R("EC2 §3.1.6", f"f_cd = f_ck/γ_c = {res.fck:.0f}/1.50", f"f_cd = {fcd:.2f} MPa"),
        R("EC2 §3.2.7", f"f_yd = f_yk/γ_s = {res.fyk:.0f}/1.15", f"f_yd = {fyd:.1f} MPa"),
    ]})

    # ---------------- 3. Loads & Combination ----------------
    sec.append({"title": "3. Loads & Combination", "rows": [
        R("Self weight", f"25 × {request.geometry_thickness/1000:.3f}", f"{res.self_weight:.2f} kN/m²"),
        R("Permanent", "G_k = self + finishes + partition + extra dead", f"G_k = {res.g_k:.2f} kN/m²"),
        R("Variable", "Q_k = live + additional live", f"Q_k = {res.q_k:.2f} kN/m²"),
        R("EN 1990", f"w_Ed = 1.35×{res.g_k:.2f} + 1.50×{res.q_k:.2f}", f"w_Ed = {res.w_ed:.2f} kN/m²"),
    ]})

    # ---------------- 4. Load patterns considered ----------------
    pattern_rows = [
        R("UK/EC2 practice", "the moment envelope must come from load patterns, not a single all-spans-loaded case -- an unloaded alternate span can govern sagging elsewhere, and a support between two loaded (with adjacent unloaded) spans can govern hogging there", f"{len(res.load_patterns_used)} patterns considered"),
        R("EC2 §5.1.3(1)P", f"loaded span: 1.35·G_k + 1.50·Q_k = {res.w_ed:.2f} kN/m² ; unloaded span: 1.35·G_k = 1.35 × {res.g_k:.2f} = {1.35 * res.g_k:.2f} kN/m² (permanent load is always present, never zero)", "γ_G = 1.35 on every span"),
    ]
    for lbl in res.load_patterns_used:
        pattern_rows.append(R("Pattern", lbl, "solved"))
    sec.append({"title": "4. Load Patterns Considered", "rows": pattern_rows})

    # ---------------- 5. FEM trace (all-spans-loaded, reference) ----------------
    fem_rows = [
        R("Section", f"b·h³/12 = 1000 × {request.geometry_thickness:.0f}³/12", f"I_g = {res.Ig_mm4:.3e} mm⁴"),
        R("Rigidity", f"EI = E·I_g = 33000 × {res.Ig_mm4:.3e}", f"EI = {res.EI_Nmm2:.3e} N·mm²"),
        R("Element stiffness", "k = (EI/L³)[[12,6L,−12,6L],[6L,4L²,−6L,2L²],[−12,−6L,12,−6L],[6L,2L²,−6L,4L²]]", f"{res.n_spans} elements"),
        R("Fixed-end (UDL)", "f = [wL/2, wL²/12, wL/2, −wL²/12] per element", "assembled into global F"),
        R("Solve", "K·θ = F  (all vertical DOFs restrained; solve nodal rotations) -- shown for the ALL-SPANS-LOADED case; governing design moments come from the full pattern-loading envelope", f"{len(res.rotations_rad)} nodes"),
    ]
    for i, th in enumerate(res.rotations_rad):
        fem_rows.append(R(f"θ node {i}", "nodal rotation (all-spans-loaded case)", f"{th:+.6e} rad"))
    sec.append({"title": "5. Continuous Analysis — FEM Trace (All-Spans-Loaded)", "rows": fem_rows})

    nm_rows = []
    for i, m in enumerate(res.node_moments_kNm):
        tag = "end support (pinned) → 0" if (i == 0 or i == len(res.node_moments_kNm) - 1) else "interior support (hogging), all-spans-loaded case"
        nm_rows.append(R(f"Node {i}", tag, f"M = {m:+.2f} kNm/m"))
    sec.append({"title": "5b. Node Moments — All-Spans-Loaded (Reference)", "rows": nm_rows})

    # ---------------- 6. Span (sagging) reinforcement -- full K/Z/As derivation ----------------
    span_rows = [R("EC2 §6.1", "M(x) = -Mi + Vi·x − wx²/2, peak sampled along each element; GOVERNING value taken as the envelope maximum across every load pattern in Section 4, not just all-spans-loaded", "pattern envelope")]
    b = 1000.0
    for s in res.spans:
        root = max(0.25 - s.k / 1.134, 0.0)
        span_rows.append(R(f"Span {s.index} (L={s.length_m:.2f} m)", f"K = M_sag/(f_ck·b·d²) = ({s.M_sag_kNm:.2f}×10⁶)/({res.fck:.0f}×{b:.0f}×{res.d_mm:.0f}²) [governed by: {s.governing_pattern}]", f"K = {s.k:.4f}"))
        span_rows.append(R("EC2 §6.1", f"Z = d(0.5+√(0.25−K/1.134)) = {res.d_mm:.0f}(0.5+√{root:.4f})", f"Z = {s.z_mm:.1f} mm"))
        span_rows.append(R("EC2 §6.1", f"A_s = M_sag×10⁶/(f_yd·Z) = ({s.M_sag_kNm:.2f}×10⁶)/(435×{s.z_mm:.1f})", f"A_s,req = {s.As_req:.0f} mm²/m"))
        bar = f"T{s.bar.bar_dia}@{s.bar.spacing} ({s.bar.As_prov:.0f} mm²/m)" if s.bar else "-"
        span_rows.append(R("Provide", f"A_s,min = {s.As_min:.0f} ; A_s,req = max(bending, min) = {s.As_req:.0f}", f"{bar} ({s.status})"))
    sec.append({"title": "6. Span (Sagging) Reinforcement", "rows": span_rows})

    # ---------------- 7. Support (hogging) reinforcement -- full K/Z/As derivation ----------------
    sup_rows = []
    for s in res.supports:
        if s.M_hog_kNm > 0:
            root = max(0.25 - s.k / 1.134, 0.0)
            sup_rows.append(R(s.position, f"K = M_hog/(f_ck·b·d²) [governed by: {s.governing_pattern}]", f"K = {s.k:.4f}"))
            sup_rows.append(R("EC2 §6.1", f"Z = d(0.5+√(0.25−K/1.134)) = {res.d_mm:.0f}(0.5+√{root:.4f})", f"Z = {s.z_mm:.1f} mm"))
            sup_rows.append(R("EC2 §6.1", f"A_s = M_hog×10⁶/(f_yd·Z)", f"A_s,req = {s.As_req:.0f} mm²/m"))
        else:
            sup_rows.append(R(s.position, "no hogging at this support -- nominal minimum steel only", f"A_s,req = {s.As_req:.0f} mm²/m"))
        bar = f"T{s.bar.bar_dia}@{s.bar.spacing} ({s.bar.As_prov:.0f} mm²/m)" if s.bar else "-"
        sup_rows.append(R("Provide", f"M_hog = {s.M_hog_kNm:.2f} kNm/m ; A_s,min = {s.As_min:.0f}", f"{bar} ({s.status})"))
    sec.append({"title": "7. Support (Hogging) Reinforcement", "rows": sup_rows})

    # ---------------- 8. Minimum reinforcement basis (shared across the member -- same d/fctm/fyk) ----------------
    d = res.d_mm
    t1 = 0.26 * res.fctm / res.fyk * b * d
    t2 = 0.0013 * b * d
    gov = "concrete tensile strength basis" if t1 >= t2 else "0.13% minimum basis"
    sec.append({"title": "8. Minimum Reinforcement Check", "rows": [
        R("EC2 §9.2.1.1", "A_s,min = max( 0.26·f_ctm/f_yk·b·d , 0.0013·b·d ) -- same d applies at every span and support on this member", "As,min formula"),
        R("Basis 1 — concrete tensile strength", f"0.26 × {res.fctm:.2f}/{res.fyk:.0f} × {b:.0f}×{d:.0f}", f"{t1:.0f} mm²/m"),
        R("Basis 2 — 0.13% of section", f"0.0013 × {b:.0f}×{d:.0f}", f"{t2:.0f} mm²/m"),
        R("Governing", f"A_s,min = max({t1:.0f}, {t2:.0f}) ← {gov} governs", f"A_s,min = {max(t1,t2):.0f} mm²/m"),
    ]})

    # ---------------- 9. Deflection (governing span) -- full derivation ----------------
    gov_span = max(res.spans, key=lambda s: s.M_sag_kNm)
    branch = "A (ρ ≤ ρ₀, lightly reinforced)" if res.rho <= res.rho0 else "B (ρ > ρ₀, heavily reinforced)"
    defl_rows = [
        R("Governing span", f"Span {gov_span.index} (L={gov_span.length_m:.2f} m) -- highest sagging demand", f"L = {gov_span.length_m:.2f} m"),
        R("Note", "K = 1.3 for an end span (one end continuous, other simply supported); K = 1.5 for a true interior span (EC2 Table 7.4N)", f"K = {res.K_sys:.2f}"),
        R("Basic span/depth ratio", f"ρ = A_s,required/(b·d) = {gov_span.As_req:.0f}/({b:.0f}×{d:.0f})", f"ρ = {res.rho:.5f}"),
        R("Basic span/depth ratio", f"ρ₀ = 10⁻³ × √f_ck = 10⁻³ × √{res.fck:.0f}", f"ρ₀ = {res.rho0:.5f}"),
        R("Branch", f"ρ = {res.rho:.5f} vs ρ₀ = {res.rho0:.5f}", f"branch {branch}"),
        R("EC2 §7.4.2", ("(L/d) = K[11 + 1.5√f_ck·(ρ₀/ρ) + 3.2√f_ck·(ρ₀/ρ − 1)^1.5]" if res.rho <= res.rho0
                         else "(L/d) = K[11 + 1.5√f_ck·ρ₀/ρ]  (Eq. 7.16b, ρ' = 0)"),
          f"(L/d)_basic = {res.ld_basic:.2f}"),
        R("Actual deflection", f"(L/d)_actual = L/d = {gov_span.length_m*1000:.0f}/{d:.0f}", f"{res.actual_slenderness:.2f}"),
        R("Base check", f"(L/d)_actual {'≤' if res.deflection_base_status == 'PASS' else '>'} (L/d)_basic (before any enhancement) → {res.actual_slenderness:.2f} {'≤' if res.deflection_base_status == 'PASS' else '>'} {res.ld_basic:.2f}", res.deflection_base_status),
    ]
    if res.deflection_enhanced:
        defl_rows += [
            R("Enhancement factor", f"base check failed → F3 = A_s,prov/A_s,req = {gov_span.bar.As_prov:.0f}/{gov_span.As_req:.0f}  (≤ 1.5)" if gov_span.bar else "F3 = 1.0", f"F3 = {res.F3:.3f}"),
            R("Allowable span/depth ratio", f"(L/d)_allow = (L/d)_basic × F3 = {res.ld_basic:.2f} × {res.F3:.3f}", f"{res.slenderness_limit:.2f}"),
        ]
    else:
        defl_rows.append(R("Enhancement factor", "base check already passes -- F3 not required", "F3 not applied"))
    defl_rows.append(R("Verdict", f"(L/d)_actual {'<' if res.deflection_status == 'PASS' else '>'} allowable (L/d) → {res.actual_slenderness:.2f} {'<' if res.deflection_status == 'PASS' else '>'} {res.slenderness_limit:.2f}",
                        "Deflection is okay" if res.deflection_status == "PASS" else "Deflection is NOT okay — increase depth or steel"))
    sec.append({"title": "9. Deflection (Governing Span)", "rows": defl_rows})

    # ---------------- 10. Shear -- full term breakdown ----------------
    as_prov_gov = max((s.bar.As_prov for s in res.spans + res.supports if s.bar), default=0.0)
    rho_l = min(as_prov_gov / (b * d), 0.02) if d else 0.0
    k_sh = min(1 + math.sqrt(200 / d), 2.0) if d else 1.0
    C_Rdc = 0.18 / 1.5
    v_main = C_Rdc * k_sh * (100 * rho_l * res.fck) ** (1 / 3)
    v_min_val = 0.035 * k_sh ** 1.5 * math.sqrt(res.fck)
    shear_rows = [
        R("EC2 §6.2.1(8)", f"critical section at distance d = {d:.0f} mm from the support face; V_Ed = V_face − w·d", "reduction applied"),
    ]
    for sp in res.supports:
        if sp.shear_kN:
            shear_rows.append(R(sp.position, f"V_face = {sp.shear_kN:.2f} kN [{sp.shear_pattern}] → V_Ed = {sp.shear_reduced_kN:.2f} kN", ""))
    shear_rows += [
        R("Steel ratio", f"ρ_i = A_s,provided/(b·d) = {as_prov_gov:.0f}/({b:.0f}×{d:.0f})  (≤ 0.02)", f"ρ_i = {rho_l:.5f}"),
        R("Size factor", f"k = 1 + √(200/d) = 1 + √(200/{d:.0f})  (≤ 2.0)", f"k = {k_sh:.3f}"),
        R("EC2 §6.2.2", f"C_Rd,c = 0.18/γ_c = 0.18/1.50", f"C_Rd,c = {C_Rdc:.3f}"),
        R("Main term", f"C_Rd,c·k·(100·ρ_i·f_ck)^(1/3) = {C_Rdc:.3f}×{k_sh:.3f}×(100×{rho_l:.5f}×{res.fck:.0f})^(1/3)", f"{v_main:.3f} MPa"),
        R("v_min", f"v_min = 0.035·k^1.5·f_ck^0.5 = 0.035×{k_sh:.3f}^1.5×√{res.fck:.0f}", f"{v_min_val:.3f} MPa"),
        R("Governing", f"v_Rd,c = max({v_main:.3f}, {v_min_val:.3f})", f"v_Rd,c = {res.v_rdc:.3f} MPa"),
        R("EC2 §6.2.2", f"v_Ed = {res.v_ed:.3f} MPa vs v_Rd,c = {res.v_rdc:.3f} MPa", res.shear_status),
    ]
    sec.append({"title": "10. Shear (EC2 6.2.2, with reduction at support)", "rows": shear_rows})

    # ---------------- 10b. Durability, fire and crack control ----------------
    sec.append({"title": "10b. Durability, Fire and Crack Control", "rows": dfc_rows})

    # ---------------- 11. Checks & Notes -- itemized, so a FAIL is always traceable ----------------
    check_rows = []
    for s in res.spans:
        check_rows.append(R(f"Flexure — Span {s.index}", f"A_s,req {s.As_req:.0f} vs A_s,prov {s.bar.As_prov:.0f}" if s.bar else "no bar selected", s.status))
    for sp in res.supports:
        check_rows.append(R(f"Flexure — {sp.position}", f"A_s,req {sp.As_req:.0f} vs A_s,prov {sp.bar.As_prov:.0f}" if sp.bar else "no bar selected", sp.status))
    check_rows.append(R("Deflection", f"(L/d) actual {res.actual_slenderness:.1f} vs allowable {res.slenderness_limit:.1f}", res.deflection_status))
    check_rows.append(R("Shear", f"v_Ed {res.v_ed:.3f} vs v_Rd,c {res.v_rdc:.3f} MPa", res.shear_status))
    for c in dfc_checks:
        check_rows.append(R(c.check, "see section 10b", c.status))
    failed = [r["reference"] for r in check_rows if r["output"] == "FAIL"]
    check_rows.append(R("Overall", "FAILED checks: " + (", ".join(failed) if failed else "none") if overall == "FAIL" else "all checks pass", overall))
    for n in res.notes:
        check_rows.append(R("Note", n, ""))
    sec.append({"title": "11. Checks & Notes", "rows": check_rows})

    return sec