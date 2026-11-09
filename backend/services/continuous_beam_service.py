# backend/services/continuous_beam_service.py
#
# FEM-backed continuous beam service. Reads the live ContinuousBeamRequest,
# runs the validated stiffness-analysis engine (beam_cont_engine), and returns
# the live ContinuousBeamResult shape so ContinuousBeamResults.jsx renders
# unchanged. Replaces the previous coefficient-method service.
import re
import math
from models.continuous_beam_schemas import (
    ContinuousBeamRequest, ContinuousBeamResult, CBSummary, CBMaterialsOut,
    CBLoadSummary, CBSpanResult, CBSupportResult, CBForces, CBCapacity, CBSLS,
    CBReaction, ReportRow, ReportSection,
)
from engine.beam_cont_engine import ContinuousBeamInput, design_continuous_beam
from services.beam_service import BEAM_COMMON_OUT
from services.report_front_matter import (
    front_matter, ndp_partial_factors, ndp_alpha_cc_k_method, ndp_cover_rows,
    ndp_min_steel, ndp_shear_no_links, ndp_deflection, row as _fm_row,
)

PI = math.pi

# EC2 Table 4.4N, c_min,dur (mm) for structural class S4 (50-year life);
# Table 4.3N: 100-year life -> +2 classes (S6) = +10 mm.
C_MIN_DUR_S4 = {"XC1": 15, "XC2": 25, "XC3": 25, "XC4": 30, "XD1": 35, "XD2": 40, "XD3": 45,
                "XS1": 35, "XS2": 40, "XS3": 45}


# EC2 Table 7.1N (recommended w_max, quasi-permanent) and Table 7.2N
# (max bar size, mm) for w = 0.4 / 0.3 / 0.2 mm; spacing from Table 7.3N.
W_MAX_7_1N = {"XC1": 0.4}                     # every other class: 0.3
PHI_MAX_7_2N = [(160, 40, 32, 25), (200, 32, 25, 16), (240, 20, 16, 12), (280, 16, 12, 8),
                (320, 12, 10, 6), (360, 10, 8, 5), (400, 8, 6, 4), (450, 6, 5, 0)]
PSI2_ASSUMED = 0.6                            # no occupancy on the beam page (EN 1990 Table A1.1, C/D/F)


def _phi_max_7_2N(sigma, col):
    rows = [(r[0], r[col]) for r in PHI_MAX_7_2N]
    if sigma <= rows[0][0]:
        return float(rows[0][1])
    for (s1, v1), (s2, v2) in zip(rows, rows[1:]):
        if sigma <= s2:
            return v1 + (v2 - v1) * (sigma - s1) / (s2 - s1)
    return 0.0


