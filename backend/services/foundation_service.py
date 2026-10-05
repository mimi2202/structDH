# backend/services/foundation_service.py
from models.foundation_schemas import (
    PadFoundationRequest, PadFoundationResponse,
    GeometryOut, SoilPressureOut, CornersOut, DesignMomentsOut,
    FlexureOut, FlexureDirectionOut, OneWayShearOut, ShearDirectionOut,
    PunchingOut, UtilisationOut, MaterialsOut,
)
from engine.pad_foundation_engine import PadFoundationInput, design_pad_foundation


def _design_basis_rows(db):
    """
    Rows naming who designed, who checked, who is responsible for stability,
    and whether an independent check is required or done. db is a
    FoundationDesignBasis Pydantic model (request.design_basis): attribute
    access, not .get(). A field left blank prints "not entered" rather than
    being omitted.
    """
    R = lambda ref, calc, out: {"ref": ref, "calc": calc, "out": out}

    def person(name, quals, label):
        if not name and not quals:
            return f"{label}: not entered"
        if name and quals:
            return f"{name}, {quals}"
        return name or f"Qualifications: {quals}"

    designer = (db.designer_name or "").strip()
    dq = (db.designer_qualifications or "").strip()
    checker = (db.checked_by or "").strip()
    cq = (db.checker_qualifications or "").strip()
    stab = (db.stability_responsible or "").strip()
    choice = db.independent_check

    def box(v):
        return "[X]" if choice == v else "[ ]"

    return [
        R("Designer", person(designer, dq, "Name"), "as entered" if (designer or dq) else "blank"),
        R("Checked by", person(checker, cq, "Name"), "as entered" if (checker or cq) else "blank"),
        R("Responsible for stability", stab if stab else "Organisation or individual: not entered",
          "as entered" if stab else "blank"),
        R("Independent check",
          f"{box('required')} Required     {box('completed')} Completed"
          + ("" if choice else "     (not stated)"),
          "designer to state"),
    ]


def calculate_pad_foundation(request: PadFoundationRequest) -> PadFoundationResponse:
    inp = PadFoundationInput(
        axial_load_kN=request.axial_load_kN,
        moment_x_kNm=request.moment_x_kNm,
        moment_y_kNm=request.moment_y_kNm,
        footing_length_mm=request.footing_length_mm,
        footing_width_mm=request.footing_width_mm,
        footing_depth_mm=request.footing_depth_mm,
        column_x_mm=request.column_x_mm,
        column_y_mm=request.column_y_mm,
        concrete_grade_fck=request.concrete_grade_fck,
        steel_grade_fyk=request.steel_grade_fyk,
        allowable_bearing_kN_m2=request.allowable_bearing_kN_m2,
        cover_mm=request.cover_mm,
        bar_dia_mm=request.bar_dia_mm,
        gamma_c=request.gamma_c,
        gamma_s=request.gamma_s,
    )

    res = design_pad_foundation(inp)
    report = _build_report(request, res)

    # Utilisation percentages. "shear" is the governing (worse) of the two
    # one-way shear directions, matching the single "One-way shear (max)"
    # figure the results page shows. "overall" is the worst of the three
    # figures the page actually displays (bearing, shear, punching) --
    # flexural status is shown separately as a pass/fail chip, not folded
    # into a percentage, so it is not part of this max.
    bearing_pct = (res.qmax / request.allowable_bearing_kN_m2) * 100.0
    shear_pct = max(
        (res.shear_x.VEd_kN_m / res.shear_x.VRdc_kN_m) * 100.0 if res.shear_x.VRdc_kN_m else 0.0,
        (res.shear_y.VEd_kN_m / res.shear_y.VRdc_kN_m) * 100.0 if res.shear_y.VRdc_kN_m else 0.0,
    )
    punching_pct = (res.punching.vEd / res.punching.vRdc) * 100.0 if res.punching.vRdc else 0.0
    overall_pct = max(bearing_pct, shear_pct, punching_pct)

    corners_by_key = _corners_to_c1234(res.corner_pressures)

    return PadFoundationResponse(
        task_id="completed", status=res.overall_status, load_case=res.load_case,
        geometry=GeometryOut(
            footing_length_mm=request.footing_length_mm,
            footing_width_mm=request.footing_width_mm,
            footing_depth_mm=request.footing_depth_mm,
            column_x_mm=request.column_x_mm,
            column_y_mm=request.column_y_mm,
            projection_x_mm=round(res.projection_x_mm, 1),
            projection_y_mm=round(res.projection_y_mm, 1),
            d_eff_x_mm=round(res.d_eff_x_mm, 1),
            d_eff_y_mm=round(res.d_eff_y_mm, 1),
            cover_mm=request.cover_mm,
        ),
        soil_pressure=SoilPressureOut(
            q0=round(res.q0, 3), qmax=round(res.qmax, 3), qmin=round(res.qmin, 3),
            bearing_ok=(res.bearing_status == "OK"), uplift_ok=(res.uplift_status == "OK"),
            corners=CornersOut(**{k: round(v, 3) for k, v in corners_by_key.items()}),
        ),
        design_moments=DesignMomentsOut(
            Mx_kNm_per_m=round(res.Mx_kNm_per_m, 3), My_kNm_per_m=round(res.My_kNm_per_m, 3),
        ),
        flexure=FlexureOut(
            x=FlexureDirectionOut(
                d_eff_mm=round(res.d_eff_x_mm, 1), As_req=round(res.flex_x.As_req, 1),
                As_min=round(res.flex_x.As_min, 1), As_provided=round(res.flex_x.As_provided, 1),
                bar_dia=request.bar_dia_mm, spacing_mm=res.flex_x.spacing_mm, status=res.flex_x.status,
            ),
            y=FlexureDirectionOut(
                d_eff_mm=round(res.d_eff_y_mm, 1), As_req=round(res.flex_y.As_req, 1),
                As_min=round(res.flex_y.As_min, 1), As_provided=round(res.flex_y.As_provided, 1),
                bar_dia=request.bar_dia_mm, spacing_mm=res.flex_y.spacing_mm, status=res.flex_y.status,
            ),
        ),
        one_way_shear=OneWayShearOut(
            x=ShearDirectionOut(VEd_kN_per_m=round(res.shear_x.VEd_kN_m, 3),
                                VRdc_kN_per_m=round(res.shear_x.VRdc_kN_m, 3), status=res.shear_x.status),
            y=ShearDirectionOut(VEd_kN_per_m=round(res.shear_y.VEd_kN_m, 3),
                                VRdc_kN_per_m=round(res.shear_y.VRdc_kN_m, 3), status=res.shear_y.status),
        ),
        punching=PunchingOut(vEd_MPa=round(res.punching.vEd, 4), vRdc_MPa=round(res.punching.vRdc, 4),
                             status=res.punching.status),
        utilisation=UtilisationOut(
            overall_pct=round(overall_pct, 1), bearing_pct=round(bearing_pct, 1),
            shear_pct=round(shear_pct, 1), punching_pct=round(punching_pct, 1),
        ),
        materials=MaterialsOut(
            concrete_grade_fck=request.concrete_grade_fck, steel_grade_fyk=request.steel_grade_fyk,
            allowable_bearing_kN_m2=request.allowable_bearing_kN_m2,
        ),
        report=report,
    )


