# backend/services/bar_selection.py
"""
"Let the engine choose the bar size", the same idea as the column page's
"Let the engine choose the bars": the element is designed once per standard
bar diameter and the passing design with the least steel is kept. Every
option is listed so the designer can take another one (bar continuity,
stock on site).

With the option off, each service designs with the user's bar only (no
silent fallback to another size): if that bar cannot work, the design fails
and says so.
"""
from typing import Callable, List, Tuple


def _passes(status) -> bool:
    return str(status).strip().upper() in ("PASS", "OK", "SAFE", "ADEQUATE")


def choose_bar(design: Callable[[int], object], candidates: List[int],
               status_of: Callable[[object], str], steel_of: Callable[[object], float],
               steel_label: str, fits=None) -> Tuple[object, dict]:
    """design(dia) -> result (may raise ValueError for a bar that cannot fit).
    Returns (result to use, info). Least steel among the passing designs;
    a tie goes to the larger bar (fewer bars to fix). Nothing passes: the
    largest bar that could be designed is returned, marked as failing."""
    options, best, last = [], None, None
    for dia in candidates:
        try:
            r = design(dia)
        except ValueError as e:
            options.append({"bar_mm": dia, "status": "not possible", "steel": None, "note": str(e)[:160]})
            continue
        ok = _passes(status_of(r))
        fit_ok, fit_note = fits(r) if fits else (True, "")
        steel = float(steel_of(r))
        options.append({"bar_mm": dia, "status": "PASS" if ok and fit_ok else "FAIL", "steel": round(steel, 2),
                        **({"note": f"{steel_label} = {round(steel, 2)}; {fit_note}"} if not fit_ok else {})})
        ok = ok and fit_ok
        last = (dia, steel, r)
        if ok and (best is None or steel < best[1] - 1e-9 or (abs(steel - best[1]) <= 1e-9 and dia > best[0])):
            best = (dia, steel, r)
    if best is None and last is None:
        raise ValueError("No bar size could be designed: " + "; ".join(
            f"T{o['bar_mm']}: {o.get('note', '')}" for o in options))
    pick = best or last
    info = {"mode": "engine", "chosen_bar_mm": pick[0], "found_passing": best is not None,
            "steel_label": steel_label, "options": options}
    return pick[2], info


def report_rows(info: dict) -> List[Tuple[str, str, str]]:
    """(reference, calculation, output) rows for any report format."""
    rows = [("Bar size", "chosen by the engine: each standard diameter designed in turn; least "
                         f"{info['steel_label']} among the passing designs (tie -> larger bar)",
             f"T{info['chosen_bar_mm']}" + ("" if info["found_passing"] else " -- no size passes")),
            ]
    for o in info["options"]:
        rows.append((f"Option T{o['bar_mm']}",
                     o.get("note") or (f"{info['steel_label']} = {o['steel']}" if o["steel"] is not None else ""),
                     o["status"] + (" (chosen)" if o["bar_mm"] == info["chosen_bar_mm"] else "")))
    return rows


def attach(result, info: dict, title: str = "Bar Size Selection"):
    """Add the selection to a result: `bar_selection` plus a report section,
    in whichever report format the element uses."""
    rows = report_rows(info)
    if isinstance(result, dict):                      # staircase
        result.setdefault("report", []).append(
            {"title": title, "rows": [{"reference": a, "calculation": b, "output": c} for a, b, c in rows]})
        result["bar_selection"] = info
        return result
    rep = result.report
    Sec, Row = type(rep[0]), type(rep[0].rows[0])
    if "ref" in Row.model_fields:                     # foundation: section / ref, calc, out
        rep.append(Sec(section=title, rows=[Row(ref=a, calc=b, out=c) for a, b, c in rows]))
    else:                                             # title / reference, calculation, output
        rep.append(Sec(title=title, rows=[Row(reference=a, calculation=b, output=c) for a, b, c in rows]))
    result.bar_selection = info
    return result


def bars_fit(label: str, b: float, cover: float, link: float, dg: float = 20.0):
    """EC2 8.2(2): clear spacing between bars in one layer >= max(phi, dg + 5, 20)
    (aggregate dg = 20 mm assumed). label like '4Y16' / '4T16'. Returns (ok, note)."""
    import re
    m = re.match(r"\s*(\d+)\D+(\d+)", label or "")
    if not m:
        return True, ""
    n, phi = int(m.group(1)), float(m.group(2))
    if n < 2:
        return True, ""
    s = (b - 2 * (cover + link) - n * phi) / (n - 1)
    need = max(phi, dg + 5, 20)
    return s >= need - 1e-6, f"{label}: clear spacing {s:.0f} mm < {need:.0f} mm (EC2 8.2), does not fit in one layer"


def run(request, design_one, field_updates, candidates, status_of, steel_of, steel_label, fits=None):
    """Shared wrapper: request.auto_bars off -> design_one(request). On -> one
    design per candidate bar (field_updates(dia) gives the request fields to
    set); the request is re-validated, so a bar that does not fit is skipped."""
    if not getattr(request, "auto_bars", False):
        return design_one(request)
    cls = type(request)

    def design(dia):
        data = {**request.model_dump(), **field_updates(dia), "auto_bars": False}
        return design_one(cls.model_validate(data))

    result, info = choose_bar(design, candidates, status_of, steel_of, steel_label, fits)
    return attach(result, info)
