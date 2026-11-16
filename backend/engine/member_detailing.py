"""
Reinforcement detailing and bar schedules for the continuous beam, the
continuous one-way slab, the one-/two-way slab panel and the column, laid out
like the footing and beam detailing (engine/foundation_detailing.py,
engine/beam_detailing.py): bar marks, callouts, a BS 8666-style schedule
(cut length = sum of the shape dimensions, no bend deduction), report rows and
drawing data.

Simplified curtailment rules (uniformly loaded members, spans within about
15 % of each other); stated in every report:
  * top bars over an internal support: 0.30 x the longer adjacent span each
    side of the support centreline;
  * top bars at a simple end support (partial fixity, EC2 9.2.1.2(1) beams,
    9.3.1.2(2) slabs): 0.20 x the end span beyond the support face, bent down
    into the support;
  * bottom bars: into internal supports max(10 phi, 100) beyond the face (EC2
    9.2.1.5(1)); at simple end supports anchored for F_E = V_Ed / 2 (EC2
    9.2.1.4), bent up when a straight bar does not fit;
  * slab distribution steel >= 20 % of the main steel, spacing <= min(3.5h,
    450) (EC2 9.3.1.1(2), (3)).
Support widths default to 230 mm (a block wall); spans are between support
centrelines.
"""
import math
from typing import Dict, List, Optional

from engine.foundation_detailing import (
    lb_rqd, bond_strength, lap_length, schedule_row, summarise, unit_mass, bar_count,
)
from engine.beam_detailing import end_anchorage

HOOK_MM = 50          # link hooks, as the footing / beam schedules
LINK_START_MM = 50    # first link from the support face


def _c25(x: float) -> float:
    return math.ceil(x / 25.0) * 25.0


def _f25(x: float) -> float:
    return math.floor(x / 25.0) * 25.0


def _mark(i: int) -> str:
    return f"{i:02d}"


def _area(phi: float) -> float:
    return math.pi * phi ** 2 / 4


def _report(det: Dict, rules: List[str]) -> List[Dict]:
    rows = [{"ref": "Rules", "calc": r, "out": "adopted"} for r in rules]
    for a in det.get("anchorage", []) or []:
        if a.get("straight_ok") is None:
            continue
        rows.append({"ref": "EC2 9.2.1.4", "calc": f"{a['label']}: F_E = V_Ed/2 = {a['F_E_kN']:.2f} kN; σ = {a['sigma_s_MPa']:.1f} MPa; "
                                                   f"l_b,rqd = {a['lb_rqd_mm']:.0f}, l_b,min = {a['lb_min_mm']:.0f}; straight l_bd = {a['lbd_straight_mm']:.0f} vs {a['available_mm']:.0f} available",
                     "out": ("straight OK" if a["straight_ok"] else f"bent up, leg {a['leg_mm']:.0f} mm") + f": {a['status']}"})
    for r in det["schedule"]:
        dims = ", ".join(f"{k} {v}" for k, v in r["dims_mm"].items())
        rows.append({"ref": f"Mark {r['mark']}", "calc": f"{r.get('callout', '')}: {r['description']}; shape {r['shape_code']} ({dims}); {r['length_m']:.3f} m each",
                     "out": f"{r['total_length_m']:.2f} m, {r['mass_kg']:.2f} kg"})
    rows.append({"ref": "Schedule", "calc": "Total reinforcement (cut length = sum of shape dimensions, no bend deduction)",
                 "out": f"{det['summary']['total_mass_kg']:.2f} kg"})
    for w in det.get("warnings", []):
        rows.append({"ref": "Note", "calc": w, "out": "-"})
    return rows


