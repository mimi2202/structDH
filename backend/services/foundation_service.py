# backend/services/foundation_service.py
import math

from models.foundation_schemas import (
    PadFoundationRequest, PadFoundationResponse,
    GeometryOut, SoilPressureOut, CornersOut, DesignMomentsOut,
    FlexureOut, FlexureDirectionOut, OneWayShearOut, ShearDirectionOut,
    PunchingOut, UtilisationOut, MaterialsOut,
)
from engine.pad_foundation_engine import PadFoundationInput, design_pad_foundation, size_pad_foundation
from engine import foundation_detailing as fd


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
        service_axial_kN=request.service_axial_kN,
        service_moment_x_kNm=request.service_moment_x_kNm,
        service_moment_y_kNm=request.service_moment_y_kNm,
        column_shape=request.column_shape,
        column_offset_x_mm=request.column_offset_x_mm,
        column_offset_y_mm=request.column_offset_y_mm,
        column_pinned=request.column_fixity == "pinned",
        sls_factor=request.sls_factor,
        soil_unit_weight=request.soil_unit_weight_kN_m3,
        soil_depth_above_mm=request.soil_depth_above_mm,
    )

    steps = None
    if request.auto_size:
        def detailing_ok(trial, r):
            req = request.model_copy(update={"footing_length_mm": trial.footing_length_mm,
                                             "footing_width_mm": trial.footing_width_mm,
                                             "footing_depth_mm": trial.footing_depth_mm})
            return _pad_detailing(req, r)["status"] == "OK"
        inp, res, steps = size_pad_foundation(inp, extra_ok=detailing_ok)
        # everything below reads the sized footing
        request = request.model_copy(update={
            "footing_length_mm": inp.footing_length_mm, "footing_width_mm": inp.footing_width_mm,
            "footing_depth_mm": inp.footing_depth_mm})
    else:
        res = design_pad_foundation(inp)
    detailing = _pad_detailing(request, res)
    if detailing["status"] != "OK":
        res.overall_status = "FAIL"
    report = _build_report(request, res, steps)
    _summary_detailing_row(report, detailing)
    report.append(_detailing_section("13", request, detailing))

    # Utilisation percentages. "shear" is the governing (worse) of the two
    # one-way shear directions, matching the single "One-way shear (max)"
    # figure the results page shows. "overall" is the worst of the three
    # figures the page actually displays (bearing, shear, punching) --
    # flexural status is shown separately as a pass/fail chip, not folded
    # into a percentage, so it is not part of this max.
    bearing_pct = (res.sls_qmax / request.allowable_bearing_kN_m2) * 100.0
    shear_pct = max(
        (res.shear_x.VEd_kN_m / res.shear_x.VRdc_kN_m) * 100.0 if res.shear_x.VRdc_kN_m else 0.0,
        (res.shear_y.VEd_kN_m / res.shear_y.VRdc_kN_m) * 100.0 if res.shear_y.VRdc_kN_m else 0.0,
    )
    punching_pct = max(res.punching.ratio, res.punching.ratio0) * 100.0
    overall_pct = max(bearing_pct, shear_pct, punching_pct)

    corners_by_key = _corners_to_c1234(res.corner_pressures)
    sls_corners_by_key = _corners_to_c1234(res.sls_corner_pressures)

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
            column_shape=request.column_shape,
            column_offset_x_mm=request.column_offset_x_mm,
            column_offset_y_mm=request.column_offset_y_mm,
            column_fixity=request.column_fixity,
        ),
        soil_pressure=SoilPressureOut(
            q0=round(res.sls_q0, 3), qmax=round(res.sls_qmax, 3), qmin=round(res.sls_qmin, 3),
            bearing_ok=(res.bearing_status == "OK"), uplift_ok=(res.uplift_status == "OK"),
            corners=CornersOut(**{k: round(v, 3) for k, v in sls_corners_by_key.items()}),
        ),
        soil_pressure_uls=SoilPressureOut(
            q0=round(res.q0, 3), qmax=round(res.qmax, 3), qmin=round(res.qmin, 3),
            bearing_ok=(res.bearing_status == "OK"), uplift_ok=(res.qmin >= 0),
            corners=CornersOut(**{k: round(v, 3) for k, v in corners_by_key.items()}),
        ),
        sls_from_uls=res.sls_from_uls,
        footing_weight_kN=round(res.footing_weight_kN, 2),
        sls_total_load_kN=round(res.sls_total_load_kN, 2),
        soil_weight_kN=round(res.soil_weight_kN, 2),
        auto_sized=request.auto_size,
        detailing=detailing,
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
                                VRdc_kN_per_m=round(res.shear_x.VRdc_kN_m, 3), status=res.shear_x.status,
                                rho_l=round(res.shear_x.rho_l, 5)),
            y=ShearDirectionOut(VEd_kN_per_m=round(res.shear_y.VEd_kN_m, 3),
                                VRdc_kN_per_m=round(res.shear_y.VRdc_kN_m, 3), status=res.shear_y.status,
                                rho_l=round(res.shear_y.rho_l, 5)),
        ),
        punching=PunchingOut(vEd_MPa=round(res.punching.vEd, 4), vRdc_MPa=round(res.punching.vRdc, 4),
                             status=res.punching.status, applicable=res.punching.applicable,
                             a_mm=round(res.punching.a_mm, 1), u_m=round(res.punching.u1_m, 3),
                             beta=round(res.punching.beta, 3), VEd_red_kN=round(res.punching.VEd_punch_kN, 2),
                             vRd_MPa=round(res.punching.vRd, 4), v0_MPa=round(res.punching.v0, 4),
                             vRdmax_MPa=round(res.punching.vRdmax, 4)),
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


