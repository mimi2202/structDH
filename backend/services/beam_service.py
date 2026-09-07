# backend/services/beam_service.py
#
# Wired into the validated beam_ss_engine.py -- this service no longer
# duplicates flexure/shear/deflection logic inline. It translates the live
# BeamDesignRequest into the engine's inputs (computing the correct MEd/VEd
# for whichever support condition was requested, since the engine's native
# wL^2/8 formula only covers true simply-supported beams), calls the
# engine for the validated section design, and maps the result into the
# existing BeamDesignResult contract so BeamResults.jsx is unaffected.
import re
import math
from models.beam_schemas import (
    BeamDesignRequest, BeamDesignResult, BeamSummary, BeamMaterialsOut,
    BeamLoadSummary, BeamForces, BeamCapacity, BeamReinforcement, BeamSLS,
    BeamFlexureDetail, BeamShearDetail, BeamDeflectionDetail,
    ReportRow, ReportSection,
)
from engine.beam_ss_engine import BeamInput, design_ss_beam

PI = math.pi

# EC2 Table 7.4N structural system factor K -- same convention already
# established for the slab engines: 1.0 simply supported / 1.3 end span
# (one end continuous) / 1.5 interior span (both ends continuous) / 0.4
# cantilever.
DEFLECTION_K = {
    "both_ends_simply_supported": 1.0,
    "both_ends_fixed": 1.5,
    "one_fixed_one_simple": 1.3,
    "one_fixed_one_free": 0.4,
}

# moment / shear coefficients:  M = cM * w * L^2 ,  V = cV * w * L
SUPPORT_COEFFS = {
    "both_ends_simply_supported": (1 / 8, 1 / 2, "Simply Supported"),
    "both_ends_fixed": (1 / 12, 1 / 2, "Both Ends Fixed"),
    "one_fixed_one_simple": (1 / 8, 5 / 8, "Propped Cantilever"),
    "one_fixed_one_free": (1 / 2, 1.0, "Cantilever"),
}


def _enum(v):
    return v.value if hasattr(v, "value") else v


def parse_fck(grade):
    try:
        g = grade.replace("C", "")
        return float(g.split("/")[0])
    except Exception:
        return 25.0


def parse_fy(grade):
    m = re.search(r"(\d+)", grade)
    return float(m.group(1)) if m else 500.0