# --------------------------------------------------------------------- beams
def continuous_beam_detailing(*, spans_mm: List[float], b: float, h: float, cover: float, link_phi: float,
                              bottom: List[Dict], supports: List[Dict], end_fixed: bool,
                              fck: float, fyk: float, support_width_mm: float = 230.0,
                              n_members: int = 1, hanger_phi: float = 12.0) -> Dict:
    """bottom[j] = {n, phi} per span; supports[i] = {n, phi, link_s, V_kN} for i = 0..n_spans."""
    n = len(spans_mm)
    a = support_width_mm
    xs = [a / 2]
    for L in spans_mm:
        xs.append(xs[-1] + L)
    overall = xs[-1] + a / 2
    c_bar = cover + link_phi
    top_y_free = h - 2 * c_bar
    warnings: List[str] = []
    rows: List[Dict] = []
    bars: List[Dict] = []
    anchorage: List[Dict] = []
    mk = 1
    lap12 = lap_length(hanger_phi, fyk, fck)

    # bottom bars, one mark per span
    for j, L in enumerate(spans_mm):
        nb, phi = bottom[j]["n"], bottom[j]["phi"]
        ext_int = max(10 * phi, 100.0)
        legs = {}
        ends = []
        for side, i in (("L", j), ("R", j + 1)):
            face = xs[i] + (a / 2 if side == "L" else -a / 2)
            is_end = i in (0, n)
            if is_end and not end_fixed:
                gap = (b - 2 * c_bar - nb * phi) / max(nb - 1, 1)
                an = end_anchorage(phi=phi, n_bars=nb, VEd_kN=supports[i]["V_kN"], cover=cover, support_mm=a,
                                   h=h, link_phi=link_phi, fck=fck, fyk=fyk, spacing_clear=gap)
                an["label"] = f"Span {j + 1} bottom bars at support {i + 1}"
                anchorage.append(an)
                legs[side] = an["leg_mm"]
                ends.append(cover if i == 0 else overall - cover)
            elif is_end:
                ends.append(cover if i == 0 else overall - cover)
            else:
                ends.append(face - ext_int if side == "L" else face + ext_int)
        run = ends[1] - ends[0]
        lL, lR = legs.get("L", 0), legs.get("R", 0)
        if lL or lR:
            dims = {"A": lL or 0, "B": run, "C": lR or 0}
            shape = "21" if (lL and lR) else "11"
            if shape == "11":
                dims = {"A": max(lL, lR), "B": run}
        else:
            dims, shape = {"A": run}, "00"
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, nb, n_members, shape, dims, f"span {j + 1} bottom bars")
        r["callout"] = f"{nb}-Y{phi:.0f}-{m}"
        rows.append(r)
        bars.append({"mark": m, "layer": "bottom", "x1": ends[0], "x2": ends[1], "legL": lL, "legR": lR, "label": f"{r['callout']} (B)", "span": j})

    # top bars over every support
    top_ext = []
    for i in range(n + 1):
        nt, phi = supports[i]["n"], supports[i]["phi"]
        if i in (0, n):
            L = spans_mm[0] if i == 0 else spans_mm[-1]
            reach = (0.30 if end_fixed else 0.20) * L
            if i == 0:
                x1, x2 = cover, xs[0] + a / 2 + reach
            else:
                x1, x2 = xs[-1] - a / 2 - reach, overall - cover
            leg = _f25(top_y_free)
            dims, shape = {"A": leg, "B": x2 - x1}, "11"
            desc = f"top bars at end support {i + 1} ({'fixed' if end_fixed else 'partial fixity'}), bent down"
            legL, legR = (leg, 0) if i == 0 else (0, leg)
        else:
            Lmax = max(spans_mm[i - 1], spans_mm[i])
            x1, x2 = xs[i] - 0.30 * Lmax, xs[i] + 0.30 * Lmax
            dims, shape = {"A": x2 - x1}, "00"
            desc = f"top bars over support {i + 1}, 0.30 x {Lmax:.0f} each side"
            legL = legR = 0
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, nt, n_members, shape, dims, desc)
        r["callout"] = f"{nt}-Y{phi:.0f}-{m}"
        rows.append(r)
        bars.append({"mark": m, "layer": "top", "x1": x1, "x2": x2, "legL": legL, "legR": legR, "label": f"{r['callout']} (T)", "support": i})
        top_ext.append((x1, x2))

    # hangers between the support top bars (2 bars, lapped)
    for j in range(n):
        left_end = top_ext[j][1]
        right_start = top_ext[j + 1][0]
        if right_start - left_end <= 0:
            continue
        x1, x2 = left_end - lap12, right_start + lap12
        m = _mark(mk); mk += 1
        r = schedule_row(m, hanger_phi, 2, n_members, "00", {"A": x2 - x1}, f"span {j + 1} hangers, lapped {lap12:.0f} with the support bars")
        r["callout"] = f"2-Y{hanger_phi:.0f}-{m}"
        rows.append(r)
        bars.append({"mark": m, "layer": "top", "x1": x1, "x2": x2, "legL": 0, "legR": 0, "label": f"{r['callout']} (T)", "dashed": True, "span": j})

    # links: one mark, spacing per span = the closer of its two supports
    la, lb = b - 2 * cover, h - 2 * cover
    link_zones = []
    total_links = 0
    for j, L in enumerate(spans_mm):
        s = min(supports[j]["link_s"], supports[j + 1]["link_s"])
        clear = L - a
        cnt = int(math.floor(max(clear - 2 * LINK_START_MM, 0) / s + 1e-9)) + 1
        total_links += cnt
        x1 = xs[j] + a / 2 + LINK_START_MM
        link_zones.append({"x1": x1, "x2": x1 + (cnt - 1) * s, "spacing": s, "n": cnt, "span": j})
    m = _mark(mk); mk += 1
    r = schedule_row(m, link_phi, total_links, n_members, "51", {"A": la, "B": lb, "C": HOOK_MM}, "closed links, 2 legs")
    length_m = (2 * (la + lb) + 2 * HOOK_MM) / 1000
    tot = length_m * total_links * n_members
    r.update(length_m=round(length_m, 3), total_length_m=round(tot, 3), mass_kg=round(tot * unit_mass(link_phi), 2),
             callout=", ".join(f"{z['n']}-Y{link_phi:.0f}-{m}-{z['spacing']:.0f}" for z in link_zones))
    rows.append(r)
    for z in link_zones:
        z["label"] = f"{z['n']}-Y{link_phi:.0f}-{m}-{z['spacing']:.0f}"

    if end_fixed:
        warnings.append("Continuous (monolithic) end supports: the end top bars are anchored into the supporting member; detail their anchorage there.")
    status = "OK" if all(x["status"] == "OK" for x in anchorage) else "NOT OK"
    det = {
        "element": "continuous_beam", "status": status, "warnings": warnings, "anchorage": anchorage,
        "schedule": rows, "summary": summarise(rows),
        "drawing": {"kind": "elevation", "overall_mm": overall, "h_mm": h, "b_mm": b, "cover_mm": cover,
                    "support_width_mm": a, "supports_x": xs, "spans_mm": spans_mm, "bars": bars,
                    "links": link_zones, "link_phi": link_phi,
                    "section": {"bottom": bottom[0], "top": {"n": 2, "phi": hanger_phi}}},
    }
    det["report_rows"] = _report(det, [
        "Spans between support centrelines; overall length = sum of spans + support width.",
        "Top bars over internal supports: 0.30 x longer adjacent span each side of the centreline.",
        f"Top bars at {'fixed' if end_fixed else 'simple'} end supports: {'0.30' if end_fixed else '0.20 (partial fixity, EC2 9.2.1.2(1))'} x end span beyond the face, bent down.",
        "Bottom bars into internal supports max(10φ, 100) beyond the face (EC2 9.2.1.5(1)); at simple ends anchored for F_E = V_Ed/2 (EC2 9.2.1.4).",
        f"Hangers 2Y{hanger_phi:.0f} in each span, lapped l0 = {lap12:.0f} mm with the support bars (EC2 8.7.3).",
        "Links from 50 mm inside each support face, at the closer spacing of the span's two supports.",
    ])
    return det