def _build_report(request: PadFoundationRequest, res, steps=None) -> list:
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
        R("Service (SLS) loads", (f"N = {res.sls_total_load_kN - res.footing_weight_kN - res.soil_weight_kN:.3f} kN, Mx = {res.sls_Mx_kNm:.3f}, "
                                  f"My = {res.sls_My_kNm:.3f} kNm" if not res.sls_from_uls else
                                  f"not entered -- SLS = ULS / {d.sls_factor:.2f} (Structville 8.5.1)" if d.sls_factor else
                                  "not entered -- the ULS loads are used for bearing (conservative)"),
          "bearing check"),
        R("Load case", "classified from Mx, My", res.load_case),
        R("Footing", f"L = {d.footing_length_mm:.0f} mm, B = {d.footing_width_mm:.0f} mm, "
                    f"h = {d.footing_depth_mm:.0f} mm", "adopted"),
        R("Column", (f"circular, D = {d.column_x_mm:.0f} mm" if d.column_shape == "circular"
                     else f"rectangular, cx = {d.column_x_mm:.0f} mm, cy = {d.column_y_mm:.0f} mm")
          + f", {d.column_fixity} base", "adopted"),
        R("Column position", f"offset from footing centre: ox = {d.column_offset_x_mm:.0f} mm, "
                             f"oy = {d.column_offset_y_mm:.0f} mm", "adopted"),
        R("Materials", f"fck = {d.concrete_grade_fck:.1f} N/mm2, fyk = {d.steel_grade_fyk:.1f} N/mm2",
          "adopted"),
        R("Soil", f"Allowable bearing = {d.allowable_bearing_kN_m2:.1f} kN/m2, soil on footing "
                  f"h_s = {d.soil_depth_above_mm:.0f} mm at {d.soil_unit_weight_kN_m3:.1f} kN/m3", "adopted"),
        R("Detailing", f"Cover = {d.cover_mm:.0f} mm, main bar = Y{d.bar_dia_mm:.0f}", "adopted"),
    ]})

    # ---------------- 2b. Footing Sizing (auto) ----------------
    if steps:
        rows = [R("EN 1997-1 6.4(5)", "Prescriptive method: presumed (allowable) bearing pressure "
                                       "(Structville 8.3(c), 8.5.1)", "method")]
        for s in steps:
            rows += [
                R(f"Trial h = {s['h_mm']:.0f} mm", f"q_net = q_allow - gamma_c h - gamma_s h_s = "
                  f"{d.allowable_bearing_kN_m2:.1f} - {s['w_kN_m2']:.2f}", f"q_net = {s['q_net']:.2f} kN/m2"),
                R("Area required", f"A = N_sls / q_net = {s['N_sls']:.2f} / {s['q_net']:.2f}",
                  f"A = {s['A_req_m2']:.3f} m2 -> {s['first_L_mm']:.0f} x {s['first_B_mm']:.0f} mm"),
            ]
            if (s["L_mm"], s["B_mm"]) != (s["first_L_mm"], s["first_B_mm"]):
                rows.append(R("Eccentric SLS pressure", "widened in 100 mm steps until qmax <= q_allow and qmin >= 0",
                              f"{s['L_mm']:.0f} x {s['B_mm']:.0f} mm"))
            rows.append(R("Section checks", "flexure, one-way shear, punching, edge anchorage",
                          "all OK" if s["structural_ok"] else "fail -> h + 50 mm"))
        rows.append(R("Adopted", f"L x B x h = {d.footing_length_mm:.0f} x {d.footing_width_mm:.0f} x "
                                 f"{d.footing_depth_mm:.0f} mm", res.overall_status))
        sec.append({"section": "2b. Footing Sizing", "rows": rows})

    # ---------------- 3. Geometry ----------------
    geo = [R("Footing area", f"A = L x B = {res.L_m:.3f} x {res.B_m:.3f}", f"A = {res.area_m2:.3f} m2")]
    if d.column_shape == "circular":
        geo.append(R("Circular column", f"bending/shear face: equal-area square, side = 0.886 D = 0.886 x {d.column_x_mm:.0f}",
                     f"{res.column_face_x_mm:.1f} mm"))
    geo += [
        R("Projection from column face", f"a_x = (L - cx)/2 + |ox| = ({d.footing_length_mm:.0f} - {res.column_face_x_mm:.1f})/2 + {abs(d.column_offset_x_mm):.0f}",
          f"a_x = {res.projection_x_mm:.1f} mm"),
        R("Projection from column face", f"a_y = (B - cy)/2 + |oy| = ({d.footing_width_mm:.0f} - {res.column_face_y_mm:.1f})/2 + {abs(d.column_offset_y_mm):.0f}",
          f"a_y = {res.projection_y_mm:.1f} mm"),
    ]
    if d.column_offset_x_mm or d.column_offset_y_mm:
        geo.append(R("Offset column", "larger overhang designed; shorter overhang limits the punching perimeter",
                     f"short side a_x = {res.projection_x_min_mm:.0f}, a_y = {res.projection_y_min_mm:.0f} mm"))
    sec.append({"section": "3. Geometry", "rows": geo + [
        R("Effective depth", "d_x = h - cover - bar diameter/2", f"d_x = {res.d_eff_x_mm:.1f} mm"),
        R("Effective depth", "d_y = h - cover - first layer bar - second layer bar/2",
          f"d_y = {res.d_eff_y_mm:.1f} mm"),
    ]})

    # ---------------- 4. Eccentricity Check ----------------
    sec.append({"section": "4. Eccentricity Check", "rows": [
        R("Moments about footing centre", ("pinned base: column moments not transferred; " if d.column_fixity == "pinned" else "")
          + f"Mx = Mx,col + NEd oy, My = My,col + NEd ox",
          f"Mx = {res.Mx_total_kNm:.3f}, My = {res.My_total_kNm:.3f} kNm"),
        R("EN 1992-1-1 Cl. 9.8", f"ex = My / NEd = {res.My_total_kNm:.3f} / {d.axial_load_kN:.3f}",
          f"ex = {res.ex_m:.4f} m"),
        R("EN 1992-1-1 Cl. 9.8", f"ey = Mx / NEd = {res.Mx_total_kNm:.3f} / {d.axial_load_kN:.3f}",
          f"ey = {res.ey_m:.4f} m"),
        R("Middle third limits", f"L/6 = {res.L_m/6:.4f} m, B/6 = {res.B_m/6:.4f} m", "limits"),
        R("Check", "ex within middle third", "OK" if res.ex_within_middle_third else "NOT OK"),
        R("Check", "ey within middle third", "OK" if res.ey_within_middle_third else "NOT OK"),
    ]})

    # ---------------- 5. Soil Pressure Distribution ----------------
    rows = [
        R("EN 1997-1", "Bearing is checked on SLS loads against the allowable bearing pressure; "
                       "structural design (sections 6-11) uses the ULS net pressure.", "method"),
        R("Footing self-weight", f"W_f = L x B x h x gamma_c = {res.L_m:.3f} x {res.B_m:.3f} x "
                                 f"{d.footing_depth_mm/1000:.3f} x 25.0", f"W_f = {res.footing_weight_kN:.2f} kN"),
        R("Soil on footing", f"W_s = (A - column area) x h_s x gamma_s = ({res.area_m2:.3f} - column) x {d.soil_depth_above_mm/1000:.3f} x "
                             f"{d.soil_unit_weight_kN_m3:.1f}", f"W_s = {res.soil_weight_kN:.2f} kN"),
        R("SLS total load", ("N = N,sls + W_f + W_s" if not res.sls_from_uls else
                             f"N = NEd/{d.sls_factor:.2f} + W_f + W_s (no service loads entered)" if d.sls_factor else
                             "N = NEd + W_f + W_s (no service loads entered)"),
          f"N = {res.sls_total_load_kN:.2f} kN"),
        R("Eccentricities (SLS)", f"ex = My/N = {res.sls_My_kNm:.3f}/{res.sls_total_load_kN:.2f}, "
                                  f"ey = Mx/N = {res.sls_Mx_kNm:.3f}/{res.sls_total_load_kN:.2f}",
          f"ex = {res.sls_ex_m:.4f} m, ey = {res.sls_ey_m:.4f} m"),
        R("Average bearing pressure", f"q0 = N / A = {res.sls_total_load_kN:.2f} / {res.area_m2:.3f}",
          f"q0 = {res.sls_q0:.3f} kN/m2"),
        R("Biaxial corner pressures", "q = q0(1 ± 6ex/L ± 6ey/B)", "four corners computed"),
    ]
    for name, q in res.sls_corner_pressures.items():
        rows.append(R("Corner pressure (SLS)", name, f"{q:.3f} kN/m2"))
    rows += [
        R("Governing", "qmax, qmin across the four corners",
          f"qmax = {res.sls_qmax:.3f} kN/m2, qmin = {res.sls_qmin:.3f} kN/m2"),
        R("Bearing check", f"qmax vs allowable {d.allowable_bearing_kN_m2:.3f} kN/m2", res.bearing_status),
        R("Uplift check", "qmin >= 0, no tension", res.uplift_status),
        R("ULS net pressure (for design)", f"q0 = NEd / A = {d.axial_load_kN:.3f} / {res.area_m2:.3f}, "
                                           "corners with ULS moments",
          f"q0 = {res.q0:.3f}, qmax = {res.qmax:.3f}, qmin = {res.qmin:.3f} kN/m2"),
    ]
    sec.append({"section": "5. Soil Pressure Distribution", "rows": rows})

    # ---------------- 6. Design Moments at Column Face ----------------
    sec.append({"section": "6. Design Moments at Column Face", "rows": [
        R("Design pressure", "ULS net pressure, linear along each direction (mean across the width); "
                             "q_f at the column face from similar triangles (Structville 8.5.1)", "trapezoidal"),
        *[R(f"Moment, {lab} direction",
            f"M = q_f a^2/2 + (q_edge - q_f) a^2/3, a = {f['a']:.3f} m, q_edge = {f['q_edge']:.3f}, "
            f"q_f = {f['q_face']:.3f} kN/m2", f"M{lab.lower()} = {M:.3f} kNm/m")
          for lab, f, M in (("X", res.face_x, res.Mx_kNm_per_m), ("Y", res.face_y, res.My_kNm_per_m))],
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
            R("Minimum steel", "As,min = max(0.26 fctm/fyk b d, 0.0013 b d), fctm = 0.30 fck^(2/3) (Table 3.1)",
              f"As,min = {flex.As_min:.2f} mm2/m"),
            R("Design steel", "As,design = max(As,req, As,min)", f"As,design = {flex.As_design:.2f} mm2/m"),
            R("Bar spacing", f"Adopt Y{d.bar_dia_mm:.0f} @ {flex.spacing_mm:.0f} mm c/c",
              f"As,provided = {flex.As_provided:.2f} mm2/m"),
            R("Check", "As,provided >= As,design", flex.status),
        ]})

    # ---------------- 9 & 10. One-way shear, X and Y ----------------
    for i, (label, shear, f, d_eff) in enumerate(
        [("X", res.shear_x, res.face_x, res.d_eff_x_mm),
         ("Y", res.shear_y, res.face_y, res.d_eff_y_mm)], start=9
    ):
        av = max(f["a_V"] - d_eff / 1000, 0)
        sec.append({"section": f"{i}. One-Way Shear Check — {label} Direction", "rows": [
            R("EC2 Cl. 6.2.1(8)", "critical section at distance d from column face", f"projection = {f['a_V']:.3f} m, d = {d_eff/1000:.3f} m"),
            R("EC2 Cl. 6.2.2", f"VEd = (q_edge + q_d)/2 x (a - d) = ({f['q_edge_V']:.3f} + {f['q_d']:.3f})/2 x {av:.3f}"
                               + (" (section beyond the footing edge)" if av <= 0 else ""),
              f"VEd = {shear.VEd_kN_m:.3f} kN/m"),
            R("EC2 Cl. 6.2.2", f"rho_l = As,prov/(b d) <= 0.02, bottom steel spanning {label}", f"rho_l = {shear.rho_l:.5f}"),
            R("EC2 Cl. 6.2.2", "VRd,c = max(C_Rd,c k (100 rho_l fck)^(1/3), vmin) x bw x d", f"VRd,c = {shear.VRdc_kN_m:.3f} kN/m"),
            R("Check", "VEd <= VRd,c", shear.status),
        ]})

    # ---------------- 11. Punching shear ----------------
    pn = res.punching
    rows = [
        R("EC2 Cl. 6.4.2(1)", "d = (d_x + d_y)/2, rho_l = sqrt(rho_x rho_y)",
          f"d = {pn.d_eff_mm:.1f} mm, rho_l = {pn.rho_l:.5f}"),
        R("EC2 Cl. 6.4.4(1)", "vRd,c = max(C_Rd,c k (100 rho_l fck)^(1/3), vmin)", f"vRd,c = {pn.vRdc:.4f} N/mm2"),
        R("EC2 Cl. 6.4.4(2)", "Relief from the ULS net soil pressure inside the perimeter"
          + (", taken under the column centre" if d.column_offset_x_mm or d.column_offset_y_mm else " (q = NEd / A)"),
          f"q = {pn.q_relief:.3f} kN/m2"),
    ]
    if pn.applicable:
        rows += [
            R("EC2 Cl. 6.4.4(2)", f"Control perimeters searched at a <= 2d = {2 * pn.d_eff_mm:.0f} mm "
                                  f"and a <= smaller projection {min(res.projection_x_mm, res.projection_y_mm):.0f} mm",
              f"governing a = {pn.a_mm:.0f} mm"),
            R("Control perimeter", "u = pi (D + 2a)" if d.column_shape == "circular" else "u = 2(cx + cy) + 2 pi a",
              f"u = {pn.u1_m:.3f} m"),
            R("Relief", f"q x area inside = {pn.q_relief:.3f} x {pn.area_inside_m2:.3f}",
              f"{pn.upward_reaction_kN:.3f} kN"),
            R("EC2 Eq. 6.48", "VEd,red = NEd - relief", f"VEd,red = {pn.VEd_punch_kN:.3f} kN"),
            R("EC2 Eq. 6.51" if d.column_shape != "circular" else "EC2 Eq. 6.53",
              "beta = 1 + 0.6 pi (|ex| + |ey|)/(D + 2a)" if d.column_shape == "circular"
              else "beta = 1 + k (MEd/VEd,red)(u/W), both directions", f"beta = {pn.beta:.3f}"),
            R("EC2 Eq. 6.51", "vEd = beta VEd,red/(u d)", f"vEd = {pn.vEd:.4f} N/mm2"),
            R("EC2 Eq. 6.50", "vRd = vRd,c x 2d/a", f"vRd = {pn.vRd:.4f} N/mm2"),
            R("Check", "vEd <= vRd", f"{pn.ratio:.3f} " + ("OK" if pn.ratio <= 1 else "NOT OK")),
        ]
    else:
        rows.append(R("EC2 Cl. 6.4.4(2)", "No control perimeter (a <= 2d) fits on the footing: punching "
                                          "is not a valid mechanism; one-way shear (sections 9-10) governs"
                      + ("; edge/corner column: truncated perimeters (EC2 Fig. 6.15) not checked"
                         if d.column_offset_x_mm or d.column_offset_y_mm else ""),
                      "not applicable"))
    rows += [
        R("EC2 Cl. 6.4.5(3)", "Column face: v0 = beta NEd/(u0 d), u0 = "
          + (f"pi D = {math.pi * d.column_x_mm / 1000:.3f} m" if d.column_shape == "circular"
             else f"2(cx + cy) = {2 * (d.column_x_mm + d.column_y_mm) / 1000:.3f} m"),
          f"v0 = {pn.v0:.4f} N/mm2"),
        R("EC2 Cl. 6.4.5(3)", "vRd,max = 0.5 nu fcd, nu = 0.6(1 - fck/250) (UK NA)", f"vRd,max = {pn.vRdmax:.4f} N/mm2"),
        R("Check", "v0 <= vRd,max", f"{pn.ratio0:.3f} " + ("OK" if pn.ratio0 <= 1 else "NOT OK")),
        R("Punching", "all checks", pn.status),
    ]
    sec.append({"section": "11. Punching Shear Check", "rows": rows})

    # ---------------- 12. Final Design Summary ----------------
    sec.append({"section": "12. Final Design Summary", "rows": [
        R("Bearing pressure (SLS)", f"q0 = {res.sls_q0:.3f}, qmax = {res.sls_qmax:.3f}, qmin = {res.sls_qmin:.3f} kN/m2", res.bearing_status),
        R("Design moments", f"Mx = {res.Mx_kNm_per_m:.3f}, My = {res.My_kNm_per_m:.3f} kNm/m", ""),
        R("Reinforcement, X", f"Y{d.bar_dia_mm:.0f} @ {res.flex_x.spacing_mm:.0f} mm c/c", res.flex_x.status),
        R("Reinforcement, Y", f"Y{d.bar_dia_mm:.0f} @ {res.flex_y.spacing_mm:.0f} mm c/c", res.flex_y.status),
        R("One-way shear, X", f"VEd = {res.shear_x.VEd_kN_m:.3f}, VRd,c = {res.shear_x.VRdc_kN_m:.3f} kN/m", res.shear_x.status),
        R("One-way shear, Y", f"VEd = {res.shear_y.VEd_kN_m:.3f}, VRd,c = {res.shear_y.VRdc_kN_m:.3f} kN/m", res.shear_y.status),
        R("Punching shear", (f"vEd = {res.punching.vEd:.4f}, vRd = {res.punching.vRd:.4f} N/mm2 at a = {res.punching.a_mm:.0f} mm"
                             if res.punching.applicable else "no control perimeter fits: one-way shear governs")
          + f"; face v0 = {res.punching.v0:.4f}, vRd,max = {res.punching.vRdmax:.4f} N/mm2", res.punching.status),
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
from engine.combined_footing_engine import size_combined_footing, CombinedPadInput, design_combined_footing


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
        sls_factor=request.sls_factor,
        soil_unit_weight=request.soil_unit_weight_kN_m3,
        soil_depth_above_mm=request.soil_depth_above_mm,
    )

    steps = None
    if request.auto_size:
        def detailing_ok(trial, r):
            req = request.model_copy(update={"footing_length_m": trial.footing_length_m,
                                             "footing_width_m": trial.footing_width_m,
                                             "footing_depth_mm": trial.footing_depth_mm,
                                             "left_projection_m": trial.left_projection_m})
            return _combined_detailing(req, r)["status"] == "OK"
        inp, res, steps = size_combined_footing(inp, extra_ok=detailing_ok)
        # everything below reads the sized footing
        request = request.model_copy(update={
            "footing_length_m": inp.footing_length_m, "footing_width_m": inp.footing_width_m,
            "footing_depth_mm": inp.footing_depth_mm, "left_projection_m": inp.left_projection_m})
    else:
        res = design_combined_footing(inp)
    detailing = _combined_detailing(request, res)
    if detailing["status"] != "OK":
        res.overall_status = "FAIL"
    report = _build_combined_report(request, res, steps)
    _summary_detailing_row(report, detailing)
    report.append(_detailing_section("16", request, detailing))

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
            footing_length_mm=round(request.footing_length_m * 1000, 1),
            footing_width_mm=round(request.footing_width_m * 1000, 1),
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
        footing_weight_kN=round(res.footing_weight_kN, 2),
        soil_weight_kN=round(res.soil_weight_kN, 2),
        sls_total_load_kN=round(res.sls_total_load_kN, 2),
        auto_sized=request.auto_size,
        detailing=detailing,
        left_projection_m=round(res.left_projection_m, 3),
        right_projection_m=round(res.right_projection_m, 3),
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


def _build_combined_report(request: CombinedFootingRequest, res, steps=None) -> list:
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
                                  f"not entered for both columns -- ULS / {d.sls_factor:.2f} used where blank (Structville 8.5.4)"
                                  if d.sls_factor else
                                  "not entered for both columns -- the ULS load is used for bearing (conservative)"),
          "bearing check"),
        R("Spacing", f"column spacing = {d.column_spacing_m:.3f} m, left projection = {d.left_projection_m:.3f} m",
          "adopted"),
        R("Footing", f"L = {d.footing_length_m:.3f} m, B = {d.footing_width_m:.3f} m, "
                    f"h = {d.footing_depth_mm:.0f} mm", "adopted"),
        R("Column size", f"{d.column_x_mm:.0f} x {d.column_y_mm:.0f} mm", "adopted"),
        R("Materials", f"fck = {d.concrete_grade_fck:.1f} N/mm2, fyk = {d.steel_grade_fyk:.1f} N/mm2", "adopted"),
        R("Soil", f"Allowable bearing = {d.allowable_bearing_kN_m2:.1f} kN/m2, soil on footing "
                  f"h_s = {d.soil_depth_above_mm:.0f} mm at {d.soil_unit_weight_kN_m3:.1f} kN/m3", "adopted"),
        R("Detailing", f"Cover = {d.cover_mm:.0f} mm, main bar = Y{d.bar_dia_mm:.0f}", "adopted"),
    ]})

    if steps:
        s0 = steps[0]
        rows = [
            R("EN 1997-1 6.4(5)", "Prescriptive method: presumed (allowable) bearing pressure "
                                   "(Structville 8.3(c), 8.5.4)", "method"),
            R("Resultant of SLS column loads", f"x = (P2,sls s + sum My,sls) / (P1,sls + P2,sls) from column 1",
              f"x = {s0['x_bar_m']:.3f} m"),
            R("Footing centroid on the resultant", "p1 + x = L/2 = p2 + (s - x); shorter overhang = entered "
                                                    "left projection, longer rounded up to 10 mm",
              f"p1 = {s0['p1_m']:.3f}, p2 = {s0['p2_m']:.3f}, L = {s0['L_m']:.3f} m"),
        ]
        for s in steps:
            rows += [
                R(f"Trial h = {s['h_mm']:.0f} mm", f"q_net = q_allow - gamma_c h - gamma_s h_s = "
                  f"{d.allowable_bearing_kN_m2:.1f} - {s['w_kN_m2']:.2f}", f"q_net = {s['q_net']:.2f} kN/m2"),
                R("Width required", f"B = N_sls / (q_net L) = {s['N_sls']:.2f} / ({s['q_net']:.2f} x {s['L_m']:.3f}), "
                                    "rounded up to 100 mm", f"A = {s['A_req_m2']:.3f} m2 -> B = {s['first_B_m']:.1f} m"),
            ]
            if abs(s["B_m"] - s["first_B_m"]) > 1e-6:
                rows.append(R("Eccentric SLS pressure", "widened in 100 mm steps until qmax <= q_allow and qmin >= 0",
                              f"B = {s['B_m']:.1f} m"))
            rows.append(R("Section checks", "flexure, one-way shear, punching, edge anchorage",
                          "all OK" if s["structural_ok"] else "fail -> h + 50 mm"))
        rows.append(R("Adopted", f"L x B x h = {d.footing_length_m:.3f} m x {d.footing_width_m:.1f} m x "
                                 f"{d.footing_depth_mm:.0f} mm, left projection {d.left_projection_m:.3f} m",
                      res.overall_status))
        sec.append({"section": "2b. Footing Sizing", "rows": rows})

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
        R("Soil on footing", f"W_s = (A - columns) x h_s x gamma_s, h_s = {d.soil_depth_above_mm/1000:.3f} m, "
                             f"gamma_s = {d.soil_unit_weight_kN_m3:.1f}", f"W_s = {res.soil_weight_kN:.2f} kN"),
        R("SLS total load", "N = P1,sls + P2,sls + W_f + W_s", f"N = {res.sls_total_load_kN:.2f} kN"),
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

