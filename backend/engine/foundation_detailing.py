# backend/engine/foundation_detailing.py
"""
Foundation detailing and bar bending schedule, after the Structville
textbook ("Practical Structural Analysis and Design of Residential
Buildings", Ubani O. U., EC2), sections 9.1.2, 9.1.6, 9.10 and 10.2.

  - Anchorage (book 9.1.2 / EC2 8.4): f_bd = 2.25 eta1 eta2 f_ctd,
    f_ctd = f_ctk,0.05/gamma_c (f_ctk,0.05 = 0.7 f_ctm), l_b,rqd =
    (phi/4)(sigma_sd/f_bd), l_bd = alpha1 alpha2 l_b,rqd >= l_b,min.
    Bent bars (book 9.10): alpha1 = 0.7 when c_d > 3 phi, alpha2 = 1 -
    0.15(c_d - 3 phi)/phi within 0.7..1.0.
  - Anchorage at the footing edge (book 9.10 / EC2 9.8.2.2, Fig. 9.13):
    F_s = R z_e/z_i at x = h/2 from the edge, R = soil reaction on x, z_e
    from R to N_Ed placed at e = 0.15 b inside the column face, z_i = 0.9 d.
    The bar must anchor sigma_s = F_s/A_s,prov within x - cover; if the
    straight length is too short the leg of the bent (U) bar makes it up.
  - Bars (book 9.10, 10.2): bottom mats as U-bars with 150 mm legs (longer
    if the anchorage needs it), straight length = footing - 2 covers,
    number = floor((width - 2 covers)/spacing) + 1, cut length = sum of
    the dimensions (the book's convention; no BS 8666 bend deduction).
  - Starter bars (book 10.2, mark 05): L-bars with a 300 mm foot on the
    bottom mat, projecting above the footing by the soil depth plus the
    EC2 8.7.3 lap l0 = alpha6 l_b,rqd (alpha6 = 1.5) >= max(0.3 alpha6
    l_b,rqd, 15 phi, 200) (book 9.1.6) unless a projection is entered.
  - Mass per metre from the book's table (0.395, 0.616, 0.888, 1.579,
    2.466 kg/m ...); pieces = 12 m stock lengths, ceil(total length / 12).
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

from engine.combined_footing_engine import _fctm

UNIT_MASS = {6: 0.222, 8: 0.395, 10: 0.616, 12: 0.888, 16: 1.579, 20: 2.466,
             25: 3.854, 32: 6.313, 40: 9.864}
STOCK_LENGTH_M = 12.0
LEG_MIN_MM = 150      # book 10.2, marks 01/02
STARTER_FOOT_MM = 300  # book 10.2, mark 05


def unit_mass(phi: float) -> float:
    return UNIT_MASS.get(int(round(phi)), phi ** 2 / 162)


def bond_strength(fck: float, gamma_c: float = 1.5) -> float:
    """f_bd, good bond, phi <= 32 (eta1 = eta2 = 1)."""
    return 2.25 * 0.7 * _fctm(fck) / gamma_c


def lb_rqd(phi: float, sigma_sd: float, fck: float, gamma_c: float = 1.5) -> float:
    return phi / 4 * sigma_sd / bond_strength(fck, gamma_c)


def _alphas_bent(phi: float, cd: float):
    a1 = 0.7 if cd > 3 * phi else 1.0
    a2 = min(max(1 - 0.15 * (cd - 3 * phi) / phi, 0.7), 1.0)
    return a1, a2


def _alpha2_straight(phi: float, cd: float):
    return min(max(1 - 0.15 * (cd - phi) / phi, 0.7), 1.0)


def lap_length(phi: float, fyk: float, fck: float, gamma_c: float = 1.5, gamma_s: float = 1.15) -> float:
    lb = lb_rqd(phi, fyk / gamma_s, fck, gamma_c)
    return max(1.5 * lb, 0.3 * 1.5 * lb, 15 * phi, 200)


def edge_anchorage(*, label: str, phi: float, spacing: float, As_prov: float, cover: float,
                   h: float, d_eff: float, a_mm: float, col_b_mm: float, q_edge: float,
                   fck: float, fyk: float, gamma_c: float = 1.5, gamma_s: float = 1.15) -> Dict:
    """EC2 9.8.2.2 at x = h/2 for one direction, per metre width.
    a_mm: overhang from the column face; q_edge: ULS net pressure at the
    edge (kN/m2, taken over x)."""
    x = h / 2
    R = q_edge * x / 1000                             # kN/m
    ze = a_mm + 0.15 * col_b_mm - x / 2              # mm
    zi = 0.9 * d_eff
    Fs = R * ze / zi                                  # kN/m
    sigma = Fs * 1000 / As_prov if As_prov else 0.0   # N/mm2
    fyd = fyk / gamma_s
    cd = min(cover, (spacing - phi) / 2)
    lbrqd = lb_rqd(phi, sigma, fck, gamma_c)
    lbrqd_full = lb_rqd(phi, fyd, fck, gamma_c)
    lb_min = max(0.3 * lbrqd_full, 10 * phi, 100)
    a2s = _alpha2_straight(phi, cd)
    lbd_straight = max(a2s * lbrqd, lb_min)
    avail = max(x - cover, 0.0)
    a1b, a2b = _alphas_bent(phi, cd)
    lbd_bent = max(a1b * a2b * lbrqd, lb_min)
    lbd_full = a1b * a2b * lbrqd_full      # book 9.10: full design stress, bent bar
    # leg needed to make up the bent-bar anchorage beyond the straight run
    leg_need = max(lbd_bent - avail, 0.0)
    leg = max(LEG_MIN_MM, math.ceil(leg_need / 25) * 25)
    leg_max = h - 2 * cover
    return {
        "label": label, "phi_mm": phi, "x_mm": x, "R_kN_m": R, "ze_mm": ze, "zi_mm": zi,
        "Fs_kN_m": Fs, "sigma_s_MPa": sigma, "fbd_MPa": bond_strength(fck, gamma_c),
        "cd_mm": cd, "lb_rqd_mm": lbrqd, "lb_min_mm": lb_min,
        "lbd_straight_mm": lbd_straight, "available_straight_mm": avail,
        "straight_ok": lbd_straight <= avail,
        "alpha1": a1b, "alpha2": a2b, "lbd_bent_mm": lbd_bent,
        "lbd_full_mm": lbd_full, "lbd_full_phi": lbd_full / phi,
        "leg_mm": leg, "leg_max_mm": leg_max,
        "status": "OK" if leg <= leg_max else "NOT OK",
    }


def bar_count(width_mm: float, cover: float, spacing: float) -> int:
    return int(math.floor((width_mm - 2 * cover) / spacing + 1e-9)) + 1


def schedule_row(mark: str, phi: float, n_bars: int, n_members: int, shape: str,
                 dims: Dict[str, float], description: str) -> Dict:
    length_m = sum(dims.values()) / 1000
    total = length_m * n_bars * n_members
    return {"mark": mark, "type_size": f"Y{phi:.0f}", "phi_mm": phi, "n_bars": n_bars,
            "n_members": n_members, "shape_code": shape, "dims_mm": {k: round(v) for k, v in dims.items()},
            "length_m": round(length_m, 3), "total_length_m": round(total, 3),
            "mass_kg": round(total * unit_mass(phi), 2), "description": description}


def mat_row(mark: str, phi: float, spacing: float, span_mm: float, across_mm: float,
            cover: float, leg: float, n_members: int, description: str) -> Dict:
    n = bar_count(across_mm, cover, spacing)
    row = schedule_row(mark, phi, n, n_members, "21",
                       {"A": leg, "B": span_mm - 2 * cover, "C": leg}, description)
    row["callout"] = f"{n}-Y{phi:.0f}-{mark}-{spacing:.0f}"
    row["spacing_mm"] = spacing
    return row


def starter_row(mark: str, phi: float, n_per_col: int, n_cols: int, n_members: int,
                h: float, cover: float, mat_phi: float, projection_mm: float) -> Dict:
    vertical = h - cover - 2 * mat_phi + projection_mm
    row = schedule_row(mark, phi, n_per_col * n_cols, n_members, "11",
                       {"A": vertical, "B": STARTER_FOOT_MM}, "starter bars")
    row["callout"] = f"{n_per_col * n_cols}-Y{phi:.0f}-{mark}"
    return row


def summarise(rows: List[Dict]) -> Dict:
    by_dia: Dict[str, Dict] = {}
    for r in rows:
        k = r["type_size"]
        e = by_dia.setdefault(k, {"type_size": k, "unit_mass_kg_m": unit_mass(r["phi_mm"]),
                                  "total_length_m": 0.0, "mass_kg": 0.0})
        e["total_length_m"] += r["total_length_m"]
        e["mass_kg"] += r["mass_kg"]
    out = []
    for e in sorted(by_dia.values(), key=lambda e: int(e["type_size"][1:])):
        out.append({**e, "total_length_m": round(e["total_length_m"], 3), "mass_kg": round(e["mass_kg"], 2),
                    "tonnes": round(e["mass_kg"] / 1000, 4),
                    "pieces_12m": math.ceil(e["total_length_m"] / STOCK_LENGTH_M - 1e-9)})
    return {"by_diameter": out, "total_mass_kg": round(sum(e["mass_kg"] for e in out), 2)}


def starter_projection(phi: float, fyk: float, fck: float, soil_above_mm: float,
                       projection_mm: Optional[float], gamma_c: float = 1.5, gamma_s: float = 1.15):
    lap = lap_length(phi, fyk, fck, gamma_c, gamma_s)
    proj = projection_mm if projection_mm else soil_above_mm + lap
    return proj, lap