def _corners_to_c1234(corner_pressures: dict) -> dict:
    """
    The engine keys corners by descriptive string ("Corner 1 (+ex,+ey)");
    SoilPressure3D in FoundationResults.jsx reads corners.c1..c4 directly by
    the same (+ex,+ey)/(+ex,-ey)/(-ex,+ey)/(-ex,-ey) convention. Map by
    position, not by re-parsing the label text.
    """
    keys = list(corner_pressures.keys())
    # engine builds these in a fixed order: c1=(+ex,+ey), c2=(+ex,-ey),
    # c3=(-ex,+ey), c4=(-ex,-ey) -- see pad_foundation_engine._soil_pressure_biaxial
    return {
        "c1": corner_pressures[keys[0]],
        "c2": corner_pressures[keys[1]],
        "c3": corner_pressures[keys[2]],
        "c4": corner_pressures[keys[3]],
    }


def _build_report(request: PadFoundationRequest, res) -> list:
    R = lambda ref, calc, out: {"ref": ref, "calc": calc, "out": out}
    d = request
    sec = []

    # ---------------- 1. Design Basis and References ----------------
    rows = [
        R("EN 1990", "Basis of structural design", "adopted"),
        R("EN 1992-1-1", "Design of concrete structures", "adopted"),
        R("EN 1992-1-1 §6.2", "Shear", "adopted"),
        R("EN 1992-1-1 Cl. 6.2.2", "Shear resistance without shear reinforcement", "adopted"),
        R("EN 1992-1-1 Cl. 6.4", "Punching shear", "adopted"),
        R("EN 1992-1-1 Cl. 9.8", "Foundations", "adopted"),
        R("EN 1997-1", "Geotechnical design", "adopted"),
        R("Scope", "Isolated pad foundation. Supports axial, uniaxial and biaxial column loading.",
          res.load_case),
    ]
    rows += _design_basis_rows(request.design_basis)
    sec.append({"section": "1. Design Basis and References", "rows": rows})

    # ---------------- 2. Input Data ----------------
    sec.append({"section": "2. Input Data", "rows": [
        R("Axial load", f"NEd = {d.axial_load_kN:.3f} kN", f"{d.axial_load_kN:.3f} kN"),
        R("Moment about x-axis", f"Mx = {d.moment_x_kNm:.3f} kNm", f"{d.moment_x_kNm:.3f} kNm"),
        R("Moment about y-axis", f"My = {d.moment_y_kNm:.3f} kNm", f"{d.moment_y_kNm:.3f} kNm"),
        R("Load case", "classified from Mx, My", res.load_case),
        R("Footing", f"L = {d.footing_length_mm:.0f} mm, B = {d.footing_width_mm:.0f} mm, "
                    f"h = {d.footing_depth_mm:.0f} mm", "adopted"),
        R("Column", f"cx = {d.column_x_mm:.0f} mm, cy = {d.column_y_mm:.0f} mm", "adopted"),
        R("Materials", f"fck = {d.concrete_grade_fck:.1f} N/mm2, fyk = {d.steel_grade_fyk:.1f} N/mm2",
          "adopted"),
        R("Soil", f"Allowable bearing = {d.allowable_bearing_kN_m2:.1f} kN/m2", "adopted"),
        R("Detailing", f"Cover = {d.cover_mm:.0f} mm, main bar = Y{d.bar_dia_mm:.0f}", "adopted"),
    ]})

    # ---------------- 3. Geometry ----------------
    sec.append({"section": "3. Geometry", "rows": [
        R("Footing area", f"A = L x B = {res.L_m:.3f} x {res.B_m:.3f}", f"A = {res.area_m2:.3f} m2"),
        R("Projection from column face", f"a_x = (L - cx)/2 = ({d.footing_length_mm:.0f} - {d.column_x_mm:.0f})/2",
          f"a_x = {res.projection_x_mm:.1f} mm"),
        R("Projection from column face", f"a_y = (B - cy)/2 = ({d.footing_width_mm:.0f} - {d.column_y_mm:.0f})/2",
          f"a_y = {res.projection_y_mm:.1f} mm"),
        R("Effective depth", "d_x = h - cover - bar diameter/2", f"d_x = {res.d_eff_x_mm:.1f} mm"),
        R("Effective depth", "d_y = h - cover - first layer bar - second layer bar/2",
          f"d_y = {res.d_eff_y_mm:.1f} mm"),
    ]})

    # ---------------- 4. Eccentricity Check ----------------
    sec.append({"section": "4. Eccentricity Check", "rows": [
        R("EN 1992-1-1 Cl. 9.8", f"ex = My / NEd = {d.moment_y_kNm:.3f} / {d.axial_load_kN:.3f}",
          f"ex = {res.ex_m:.4f} m"),
        R("EN 1992-1-1 Cl. 9.8", f"ey = Mx / NEd = {d.moment_x_kNm:.3f} / {d.axial_load_kN:.3f}",
          f"ey = {res.ey_m:.4f} m"),
        R("Middle third limits", f"L/6 = {res.L_m/6:.4f} m, B/6 = {res.B_m/6:.4f} m", "limits"),
        R("Check", "ex within middle third", "OK" if res.ex_within_middle_third else "NOT OK"),
        R("Check", "ey within middle third", "OK" if res.ey_within_middle_third else "NOT OK"),
    ]})

    # ---------------- 5. Soil Pressure Distribution ----------------
    rows = [
        R("Average bearing pressure", f"q0 = NEd / A = {d.axial_load_kN:.3f} / {res.area_m2:.3f}",
          f"q0 = {res.q0:.3f} kN/m2"),
        R("Biaxial corner pressures", "q = q0(1 ± 6ex/L ± 6ey/B)", "four corners computed"),
    ]
    for name, q in res.corner_pressures.items():
        rows.append(R("Corner pressure", name, f"{q:.3f} kN/m2"))
    rows += [
        R("Governing", "qmax, qmin across the four corners",
          f"qmax = {res.qmax:.3f} kN/m2, qmin = {res.qmin:.3f} kN/m2"),
        R("Bearing check", f"qmax vs allowable {d.allowable_bearing_kN_m2:.3f} kN/m2", res.bearing_status),
        R("Uplift check", "qmin >= 0, no tension", res.uplift_status),
    ]
    sec.append({"section": "5. Soil Pressure Distribution", "rows": rows})

    # ---------------- 6. Design Moments at Column Face ----------------
    sec.append({"section": "6. Design Moments at Column Face", "rows": [
        R("Design pressure", "Conservative: q_design = qmax", f"{res.qmax:.3f} kN/m2"),
        R("Moment, X direction", f"Mx = q x ax^2/2 = {res.qmax:.3f} x {res.projection_x_mm/1000:.3f}^2 / 2",
          f"Mx = {res.Mx_kNm_per_m:.3f} kNm/m"),
        R("Moment, Y direction", f"My = q x ay^2/2 = {res.qmax:.3f} x {res.projection_y_mm/1000:.3f}^2 / 2",
          f"My = {res.My_kNm_per_m:.3f} kNm/m"),
    ]})

    # ---------------- 7 & 8. Flexural reinforcement, X and Y ----------------
    for i, (label, flex, d_eff) in enumerate(
        [("X", res.flex_x, res.d_eff_x_mm), ("Y", res.flex_y, res.d_eff_y_mm)], start=7
    ):
        sec.append({"section": f"{i}. Flexural Reinforcement Design — {label} Direction", "rows": [
            R("EC2 §6.1", f"K = M/(b d^2 fck) = ({flex.M_kNm_per_m:.3f}x10^6)/(1000x{d_eff:.1f}^2x{d.concrete_grade_fck:.0f})",
              f"K = {flex.K:.5f}"),
            R("Lever arm (EC2)", "z = d[0.5 + sqrt(0.25 - K/1.134)]", f"z = {flex.z_mm:.1f} mm"),
            R("Required steel", "As = M/(0.87 fyk z)", f"As,req = {flex.As_req:.2f} mm2/m"),
            R("Minimum steel", "As,min = max(0.26 fctm/fyk b d, 0.0013 b d)", f"As,min = {flex.As_min:.2f} mm2/m"),
            R("Design steel", "As,design = max(As,req, As,min)", f"As,design = {flex.As_design:.2f} mm2/m"),
            R("Bar spacing", f"Adopt Y{d.bar_dia_mm:.0f} @ {flex.spacing_mm:.0f} mm c/c",
              f"As,provided = {flex.As_provided:.2f} mm2/m"),
            R("Check", "As,provided >= As,design", flex.status),
        ]})

    # ---------------- 9 & 10. One-way shear, X and Y ----------------
    for i, (label, shear, proj, d_eff) in enumerate(
        [("X", res.shear_x, res.projection_x_mm, res.d_eff_x_mm),
         ("Y", res.shear_y, res.projection_y_mm, res.d_eff_y_mm)], start=9
    ):
        sec.append({"section": f"{i}. One-Way Shear Check — {label} Direction", "rows": [
            R("Critical section", "at distance d from column face", f"projection = {proj/1000:.3f} m, d = {d_eff/1000:.3f} m"),
            R("EC2 Cl. 6.2.2", "VEd = q x shear length", f"VEd = {shear.VEd_kN_m:.3f} kN/m"),
            R("EC2 Cl. 6.2.2", "VRd,c = max(C_Rd,c k (100 rho fck)^(1/3), vmin) x bw x d", f"VRd,c = {shear.VRdc_kN_m:.3f} kN/m"),
            R("Check", "VEd <= VRd,c", shear.status),
        ]})

    # ---------------- 11. Punching shear ----------------
    sec.append({"section": "11. Punching Shear Check", "rows": [
        R("EC2 Cl. 6.4", "Critical perimeter at 2d from column face", f"u1 = {res.punching.u1_m:.3f} m"),
        R("Upward reaction inside perimeter", "q x area inside", f"{res.punching.upward_reaction_kN:.3f} kN"),
        R("EC2 Cl. 6.4", "VEd,punch = NEd - upward reaction inside perimeter", f"{res.punching.VEd_punch_kN:.3f} kN"),
        R("EC2 Cl. 6.4", "vEd = VEd/(u1 x d)", f"vEd = {res.punching.vEd:.4f} N/mm2"),
        R("EC2 Cl. 6.4", "vRd,c as for one-way shear", f"vRd,c = {res.punching.vRdc:.4f} N/mm2"),
        R("Check", "vEd <= vRd,c", res.punching.status),
    ]})

    # ---------------- 12. Final Design Summary ----------------
    sec.append({"section": "12. Final Design Summary", "rows": [
        R("Bearing pressure", f"q0 = {res.q0:.3f}, qmax = {res.qmax:.3f}, qmin = {res.qmin:.3f} kN/m2", res.bearing_status),
        R("Design moments", f"Mx = {res.Mx_kNm_per_m:.3f}, My = {res.My_kNm_per_m:.3f} kNm/m", ""),
        R("Reinforcement, X", f"Y{d.bar_dia_mm:.0f} @ {res.flex_x.spacing_mm:.0f} mm c/c", res.flex_x.status),
        R("Reinforcement, Y", f"Y{d.bar_dia_mm:.0f} @ {res.flex_y.spacing_mm:.0f} mm c/c", res.flex_y.status),
        R("One-way shear, X", f"VEd = {res.shear_x.VEd_kN_m:.3f}, VRd,c = {res.shear_x.VRdc_kN_m:.3f} kN/m", res.shear_x.status),
        R("One-way shear, Y", f"VEd = {res.shear_y.VEd_kN_m:.3f}, VRd,c = {res.shear_y.VRdc_kN_m:.3f} kN/m", res.shear_y.status),
        R("Punching shear", f"vEd = {res.punching.vEd:.4f}, vRd,c = {res.punching.vRdc:.4f} N/mm2", res.punching.status),
        R("Overall", "all checks", res.overall_status),
    ]})

    return sec