# ============================================================
# DETAILING AND BAR SCHEDULE (Structville 9.10, 10.2)
# ============================================================

def _merge_identical_mats(rows):
    """Book 10.2: a square pad's two layers are one bar mark (e.g. 16 No.
    01 = 8 each way) when bar, spacing and dimensions are the same."""
    a, b = rows
    if (a["phi_mm"], a["dims_mm"], a.get("spacing_mm")) == (b["phi_mm"], b["dims_mm"], b.get("spacing_mm")):
        n = a["n_bars"] + b["n_bars"]
        m = fd.schedule_row(a["mark"], a["phi_mm"], n, a["n_members"], a["shape_code"], a["dims_mm"],
                            "bottom mat, both directions")
        m["callout"] = a["callout"]
        m["spacing_mm"] = a["spacing_mm"]
        return [m], [a["callout"], b["callout"]]
    b = {**b, "mark": "02", "callout": b["callout"].replace("-01-", "-02-")}
    return [a, b], [a["callout"], b["callout"]]


def _starters(request, h, mat_phi, n_cols, rows):
    if not request.starter_bar_count:
        return None
    phi = request.starter_bar_dia_mm
    proj, lap = fd.starter_projection(phi, request.steel_grade_fyk, request.concrete_grade_fck,
                                      request.soil_depth_above_mm, request.starter_projection_mm,
                                      request.gamma_c, request.gamma_s)
    mark = f"{len(rows) + 1:02d}"
    rows.append(fd.starter_row(mark, phi, request.starter_bar_count, n_cols, request.n_members,
                               h, request.cover_mm, mat_phi, proj))
    return {"phi_mm": phi, "per_column": request.starter_bar_count, "columns": n_cols,
            "projection_mm": round(proj), "lap_mm": round(lap),
            "projection_from": "entered" if request.starter_projection_mm else "soil depth + lap l0"}


