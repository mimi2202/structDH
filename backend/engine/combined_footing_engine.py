# backend/engine/combined_footing_engine.py
"""
Combined pad footing design engine (EC2 + EC7) -- two columns sharing one
footing.

Started as a refactor of a reference script (source: Combined Pad
Footing.docx). For the script's own default inputs the original version
matched its printed output (qmax=148.969, Mmax_long=11.507 kNm at
x=0.550m, VEd=16.878kN); there is no separate verification script.

Changes from the source script (2026-10-05), each because the script's
method was incomplete or unconservative:
  - Lever arm: EC2 constant z = d[0.5 + sqrt(0.25 - K/1.134)] (the script
    used the BS8110 0.9); K > 0.167 is reported as NOT OK (compression
    steel would be needed).
  - Longitudinal analysis: beam on linear soil reaction, swept along the
    length. Applied column moments My are now point moments in the
    diagram (they were only in the pressure, so M(L) != 0). Sagging
    (bottom steel, under the columns) and hogging (top steel, between the
    columns) are designed separately; the script designed one area for
    max |M| and never said which face.
  - Longitudinal steel compared per metre width (As over the full width B
    was compared with a per-metre As,prov).
  - One-way shear: V from the shear diagram at d from each face of each
    column, both sides (EC2 6.2.1(8)), with rho_l from the steel provided
    in that zone. The script only checked the end cantilevers, from the
    column centre, so shear between the columns was never checked.
  - Punching: EC2 6.4.4(2) for each column -- control perimeters at
    a <= 2d, relief from the soil pressure under that column, v_Rd =
    v_Rd,c 2d/a, beta from the column moments (Eq. 6.51); perimeters that
    do not fit on the footing are not valid (one-way shear across the
    full width governs there). Plus v_Rd,max at the column face (6.4.5(3)).
  - Bearing: on SLS column loads plus footing self-weight (the script
    used the ULS loads and no self-weight). Structural design stays on
    the ULS net pressure.
  - fctm from EC2 Table 3.1 (was 2.6 / 2.9).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple


def bar_area(phi_mm: float) -> float:
    return math.pi * phi_mm ** 2 / 4


def _fctm(fck: float) -> float:
    """EC2 Table 3.1."""
    return 0.30 * fck ** (2 / 3) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10)


def _vrdc(d: "CombinedPadInput", d_eff_mm: float, rho_l: float) -> float:
    """EC2 6.2.2(1) v_Rd,c in MPa, with v_min."""
    k = min(1 + math.sqrt(200 / d_eff_mm), 2.0)
    v = (0.18 / d.gamma_c) * k * (100 * min(rho_l, 0.02) * d.fck) ** (1 / 3)
    return max(v, 0.035 * k ** 1.5 * math.sqrt(d.fck))


@dataclass
class CombinedPadInput:
    P1_kN: float = 72.967
    P2_kN: float = 24.987

    P1_Mx_kNm: float = 0.0
    P1_My_kNm: float = 0.0
    P2_Mx_kNm: float = 0.0
    P2_My_kNm: float = 0.0

    column_spacing_m: float = 0.820

    footing_length_m: float = 1.870
    footing_width_m: float = 0.550
    footing_depth_mm: float = 400.0

    column_x_mm: float = 300.0
    column_y_mm: float = 300.0

    fck: float = 25.0
    fyk: float = 500.0
    gamma_c: float = 1.50
    gamma_s: float = 1.15

    allowable_bearing_kN_m2: float = 100.0

    cover_mm: float = 50.0
    bar_dia_mm: float = 12.0

    left_projection_m: float = 0.550

    # SLS column loads for the bearing check. None -> the ULS load is used
    # (conservative). Service moments are taken as the ULS moments scaled
    # by each column's P_sls/P_uls.
    P1_sls_kN: Optional[float] = None
    P2_sls_kN: Optional[float] = None
    unit_weight_concrete: float = 25.0


@dataclass
class FlexuralResult:
    label: str
    M_kNm: float
    K: float
    z_mm: float
    As_req: float
    As_min: float
    As_design: float
    spacing_mm: float
    As_provided: float
    status: str


@dataclass
class ShearSection:
    label: str
    x_m: float
    VEd_kN: float
    face: str            # tension face at the section: "bottom" or "top"
    rho_l: float
    VRdc_kN: float


@dataclass
class ShearResult:
    VEd_kN: float
    VRdc_kN: float
    status: str
    x_m: float = 0.0
    label: str = ""
    rho_l: float = 0.0
    sections: List[ShearSection] = field(default_factory=list)


@dataclass
class ColumnPunching:
    column: int
    P_kN: float
    applicable: bool      # False: no control perimeter a <= 2d fits on the footing
    a_mm: float           # governing control perimeter distance from the column face
    u_m: float
    area_inside_m2: float
    q_under_kN_m2: float
    VEd_red_kN: float
    beta: float
    vEd: float
    vRd: float            # v_Rd,c x 2d/a
    ratio: float
    v0: float             # column face, u0
    vRdmax: float
    ratio0: float
    status: str


@dataclass
class PunchingResult:
    d_eff_mm: float
    rho_l: float
    vRdc: float           # basic v_Rd,c (at a = 2d)
    columns: List[ColumnPunching]
    governing: ColumnPunching
    status: str


@dataclass
class CombinedFootingResult:
    case_type: str
    total_load_kN: float
    x1_m: float
    x2_m: float
    centre_x_m: float
    centre_y_m: float
    x_resultant_m: float
    axial_ecc_x_m: float

    Mx_total_kNm: float
    My_total_kNm: float
    ex_m: float
    ey_m: float
    ex_within_middle_third: bool
    ey_within_middle_third: bool

    area_m2: float
    q0: float
    qmax: float
    qmin: float
    corner_pressures: Dict[str, float]
    bearing_status: str
    uplift_status: str

    # SLS bearing (q0/qmax/qmin/corner_pressures above are the ULS net
    # pressures used for the structural design)
    sls_from_uls: bool
    footing_weight_kN: float
    sls_total_load_kN: float
    sls_My_kNm: float
    sls_Mx_kNm: float
    sls_ex_m: float
    sls_ey_m: float
    sls_q0: float
    sls_qmax: float
    sls_qmin: float
    sls_corner_pressures: Dict[str, float]

    left_projection_m: float
    spacing_m: float
    right_projection_m: float

    Mmax_long_kNm: float      # max |M| (signed: + sagging, - hogging)
    M_location_m: float
    M_sag_kNm: float
    M_sag_x_m: float
    M_hog_kNm: float          # magnitude
    M_hog_x_m: float
    M_end_kNm: float          # M at x = L: equilibrium check, should be ~0

    d_long_mm: float
    d_trans_mm: float

    long_flex: FlexuralResult     # bottom, sagging
    long_top_flex: FlexuralResult  # top, hogging
    trans_flex: FlexuralResult
    M_trans_kNm: float
    projection_y_m: float

    shear: ShearResult
    punching: PunchingResult

    overall_status: str


def _classify_load_case(d: CombinedPadInput) -> str:
    total_mx = d.P1_Mx_kNm + d.P2_Mx_kNm
    total_my = d.P1_My_kNm + d.P2_My_kNm
    if total_mx == 0 and total_my == 0:
        return "AXIAL LOAD ONLY"
    if total_mx != 0 and total_my != 0:
        return "BIAXIAL MOMENT LOADING"
    return "UNIAXIAL MOMENT LOADING"


def _resultant_load(d: CombinedPadInput):
    total_load = d.P1_kN + d.P2_kN
    x1 = d.left_projection_m
    x2 = d.left_projection_m + d.column_spacing_m
    centre_x = d.footing_length_m / 2
    centre_y = d.footing_width_m / 2
    x_resultant = (d.P1_kN * x1 + d.P2_kN * x2) / total_load if total_load else 0.0
    axial_ecc_x = x_resultant - centre_x
    return total_load, x1, x2, centre_x, centre_y, x_resultant, axial_ecc_x


def _total_design_moments_about_centre(d: CombinedPadInput, total_load, x1, x2, centre_x):
    My_from_axial = d.P1_kN * (x1 - centre_x) + d.P2_kN * (x2 - centre_x)
    My_applied = d.P1_My_kNm + d.P2_My_kNm
    Mx_applied = d.P1_Mx_kNm + d.P2_Mx_kNm
    My_total = My_from_axial + My_applied
    Mx_total = Mx_applied
    ex_total = My_total / total_load if total_load != 0 else 0.0
    ey_total = Mx_total / total_load if total_load != 0 else 0.0
    return Mx_total, My_total, ex_total, ey_total


def _bearing_pressure_biaxial(d: CombinedPadInput, total_load, Mx_total, My_total, ex, ey):
    L = d.footing_length_m
    B = d.footing_width_m
    area = L * B
    q0 = total_load / area if area else 0.0

    q1 = q0 * (1 + 6 * ex / L + 6 * ey / B)
    q2 = q0 * (1 + 6 * ex / L - 6 * ey / B)
    q3 = q0 * (1 - 6 * ex / L + 6 * ey / B)
    q4 = q0 * (1 - 6 * ex / L - 6 * ey / B)

    corners = {
        "Corner 1 (+ex,+ey)": q1,
        "Corner 2 (+ex,-ey)": q2,
        "Corner 3 (-ex,+ey)": q3,
        "Corner 4 (-ex,-ey)": q4,
    }
    qmax = max(corners.values())
    qmin = min(corners.values())
    bearing_status = "OK" if qmax <= d.allowable_bearing_kN_m2 else "NOT OK"
    uplift_status = "OK" if qmin >= 0 else "NOT OK"
    return area, q0, qmax, qmin, corners, bearing_status, uplift_status


def _sls_loads(d: CombinedPadInput, x1, x2, centre_x):
    """SLS loads on the soil for the bearing check: service column loads (ULS
    if not given) plus the footing self-weight, which acts at the centre.
    Service moments = ULS moments x P_sls/P_uls of the same column."""
    sls_from_uls = d.P1_sls_kN is None or d.P2_sls_kN is None
    P1s = d.P1_kN if d.P1_sls_kN is None else d.P1_sls_kN
    P2s = d.P2_kN if d.P2_sls_kN is None else d.P2_sls_kN
    r1 = P1s / d.P1_kN if d.P1_kN else 1.0
    r2 = P2s / d.P2_kN if d.P2_kN else 1.0
    W_f = d.footing_length_m * d.footing_width_m * d.footing_depth_mm / 1000 * d.unit_weight_concrete
    N = P1s + P2s + W_f
    My = P1s * (x1 - centre_x) + P2s * (x2 - centre_x) + r1 * d.P1_My_kNm + r2 * d.P2_My_kNm
    Mx = r1 * d.P1_Mx_kNm + r2 * d.P2_Mx_kNm
    return sls_from_uls, W_f, N, My, Mx, (My / N if N else 0.0), (Mx / N if N else 0.0)


def _footing_projections(d: CombinedPadInput, x1, x2):
    left_projection = x1
    spacing = x2 - x1
    right_projection = d.footing_length_m - x2
    return left_projection, spacing, right_projection


def _linear_pressure_along_length(d: CombinedPadInput, q0, My_total) -> Callable[[float], float]:
    L = d.footing_length_m
    B = d.footing_width_m
    Iy = B * L ** 3 / 12

    def qx(x_from_left):
        x_centred = x_from_left - L / 2
        return q0 + (My_total * x_centred / Iy if Iy else 0.0)

    return qx


def _shear_and_moment_analysis(d: CombinedPadInput, q0, My_total, x1, x2):
    B = d.footing_width_m
    L = d.footing_length_m
    Iy = B * L ** 3 / 12

    def reaction_integral(x):
        return B * (q0 * x + (My_total / Iy * ((x ** 2) / 2 - (L / 2) * x) if Iy else 0.0))

    def moment_integral(x):
        return B * (q0 * x ** 2 / 2 + (My_total / Iy * (x ** 3 / 6 - L * x ** 2 / 4) if Iy else 0.0))

    def shear_at(x):
        V = reaction_integral(x)
        if x >= x1:
            V -= d.P1_kN
        if x >= x2:
            V -= d.P2_kN
        return V

    # Sign: + sagging (tension in the bottom face), - hogging (tension top).
    # The applied column moments My are point moments at x1/x2 -- they are
    # in My_total (so in the pressure), and without them here M(L) would be
    # -(My1 + My2) instead of 0.
    def moment_at(x):
        M = moment_integral(x)
        if x >= x1:
            M -= d.P1_kN * (x - x1)
            M += d.P1_My_kNm
        if x >= x2:
            M -= d.P2_kN * (x - x2)
            M += d.P2_My_kNm
        return M

    # 2000-point sweep plus both sides of each column (jumps at point moments)
    steps = 2000
    xs = [L * i / steps for i in range(steps + 1)]
    xs += [x for xc in (x1, x2) for x in (xc - 1e-9, xc) if 0 <= x <= L]
    sag = max(xs, key=moment_at)
    hog = min(xs, key=moment_at)
    M_sag, M_hog = max(moment_at(sag), 0.0), max(-moment_at(hog), 0.0)
    max_x, max_M = (sag, M_sag) if M_sag >= M_hog else (hog, -M_hog)

    return dict(max_x=max_x, max_M=max_M, M_sag=M_sag, sag_x=sag, M_hog=M_hog, hog_x=hog,
                M_end=moment_at(L), shear_at=shear_at, moment_at=moment_at)


def _effective_depths(d: CombinedPadInput) -> Tuple[float, float]:
    d_long = d.footing_depth_mm - d.cover_mm - d.bar_dia_mm / 2
    d_trans = d.footing_depth_mm - d.cover_mm - d.bar_dia_mm - d.bar_dia_mm / 2
    return d_long, d_trans


def _flexural_design(d: CombinedPadInput, M_kNm: float, b_mm: float, d_eff_mm: float,
                     label: str) -> FlexuralResult:
    M_Nmm = abs(M_kNm) * 1_000_000
    K = M_Nmm / (b_mm * d_eff_mm ** 2 * d.fck) if (b_mm and d_eff_mm) else 0.0

    # EC2 standard constant (see module docstring) -- was 0.9 (BS8110) in
    # the source script, corrected to 1.134.
    z = d_eff_mm * (0.5 + math.sqrt(max(0.25 - K / 1.134, 0)))
    z = min(z, 0.95 * d_eff_mm)

    # Steel areas per metre width (mm2/m), so they compare directly with the
    # per-metre As,prov below; M acts over the width b_mm.
    per_m = 1000 / b_mm if b_mm else 1.0
    As_req = M_Nmm / (0.87 * d.fyk * z) * per_m if z else 0.0
    fctm = _fctm(d.fck)
    As_min = max(0.26 * fctm / d.fyk * 1000 * d_eff_mm, 0.0013 * 1000 * d_eff_mm)   # EC2 9.2.1.1
    As_design = max(As_req, As_min)

    Abar = bar_area(d.bar_dia_mm)
    spacing_raw = Abar * 1000 / As_design if As_design else 200
    spacing_adopted = min(math.floor(spacing_raw / 25) * 25, 200)
    if spacing_adopted < 75:
        spacing_adopted = 75
    As_prov = Abar * 1000 / spacing_adopted

    # K > K' = 0.167 (no redistribution) would need compression steel: deepen the footing.
    status = "OK" if (As_prov >= As_design and K <= 0.167) else "NOT OK"
    return FlexuralResult(label=label, M_kNm=abs(M_kNm), K=K, z_mm=z, As_req=As_req, As_min=As_min,
                          As_design=As_design, spacing_mm=spacing_adopted, As_provided=As_prov, status=status)


def _transverse_moment_design(d: CombinedPadInput, qmax) -> Tuple[float, float]:
    projection_y = (d.footing_width_m - d.column_y_mm / 1000) / 2
    M_trans = qmax * projection_y ** 2 / 2
    return M_trans, projection_y


def _one_way_shear_check(d: CombinedPadInput, an: dict, d_eff_mm, x1, x2,
                         rho_bottom: float, rho_top: float) -> ShearResult:
    """EC2 6.2.1(8)/6.2.2: V_Ed from the shear diagram at d from each face of
    each column, both sides; rho_l from the steel in the tension face there."""
    L = d.footing_length_m
    dm = d_eff_mm / 1000
    half = d.column_x_mm / 2000
    bw = d.footing_width_m * 1000
    candidates = [("column 1, outer face", x1 - half - dm),
                  ("column 1, inner face", x1 + half + dm),
                  ("column 2, inner face", x2 - half - dm),
                  ("column 2, outer face", x2 + half + dm)]
    sections = []
    for label, x in candidates:
        if not (0 < x < L):
            continue
        face = "bottom" if an["moment_at"](x) >= 0 else "top"
        rho = rho_bottom if face == "bottom" else rho_top
        VRdc = _vrdc(d, d_eff_mm, rho) * bw * d_eff_mm / 1000
        sections.append(ShearSection(label=label, x_m=x, VEd_kN=abs(an["shear_at"](x)), face=face,
                                     rho_l=min(rho, 0.02), VRdc_kN=VRdc))
    if not sections:
        VRdc = _vrdc(d, d_eff_mm, rho_bottom) * bw * d_eff_mm / 1000
        return ShearResult(VEd_kN=0.0, VRdc_kN=VRdc, status="OK", label="no section at d from a column face lies on the footing",
                           rho_l=min(rho_bottom, 0.02))
    gov = max(sections, key=lambda s: s.VEd_kN / s.VRdc_kN)
    status = "OK" if all(s.VEd_kN <= s.VRdc_kN for s in sections) else "NOT OK"
    return ShearResult(VEd_kN=gov.VEd_kN, VRdc_kN=gov.VRdc_kN, status=status, x_m=gov.x_m,
                       label=gov.label, rho_l=gov.rho_l, sections=sections)


def _k_table_6_1(c1_over_c2: float) -> float:
    """EC2 Table 6.1, linear interpolation, clamped."""
    pts = [(0.5, 0.45), (1.0, 0.60), (2.0, 0.70), (3.0, 0.80)]
    r = min(max(c1_over_c2, 0.5), 3.0)
    for (r0, k0), (r1, k1) in zip(pts, pts[1:]):
        if r <= r1:
            return k0 + (k1 - k0) * (r - r0) / (r1 - r0)
    return 0.80


def _punching_shear_check(d: CombinedPadInput, q0, My_total, d_eff_mm, rho_l, x1, x2) -> PunchingResult:
    """EC2 6.4.4(2) for foundations, each column: control perimeters at
    a <= 2d, V_Ed,red = P - q_under x (area inside), v_Ed = beta V_Ed,red/(u d)
    with beta from Eq. 6.51 (moments in both directions added), against
    v_Rd = v_Rd,c 2d/a (Eq. 6.50). A perimeter must lie on the footing; if
    none does, punching is not a valid mechanism and the one-way shear check
    across the full width governs. v_Rd,max = 0.5 nu fcd at the column face
    (6.4.5(3), UK NA value, fcd = fck/gamma_c)."""
    L, B = d.footing_length_m, d.footing_width_m
    Iy = B * L ** 3 / 12
    cx, cy = d.column_x_mm / 1000, d.column_y_mm / 1000
    dm = d_eff_mm / 1000
    vRdc = _vrdc(d, d_eff_mm, rho_l)
    vRdmax = 0.5 * 0.6 * (1 - d.fck / 250) * d.fck / d.gamma_c
    kx, ky = _k_table_6_1(cx / cy), _k_table_6_1(cy / cx)

    def v_ed(P_red, Mx_, My_, a, u):
        # beta x V_red, expanded so it stays finite when V_red -> 0
        Wx = cx ** 2 / 2 + cx * cy + 2 * cy * a + 4 * a ** 2 + math.pi * a * cx
        Wy = cy ** 2 / 2 + cx * cy + 2 * cx * a + 4 * a ** 2 + math.pi * a * cy
        bV = max(P_red, 0.0) + kx * abs(My_) * u / Wx + ky * abs(Mx_) * u / Wy
        beta = bV / P_red if P_red > 0 else 1.0
        return bV * 1000 / (u * 1000 * d_eff_mm), beta

    cols = []
    for i, xi, P, Mx_, My_ in ((1, x1, d.P1_kN, d.P1_Mx_kNm, d.P1_My_kNm),
                               (2, x2, d.P2_kN, d.P2_Mx_kNm, d.P2_My_kNm)):
        q_under = q0 + (My_total * (xi - L / 2) / Iy if Iy else 0.0)
        best = None
        for j in range(1, 201):
            a = 2 * dm * j / 200
            if xi - cx / 2 - a < 0 or xi + cx / 2 + a > L or cy + 2 * a > B:
                break
            u = 2 * (cx + cy) + 2 * math.pi * a
            A = cx * cy + 2 * a * (cx + cy) + math.pi * a ** 2
            V_red = P - q_under * A
            v, beta = v_ed(V_red, Mx_, My_, a, u)
            vRd = vRdc * 2 * dm / a
            if best is None or v / vRd > best[0]:
                best = (v / vRd, a, u, A, V_red, beta, v, vRd)
        u0 = 2 * (cx + cy)
        v0, _ = v_ed(P, Mx_, My_, 0.0, u0)
        ratio0 = v0 / vRdmax
        if best:
            ratio, a, u, A, V_red, beta, v, vRd = best
        else:
            ratio, a, u, A, V_red, beta, v, vRd = 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0
        ok = ratio <= 1.0 and ratio0 <= 1.0
        cols.append(ColumnPunching(column=i, P_kN=P, applicable=best is not None, a_mm=a * 1000, u_m=u,
                                   area_inside_m2=A, q_under_kN_m2=q_under, VEd_red_kN=V_red, beta=beta,
                                   vEd=v, vRd=vRd, ratio=ratio, v0=v0, vRdmax=vRdmax, ratio0=ratio0,
                                   status="OK" if ok else "NOT OK"))
    gov = max(cols, key=lambda c: max(c.ratio, c.ratio0))
    status = "OK" if all(c.status == "OK" for c in cols) else "NOT OK"
    return PunchingResult(d_eff_mm=d_eff_mm, rho_l=min(rho_l, 0.02), vRdc=vRdc, columns=cols,
                          governing=gov, status=status)


def design_combined_footing(d: CombinedPadInput) -> CombinedFootingResult:
    case_type = _classify_load_case(d)
    total_load, x1, x2, centre_x, centre_y, x_resultant, axial_ecc_x = _resultant_load(d)
    Mx_total, My_total, ex, ey = _total_design_moments_about_centre(d, total_load, x1, x2, centre_x)
    # ULS net pressure (column loads only; the footing self-weight and its own
    # reaction cancel) drives the structural design.
    area, q0, qmax, qmin, corners, _, _ = _bearing_pressure_biaxial(
        d, total_load, Mx_total, My_total, ex, ey)
    # SLS gross pressure (service loads + footing self-weight) for bearing / uplift.
    sls_from_uls, W_f, N_s, My_s, Mx_s, ex_s, ey_s = _sls_loads(d, x1, x2, centre_x)
    _, q0_s, qmax_s, qmin_s, corners_s, bearing_status, uplift_status = _bearing_pressure_biaxial(
        d, N_s, Mx_s, My_s, ex_s, ey_s)
    left_proj, spacing, right_proj = _footing_projections(d, x1, x2)
    an = _shear_and_moment_analysis(d, q0, My_total, x1, x2)
    d_long, d_trans = _effective_depths(d)

    b_long = d.footing_width_m * 1000
    long_flex = _flexural_design(d, an["M_sag"], b_long, d_long, "longitudinal, bottom (sagging)")
    long_top_flex = _flexural_design(d, an["M_hog"], b_long, d_long, "longitudinal, top (hogging)")
    M_trans, projection_y = _transverse_moment_design(d, qmax)
    trans_flex = _flexural_design(d, M_trans, 1000, d_trans, "transverse direction per metre width")

    rho_bot = long_flex.As_provided / (1000 * d_long)
    rho_top = long_top_flex.As_provided / (1000 * d_long)
    rho_trans = trans_flex.As_provided / (1000 * d_trans)
    shear = _one_way_shear_check(d, an, d_long, x1, x2, rho_bot, rho_top)
    # EC2 6.4.2(1)/6.4.4(1): d_eff = (d_y + d_z)/2, rho_l = sqrt(rho_ly rho_lz) of the bottom steel
    punching = _punching_shear_check(d, q0, My_total, (d_long + d_trans) / 2,
                                     math.sqrt(rho_bot * rho_trans), x1, x2)

    ex_ok = abs(ex_s) <= d.footing_length_m / 6
    ey_ok = abs(ey_s) <= d.footing_width_m / 6

    checks = [bearing_status, uplift_status, long_flex.status, long_top_flex.status, trans_flex.status,
              shear.status, punching.status]
    overall = "PASS" if all(c == "OK" for c in checks) else "FAIL"

    return CombinedFootingResult(
        case_type=case_type, total_load_kN=total_load, x1_m=x1, x2_m=x2,
        centre_x_m=centre_x, centre_y_m=centre_y, x_resultant_m=x_resultant, axial_ecc_x_m=axial_ecc_x,
        Mx_total_kNm=Mx_total, My_total_kNm=My_total, ex_m=ex, ey_m=ey,
        ex_within_middle_third=ex_ok, ey_within_middle_third=ey_ok,
        area_m2=area, q0=q0, qmax=qmax, qmin=qmin, corner_pressures=corners,
        bearing_status=bearing_status, uplift_status=uplift_status,
        left_projection_m=left_proj, spacing_m=spacing, right_projection_m=right_proj,
        sls_from_uls=sls_from_uls, footing_weight_kN=W_f, sls_total_load_kN=N_s, sls_My_kNm=My_s,
        sls_Mx_kNm=Mx_s, sls_ex_m=ex_s, sls_ey_m=ey_s, sls_q0=q0_s, sls_qmax=qmax_s, sls_qmin=qmin_s,
        sls_corner_pressures=corners_s,
        Mmax_long_kNm=an["max_M"], M_location_m=an["max_x"],
        M_sag_kNm=an["M_sag"], M_sag_x_m=an["sag_x"], M_hog_kNm=an["M_hog"], M_hog_x_m=an["hog_x"],
        M_end_kNm=an["M_end"],
        d_long_mm=d_long, d_trans_mm=d_trans,
        long_flex=long_flex, long_top_flex=long_top_flex, trans_flex=trans_flex, M_trans_kNm=M_trans, projection_y_m=projection_y,
        shear=shear, punching=punching, overall_status=overall,
    )