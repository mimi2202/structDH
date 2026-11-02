# backend/engine/staircase_detailing.py
"""
Staircase detailing and bar bending schedule, after the Structville textbook
(Ubani, EC2), section 9.9 (Fig. 9.20, Section 2-2) and 10.6.

Book 9.9: "Staircase detailing follows the simplified rules for slab
detailing, including curtailment of reinforcement" -> Fig. 9.9 (top bars at
an end support 0.2L, hogging bars 0.3L), 9.2 (shift rule a_l = d for members
without links), 9.1.2 (anchorage), 9.1.4 (anchorage at an end support,
F_E = |V| a_l/z + N_Ed), 9.5 (bar counts).

The engine's frame (top support A, flight A-B, landing B-C) is the book's
Section 2-2 (flight 2 down to the landing). Book marks -> marks here:
  05 -> 01  main bottom: leg into the floor slab at A, flight soffit, landing
            soffit into the support at C, 75 mm bob.
  06 -> 02  landing top bar, crossing at the knee B into the flight soffit
            (T/B): crossing offset (h - 2c)/tan(theta) (book 1480 = 1270 + 210).
  07 -> 03  top bar at the re-entrant corner B. Book: nominal Y10 500/500.
            When the frame hogs at B it carries the designed top steel and its
            flight leg covers the hogging zone + a_l = d (book 9.2).
  08 -> 04  top bar at A (pinned end): 0.2L into the flight (Fig. 9.9) and a
            leg into the floor slab.
  09 -> 05  flight distribution bars (bottom, plus under the top bars 03/04).
  10 -> 06  landing distribution bars, top and bottom.
Lengths: legs into the slab = max(500 (book), l_bd at f_yd); bob 75 (book);
cut length = sum of the dimensions (book 10.2/10.6 convention); bar count
across the width = floor((W - 2c)/s) + 1 (book 10.6: 5 bars in 885 @ 200).
"""
from __future__ import annotations

import math
from typing import Dict, List

from engine import foundation_detailing as fd

BOOK_LEG_MM = 500     # book 10.6, marks 05/07/08 legs into the slab / corner legs
BOB_MM = 75           # book 10.6, marks 05/06


def _up(x: float, step: float = 50) -> float:
    return math.ceil(x / step - 1e-9) * step


def _lbd_straight(phi, cover, spacing, sigma, fck, gamma_c=1.5, fyd=None):
    """Book 9.1.2: straight bar, good bond; l_bd = alpha2 l_b,rqd >= l_b,min."""
    cd = min(cover, (spacing - phi) / 2)
    a2 = fd._alpha2_straight(phi, cd)
    lb = fd.lb_rqd(phi, sigma, fck, gamma_c)
    lb_full = fd.lb_rqd(phi, fyd, fck, gamma_c) if fyd else lb
    lb_min = max(0.3 * lb_full, 10 * phi, 100)
    return {"cd_mm": cd, "alpha2": a2, "lb_rqd_mm": lb, "lb_min_mm": lb_min,
            "lbd_mm": max(a2 * lb, lb_min)}


def _hog_extents(pts, L1, L2, cos_t):
    """Hogging zone either side of B: along the flight slope (m) and along
    the landing (m), from the analysis stations."""
    fl = [p for p in pts if p["member"] == "flight"]
    la = [p for p in pts if p["member"] == "landing"]
    MB = fl[-1]["M"]
    if MB >= 0:
        return 0.0, 0.0
    # flight: last sign change before B
    x0 = 0.0
    for p, q in zip(fl, fl[1:]):
        if p["M"] >= 0 > q["M"]:
            x0 = p["x"] + (q["x"] - p["x"]) * p["M"] / (p["M"] - q["M"])
    ext_f = (L1 - x0) / cos_t
    # landing: first sign change after B (else the whole landing hogs)
    x1 = L1 + L2
    for p, q in zip(la, la[1:]):
        if p["M"] < 0 <= q["M"] and q["x"] > L1:
            x1 = p["x"] + (q["x"] - p["x"]) * (-p["M"]) / (q["M"] - p["M"])
            break
    return ext_f, x1 - L1


