"""
Reinforcement detailing and bar schedule for a single-span beam, laid out
like the footing detailing (engine/foundation_detailing.py, whose helpers are
reused): bar marks, callouts, anchorage at the supports, a BS 8666-style
schedule with shape codes, and the data the results page draws.

Marks
  01  main tension bars          (bottom; top for a cantilever)
  02  top bars                   (compression bars / hangers; bottom for a cantilever)
  03  links                      (closed, shape 51)

Geometry assumptions (stated in the report):
  * the entered span is between support centrelines; the beam runs
    support_width/2 beyond each centreline, so the overall length is
    span + support_width (cantilever: span + support_width, one support);
  * bars stop at the nominal end cover; links start 50 mm inside each
    support face and continue at the designed spacing;
  * cut length = sum of the shape dimensions (BS 8666 bend deductions not
    applied), as in the footing schedule.

Anchorage of the bottom bars at a simple support (EC2 9.2.1.4): the tensile
force F_E = |V_Ed| a_l / z with a_l = z (cot theta - cot alpha) / 2 and
cot theta = 1 (vertical links, as in the shear design), so F_E = V_Ed / 2;
anchorage length l_bd beyond the support face for sigma = F_E / A_s. If a
straight bar does not fit in the support, the bar is bent up (Table 8.2
alpha_1 for a bent bar).
"""
import math
from typing import Dict, List

from engine.foundation_detailing import (
    lb_rqd, bond_strength, _alpha2_straight, _alphas_bent, schedule_row, summarise, unit_mass,
)

LINK_START_MM = 50
LINK_HOOK_MM = 50
HANGER_MIN_PHI = 12


def _ceil25(x: float) -> float:
    return math.ceil(x / 25.0) * 25.0


def end_anchorage(*, phi: float, n_bars: int, VEd_kN: float, cover: float, support_mm: float,
                  h: float, link_phi: float, fck: float, fyk: float, spacing_clear: float,
                  gamma_c: float = 1.5, gamma_s: float = 1.15) -> Dict:
    As = n_bars * math.pi * phi ** 2 / 4
    F_E = abs(VEd_kN) / 2.0                         # kN, EC2 9.2.1.4(2), cot theta = 1
    sigma = F_E * 1000 / As if As else 0.0          # N/mm2
    fyd = fyk / gamma_s
    lbrqd = lb_rqd(phi, sigma, fck, gamma_c)
    lbrqd_full = lb_rqd(phi, fyd, fck, gamma_c)
    lb_min = max(0.3 * lbrqd_full, 10 * phi, 100.0)
    cd = min(cover + link_phi, spacing_clear / 2)   # side cover to the bar / half the clear gap
    lbd_straight = max(_alpha2_straight(phi, cd) * lbrqd, lb_min)
    avail = max(support_mm - cover, 0.0)            # from the support face to the bar end
    a1, a2 = _alphas_bent(phi, cd)
    lbd_bent = max(a1 * a2 * lbrqd, lb_min)
    straight_ok = lbd_straight <= avail
    leg = 0.0
    if not straight_ok:
        leg = _ceil25(max(lbd_bent - avail, 5 * phi))   # Fig. 8.1: straight extension >= 5 phi after the bend
    leg_max = h - 2 * (cover + link_phi)
    return {
        "phi_mm": phi, "As_mm2": round(As, 0), "F_E_kN": round(F_E, 2), "sigma_s_MPa": round(sigma, 1),
        "fbd_MPa": round(bond_strength(fck, gamma_c), 3), "cd_mm": round(cd, 1),
        "lb_rqd_mm": round(lbrqd, 1), "lb_min_mm": round(lb_min, 1),
        "lbd_straight_mm": round(lbd_straight, 1), "available_mm": round(avail, 1), "straight_ok": straight_ok,
        "alpha1": a1, "alpha2": round(a2, 3), "lbd_bent_mm": round(lbd_bent, 1),
        "leg_mm": round(leg), "leg_max_mm": round(leg_max),
        "status": "OK" if (straight_ok or leg <= leg_max) else "NOT OK",
    }