def _crack_check(request, r, fl, span_gk, span_qk, link):
    """EC2 7.3.3 without direct calculation: sigma_s under quasi-permanent
    loads; OK if the bar size meets Table 7.2N or the spacing Table 7.3N.
    Returns (rows, status, ratio, w_lim)."""
    from services.continuous_slab_service import _s_max_7_3N
    exp = _enum(request.design_params.exposure_class)
    w_lim = W_MAX_7_1N.get(exp, 0.3)
    col = 1 if w_lim >= 0.4 else 2 if w_lim >= 0.3 else 3
    g = request.geometry
    qp = [(gk + PSI2_ASSUMED * qk) / (1.35 * gk + 1.5 * qk) if (gk + qk) else 0.0
          for gk, qk in zip(span_gk, span_qk)]
    n = len(qp)
    secs = [(f"Span {i + 1}", fl["spans"].get(f"Span {i + 1}", {}), qp[i]) for i in range(n)]
    secs += [(f"S{j + 1}", fl["supports"][f"S{j + 1}"],
              max(qp[k] for k in (j - 1, j) if 0 <= k < n)) for j in range(n + 1) if f"S{j + 1}" in fl["supports"]]
    rows = [{"ref": "EC2 Table 7.1N", "calc": f"exposure {exp}: w_max = {w_lim} mm; quasi-permanent psi_2 = {PSI2_ASSUMED} "
                                              "assumed (no occupancy given; EN 1990 Table A1.1)", "out": f"w_max = {w_lim} mm"}]
    ok_all, worst = True, 0.0
    for label, sd, q in secs:
        M, As, z, bars = sd.get("M_kNm", 0) or 0, sd.get("As_provided_mm2", 0), sd.get("z_mm") or 0, sd.get("bars", "")
        if M <= 0 or not As or not z or "Y" not in bars:
            continue
        nb, phi = int(bars.split("Y")[0]), float(bars.split("Y")[1])
        sigma = M * q * 1e6 / (z * As)
        s = (g.width - 2 * (g.cover + link) - phi) / (nb - 1) if nb > 1 else g.width
        phi_max, s_max = _phi_max_7_2N(sigma, col), _s_max_7_3N(sigma, col)
        ratio = min(phi / phi_max if phi_max else 9.99, s / s_max if s_max else 9.99)
        ok = ratio <= 1.0 + 1e-6
        ok_all, worst = ok_all and ok, max(worst, ratio)
        rows.append({"ref": f"EC2 7.3.3 -- {label}",
                     "calc": f"sigma_s = M qp/(z As) = {M:.1f} x {q:.3f} x 10^6/({z:.0f} x {As:.0f}) = {sigma:.0f} MPa; "
                             f"{bars}: phi {phi:.0f} vs phi_max {phi_max:.1f} (Table 7.2N); s = {s:.0f} vs s_max {s_max:.0f} mm (Table 7.3N)",
                     "out": f"{'OK' if ok else 'NOT OK'} ({ratio:.2f})"})
    return rows, "PASS" if ok_all else "FAIL", worst, w_lim


def _cover_check(request, link, bars):
    """EC2 4.4.1 for the exposure class and design working life entered.
    The entered cover is to the links; the engine adds delta_c_dev = 5 mm,
    so the check is c >= c_min (Eq. 4.2) for the links and c + link >= c_min
    for the main bars. Returns (report rows, status, ratio)."""
    dp = request.design_params
    exp = _enum(dp.exposure_class)
    life = int(dp.design_working_life or 50)
    c_dur = C_MIN_DUR_S4.get(exp, 25) + (10 if life >= 100 else 0)
    phi_max = max((int(b.split("Y")[1]) for b in bars if "Y" in b), default=16)
    c = request.geometry.cover
    need_link = max(link, c_dur, 10)
    need_main = max(phi_max, c_dur, 10)
    ok = c >= need_link - 1e-6 and c + link >= need_main - 1e-6
    ratio = max(need_link / c if c else 9.99, need_main / (c + link))
    rows = [
        {"ref": "EC2 Table 4.3N, 4.4N", "calc": f"exposure {exp}, design working life {life} years -> structural class "
                                                f"{'S6 (S4 + 2)' if life >= 100 else 'S4'}", "out": f"c_min,dur = {c_dur} mm"},
        {"ref": "EC2 Eq. 4.2 (links)", "calc": f"c_min = max(c_min,b = link {link:.0f}; c_min,dur {c_dur}; 10) vs cover to links c = {c:.0f}",
         "out": f"{need_link:.0f} mm {'OK' if c >= need_link - 1e-6 else 'NOT OK'}"},
        {"ref": "EC2 Eq. 4.2 (main bars)", "calc": f"c_min = max(c_min,b = bar {phi_max}; c_min,dur {c_dur}; 10) vs c + link = {c + link:.0f}",
         "out": f"{need_main:.0f} mm {'OK' if c + link >= need_main - 1e-6 else 'NOT OK'}"},
        {"ref": "EC2 4.4.1.3", "calc": "c_nom = c + delta_c_dev (5 mm, added by the engine)", "out": f"c_nom = {c + 5:.0f} mm"},
    ]
    return rows, "PASS" if ok else "FAIL", ratio

# Fallback bar diameters if the request doesn't carry a bar_diameters field
# yet (ContinuousBeamRequest may not expose one -- see note at bottom of file).
DEFAULT_BAR_DIAMETERS = [16, 20, 25, 32]