# ---------------------------------------------------------- continuous slab
def _dist_bars(As_main_per_m: float, h: float, phi: float = 10.0) -> Dict:
    need = 0.2 * As_main_per_m
    s_max = min(3.5 * h, 450.0)
    s = _f25(min(_area(phi) * 1000 / need if need else s_max, s_max))
    if s < 100:
        phi = 12.0
        s = _f25(min(_area(phi) * 1000 / need, s_max))
    return {"phi": phi, "spacing": max(s, 75.0), "As_req": need}


def continuous_slab_detailing(*, spans_mm: List[float], h: float, cover: float, spans: List[Dict], supports: List[Dict],
                              end_fixed: List[bool], fck: float, fyk: float, slab_width_mm: float = 1000.0,
                              support_width_mm: float = 230.0, n_members: int = 1) -> Dict:
    """spans[j] = {phi, s}; supports[i] = {phi, s, V_kN (per m)}; end_fixed = [start, end]."""
    n = len(spans_mm)
    a = support_width_mm
    W = slab_width_mm
    xs = [a / 2]
    for L in spans_mm:
        xs.append(xs[-1] + L)
    overall = xs[-1] + a / 2
    rows, bars, anchorage, warnings = [], [], [], []
    mk = 1
    for j, L in enumerate(spans_mm):
        phi, s = spans[j]["phi"], spans[j]["s"]
        nb = bar_count(W, cover, s)
        ext_int = max(10 * phi, 100.0)
        ends, legs = [], {}
        for side, i in (("L", j), ("R", j + 1)):
            face = xs[i] + (a / 2 if side == "L" else -a / 2)
            is_end = i in (0, n)
            if is_end:
                ends.append(cover if i == 0 else overall - cover)
                if not end_fixed[0 if i == 0 else 1]:
                    As_m = _area(phi) * 1000 / s
                    # per metre: F_E = V/2 on the steel per metre; one bar carries sigma = F_E / A_s,m
                    F_E = supports[i]["V_kN"] / 2
                    sigma = F_E * 1000 / As_m
                    an2 = end_anchorage(phi=phi, n_bars=1, VEd_kN=2 * sigma * _area(phi) / 1000, cover=cover, support_mm=a,
                                        h=h, link_phi=0, fck=fck, fyk=fyk, spacing_clear=s - phi)
                    an2.update(F_E_kN=round(F_E, 2), As_mm2=round(As_m, 0), sigma_s_MPa=round(sigma, 1),
                               label=f"Span {j + 1} bottom bars at support {i + 1} (per m)")
                    anchorage.append(an2)
                    legs[side] = an2["leg_mm"]
            else:
                ends.append(face - ext_int if side == "L" else face + ext_int)
        run = ends[1] - ends[0]
        lL, lR = legs.get("L", 0), legs.get("R", 0)
        if lL and lR:
            dims, shape = {"A": lL, "B": run, "C": lR}, "21"
        elif lL or lR:
            dims, shape = {"A": max(lL, lR), "B": run}, "11"
        else:
            dims, shape = {"A": run}, "00"
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, nb, n_members, shape, dims, f"span {j + 1} bottom bars (main)")
        r["callout"] = f"{nb}-Y{phi:.0f}-{m}-{s:.0f}"
        r["spacing_mm"] = s
        rows.append(r)
        bars.append({"mark": m, "layer": "bottom", "x1": ends[0], "x2": ends[1], "legL": lL, "legR": lR, "label": f"{r['callout']} (B)", "span": j})

    top_ranges = []
    for i in range(n + 1):
        phi, s = supports[i]["phi"], supports[i]["s"]
        if not phi or not s:
            continue
        nt = bar_count(W, cover, s)
        if i in (0, n):
            L = spans_mm[0] if i == 0 else spans_mm[-1]
            fixed = end_fixed[0 if i == 0 else 1]
            reach = (0.30 if fixed else 0.20) * L
            x1, x2 = (cover, xs[0] + a / 2 + reach) if i == 0 else (xs[-1] - a / 2 - reach, overall - cover)
            leg = _f25(h - 2 * cover)
            dims, shape = {"A": leg, "B": x2 - x1}, "11"
            desc = f"top bars at end support {i + 1} ({'fixed' if fixed else 'partial fixity, EC2 9.3.1.2(2)'})"
            legL, legR = (leg, 0) if i == 0 else (0, leg)
        else:
            Lmax = max(spans_mm[i - 1], spans_mm[i])
            x1, x2 = xs[i] - 0.30 * Lmax, xs[i] + 0.30 * Lmax
            dims, shape = {"A": x2 - x1}, "00"
            desc = f"top bars over support {i + 1}, 0.30 x {Lmax:.0f} each side"
            legL = legR = 0
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, nt, n_members, shape, dims, desc)
        r["callout"] = f"{nt}-Y{phi:.0f}-{m}-{s:.0f}"
        r["spacing_mm"] = s
        rows.append(r)
        bars.append({"mark": m, "layer": "top", "x1": x1, "x2": x2, "legL": legL, "legR": legR, "label": f"{r['callout']} (T)", "support": i})
        top_ranges.append((x1, x2))

    # distribution bars: bottom over the whole length, top under each top-bar group
    As_main = max(_area(sp["phi"]) * 1000 / sp["s"] for sp in spans)
    dist = _dist_bars(As_main, h)
    nd_bot = bar_count(overall, cover, dist["spacing"])
    m = _mark(mk); mk += 1
    r = schedule_row(m, dist["phi"], nd_bot, n_members, "00", {"A": W - 2 * cover}, "bottom distribution bars (across the width)")
    r["callout"] = f"{nd_bot}-Y{dist['phi']:.0f}-{m}-{dist['spacing']:.0f}"
    r["spacing_mm"] = dist["spacing"]
    rows.append(r)
    nd_top = sum(int(math.floor((x2 - x1) / dist["spacing"] + 1e-9)) + 1 for x1, x2 in top_ranges)
    if nd_top:
        m2 = _mark(mk); mk += 1
        r2 = schedule_row(m2, dist["phi"], nd_top, n_members, "00", {"A": W - 2 * cover}, "top distribution bars (under the top bars)")
        r2["callout"] = f"{nd_top}-Y{dist['phi']:.0f}-{m2}-{dist['spacing']:.0f}"
        r2["spacing_mm"] = dist["spacing"]
        rows.append(r2)

    status = "OK" if all(x["status"] == "OK" for x in anchorage) else "NOT OK"
    det = {
        "element": "continuous_slab", "status": status, "warnings": warnings, "anchorage": anchorage,
        "schedule": rows, "summary": summarise(rows), "distribution": dist, "slab_width_mm": W,
        "drawing": {"kind": "elevation", "slab": True, "overall_mm": overall, "h_mm": h, "cover_mm": cover,
                    "support_width_mm": a, "supports_x": xs, "spans_mm": spans_mm, "bars": bars, "links": [],
                    "dist": {"phi": dist["phi"], "spacing": dist["spacing"], "top_ranges": top_ranges}},
    }
    det["report_rows"] = _report(det, [
        f"Schedule for a slab width of {W:.0f} mm{' (per metre strip: enter the real width for a full schedule)' if W == 1000 else ''}; spans between support centrelines.",
        "Top bars over internal supports: 0.30 x longer adjacent span each side of the centreline.",
        "Top bars at simple end supports: 0.20 x end span beyond the face (partial fixity, EC2 9.3.1.2(2)), bent down.",
        "Bottom bars into internal supports max(10φ, 100) beyond the face; at simple ends anchored for F_E = V_Ed/2 per metre (EC2 9.2.1.4).",
        f"Distribution bars Y{dist['phi']:.0f} @ {dist['spacing']:.0f}: ≥ 0.2 A_s,main = {dist['As_req']:.0f} mm²/m, spacing ≤ min(3.5h, 450) (EC2 9.3.1.1).",
    ])
    return det