def calculate_beam_design(request: BeamDesignRequest) -> BeamDesignResult:
    code = _enum(request.design_code)
    is_bs = code == "BS8110"
    support = _enum(request.support_condition)
    restraint = _enum(request.top_restraint)

    g = request.geometry
    b, h = g.width, g.depth
    cover_input = g.effective_cover
    L = g.span / 1000.0  # m

    fck = parse_fck(request.materials.concrete_grade)
    fy = parse_fy(request.materials.steel_grade)
    link = request.link_diameter

    # ---- loads (kN/m) -- this stays here: translating the live schema's
    # direct kN/m load fields into a total factored UDL is a request-shape
    # concern, not something the (support-condition-agnostic) engine should
    # need to know about. ----
    self_w = (b / 1000.0) * (h / 1000.0) * request.materials.unit_weight_concrete if request.loads.self_weight_auto else 0.0
    comps = [
        {"name": "Beam Self Weight", "kind": "DL", "value": round(self_w, 2)},
        {"name": "Wall Load (Uniform)", "kind": "DL", "value": round(request.loads.wall_load, 2)},
        {"name": "Finishes", "kind": "DL", "value": round(request.loads.finishes, 2)},
        {"name": "Additional Dead Load (DDL)", "kind": "DL", "value": round(request.loads.additional_dead_load, 2)},
        {"name": "Live Load (LL)", "kind": "LL", "value": round(request.loads.live_load, 2)},
        {"name": "Other Live Load", "kind": "LL", "value": round(request.loads.other_live_load, 2)},
    ]
    gk = self_w + request.loads.wall_load + request.loads.finishes + request.loads.additional_dead_load
    qk = request.loads.live_load + request.loads.other_live_load
    service = gk + qk

    if is_bs:
        w_d = 1.4 * gk + 1.6 * qk
        combo = "1.4 Gk + 1.6 Qk (BS 8110)"
    else:
        w_d = 1.35 * gk + 1.5 * qk
        combo = "1.35 Gk + 1.50 Qk (EN 1990)"

    # ---- actions: correct coefficients for whichever support condition
    # was requested -- the engine's native wL^2/8 only covers true
    # simply-supported beams, so this is computed here and handed to the
    # engine as an override. ----
    cM, cV, support_label = SUPPORT_COEFFS.get(support, SUPPORT_COEFFS["both_ends_simply_supported"])
    m_ed = cM * w_d * L ** 2   # kNm
    v_ed = cV * w_d * L        # kN
    K_sys = DEFLECTION_K.get(support, 1.0)

    # ---- run the validated engine for section design ----
    eng_in = BeamInput(
        span_m=L, bw_mm=b, h_mm=h,
        slab_thickness_mm=g.slab_thickness, cover_mm=cover_input,
        link_dia_mm=link, fck=fck, fyk=fy, code="BS8110" if is_bs else "EC2",
        bar_diameters=tuple(request.bar_diameters),
        left_adjacent_spacing_m=(g.left_adjacent_spacing or 0) / 1000.0,
        right_adjacent_spacing_m=(g.right_adjacent_spacing or 0) / 1000.0,
        w_override_kN_m=w_d, MEd_override_kNm=m_ed, VEd_override_kN=v_ed,
        deflection_K_override=K_sys,
    )
    r = design_ss_beam(eng_in)

    fl, sh, defl, act, geo = r["flexure"], r["shear"], r["deflection"], r["actions"], r["geometry"]
    fcd = fck / 1.5 if not is_bs else 0.45 * fck
    fyd = fy / 1.15 if not is_bs else 0.95 * fy
    d = geo["d_eff_mm"]
    z = fl["z_mm"]
    beff = geo["beff_mm"]
    as_prov = fl["As_provided_mm2"]
    as_req = fl["As_req_mm2"]
    m_rd = (0.95 if is_bs else 0.87) * fy * as_prov * z / 1e6
    util_bend = act["MEd_kNm"] / m_rd if m_rd else 0
    v_rdc_kN = sh["VRdc_kN"]
    util_shear = act["VEd_kN"] / v_rdc_kN if v_rdc_kN else 0

    n_bar, dia = int(fl["bars"].split("Y")[0]), int(fl["bars"].split("Y")[1])
    comp_dia = min(request.bar_diameters)
    comp_area = 2 * PI / 4 * comp_dia ** 2
    link_spacing = int(round(sh["s_max_mm"] if act["VEd_kN"] * 1000 <= v_rdc_kN * 1000 else min(sh["s_req_mm"], sh["s_max_mm"])))
    link_spacing = max(75, (link_spacing // 25) * 25)

    # ---- SLS: crack width (simplified EC2 7.3.4) -- beam-specific, no
    # slab equivalent, kept here rather than in the engine ----
    Ecm = 22000 * ((fck + 8) / 10) ** 0.3 if not is_bs else 24000
    Es = 200000.0
    psi2 = 0.3
    m_qp = cM * (gk + psi2 * qk) * L ** 2
    sigma_s = (m_qp * 1e6) / (as_prov * z) if (as_prov and z) else 0
    fct_eff = 0.3 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)
    ac_eff = b * min(2.5 * (h - d), h / 2)
    rho_eff = as_prov / ac_eff if ac_eff else 0.01
    alpha_e = Es / Ecm
    phi = dia
    cover_used = geo["cover_mm"]
    sr_max = 3.4 * cover_used + 0.425 * 0.8 * 0.5 * phi / rho_eff if rho_eff else 0
    eps = max((sigma_s - 0.4 * fct_eff / rho_eff * (1 + alpha_e * rho_eff)) / Es, 0.6 * sigma_s / Es) if rho_eff else 0
    crack = sr_max * eps
    crack_limit = 0.30
    crack_status = "PASS" if crack <= crack_limit else "FAIL"

    defl_status = "PASS" if defl["status"] == "OK" else "FAIL"
    # Shear PASS/FAIL now defers to the engine's own check (shear_ok OR an
    # achievable link spacing exists) instead of independently requiring
    # util_shear<=1 here. Needing shear links is routine, expected design --
    # util_shear>1 on its own does not mean the beam fails, only that
    # concrete alone isn't sufficient and links are required, which the
    # engine already designs for. util_shear itself is unchanged below; it's
    # still reported as a genuine utilisation figure, just no longer used as
    # a strict pass/fail gate on its own.
    shear_status_ok = bool(r.get("checks", {}).get("shear", util_shear <= 1))
    overall = "PASS" if (util_bend <= 1 and shear_status_ok and defl_status == "PASS" and crack_status == "PASS") else "FAIL"
    code_label = "BS 8110:1997" if is_bs else ("ACI 318" if code == "ACI318" else "EN 1992-1-1 (EC2)")

    section_note = (
        f"Flexure designed as T-beam: beff = {round(beff)} mm (EC2 Cl. 5.3.2.1)."
        if beff > b else
        "Flexure designed as rectangular section (no adjacent spacings entered)."
    )
    notes = [
        f"Design in accordance with {code_label}.",
        section_note,
        "Section design (flexure/shear/deflection) performed by the validated beam_ss_engine, driven with actions computed here for the selected support condition.",
        "EC2 lever arm z = d[0.5 + sqrt(0.25 - K/1.134)]; As = M/(0.87 fyk z)." if not is_bs else
        "BS8110 lever arm z = d[0.5 + sqrt(0.25 - K/0.9)]; As = M/(0.95 fyk z).",
        "Cover used = clear cover input + 5 mm fixed detailing tolerance (not user-editable), matching the slab engines.",
        "Deflection: EC2 §7.4.2 span/effective-depth ratio, two-stage (F3 only if the base ratio fails), matching the slab engines.",
        "Design UDL includes beam self-weight." if request.loads.self_weight_auto else "Self-weight excluded by user.",
        "Crack width is a simplified EC2 7.3.4 estimate (quasi-permanent, psi2 = 0.3).",
        "Dimensions in mm; forces in kN and kNm.",
    ]

    report = [
        ReportSection(title=sec["section"],
                      rows=[ReportRow(reference=row["ref"], calculation=row["calc"], output=row["out"])
                            for row in sec["rows"]])
        for sec in r.get("report", [])
    ]

    return BeamDesignResult(
        summary=BeamSummary(
            beam_id=request.beam_id, support_condition=support_label,
            top_restraint=restraint.replace("_", " ").title(),
            span=g.span, width=b, depth=h, effective_depth=round(d, 1), effective_cover=round(cover_used, 1),
            concrete_grade=request.materials.concrete_grade, steel_grade=request.materials.steel_grade,
            design_code=code_label, analysis="Elastic (Linear)", status=overall,
        ),
        materials=BeamMaterialsOut(
            fck=fck, fcd=round(fcd, 1), fyk=fy, fyd=round(fyd, 0),
            modular_ratio=15.0, unit_weight_concrete=request.materials.unit_weight_concrete,
        ),
        loads=BeamLoadSummary(
            components=comps, total_dead=round(gk, 2), total_live=round(qk, 2), total_service=round(service, 2),
        ),
        forces=BeamForces(
            design_udl=round(w_d, 2), max_moment=round(act["MEd_kNm"], 2), max_shear=round(act["VEd_kN"], 2), ultimate_combo=combo,
        ),
        capacity=BeamCapacity(
            moment_resistance=round(m_rd, 2), shear_resistance=round(v_rdc_kN, 2),
            utilization_bending=round(util_bend, 2), utilization_shear=round(util_shear, 2),
        ),
        reinforcement=BeamReinforcement(
            tension={"count": n_bar, "bar_diameter": dia,
                     "area_required": round(as_req, 0), "area_provided": round(as_prov, 0),
                     "label": f"{n_bar}T{dia}"},
            compression={"count": 2, "bar_diameter": comp_dia, "area_provided": round(comp_area, 0),
                         "label": f"2T{comp_dia}"},
            stirrups={"bar_diameter": link, "spacing": link_spacing, "legs": 2,
                      "label": f"\u00d8{link} @ {link_spacing} mm c/c"},
            cover=round(cover_used, 1),
        ),
        sls=BeamSLS(
            deflection_actual=round(defl["actual_Ld"], 2), deflection_limit=round(defl["allowable_Ld"], 2), deflection_status=defl_status,
            crack_width=round(crack, 2), crack_limit=crack_limit, crack_status=crack_status,
        ),
        flexure_detail=BeamFlexureDetail(
            K=fl["K"], K_balanced=fl["K_balanced"], z_mm=fl["z_mm"], beff_mm=fl["beff_mm"],
            is_t_beam=fl["beff_mm"] > b, neutral_axis_mm=fl["x_mm"],
            neutral_axis_in_flange=fl["neutral_axis_in_flange"], as_min_mm2=fl["As_min_mm2"],
        ),
        shear_detail=BeamShearDetail(
            rho_l=sh["rho_l"], k_factor=sh["k"], C_Rdc=sh["C_Rdc"], v_min_mpa=sh["v_min_mpa"],
            v_rdc_mpa=round(v_rdc_kN * 1000 / (b * d), 3) if (b * d) else 0,
            v_ed_mpa=round(act["VEd_kN"] * 1000 / (b * d), 3) if (b * d) else 0,
            links_required=sh["links_required"],
        ),
        deflection_detail=BeamDeflectionDetail(
            rho=defl["rho"], rho0=defl["rho0"], K_sys=defl["K_sys"], ld_basic=defl["ld_basic"],
            base_status=defl["base_status"], F3=defl["F3"], enhanced=defl["enhanced"],
        ),
        notes=notes,
        report=report,
    )