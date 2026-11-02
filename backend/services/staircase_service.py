# backend/services/staircase_service.py
# Staircase element: runs engine/staircase_engine.py and builds the response
# and the calculation report (same row shape and front matter as the slab and
# beam reports).
import math

from engine.staircase_engine import StaircaseInput, design_staircase, F3_CAP
from engine.staircase_detailing import detail_staircase
from models.staircase_schemas import StaircaseRequest
from services.report_front_matter import (
    front_matter, row as _fm_row, ndp_partial_factors, ndp_min_steel, ndp_shear_no_links,
)


def _r(x, n=3):
    return None if x is None else round(x, n)


def calculate_staircase(request: StaircaseRequest) -> dict:
    inp = StaircaseInput(**request.model_dump(exclude={"member_id", "design_basis", "width_mm",
                                                       "support_width_mm", "n_members"}))
    res = design_staircase(inp)
    det = detail_staircase(inp, res, width_mm=request.width_mm,
                           support_width_mm=request.support_width_mm, n_members=request.n_members)
    if det["status"] != "OK":
        res["overall_status"] = "FAIL"
    fr, ld = res["frame"], res["loads"]
    b, t, dist, defl, sh = res["bottom"], res["top"], res["dist"], res["deflection"], res["shear"]

    checks = [
        {"check": "Bottom steel (span)", "ratio": max(b["As_req"] or 0, b["As_min"]) / b["As_prov"], "status": b["status"]},
    ]
    if t:
        checks.append({"check": "Top steel at B (hogging)", "ratio": max(t["As_req"] or 0, t["As_min"]) / t["As_prov"],
                       "status": t["status"]})
    checks += [
        {"check": "Distribution steel", "ratio": dist["As_req"] / dist["As_prov"], "status": dist["status"]},
        {"check": "Deflection (span/depth)", "ratio": defl["ratio"], "status": defl["status"]},
        {"check": "Shear (no links)", "ratio": sh["ratio"], "status": sh["status"]},
        {"check": "Anchorage at C (detailing)",
         "ratio": det["anchorage_C"]["lbd_mm"] / det["anchorage_C"]["available_mm"],
         "status": det["anchorage_C"]["status"]},
    ]
    for c in checks:
        c["ratio"] = _r(c["ratio"])
    overall = res["overall_status"]

    report = _front_matter(request, res, checks) + _build_report(request, res, checks, det)

    return {
        "status": overall,
        "member_id": request.member_id,
        "geometry": {
            "n_risers": inp.n_risers, "n_treads": ld["n_treads"], "riser_mm": inp.riser_mm,
            "going_mm": inp.going_mm, "rise_m": _r(ld["rise_m"]), "going_m": _r(ld["going_m"]),
            "alpha_deg": _r(ld["alpha_deg"], 2), "frame_slope_deg": _r(math.degrees(math.atan2(fr.Hf, fr.L1)), 2),
            "flight_span_m": _r(fr.L1), "landing_m": _r(fr.L2), "sloping_length_m": _r(fr.Ls),
            "thickness_mm": inp.thickness_mm, "cover_mm": inp.cover_mm,
        },
        "materials": {"fck": inp.fck, "fyk": inp.fyk},
        "loads": {k: _r(v) for k, v in ld.items() if k != "n_treads"},
        "analysis": {
            "H_kN": _r(fr.H), "VA_kN": _r(fr.VA), "VC_kN": _r(fr.VC),
            "M_sag_kNm": _r(res["M_sag"]), "x_sag_m": _r(b["x"]), "M_B_kNm": _r(res["M_B"]),
            "M_hog_kNm": _r(res["M_hog"]),
            "diagram": [{"x": _r(p["x"], 4), "y": _r(p["y"], 4), "M": _r(p["M"]), "V": _r(p["V"]),
                         "N": _r(p["N"]), "member": p["member"]} for p in res["points"]],
        },
        "bottom": _clean(b), "top": _clean(t) if t else None,
        "distribution": _clean(dist), "deflection": _clean(defl), "shear": _clean(sh),
        "checks": checks,
        "utilisation": {"governing": max(c["ratio"] for c in checks)},
        "warnings": res["warnings"],
        "detailing": _clean_detailing(det),
        "report": report,
    }


