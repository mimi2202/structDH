#!/usr/bin/env python3
"""
Isolates WHERE the effective depth is being lost: disk files, or the running API.

Run from the backend folder (with the backend running):
    python diag_depth.py
    python diag_depth.py --url http://localhost:8000
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

PAYLOAD = {
    "slab_type": "one_way",
    "continuity": "simply_supported",
    "geometry": {"span_lx": 4.0, "span_ly": 5.0, "thickness": 130,
                 "effective_depth": 120, "clear_cover": 15, "cover_tolerance": 5},
    "materials": {"concrete_grade": "C30/37", "steel_grade": "B500",
                  "unit_weight_concrete": 25, "unit_weight_steel": 78.5},
    "loads": {"dead_load": 1.5, "floor_finish": 1.0, "live_load": 3.0,
              "additional_dead_load": 0.0, "additional_live_load": 0.0},
    "design_params": {"design_code": "EC2", "analysis_method": "limit_state",
                      "exposure_class": "XC3", "fire_rating": 60,
                      "crack_width_limit": 0.3, "deflection_limit": 250},
    "bar_diameters": [10, 12, 16],
    "use_ai": False, "region": "UK", "building_use": "office",
}


def step1_files():
    print("STEP 1 - files on disk")
    print("-" * 62)
    ok = True
    checks = [
        ("engine/one_way_slab_engine.py", "effective_depth_mm",
         "engine accepts the user's effective depth"),
        ("services/slab_service.py", "_build_one_way_input",
         "service passes it to the engine"),
        ("models/schemas.py", "cover_tolerance",
         "schema accepts cover tolerance"),
    ]
    for path, marker, what in checks:
        if not os.path.exists(path):
            print(f"  MISSING  {path}")
            ok = False
            continue
        body = open(path, encoding="utf-8", errors="ignore").read()
        if marker in body:
            print(f"  OK       {path}  ({what})")
        else:
            print(f"  OLD      {path}  -- {what}: NOT PRESENT")
            ok = False
    if not ok:
        print("\n  -> Replace the files marked OLD/MISSING, then restart the backend.")
    return ok


def step2_api(url):
    print("\nSTEP 2 - what the running API returns")
    print("-" * 62)
    endpoint = url.rstrip("/") + "/api/slab/design/sync"
    req = urllib.request.Request(endpoint, data=json.dumps(PAYLOAD).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:300]}")
        return False
    except urllib.error.URLError as e:
        print(f"  Cannot reach {endpoint} ({e.reason})")
        print("  Is the backend running, and on this port?")
        return False

    s = res.get("summary", {})
    d = s.get("effective_depth")
    cover = s.get("clear_cover")
    ly = s.get("span_ly")
    titles = [sec.get("title", "") for sec in res.get("report", []) or []]

    print(f"  sent   : effective_depth=120, clear_cover=15, span_ly=5.0")
    print(f"  got    : effective_depth={d}, clear_cover={cover}, span_ly={ly}")
    print(f"  warnings returned: {len(res.get('warnings') or [])}")
    print(f"  report section 3 : {titles[2] if len(titles) > 2 else '(none)'}")

    good = True
    if d != 120:
        print(f"\n  X effective depth NOT respected (got {d}, expected 120)")
        if d == 100:
            print("    130 - 25 - 5 = 100 -> the OLD engine is still deriving d.")
        good = False
    else:
        print("\n  OK effective depth respected")
    if cover != 15:
        print(f"  X cover NOT respected (got {cover}, expected 15)")
        good = False
    else:
        print("  OK cover respected")
    if ly not in (0, 0.0, None):
        print(f"  X span_ly should be 0 for a one-way slab (got {ly})")
        good = False
    else:
        print("  OK no Ly on one-way")
    if len(titles) > 2 and "Design Inputs" not in titles[2]:
        print("  X report section 3 is not 'Design Inputs Used' -> old slab_service.py")
        good = False
    return good


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    args = ap.parse_args()
    if not os.path.isdir("engine"):
        print("Run this from the backend folder (it should contain engine/).")
        sys.exit(2)
    files_ok = step1_files()
    api_ok = step2_api(args.url)
    print()
    if files_ok and api_ok:
        print("Everything respected. If the UI still shows old values, hard-refresh (Ctrl+Shift+R).")
    elif files_ok and not api_ok:
        print("Files are correct on disk but the API disagrees -> the backend was not restarted,")
        print("or a different backend/port is answering. Restart python server.py and re-run.")
    else:
        print("Replace the files marked OLD, restart the backend, then re-run this script.")
        sys.exit(1)