def _enum(v):
    return v.value if hasattr(v, "value") else v


def parse_fck(g):
    try:
        return float(str(g).replace("C", "").split("/")[0])
    except Exception:
        return 25.0


def parse_fy(g):
    m = re.search(r"(\d+)", str(g))
    return float(m.group(1)) if m else 500.0


def _front_matter(request, n, lengths, b, h, checks):
    """
    REPORT IDENTIFICATION, 0. DESIGN BASIS AND SCOPE and 0b. NATIONALLY
    DETERMINED PARAMETERS USED, laid out as in the column report (see
    report_front_matter.py), stating what beam_cont_engine actually does.
    """
    return front_matter(
        member=request.beam_id, member_label=request.beam_id,
        design=(f"Continuous beam, {n} spans ({', '.join(f'{L / 1000:.2f}' for L in lengths)} m), "
                f"{b:.0f} x {h:.0f} mm, T-beam in the spans, rectangular at the supports."),
        design_tag="continuous",
        checks=checks, design_basis=request.design_basis, module="continuous beam",
        used_for=("moments and shears by stiffness analysis, span and support reinforcement, "
                  "minimum steel, shear links with the strut crushing check, and deflection by "
                  "span/depth ratio, for one beam."),
        basis_of_design=("Uniformly distributed load on each span. Linear elastic analysis by the "
                         "direct stiffness method with no redistribution (section 4). Span flexure "
                         "by the K-method on b_eff, support flexure on the web (Cl. 5.3.2.1, 6.1), "
                         "minimum steel by Cl. 9.2.1.1, shear by Cl. 6.2.2 and links by Cl. 6.2.3 "
                         "with cot theta = 2.5 and V_Rd,max, deflection by span/effective depth on "
                         "the longest span (Cl. 7.4.2)."),
        load_path=("Load from the slab and walls is entered as a uniform line load on each span. "
                   "The supports are taken as rigid and do not settle. The supporting columns or "
                   "walls are not designed here. Lateral stability is not assessed."),
        loading=("One load case: 1.35 Gk + 1.5 Qk on every span at once (Eq. 6.10). Pattern "
                 "loading (Cl. 5.1.3) is not applied, so sagging in a span next to a lightly loaded "
                 "one, and some support moments, can be underestimated. Uniform loads only."),
        not_assessed=("pattern loading; direct crack-width calculation (EC2 7.3.4) -- crack control "
                      "is by Tables 7.2N / 7.3N, section 10c; " + BEAM_COMMON_OUT + "."),
        verification=[("Verification",
                       "No comparison with a published worked example is recorded for this module. "
                       "Hand-check the moments, which come without pattern loading, before use.",
                       "not recorded")],
        ndp_rows=ndp_partial_factors()
                 + [ndp_alpha_cc_k_method(" The f_cd = f_ck/1.5 printed in section 2 (alpha_cc = 1.0) "
                                          "is used only for V_Rd,max; the UK NA gives 0.85 for "
                                          "flexure and axial load and 1.0 for other phenomena.")]
                 + ndp_cover_rows("Cover to links checked against the exposure class and design working "
                                  "life entered (Table 4.4N, S4; S6 for 100 years), section 10b.")
                 + [ndp_min_steel(), ndp_shear_no_links(),
                    _fm_row("EN 1992-1-1 Cl. 6.2.3, 9.2.2",
                            "Links: cot theta = 2.5, z = 0.9d, f_ywd = f_yk/1.15, nu_1 = "
                            "0.6(1 - f_ck/250), alpha_cw = 1.0. rho_w,min = 0.08 sqrt(f_ck)/f_yk "
                            "(Cl. 9.2.2(5)). s_l,max = 0.75d, capped at 300 mm by the software "
                            "(Cl. 9.2.2(6)). Recommended values; the UK NA value was not checked here.",
                            "EN text"),
                    ndp_deflection(),
                    _fm_row("EN 1992-1-1 Cl. 5.1.3(1)P",
                            "Load arrangements are not applied: one arrangement, all spans loaded.",
                            "not applied")],
    )


