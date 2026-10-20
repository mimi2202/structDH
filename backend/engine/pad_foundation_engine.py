# backend/engine/pad_foundation_engine.py
"""
Isolated pad foundation design engine (EC2 + EC7).

This is a structural refactor of a working reference script (source:
Foundation.docx), not a re-derivation. Every formula, coefficient, and
rounding rule below is carried over unchanged -- the only thing that changed
is the shape of the output: the original printed its working to the console;
this returns a structured result plus a list of report sections/rows, the
same shape every other engine in this project returns, so it can sit behind
a FastAPI endpoint and a results page.

Verified against the original script: for the script's own default inputs,
geometry, eccentricity, soil pressure, one-way shear and punching shear all
match the printed output exactly (qmax=122.673, q0=103.843, shear and
punching both OK) -- see verify_pad_foundation.py. Flexural reinforcement
(K, z, As, spacing) is the one place this now deliberately differs from the
original script -- see the note below.

Lever-arm constant corrected to the EC2 standard. The source script used
z = d[0.5 + sqrt(0.25 - K/0.9)]. Every other engine in this project
(one_way_slab_engine.py, beam_ss_engine.py, etc.) uses
z = d[0.5 + sqrt(0.25 - K/1.134)] for the same K = M/(b d^2 fck) definition
-- 1.134 is the standard EC2 constant for that K definition; 0.9 is the
BS8110 constant for K = M/(b d^2 fcu). The script is labelled EC2 throughout
and never mentions BS8110, so 0.9 was almost certainly carried over from a
BS8110 source. Changed to 1.134 on explicit instruction, matching the rest
of this project. This makes the lever arm z very slightly larger for the
same K, and so the resulting As,req, As,design and bar spacing differ from
the original script's own printed numbers by a small amount -- expected,
not a defect in either version.

Bearing on SLS loads (changed 2026-10-20). The source script compared the
ULS pressure with the allowable bearing pressure, which is a service
(working) value, so every footing was ~1.35-1.5x too heavily loaded on the
soil. Bearing and uplift are now checked on the service column loads plus
the footing self-weight, as in combined_footing_engine.py. Service loads
not given -> the ULS loads are used (conservative, the old behaviour). The
structural design (moments, shear, punching) stays on the ULS net pressure.

Shear and punching (changed 2026-10-20), as in combined_footing_engine.py:
  - One-way shear: rho_l from the steel provided in that direction (was a
    fixed 0.002), capped at 0.02. fctm from EC2 Table 3.1 (was 2.6 / 2.9).
  - Punching: EC2 6.4.4(2) for foundations -- control perimeters at
    a <= 2d, V_Ed,red = N - q0 x (area inside), v_Ed = beta V_Ed,red/(u d)
    with beta from Eq. 6.51, against v_Rd = v_Rd,c 2d/a (Eq. 6.50); d and
    rho_l are the means of the two directions (6.4.2(1), 6.4.4(1)). The
    script used one perimeter at 2d with relief (cx+4d)(cy+4d) x qmax and
    clamped V_Ed to 0 when that area was larger than the footing, so most
    pads printed 0%. A perimeter must lie on the footing; if none does,
    punching is not a valid mechanism and one-way shear governs. Plus
    v_Rd,max = 0.5 nu fcd at the column face (6.4.5(3), UK NA).

Column shape, position and fixity (added 2026-10-20):
  - Circular column (column_x_mm = diameter D): punching on u = pi(D + 2a)
    with beta = 1 + 0.6 pi e/(D + 2a) per direction (Eq. 6.53 at a = 2d);
    bending and one-way shear taken at the face of the equal-area square,
    side 0.886D.
  - Column offset (ox, oy) from the footing centre: the footing takes
    N x offset as extra moment (ULS and SLS), the overhangs become unequal
    and the larger one is designed; the punching relief uses the ULS
    pressure under the column centre. An edge/corner column flush with
    the footing edge has no full control perimeter on the footing, so
    punching is reported not applicable (truncated perimeters of EC2
    Fig. 6.15 are not modelled).
  - Pinned base: the column moments are not passed to the footing.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, Optional

from engine.combined_footing_engine import _fctm, _k_table_6_1


def bar_area(phi: float) -> float:
    return math.pi * phi ** 2 / 4


@dataclass
class PadFoundationInput:
    axial_load_kN: float = 233.647

    # Set either or both moments.
    # Axial only: Mx = 0, My = 0
    # Uniaxial: one moment only
    # Biaxial: both Mx and My
    moment_x_kNm: float = 6.592
    moment_y_kNm: float = 4.000

    footing_length_mm: float = 1500
    footing_width_mm: float = 1500
    footing_depth_mm: float = 450

    column_x_mm: float = 300
    column_y_mm: float = 300

    concrete_grade_fck: float = 25
    steel_grade_fyk: float = 500

    allowable_bearing_kN_m2: float = 100

    cover_mm: float = 75
    bar_dia_mm: float = 12

    gamma_c: float = 1.5
    gamma_s: float = 1.15

    # Service (SLS) column loads for the bearing check. None -> ULS used.
    service_axial_kN: Optional[float] = None
    service_moment_x_kNm: Optional[float] = None
    service_moment_y_kNm: Optional[float] = None
    unit_weight_concrete: float = 25.0

    column_shape: str = "rectangular"    # "circular": column_x_mm is the diameter
    column_offset_x_mm: float = 0.0      # column centre from footing centre, +x
    column_offset_y_mm: float = 0.0
    column_pinned: bool = False          # pinned base: column moments not transferred


@dataclass
class FlexuralResult:
    direction: str
    M_kNm_per_m: float
    K: float
    z_mm: float
    As_req: float
    As_min: float
    As_design: float
    spacing_mm: float
    As_provided: float
    status: str


@dataclass
class ShearResult:
    direction: str
    VEd_kN_m: float
    VRdc_kN_m: float
    status: str
    rho_l: float = 0.0


@dataclass
class PunchingResult:
    vEd: float
    vRdc: float           # basic v_Rd,c (at a = 2d)
    u1_m: float           # governing control perimeter
    area_inside_m2: float
    upward_reaction_kN: float
    VEd_punch_kN: float   # V_Ed,red
    status: str
    applicable: bool      # False: no control perimeter a <= 2d fits on the footing
    d_eff_mm: float
    rho_l: float
    q_relief: float       # ULS net pressure used for the relief
    a_mm: float           # governing control perimeter distance from the column face
    beta: float
    vRd: float            # v_Rd,c x 2d/a
    ratio: float
    v0: float             # column face, u0
    vRdmax: float
    ratio0: float


@dataclass
class PadFoundationResult:
    L_m: float
    B_m: float
    area_m2: float
    projection_x_mm: float
    projection_y_mm: float
    d_eff_x_mm: float
    d_eff_y_mm: float

    ex_m: float
    ey_m: float
    ex_within_middle_third: bool
    ey_within_middle_third: bool

    q0: float
    qmax: float
    qmin: float
    corner_pressures: Dict[str, float]
    bearing_status: str
    uplift_status: str

    # SLS bearing (q0/qmax/qmin/corner_pressures above are the ULS net
    # pressure used for the structural design)
    sls_from_uls: bool
    footing_weight_kN: float
    sls_total_load_kN: float
    sls_Mx_kNm: float
    sls_My_kNm: float
    sls_ex_m: float
    sls_ey_m: float
    sls_q0: float
    sls_qmax: float
    sls_qmin: float
    sls_corner_pressures: Dict[str, float]

    Mx_kNm_per_m: float
    My_kNm_per_m: float

    flex_x: FlexuralResult
    flex_y: FlexuralResult
    shear_x: ShearResult
    shear_y: ShearResult
    punching: PunchingResult

    load_case: str
    overall_status: str

    # column shape / position used above
    column_face_x_mm: float = 0.0        # 0.886D for a circular column
    column_face_y_mm: float = 0.0
    Mx_total_kNm: float = 0.0            # ULS, about the footing centre
    My_total_kNm: float = 0.0
    projection_x_min_mm: float = 0.0     # shorter overhang (offset column)
    projection_y_min_mm: float = 0.0


def _load_case(moment_x: float, moment_y: float) -> str:
    if moment_x == 0 and moment_y == 0:
        return "AXIAL LOAD ONLY"
    if moment_x != 0 and moment_y != 0:
        return "BIAXIAL MOMENT"
    return "UNIAXIAL MOMENT"


def _geometry(d: PadFoundationInput):
    L = d.footing_length_mm / 1000
    B = d.footing_width_mm / 1000
    area = L * B

    # larger overhang (designed); with an offset the other side is shorter
    cfx, cfy = _column_face(d)
    projection_x = (d.footing_length_mm - cfx) / 2 + abs(d.column_offset_x_mm)
    projection_y = (d.footing_width_mm - cfy) / 2 + abs(d.column_offset_y_mm)

    d_eff_x = d.footing_depth_mm - d.cover_mm - d.bar_dia_mm / 2
    d_eff_y = d.footing_depth_mm - d.cover_mm - d.bar_dia_mm - d.bar_dia_mm / 2

    return L, B, area, projection_x, projection_y, d_eff_x, d_eff_y


def _column_face(d: PadFoundationInput):
    """Column plan size for bending / one-way shear: a circular column is
    taken as the square of equal area."""
    if d.column_shape == "circular":
        s = d.column_x_mm * math.sqrt(math.pi) / 2
        return s, s
    return d.column_x_mm, d.column_y_mm


def _footing_moments(d: PadFoundationInput, N: float, Mx_col: float, My_col: float):
    """Moments about the footing centre: column moments (0 if pinned) plus
    N x column offset."""
    if d.column_pinned:
        Mx_col = My_col = 0.0
    return (Mx_col + N * d.column_offset_y_mm / 1000,
            My_col + N * d.column_offset_x_mm / 1000)


def _eccentricity(d: PadFoundationInput, L: float, B: float):
    Mx_t, My_t = _footing_moments(d, d.axial_load_kN, d.moment_x_kNm, d.moment_y_kNm)
    ex = My_t / d.axial_load_kN if d.axial_load_kN != 0 else 0
    ey = Mx_t / d.axial_load_kN if d.axial_load_kN != 0 else 0
    return ex, ey, abs(ex) <= L / 6, abs(ey) <= B / 6


def _soil_pressure_biaxial(d: PadFoundationInput, L: float, B: float, area: float,
                           ex: float, ey: float, N: Optional[float] = None):
    q0 = (d.axial_load_kN if N is None else N) / area

    q1 = q0 * (1 + 6 * ex / L + 6 * ey / B)
    q2 = q0 * (1 + 6 * ex / L - 6 * ey / B)
    q3 = q0 * (1 - 6 * ex / L + 6 * ey / B)
    q4 = q0 * (1 - 6 * ex / L - 6 * ey / B)

    corner_pressures = {
        "Corner 1 (+ex,+ey)": q1,
        "Corner 2 (+ex,-ey)": q2,
        "Corner 3 (-ex,+ey)": q3,
        "Corner 4 (-ex,-ey)": q4,
    }
    qmax = max(corner_pressures.values())
    qmin = min(corner_pressures.values())

    bearing_status = "OK" if qmax <= d.allowable_bearing_kN_m2 else "NOT OK"
    uplift_status = "OK" if qmin >= 0 else "NOT OK"

    return q0, qmax, qmin, corner_pressures, bearing_status, uplift_status


def _sls_loads(d: PadFoundationInput, L: float, B: float):
    """Service loads on the soil: column service loads (ULS if not given)
    plus the footing self-weight, which acts at the centre."""
    sls_from_uls = d.service_axial_kN is None
    P = d.axial_load_kN if sls_from_uls else d.service_axial_kN
    Mx = d.moment_x_kNm if sls_from_uls or d.service_moment_x_kNm is None else d.service_moment_x_kNm
    My = d.moment_y_kNm if sls_from_uls or d.service_moment_y_kNm is None else d.service_moment_y_kNm
    W_f = L * B * d.footing_depth_mm / 1000 * d.unit_weight_concrete
    N = P + W_f
    # the offset moment comes from the column load only (W_f acts at the centre)
    Mx, My = _footing_moments(d, P, Mx, My)
    return sls_from_uls, W_f, N, Mx, My, (My / N if N else 0.0), (Mx / N if N else 0.0)


def _design_moment(q_design: float, projection_x: float, projection_y: float):
    ax_m = projection_x / 1000
    ay_m = projection_y / 1000
    Mx = q_design * ax_m ** 2 / 2
    My = q_design * ay_m ** 2 / 2
    return Mx, My


def _flexural_reinforcement(d: PadFoundationInput, M_kNm_per_m: float,
                            effective_depth_mm: float, direction: str) -> FlexuralResult:
    b = 1000
    d_eff = effective_depth_mm
    fck = d.concrete_grade_fck
    fyk = d.steel_grade_fyk

    M_Nmm = M_kNm_per_m * 1_000_000
    K = M_Nmm / (b * d_eff ** 2 * fck)

    # EC2 standard constant (see module docstring) -- was 0.9 (BS8110) in
    # the source script, corrected to 1.134 on explicit instruction.
    z = d_eff * (0.5 + math.sqrt(max(0.25 - K / 1.134, 0)))
    z = min(z, 0.95 * d_eff)

    As_req = M_Nmm / (0.87 * fyk * z)

    fctm = _fctm(fck)
    As_min = max(0.26 * fctm / fyk * b * d_eff, 0.0013 * b * d_eff)
    As_design = max(As_req, As_min)

    area_one_bar = bar_area(d.bar_dia_mm)
    spacing_raw = area_one_bar * 1000 / As_design
    adopted_spacing = min(math.floor(spacing_raw / 25) * 25, 200)
    if adopted_spacing < 75:
        adopted_spacing = 75
    As_provided = area_one_bar * 1000 / adopted_spacing

    status = "OK" if As_provided >= As_design else "NOT OK"

    return FlexuralResult(
        direction=direction, M_kNm_per_m=M_kNm_per_m, K=K, z_mm=z,
        As_req=As_req, As_min=As_min, As_design=As_design,
        spacing_mm=adopted_spacing, As_provided=As_provided, status=status,
    )


def _vrdc(d: PadFoundationInput, d_eff_mm: float, rho_l: float) -> float:
    """EC2 6.2.2(1) v_Rd,c in MPa, with v_min."""
    fck = d.concrete_grade_fck
    k = min(1 + math.sqrt(200 / d_eff_mm), 2.0)
    v = (0.18 / d.gamma_c) * k * (100 * min(rho_l, 0.02) * fck) ** (1 / 3)
    return max(v, 0.035 * k ** 1.5 * math.sqrt(fck))


def _one_way_shear(d: PadFoundationInput, q_design: float, projection_mm: float,
                   effective_depth_mm: float, direction: str, As_provided: float) -> ShearResult:
    projection_m = projection_mm / 1000
    d_m = effective_depth_mm / 1000

    # EC2 6.2.1(8): section at d from the column face
    shear_length = max(projection_m - d_m, 0)
    VEd = q_design * shear_length

    rho_l = As_provided / (1000 * effective_depth_mm)
    VRdc = _vrdc(d, effective_depth_mm, rho_l) * 1000 * effective_depth_mm / 1000

    status = "OK" if VEd <= VRdc else "NOT OK"
    return ShearResult(direction=direction, VEd_kN_m=VEd, VRdc_kN_m=VRdc, status=status,
                       rho_l=min(rho_l, 0.02))


def _punching_shear(d: PadFoundationInput, q_relief: float, effective_depth_mm: float,
                    rho_l: float, projection_x_mm: float, projection_y_mm: float) -> PunchingResult:
    """projection_*_mm: the shorter overhang each way, from the true column
    face (a control perimeter must lie on the footing)."""
    dm = effective_depth_mm / 1000
    cx, cy = d.column_x_mm / 1000, d.column_y_mm / 1000
    circular = d.column_shape == "circular"
    a_fit = min(projection_x_mm, projection_y_mm) / 1000
    vRdc = _vrdc(d, effective_depth_mm, rho_l)
    fck = d.concrete_grade_fck
    vRdmax = 0.5 * 0.6 * (1 - fck / 250) * fck / d.gamma_c
    kx, ky = _k_table_6_1(cx / cy), _k_table_6_1(cy / cx)
    P = d.axial_load_kN
    Mx, My = (0.0, 0.0) if d.column_pinned else (d.moment_x_kNm, d.moment_y_kNm)

    def perimeter(a):
        if circular:
            return math.pi * (cx + 2 * a), math.pi * (cx / 2 + a) ** 2
        return 2 * (cx + cy) + 2 * math.pi * a, cx * cy + 2 * a * (cx + cy) + math.pi * a ** 2

    def v_ed(P_red, a, u):
        if circular:
            # W = (D + 2a)^2 about either axis, k = 0.6 -> Eq. 6.53 at a = 2d
            bV = max(P_red, 0.0) + 0.6 * (abs(Mx) + abs(My)) * u / (cx + 2 * a) ** 2
            beta = bV / P_red if P_red > 0 else 1.0
            return bV * 1000 / (u * 1000 * effective_depth_mm), beta
        # beta x V_red (Eq. 6.51, both directions), expanded so it stays
        # finite when V_red -> 0
        Wx = cx ** 2 / 2 + cx * cy + 2 * cy * a + 4 * a ** 2 + math.pi * a * cx
        Wy = cy ** 2 / 2 + cx * cy + 2 * cx * a + 4 * a ** 2 + math.pi * a * cy
        bV = max(P_red, 0.0) + kx * abs(My) * u / Wx + ky * abs(Mx) * u / Wy
        beta = bV / P_red if P_red > 0 else 1.0
        return bV * 1000 / (u * 1000 * effective_depth_mm), beta

    best = None
    for j in range(1, 201):
        a = 2 * dm * j / 200
        if a > a_fit:
            break
        u, A = perimeter(a)
        V_red = P - q_relief * A
        v, beta = v_ed(V_red, a, u)
        vRd = vRdc * 2 * dm / a
        if best is None or v / vRd > best[0]:
            best = (v / vRd, a, u, A, V_red, beta, v, vRd)
    u0, _ = perimeter(0.0)
    v0, _ = v_ed(P, 0.0, u0)
    ratio0 = v0 / vRdmax
    if best:
        ratio, a, u, A, V_red, beta, v, vRd = best
    else:
        ratio, a, u, A, V_red, beta, v, vRd = 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0

    status = "OK" if ratio <= 1.0 and ratio0 <= 1.0 else "NOT OK"
    return PunchingResult(
        vEd=v, vRdc=vRdc, u1_m=u, area_inside_m2=A, upward_reaction_kN=q_relief * A,
        VEd_punch_kN=V_red, status=status, applicable=best is not None,
        d_eff_mm=effective_depth_mm, rho_l=min(rho_l, 0.02), q_relief=q_relief,
        a_mm=a * 1000, beta=beta, vRd=vRd, ratio=ratio, v0=v0, vRdmax=vRdmax, ratio0=ratio0,
    )


def design_pad_foundation(d: PadFoundationInput) -> PadFoundationResult:
    L, B, area, projection_x, projection_y, d_eff_x, d_eff_y = _geometry(d)
    ex, ey, ex_ok, ey_ok = _eccentricity(d, L, B)
    # ULS net pressure (column load only; the footing self-weight and its own
    # reaction cancel) drives the structural design.
    q0, qmax, qmin, corners, _, _ = _soil_pressure_biaxial(d, L, B, area, ex, ey)
    Mx_t, My_t = _footing_moments(d, d.axial_load_kN, d.moment_x_kNm, d.moment_y_kNm)
    # SLS gross pressure (service loads + footing self-weight) for bearing / uplift.
    sls_from_uls, W_f, N_s, Mx_s, My_s, ex_s, ey_s = _sls_loads(d, L, B)
    q0_s, qmax_s, qmin_s, corners_s, bearing_status, uplift_status = _soil_pressure_biaxial(
        d, L, B, area, ex_s, ey_s, N_s)
    Mx, My = _design_moment(qmax, projection_x, projection_y)

    flex_x = _flexural_reinforcement(d, Mx, d_eff_x, "x")
    flex_y = _flexural_reinforcement(d, My, d_eff_y, "y")
    shear_x = _one_way_shear(d, qmax, projection_x, d_eff_x, "x", flex_x.As_provided)
    shear_y = _one_way_shear(d, qmax, projection_y, d_eff_y, "y", flex_y.As_provided)
    # EC2 6.4.2(1)/6.4.4(1): d = (d_x + d_y)/2, rho_l = sqrt(rho_x rho_y);
    # relief from the ULS net pressure under the column centre (beta
    # carries the column moments)
    rho_x = flex_x.As_provided / (1000 * d_eff_x)
    rho_y = flex_y.As_provided / (1000 * d_eff_y)
    ox, oy = d.column_offset_x_mm / 1000, d.column_offset_y_mm / 1000
    q_col = q0 + My_t * ox / (B * L ** 3 / 12) + Mx_t * oy / (L * B ** 3 / 12)
    cy_true = d.column_x_mm if d.column_shape == "circular" else d.column_y_mm
    a_min_x = (d.footing_length_mm - d.column_x_mm) / 2 - abs(d.column_offset_x_mm)
    a_min_y = (d.footing_width_mm - cy_true) / 2 - abs(d.column_offset_y_mm)
    punching = _punching_shear(d, q_col, (d_eff_x + d_eff_y) / 2, math.sqrt(rho_x * rho_y),
                               a_min_x, a_min_y)

    checks = [bearing_status, uplift_status, flex_x.status, flex_y.status,
             shear_x.status, shear_y.status, punching.status]
    overall = "PASS" if all(c == "OK" for c in checks) else "FAIL"

    return PadFoundationResult(
        L_m=L, B_m=B, area_m2=area, projection_x_mm=projection_x, projection_y_mm=projection_y,
        d_eff_x_mm=d_eff_x, d_eff_y_mm=d_eff_y,
        ex_m=ex, ey_m=ey, ex_within_middle_third=ex_ok, ey_within_middle_third=ey_ok,
        q0=q0, qmax=qmax, qmin=qmin, corner_pressures=corners,
        bearing_status=bearing_status, uplift_status=uplift_status,
        sls_from_uls=sls_from_uls, footing_weight_kN=W_f, sls_total_load_kN=N_s,
        sls_Mx_kNm=Mx_s, sls_My_kNm=My_s, sls_ex_m=ex_s, sls_ey_m=ey_s,
        sls_q0=q0_s, sls_qmax=qmax_s, sls_qmin=qmin_s, sls_corner_pressures=corners_s,
        Mx_kNm_per_m=Mx, My_kNm_per_m=My,
        flex_x=flex_x, flex_y=flex_y, shear_x=shear_x, shear_y=shear_y, punching=punching,
        load_case=_load_case(Mx_t, My_t), overall_status=overall,
        column_face_x_mm=_column_face(d)[0], column_face_y_mm=_column_face(d)[1],
        Mx_total_kNm=Mx_t, My_total_kNm=My_t,
        projection_x_min_mm=a_min_x, projection_y_min_mm=a_min_y,
    )