def _clean_detailing(det):
    def rnd(v):
        if isinstance(v, float):
            return round(v, 3)
        if isinstance(v, dict):
            return {k: rnd(x) for k, x in v.items()}
        if isinstance(v, list):
            return [rnd(x) for x in v]
        return v
    return rnd(det)


def _clean(d):
    out = {}
    for k, v in d.items():
        if isinstance(v, float):
            out[k] = None if math.isinf(v) else round(v, 4)
        else:
            out[k] = v
    return out


def _front_matter(request, res, checks):
    fr = res["frame"]
    return front_matter(
        member=request.member_id, member_label=request.member_id or "not entered",
        design=(f"Staircase flight + landing, {request.n_risers} risers x {request.riser_mm:.0f} mm, "
                f"going {request.going_mm:.0f} mm, flight span {fr.L1:.3f} m + landing {fr.L2:.3f} m, "
                f"waist/landing h = {request.thickness_mm:.0f} mm, per metre width."),
        design_tag="staircase",
        checks=[(c["check"], c["ratio"], "PASS" if c["status"] == "OK" else "FAIL") for c in checks],
        design_basis=request.design_basis or _Blank(),
        module="staircase",
        used_for=("loading, analysis of the flight and landing as a bent frame pinned at both ends, "
                  "bottom and top steel, distribution steel, deflection by span/depth ratio and "
                  "shear without shear reinforcement, for a 1 m width."),
        basis_of_design=("Structville, Structural Analysis and Design of Residential Buildings "
                         "(Ubani), section 5.4. Flight and landing as one frame pinned at the top of "
                         "the flight (A) and the end of the landing (C), solved by the force method "
                         "(constant EI, flexural deformation). Flexure by the K-method, minimum steel "
                         "by Cl. 9.2.1.1, deflection by Cl. 7.4.2, shear by Cl. 6.2.2(1) with the "
                         "frame's axial force."),
        load_path=("Both supports are taken as pins that resist the horizontal thrust H of section 4. "
                   "If a support cannot resist H (for example a landing simply resting on a wall), "
                   "the frame model does not apply. The supporting beams or walls are not designed here."),
        loading=("1.35 Gk + 1.5 Qk on the whole stair (Eq. 6.10), one load case; no pattern loading. "
                 "Flight load along the sloping length, landing load on its length, both vertical."),
        not_assessed=("curtailment, anchorage and laps (book 9.9); the bar bending schedule (book "
                      "10.6); crack control; fire resistance; cover for exposure; vibration; "
                      "the supporting beams and walls; the other flight of the stair."),
        verification=[
            ("Verification, analysis",
             "With the book's thrust H = 38.461 kN entered, the frame statics reproduce the book's "
             "reactions 44.137/10.017 kN, M_B 3.362 kNm, axial 55.640/35.293 kN and shears "
             "18.206/15.910/4.414/10.017 kN. The exact force-method thrust was checked against an "
             "independent stiffness-method frame solution (2 November 2026).", "recorded"),
        ],
        ndp_rows=ndp_partial_factors() + [
            _fm_row("EN 1992-1-1 Cl. 3.1.6(1)P",
                    "alpha_cc = 0.85 built into the K-method (z = d[0.5 + sqrt(0.25 - 0.882K)], "
                    "A_s = M/(0.87 f_yk z)), as in the book.", "fixed in software"),
            _fm_row("EN 1992-1-1 Cl. 4.4.1",
                    f"Cover used as entered (c = {request.cover_mm:.0f} mm), d = h - c - phi/2, as in the "
                    "book. Cover for exposure and fire is NOT checked here.", "engineer to check"),
            ndp_min_steel(), ndp_shear_no_links(),
            _fm_row("EN 1992-1-1 Cl. 7.4.2",
                    f"K = 1.0 (book), rho = A_s,prov/(b d) (book), Eq. 7.16a/b, then x 310/sigma_s = "
                    f"500 A_s,prov/(f_yk A_s,req) capped at {F3_CAP} (UK NA; the book takes 2.0).",
                    "EN text"),
        ],
    )