# ------------------------------------------------------------- slab panels
def slab_panel_detailing(*, slab_type: str, lx_mm: float, ly_mm: Optional[float], h: float, cover: float,
                         bottom_x: Dict, bottom_y: Optional[Dict], top_x: Optional[Dict], top_y: Optional[Dict],
                         x_cont_ends: int, y_cont_ends: int, fck: float, fyk: float, V_kN: float = 0.0,
                         support_width_mm: float = 230.0, n_members: int = 1, cantilever: bool = False) -> Dict:
    """One-way: bars span x (lx); ly = width of the panel (1000 if not given).
    Two-way: x = short span. *_ends = number of continuous edges (0, 1, 2) for the
    bars spanning that direction; a single continuous edge is drawn at the start."""
    a = support_width_mm
    one_way = slab_type == "one_way"
    Ly = ly_mm or 1000.0
    rows, warnings, anchorage, groups = [], [], [], []
    mk = 1

    def bottom_bars(dirn, span, across, bar, cont_ends):
        nonlocal mk
        phi, s = bar["phi"], bar["s"]
        n = int(math.floor(max(across - a - 2 * 50, 0) / s + 1e-9)) + 1    # between support faces, from 50 mm
        ext = []
        for k in range(2):
            continuous = (cont_ends == 2) or (cont_ends == 1 and k == 0)
            ext.append(max(10 * phi, 100.0) if continuous else a - cover)
        length = (span - a) + ext[0] + ext[1]
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, n, n_members, "00", {"A": length}, f"bottom bars spanning {dirn} ({'main' if dirn == 'x' else 'secondary'})")
        r["callout"] = f"{n}-Y{phi:.0f}-{m}-{s:.0f}"
        r["spacing_mm"] = s
        rows.append(r)
        groups.append({"mark": m, "layer": "bottom", "dir": dirn, "label": f"{r['callout']} (B)", "ext": ext})

    def top_edge(dirn, span, along, bar, which, fixed):
        nonlocal mk
        phi, s = bar["phi"], bar["s"]
        n = int(math.floor(max(along - a - 2 * 50, 0) / s + 1e-9)) + 1
        if fixed:
            reach = 0.30 * span
            length = a + 2 * reach
            dims, shape, desc = {"A": length}, "00", f"top bars over the continuous edge ({dirn} {which}), 0.30 l each side"
        else:
            reach = 0.20 * span
            leg = _f25(h - 2 * cover)
            dims, shape, desc = {"A": leg, "B": (a - cover) + reach}, "11", f"top bars at the discontinuous edge ({dirn} {which}), 0.20 l, bent down (EC2 9.3.1.2(2))"
        m = _mark(mk); mk += 1
        r = schedule_row(m, phi, n, n_members, shape, dims, desc)
        r["callout"] = f"{n}-Y{phi:.0f}-{m}-{s:.0f}"
        r["spacing_mm"] = s
        rows.append(r)
        groups.append({"mark": m, "layer": "top", "dir": dirn, "edge": which, "reach": reach, "fixed": fixed, "label": f"{r['callout']} (T)"})

    Lx, LyP = lx_mm, Ly
    if one_way:
        bottom_bars("x", Lx, LyP, bottom_x, x_cont_ends)
        As_main = _area(bottom_x["phi"]) * 1000 / bottom_x["s"]
        dist = _dist_bars(As_main, h)
        nd = int(math.floor(max(Lx - a - 100, 0) / dist["spacing"] + 1e-9)) + 1
        m = _mark(mk); mk += 1
        r = schedule_row(m, dist["phi"], nd, n_members, "00", {"A": LyP - 2 * cover}, "bottom distribution bars (along the width)")
        r["callout"] = f"{nd}-Y{dist['phi']:.0f}-{m}-{dist['spacing']:.0f}"
        r["spacing_mm"] = dist["spacing"]
        rows.append(r)
        groups.append({"mark": m, "layer": "bottom", "dir": "y", "label": f"{r['callout']} (B)", "ext": [0, 0]})
        tb = top_x or bottom_x
        for k, which in ((0, "start"), (1, "end")):
            cont = (x_cont_ends == 2) or (x_cont_ends == 1 and k == 0)
            if cont or not cantilever:
                top_edge("x", Lx, LyP, tb if cont else {"phi": 10, "s": min(tb["s"] * 2, 2 * h, 250)}, which, cont)
        if not ly_mm:
            warnings.append("One-way slab: schedule for a 1 m wide strip (no panel width entered).")
        # anchorage at simple edges
        if x_cont_ends < 2:
            phi, s = bottom_x["phi"], bottom_x["s"]
            As_m = _area(phi) * 1000 / s
            sigma = (V_kN / 2) * 1000 / As_m if As_m else 0
            an = end_anchorage(phi=phi, n_bars=1, VEd_kN=2 * sigma * _area(phi) / 1000, cover=cover, support_mm=a,
                               h=h, link_phi=0, fck=fck, fyk=fyk, spacing_clear=s - phi)
            an.update(F_E_kN=round(V_kN / 2, 2), As_mm2=round(As_m, 0), sigma_s_MPa=round(sigma, 1), label="Main bottom bars at the simple support (per m)")
            anchorage.append(an)
            if not an["straight_ok"]:
                warnings.append(f"Main bottom bars at the simple support need a bent end (leg {an['leg_mm']:.0f} mm), or a wider support.")
    else:
        bottom_bars("x", Lx, LyP, bottom_x, x_cont_ends)
        bottom_bars("y", LyP, Lx, bottom_y, y_cont_ends)
        for dirn, span, along, bar, cont_n in (("x", Lx, LyP, top_x, x_cont_ends), ("y", LyP, Lx, top_y, y_cont_ends)):
            for k, which in ((0, "start"), (1, "end")):
                cont = (cont_n == 2) or (cont_n == 1 and k == 0)
                main = bottom_x if dirn == "x" else bottom_y
                b_use = bar if (cont and bar) else {"phi": 10, "s": _f25(min(_area(10) * 1000 / (0.25 * _area(main["phi"]) * 1000 / main["s"]), 2 * h, 250))}
                top_edge(dirn, Lx, along, b_use, which, cont)   # reach from the short span (stated rule)
        if x_cont_ends < 2 and y_cont_ends < 2:
            warnings.append("Corners where two discontinuous edges meet: provide torsion reinforcement (EC2 9.3.1.3) if the corner is held down; not scheduled here.")

    status = "OK" if all(x["status"] == "OK" for x in anchorage) else "NOT OK"
    det = {
        "element": "slab", "status": status, "warnings": warnings, "anchorage": anchorage,
        "schedule": rows, "summary": summarise(rows),
        "drawing": {"kind": "panel", "one_way": one_way, "lx_mm": Lx, "ly_mm": LyP, "h_mm": h, "cover_mm": cover,
                    "support_width_mm": a, "x_cont_ends": x_cont_ends, "y_cont_ends": y_cont_ends, "groups": groups},
    }
    det["report_rows"] = _report(det, [
        "Panel dimensions between support centrelines; bars stop at the end cover at discontinuous edges and max(10φ, 100) beyond the face at continuous edges.",
        "Top bars over continuous edges: 0.30 x short span each side of the support centreline (simplified rule).",
        "Top bars at discontinuous edges: ≥ 25 % of the span steel, 0.20 x short span beyond the face, bent down (EC2 9.3.1.2(2)).",
        "Where a direction has one continuous edge, it is drawn at the start (x = 0 / y = 0).",
    ])
    return det