def _pad_detailing(request: PadFoundationRequest, res) -> dict:
    d = request
    phi, c, h = d.bar_dia_mm, d.cover_mm, d.footing_depth_mm
    common = dict(phi=phi, cover=c, h=h, fck=d.concrete_grade_fck, fyk=d.steel_grade_fyk,
                  gamma_c=d.gamma_c, gamma_s=d.gamma_s)
    anch = [
        fd.edge_anchorage(label="X (bars along L)", spacing=res.flex_x.spacing_mm,
                          As_prov=res.flex_x.As_provided, d_eff=res.d_eff_x_mm,
                          a_mm=res.face_x["a"] * 1000, col_b_mm=res.column_face_x_mm,
                          q_edge=res.face_x["q_edge"], **common),
        fd.edge_anchorage(label="Y (bars along B)", spacing=res.flex_y.spacing_mm,
                          As_prov=res.flex_y.As_provided, d_eff=res.d_eff_y_mm,
                          a_mm=res.face_y["a"] * 1000, col_b_mm=res.column_face_y_mm,
                          q_edge=res.face_y["q_edge"], **common),
    ]
    mats = [
        fd.mat_row("01", phi, res.flex_x.spacing_mm, d.footing_length_mm, d.footing_width_mm, c,
                   anch[0]["leg_mm"], d.n_members, "bottom, along L (first layer)"),
        fd.mat_row("01", phi, res.flex_y.spacing_mm, d.footing_width_mm, d.footing_length_mm, c,
                   anch[1]["leg_mm"], d.n_members, "bottom, along B (second layer)"),
    ]
    rows, callouts = _merge_identical_mats(mats)
    starters = _starters(d, h, phi, 1, rows)
    return {"element": "pad", "anchorage": anch, "callouts": callouts, "starters": starters,
            "schedule": rows, "summary": fd.summarise(rows),
            "status": "OK" if all(a["status"] == "OK" for a in anch) else "NOT OK"}