def beam_detailing(*, support: str, span_mm: float, b: float, h: float, cover: float, link_phi: float,
                   link_spacing: float, link_legs: int, main_n: int, main_phi: float,
                   top_n: int, top_phi: float, VEd_kN: float, fck: float, fyk: float,
                   support_width_mm: float = 230.0, n_members: int = 1) -> Dict:
    """cover = nominal cover to the links (the clear cover entered)."""
    cantilever = support == "one_fixed_one_free"
    a = support_width_mm
    L_over = span_mm + (a / 2 if cantilever else a)              # overall length of the member
    clear = span_mm - (a / 2 if cantilever else a)                # between support faces
    c_bar = cover + link_phi                                      # cover to the main bars
    top_phi = max(top_phi, HANGER_MIN_PHI)
    warnings: List[str] = []

    # clear gap between main bars (one layer)
    gap = (b - 2 * c_bar - main_n * main_phi) / (main_n - 1) if main_n > 1 else b - 2 * c_bar - main_phi

    # ---- anchorage of the main bars
    anchorage = None
    leg = 0.0
    if support == "both_ends_simply_supported":
        anchorage = end_anchorage(phi=main_phi, n_bars=main_n, VEd_kN=VEd_kN, cover=cover, support_mm=a,
                                  h=h, link_phi=link_phi, fck=fck, fyk=fyk, spacing_clear=gap)
        leg = anchorage["leg_mm"]
    elif cantilever:
        # full design stress at the fixed end: anchor into the support / back span
        fyd = fyk / 1.15
        lbrqd_full = lb_rqd(main_phi, fyd, fck)
        a1, a2 = _alphas_bent(main_phi, min(c_bar, gap / 2))
        lbd = max(a1 * a2 * lbrqd_full, 0.3 * lbrqd_full, 10 * main_phi, 100)
        anchorage = {"phi_mm": main_phi, "lbd_bent_mm": round(lbd, 1), "lb_rqd_mm": round(lbrqd_full, 1),
                     "fbd_MPa": round(bond_strength(fck), 3), "alpha1": a1, "alpha2": round(a2, 3),
                     "into_support_mm": round(_ceil25(lbd)), "status": "OK", "cantilever": True}
        warnings.append(f"Cantilever: the top bars must be anchored {anchorage['into_support_mm']} mm (l_bd at full design stress) "
                        "into the supporting member or back span; detail that length in the support.")
    else:
        warnings.append("Fixed end(s): this module designs the span moment only. Top steel over the fixed support(s) "
                        "(hogging) is not designed here: design and detail it separately. Mark 02 is shown as hangers.")

    # ---- bars
    run = L_over - 2 * cover                                      # straight run between end covers
    rows: List[Dict] = []
    if cantilever:
        main_dims = {"A": run}
        main_shape = "00"
        main_desc = "main top bars (tension), full length"
    elif leg > 0:
        main_dims = {"A": leg, "B": run, "C": leg}
        main_shape = "21"
        main_desc = "main bottom bars, bent up at both supports"
    else:
        main_dims = {"A": run}
        main_shape = "00"
        main_desc = "main bottom bars, full length"
    r1 = schedule_row("01", main_phi, main_n, n_members, main_shape, main_dims, main_desc)
    r1["callout"] = f"{main_n}-Y{main_phi:.0f}-01"
    r1["position"] = "top" if cantilever else "bottom"
    rows.append(r1)

    r2 = schedule_row("02", top_phi, top_n, n_members, "00", {"A": run},
                      "bottom bars (compression zone / hangers)" if cantilever else "top bars (hangers / compression)")
    r2["callout"] = f"{top_n}-Y{top_phi:.0f}-02"
    r2["position"] = "bottom" if cantilever else "top"
    rows.append(r2)

    # links: outside dimensions = section less the cover each side
    la, lb = b - 2 * cover, h - 2 * cover
    links_run = max(clear - 2 * LINK_START_MM, 0)
    n_links = int(math.floor(links_run / link_spacing + 1e-9)) + 1
    r3 = schedule_row("03", link_phi, n_links, n_members, "51", {"A": la, "B": lb, "C": LINK_HOOK_MM},
                      f"closed links, {link_legs} legs")
    length_m = (2 * (la + lb) + 2 * LINK_HOOK_MM) / 1000
    total = length_m * n_links * n_members
    r3.update(length_m=round(length_m, 3), total_length_m=round(total, 3),
              mass_kg=round(total * unit_mass(link_phi), 2), spacing_mm=link_spacing,
              callout=f"{n_links}-Y{link_phi:.0f}-03-{link_spacing:.0f}")
    rows.append(r3)

    # ---- simple checks on the arrangement
    min_gap = max(main_phi, 20 + 5, 20)                            # EC2 8.2(2): max(phi, d_g + 5, 20), d_g = 20
    spacing_ok = gap >= min_gap
    if not spacing_ok:
        warnings.append(f"Clear gap between the main bars {gap:.0f} mm < {min_gap:.0f} mm (EC2 8.2): use two layers or larger bars.")

    status = "OK" if (anchorage is None or anchorage["status"] == "OK") and spacing_ok else "NOT OK"
    return {
        "element": "beam", "support": support, "status": status, "warnings": warnings,
        "anchorage": anchorage,
        "bar_gap_mm": round(gap, 1), "bar_gap_min_mm": min_gap, "spacing_ok": spacing_ok,
        "schedule": rows, "summary": summarise(rows),
        "callouts": [r["callout"] for r in rows],
        "drawing": {
            "span_mm": span_mm, "support_width_mm": a, "overall_mm": L_over, "clear_mm": clear,
            "b_mm": b, "h_mm": h, "cover_mm": cover, "cantilever": cantilever,
            "main": {"n": main_n, "phi": main_phi, "position": r1["position"], "leg_mm": leg, "mark": "01"},
            "top": {"n": top_n, "phi": top_phi, "position": r2["position"], "mark": "02"},
            "links": {"n": n_links, "phi": link_phi, "spacing_mm": link_spacing, "legs": link_legs,
                      "start_mm": LINK_START_MM, "mark": "03"},
        },
    }