# ============================================================
# COMBINED FOOTING
# ============================================================

from models.foundation_schemas import (
    CombinedFootingRequest, CombinedFootingResponse,
    ColumnsOut, ColumnPositionOut, CombinedGeometryOut, CombinedMomentsOut,
    LongitudinalOut, TransverseOut, CombinedShearOut, CombinedUtilisationOut,
    CombinedShearSectionOut, CombinedPunchingOut, ColumnPunchingOut,
)
from engine.combined_footing_engine import CombinedPadInput, design_combined_footing


def calculate_combined_footing(request: CombinedFootingRequest) -> CombinedFootingResponse:
    inp = CombinedPadInput(
        P1_kN=request.column_1.axial_load_kN,
        P1_Mx_kNm=request.column_1.moment_x_kNm,
        P1_My_kNm=request.column_1.moment_y_kNm,
        P2_kN=request.column_2.axial_load_kN,
        P2_Mx_kNm=request.column_2.moment_x_kNm,
        P2_My_kNm=request.column_2.moment_y_kNm,
        column_spacing_m=request.column_spacing_m,
        left_projection_m=request.left_projection_m,
        footing_length_m=request.footing_length_m,
        footing_width_m=request.footing_width_m,
        footing_depth_mm=request.footing_depth_mm,
        column_x_mm=request.column_x_mm,
        column_y_mm=request.column_y_mm,
        fck=request.concrete_grade_fck,
        fyk=request.steel_grade_fyk,
        allowable_bearing_kN_m2=request.allowable_bearing_kN_m2,
        cover_mm=request.cover_mm,
        bar_dia_mm=request.bar_dia_mm,
        gamma_c=request.gamma_c,
        gamma_s=request.gamma_s,
        P1_sls_kN=request.column_1.service_axial_kN,
        P2_sls_kN=request.column_2.service_axial_kN,
        unit_weight_concrete=request.unit_weight_concrete,
    )

    res = design_combined_footing(inp)
    report = _build_combined_report(request, res)

    bearing_pct = (res.sls_qmax / request.allowable_bearing_kN_m2) * 100.0
    shear_pct = (res.shear.VEd_kN / res.shear.VRdc_kN) * 100.0 if res.shear.VRdc_kN else 0.0
    pg = res.punching.governing
    punching_pct = max(pg.ratio, pg.ratio0) * 100.0
    overall_pct = max(bearing_pct, shear_pct, punching_pct)

    def _long_out(f, M_signed, x):
        return LongitudinalOut(
            Mmax_kNm=round(M_signed, 3), location_m=round(x, 3), d_eff_mm=round(res.d_long_mm, 1),
            As_req=round(f.As_req, 1), As_min=round(f.As_min, 1), As_provided=round(f.As_provided, 1),
            bar_dia=request.bar_dia_mm, spacing_mm=f.spacing_mm, status=f.status)

    return CombinedFootingResponse(
        task_id="completed", status=res.overall_status, case_type=res.case_type,
        columns=ColumnsOut(
            column_1=ColumnPositionOut(axial_load_kN=request.column_1.axial_load_kN,
                                       moment_x_kNm=request.column_1.moment_x_kNm,
                                       moment_y_kNm=request.column_1.moment_y_kNm,
                                       position_m=round(res.x1_m, 3)),
            column_2=ColumnPositionOut(axial_load_kN=request.column_2.axial_load_kN,
                                       moment_x_kNm=request.column_2.moment_x_kNm,
                                       moment_y_kNm=request.column_2.moment_y_kNm,
                                       position_m=round(res.x2_m, 3)),
            spacing_m=request.column_spacing_m,
            total_load_kN=round(res.total_load_kN, 3),
            resultant_position_m=round(res.x_resultant_m, 3),
        ),
        geometry=CombinedGeometryOut(
            footing_length_mm=request.footing_length_m * 1000,
            footing_width_mm=request.footing_width_m * 1000,
            footing_depth_mm=request.footing_depth_mm,
            column_x_mm=request.column_x_mm, column_y_mm=request.column_y_mm,
            d_long_mm=round(res.d_long_mm, 1), d_trans_mm=round(res.d_trans_mm, 1),
            cover_mm=request.cover_mm,
        ),
        soil_pressure=SoilPressureOut(
            q0=round(res.sls_q0, 3), qmax=round(res.sls_qmax, 3), qmin=round(res.sls_qmin, 3),
            bearing_ok=(res.bearing_status == "OK"), uplift_ok=(res.uplift_status == "OK"),
            corners=CornersOut(**{k: round(v, 3) for k, v in _corners_to_c1234(res.sls_corner_pressures).items()}),
        ),
        soil_pressure_uls=SoilPressureOut(
            q0=round(res.q0, 3), qmax=round(res.qmax, 3), qmin=round(res.qmin, 3),
            bearing_ok=(res.bearing_status == "OK"), uplift_ok=(res.qmin >= 0),
            corners=CornersOut(**{k: round(v, 3) for k, v in _corners_to_c1234(res.corner_pressures).items()}),
        ),
        sls_from_uls=res.sls_from_uls,
        moments=CombinedMomentsOut(
            Mx_total_kNm=round(res.Mx_total_kNm, 3), My_total_kNm=round(res.My_total_kNm, 3),
            ex_m=round(res.ex_m, 4), ey_m=round(res.ey_m, 4),
        ),
        longitudinal_bottom=_long_out(res.long_flex, res.M_sag_kNm, res.M_sag_x_m),
        longitudinal_top=_long_out(res.long_top_flex, -res.M_hog_kNm, res.M_hog_x_m),
        transverse=TransverseOut(
            M_kNm=round(res.M_trans_kNm, 3), projection_m=round(res.projection_y_m, 3),
            d_eff_mm=round(res.d_trans_mm, 1), As_req=round(res.trans_flex.As_req, 1),
            As_min=round(res.trans_flex.As_min, 1), As_provided=round(res.trans_flex.As_provided, 1),
            bar_dia=request.bar_dia_mm, spacing_mm=res.trans_flex.spacing_mm, status=res.trans_flex.status,
        ),
        shear=CombinedShearOut(
            VEd_kN=round(res.shear.VEd_kN, 3), VRdc_kN=round(res.shear.VRdc_kN, 3), status=res.shear.status,
            location_m=round(res.shear.x_m, 3), label=res.shear.label,
            sections=[CombinedShearSectionOut(label=x.label, x_m=round(x.x_m, 3), VEd_kN=round(x.VEd_kN, 3),
                                              tension_face=x.face, rho_l=round(x.rho_l, 5),
                                              VRdc_kN=round(x.VRdc_kN, 3),
                                              status="OK" if x.VEd_kN <= x.VRdc_kN else "NOT OK")
                      for x in res.shear.sections]),
        punching=CombinedPunchingOut(
            vEd_MPa=round(pg.vEd, 4), vRdc_MPa=round(pg.vRd, 4), status=res.punching.status,
            d_eff_mm=round(res.punching.d_eff_mm, 1), rho_l=round(res.punching.rho_l, 5),
            columns=[ColumnPunchingOut(column=c.column, applicable=c.applicable, a_mm=round(c.a_mm, 0),
                                       u_m=round(c.u_m, 3), beta=round(c.beta, 3), VEd_red_kN=round(c.VEd_red_kN, 2),
                                       vEd_MPa=round(c.vEd, 4), vRd_MPa=round(c.vRd, 4), v0_MPa=round(c.v0, 3),
                                       vRdmax_MPa=round(c.vRdmax, 3), status=c.status)
                     for c in res.punching.columns]),
        utilisation=CombinedUtilisationOut(
            overall_pct=round(overall_pct, 1), bearing_pct=round(bearing_pct, 1),
            shear_pct=round(shear_pct, 1), punching_pct=round(punching_pct, 1),
        ),
        materials=MaterialsOut(
            concrete_grade_fck=request.concrete_grade_fck, steel_grade_fyk=request.steel_grade_fyk,
            allowable_bearing_kN_m2=request.allowable_bearing_kN_m2,
        ),
        report=report,
    )


