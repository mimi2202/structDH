"""

"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional
import math
import numpy as np


def area_bar(dia_mm, number=1):
    return number * math.pi * dia_mm ** 2 / 4


DEFAULT_BAR_DIAMETERS = [16, 20, 25, 32]
BAR_OPTIONS = [(2, 12), (2, 14), (2, 16), (2, 20), (3, 16), (3, 20),
               (4, 16), (4, 20), (5, 20), (4, 25), (5, 25), (6, 25)]


def choose_bars(As_req, bar_diameters: Optional[List[int]] = None):
    """Choose bar count/diameter for a beam (prefers 2-6 bars).
    If bar_diameters is supplied, tries the user's preferred diameter FIRST
    (order preserved, not sorted) before any other -- the same convention
    used across the slab engines. Falls back to the fixed BAR_OPTIONS table
    (matching the original worked example) only when no diameter list is
    given at all."""
    if bar_diameters:
        fallback = None
        for dia in bar_diameters:
            area = area_bar(dia)
            n = max(2, math.ceil(As_req / area))
            if fallback is None:
                fallback = (n, dia, round(n * area, 1))
            if 2 <= n <= 6:
                return n, dia, round(n * area, 1)
        return fallback
    for n, dia in BAR_OPTIONS:
        A = area_bar(dia, n)
        if A >= As_req:
            return n, dia, A
    n, dia = BAR_OPTIONS[-1]
    return n, dia, area_bar(dia, n)


def _fctm(fck: float) -> float:
    return 0.30 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)


@dataclass
class ContinuousBeamInput:
    spans_m: List[float] = field(default_factory=lambda: [4.0, 5.0, 4.5, 4.2, 6.0])
    slab_areas_m2: List[float] = field(default_factory=lambda: [8.50, 14.17, 11.21, 9.55, 17.00])
    bw_mm: float = 225.0
    h_mm: float = 450.0
    slab_thickness_mm: float = 160.0
    cover_mm: float = 25.0
    link_dia_mm: float = 10.0
    assumed_main_bar_mm: float = 20.0
    fck: float = 30.0
    fyk: float = 500.0
    gamma_c: float = 1.50
    gamma_s: float = 1.15
    Ecm_Nmm2: float = 33000.0
    slab_self_weight: float = 4.0
    finishes: float = 1.0
    services: float = 0.5
    partitions: float = 1.0
    imposed: float = 2.0
    gamma_g: float = 1.35
    gamma_q: float = 1.50
    beam_self_weight_factored: float = 3.417
    wall_load_factored: float = 12.150
    left_adjacent_spacing_m: float = 3.30
    right_adjacent_spacing_m: float = 3.30
    bar_diameters: Optional[List[int]] = None   # user-preferred diameters, main bar first
    effective_depth_override_mm: Optional[float] = None   # if given, used directly for d_mm instead of deriving from cover/link/bar -- makes this a genuine design input, not display-only
    span_loads_override: list = None      # optional: explicit per-span factored UDL (kN/m); bypasses slab-area take-down


def design_continuous_beam(d: ContinuousBeamInput) -> dict:
    # --- loads ---
    factored = {
        "slab_self_weight": d.slab_self_weight * d.gamma_g,
        "finishes": d.finishes * d.gamma_g,
        "services": d.services * d.gamma_g,
        "partitions": d.partitions * d.gamma_g,
        "imposed": d.imposed * d.gamma_q,
    }
    trib = [a / s for a, s in zip(d.slab_areas_m2, d.spans_m)]
    span_loads = []
    if d.span_loads_override is not None and len(d.span_loads_override) == len(d.spans_m):
        # explicit per-span factored UDLs supplied by the caller (live per-span loads)
        span_loads = [float(w) for w in d.span_loads_override]
    else:
        for tw in trib:
            total = (factored["slab_self_weight"] * tw + factored["finishes"] * tw +
                     factored["services"] * tw + factored["partitions"] * tw +
                     factored["imposed"] * tw + d.beam_self_weight_factored + d.wall_load_factored)
            span_loads.append(total)

    # --- section ---
    b_m, h_m = d.bw_mm / 1000, d.h_mm / 1000
    I_m4 = b_m * h_m ** 3 / 12
    EI = d.Ecm_Nmm2 * 1000 * I_m4
    # Fixed +5mm detailing/fixing tolerance, always -- matches every slab engine.
    cover_used = d.cover_mm + 5.0
    if d.effective_depth_override_mm is not None:
        # User-supplied override -- used directly for EVERY downstream
        # calculation (flexure, shear, deflection), not just the displayed
        # summary value. Previously an override here only changed what was
        # shown, while the actual design silently kept using the
        # cover/link/bar-derived depth regardless -- a real inconsistency.
        d_mm = d.effective_depth_override_mm
    else:
        d_mm = d.h_mm - cover_used - d.link_dia_mm - d.assumed_main_bar_mm / 2

    bar_diameters = d.bar_diameters or DEFAULT_BAR_DIAMETERS

    # --- FEM ---
    spans = d.spans_m
    n_nodes = len(spans) + 1
    K = np.zeros((n_nodes, n_nodes))
    F = np.zeros(n_nodes)
    for e, (L, w) in enumerate(zip(spans, span_loads)):
        k = (EI / L) * np.array([[4.0, 2.0], [2.0, 4.0]])
        f = np.array([-w * L ** 2 / 12, w * L ** 2 / 12])
        K[e:e + 2, e:e + 2] += k
        F[e:e + 2] += f
    theta = np.linalg.solve(K, F)

    # --- member moments ---
    end_moments = []
    for e, (L, w) in enumerate(zip(spans, span_loads)):
        k = (EI / L) * np.array([[4.0, 2.0], [2.0, 4.0]])
        f = np.array([-w * L ** 2 / 12, w * L ** 2 / 12])
        m = k @ theta[e:e + 2] - f
        end_moments.append(m)

    # support hogging = |right end moment| of each span except the last node's own
    support_moments = {}
    for e in range(len(spans) - 1):
        support_moments[f"S{e + 2}"] = float(abs(end_moments[e][1]))

    # span sagging from equilibrium
    span_moments = {}
    span_details = []
    for e, (L, w, mp) in enumerate(zip(spans, span_loads, end_moments), start=1):
        # Stiffness-convention member end moments -> bending moment convention
        # (sagging positive). The two ends carry opposite signs for the same
        # physical hogging, so they must NOT both be forced negative.
        M_left = -float(mp[0])
        M_right = float(mp[1])
        # Equilibrium: R_A = wL/2 + (M_B - M_A)/L.  Verify on a propped
        # cantilever (M_A = -wL^2/8, M_B = 0) -> 5wL/8.
        R_left = (w * L) / 2 + (M_right - M_left) / L
        R_right = w * L - R_left
        x = R_left / w if w else 0.0
        M_max = M_left + R_left * x - (w * x ** 2) / 2
        # Reported as computed. A genuinely non-positive result means the span
        # is fully hogging and should be visible, not clamped to zero.
        span_moments[f"Span {e}"] = float(M_max)
        span_details.append({"span": e, "L_m": L, "w_kN_m": round(w, 3),
                             "M_left": round(M_left, 3), "M_right": round(M_right, 3),
                             "R_left": round(R_left, 3), "R_right": round(R_right, 3),
                             "x_m": round(x, 3),
                             "M_sag": round(M_max, 3),
                             "M_free_span": round(w * L ** 2 / 8, 3)})

    # --- effective flange (per span) ---
    beff = {}
    for i, L in enumerate(spans, start=1):
        l0 = 0.85 * L if (i == 1 or i == len(spans)) else 0.70 * L
        beff1 = min(0.2 * l0, d.left_adjacent_spacing_m / 2)
        beff2 = min(0.2 * l0, d.right_adjacent_spacing_m / 2)
        beff[f"Span {i}"] = (b_m + beff1 + beff2) * 1000

    # --- flexure ---
    def flex(M, b):
        M_Nmm = M * 1e6
        Kf = M_Nmm / (b * d_mm ** 2 * d.fck)
        # EC2 lever arm -- K/1.134, matching the slab engines (was K/0.9,
        # which is the BS8110 form and never correct for this EC2-only engine).
        z = min(d_mm * (0.5 + math.sqrt(max(0.25 - Kf / 1.134, 0))), 0.95 * d_mm)
        As_req = M_Nmm / (0.87 * d.fyk * z)
        return Kf, z, As_req

    fctm = _fctm(d.fck)
    As_min = max(0.26 * fctm / d.fyk * d.bw_mm * d_mm, 0.0013 * d.bw_mm * d_mm)

    support_design = {}
    for s, M in support_moments.items():
        Kf, z, As_req = flex(M, d.bw_mm)                       # hogging = rectangular
        As_des = max(As_req, As_min)
        n, dia, As_prov = choose_bars(As_des, bar_diameters)
        support_design[s] = {"M_kNm": round(M, 3), "K": round(Kf, 5), "z_mm": round(z, 1),
                             "As_req_mm2": round(As_req, 1), "As_design_mm2": round(As_des, 1),
                             "bars": f"{n}Y{dia}", "As_provided_mm2": round(As_prov, 1),
                             "status": "OK" if As_prov >= As_des else "NOT OK"}
    span_design = {}
    for sp, M in span_moments.items():
        b_eff = beff[sp]
        if M <= 0:
            # No sagging anywhere in this span: both ends hog hard enough that
            # the free moment never lifts the diagram positive. Common on a
            # short span between two long ones. Running the flexure routine on
            # a negative moment would give a negative K and a negative As,req,
            # so report the condition instead and provide minimum steel.
            As_des = As_min
            n, dia, As_prov = choose_bars(As_des, bar_diameters)
            span_design[sp] = {"M_kNm": round(M, 3), "beff_mm": round(b_eff, 1),
                               "K": None, "z_mm": None, "x_mm": None,
                               "As_req_mm2": 0.0, "As_design_mm2": round(As_des, 1),
                               "bars": f"{n}Y{dia}", "As_provided_mm2": round(As_prov, 1),
                               "neutral_axis_in_flange": None,
                               "no_sagging": True,
                               "note": ("span is fully hogging -- the free moment never "
                                        "exceeds the end moments, so minimum steel governs "
                                        "the bottom face"),
                               "status": "OK" if bool(As_prov >= As_des) else "NOT OK"}
            continue
        Kf, z, As_req = flex(M, b_eff)                         # sagging = T-beam
        As_des = max(As_req, As_min)
        n, dia, As_prov = choose_bars(As_des, bar_diameters)
        x_approx = As_req * 0.87 * d.fyk / (0.8 * d.fck * b_eff)
        span_design[sp] = {"M_kNm": round(M, 3), "beff_mm": round(b_eff, 1), "K": round(Kf, 5),
                           "z_mm": round(z, 1), "x_mm": round(x_approx, 1),
                           "As_req_mm2": round(As_req, 1), "As_design_mm2": round(As_des, 1),
                           "bars": f"{n}Y{dia}", "As_provided_mm2": round(As_prov, 1),
                           "neutral_axis_in_flange": bool(x_approx <= d.slab_thickness_mm),
                           "no_sagging": False,
                           "status": "OK" if bool(As_prov >= As_des) else "NOT OK"}

    # --- shear ---
    shear = {}
    shear_ends = {}
    for e, (L, w, mp) in enumerate(zip(spans, span_loads, end_moments), start=1):
        M_left = -float(mp[0])
        M_right = float(mp[1])
        R_left = (w * L) / 2 + (M_right - M_left) / L
        R_right = w * L - R_left
        shear[f"Span {e}"] = float(round(max(abs(R_left), abs(R_right)), 3))
        shear_ends[f"Span {e}"] = {"V_left_kN": round(float(R_left), 3),
                                   "V_right_kN": round(float(R_right), 3)}
    bw = d.bw_mm
    C_Rdc = 0.18 / d.gamma_c
    k_sh = min(1 + math.sqrt(200 / d_mm), 2.0)
    max_As = max(item["As_provided_mm2"] for item in span_design.values())
    rho_l = min(max_As / (bw * d_mm), 0.02)
    v_min = 0.035 * k_sh ** 1.5 * math.sqrt(d.fck)
    VRdc = max(C_Rdc * k_sh * (100 * rho_l * d.fck) ** (1 / 3) * bw * d_mm,
               v_min * bw * d_mm) / 1000
    max_VEd = max(shear.values())
    shear_ok = bool(max_VEd <= VRdc)

    # --- shear links, EC2 Cl.6.2.3 (variable strut inclination) ---
    # Once links are required they carry the whole of VEd; VRd,c is not
    # deducted (Cl.6.2.3(1)). z = 0.9d, fywd = fyk/1.15, cot(theta) = 2.5
    # is the flattest strut EC2 allows and gives the widest spacing.
    fywd = d.fyk / d.gamma_s
    z_sh = 0.9 * d_mm
    cot_theta = 2.5
    theta_deg = math.degrees(math.atan(1.0 / cot_theta))
    nu1 = 0.6 * (1 - d.fck / 250.0)
    alpha_cw = 1.0
    # VRd,max = alpha_cw bw z nu1 fcd / (cot + tan)
    VRd_max = (alpha_cw * bw * z_sh * nu1 * (d.fck / d.gamma_c)
               / (cot_theta + 1.0 / cot_theta)) / 1000.0
    Asw_link = 2 * math.pi * d.link_dia_mm ** 2 / 4      # 2 legs
    s_max_ec2 = min(0.75 * d_mm, 300.0)                  # Cl.9.2.2(6)
    # Minimum shear reinforcement ratio, Cl.9.2.2(5)
    rho_w_min = 0.08 * math.sqrt(d.fck) / d.fyk
    s_min_ratio = Asw_link / (rho_w_min * bw) if rho_w_min > 0 else s_max_ec2

    shear_design = {}
    for sp, VEd in shear.items():
        needs_links = VEd > VRdc
        crush_ok = VEd <= VRd_max
        if needs_links:
            # s = Asw z fywd cot(theta) / VEd
            s_req = Asw_link * z_sh * fywd * cot_theta / (VEd * 1000.0)
            s_gov = min(s_req, s_max_ec2, s_min_ratio)
            basis = "shear demand" if s_req <= min(s_max_ec2, s_min_ratio) else (
                "maximum spacing Cl.9.2.2(6)" if s_max_ec2 <= s_min_ratio
                else "minimum ratio Cl.9.2.2(5)")
        else:
            s_req = float("inf")
            s_gov = min(s_max_ec2, s_min_ratio)
            basis = "nominal links -- VEd <= VRd,c"
        spacing = max(75, int(s_gov // 25) * 25)         # round DOWN to 25 mm
        Asw_s_req = (VEd * 1000.0) / (z_sh * fywd * cot_theta) if needs_links else 0.0
        Asw_s_prov = Asw_link / spacing
        shear_design[sp] = {
            "VEd_kN": round(VEd, 3),
            "VRdc_kN": round(VRdc, 3),
            "VRd_max_kN": round(VRd_max, 3),
            "links_required": bool(needs_links),
            "crush_ok": bool(crush_ok),
            "Asw_mm2": round(Asw_link, 1),
            "z_mm": round(z_sh, 1),
            "fywd_MPa": round(fywd, 1),
            "cot_theta": cot_theta,
            "theta_deg": round(theta_deg, 1),
            "Asw_s_required": round(Asw_s_req, 4),
            "Asw_s_provided": round(Asw_s_prov, 4),
            "s_required_mm": None if s_req == float("inf") else round(s_req, 1),
            "s_max_ec2_mm": round(s_max_ec2, 1),
            "s_min_ratio_mm": round(s_min_ratio, 1),
            "spacing_mm": spacing,
            "governed_by": basis,
            "label": f"{int(d.link_dia_mm)} mm links, 2 legs @ {spacing} mm c/c",
            "status": "OK" if (Asw_s_prov >= Asw_s_req and crush_ok) else "NOT OK",
        }
    crush_ok_all = all(v["crush_ok"] for v in shear_design.values())
    links_ok_all = all(v["status"] == "OK" for v in shear_design.values())

    # --- deflection: EC2 §7.4.2 span/effective-depth ratio (two-stage) ---
    # Replaces the old N*K*F1*F2*F3 modifier method, which used a HARDCODED
    # F3 = 1.069 lifted from the one worked example and never recomputed
    # from the beam's actual As,prov/As,req -- meaning it silently gave the
    # same "enhancement" regardless of what steel was actually provided.
    # Every span is checked with its own K and A_s,req; the governing span is
    # the one with the highest actual/allowable ratio. (Previously only the
    # longest span was checked, so a shorter end span with K = 1.3 could
    # govern unseen, and the report called the longest span the one with the
    # "highest sagging demand", which it often is not.)
    #   - EC2 Cl.7.4.2(2): flanged sections with b_eff/b_w > 3 -> x 0.8 (F1).
    #   - Allowable capped at 40K, the Concrete Centre limit this engine used
    #     before the switch to Eq. 7.16: at low rho Eq. 7.16a gives very large
    #     ratios (154 for a lightly reinforced 6 m span) that mean nothing.
    #   - F2 = 7/l_eff (spans > 7 m carrying brittle partitions) is not
    #     applied: the engine is not told about partitions. Reported as such.
    rho0 = math.sqrt(d.fck) / 1000.0
    n_sp = len(spans)
    defl_spans = []
    for i, L in enumerate(spans):
        label = f"Span {i + 1}"
        sd = span_design.get(label, {})
        As_req_i = sd.get("As_req_mm2", As_min)
        As_prov_i = sd.get("As_provided_mm2", As_min)
        end_i = i == 0 or i == n_sp - 1
        K_i = 1.0 if n_sp == 1 else (1.3 if end_i else 1.5)   # EC2 Table 7.4N
        rho_i = As_req_i / (d.bw_mm * d_mm) if d_mm else 0.0
        if rho_i and rho_i <= rho0:
            eq_i = K_i * (11 + 1.5 * math.sqrt(d.fck) * (rho0 / rho_i) + 3.2 * math.sqrt(d.fck) * max((rho0 / rho_i) - 1, 0.0) ** 1.5)
        else:
            # Eq. 7.16b with no compression steel (rho' = 0): K[11 + 1.5 sqrt(fck) rho0/rho].
            # Was K(11 + 1.5 sqrt(fck)), dropping rho0/rho (< 1 here): unconservative.
            eq_i = K_i * (11 + 1.5 * math.sqrt(d.fck) * (rho0 / rho_i))
        beff_i = beff.get(label, d.bw_mm)
        F1_i = 0.8 if beff_i / d.bw_mm > 3 else 1.0
        cap_i = 40.0 * K_i
        basic_i = min(eq_i * F1_i, cap_i)
        actual_i = L * 1000 / d_mm
        base_i = "PASS" if actual_i <= basic_i else "FAIL"
        if base_i == "PASS":
            F3_i = 1.0
        else:
            F3_i = min(As_prov_i / As_req_i, 1.5) if As_req_i else 1.0
        allow_i = min(eq_i * F1_i * F3_i, cap_i)
        defl_spans.append({
            "span": label, "L_m": L, "end": end_i, "K": K_i, "As_req": As_req_i, "As_prov": As_prov_i,
            "rho": rho_i, "eq": eq_i, "beff": beff_i, "F1": F1_i, "cap": cap_i, "capped": eq_i * F1_i * F3_i > cap_i,
            "basic": basic_i, "actual": actual_i, "base": base_i, "F3": F3_i, "allowable": allow_i,
            "ok": actual_i <= allow_i, "ratio": actual_i / allow_i if allow_i else 9.99,
        })
    g = max(defl_spans, key=lambda x: x["ratio"])
    gov_span_label, gov_span, is_end_span, K_sys = g["span"], g["L_m"], g["end"], g["K"]
    As_req_gov, rho, F1_defl, defl_cap = g["As_req"], g["rho"], g["F1"], g["cap"]
    ld_eq, ld_basic, actual_Ld = g["eq"], g["basic"], g["actual"]
    deflection_base_status, F3, allowable_Ld = g["base"], g["F3"], g["allowable"]
    deflection_enhanced = g["base"] == "FAIL"
    defl_ok = all(x["ok"] for x in defl_spans)

    checks = {
        "flexure_supports": bool(all(v["status"] == "OK" for v in support_design.values())),
        "flexure_spans": bool(all(v["status"] == "OK" for v in span_design.values())),
        "shear": bool(links_ok_all and crush_ok_all),
        "deflection": bool(defl_ok),
    }
    status = "PASS" if all(checks.values()) else "FAIL"

    max_hog = max(support_moments.values()) if support_moments else 0.0
    max_sag = max(span_moments.values()) if span_moments else 0.0

    fcd_report = d.fck / 1.5
    fyd_report = d.fyk / 1.15

    R2 = lambda ref, calc, out: {"ref": ref, "calc": calc, "out": str(out)}
    report = []

    report.append({"section": "1. Design Basis and References", "rows": [
        R2("EN 1990", "Basis of structural design -- ULS combination Eq. 6.10", "adopted"),
        R2("EN 1992-1-1", "Concrete design -- Cl.6.1 flexure, Cl.6.2 shear, Cl.7.4.2 deflection, Cl.9.2.1.1 min steel, Cl.5.3.2.1 effective flange", "adopted"),
        R2("Analysis", "direct stiffness (FEM): element k=(EI/L)[[4,2],[2,4]], f=[-wL^2/12,+wL^2/12], solved for joint rotations", f"{len(spans)} spans"),
    ]})

    report.append({"section": "2. Geometry, Cover and Materials", "rows": [
        R2("Cover input", f"clear cover specified by user, Cc = {d.cover_mm:.0f} mm", f"Cc,input = {d.cover_mm:.0f} mm"),
        R2("Tolerance", "a fixed 5 mm fixing/detailing allowance is added to the clear cover specified above -- this is not user-editable", "+5 mm"),
        R2("Cover used", f"Cc,used = Cc,input + 5 mm = {d.cover_mm:.0f} + 5", f"Cc = {cover_used:.0f} mm"),
        R2("EC2 Cl.6.1", f"d = h - Cc - link - main_bar/2 = {d.h_mm:.0f} - {cover_used:.0f} - {d.link_dia_mm:.0f} - {d.assumed_main_bar_mm/2:.1f}", f"d = {d_mm:.1f} mm"),
        R2("Section", f"I = bh^3/12 = {d.bw_mm:.0f} x {d.h_mm:.0f}^3/12", f"I = {I_m4:.6e} m4"),
        R2("Rigidity", f"EI = Ecm x I = {d.Ecm_Nmm2:.0f} x {I_m4:.6e}", f"EI = {EI:.1f} kNm2"),
        R2("EC2 Table 3.1", f"fctm = 0.30 x fck^(2/3) = 0.30 x {d.fck:.0f}^(2/3)", f"fctm = {fctm:.2f} MPa"),
        R2("EC2 Cl.3.1.6", f"fcd = fck/gamma_c = {d.fck:.0f}/1.50", f"fcd = {fcd_report:.2f} MPa"),
        R2("EC2 Cl.3.2.7", f"fyd = fyk/gamma_s = {d.fyk:.0f}/1.15", f"fyd = {fyd_report:.1f} MPa"),
    ]})

    load_rows = [R2("Per-span factored UDL", "self-weight + finishes + services + partitions + imposed (or override)", "see below")]
    for i, (L, w) in enumerate(zip(spans, span_loads), start=1):
        load_rows.append(R2(f"Span {i} (L={L:.2f}m)", f"tributary width {trib[i-1]:.3f} m" if d.span_loads_override is None else "supplied directly by caller", f"w = {w:.3f} kN/m"))
    report.append({"section": "3. Loads", "rows": load_rows})

    fem_rows = [
        R2("Element stiffness", "k = (EI/L)[[4,2],[2,4]]", f"{len(spans)} elements"),
        R2("Fixed-end moments", "f = [-wL^2/12, +wL^2/12] per element", "assembled into global F"),
        R2("Solve", "theta = K^-1 F (joint rotations)", f"{n_nodes} nodes"),
    ]
    for i, t in enumerate(theta):
        fem_rows.append(R2(f"theta node {i}", "nodal rotation", f"{t:+.6e} rad"))
    report.append({"section": "4. FEM Analysis", "rows": fem_rows})

    mom_rows = [
        R2("Sign convention", "member end moments converted to bending-moment convention: "
                              "M_A = -m[0], M_B = +m[1] (sagging positive)", "applied"),
        R2("Equilibrium", "R_A = wL/2 + (M_B - M_A)/L ; x = R_A/w ; "
                          "M_sag = M_A + R_A x - w x^2/2", "per span"),
    ]
    for det in span_details:
        mom_rows.append(R2(f"Span {det['span']} -- ends",
                           f"M_A = {det['M_left']:.2f}, M_B = {det['M_right']:.2f} kNm",
                           f"R_A = {det['R_left']:.2f} kN"))
        mom_rows.append(R2(f"Span {det['span']} -- sagging",
                           f"free moment wL^2/8 = {det['M_free_span']:.2f} kNm, "
                           f"peak at x = {det['x_m']:.3f} m",
                           f"M_sag = {det['M_sag']:.2f} kNm"))
    mom_rows += [
        R2("Support hogging", "|interior end moments| -- see Section 7 for per-support values", f"max {max_hog:.2f} kNm"),
        R2("Span sagging", "see Section 6 for the reinforcement design", f"max {max_sag:.2f} kNm"),
    ]
    report.append({"section": "5. Moments", "rows": mom_rows})

    span_rows = [R2("EC2 Cl.5.3.2.1", "effective flange width computed per span, T-beam sagging design", "see below")]
    for sp, M in span_moments.items():
        b_eff = beff[sp]
        sd = span_design[sp]
        if sd.get("no_sagging"):
            span_rows.append(R2(f"{sp} -- beff", "bw + beff1 + beff2", f"{b_eff:.1f} mm"))
            span_rows.append(R2(f"{sp} -- no sagging",
                                f"end moments {M:.2f} kNm peak: the free moment never lifts "
                                "this span positive, so there is no sagging to design for",
                                "fully hogging"))
            span_rows.append(R2(f"{sp} -- provide",
                                f"bottom face takes As,min = {As_min:.0f} mm2",
                                f"{sd['bars']} ({sd['status']})"))
            continue
        root = max(0.25 - sd["K"] / 1.134, 0.0)
        span_rows.append(R2(f"{sp} -- beff", f"bw + beff1 + beff2", f"{b_eff:.1f} mm"))
        span_rows.append(R2(f"{sp} -- K", f"K = M/(beff d^2 fck) = ({sd['M_kNm']:.2f} x 10^6)/({b_eff:.1f} x {d_mm:.1f}^2 x {d.fck:.0f})", f"K = {sd['K']:.5f}"))
        span_rows.append(R2(f"{sp} -- Z", f"Z = d(0.5+sqrt(0.25-K/1.134)) = {d_mm:.1f}(0.5+sqrt({root:.4f}))", f"Z = {sd['z_mm']:.1f} mm"))
        span_rows.append(R2(f"{sp} -- As,req", f"As = M x 10^6/(0.87 fyk Z)", f"As,req = {sd['As_req_mm2']:.0f} mm2"))
        span_rows.append(R2(f"{sp} -- provide", f"As,design = max(As,req, As,min) = max({sd['As_req_mm2']:.0f}, {As_min:.0f})", f"{sd['bars']} ({sd['status']})"))
    report.append({"section": "6. Span (Sagging) Reinforcement -- T-beam", "rows": span_rows})

    sup_rows = [R2("EC2 Cl.6.1", "rectangular section, hogging design at each interior support", "see below")]
    for s, M in support_moments.items():
        sd = support_design[s]
        root = max(0.25 - sd["K"] / 1.134, 0.0)
        sup_rows.append(R2(f"{s} -- K", f"K = M/(bw d^2 fck) = ({sd['M_kNm']:.2f} x 10^6)/({d.bw_mm:.0f} x {d_mm:.1f}^2 x {d.fck:.0f})", f"K = {sd['K']:.5f}"))
        sup_rows.append(R2(f"{s} -- Z", f"Z = d(0.5+sqrt(0.25-K/1.134)) = {d_mm:.1f}(0.5+sqrt({root:.4f}))", f"Z = {sd['z_mm']:.1f} mm"))
        sup_rows.append(R2(f"{s} -- As,req", "As = M x 10^6/(0.87 fyk Z)", f"As,req = {sd['As_req_mm2']:.0f} mm2"))
        sup_rows.append(R2(f"{s} -- provide", f"As,design = max(As,req, As,min) = max({sd['As_req_mm2']:.0f}, {As_min:.0f})", f"{sd['bars']} ({sd['status']})"))
    report.append({"section": "7. Support (Hogging) Reinforcement -- Rectangular", "rows": sup_rows})

    bd = d.bw_mm * d_mm
    t1 = 0.26 * fctm / d.fyk * bd
    t2 = 0.0013 * bd
    gov = "concrete tensile strength basis" if t1 >= t2 else "0.13% minimum basis"
    report.append({"section": "8. Minimum Reinforcement Check", "rows": [
        R2("EC2 Cl.9.2.1.1", "As,min = max(0.26 fctm/fyk bw d, 0.0013 bw d) -- same d applies at every span and support on this member", "formula"),
        R2("Basis 1 -- concrete tensile strength", f"0.26 x {fctm:.2f}/{d.fyk:.0f} x {d.bw_mm:.0f} x {d_mm:.1f}", f"{t1:.0f} mm2"),
        R2("Basis 2 -- 0.13% of section", f"0.0013 x {d.bw_mm:.0f} x {d_mm:.1f}", f"{t2:.0f} mm2"),
        R2("Governing", f"As,min = max({t1:.0f}, {t2:.0f}) -- {gov} governs", f"As,min = {As_min:.0f} mm2"),
    ]})

    shear_rows = [R2("Per-span design shear", "end reactions from span equilibrium", "see below")]
    for sp, V in shear.items():
        ends = shear_ends[sp]
        shear_rows.append(R2(sp, f"V_left = {ends['V_left_kN']:.2f}, V_right = {ends['V_right_kN']:.2f}",
                             f"VEd = {V:.2f} kN"))
    shear_rows += [
        R2("Steel ratio", "rho_l = As,prov(max)/(bw d)  (<=0.02)", f"rho_l = {rho_l:.5f}"),
        R2("Size factor", f"k = 1 + sqrt(200/d) = 1 + sqrt(200/{d_mm:.1f})  (<=2.0)", f"k = {k_sh:.3f}"),
        R2("EC2 Cl.6.2.2", "C_Rd,c = 0.18/gamma_c = 0.18/1.50", f"C_Rd,c = {C_Rdc:.3f}"),
        R2("EC2 Cl.6.2.2", f"v_min = 0.035 k^1.5 sqrt(fck) = 0.035 x {k_sh:.3f}^1.5 x sqrt({d.fck:.0f})",
           f"v_min = {v_min:.3f} MPa"),
        R2("VRd,c", "max(main term, v_min) x bw x d", f"VRd,c = {VRdc:.2f} kN"),
        R2("Verdict", f"max VEd {max_VEd:.2f} vs VRd,c {VRdc:.2f}",
           "no links required" if shear_ok else "links required"),
    ]
    report.append({"section": "9. Shear Resistance Without Links (EC2 Cl.6.2.2)", "rows": shear_rows})

    # --- 9b. link design, shown per span ---
    any_links = any(v["links_required"] for v in shear_design.values())
    link_rows = [
        R2("EC2 Cl.6.2.3", "Where VEd > VRd,c the links carry the WHOLE of VEd. "
                           "VRd,c is not deducted.", "variable strut inclination"),
        R2("Strut angle", f"cot(theta) = {cot_theta} -> theta = {theta_deg:.1f} deg "
                          "(flattest EC2 permits, widest spacing)", f"cot = {cot_theta}"),
        R2("Lever arm", f"z = 0.9 d = 0.9 x {d_mm:.1f}", f"z = {z_sh:.1f} mm"),
        R2("Link steel", f"fywd = fyk/gamma_s = {d.fyk:.0f}/{d.gamma_s:.2f}", f"fywd = {fywd:.1f} MPa"),
        R2("Link area", f"Asw = 2 legs x pi x {d.link_dia_mm:.0f}^2/4", f"Asw = {Asw_link:.1f} mm2"),
        R2("EC2 Cl.6.2.3(3)", f"nu1 = 0.6(1 - fck/250) = 0.6(1 - {d.fck:.0f}/250)", f"nu1 = {nu1:.4f}"),
        R2("Crushing limit", "VRd,max = alpha_cw bw z nu1 fcd/(cot+tan)", f"VRd,max = {VRd_max:.2f} kN"),
        R2("EC2 Cl.9.2.2(6)", f"s,max = min(0.75d, 300) = min({0.75*d_mm:.1f}, 300)", f"{s_max_ec2:.0f} mm"),
        R2("EC2 Cl.9.2.2(5)", f"rho_w,min = 0.08 sqrt(fck)/fyk = 0.08 sqrt({d.fck:.0f})/{d.fyk:.0f}"
                              f" -> s <= Asw/(rho_w,min bw)", f"{s_min_ratio:.0f} mm"),
    ]
    for sp, sdz in shear_design.items():
        if sdz["links_required"]:
            link_rows.append(R2(f"{sp} -- Asw/s required",
                                f"Asw/s = VEd/(z fywd cot) = ({sdz['VEd_kN']:.2f} x 10^3)"
                                f"/({z_sh:.1f} x {fywd:.1f} x {cot_theta})",
                                f"{sdz['Asw_s_required']:.4f} mm2/mm"))
            link_rows.append(R2(f"{sp} -- s required",
                                f"s = Asw/(Asw/s) = {Asw_link:.1f}/{sdz['Asw_s_required']:.4f}",
                                f"s = {sdz['s_required_mm']:.1f} mm"))
        else:
            link_rows.append(R2(f"{sp} -- links",
                                f"VEd = {sdz['VEd_kN']:.2f} <= VRd,c = {VRdc:.2f} "
                                "-> nominal links only", "nominal"))
        link_rows.append(R2(f"{sp} -- crushing",
                            f"VEd = {sdz['VEd_kN']:.2f} vs VRd,max = {VRd_max:.2f}",
                            "OK" if sdz["crush_ok"] else "SECTION TOO SMALL"))
        link_rows.append(R2(f"{sp} -- governed by", sdz["governed_by"],
                            f"s = {sdz['spacing_mm']} mm"))
        link_rows.append(R2(f"{sp} -- provide",
                            f"Asw/s provided = {Asw_link:.1f}/{sdz['spacing_mm']} = "
                            f"{sdz['Asw_s_provided']:.4f} vs required {sdz['Asw_s_required']:.4f}",
                            f"{sdz['label']} ({sdz['status']})"))
    report.append({"section": "9b. Shear Link Design (EC2 Cl.6.2.3, Cl.9.2.2)"
                   if any_links else "9b. Shear Links -- Nominal (EC2 Cl.9.2.2)",
                   "rows": link_rows})

    defl_rows = [
        R2("Method", "every span checked with its own K (EC2 Table 7.4N: 1.0 single span, 1.3 end span, 1.5 interior span) and its own A_s,req; the governing span has the highest actual/allowable", f"{len(defl_spans)} span(s)"),
    ]
    for x in defl_spans:
        defl_rows.append(R2(x["span"], f"L/d actual = {x['L_m'] * 1000:.0f}/{d_mm:.1f} = {x['actual']:.2f} ; allowable = {x['allowable']:.2f} (K = {x['K']:.1f}{', F1 = 0.8' if x['F1'] < 1 else ''}{', F3 = %.3f' % x['F3'] if x['F3'] != 1 else ''}{', capped at 40K' if x['capped'] else ''})",
                            f"{x['ratio']:.2f} {'PASS' if x['ok'] else 'FAIL'}"))
    defl_rows += [
        R2("Governing span", f"{gov_span_label} ({'single' if n_sp == 1 else 'end' if is_end_span else 'interior'} span) -- highest actual/allowable", f"K = {K_sys:.2f}"),
        R2("Basic span/depth ratio", f"rho = As,req/(bw d) = {As_req_gov:.0f}/({d.bw_mm:.0f} x {d_mm:.1f})", f"rho = {rho:.5f}"),
        R2("Basic span/depth ratio", f"rho0 = sqrt(fck)/1000 = sqrt({d.fck:.0f})/1000", f"rho0 = {rho0:.5f}"),
        R2("Branch", f"rho = {rho:.5f} vs rho0 = {rho0:.5f}", "lightly reinforced (branch A)" if rho <= rho0 else "heavily reinforced (branch B)"),
        R2("EC2 Cl.7.4.2", "(L/d) = K[11 + 1.5 sqrt(fck)(rho0/rho) + 3.2 sqrt(fck)(rho0/rho-1)^1.5]  (Eq. 7.16a)" if rho <= rho0 else "(L/d) = K[11 + 1.5 sqrt(fck) rho0/rho]  (Eq. 7.16b, rho' = 0)", f"Eq. 7.16 = {ld_eq:.2f}"),
        R2("EC2 Cl.7.4.2(2)", f"flanged section: b_eff/b_w = {g['beff']:.0f}/{d.bw_mm:.0f} = {g['beff'] / d.bw_mm:.2f} {'> 3, so x 0.8' if F1_defl < 1 else '<= 3, no reduction'}", f"F1 = {F1_defl:.1f}"),
        R2("Upper limit", f"allowable not taken above 40K = 40 x {K_sys:.1f} (Concrete Centre limit; Eq. 7.16a grows without bound as rho falls)", f"40K = {defl_cap:.1f}"),
        R2("(L/d) basic", f"min(Eq. 7.16 x F1, 40K) = min({ld_eq:.2f} x {F1_defl:.1f}, {defl_cap:.1f})", f"(L/d)_basic = {ld_basic:.2f}"),
        R2("Actual", f"(L/d)_actual = L/d = {gov_span*1000:.0f}/{d_mm:.1f}", f"{actual_Ld:.2f}"),
        R2("Base check", f"actual vs basic, before any enhancement -> {actual_Ld:.2f} {'<=' if deflection_base_status=='PASS' else '>'} {ld_basic:.2f}", deflection_base_status),
        R2("Enhancement factor F3", "base check failed -> F3 = As,prov/As,req (<=1.5), result still capped at 40K" if deflection_enhanced else "base check already passes -- F3 not required", f"F3 = {F3:.3f}"),
        R2("Allowable (L/d)", "min(basic x F3, 40K)", f"{allowable_Ld:.2f}"),
        R2("Not applied", "F2 = 7/l_eff for spans over 7 m supporting partitions liable to damage (EC2 Cl.7.4.2(2)): the engine is not told whether there are such partitions", "check by hand" if max(spans) > 7 else "no span > 7 m"),
        R2("Verdict", f"{actual_Ld:.2f} {'<=' if actual_Ld <= allowable_Ld else '>'} {allowable_Ld:.2f} at the governing span; all spans {'pass' if defl_ok else 'do not pass'}", "Deflection is okay" if defl_ok else "Deflection is NOT okay -- increase depth or steel"),
    ]
    report.append({"section": "10. Deflection (EC2 Cl.7.4.2, two-stage)", "rows": defl_rows})

    report.append({"section": "11. Checks and Notes", "rows": [
        R2("Flexure -- spans", "all spans", "PASS" if checks["flexure_spans"] else "FAIL"),
        R2("Flexure -- supports", "all supports", "PASS" if checks["flexure_supports"] else "FAIL"),
        R2("Shear", "governing span", "PASS" if checks["shear"] else "FAIL"),
        R2("Deflection", "governing span", "PASS" if checks["deflection"] else "FAIL"),
        R2("Overall", "flexure, shear, deflection", status),
    ]})

    return {
        "status": status, "n_spans": len(spans),
        "loads": {"factored_strip": {k: round(v, 3) for k, v in factored.items()},
                  "tributary_widths_m": [round(t, 3) for t in trib],
                  "span_loads_kN_m": [round(s, 3) for s in span_loads]},
        "geometry": {"spans_m": spans, "bw_mm": d.bw_mm, "h_mm": d.h_mm, "d_eff_mm": round(d_mm, 1),
                     "d_eff_is_override": d.effective_depth_override_mm is not None,
                     "slab_thickness_mm": d.slab_thickness_mm, "I_m4": I_m4, "EI_kNm2": round(EI, 1),
                     "cover_mm": round(cover_used, 1)},
        "materials": {"fck": d.fck, "fyk": d.fyk, "Ecm": d.Ecm_Nmm2},
        "fem": {"theta_rad": [float(t) for t in theta],
                "end_moments": [[round(float(m[0]), 3), round(float(m[1]), 3)] for m in end_moments]},
        "moments": {"support_hogging": {k: round(v, 3) for k, v in support_moments.items()},
                    "span_sagging": {k: round(v, 3) for k, v in span_moments.items()},
                    "max_hogging_kNm": round(max_hog, 3), "max_sagging_kNm": round(max_sag, 3),
                    "span_details": span_details},
        "beff_mm": {k: round(v, 1) for k, v in beff.items()},
        "flexure": {"supports": support_design, "spans": span_design, "As_min_mm2": round(As_min, 1)},
        "shear": {"per_span_VEd_kN": shear, "per_span_ends": shear_ends,
                  "max_VEd_kN": round(max_VEd, 3),
                  "VRdc_kN": round(VRdc, 3), "VRd_max_kN": round(VRd_max, 3),
                  "status": "OK" if shear_ok else "Links required",
                  "C_Rdc": round(C_Rdc, 3), "k_factor": round(k_sh, 3), "rho_l": round(rho_l, 5),
                  "v_min_mpa": round(v_min, 3),
                  "links_ok": bool(links_ok_all), "crush_ok": bool(crush_ok_all),
                  "design": shear_design,
                  "fywd_MPa": round(fywd, 1), "z_mm": round(z_sh, 1),
                  "cot_theta": cot_theta, "Asw_mm2": round(Asw_link, 1),
                  "s_max_ec2_mm": round(s_max_ec2, 1), "s_min_ratio_mm": round(s_min_ratio, 1)},
        "deflection": {"governing_span": gov_span_label, "actual_Ld": round(actual_Ld, 2),
                       "allowable_Ld": round(allowable_Ld, 2), "K_sys": K_sys, "F3": round(F3, 3),
                       "base_status": deflection_base_status, "enhanced": deflection_enhanced,
                       "status": "OK" if defl_ok else "NOT OK",
                       "ld_basic": round(ld_basic, 2), "rho": round(rho, 5), "rho0": round(rho0, 5),
                       "ld_eq": round(ld_eq, 2), "F1": F1_defl, "cap_40K": round(defl_cap, 1),
                       "spans": [{"span": x["span"], "K": x["K"], "actual_Ld": round(x["actual"], 2),
                                  "allowable_Ld": round(x["allowable"], 2), "F1": x["F1"], "F3": round(x["F3"], 3),
                                  "capped": x["capped"], "status": "OK" if x["ok"] else "NOT OK"}
                                 for x in defl_spans]},
        "checks": checks,
        "report": report,
    }