# ------------------------------------------------------------------ column
def column_detailing(*, levels: List[Dict], storey_height_mm: float, fck: float, fyk: float, n_members: int = 1) -> Dict:
    """levels: top storey first (as the engine returns them), each
    {level, b, h, cover, n_bars, phi, n_b_face, n_h_face, link_phi, s_max, s_red}."""
    rows, warnings, stack = [], [], []
    mk = 1
    H = storey_height_mm
    order = list(reversed(levels))            # bottom storey first
    for k, lv in enumerate(order):
        top_storey = k == len(order) - 1
        phi_above = order[k + 1]["phi"] if not top_storey else lv["phi"]
        l0 = _c25(lap_length(max(lv["phi"], phi_above), fyk, fck))
        bmax = max(lv["b"], lv["h"])
        # main bars: storey height + lap into the storey above (top storey: to the cover)
        if top_storey:
            length = H - lv["cover"]
            desc = f"{lv['level']}: main bars, top storey (end at the cover; anchor into the roof as detailed there)"
        else:
            length = H + l0
            desc = f"{lv['level']}: main bars, storey height + lap {l0:.0f} into the storey above"
        m = _mark(mk); mk += 1
        r = schedule_row(m, lv["phi"], lv["n_bars"], n_members, "00", {"A": length}, desc)
        r["callout"] = f"{lv['n_bars']}-Y{lv['phi']:.0f}-{m}"
        rows.append(r)
        # links: reduced spacing over the lap / floor zone at the bottom and below the floor at the top
        z_bot = max(l0, bmax)          # lap at the base (bottom storey: onto the foundation starters)
        z_top = bmax
        s, sr = lv["s_max"], lv["s_red"]
        mid = max(H - z_bot - z_top, 0)
        n_links = int(math.ceil(z_bot / sr)) + int(math.ceil(z_top / sr)) + int(math.ceil(mid / s)) + 1
        la, lb = lv["b"] - 2 * lv["cover"], lv["h"] - 2 * lv["cover"]
        m2 = _mark(mk); mk += 1
        r2 = schedule_row(m2, lv["link_phi"], n_links, n_members, "51", {"A": la, "B": lb, "C": HOOK_MM}, f"{lv['level']}: links")
        L_m = (2 * (la + lb) + 2 * HOOK_MM) / 1000
        tot = L_m * n_links * n_members
        r2.update(length_m=round(L_m, 3), total_length_m=round(tot, 3), mass_kg=round(tot * unit_mass(lv["link_phi"]), 2),
                  callout=f"{n_links}-Y{lv['link_phi']:.0f}-{m2}-{s:.0f}/{sr:.0f}")
        rows.append(r2)
        # EC2 9.5.3(6): no compression bar further than 150 mm from a restrained bar
        c_bar = lv["cover"] + lv["link_phi"] + lv["phi"] / 2
        ties = 0
        tie_across = 0.0          # a cross-tie spans the dimension across the face it restrains
        for face_len, nf, other in ((lv["b"], lv["n_b_face"], lv["h"]), (lv["h"], lv["n_h_face"], lv["b"])):
            if nf <= 2:
                continue
            pitch = (face_len - 2 * c_bar) / (nf - 1)
            restrained = [0, nf - 1]
            for i in range(1, nf - 1):
                if min(abs(i - j) for j in restrained) * pitch > 150:
                    restrained.append(i)
                    ties += 2            # one per opposite face pair -> a cross-tie restrains two bars
                    tie_across = max(tie_across, other)
        cross = None
        if ties:
            ties_per_set = ties // 2
            n_ct = ties_per_set * n_links
            length_ct = tie_across - 2 * lv["cover"] + 2 * 10 * lv["link_phi"]
            m3 = _mark(mk); mk += 1
            r3 = schedule_row(m3, lv["link_phi"], n_ct, n_members, "00", {"A": length_ct},
                              f"{lv['level']}: cross-ties (135° hooks, 10φ each end incl.), EC2 9.5.3(6)")
            r3["callout"] = f"{n_ct}-Y{lv['link_phi']:.0f}-{m3}"
            rows.append(r3)
            cross = ties_per_set
        stack.append({"level": lv["level"], "b": lv["b"], "h": lv["h"], "cover": lv["cover"], "n_bars": lv["n_bars"], "phi": lv["phi"],
                      "n_b_face": lv["n_b_face"], "n_h_face": lv["n_h_face"], "link_phi": lv["link_phi"], "s": s, "s_red": sr,
                      "lap_mm": 0 if top_storey else l0, "z_bot": z_bot, "z_top": z_top, "cross_ties": cross,
                      "main_mark": m, "link_mark": m2, "main_callout": r["callout"], "link_callout": r2["callout"]})
    warnings.append("Starter bars from the foundation are scheduled with the foundation; the bottom storey laps onto them.")
    det = {
        "element": "column", "status": "OK", "warnings": warnings, "anchorage": [],
        "schedule": rows, "summary": summarise(rows),
        "drawing": {"kind": "column", "storey_height_mm": H, "stack": stack},
    }
    det["report_rows"] = _report(det, [
        f"Storey height {H:.0f} mm for every storey; main bars = storey height + lap l0 (EC2 8.7.3, α6 = 1.5) into the storey above.",
        "Links at s_cl,tmax between, and at 0.6 s_cl,tmax over the larger of the lap and the larger column dimension at the bottom, and the larger dimension below the floor (EC2 9.5.3(4)).",
        "No compression bar further than 150 mm from a restrained bar; cross-ties added where needed (EC2 9.5.3(6)).",
    ])
    return det