def _combined_detailing(request: CombinedFootingRequest, res) -> dict:
    d = request
    phi, c, h = d.bar_dia_mm, d.cover_mm, d.footing_depth_mm
    L, B = d.footing_length_m * 1000, d.footing_width_m * 1000
    # ULS qmax at the edge: conservative for both directions
    common = dict(phi=phi, cover=c, h=h, fck=d.concrete_grade_fck, fyk=d.steel_grade_fyk,
                  gamma_c=d.gamma_c, gamma_s=d.gamma_s, q_edge=res.qmax)
    a_end = max(res.x1_m * 1000, L - res.x2_m * 1000) - d.column_x_mm / 2
    anch = [
        fd.edge_anchorage(label="Longitudinal bottom (end overhang)", spacing=res.long_flex.spacing_mm,
                          As_prov=res.long_flex.As_provided, d_eff=res.d_long_mm, a_mm=a_end,
                          col_b_mm=d.column_x_mm, **common),
        fd.edge_anchorage(label="Transverse bottom", spacing=res.trans_flex.spacing_mm,
                          As_prov=res.trans_flex.As_provided, d_eff=res.d_trans_mm,
                          a_mm=res.projection_y_m * 1000, col_b_mm=d.column_y_mm, **common),
    ]
    rows = [
        fd.mat_row("01", phi, res.long_flex.spacing_mm, L, B, c, anch[0]["leg_mm"], d.n_members,
                   "bottom, longitudinal (sagging)"),
        fd.mat_row("02", phi, res.long_top_flex.spacing_mm, L, B, c, fd.LEG_MIN_MM, d.n_members,
                   "top, longitudinal (hogging), legs down"),
        fd.mat_row("03", phi, res.trans_flex.spacing_mm, B, L, c, anch[1]["leg_mm"], d.n_members,
                   "bottom, transverse"),
        # book 8.5.4 / 10.2 (mark 07): top mat in both directions; the top
        # transverse bars are distribution steel at the transverse spacing
        fd.mat_row("04", phi, res.trans_flex.spacing_mm, B, L, c, fd.LEG_MIN_MM, d.n_members,
                   "top, transverse (distribution), legs down"),
    ]
    callouts = [r["callout"] for r in rows]
    starters = _starters(d, h, phi, 2, rows)
    return {"element": "combined", "anchorage": anch, "callouts": callouts, "starters": starters,
            "schedule": rows, "summary": fd.summarise(rows),
            "status": "OK" if all(a["status"] == "OK" for a in anch) else "NOT OK"}