def calculate_continuous_beam(request: ContinuousBeamRequest) -> ContinuousBeamResult:
    """Main bar: the one given (bar_diameters[0]) or, with auto_bars, the
    passing standard size with the least steel over all spans and supports."""
    from services import bar_selection

    def steel(r):
        return (sum(s.bottom_steel.get("area_provided", 0) * s.length / 1000 for s in r.spans)
                + sum(s.top_steel.get("area_provided", 0) for s in r.supports if s.m_hogging > 0))
    def fits(r):
        bad = [bar_selection.bars_fit(x.get("label", ""), request.geometry.width, request.geometry.cover,
                                      request.link_diameter or 8)
               for x in [s.bottom_steel for s in r.spans] + [s.top_steel for s in r.supports if s.m_hogging > 0]]
        bad = [note for ok, note in bad if not ok]
        return (not bad), "; ".join(bad[:2])
    return bar_selection.run(
        request, _calculate_continuous_beam, lambda dia: {"bar_diameters": [dia]}, [12, 16, 20, 25, 32],
        lambda r: r.summary.status, steel, "span A_s,prov x length + support A_s,prov (comparison only)",
        fits=fits)


def _calculate_continuous_beam(request: ContinuousBeamRequest) -> ContinuousBeamResult:
    code = _enum(request.design_code)
    is_bs = code == "BS8110"
    g = request.geometry
    n = g.n_spans
    lengths = list(g.span_lengths)[:n]
    while len(lengths) < n:
        lengths.append(lengths[-1] if lengths else 6000)

    fck = parse_fck(request.materials.concrete_grade)
    fy = parse_fy(request.materials.steel_grade)
    gc = request.materials.unit_weight_concrete
    b, h, cover = g.width, g.depth, g.cover
    link = request.link_diameter

    # Bar diameters: respect the user's preferred order (main bar first),
    # matching the slab engines' convention. ContinuousBeamRequest already
    # exposes bar_diameters (default [16,20,25,32]); the "or" here just
    # guards against an empty list ever being sent.
    bar_diameters = request.bar_diameters or DEFAULT_BAR_DIAMETERS

    gamma_g = 1.35 if not is_bs else 1.4
    gamma_q = 1.50 if not is_bs else 1.6
    combo = "1.35 Gk + 1.50 Qk (EN 1990)" if not is_bs else "1.4 Gk + 1.6 Qk (BS 8110)"

    self_w = (b / 1000.0) * (h / 1000.0) * gc if request.loads.self_weight_auto else 0.0

    def field(i, name):
        if request.span_loads:
            for s in request.span_loads:
                if s.index == i:
                    v = getattr(s, name)
                    if v is not None:
                        return v
        return getattr(request.loads, name)

    span_udls, span_service, span_gk, span_qk = [], [], [], []
    for i in range(n):
        gk = self_w + field(i, "wall_load") + field(i, "finishes") + field(i, "additional_dead_load")
        qk = field(i, "live_load") + field(i, "other_live_load")
        span_gk.append(gk); span_qk.append(qk)
        span_service.append(gk + qk)
        span_udls.append(gamma_g * gk + gamma_q * qk)

    eng_in = ContinuousBeamInput(
        spans_m=[L / 1000.0 for L in lengths],
        slab_areas_m2=[1.0] * n,
        bw_mm=b, h_mm=h, cover_mm=cover, link_dia_mm=link,
        assumed_main_bar_mm=20.0, fck=fck, fyk=fy,
        Ecm_Nmm2=(22000 * ((fck + 8) / 10) ** 0.3) if not is_bs else 24000.0,
        bar_diameters=bar_diameters,
        effective_depth_override_mm=g.effective_depth,
        span_loads_override=span_udls,
        fixed_ends=_enum(request.end_support) == "continuous",
    )
    r = design_continuous_beam(eng_in)

    # d_eff now always reflects what the engine actually used for every
    # calculation (flexure, shear, deflection) -- whether that's your
    # override or the cover/link/bar-derived default. Previously this was
    # computed separately here and only affected the displayed value while
    # the engine silently kept using its own depth regardless.
    d_eff = r["geometry"]["d_eff_mm"]

    sup_hog = r["moments"]["support_hogging"]
    span_sag = r["moments"]["span_sagging"]
    fl = r["flexure"]
    max_hog = r["moments"]["max_hogging_kNm"]
    max_sag = r["moments"]["max_sagging_kNm"]

    fcd = (fck / 1.5) if not is_bs else (0.45 * fck)
    fyd = (fy / 1.15) if not is_bs else (0.95 * fy)

    def steel_dict(sd, fallback_label="nominal 2T16"):
        if not sd:
            return {"label": fallback_label, "count": 2, "bar_diameter": 16,
                    "area_required": 0, "area_provided": round(2 * PI / 4 * 16 ** 2, 0),
                    "m_resistance": 0}
        As = sd.get("As_provided_mm2", 0)
        z = sd.get("z_mm", 0.9 * d_eff)
        m_rd = 0.87 * fy * As * z / 1e6
        bars = sd.get("bars", fallback_label)
        cnt = int(bars.split("Y")[0]) if "Y" in bars else 0
        dia = int(bars.split("Y")[1]) if "Y" in bars else 0
        return {"label": bars, "count": cnt, "bar_diameter": dia,
                "area_required": sd.get("As_req_mm2", 0), "area_provided": As,
                "m_resistance": round(m_rd, 2),
                "M_kNm": sd.get("M_kNm", 0), "K": sd.get("K", 0), "z_mm": z,
                "beff_mm": sd.get("beff_mm"), "as_min_mm2": fl.get("As_min_mm2", 0),
                "neutral_axis_in_flange": sd.get("neutral_axis_in_flange")}

    spans_out = []
    for i in range(n):
        sd = fl["spans"].get(f"Span {i + 1}", {})
        spans_out.append(CBSpanResult(
            index=i + 1, length=lengths[i], w_ultimate=round(span_udls[i], 2),
            w_service=round(span_service[i], 2), m_sagging=round(span_sag.get(f"Span {i + 1}", 0), 2),
            bottom_steel=steel_dict(sd)))

    per_span_V = r["shear"]["per_span_VEd_kN"]

    def support_shear(j):
        left = per_span_V.get(f"Span {j}", 0) if j >= 1 else 0
        right = per_span_V.get(f"Span {j + 1}", 0) if j < n else 0
        return max(left, right)

    max_shear = 0.0
    support_results = []
    for j in range(n + 1):
        key = f"S{j + 1}"
        mh = sup_hog.get(key, 0.0)
        sh = support_shear(j)
        max_shear = max(max_shear, sh)
        is_end = (j == 0 or j == n)
        label = "End Support" if is_end else ("First Interior" if (j == 1 or j == n - 1) else "Interior")
        sd = fl["supports"].get(key, {})
        top = steel_dict(sd) if mh > 0 else steel_dict(None)
        
        # Link design comes from the engine (EC2 Cl.6.2.3 + Cl.9.2.2).
        # A support lies between two spans, so the tighter spacing governs.
        eng_links = r["shear"].get("design", {})
        adjacent = [eng_links.get(f"Span {j}"), eng_links.get(f"Span {j + 1}")]
        adjacent = [a for a in adjacent if a]
        if adjacent:
            gov_link = min(adjacent, key=lambda a: a["spacing_mm"])
            spacing = gov_link["spacing_mm"]
            links_required = any(a["links_required"] for a in adjacent)
            link_status = "NOT OK" if any(a["status"] != "OK" for a in adjacent) else "OK"
            asw_s_req = max(a["Asw_s_required"] for a in adjacent)
            asw_s_prov = gov_link["Asw_s_provided"]
            governed_by = gov_link["governed_by"]
        else:
            spacing = int(min(0.75 * d_eff, 300) // 25 * 25)
            links_required = False
            link_status = "OK"
            asw_s_req = 0.0
            asw_s_prov = 0.0
            governed_by = "nominal"
        
        support_results.append(CBSupportResult(
            index=j, label=label, m_hogging=round(mh, 2), shear=round(sh, 2),
            top_steel=top, links={"bar_diameter": link, "spacing": spacing, "legs": 2,
                                  "label": f"\u00d8{link} @ {spacing} mm c/c",
                                  "required": bool(links_required),
                                  "status": link_status,
                                  "asw_s_required": round(asw_s_req, 4),
                                  "asw_s_provided": round(asw_s_prov, 4),
                                  "governed_by": governed_by}))

    total_load = sum(span_udls[i] * (lengths[i] / 1000.0) for i in range(n))
    reactions = []
    for j in range(n + 1):
        left = per_span_V.get(f"Span {j}", 0) if j >= 1 else 0
        right = per_span_V.get(f"Span {j + 1}", 0) if j < n else 0
        R = left + right
        reactions.append(CBReaction(
            index=j + 1, label=("End" if (j == 0 or j == n) else "Internal"),
            reaction=round(R, 2), percent=round(R / total_load * 100, 2) if total_load else 0))

    util_bend = 0.0
    for sd in list(fl["spans"].values()) + list(fl["supports"].values()):
        As = sd.get("As_provided_mm2", 0); z = sd.get("z_mm", 0.9 * d_eff)
        m_rd = 0.87 * fy * As * z / 1e6
        m = sd.get("M_kNm", 0)
        if m_rd:
            util_bend = max(util_bend, m / m_rd)
    
    # "status" only reports whether links are NEEDED, not whether the beam
    # is adequate. A beam with correctly designed links is safe; treating
    # "Links required" as a failure marked almost every real beam FAIL.
    no_links_needed = r["shear"].get("status", "OK") == "OK"
    links_ok = bool(r["shear"].get("links_ok", True))
    crush_ok = bool(r["shear"].get("crush_ok", True))
    shear_ok = links_ok and crush_ok

    eng_design = r["shear"].get("design", {})
    if no_links_needed:
        util_shear = round(max_shear / r["shear"].get("VRdc_kN", 1.0), 2) if r["shear"].get("VRdc_kN") else 0.0
    elif eng_design:
        # Utilisation of the links themselves, plus the crushing check.
        util_links = max((v["Asw_s_required"] / v["Asw_s_provided"])
                         for v in eng_design.values() if v["Asw_s_provided"]) \
            if any(v["Asw_s_provided"] for v in eng_design.values()) else 0.0
        util_crush = max_shear / r["shear"].get("VRd_max_kN", 1.0) if r["shear"].get("VRd_max_kN") else 0.0
        util_shear = round(max(util_links, util_crush), 2)
    else:
        util_shear = 0.0
    
    defl = r["deflection"]
    defl_status = "PASS" if defl["status"] == "OK" else "FAIL"
    
    # Overall status must be consistent with the engine
    bend_ok = util_bend <= 1.0
    all_bars = [sd.get("bars", "") for sd in list(fl["spans"].values()) + list(fl["supports"].values())]
    cover_rows, cover_status, cover_ratio = _cover_check(request, link, all_bars)
    crack_rows, crack_status, crack_ratio, crack_lim = _crack_check(request, r, fl, span_gk, span_qk, link)
    overall = "PASS" if (bend_ok and shear_ok and defl_status == "PASS" and cover_status == "PASS"
                         and crack_status == "PASS") else "FAIL"
    code_label = "BS 8110:1997" if is_bs else "EN 1992-1-1 (EC2)"

    shr = r["shear"]
    shear_detail = {
        "C_Rdc": shr.get("C_Rdc"), "k_factor": shr.get("k_factor"), "rho_l": shr.get("rho_l"),
        "v_min_mpa": shr.get("v_min_mpa"),
        "v_ed_mpa": round(max_shear * 1000 / (b * d_eff), 3) if (b * d_eff) else 0,
        "v_rdc_mpa": round(shr.get("VRdc_kN", 0) * 1000 / (b * d_eff), 3) if (b * d_eff) else 0,
        "links_required": not no_links_needed,
        "shear_status": shr.get("status", "OK"),
        "utilization": round(util_shear, 2),
        # link design, straight from the engine
        "VRdc_kN": shr.get("VRdc_kN"), "VRd_max_kN": shr.get("VRd_max_kN"),
        "z_mm": shr.get("z_mm"), "fywd_MPa": shr.get("fywd_MPa"),
        "cot_theta": shr.get("cot_theta"), "Asw_mm2": shr.get("Asw_mm2"),
        "s_max_ec2_mm": shr.get("s_max_ec2_mm"), "s_min_ratio_mm": shr.get("s_min_ratio_mm"),
        "links_ok": links_ok, "crush_ok": crush_ok,
        "per_span": shr.get("design", {}),
        "per_span_ends": shr.get("per_span_ends", {}),
    }
    deflection_detail = {
        "governing_span": defl.get("governing_span"), "rho": defl.get("rho"), "rho0": defl.get("rho0"),
        "K_sys": defl.get("K_sys"), "ld_basic": defl.get("ld_basic"),
        "base_status": defl.get("base_status"), "F3": defl.get("F3"), "enhanced": defl.get("enhanced"),
        "ld_eq": defl.get("ld_eq"), "F1": defl.get("F1"), "cap_40K": defl.get("cap_40K"),
        "spans": defl.get("spans", []),
    }

    comps = [
        {"name": "Beam Self Weight", "kind": "DL", "value": round(self_w, 2)},
        {"name": "Wall Load", "kind": "DL", "value": round(request.loads.wall_load, 2)},
        {"name": "Finishes", "kind": "DL", "value": round(request.loads.finishes, 2)},
        {"name": "Additional Dead Load", "kind": "DL", "value": round(request.loads.additional_dead_load, 2)},
        {"name": "Live Load", "kind": "LL", "value": round(request.loads.live_load, 2)},
        {"name": "Other Live Load", "kind": "LL", "value": round(request.loads.other_live_load, 2)},
    ]

    checks = [("Bending", util_bend, "PASS" if bend_ok else "FAIL"),
              ("Shear", util_shear, "PASS" if shear_ok else "FAIL"),
              ("Deflection (span/depth)", defl["actual_Ld"] / defl["allowable_Ld"] if defl.get("allowable_Ld") else None, defl_status),
              (f"Cover for exposure {_enum(request.design_params.exposure_class)}", cover_ratio, cover_status),
              ("Crack control (EC2 7.3.3)", crack_ratio, crack_status)]
    report = [ReportSection(title=sec["title"], rows=[ReportRow(**x) for x in sec["rows"]])
              for sec in _front_matter(request, n, lengths, b, h, checks)]
    ends = ("Continuous (monolithic) end supports: the outer supports are analysed fixed as well as "
            "pinned; end supports take the fixed-end hogging, spans the pinned-end sagging, "
            "interior supports and shear the worse of the two."
            if _enum(request.end_support) == "continuous" else
            "Simple (pinned) end supports: no hogging at the outer supports.")
    report.append(ReportSection(title="1a. End Supports", rows=[ReportRow(reference="Analysis", calculation=ends, output="adopted")]))
    for sec in r.get("report", []):
        rows = [ReportRow(reference=row["ref"], calculation=row["calc"], output=row["out"])
                for row in sec["rows"]]
        report.append(ReportSection(title=sec["section"], rows=rows))
    report.append(ReportSection(title="10b. Cover for Durability (EC2 4.4.1)",
                                rows=[ReportRow(reference=x["ref"], calculation=x["calc"], output=x["out"]) for x in cover_rows]))
    report.append(ReportSection(title="10c. Crack Control (EC2 7.3.3)",
                                rows=[ReportRow(reference=x["ref"], calculation=x["calc"], output=x["out"]) for x in crack_rows]))

    warnings = []
    Lmin, Lmax = min(lengths), max(lengths)
    if Lmax and (Lmax - Lmin) / Lmax > 0.15:
        warnings.append(f"Spans vary by {round((Lmax - Lmin) / Lmax * 100)}% (longest {Lmax:.0f} mm, shortest {Lmin:.0f} mm). Analysed by direct stiffness (FEM), which is exact for unequal spans.")
    
    if not no_links_needed:
        spacings = sorted({s.links["spacing"] for s in support_results})
        sp_txt = f"{spacings[0]} mm c/c" if len(spacings) == 1 else \
            f"{spacings[0]}\u2013{spacings[-1]} mm c/c"
        warnings.append(
            f"Shear links required: VEd = {max_shear:.1f} kN > VRd,c = "
            f"{shr.get('VRdc_kN', 0):.1f} kN. Designed to EC2 Cl.6.2.3 with the links "
            f"carrying the whole of VEd; \u00d8{link} 2-leg at {sp_txt}. "
            "See report section 9b for the working.")
    if not crush_ok:
        warnings.append(
            f"SECTION TOO SMALL IN SHEAR: VEd = {max_shear:.1f} kN exceeds VRd,max = "
            f"{shr.get('VRd_max_kN', 0):.1f} kN. The compression strut crushes and no "
            "amount of link steel fixes this \u2014 increase the section or the concrete grade.")

    notes = [
        f"Design in accordance with {code_label}.",
        "Analysis by direct stiffness (FEM): element k = (EI/L)[[4,2],[2,4]], solved for joint rotations.",
        "Support hogging from member end moments; span sagging from equilibrium.",
        "Hogging designed as rectangular; sagging as T-beam (per-span effective flange).",
        "EC2 lever arm z = d[0.5 + sqrt(0.25 - K/1.134)], matching the slab engines.",
        (f"Effective depth d = {d_eff:.1f} mm is a user-supplied override, used directly in every flexure/shear/deflection calculation below."
         if r["geometry"]["d_eff_is_override"] else
         "Effective depth d = h \u2212 cover \u2212 link \u2212 bar/2 (cover includes the fixed +5 mm detailing tolerance, matching the slab engines)."),
        "Deflection: EC2 §7.4.2 span/effective-depth ratio, two-stage (F3 only if the base ratio fails), K per EC2 Table 7.4N graded by span position.",
        "Per-span loads honoured where provided.",
        "Dimensions in mm; forces in kN; moments in kNm.",
        (f"Shear: links required and designed to EC2 Cl.6.2.3 \u2014 the links carry the "
         f"whole of VEd, VRd,c is not deducted. Spacing also limited by Cl.9.2.2."
         if not no_links_needed else
         "Shear: VEd <= VRd,c on every span; nominal links only."),
    ]

    return ContinuousBeamResult(
        summary=CBSummary(
            beam_id=request.beam_id, design_code=code_label, analysis="FEM (Direct Stiffness)",
            n_spans=n, span_lengths=lengths, width=b, depth=h, effective_depth=round(d_eff, 1),
            cover=cover, concrete_grade=request.materials.concrete_grade,
            steel_grade=request.materials.steel_grade, status=overall),
        materials=CBMaterialsOut(fck=fck, fcd=round(fcd, 1), fyk=fy, fyd=round(fyd, 0),
                                 modular_ratio=15.0, unit_weight_concrete=gc),
        loads=CBLoadSummary(components=comps, total_dead=round(span_gk[0], 2),
                            total_live=round(span_qk[0], 2), total_service=round(span_service[0], 2)),
        spans=spans_out, supports=support_results, reactions=reactions,
        forces=CBForces(max_sagging=round(max_sag, 2), max_hogging=round(max_hog, 2),
                        max_shear=round(max_shear, 2), ultimate_combo=combo),
        capacity=CBCapacity(utilization_bending=round(util_bend, 2), utilization_shear=round(util_shear, 2)),
        sls=CBSLS(deflection_actual=defl["actual_Ld"], deflection_limit=defl["allowable_Ld"],
                  deflection_status=defl_status, crack_width=None, crack_limit=crack_lim,
                  crack_status=crack_status, crack_ratio=round(crack_ratio, 2)),
        shear_detail=shear_detail, deflection_detail=deflection_detail,
        report=report, warnings=warnings, notes=notes)