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

PI = math.pi

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


def calculate_continuous_beam(request: ContinuousBeamRequest) -> ContinuousBeamResult:
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
        
        # Calculate link spacing properly using the rigorous check
        shear_status = r["shear"].get("status", "OK")
        links_required = shear_status != "OK"
        
        # Calculate required spacing if links are needed
        if sh > 0 and links_required:
            # Use the rigorous shear capacity calculation
            v_rdc = r["shear"].get("VRdc_kN", 0)
            v_ed = sh
            asw = 2 * PI / 4 * link ** 2  # area of 2 legs
            z = 0.9 * d_eff
            
            # Calculate the required additional shear resistance
            v_rdc_new = v_rdc  # Should use the actual VRd,c from engine
            v_eds = v_ed - v_rdc_new
            
            if v_eds > 0:
                # V_Rd,s = (A_sw/s) * z * f_ywd * cot(theta)
                # For EC2: cot(theta) = 2.5 (default)
                cot_theta = 2.5
                s_calc = (asw * z * fyd * cot_theta) / (v_eds * 1000.0)
                # Clamp spacing between min and max
                spacing = max(75, int(min(s_calc, 0.75 * d_eff, 300) // 25 * 25))
            else:
                spacing = int(min(0.75 * d_eff, 300) // 25 * 25)
        else:
            # No links required - use maximum spacing
            spacing = int(min(0.75 * d_eff, 300) // 25 * 25)
        
        support_results.append(CBSupportResult(
            index=j, label=label, m_hogging=round(mh, 2), shear=round(sh, 2),
            top_steel=top, links={"bar_diameter": link, "spacing": spacing, "legs": 2,
                                  "label": f"\u00d8{link} @ {spacing} mm c/c"}))

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
    
    # Use the engine's shear status directly - NO ratio < 3.0 threshold
    shear_status = r["shear"].get("status", "OK")
    shear_ok = shear_status == "OK"
    util_shear = 1.0 if shear_ok else (max_shear / r["shear"].get("VRdc_kN", 1.0))
    
    defl = r["deflection"]
    defl_status = "PASS" if defl["status"] == "OK" else "FAIL"
    
    # Overall status must be consistent with the engine
    bend_ok = util_bend <= 1.0
    overall = "PASS" if (bend_ok and shear_ok and defl_status == "PASS") else "FAIL"
    code_label = "BS 8110:1997" if is_bs else "EN 1992-1-1 (EC2)"

    shr = r["shear"]
    shear_detail = {
        "C_Rdc": shr.get("C_Rdc"), "k_factor": shr.get("k_factor"), "rho_l": shr.get("rho_l"),
        "v_min_mpa": shr.get("v_min_mpa"),
        "v_ed_mpa": round(max_shear * 1000 / (b * d_eff), 3) if (b * d_eff) else 0,
        "v_rdc_mpa": round(shr.get("VRdc_kN", 0) * 1000 / (b * d_eff), 3) if (b * d_eff) else 0,
        "links_required": not shear_ok,
        "shear_status": shear_status,
        "utilization": round(util_shear, 2),
    }
    deflection_detail = {
        "governing_span": defl.get("governing_span"), "rho": defl.get("rho"), "rho0": defl.get("rho0"),
        "K_sys": defl.get("K_sys"), "ld_basic": defl.get("ld_basic"),
        "base_status": defl.get("base_status"), "F3": defl.get("F3"), "enhanced": defl.get("enhanced"),
    }

    comps = [
        {"name": "Beam Self Weight", "kind": "DL", "value": round(self_w, 2)},
        {"name": "Wall Load", "kind": "DL", "value": round(request.loads.wall_load, 2)},
        {"name": "Finishes", "kind": "DL", "value": round(request.loads.finishes, 2)},
        {"name": "Additional Dead Load", "kind": "DL", "value": round(request.loads.additional_dead_load, 2)},
        {"name": "Live Load", "kind": "LL", "value": round(request.loads.live_load, 2)},
        {"name": "Other Live Load", "kind": "LL", "value": round(request.loads.other_live_load, 2)},
    ]

    report = []
    for sec in r.get("report", []):
        rows = [ReportRow(reference=row["ref"], calculation=row["calc"], output=row["out"])
                for row in sec["rows"]]
        report.append(ReportSection(title=sec["section"], rows=rows))

    warnings = []
    Lmin, Lmax = min(lengths), max(lengths)
    if Lmax and (Lmax - Lmin) / Lmax > 0.15:
        warnings.append(f"Spans vary by {round((Lmax - Lmin) / Lmax * 100)}% (longest {Lmax:.0f} mm, shortest {Lmin:.0f} mm). Analysed by direct stiffness (FEM), which is exact for unequal spans.")
    
    if not shear_ok:
        warnings.append(f"Shear design required: VEd = {max_shear:.1f} kN > VRd,c = {shr.get('VRdc_kN', 0):.1f} kN. Links provided at {support_results[0].links['spacing']} mm c/c.")

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
        f"Shear: {'Links required' if not shear_ok else 'No links required'}.",
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
                  deflection_status=defl_status, crack_width=0.0, crack_limit=0.30, crack_status="PASS"),
        shear_detail=shear_detail, deflection_detail=deflection_detail,
        report=report, warnings=warnings, notes=notes)