class _Blank:
    pass


def _build_report(request, res, checks, det):
    R = lambda ref, calc, out="": {"reference": ref, "calculation": calc, "output": out}
    fr, ld = res["frame"], res["loads"]
    b, t, dist, defl, sh = res["bottom"], res["top"], res["dist"], res["deflection"], res["shear"]
    h = request.thickness_mm
    sec = []

    sec.append({"title": "1. Geometry", "rows": [
        R("Book 5.4", f"{request.n_risers} risers x {request.riser_mm:.0f} mm = {ld['rise_m']:.3f} m; "
                      f"{ld['n_treads']} treads x {request.going_mm:.0f} mm = {ld['going_m']:.3f} m", ""),
        R("Inclination", f"alpha = atan({ld['rise_m']:.3f}/{ld['going_m']:.3f})", f"alpha = {ld['alpha_deg']:.2f} deg"),
        R("Analysis model", f"A (0, {fr.Hf:.3f}) pinned, B ({fr.L1:.3f}, 0), C ({fr.L:.3f}, 0) pinned; "
                            f"sloping length AB = sqrt({fr.L1:.3f}^2 + {fr.Hf:.3f}^2)",
          f"L_AB = {fr.Ls:.3f} m, L_BC = {fr.L2:.3f} m"),
        R("Section", f"b = 1000 mm, h = {h:.0f} mm (waist and landing), cover c = {request.cover_mm:.0f} mm",
          f"fck = {request.fck:.0f}, fyk = {request.fyk:.0f} N/mm2"),
    ]})

    sec.append({"title": "2. Loading (book 5.4.1)", "rows": [
        R("Waist", f"{h / 1000:.3f} x 25 = {ld['g_waist']:.3f} kN/m2 along the slope, vertical. Not "
                   f"multiplied by cos(alpha): the book's {ld['g_waist']:.3f} x cos {ld['alpha_deg']:.2f} = "
                   f"{ld['g_waist_book']:.3f} understates the self-weight", f"{ld['g_waist']:.3f} kN/m2"),
        R("Steps", f"1/2 x {request.riser_mm / 1000:.3f} x 25", f"{ld['g_steps']:.3f} kN/m2"),
        R("Finishes", "as entered", f"{ld['finishes']:.3f} kN/m2"),
        R("Flight gk", f"{ld['g_waist']:.3f} + {ld['g_steps']:.3f} + {ld['finishes']:.3f}", f"gk = {ld['gk_flight']:.3f} kN/m2"),
        R("Landing gk", f"{h / 1000:.3f} x 25 + {ld['finishes']:.3f}", f"gk = {ld['gk_landing']:.3f} kN/m2"),
        R("Variable", "EN 1991-1-1 Table 6.2 (stairs 2 to 4 kN/m2)", f"qk = {ld['qk']:.3f} kN/m2"),
        R("EN 1990 Eq. 6.10", f"flight n = 1.35 x {ld['gk_flight']:.3f} + 1.5 x {ld['qk']:.3f}", f"{ld['n_flight']:.3f} kN/m"),
        R("EN 1990 Eq. 6.10", f"landing n = 1.35 x {ld['gk_landing']:.3f} + 1.5 x {ld['qk']:.3f}", f"{ld['n_landing']:.3f} kN/m"),
    ]})

    sec.append({"title": "3. Analysis (force method)", "rows": [
        R("Primary structure", f"pin A, roller C: W_AB = {ld['n_flight']:.3f} x {fr.Ls:.3f} = {fr.W1:.3f} kN, "
                               f"W_BC = {ld['n_landing']:.3f} x {fr.L2:.3f} = {fr.W2:.3f} kN",
          f"VA0 = {fr.VA0:.3f}, VC0 = {fr.VC0:.3f} kN"),
        R("Redundant", "horizontal reaction pair H (tension +); m1 = Hf x/L - Hf x/L1 on AB, Hf x/L - Hf on BC",
          ""),
        R("Compatibility", f"delta10 = int M0 m1 ds/EI = {fr.d10:.4f}, delta11 = int m1^2 ds/EI = {fr.d11:.4f} (x EI)",
          f"H = -delta10/delta11 = {fr.H:.3f} kN"),
        R("Reactions", f"VA = VA0 + H Hf/L, VC = VC0 - H Hf/L",
          f"VA = {fr.VA:.3f}, VC = {fr.VC:.3f}, H = {fr.H:.3f} kN"),
        R("Moments", f"max sagging at x = {b['x']:.3f} m ({b['member']}); at B; max hogging",
          f"M_sag = {res['M_sag']:.3f}, M_B = {res['M_B']:.3f}, M_hog = {res['M_hog']:.3f} kNm"),
        R("Note on the book", "the book prints H = 38.461 kN and M_Ed = 14.169 kNm for its loads. No elastic "
                              "solution of the drawn frame gives that H (the exact value for the book's own loads "
                              "is 64.980 kN, confirmed by a stiffness solution), so the exact solution is used.",
          "exact"),
    ] + [R("Warning", w, "check support") for w in res["warnings"]]})

    def flex_rows(f, label, face):
        rows = [
            R(f"{label}: design moment", f"{face}", f"M_Ed = {f['M']:.3f} kNm"),
            R("Effective depth", f"d = h - c - phi/2 = {h:.0f} - {request.cover_mm:.0f} - {f['bar']:.0f}/2", f"d = {f['d_mm']:.0f} mm"),
            R("Book 5.4.2", f"K = M/(fck b d^2) = {f['M']:.3f}e6/({request.fck:.0f} x 1000 x {f['d_mm']:.0f}^2)",
              f"K = {f['K']:.4f}" + (" > 0.167 NOT OK" if f["status"] == "NOT OK" and f["z_mm"] is None else " < 0.167")),
        ]
        if f["z_mm"] is not None:
            rows += [
                R("Lever arm", "z = d[0.5 + sqrt(0.25 - 0.882K)] <= 0.95d", f"z = {f['z_mm']:.1f} mm"),
                R("Steel", f"As = M/(0.87 fyk z) = {f['M']:.3f}e6/(0.87 x {request.fyk:.0f} x {f['z_mm']:.1f})",
                  f"As,req = {f['As_req']:.1f} mm2/m"),
            ]
        rows += [
            R("Book / EC2 9.2.1.1", f"fctm = 0.3 fck^(2/3) = {0.3 * request.fck ** (2 / 3):.4f}; As,min = max(0.26 fctm/fyk b d, 0.0013 b d)",
              f"As,min = {f['As_min']:.1f} mm2/m"),
            R("Provided", f"Y{f['bar']:.0f} @ {f['spacing']:.0f} mm c/c; s_max = min(2h, 250) = {res['s_max_main']:.0f} (EC2 9.3.1.1(3))",
              f"As,prov = {f['As_prov']:.0f} mm2/m {f['status']}"),
        ]
        return rows

    sec.append({"title": "4. Flexural Design (book 5.4.2)", "rows":
                flex_rows(b, "Span (bottom)", f"max sagging, at x = {b['x']:.3f} m on the {b['member']}")
                + (flex_rows(t, "Top steel at B", f"max hogging, at x = {t['x']:.3f} m (flight/landing junction); "
                             "the book's frame shows no hogging, the exact solution does") if t else
                   [R("Top steel", "no hogging moment anywhere", "not required")])
                + [R("EC2 9.3.1.1(2)", f"distribution >= 20% of main = 0.2 x {b['As_prov']:.0f} = {dist['As_req']:.1f}; "
                                       f"s <= min(3h, 400) = {dist['s_max']:.0f}",
                     f"Y{dist['bar']:.0f} @ {dist['spacing']:.0f} ({dist['As_prov']:.0f} mm2/m) {dist['status']}")]})

    sec.append({"title": "5. Deflection (book 5.4.2)", "rows": [
        R("Book", f"K = 1.0; rho = As,prov/(b d) = {b['As_prov']:.0f}/(1000 x {b['d_mm']:.0f}); rho0 = sqrt(fck) x 1e-3",
          f"rho = {defl['rho']:.6f}, rho0 = {defl['rho0']:.4f}"),
        R(f"EC2 Eq. {defl['branch']}", ("L/d = K[11 + 1.5 sqrt(fck) rho0/rho + 3.2 sqrt(fck)(rho0/rho - 1)^1.5]"
                                        if defl["branch"] == "7.16a" else "L/d = K[11 + 1.5 sqrt(fck) rho0/rho]"),
          f"basic L/d = {defl['basic']:.3f}"),
        R("EC2 7.4.2(2)", f"sigma_s = 310 fyk As,req/(500 As,prov) = {defl['sigma_s']:.3f} N/mm2; "
                          f"310/sigma_s = {defl['F3_raw']:.3f}" if defl["F3_raw"] is not None and not math.isinf(defl["F3_raw"])
          else "As,req = 0", f"factor = {defl['F3']:.3f} (cap {F3_CAP}; book 2.0)"),
        R("Allowable", f"{defl['basic']:.3f} x {defl['F3']:.3f}", f"{defl['allowable']:.3f}"),
        R("Actual", f"L/d = {defl['L_mm']:.0f}/{b['d_mm']:.0f} (L = horizontal distance between supports, book)",
          f"{defl['actual']:.3f} {defl['status']}"),
    ]})

    sec.append({"title": "6. Shear (book 5.4.2)", "rows": [
        R("Governing section", f"x = {sh['x']:.3f} m on the {sh['member']} (largest V_Ed/V_Rd,c over both members)",
          f"V_Ed = {sh['VEd']:.3f} kN, N_Ed = {sh['NEd']:.3f} kN ({'tension' if sh['NEd'] >= 0 else 'compression'})"),
        R("EC2 6.2.2(1)", f"k = 1 + sqrt(200/{sh['d_mm']:.0f}) = {sh['k_raw']:.4f} <= 2.0; rho_l = {sh['As']:.0f}/(1000 x {sh['d_mm']:.0f}) "
                          f"({sh['face']} steel)", f"k = {sh['k']:.3f}, rho_l = {sh['rho']:.6f}"),
        R("Axial stress", f"sigma_cp = N/Ac = {-sh['NEd']:.3f}e3/(1000 x {h:.0f}) (compression +), k1 = 0.15",
          f"sigma_cp = {sh['sigma_cp']:.4f} N/mm2"),
        R("Resistance", f"[0.12 k (100 rho fck)^(1/3) = {sh['v_main']:.4f}; v_min = 0.035 k^1.5 fck^0.5 = {sh['vmin']:.4f}] + k1 sigma_cp, x b d",
          f"V_Rd,c = {sh['VRdc_kN']:.3f} kN"),
        R("Check", f"V_Ed / V_Rd,c = {sh['VEd']:.3f}/{sh['VRdc_kN']:.3f}", f"{sh['ratio']:.3f} {sh['status']}"),
        R("Note on the book", "the book's V_Rd,c = 82.326 kN (and V_Ed 35.358 kN) cannot be reproduced from its "
                              "stated formula and inputs; the formula is applied as written.", ""),
    ]})

    sec.append({"title": "7. Summary", "rows": [
        R(c["check"], f"ratio {c['ratio']:.3f}", c["status"]) for c in checks
    ] + [R("Overall", "all checks", res["overall_status"])]})

    sec.append(_detailing_section(request, det))
    return sec


