# backend/engine/continuous_one_way_slab_engine.py
"""
Multi-span continuous one-way slab engine (EC2).

Uses the banded LDLt solver (banded_symmetric_solver) for the beam-element FEM:
each span is one Euler-Bernoulli element, every node is a support (vertical
restrained), end nodes pinned or fixed per request. Nodal rotations are solved,
then the bending-moment diagram is recovered with the sign convention:

        BM(x) = -Mi + Vi*x - w*x^2/2

validated against textbook continuous-beam coefficients (2-span support
-wL^2/8 & span 9wL^2/128; 3-span support -wL^2/10 & end-span 0.080wL^2).

Fixes applied (per engineer's review, matching the same review already
applied to the single-span one-way engine):

1. `continuous_slab_service.py`'s report builder was referencing
   `res.Ig_mm4`, `res.EI_Nmm2`, `res.rotations_rad`, `res.node_moments_kNm`
   -- none of which this engine ever set, so building the report crashed
   with AttributeError on every single request. This engine now actually
   computes and exposes all of them (from the all-spans-loaded case, shown
   for transparency alongside the governing envelope values used for design).

2. Cover is fixed and simple: cover_mm = clear_cover_input + 5.0 mm, always
   -- including when clear_cover is explicitly 0. Previous code did
   `if clear_cover else nominal`, which silently discarded an explicit 0.

3. Bar selection respects the user's chosen main bar (first in the supplied
   list), not the smallest available diameter. Previous code did
   `for dia in sorted(bar_diameters)`, silently overriding the user's choice.

4. Effective depth is derived iteratively from the ACTUALLY selected bar
   diameter (max 3 passes), not a fixed smallest-bar assumption computed
   once upfront and never revisited.

5. Practical span limit: any span > 4.5 m raises ValueError. A one-way slab
   beyond this is not economical -- deflection governs and typically fails
   well before bending does (see the reference worked example: a 6.0 m span
   fails deflection at 48.0 actual vs 25.18 allowable L/d, while every span
   <= 4.5 m passes). This mirrors the same check added at the API/schema
   layer -- kept here too as defense in depth for direct engine callers.

6. Pattern (checkerboard) loading, not just all-spans-loaded. UK/EC2 practice
   requires the moment envelope from load patterns, not a single load case:
   a slab designed only for "everything loaded" can understate both the
   governing sagging moment in an unloaded-alternate span and the governing
   hogging moment at a support between two loaded spans. Rather than the
   full 2^n combinatorial set (computationally wasteful and not how this is
   done in practice), this engine runs the standard simplified set:
     - All spans loaded
     - Odd spans loaded (1, 3, 5, ...), even spans unloaded
     - Even spans loaded (2, 4, 6, ...), odd spans unloaded
     - For each interior support: only the two adjacent spans loaded
   "Loaded" = 1.35Gk + 1.5Qk; "unloaded" = 1.35Gk only (EC2 5.1.3(1)P with
   the recommended gamma_G = 1.35 on every span) -- never zero, since the
   slab's own weight and finishes are always present. Takes the envelope
   (max sagging per span, max hogging and max shear per support) across
   all of them. This is the same simplification used in BS 8110
   §3.5.2.4 / common EC2 practice for continuous beam/slab design.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import math

from banded_symmetric_solver import BandedSymmetricMatrix, solve_banded_symmetric

FCTM_TABLE = {
    "C20/25": 2.2, "C25/30": 2.6, "C30/37": 2.9, "C35/45": 3.2,
    "C40/50": 3.5, "C45/55": 3.8, "C50/60": 4.1,
}
BAR_SPACINGS = [100, 125, 150, 175, 200, 225, 250]
MAX_PRACTICAL_SPAN_M = 4.5


@dataclass
class ContinuousInput:
    span_lengths_m: List[float]
    start_support: str = "pinned"     # pinned | fixed
    end_support: str = "pinned"
    thickness_mm: float = 175.0
    clear_cover_mm: float = 25.0
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"
    bar_diameters: List[int] = field(default_factory=lambda: [10, 12, 16])
    dead_load: float = 0.0            # deprecated / unused -- kept for backward compatibility only
    floor_finish: float = 0.0
    additional_dead_load: float = 0.0
    live_load: float = 0.0
    additional_live_load: float = 0.0
    gamma_concrete: float = 25.0


@dataclass
class BarChoice:
    bar_dia: int
    spacing: int
    As_prov: float


@dataclass
class SpanResult:
    index: int
    length_m: float
    M_sag_kNm: float
    As_req: float
    As_min: float
    bar: Optional[BarChoice]
    status: str
    governing_pattern: str = ""
    k: float = 0.0
    z_mm: float = 0.0


@dataclass
class SupportResult:
    index: int
    position: str           # "Start" | "Interior k" | "End"
    M_hog_kNm: float        # positive magnitude (hogging)
    shear_kN: float          # peak design shear at the support face (envelope over all patterns, max adjacent end)
    shear_reduced_kN: float  # shear at distance d from the face: V_face - w*d (EC2 6.2.1(8))
    As_req: float
    As_min: float
    bar: Optional[BarChoice]
    status: str
    governing_pattern: str = ""
    k: float = 0.0
    z_mm: float = 0.0
    shear_pattern: str = ""   # pattern giving shear_kN (not necessarily the hogging one)


@dataclass
class ContinuousResult:
    n_spans: int
    d_mm: float
    cover_mm: float
    fck: int
    fyk: int
    fctm: float
    self_weight: float
    g_k: float
    q_k: float
    w_ed: float
    spans: List[SpanResult]
    supports: List[SupportResult]
    env_sag_kNm: float
    env_hog_kNm: float
    env_shear_kN: float
    actual_slenderness: float
    slenderness_limit: float
    deflection_status: str
    deflection_base_status: str
    deflection_enhanced: bool
    v_ed: float
    v_rdc: float
    shear_status: str
    overall_status: str
    rho: float = 0.0
    rho0: float = 0.0
    ld_basic: float = 0.0
    F3: float = 1.0
    K_sys: float = 1.0
    # full-beam diagram (per metre width), x in metres -- from the
    # all-spans-loaded case, for the visual BMD/SFD plot
    x_m: List[float] = field(default_factory=list)
    bmd_kNm: List[float] = field(default_factory=list)
    sfd_kN: List[float] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    # FEM trace, exposed for the calculation report (from the all-spans-loaded
    # case specifically -- the pattern-loading envelope values used for
    # design are in spans[]/supports[] above; this trace is for transparency)
    EI_Nmm2: float = 0.0
    Ig_mm4: float = 0.0
    span_lengths_mm: List[float] = field(default_factory=list)
    rotations_rad: List[float] = field(default_factory=list)
    node_moments_kNm: List[float] = field(default_factory=list)
    elem_end_forces: List[dict] = field(default_factory=list)
    load_patterns_used: List[str] = field(default_factory=list)


# ---------- FEM core ----------
def _beam_k(EI: float, L: float):
    f = EI / L ** 3
    return [[f*12, f*6*L, -f*12, f*6*L],
            [f*6*L, f*4*L*L, -f*6*L, f*2*L*L],
            [-f*12, -f*6*L, f*12, -f*6*L],
            [f*6*L, f*2*L*L, -f*6*L, f*4*L*L]]


def _beam_f(w: float, L: float):
    p = w * L / 2.0
    m = w * L * L / 12.0
    return [-p, -m, -p, +m]


def _solve_continuous(L_list_mm: List[float], w_list: List[float], EI: float, start: str, end: str):
    """Returns per-element [Vi,Mi,Vj,Mj] (N, Nmm) and nodal rotations (rad).

    w_list is per-element load (N/mm) -- allows pattern loading by passing
    a different w per span (1.35Gk on unloaded spans), distinct from a single
    uniform w for every span.
    """
    nn = len(L_list_mm) + 1
    nd = 2 * nn
    K = [[0.0] * nd for _ in range(nd)]
    F = [0.0] * nd
    for i, L in enumerate(L_list_mm):
        w = w_list[i]
        ke = _beam_k(EI, L); fe = _beam_f(w, L); dm = [2*i, 2*i+1, 2*i+2, 2*i+3]
        for a in range(4):
            F[dm[a]] += fe[a]
            for b in range(4):
                K[dm[a]][dm[b]] += ke[a][b]
    restr = set(2 * i for i in range(nn))      # all verticals restrained (supports)
    if start == "fixed": restr.add(1)
    if end == "fixed": restr.add(2 * (nn - 1) + 1)
    free = [i for i in range(nd) if i not in restr]
    d = [0.0] * nd
    if free:
        Kr = [[K[i][j] for j in free] for i in free]
        Fr = [F[i] for i in free]
        hb = 0
        for a in range(len(free)):
            for b in range(len(free)):
                if abs(Kr[a][b]) > 0:
                    hb = max(hb, abs(a - b))
        Kb = BandedSymmetricMatrix.from_full(Kr, hb)
        xr, _ = solve_banded_symmetric(Kb, Fr)
        for idx, i in enumerate(free):
            d[i] = xr[idx]
    elems = []
    for i, L in enumerate(L_list_mm):
        w = w_list[i]
        ke = _beam_k(EI, L); fe = _beam_f(w, L); dm = [2*i, 2*i+1, 2*i+2, 2*i+3]
        de = [d[k] for k in dm]
        qe = [sum(ke[a][b] * de[b] for b in range(4)) - fe[a] for a in range(4)]
        elems.append({"Vi": qe[0], "Mi": qe[1], "Vj": qe[2], "Mj": qe[3], "L": L, "w": w})
    rotations = [d[2 * i + 1] for i in range(nn)]   # nodal rotations (rad)
    return elems, rotations


def _element_bm(el, x):
    """Sagging-positive bending moment at distance x (mm) from left node (Nmm)."""
    return -el["Mi"] + el["Vi"] * x - el["w"] * x * x / 2.0


def _build_load_patterns(n_spans: int, w_full: float, w_perm: float) -> List[Dict]:
    """Standard simplified continuous-beam load cases (EC2 5.1.3(1)P), not the
    full 2^n combinatorial set. Each pattern is (label, per-span w list in
    N/mm). Loaded spans carry w_full = 1.35Gk + 1.5Qk; unloaded spans carry
    w_perm = 1.35Gk (permanent load is always present)."""
    patterns = [
        {"label": "All spans loaded", "w": [w_full] * n_spans},
    ]
    if n_spans > 1:
        odd = [w_full if i % 2 == 0 else w_perm for i in range(n_spans)]
        even = [w_full if i % 2 == 1 else w_perm for i in range(n_spans)]
        patterns.append({"label": "Alternate spans loaded (1,3,5,...)", "w": odd})
        patterns.append({"label": "Alternate spans loaded (2,4,6,...)", "w": even})
        for k in range(n_spans - 1):
            w_list = [w_perm] * n_spans
            w_list[k] = w_full
            w_list[k + 1] = w_full
            patterns.append({"label": f"Spans {k + 1}-{k + 2} loaded (support {k + 1} hogging)", "w": w_list})
    return patterns


# ---------- material / section helpers ----------
def _fck(g): return int(g.split("C")[1].split("/")[0])
def _fyk(g): return int(g.replace("B", ""))


def _fctm(fck: float, grade: str) -> float:
    if grade in FCTM_TABLE:
        return FCTM_TABLE[grade]
    return 0.30 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)


def _design_As(M_kNm, b, d, fck, fyk, fctm):
    ys = 1.15; fyd = fyk / ys
    M = abs(M_kNm) * 1e6
    M_bal = 0.167 * fck * b * d ** 2
    if M <= M_bal:
        k = M / (fck * b * d ** 2) if (fck*b*d**2) else 0.0
        z = min(d * (0.5 + math.sqrt(max(0.25 - k / 1.134, 0.0))), 0.95 * d)
        As = M / (z * fyd) if z else 0.0
    else:
        k = M_bal / (fck * b * d ** 2) if (fck*b*d**2) else 0.0
        z = 0.82 * d
        As = M_bal / (0.87 * fyk * z) + (M - M_bal) / (0.87 * fyk * (0.9 * d))
    As_min = max((0.26 * fctm / fyk) * b * d, 0.0013 * b * d)
    return max(As, As_min), As_min, k, z


def _choose_bar(As_req, bar_diameters):
    # Preserve caller order -- the frontend sends the user's selected main
    # bar FIRST. Sorting here would silently override that choice with
    # whatever the smallest available diameter is.
    for dia in bar_diameters:
        area = math.pi * dia ** 2 / 4.0
        feas = [(s, area * 1000.0 / s) for s in BAR_SPACINGS if area * 1000.0 / s >= As_req]
        if feas:
            s, ap = max(feas, key=lambda t: t[0])
            return BarChoice(dia, s, ap)
    dia = max(bar_diameters); area = math.pi * dia ** 2 / 4.0
    return BarChoice(dia, BAR_SPACINGS[0], area * 1000.0 / BAR_SPACINGS[0])


def design_continuous_slab(inp: ContinuousInput) -> ContinuousResult:
    oversized = [L for L in inp.span_lengths_m if L > MAX_PRACTICAL_SPAN_M]
    if oversized:
        raise ValueError(
            f"Span length(s) {oversized} m exceed the practical one-way slab limit of "
            f"{MAX_PRACTICAL_SPAN_M} m. Deflection governs beyond this and typically fails "
            f"well before bending does -- consider a two-way slab, beam-and-slab system, or "
            f"flat slab instead."
        )

    b = 1000.0
    fck = _fck(inp.concrete_grade); fyk = _fyk(inp.steel_grade)
    fctm = _fctm(fck, inp.concrete_grade)
    n_spans = len(inp.span_lengths_m)
    L_mm = [Lm * 1000.0 for Lm in inp.span_lengths_m]

    self_weight = inp.gamma_concrete * (inp.thickness_mm / 1000.0)
    g_k = self_weight + inp.floor_finish + inp.additional_dead_load
    q_k = inp.live_load + inp.additional_live_load
    w_ed = 1.35 * g_k + 1.5 * q_k          # kN/m^2 == N/mm on 1 m strip

    patterns = _build_load_patterns(n_spans, w_ed, 1.35 * g_k)

    cover = inp.clear_cover_mm + 5.0   # fixed 5 mm detailing/fixing tolerance -- always, including clear_cover = 0
    bar_dia = inp.bar_diameters[0] if inp.bar_diameters else 12
    d = inp.thickness_mm - cover - bar_dia / 2.0

    spans: List[SpanResult] = []
    supports: List[SupportResult] = []
    all_loaded_elems = None
    all_loaded_rotations = None
    all_loaded_node_moments = None

    for _ in range(3):   # iterate d <-> actually-selected bar diameter
        d = inp.thickness_mm - cover - bar_dia / 2.0

        # governing (envelope) values across all patterns
        span_gov_M = [0.0] * n_spans
        span_gov_pattern = [""] * n_spans
        node_gov_hog = [0.0] * (n_spans + 1)
        node_gov_pattern = [""] * (n_spans + 1)
        node_gov_shear = [0.0] * (n_spans + 1)   # peak |V| at that node over all patterns
        node_shear_pattern = [""] * (n_spans + 1)

        x_all: List[float] = []; bmd: List[float] = []; sfd: List[float] = []

        for p in patterns:
            elems, rotations = _solve_continuous(L_mm, p["w"], _EI(inp.thickness_mm, b), inp.start_support, inp.end_support)
            node_moments = []
            for i, el in enumerate(elems):
                if i == 0:
                    node_moments.append(_element_bm(el, 0.0))
                node_moments.append(_element_bm(el, el["L"]))
                # max sagging within this span for this pattern
                max_sag = max(_element_bm(el, el["L"] * t / 50.0) for t in range(0, 51))
                if max_sag > span_gov_M[i]:
                    span_gov_M[i] = max_sag
                    span_gov_pattern[i] = p["label"]

            for n in range(n_spans + 1):
                Mn = node_moments[n]
                hog = -Mn if Mn < 0 else 0.0
                if hog > node_gov_hog[n]:
                    node_gov_hog[n] = hog
                    node_gov_pattern[n] = p["label"]
                # Shear is enveloped on its own. It used to be recorded only
                # when this pattern set a new hogging max, so a pinned end
                # (hogging ~0, sign decided by round-off) could report V = 0.
                v_left = abs(elems[n - 1]["Vi"] - elems[n - 1]["w"] * elems[n - 1]["L"]) if n > 0 else 0.0
                v_right = abs(elems[n]["Vi"]) if n < len(elems) else 0.0
                if max(v_left, v_right) > node_gov_shear[n]:
                    node_gov_shear[n] = max(v_left, v_right)
                    node_shear_pattern[n] = p["label"]

            if p["label"] == "All spans loaded":
                all_loaded_elems = elems
                all_loaded_rotations = rotations
                all_loaded_node_moments = node_moments
                x_offset = 0.0
                for el in elems:
                    for t in range(0, 51):
                        x = el["L"] * t / 50.0
                        x_all.append((x_offset + x) / 1000.0)
                        bmd.append(_element_bm(el, x) / 1e6)
                        sfd.append((el["Vi"] - el["w"] * x) / 1000.0)
                    x_offset += el["L"]

        spans = []
        for i in range(n_spans):
            As_req, As_min, k_span, z_span = _design_As(span_gov_M[i] / 1e6, b, d, fck, fyk, fctm)
            bar = _choose_bar(As_req, inp.bar_diameters)
            st = "PASS" if bar and bar.As_prov >= As_req else "FAIL"
            spans.append(SpanResult(i + 1, inp.span_lengths_m[i], max(span_gov_M[i] / 1e6, 0.0),
                                     As_req, As_min, bar, st, span_gov_pattern[i], k_span, z_span))

        supports = []
        for n in range(n_spans + 1):
            hog_kNm = node_gov_hog[n] / 1e6
            shear_face_kN = node_gov_shear[n] / 1000.0
            shear_reduced_kN = max(shear_face_kN - w_ed * (d / 1000.0), 0.0)
            pos = "Start" if n == 0 else ("End" if n == n_spans else f"Interior {n}")
            As_req, As_min, k_sup, z_sup = _design_As(hog_kNm, b, d, fck, fyk, fctm)
            bar = _choose_bar(As_req, inp.bar_diameters)
            st = "PASS" if (hog_kNm == 0 or (bar and bar.As_prov >= As_req)) else "FAIL"
            supports.append(SupportResult(n, pos, hog_kNm, shear_face_kN, shear_reduced_kN,
                                           As_req, As_min, bar, st, node_gov_pattern[n], k_sup, z_sup,
                                           shear_pattern=node_shear_pattern[n]))

        gov_dia = max((s.bar.bar_dia for s in spans + supports if s.bar), default=bar_dia)
        if gov_dia == bar_dia:
            break
        bar_dia = gov_dia

    # envelopes
    env_sag = max((s.M_sag_kNm for s in spans), default=0.0)
    env_hog = max((s.M_hog_kNm for s in supports), default=0.0)
    env_shear = max((s.shear_kN for s in supports), default=0.0)
    env_shear_reduced = max((s.shear_reduced_kN for s in supports), default=0.0)

    as_prov_span = max((s.bar.As_prov for s in spans if s.bar), default=0.0)
    as_prov_supp = max((s.bar.As_prov for s in supports if s.bar), default=0.0)
    as_prov_gov = max(as_prov_span, as_prov_supp)

    # deflection: governing span (longest sagging demand)
    gov_span = max(spans, key=lambda s: s.M_sag_kNm) if spans else None
    if gov_span and d:
        L_gov_mm = gov_span.length_m * 1000.0
        actual_slenderness = L_gov_mm / d
        rho = gov_span.As_req / (b * d)
        rho0 = 1e-3 * math.sqrt(fck)
        # EC2 Table 7.4N structural system factor K -- previously omitted
        # entirely from this formula, which systematically understated the
        # allowable ratio for every continuous span. A span at either end of
        # the run behaves as an "end span" (one end continuous, effectively
        # simply supported at the outer end when that support is pinned);
        # any other span behaves as a true "interior span".
        gi = gov_span.index - 1   # 0-based span index
        is_first = gi == 0
        is_last = gi == n_spans - 1
        if (is_first and inp.start_support == "pinned") or (is_last and inp.end_support == "pinned"):
            K_sys = 1.3   # end span
        else:
            K_sys = 1.5   # interior span
        if rho and rho <= rho0:
            ld_basic = K_sys * (11 + 1.5 * math.sqrt(fck) * (rho0 / rho) + 3.2 * math.sqrt(fck) * max((rho0 / rho) - 1, 0.0) ** 1.5)
        else:
            # Eq. 7.16b with no compression steel (rho' = 0): K[11 + 1.5 sqrt(fck) rho0/rho].
            # Was K(11 + 1.5 sqrt(fck)), dropping rho0/rho (< 1 here): unconservative.
            ld_basic = K_sys * (11 + 1.5 * math.sqrt(fck) * ((rho0 / rho) if rho else 1.0))
        # Two-stage check (matches the one-way/two-way engines): F3 is only
        # applied if the slab fails the base (unmodified) ratio.
        deflection_base_status = "PASS" if actual_slenderness <= ld_basic else "FAIL"
        if deflection_base_status == "PASS":
            F3 = 1.0
            slenderness_limit = ld_basic
            deflection_status = "PASS"
            deflection_enhanced = False
        else:
            F3 = min((gov_span.bar.As_prov / gov_span.As_req), 1.5) if (gov_span.bar and gov_span.As_req) else 1.0
            slenderness_limit = ld_basic * F3
            deflection_status = "PASS" if actual_slenderness <= slenderness_limit else "FAIL"
            deflection_enhanced = True
    else:
        actual_slenderness = slenderness_limit = ld_basic = rho = rho0 = 0.0
        K_sys = 1.0; F3 = 1.0
        deflection_status = "FAIL"; deflection_base_status = "FAIL"; deflection_enhanced = False

    # shear (EC2 6.2.1(8): critical section at d from support face)
    C_Rdc = 0.18 / 1.5
    k_sh = min(2.0, 1 + (200.0 / d) ** 0.5) if d else 1.0
    v_ed = env_shear_reduced * 1000.0 / (b * d) if d else 0.0
    rho_l = min(as_prov_gov / (b * d), 0.02) if d else 0.0
    v_rdc = max(C_Rdc * k_sh * (100 * rho_l * fck) ** (1 / 3), 0.035 * k_sh ** 1.5 * fck ** 0.5)
    shear_status = "PASS" if v_ed <= v_rdc else "FAIL"

    checks = [s.status for s in spans] + [s.status for s in supports] + [deflection_status, shear_status]
    overall = "PASS" if all(c == "PASS" for c in checks) else "FAIL"

    notes = [
        "Continuous beam-element FEM; 1 element per span, every node a support.",
        "Moment recovery: BM(x) = -Mi + Vi*x - w*x^2/2.",
        f"Governing moments taken as the envelope across {len(patterns)} load patterns "
        f"(all-spans-loaded, alternate-span, and adjacent-pair-at-each-support), per UK/EC2 practice.",
        "Effective depth derived from the actually-selected governing bar diameter (iterative).",
        "Cover = clear cover input + 5 mm fixed detailing tolerance.",
        f"Practical span limit enforced: no span may exceed {MAX_PRACTICAL_SPAN_M} m.",
        "Shear checked at the critical section d from the support face (EC2 6.2.1(8)), using the reduced shear.",
    ]

    I = b * inp.thickness_mm ** 3 / 12.0
    EI = _EI(inp.thickness_mm, b)

    return ContinuousResult(
        n_spans=n_spans, d_mm=d, cover_mm=cover, fck=fck, fyk=fyk, fctm=fctm,
        self_weight=self_weight, g_k=g_k, q_k=q_k, w_ed=w_ed,
        spans=spans, supports=supports,
        env_sag_kNm=env_sag, env_hog_kNm=env_hog, env_shear_kN=env_shear_reduced,
        actual_slenderness=actual_slenderness, slenderness_limit=slenderness_limit,
        deflection_status=deflection_status, deflection_base_status=deflection_base_status,
        deflection_enhanced=deflection_enhanced,
        v_ed=v_ed, v_rdc=v_rdc, shear_status=shear_status,
        overall_status=overall, x_m=x_all, bmd_kNm=bmd, sfd_kN=sfd, notes=notes,
        rho=rho, rho0=rho0, ld_basic=ld_basic, F3=F3, K_sys=K_sys,
        EI_Nmm2=float(EI), Ig_mm4=float(I), span_lengths_mm=[float(x) for x in L_mm],
        rotations_rad=[float(t) for t in (all_loaded_rotations or [])],
        node_moments_kNm=[float(m) / 1e6 for m in (all_loaded_node_moments or [])],
        elem_end_forces=[{"Vi": e["Vi"], "Mi": e["Mi"], "Vj": e["Vj"], "Mj": e["Mj"], "L": e["L"]}
                          for e in (all_loaded_elems or [])],
        load_patterns_used=[p["label"] for p in patterns],
    )


def _EI(thickness_mm: float, b: float) -> float:
    E = 33000.0  # MPa (uniform EI; value does not affect moments for a prismatic continuous beam)
    I = b * thickness_mm ** 3 / 12.0
    return E * I