def _summary_detailing_row(report: list, det: dict) -> None:
    """Edge anchorage is part of the overall PASS/FAIL: add it to the final
    summary, just above the "Overall" row."""
    summary = next(s for s in report if "Final Design Summary" in s["section"])
    legs = ", ".join(f"{a['label']}: leg {a['leg_mm']:.0f} <= {a['leg_max_mm']:.0f} mm" for a in det["anchorage"])
    summary["rows"].insert(len(summary["rows"]) - 1,
                           {"ref": "Detailing (EC2 9.8.2.2)", "calc": f"edge anchorage of bottom bars; {legs}",
                            "out": det["status"]})


def _detailing_section(num: str, request, det: dict) -> dict:
    R = lambda ref, calc, out: {"ref": ref, "calc": calc, "out": out}
    rows = []
    for a in det["anchorage"]:
        rows += [
            R(f"EC2 9.8.2.2 - {a['label']}", f"x = h/2 = {a['x_mm']:.0f} mm; R = q x = {a['R_kN_m']:.2f} kN/m; "
              f"z_e = a + 0.15b - x/2 = {a['ze_mm']:.0f} mm; z_i = 0.9d = {a['zi_mm']:.0f} mm",
              f"F_s = R z_e/z_i = {a['Fs_kN_m']:.2f} kN/m"),
            R("Bar stress to anchor", f"sigma_s = F_s / A_s,prov; f_bd = 2.25 f_ctd = {a['fbd_MPa']:.2f} N/mm2",
              f"sigma_s = {a['sigma_s_MPa']:.1f} N/mm2"),
            R("EC2 8.4.4 (book 9.1.2)", f"l_b,rqd = (phi/4)(sigma_s/f_bd) = {a['lb_rqd_mm']:.0f} mm; "
              f"l_b,min = {a['lb_min_mm']:.0f} mm; straight l_bd = {a['lbd_straight_mm']:.0f} mm vs x - cover = "
              f"{a['available_straight_mm']:.0f} mm", "straight bar enough" if a["straight_ok"] else "bend needed"),
            R("Bent bar (book 9.10)", f"alpha1 = {a['alpha1']:.2f}, alpha2 = {a['alpha2']:.3f} (c_d = {a['cd_mm']:.0f} mm); "
              f"l_bd = {a['lbd_bent_mm']:.0f} mm; leg = max(150, l_bd - (x - c)) <= h - 2c = {a['leg_max_mm']:.0f}",
              f"leg {a['leg_mm']:.0f} mm {a['status']}"),
            R("Full-strength anchorage (info)", "l_bd at sigma_sd = f_yd, bent bar (book 9.10)",
              f"{a['lbd_full_mm']:.0f} mm = {a['lbd_full_phi']:.2f} phi"),
        ]
    st = det["starters"]
    if st:
        rows.append(R("Starter bars (book 10.2)", f"{st['per_column']} Y{st['phi_mm']:.0f} per column x {st['columns']}; "
                      f"lap l0 = 1.5 l_b,rqd >= max(15 phi, 200) = {st['lap_mm']} mm (book 9.1.6); projection above "
                      f"footing = {st['projection_mm']} mm ({st['projection_from']}); foot 300 mm on the bottom mat",
                      "scheduled"))
    rows.append(R("Bar callouts", "number-size-mark-spacing", ", ".join(det["callouts"])))
    rows.append(R("Bar schedule", "cut length = sum of the shape dimensions (book 10.2 convention, no bend deduction); "
                  f"{request.n_members} identical footing(s)", "see schedule"))
    for r in det["schedule"]:
        dims = ", ".join(f"{k} = {v}" for k, v in r["dims_mm"].items())
        rows.append(R(f"Mark {r['mark']}", f"{r['n_bars']} No. {r['type_size']} x {r['n_members']}, shape {r['shape_code']} "
                      f"({dims}), {r['description']}",
                      f"{r['length_m']:.3f} m, total {r['total_length_m']:.2f} m, {r['mass_kg']:.2f} kg"))
    for e in det["summary"]["by_diameter"]:
        rows.append(R(f"Total {e['type_size']}", f"{e['total_length_m']:.2f} m x {e['unit_mass_kg_m']:.3f} kg/m",
                      f"{e['mass_kg']:.2f} kg ({e['tonnes']:.4f} t), {e['pieces_12m']} pcs of 12 m"))
    rows.append(R("Total reinforcement", "all marks", f"{det['summary']['total_mass_kg']:.2f} kg"))
    return {"section": f"{num}. Detailing and Bar Bending Schedule", "rows": rows}