def _build_combined_report(request: CombinedFootingRequest, res) -> list:
    R = lambda ref, calc, out: {"ref": ref, "calc": calc, "out": out}
    d = request
    sec = []

    rows = [
        R("EN 1990", "Basis of structural design", "adopted"),
        R("EN 1992-1-1", "Design of concrete structures", "adopted"),
        R("EN 1992-1-1 §6.2", "Shear", "adopted"),
        R("EN 1992-1-1 Cl. 6.2.2", "Shear resistance without shear reinforcement", "adopted"),
        R("EN 1992-1-1 Cl. 6.4", "Punching shear", "adopted"),
        R("EN 1992-1-1 Cl. 9.8", "Foundations", "adopted"),
        R("EN 1997-1", "Geotechnical design", "adopted"),
        R("Scope", "Combined pad footing, two columns. Supports axial, uniaxial and biaxial "
                  "column loading.", res.case_type),
    ]
    rows += _design_basis_rows(request.design_basis)
    sec.append({"section": "1. Design Basis and References", "rows": rows})

    sec.append({"section": "2. Input Data", "rows": [
        R("Column 1", f"P1 = {d.column_1.axial_load_kN:.3f} kN, Mx = {d.column_1.moment_x_kNm:.3f}, "
                     f"My = {d.column_1.moment_y_kNm:.3f} kNm", "adopted"),
        R("Column 2", f"P2 = {d.column_2.axial_load_kN:.3f} kN, Mx = {d.column_2.moment_x_kNm:.3f}, "
                     f"My = {d.column_2.moment_y_kNm:.3f} kNm", "adopted"),
        R("Service (SLS) loads", (f"P1,sls = {d.column_1.service_axial_kN:.3f} kN, P2,sls = {d.column_2.service_axial_kN:.3f} kN"
                                  if not res.sls_from_uls else
                                  "not entered for both columns -- the ULS load is used for bearing (conservative)"),
          "bearing check"),
        R("Spacing", f"column spacing = {d.column_spacing_m:.3f} m, left projection = {d.left_projection_m:.3f} m",
          "adopted"),
        R("Footing", f"L = {d.footing_length_m:.3f} m, B = {d.footing_width_m:.3f} m, "
                    f"h = {d.footing_depth_mm:.0f} mm", "adopted"),
        R("Column size", f"{d.column_x_mm:.0f} x {d.column_y_mm:.0f} mm", "adopted"),
        R("Materials", f"fck = {d.concrete_grade_fck:.1f} N/mm2, fyk = {d.steel_grade_fyk:.1f} N/mm2", "adopted"),
        R("Soil", f"Allowable bearing = {d.allowable_bearing_kN_m2:.1f} kN/m2", "adopted"),
        R("Detailing", f"Cover = {d.cover_mm:.0f} mm, main bar = Y{d.bar_dia_mm:.0f}", "adopted"),
    ]})

    sec.append({"section": "3. Load Case Classification", "rows": [
        R("Total moments", f"Mx = {res.Mx_total_kNm:.3f}, My = {res.My_total_kNm:.3f} kNm", res.case_type),
    ]})

    sec.append({"section": "4. Resultant Load and Column Locations", "rows": [
        R("Total load", f"W = P1 + P2 = {d.column_1.axial_load_kN:.3f} + {d.column_2.axial_load_kN:.3f}",
          f"W = {res.total_load_kN:.3f} kN"),
        R("Column positions", f"x1 = {res.x1_m:.3f} m, x2 = {res.x2_m:.3f} m", "from left edge"),
        R("Footing centre", f"centre_x = L/2 = {res.centre_x_m:.3f} m", f"centre_y = {res.centre_y_m:.3f} m"),
        R("Resultant location", "xR = (P1 x1 + P2 x2) / W", f"xR = {res.x_resultant_m:.3f} m"),
        R("Axial eccentricity", "e_axial_x = xR - L/2", f"{res.axial_ecc_x_m:.3f} m"),
    ]})

    sec.append({"section": "5. Total Moments About Footing Centre", "rows": [
        R("My from eccentric axial loads", "P1(x1 - L/2) + P2(x2 - L/2)", f"{res.My_total_kNm - (d.column_1.moment_y_kNm + d.column_2.moment_y_kNm):.3f} kNm"),
        R("Applied moments", f"My_applied = {d.column_1.moment_y_kNm + d.column_2.moment_y_kNm:.3f}, "
                            f"Mx_applied = {d.column_1.moment_x_kNm + d.column_2.moment_x_kNm:.3f} kNm", "adopted"),
        R("Total footing moments", "My_total = My_axial + My_applied", f"My_total = {res.My_total_kNm:.3f} kNm"),
        R("", "Mx_total = Mx_applied", f"Mx_total = {res.Mx_total_kNm:.3f} kNm"),
        R("Equivalent eccentricities", "ex = My_total/W, ey = Mx_total/W",
          f"ex = {res.ex_m:.4f} m, ey = {res.ey_m:.4f} m"),
    ]})

    rows = [
        R("Footing area", f"A = L x B = {d.footing_length_m:.3f} x {d.footing_width_m:.3f}",
          f"A = {res.area_m2:.3f} m2"),
        R("EN 1997-1", "Bearing is checked on SLS loads against the allowable bearing pressure; "
                       "structural design (sections 8-14) uses the ULS net pressure.", "method"),
        R("Footing self-weight", f"W_f = L x B x h x gamma_c = {d.footing_length_m:.3f} x {d.footing_width_m:.3f} x "
                                 f"{d.footing_depth_mm/1000:.3f} x {d.unit_weight_concrete:.1f}", f"W_f = {res.footing_weight_kN:.2f} kN"),
        R("SLS column loads", ("P1,sls + P2,sls" if not res.sls_from_uls else "ULS loads used (no service loads entered)")
          + "; service moments = ULS moments x P_sls/P_uls of each column", "adopted"),
        R("SLS total load", "N = P1,sls + P2,sls + W_f", f"N = {res.sls_total_load_kN:.2f} kN"),
        R("SLS moments about centre", "My = P1,sls(x1 - L/2) + P2,sls(x2 - L/2) + My,sls; Mx = Mx,sls",
          f"My = {res.sls_My_kNm:.3f}, Mx = {res.sls_Mx_kNm:.3f} kNm"),
        R("Eccentricities", "ex = My/N, ey = Mx/N", f"ex = {res.sls_ex_m:.4f} m, ey = {res.sls_ey_m:.4f} m"),
        R("Average bearing pressure", "q0 = N / A", f"q0 = {res.sls_q0:.3f} kN/m2"),
        R("Middle third limits", f"L/6 = {d.footing_length_m/6:.4f} m, B/6 = {d.footing_width_m/6:.4f} m", "limits"),
        R("Check", "ex within middle third", "OK" if res.ex_within_middle_third else "NOT OK"),
        R("Check", "ey within middle third", "OK" if res.ey_within_middle_third else "NOT OK"),
        R("Biaxial corner pressures", "q = q0(1 ± 6ex/L ± 6ey/B)", "four corners computed"),
    ]
    for name, q in res.sls_corner_pressures.items():
        rows.append(R("Corner pressure (SLS)", name, f"{q:.3f} kN/m2"))
    rows += [
        R("Governing", "qmax, qmin across the four corners",
          f"qmax = {res.sls_qmax:.3f} kN/m2, qmin = {res.sls_qmin:.3f} kN/m2"),
        R("Bearing check", f"qmax vs allowable {d.allowable_bearing_kN_m2:.3f} kN/m2", res.bearing_status),
        R("Uplift check", "qmin >= 0, no tension", res.uplift_status),
        R("ULS net pressure (for design)", "q0 = (P1 + P2)/A, corners as above with ULS moments",
          f"q0 = {res.q0:.3f}, qmax = {res.qmax:.3f}, qmin = {res.qmin:.3f} kN/m2"),
    ]
    sec.append({"section": "6. Bearing Pressure and Corner Pressure Check", "rows": rows})

    sec.append({"section": "7. Footing Projections", "rows": [
        R("Left projection", "to column 1", f"{res.left_projection_m:.3f} m"),
        R("Spacing", "between columns", f"{res.spacing_m:.3f} m"),
        R("Right projection", "to column 2", f"{res.right_projection_m:.3f} m"),
    ]})

    sec.append({"section": "8. Longitudinal Shear Force and Bending Moment Analysis", "rows": [
        R("Method", "Beam on linear ULS soil reaction w(x) = B x q(x). Shear and moment integrated along x, with "
                   "the column loads P1/P2 as point loads and the column moments My1/My2 as point moments. "
                   "Sign: + sagging (tension bottom), - hogging (tension top). Swept at 2000 points plus each column.",
          "searched"),
        R("Equilibrium", "M(L) should be 0", f"M(L) = {res.M_end_kNm:.3f} kNm"),
        R("Maximum sagging", f"at x = {res.M_sag_x_m:.3f} m (bottom steel)", f"M_sag = {res.M_sag_kNm:.3f} kNm"),
        R("Maximum hogging", f"at x = {res.M_hog_x_m:.3f} m (top steel)", f"M_hog = {res.M_hog_kNm:.3f} kNm"),
    ]})

    sec.append({"section": "9. Effective Depth", "rows": [
        R("Longitudinal", "d_long = h - cover - bar/2", f"d_long = {res.d_long_mm:.1f} mm"),
        R("Transverse", "d_trans = h - cover - first layer bar - second layer bar/2",
          f"d_trans = {res.d_trans_mm:.1f} mm"),
    ]})

    sec.append({"section": "10a. Longitudinal Reinforcement — Bottom (sagging, under the columns)", "rows": [
        R("EC2 §6.1", f"K = M/(b d^2 fck) = ({res.long_flex.M_kNm:.3f}x10^6)/({d.footing_width_m*1000:.1f}x{res.d_long_mm:.1f}^2x{d.concrete_grade_fck:.0f})",
          f"K = {res.long_flex.K:.5f} (limit 0.167)"),
        R("Lever arm (EC2)", "z = d[0.5 + sqrt(0.25 - K/1.134)] <= 0.95d", f"z = {res.long_flex.z_mm:.1f} mm"),
        R("Required steel", "As = M/(0.87 fyk z) / B (per metre width)", f"As,req = {res.long_flex.As_req:.2f} mm2/m"),
        R("Minimum steel", "As,min = max(0.26 fctm/fyk, 0.0013) b d, fctm = 0.30 fck^(2/3) (EC2 Table 3.1)", f"As,min = {res.long_flex.As_min:.2f} mm2/m"),
        R("Design steel", "As,design = max(As,req, As,min)", f"As,design = {res.long_flex.As_design:.2f} mm2/m"),
        R("Bar spacing", f"Adopt Y{d.bar_dia_mm:.0f} @ {res.long_flex.spacing_mm:.0f} mm c/c",
          f"As,provided = {res.long_flex.As_provided:.2f} mm2/m"),
        R("Check", "As,provided >= As,design and K <= 0.167", res.long_flex.status),
    ]})

    top_rows = [
        R("EC2 §6.1", f"K = M/(b d^2 fck) = ({res.long_top_flex.M_kNm:.3f}x10^6)/({d.footing_width_m*1000:.1f}x{res.d_long_mm:.1f}^2x{d.concrete_grade_fck:.0f})",
          f"K = {res.long_top_flex.K:.5f} (limit 0.167)"),
        R("Lever arm (EC2)", "z = d[0.5 + sqrt(0.25 - K/1.134)] <= 0.95d", f"z = {res.long_top_flex.z_mm:.1f} mm"),
        R("Required steel", "As = M/(0.87 fyk z) / B (per metre width)", f"As,req = {res.long_top_flex.As_req:.2f} mm2/m"),
        R("Minimum steel", "As,min = max(0.26 fctm/fyk, 0.0013) b d, fctm = 0.30 fck^(2/3) (EC2 Table 3.1)", f"As,min = {res.long_top_flex.As_min:.2f} mm2/m"),
        R("Design steel", "As,design = max(As,req, As,min)", f"As,design = {res.long_top_flex.As_design:.2f} mm2/m"),
        R("Bar spacing", f"Adopt Y{d.bar_dia_mm:.0f} @ {res.long_top_flex.spacing_mm:.0f} mm c/c",
          f"As,provided = {res.long_top_flex.As_provided:.2f} mm2/m"),
        R("Check", "As,provided >= As,design and K <= 0.167", res.long_top_flex.status),
    ]
    if res.M_hog_kNm <= 0:
        top_rows.insert(0, R("Note", "no hogging anywhere along the footing -- As,min shown as nominal top steel", ""))
    sec.append({"section": "10b. Longitudinal Reinforcement — Top (hogging, between the columns)", "rows": top_rows})

    sec.append({"section": "11. Transverse Moment at Column Face", "rows": [
        R("Transverse cantilever projection", "a_y = (B - column_y)/2", f"a_y = {res.projection_y_m:.3f} m"),
        R("Moment per metre width", "M_trans = qmax x a_y^2/2", f"M_trans = {res.M_trans_kNm:.3f} kNm/m"),
    ]})

    sec.append({"section": "12. Flexural Reinforcement Design — Transverse Direction", "rows": [
        R("EC2 §6.1", f"K = M/(b d^2 fck) = ({res.trans_flex.M_kNm:.3f}x10^6)/(1000x{res.d_trans_mm:.1f}^2x{d.concrete_grade_fck:.0f})",
          f"K = {res.trans_flex.K:.5f}"),
        R("Lever arm (EC2)", "z = d[0.5 + sqrt(0.25 - K/1.134)]", f"z = {res.trans_flex.z_mm:.1f} mm"),
        R("Required steel", "As = M/(0.87 fyk z)", f"As,req = {res.trans_flex.As_req:.2f} mm2/m"),
        R("Minimum steel", "As,min = max(0.26 fctm/fyk b d, 0.0013 b d)", f"As,min = {res.trans_flex.As_min:.2f} mm2/m"),
        R("Design steel", "As,design = max(As,req, As,min)", f"As,design = {res.trans_flex.As_design:.2f} mm2/m"),
        R("Bar spacing", f"Adopt Y{d.bar_dia_mm:.0f} @ {res.trans_flex.spacing_mm:.0f} mm c/c",
          f"As,provided = {res.trans_flex.As_provided:.2f} mm2/m"),
        R("Check", "As,provided >= As,design", res.trans_flex.status),
    ]})

    rows = [
        R("EC2 Cl. 6.2.1(8)", "critical sections at d from each face of each column, both sides, inside the footing; "
                              "V_Ed from the shear diagram of section 8", "adopted"),
        R("EC2 Cl. 6.2.2", "VRd,c = max(C_Rd,c k (100 rho_l fck)^(1/3), vmin) x B x d, rho_l from the steel "
                           "in the tension face at the section", "adopted"),
    ]
    for x in res.shear.sections:
        rows.append(R(f"{x.label}, x = {x.x_m:.3f} m",
                      f"VEd = {x.VEd_kN:.2f} kN; tension {x.face}, rho_l = {x.rho_l:.5f}, VRd,c = {x.VRdc_kN:.2f} kN",
                      "OK" if x.VEd_kN <= x.VRdc_kN else "NOT OK"))
    if not res.shear.sections:
        rows.append(R("Sections", res.shear.label, "OK"))
    rows.append(R("Check", f"governing: {res.shear.label}", res.shear.status))
    sec.append({"section": "13. One-Way Shear Check", "rows": rows})

    p = res.punching
    rows = [
        R("EC2 Cl. 6.4.4(2)", "each column; control perimeters at a <= 2d from the face, u = 2(cx + cy) + 2 pi a; "
                              "relief = soil pressure under the column x area inside u; v_Rd = v_Rd,c x 2d/a; "
                              "beta from Eq. 6.51 (k from Table 6.1, moments in both directions added)", "adopted"),
        R("EC2 Cl. 6.4.2", "d_eff = (d_long + d_trans)/2; rho_l = sqrt(rho_long x rho_trans), bottom steel",
          f"d = {p.d_eff_mm:.1f} mm, rho_l = {p.rho_l:.5f}"),
        R("EC2 Cl. 6.4.4", "v_Rd,c (at a = 2d)", f"{p.vRdc:.4f} N/mm2"),
    ]
    for c in p.columns:
        if c.applicable:
            rows.append(R(f"Column {c.column}, governing perimeter",
                          f"a = {c.a_mm:.0f} mm, u = {c.u_m:.3f} m, q = {c.q_under_kN_m2:.2f} kN/m2, "
                          f"V_Ed,red = {c.P_kN:.2f} - {c.q_under_kN_m2:.2f} x {c.area_inside_m2:.3f} = {c.VEd_red_kN:.2f} kN, beta = {c.beta:.3f}",
                          f"vEd = {c.vEd:.4f} vs vRd = {c.vRd:.4f} N/mm2"))
        else:
            rows.append(R(f"Column {c.column}", "no control perimeter a <= 2d fits on the footing: punching is not a "
                          "valid mechanism; one-way shear across the full width (section 13) governs", "not applicable"))
        rows.append(R(f"Column {c.column}, column face (6.4.5(3))",
                      "vEd,0 = beta P/(u0 d), u0 = 2(cx + cy); vRd,max = 0.5 nu fck/gamma_c, nu = 0.6(1 - fck/250) (UK NA)",
                      f"{c.v0:.3f} vs {c.vRdmax:.3f} N/mm2 -- {c.status}"))
    rows.append(R("Check", "both columns", p.status))
    sec.append({"section": "14. Punching Shear Check", "rows": rows})

    sec.append({"section": "15. Final Design Summary", "rows": [
        R("Load case", res.case_type, ""),
        R("Resultant", f"xR = {res.x_resultant_m:.3f} m from left edge", ""),
        R("Bearing pressure (SLS)", f"q0 = {res.sls_q0:.3f}, qmax = {res.sls_qmax:.3f}, qmin = {res.sls_qmin:.3f} kN/m2", res.bearing_status),
        R("Longitudinal bottom", f"Y{d.bar_dia_mm:.0f} @ {res.long_flex.spacing_mm:.0f} mm c/c", res.long_flex.status),
        R("Longitudinal top", f"Y{d.bar_dia_mm:.0f} @ {res.long_top_flex.spacing_mm:.0f} mm c/c", res.long_top_flex.status),
        R("Transverse reinforcement", f"Y{d.bar_dia_mm:.0f} @ {res.trans_flex.spacing_mm:.0f} mm c/c", res.trans_flex.status),
        R("One-way shear", f"VEd = {res.shear.VEd_kN:.3f}, VRd,c = {res.shear.VRdc_kN:.3f} kN", res.shear.status),
        R("Punching shear", f"governing column {res.punching.governing.column}: vEd = {res.punching.governing.vEd:.4f}, "
                            f"vRd = {res.punching.governing.vRd:.4f}; face {res.punching.governing.v0:.3f}/{res.punching.governing.vRdmax:.3f} N/mm2",
          res.punching.status),
        R("Overall", "all checks", res.overall_status),
    ]})

    return sec