def detailing_report_rows(det: Dict, ref_prefix: str = "EC2") -> List[Dict]:
    """Rows for a 'Detailing and bar schedule' report section ({ref, calc, out})."""
    d = det["drawing"]
    rows = [
        {"ref": "Geometry", "calc": f"Overall length = span + support width = {d['span_mm']:.0f} + {d['support_width_mm']:.0f}"
                                    + (" / 2 (cantilever)" if d["cantilever"] else ""), "out": f"{d['overall_mm']:.0f} mm"},
        {"ref": "Geometry", "calc": "Clear span between support faces; links from 50 mm inside each face", "out": f"{d['clear_mm']:.0f} mm"},
    ]
    a = det.get("anchorage")
    if a and not a.get("cantilever"):
        rows += [
            {"ref": "EC2 9.2.1.4(2)", "calc": f"F_E = |V_Ed| a_l / z, a_l = z (cot θ − cot α)/2, cot θ = 1 → F_E = V_Ed / 2", "out": f"{a['F_E_kN']:.2f} kN"},
            {"ref": "EC2 8.4.3", "calc": f"σ_sd = F_E / A_s = {a['F_E_kN']:.2f}e3 / {a['As_mm2']:.0f}; f_bd = {a['fbd_MPa']:.3f} MPa; l_b,rqd = (φ/4) σ_sd / f_bd", "out": f"{a['lb_rqd_mm']:.0f} mm"},
            {"ref": "EC2 8.4.4", "calc": f"l_b,min = max(0.3 l_b,rqd(f_yd); 10φ; 100); straight l_bd = max(α2 l_b,rqd; l_b,min)", "out": f"{a['lbd_straight_mm']:.0f} mm"},
            {"ref": "EC2 9.2.1.4(3)", "calc": f"Available in the support = support width − end cover = {a['available_mm']:.0f} mm",
             "out": "straight OK" if a["straight_ok"] else "bend up"},
        ]
        if not a["straight_ok"]:
            rows.append({"ref": "EC2 Table 8.2", "calc": f"Bent bar: α1 = {a['alpha1']}, α2 = {a['alpha2']}; l_bd = {a['lbd_bent_mm']:.0f} mm → leg = max(l_bd − available; 5φ), to 25 mm",
                         "out": f"leg {a['leg_mm']:.0f} mm ≤ {a['leg_max_mm']:.0f} mm: {a['status']}"})
    elif a:
        rows.append({"ref": "EC2 8.4.4", "calc": f"Cantilever top bars at full design stress: l_bd = α1 α2 l_b,rqd = {a['lbd_bent_mm']:.0f} mm",
                     "out": f"anchor {a['into_support_mm']} mm into the support"})
    rows.append({"ref": "EC2 8.2(2)", "calc": f"Clear gap between main bars ≥ max(φ; d_g + 5; 20) = {det['bar_gap_min_mm']:.0f} mm",
                 "out": f"{det['bar_gap_mm']:.0f} mm: {'OK' if det['spacing_ok'] else 'NOT OK'}"})
    for r in det["schedule"]:
        dims = ", ".join(f"{k} {v}" for k, v in r["dims_mm"].items())
        rows.append({"ref": f"Mark {r['mark']}", "calc": f"{r['callout']}: {r['description']}; shape {r['shape_code']} ({dims}); {r['length_m']:.3f} m each",
                     "out": f"{r['total_length_m']:.2f} m, {r['mass_kg']:.2f} kg"})
    rows.append({"ref": "Schedule", "calc": "Total reinforcement (cut length = sum of shape dimensions, no bend deduction)",
                 "out": f"{det['summary']['total_mass_kg']:.2f} kg"})
    for w in det["warnings"]:
        rows.append({"ref": "Note", "calc": w, "out": "-"})
    return rows
