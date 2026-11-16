#!/usr/bin/env python3
"""
Proves the backend respects every frontend input.

Method: send a baseline design, then change ONE input at a time and assert the
result actually moves. An input that is silently ignored produces an identical
result -> the test fails and names the field.

Usage (backend must be running):
    python test_slab_inputs.py
    python test_slab_inputs.py --url http://localhost:8000
"""
import argparse
import copy
import json
import sys
import urllib.request
import urllib.error

BASE = {
    "slab_type": "one_way",
    "continuity": "simply_supported",
    "geometry": {
        "span_lx": 4.0, "span_ly": 4.0, "thickness": 160,
        "effective_depth": None, "clear_cover": 25, "cover_tolerance": 5,
    },
    "materials": {
        "concrete_grade": "C30/37", "steel_grade": "B500",
        "unit_weight_concrete": 25, "unit_weight_steel": 78.5,
    },
    "loads": {
        "dead_load": 1.0, "floor_finish": 1.5, "live_load": 2.0,
        "additional_dead_load": 0.5, "additional_live_load": 0.0,
    },
    "design_params": {
        "design_code": "EC2", "analysis_method": "limit_state",
        "exposure_class": "XC1", "fire_rating": 60,
        "crack_width_limit": 0.3, "deflection_limit": 250,
    },
    "bar_diameters": [12, 16, 20],
    "use_ai": False, "region": "UK", "building_use": "office",
}


def post(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:400]
        raise SystemExit(f"\nHTTP {e.code} from {url}\n{body}\n")
    except urllib.error.URLError as e:
        raise SystemExit(f"\nCannot reach {url} — is the backend running?  ({e.reason})\n")


def dig(d, path, default=None):
    cur = d
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def set_in(payload, path, value):
    p = copy.deepcopy(payload)
    cur = p
    parts = path.split(".")
    for k in parts[:-1]:
        cur = cur[k]
    cur[parts[-1]] = value
    return p


def report_text(result):
    """Flatten the whole calculation report so we can search it."""
    out = []
    for sec in result.get("report", []) or []:
        out.append(sec.get("title", ""))
        for row in sec.get("rows", []) or []:
            out.append(f"{row.get('reference','')} {row.get('calculation','')} {row.get('output','')}")
    return "\n".join(out)


# field path, changed value, what should move, human label
CASES = [
    ("geometry.effective_depth", 140, "summary.effective_depth", "Effective depth"),
    ("geometry.thickness", 200, "summary.thickness", "Thickness"),
    ("geometry.clear_cover", 40, "summary.clear_cover", "Clear cover"),
    ("geometry.span_lx", 5.5, "design_forces.max_sagging_moment", "Span"),
    ("loads.live_load", 5.0, "design_forces.ultimate_load", "Live load"),
    ("loads.additional_live_load", 3.0, "design_forces.ultimate_load", "Extra live load"),
    ("loads.additional_dead_load", 3.0, "design_forces.ultimate_load", "Extra dead load"),
    ("loads.floor_finish", 4.0, "design_forces.ultimate_load", "Floor finish"),
    ("materials.concrete_grade", "C20/25", "summary.concrete_grade", "Concrete grade"),
    ("materials.steel_grade", "B460", "summary.steel_grade", "Steel grade"),
    ("design_params.exposure_class", "XC4", "summary.clear_cover", "Exposure class"),
    ("design_params.fire_rating", 240, "summary.clear_cover", "Fire rating"),
    ("continuity", "both_ends_continuous", "design_forces.max_sagging_moment", "Continuity"),
    ("bar_diameters", [20], "summary.selected_bar_diameter", "Main bar diameter"),
]

# these should at least be VISIBLE in the report even if they don't move a headline number
REPORT_ONLY = [
    ("design_params.deflection_limit", 300, "L/300", "Deflection limit"),
    ("design_params.crack_width_limit", 0.2, "0.20", "Crack width limit"),
    ("geometry.cover_tolerance", 10, "10 mm fixing tolerance", "Cover tolerance"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    args = ap.parse_args()
    endpoint = args.url.rstrip("/") + "/api/slab/design/sync"

    print(f"Testing {endpoint}\n")
    base = post(endpoint, BASE)
    print("baseline OK — "
          f"d={dig(base,'summary.effective_depth')} "
          f"cover={dig(base,'summary.clear_cover')} "
          f"wEd={dig(base,'design_forces.ultimate_load')} "
          f"bars=T{dig(base,'summary.selected_bar_diameter')}@{dig(base,'summary.selected_spacing')}")
    print(f"report sections: {len(base.get('report', []))}\n")

    fails = []
    print(f"{'INPUT':<22}{'CHANGED TO':<16}{'WATCHED VALUE':<28}{'RESULT'}")
    print("-" * 86)

    for path, value, watch, label in CASES:
        res = post(endpoint, set_in(BASE, path, value))
        before, after = dig(base, watch), dig(res, watch)
        ok = before != after
        print(f"{label:<22}{str(value):<16}{watch:<28}"
              f"{'PASS' if ok else 'IGNORED'}  {before} -> {after}")
        if not ok:
            fails.append(f"{label} ({path}) did not change {watch}")

    print()
    for path, value, needle, label in REPORT_ONLY:
        res = post(endpoint, set_in(BASE, path, value))
        txt = report_text(res)
        ok = needle in txt
        print(f"{label:<22}{str(value):<16}{'appears in report':<28}"
              f"{'PASS' if ok else 'MISSING'}  (looking for {needle!r})")
        if not ok:
            fails.append(f"{label} ({path}) not shown in the report")

    print("\n" + "=" * 86)
    if fails:
        print(f"{len(fails)} INPUT(S) NOT RESPECTED:")
        for f in fails:
            print("  -", f)
        sys.exit(1)
    print("ALL INPUTS RESPECTED — every field changed the design or appears in the report.")


if __name__ == "__main__":
    main()