def _detailing_section(request, det):
    """Book 9.9 (Fig. 9.20, Section 2-2) and 10.6."""
    R = lambda ref, calc, out="": {"reference": ref, "calculation": calc, "output": out}
    a, lm = det["anchorage_C"], det["lbd_main"]
    rows = [
        R("Book 9.9", "staircase detailing follows the simplified slab rules (Fig. 9.9: top bars 0.2L at an end "
                      "support, 0.3L for hogging; 9.2 shift rule a_l = d). Bar marks follow the book's Section 2-2 "
                      "(book marks 05-10 -> 01-06).", ""),
        R("Geometry", f"width W = {det['width_mm']:.0f} mm; flight slope theta = {det['theta_deg']:.2f} deg; "
                      f"sloping length A-B = {det['sloping_length_mm']:.0f} mm; landing run into C = L2 + t/2 - c = "
                      f"{det['landing_run_mm']:.0f} mm (support t = {det['support_width_mm']:.0f} mm)", ""),
        R("Anchorage, book 9.1.2", f"main bars Y{request.main_bar_mm:.0f}, sigma = f_yd: l_b,rqd = "
                                   f"{lm['lb_rqd_mm']:.0f} mm, alpha2 = {lm['alpha2']:.3f} (c_d = {lm['cd_mm']:.0f}), "
                                   f"l_bd = {lm['lbd_mm']:.0f} mm",
          f"leg into the floor slab = max(500, l_bd) = {det['leg_slab_mm']:.0f} mm"),
        R("Knee crossing (book mark 06)", f"landing top bar runs past B to the flight soffit: (h - 2c)/tan(theta) = "
                                          f"{det['x_cross_mm']:.0f} mm", ""),
        R("Hogging zone at B (book 9.2)", f"along the flight {det['hog_flight_mm']:.0f} mm, along the landing "
                                          f"{det['hog_landing_mm']:.0f} mm; bar 03 legs cover zone + d", ""),
        R("Anchorage at C, book 9.1.4 Eq. 9.4", f"F_E = |V_Ed| a_l/z + N_Ed = {a['VEd_kN']:.3f} x {a['a_l_mm']:.0f}/"
                                                f"{a['z_mm']:.1f} + {a['NEd_kN']:.3f} = {a['FE_kN']:.3f} kN/m "
                                                f"(a_l = d, z = 0.9d, N_Ed = landing tension H)",
          f"sigma = F_E/A_s,prov = {a['sigma_MPa']:.1f} N/mm2"),
        R("", f"f_bd = {a['fbd_MPa']:.3f} N/mm2; l_b,rqd = {a['lb_rqd_mm']:.0f} mm; alpha2 = {a['alpha2']:.3f}; "
              f"l_b,min = {a['lb_min_mm']:.0f} mm; l_bd = {a['lbd_mm']:.0f} mm vs t - c = {a['available_mm']:.0f} mm",
          a["status"]),
        R("Bar callouts", "number-size-mark-spacing-layer (book Fig. 9.20)", ", ".join(det["callouts"])),
        R("Bar schedule (book 10.6)", "cut length = sum of the shape dimensions (no bend deduction); bars across "
                                      f"the width = floor((W - 2c)/s) + 1; {request.n_members} identical staircase(s)",
          "see schedule"),
    ]
    for r in det["schedule"]:
        dims = ", ".join(f"{k} = {v}" for k, v in r["dims_mm"].items())
        rows.append(R(f"Mark {r['mark']} (book {r['book_mark']})",
                      f"{r['n_bars']} No. {r['type_size']} x {r['n_members']} ({dims}): {r['description']}",
                      f"{r['length_m']:.3f} m, total {r['total_length_m']:.2f} m, {r['mass_kg']:.2f} kg"))
    for e in det["summary"]["by_diameter"]:
        rows.append(R(f"Total {e['type_size']}", f"{e['total_length_m']:.2f} m x {e['unit_mass_kg_m']:.3f} kg/m",
                      f"{e['mass_kg']:.2f} kg ({e['tonnes']:.4f} t), {e['pieces_12m']} pcs of 12 m"))
    rows.append(R("Total reinforcement", "all marks", f"{det['summary']['total_mass_kg']:.2f} kg"))
    return {"title": "8. Detailing and Bar Bending Schedule (book 9.9, 10.6)", "rows": rows}