def detail_staircase(inp, res, *, width_mm: float, support_width_mm: float, n_members: int,
                     gamma_c: float = 1.5, gamma_s: float = 1.15) -> Dict:
    fr = res["frame"]
    b, t, dist = res["bottom"], res["top"], res["dist"]
    h, c, fck, fyk = inp.thickness_mm, inp.cover_mm, inp.fck, inp.fyk
    fyd = fyk / gamma_s
    W = width_mm
    L1, L2 = fr.L1 * 1000, fr.L2 * 1000
    Ls = fr.Ls * 1000
    tan_t = fr.Hf / fr.L1
    theta = math.degrees(math.atan(tan_t))

    phi_m, s_m = b["bar"], b["spacing"]
    phi_d, s_d = dist["bar"], dist["spacing"]

    # anchorage at full design stress (legs into the floor slab / corner legs)
    lbd_main = _lbd_straight(phi_m, c, s_m, fyd, fck, gamma_c, fyd)
    leg_slab = max(BOOK_LEG_MM, _up(lbd_main["lbd_mm"]))

    # run of the landing bars into the support at C: to the far face - cover
    landing_run = L2 + support_width_mm / 2 - c
    x_cross = (h - 2 * c) / tan_t                    # book: 1480 - 1270 = 210

    # hogging zone at B (book 9.2: shift a_l = d)
    ext_f, ext_l = _hog_extents(res["points"], fr.L1, fr.L2, fr.c)
    ext_f, ext_l = ext_f * 1000, ext_l * 1000

    rows: List[Dict] = []
    sketches: Dict[str, List] = {}

    def add(mark, phi, n, dims, desc, callout_pos, spacing, sketch, book):
        dims = {k: round(v) for k, v in dims.items()}   # length = sum of the printed dims
        r = fd.schedule_row(mark, phi, n, n_members, "99" if len(dims) > 1 else "00", dims, desc)
        r["spacing_mm"] = spacing
        r["callout"] = f"{n}Y{phi:.0f}-{mark}-{spacing:.0f}{callout_pos}"
        r["book_mark"] = book
        r["sketch"] = sketch          # [(dim key, angle deg)] in Section 2-2 orientation
        rows.append(r)

    nb = lambda s: fd.bar_count(W, c, s)

    # 01 (book 05): main bottom
    add("01", phi_m, nb(s_m),
        {"A": leg_slab, "B": Ls, "C": landing_run, "D": BOB_MM},
        "main bottom: leg into the floor slab at A, flight soffit, landing soffit, bob at C",
        "B", s_m, [["A", 0], ["B", -theta], ["C", 0], ["D", 90]], "05")

    # 02 (book 06): landing top, crossing into the flight soffit
    leg02 = _up(max(0.3 * Ls, lbd_main["lbd_mm"]))
    add("02", phi_m, nb(s_m),
        {"A": leg02, "B": landing_run + x_cross, "C": BOB_MM},
        "landing top, crossing at B into the flight soffit; bob at C",
        "T/B", s_m, [["A", -theta], ["B", 0], ["C", -90]], "06")

    # 03 (book 07): top bar at the re-entrant corner B
    if t:
        phi3, s3 = t["bar"], t["spacing"]
        lbd3 = _lbd_straight(phi3, c, s3, fyd, fck, gamma_c, fyd)["lbd_mm"]
        leg3_f = max(BOOK_LEG_MM, _up(ext_f + t["d_mm"]), _up(lbd3))
        leg3_l = min(max(BOOK_LEG_MM, _up(ext_l + t["d_mm"]), _up(lbd3)), landing_run)
        desc3 = "top at B (designed hogging steel), legs cover the hogging zone + d"
    else:
        phi3, s3 = phi_d, s_m                       # book: Y10 at the main spacing
        leg3_f = leg3_l = BOOK_LEG_MM
        desc3 = "top at B (nominal, no hogging)"
    add("03", phi3, nb(s3), {"A": leg3_f, "B": leg3_l}, desc3, "T", s3,
        [["A", -theta], ["B", 0]], "07")

    # 04 (book 08): top bar at A
    leg4_f = _up(0.2 * Ls)
    add("04", phi_m, nb(s_m), {"A": leg_slab, "B": leg4_f},
        "top at A: leg into the floor slab, 0.2L down the flight", "T", s_m,
        [["A", 0], ["B", -theta]], "08")

    # 05 (book 09): flight distribution, bottom + under the top bars 03 and 04
    n05_b = fd.bar_count(Ls, c, s_d)
    n05_t = fd.bar_count(leg4_f, 0, s_d) + fd.bar_count(leg3_f, 0, s_d)
    add("05", phi_d, n05_b + n05_t, {"A": W - 2 * c},
        f"flight distribution: {n05_b} bottom (NB) + {n05_t} under top bars 03/04", "NB/NT", s_d,
        [["A", 0]], "09")

    # 06 (book 10): landing distribution, top and bottom
    n06 = fd.bar_count(L2, c, s_d)
    add("06", phi_d, 2 * n06, {"A": W - 2 * c},
        f"landing distribution: {n06} top + {n06} bottom", "T&B", s_d, [["A", 0]], "10")

    # anchorage of the bottom bars at the end support C (book 9.1.4, Eq. 9.4)
    d_b = b["d_mm"]
    a_l, z = d_b, 0.9 * d_b
    VC = abs(fr.VC)
    N_C = max(fr.H, 0.0)                             # landing axial force (tension +)
    FE = VC * a_l / z + N_C
    sigma = min(FE * 1000 / b["As_prov"], fyd)
    anc = _lbd_straight(phi_m, c, s_m, sigma, fck, gamma_c, fyd)
    avail = support_width_mm - c
    anchorage_C = {"VEd_kN": VC, "NEd_kN": N_C, "a_l_mm": a_l, "z_mm": z, "FE_kN": FE,
                   "As_prov": b["As_prov"], "sigma_MPa": sigma, "fbd_MPa": fd.bond_strength(fck, gamma_c),
                   **anc, "available_mm": avail,
                   "status": "OK" if anc["lbd_mm"] <= avail + 1e-6 else "NOT OK"}

    return {
        "element": "staircase", "width_mm": W, "support_width_mm": support_width_mm,
        "theta_deg": theta, "sloping_length_mm": Ls, "landing_run_mm": landing_run,
        "x_cross_mm": x_cross, "hog_flight_mm": ext_f, "hog_landing_mm": ext_l,
        "lbd_main": lbd_main, "leg_slab_mm": leg_slab, "anchorage_C": anchorage_C,
        "callouts": [r["callout"] for r in rows],
        "schedule": rows, "summary": fd.summarise(rows),
        "status": anchorage_C["status"],
    }
