"""
column_engine.py — EC2 reinforced concrete column design engine.

One engine serves all three column types via `column_type`:
    "axial"     — nominal axial with minimum eccentricity about each axis
    "uniaxial"  — N + Mx
    "biaxial"   — N + Mx + My, EC2 Cl. 5.8.9 interaction

Load input follows the established override pattern (cf. beam_ss_engine):
by default the engine runs a full tributary-area load take-down; supply
NEd_override_kN / MEdx_override_kNm / MEdy_override_kNm to bypass it and
design directly from frame-analysis output. Called with no overrides the
behaviour is the full take-down, so existing callers are unaffected.

Section capacity is by strain compatibility (EC2 Cl. 3.1.7 rectangular
stress block + Cl. 3.2.7 bilinear steel), not a beam-style As*fyd*z
estimate: a column's moment capacity depends on the axial load it carries.

Corrections applied relative to the three reference scripts:
  * slenderness is checked about BOTH axes (the scripts only ever used
    i = h/sqrt(12), which is the strong axis)
  * lambda_lim uses the full 20*A*B*C/sqrt(n) of Cl. 5.8.3.1, not 20*C
  * slender columns get a second-order moment (nominal curvature,
    Cl. 5.8.8); the scripts printed "slender" and designed as short
  * tie spacing is min(20*phi_long, min(b,h), 400) per Cl. 9.5.3(3)
  * NRd deducts the concrete displaced by the bars
  * beam/wall reactions use the actual tributary spans
"""

from __future__ import annotations

import math
import dataclasses
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

Es_MPA = 200_000.0

# Utilisation is capped rather than allowed to reach infinity: JSON cannot
# encode inf/NaN, so an uncapped ratio would break the API response.
UTIL_CAP = 999.0


# ============================================================
# 1. LOOKUPS
# ============================================================

CONCRETE_GRADES: Dict[str, float] = {
    "C12/15": 12, "C16/20": 16, "C20/25": 20, "C25/30": 25, "C30/37": 30,
    "C35/45": 35, "C40/50": 40, "C45/55": 45, "C50/60": 50, "C55/67": 55,
    "C60/75": 60, "C70/85": 70, "C80/95": 80, "C90/105": 90,
}

STEEL_GRADES: Dict[str, float] = {"B500": 500.0, "B460": 460.0}

# EN 1992-1-1 Table 4.4N / 4.5N, structural class S4
EXPOSURE_MIN_DUR_MM: Dict[str, float] = {
    "X0": 10.0, "XC1": 15.0, "XC2": 25.0, "XC3": 25.0, "XC4": 30.0,
    "XD1": 30.0, "XD2": 35.0, "XD3": 45.0,
    "XS1": 35.0, "XS2": 40.0, "XS3": 45.0,
}

# EN 1991-1-1 Table 6.2 style imposed loads, kN/m^2
BUILDING_USE_LIVE_LOADS: Dict[str, float] = {
    "residential": 2.0, "office": 3.0, "corridor": 4.0, "stairs": 4.0,
    "retail": 4.0, "shopping_mall": 5.0, "assembly_fixed_seating": 4.0,
    "assembly_movable_seating": 5.0, "assembly_concert_hall": 5.0,
    "assembly_dance_floor": 5.0, "storage_light": 5.0, "storage_heavy": 7.5,
    "warehouse_general": 5.0, "warehouse_heavy": 10.0, "parking_cars": 2.5,
    "parking_trucks": 5.0, "hospital_ward": 3.0, "hospital_operating_room": 4.0,
    "school_classroom": 3.0, "library_reading": 4.0, "library_stack": 7.5,
    "gymnasium": 5.0, "roof_access": 1.5, "roof_no_access": 0.75,
    "balcony": 3.0, "plant_room": 5.0,
}

END_CONDITION_K: Dict[str, float] = {
    "fixed-fixed": 0.5,
    "fixed-pinned": 0.7,
    "pinned-pinned": 1.0,
    "fixed-free": 2.0,
}

AVAILABLE_BAR_DIAS = [12, 16, 20, 25, 32, 40]

# Ordered smallest-area-first. Auto-sizing walks this and stops at the first
# arrangement that satisfies every check, so the order is the policy.
AUTOSIZE_CANDIDATES: List[Tuple[int, int]] = [
    (12, 4), (12, 6), (16, 4), (12, 8), (16, 6), (20, 4), (16, 8),
    (20, 6), (25, 4), (20, 8), (25, 6), (32, 4), (25, 8), (32, 6),
    (32, 8), (32, 10), (32, 12),
]
AVAILABLE_LINK_DIAS = [6, 8, 10, 12]


def get_fck(grade: str) -> float:
    try:
        return float(CONCRETE_GRADES[grade])
    except KeyError:
        raise ValueError(f"Unsupported concrete grade: {grade}")


def get_fyk(grade: str) -> float:
    try:
        return STEEL_GRADES[grade]
    except KeyError:
        raise ValueError(f"Unsupported steel grade: {grade}")


def live_load_for_use(use: str) -> float:
    key = (use or "").strip().lower()
    if key not in BUILDING_USE_LIVE_LOADS:
        raise ValueError(f"Unsupported building use: {use}")
    return BUILDING_USE_LIVE_LOADS[key]


def support_k(end_condition: str) -> float:
    key = (end_condition or "").strip().lower()
    if key not in END_CONDITION_K:
        raise ValueError(
            "Invalid end_condition. Use one of: " + ", ".join(END_CONDITION_K)
        )
    return END_CONDITION_K[key]


def order_end_moments(m_a: float, m_b: float) -> Tuple[float, float]:
    """
    EN 1992-1-1 Cl. 5.8.8.2(2) requires |M02| >= |M01|, with the signs kept:
    opposite signs mean double curvature, which lowers M0e and raises C.

    Textbooks label these inconsistently. Ubani's Column E5 lists
    "M01 = 13.185, M02 = -6.592" and then takes rm = -6.592/13.185 = -0.50,
    i.e. smaller over larger. Ordering here by magnitude makes the engine
    immune to which way round they were typed.

    Returns (M01, M02) in EC2's sense: M01 is the smaller magnitude.
    """
    if abs(m_a) >= abs(m_b):
        return m_b, m_a
    return m_a, m_b


def bars_fit(geo: "Geometry") -> Tuple[bool, str]:
    """
    EN 1992-1-1 Cl. 8.2: clear spacing between bars must be at least
    max(bar diameter, 20 mm). A cage that cannot physically be built is not a
    candidate, however well it performs on paper.
    """
    edge = geo.cover + geo.link_dia
    s_min = max(geo.bar_dia, 20.0)
    for n, dim, label in ((geo.n_b_face, geo.b, "width b"),
                          (geo.n_h_face, geo.h, "depth h")):
        if n < 2:
            continue
        needed = 2 * edge + n * geo.bar_dia + (n - 1) * s_min
        if needed > dim:
            return False, (f"{n} bars of {geo.bar_dia:.0f} mm need {needed:.0f} mm "
                           f"across the {label} of {dim:.0f} mm")
    return True, ""


def bar_area_mm2(d_mm: float) -> float:
    return math.pi * d_mm ** 2 / 4.0


def round_up_to_available(value: float, available: List[int]) -> int:
    for item in available:
        if item >= value:
            return item
    return available[-1]


# ============================================================
# 2. INPUT
# ============================================================

@dataclass
class Wall:
    present: bool = False
    thickness_m: float = 0.15
    density_kN_per_m3: Optional[float] = None
    opening_ratio: float = 0.0

    def line_load_kN_per_m(self, clear_height_m: float, default_density: float) -> float:
        if not self.present:
            return 0.0
        density = self.density_kN_per_m3 if self.density_kN_per_m3 is not None else default_density
        return self.thickness_m * clear_height_m * density * (1.0 - self.opening_ratio)


@dataclass
class Beam:
    """
    One of the two beams framing into the column in a given direction.

    There is deliberately NO span field. The spans are already fully
    determined by left_x_m/right_x_m (for the x-direction pair) and
    top_y_m/bottom_y_m (for the y-direction pair), and the reaction
    delivered to the column is w*(L_a/2 + L_b/2) = w*tributary_width.
    Carrying a separate span here would let the input contradict the
    tributary geometry, with the engine silently ignoring one of them.
    """
    width_m: float = 0.23
    depth_m: float = 0.45
    wall: Wall = field(default_factory=Wall)

    def self_weight_kN_per_m(self, concrete_density: float) -> float:
        return self.width_m * self.depth_m * concrete_density

    def wall_line_load_kN_per_m(self, storey_height_m: float, default_density: float) -> float:
        clear_height = max(storey_height_m - self.depth_m, 0.0)
        return self.wall.line_load_kN_per_m(clear_height, default_density)


@dataclass
class FloorTemplate:
    building_use: str = "office"
    slab_thickness_m: float = 0.150
    finishes_kN_per_m2: float = 1.0
    services_kN_per_m2: float = 0.5
    partitions_kN_per_m2: float = 1.0
    beam_x: Beam = field(default_factory=Beam)   # pair spanning in x (left + right)
    beam_y: Beam = field(default_factory=Beam)   # pair spanning in y (top + bottom)
    imposed_override_kN_per_m2: Optional[float] = None

    def live_load_kN_per_m2(self) -> float:
        if self.imposed_override_kN_per_m2 is not None:
            return self.imposed_override_kN_per_m2
        return live_load_for_use(self.building_use)

    def slab_self_weight_kN_per_m2(self, concrete_density: float) -> float:
        return self.slab_thickness_m * concrete_density

    def dead_load_kN_per_m2(self, concrete_density: float) -> float:
        return (
            self.slab_self_weight_kN_per_m2(concrete_density)
            + self.finishes_kN_per_m2
            + self.services_kN_per_m2
            + self.partitions_kN_per_m2
        )


@dataclass
class LevelSpec:
    """
    Per-storey overrides. Any field left None falls back to the column-wide
    value, so a request that sets none of these behaves exactly as before.
    """
    b_mm: Optional[float] = None
    h_mm: Optional[float] = None
    main_bar_dia_mm: Optional[float] = None
    n_bars_total: Optional[int] = None
    n_bars_b_face: Optional[int] = None
    n_bars_h_face: Optional[int] = None
    link_dia_mm: Optional[float] = None
    storey_height_m: Optional[float] = None
    floor: Optional["FloorTemplate"] = None


@dataclass
class ColumnInput:
    # --- identity / route ---
    column_id: str = "C1"
    column_type: str = "biaxial"           # axial | uniaxial | biaxial
    # Which axis a uniaxial column bends about. "x" means bending about the
    # x-axis, so the section depth resisting it is h. Ignored for the other
    # two routes. Without this a uniaxial column was always assumed to bend
    # about x, and a y-axis moment could only be modelled by swapping b and h.
    uniaxial_axis: str = "x"               # x | y
    design_code: str = "EC2"

    # --- section ---
    b_mm: float = 230.0                     # width  (x direction)
    h_mm: float = 460.0                     # depth  (y direction)
    storey_height_m: float = 3.0
    clear_height_m: Optional[float] = None   # defaults to storey_height_m
    end_condition: str = "fixed-fixed"
    braced: bool = True

    # Effective length. Precedence: l0_override -> k1/k2 (EC2 Eq. 5.15/5.16)
    # -> idealised K from end_condition. Real frame columns need the k-factor
    # route: the same clear height gives a different l0 about each axis.
    l0_override_x_mm: Optional[float] = None
    l0_override_y_mm: Optional[float] = None
    k1_x: Optional[float] = None
    k2_x: Optional[float] = None
    k1_y: Optional[float] = None
    k2_y: Optional[float] = None

    include_geometric_imperfections: bool = True

    # EC2 Cl. 5.8.3.1 permits either computed A and B, or the defaults
    # A = 0.7 (phi_ef unknown) and B = 1.1 (omega unknown). Default to the
    # code defaults: they are conservative, they match published worked
    # examples, and B computed from omega needs As, which is not known at
    # the point slenderness is classified.
    use_default_A_B: bool = True

    # --- reinforcement ---
    main_bar_dia_mm: float = 16.0
    n_bars_total: int = 8
    n_bars_b_face: Optional[int] = None     # bars on each face parallel to b (incl. corners)
    n_bars_h_face: Optional[int] = None     # bars on each face parallel to h (incl. corners)
    link_dia_mm: float = 8.0

    # --- durability / cover ---
    exposure_class: str = "XC1"
    delta_c_dev_mm: float = 10.0
    clear_cover_override_mm: Optional[float] = None

    # --- materials ---
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"
    concrete_density_kN_per_m3: float = 25.0
    masonry_density_kN_per_m3: float = 20.0

    # --- partial factors ---
    gamma_G: float = 1.35
    gamma_Q: float = 1.50
    gamma_c: float = 1.50
    gamma_s: float = 1.15
    alpha_cc: float = 0.85

    # --- tributary geometry (m) ---
    left_x_m: float = 4.0
    right_x_m: float = 5.0
    top_y_m: float = 3.5
    bottom_y_m: float = 3.5

    # --- building for take-down ---
    number_of_typical_floors: int = 3
    typical_floor: FloorTemplate = field(default_factory=FloorTemplate)
    roof_floor: FloorTemplate = field(
        default_factory=lambda: FloorTemplate(
            building_use="roof_no_access",
            finishes_kN_per_m2=0.75,
            services_kN_per_m2=0.25,
            partitions_kN_per_m2=0.0,
            beam_x=Beam(wall=Wall(present=False)),
            beam_y=Beam(wall=Wall(present=False)),
        )
    )

    # --- first order moments from frame analysis, per level (kNm) ---
    M01x_kNm: Dict[str, float] = field(default_factory=dict)
    M02x_kNm: Dict[str, float] = field(default_factory=dict)
    M01y_kNm: Dict[str, float] = field(default_factory=dict)
    M02y_kNm: Dict[str, float] = field(default_factory=dict)

    include_min_eccentricity: bool = True
    effective_creep_ratio: float = 2.0      # phi_ef for the nominal curvature method

    # --- automatic bar selection ---
    # Off by default: the engine verifies what it is given. Switched on it
    # proposes the smallest cage that passes every check at each storey, within
    # whatever section that storey has. Sections are never changed -- if no
    # candidate fits, that is the signal the section is too small.
    autosize_bars: bool = False
    autosize_candidates: Optional[List[Tuple[int, int]]] = None

    # --- per-storey overrides, keyed by level name ---
    # Empty means one section and one cage for the whole column, which is the
    # original behaviour and the path the published worked examples verify.
    level_specs: Dict[str, LevelSpec] = field(default_factory=dict)

    # --- OVERRIDES: bypass the take-down and design directly ---
    NEd_override_kN: Optional[float] = None
    MEdx_override_kNm: Optional[float] = None
    MEdy_override_kNm: Optional[float] = None


# ============================================================
# 3. MATERIALS
# ============================================================

class Materials:
    def __init__(self, d: ColumnInput):
        self.fck = get_fck(d.concrete_grade)
        self.fyk = get_fyk(d.steel_grade)
        self.gamma_c = d.gamma_c
        self.gamma_s = d.gamma_s
        self.alpha_cc = d.alpha_cc

    @property
    def fcd(self) -> float:
        return self.alpha_cc * self.fck / self.gamma_c

    @property
    def fyd(self) -> float:
        return self.fyk / self.gamma_s

    @property
    def eps_yd(self) -> float:
        return self.fyd / Es_MPA

    @property
    def lambda_block(self) -> float:
        """EC2 Cl. 3.1.7(3): depth of the rectangular stress block."""
        if self.fck <= 50.0:
            return 0.8
        return 0.8 - (self.fck - 50.0) / 400.0

    @property
    def eta_block(self) -> float:
        """EC2 Cl. 3.1.7(3): effective strength factor."""
        if self.fck <= 50.0:
            return 1.0
        return 1.0 - (self.fck - 50.0) / 200.0

    @property
    def eps_cu3(self) -> float:
        """EC2 Table 3.1: ultimate strain, bilinear/rectangular law."""
        if self.fck <= 50.0:
            return 0.0035
        return (2.6 + 35.0 * ((90.0 - self.fck) / 100.0) ** 4) / 1000.0

    @property
    def eps_c3(self) -> float:
        """EC2 Table 3.1: strain at the pivot for pure compression."""
        if self.fck <= 50.0:
            return 0.00175
        return (1.75 + 0.55 * ((self.fck - 50.0) / 40.0)) / 1000.0

    def steel_stress(self, eps: float) -> float:
        """Bilinear with horizontal top branch (EC2 Cl. 3.2.7, Fig. 3.8)."""
        return max(-self.fyd, min(self.fyd, Es_MPA * eps))


# ============================================================
# 4. GEOMETRY + BAR LAYOUT
# ============================================================

def distribute_bars(n_total: int, b_mm: float, h_mm: float) -> Tuple[int, int, int]:
    """
    Spread n_total bars around the perimeter with bars at all four corners.

    Returns (n_b_face, n_h_face, n_used) where
        n_used = 2*n_b_face + 2*n_h_face - 4
    and more bars land on the longer face. n_total is rounded up to the
    next even number if odd, since the layout must stay symmetric.
    """
    n = max(4, int(n_total))
    if n % 2 == 1:
        n += 1
    s = n // 2 + 2                      # n_b_face + n_h_face
    n_h = int(round(s * h_mm / (b_mm + h_mm)))
    n_h = max(2, min(s - 2, n_h))
    n_b = s - n_h
    return n_b, n_h, 2 * n_b + 2 * n_h - 4


class Geometry:
    def __init__(self, d: ColumnInput, mat: Materials):
        self.d = d
        self.mat = mat
        self.b = d.b_mm
        self.h = d.h_mm

        if d.n_bars_b_face and d.n_bars_h_face:
            self.n_b_face = int(d.n_bars_b_face)
            self.n_h_face = int(d.n_bars_h_face)
            self.n_bars = 2 * self.n_b_face + 2 * self.n_h_face - 4
        else:
            self.n_b_face, self.n_h_face, self.n_bars = distribute_bars(
                d.n_bars_total, self.b, self.h
            )

        self.bar_dia = d.main_bar_dia_mm
        self.link_dia = d.link_dia_mm
        self.cover = self._nominal_cover()
        self.d_prime = self.cover + self.link_dia + self.bar_dia / 2.0

    # ---------- cover ----------
    def c_min_dur(self) -> float:
        return EXPOSURE_MIN_DUR_MM.get(self.d.exposure_class, 25.0)

    def c_min_b(self) -> float:
        # EC2 Cl. 4.4.1.2(3): bond cover equals the bar diameter for
        # separated bars. Links are checked too since they sit outermost.
        return max(self.bar_dia, self.link_dia)

    def c_min(self) -> float:
        return max(self.c_min_b(), self.c_min_dur(), 10.0)

    def _nominal_cover(self) -> float:
        if self.d.clear_cover_override_mm is not None:
            return float(self.d.clear_cover_override_mm)
        return self.c_min() + self.d.delta_c_dev_mm

    # ---------- section properties ----------
    @property
    def Ac(self) -> float:
        return self.b * self.h

    @property
    def Ix(self) -> float:
        return self.b * self.h ** 3 / 12.0

    @property
    def Iy(self) -> float:
        return self.h * self.b ** 3 / 12.0

    @property
    def ix(self) -> float:
        return math.sqrt(self.Ix / self.Ac)

    @property
    def iy(self) -> float:
        return math.sqrt(self.Iy / self.Ac)

    @property
    def one_bar_area(self) -> float:
        return bar_area_mm2(self.bar_dia)

    @property
    def As_total(self) -> float:
        return self.n_bars * self.one_bar_area

    @property
    def tributary_width_x_m(self) -> float:
        return 0.5 * (self.d.left_x_m + self.d.right_x_m)

    @property
    def tributary_width_y_m(self) -> float:
        return 0.5 * (self.d.top_y_m + self.d.bottom_y_m)

    @property
    def tributary_area_m2(self) -> float:
        return self.tributary_width_x_m * self.tributary_width_y_m

    def e0_x_mm(self) -> float:
        """Minimum eccentricity for bending about x (section depth h)."""
        return max(20.0, self.h / 30.0)

    def e0_y_mm(self) -> float:
        """Minimum eccentricity for bending about y (section depth b)."""
        return max(20.0, self.b / 30.0)

    # ---------- bar coordinates ----------
    def bar_coords(self) -> List[Tuple[float, float, float]]:
        """
        Bar positions as (x, y, area) with origin at a section corner,
        x along b and y along h. Corners are placed once.
        """
        dp = self.d_prime
        area = self.one_bar_area
        bars: List[Tuple[float, float, float]] = []

        x0, x1 = dp, self.b - dp
        y0, y1 = dp, self.h - dp

        # rows on the two faces parallel to b (y = y0 and y = y1)
        if self.n_b_face == 1:
            xs = [0.5 * (x0 + x1)]
        else:
            step = (x1 - x0) / (self.n_b_face - 1)
            xs = [x0 + i * step for i in range(self.n_b_face)]
        for x in xs:
            bars.append((x, y0, area))
            bars.append((x, y1, area))

        # intermediate bars on the two faces parallel to h, corners excluded
        if self.n_h_face > 2:
            step = (y1 - y0) / (self.n_h_face - 1)
            for i in range(1, self.n_h_face - 1):
                y = y0 + i * step
                bars.append((x0, y, area))
                bars.append((x1, y, area))

        return bars

    def bar_depths(self, axis: str) -> List[Tuple[float, float]]:
        """
        Bars reduced to (depth_from_compression_face, area) for the axis
        being bent about. axis "x" bends about the x-axis, so the section
        depth is h and the relevant coordinate is y.
        """
        if axis == "x":
            return [(y, a) for (_x, y, a) in self.bar_coords()]
        return [(x, a) for (x, _y, a) in self.bar_coords()]

    def section_depth(self, axis: str) -> float:
        return self.h if axis == "x" else self.b

    def section_width(self, axis: str) -> float:
        return self.b if axis == "x" else self.h


# ============================================================
# 5. LOAD TAKE-DOWN
# ============================================================

class LoadTakedown:
    def __init__(self, d: ColumnInput, geo: Geometry, geo_by_level=None):
        self.d = d
        self.geo = geo
        # Each storey carries its own weight into everything beneath it, so a
        # column that changes section up the building cannot use one figure.
        self.geo_by_level = geo_by_level or {}

    def _geo(self, level=None) -> Geometry:
        return self.geo_by_level.get(level, self.geo) if level else self.geo

    def column_self_weight_kN(self, level=None) -> float:
        g = self._geo(level)
        sp = self.d.level_specs.get(level) if level else None
        H = (sp.storey_height_m if (sp and sp.storey_height_m) else self.d.storey_height_m)
        return (
            self.d.gamma_G
            * (g.b / 1000.0)
            * (g.h / 1000.0)
            * H
            * self.d.concrete_density_kN_per_m3
        )

    def floor_breakdown(self, floor: FloorTemplate, level=None) -> Dict[str, float]:
        rho_c = self.d.concrete_density_kN_per_m3
        rho_w = self.d.masonry_density_kN_per_m3

        Gk = floor.dead_load_kN_per_m2(rho_c)
        Qk = floor.live_load_kN_per_m2()
        q_uls = self.d.gamma_G * Gk + self.d.gamma_Q * Qk
        slab_to_column = q_uls * self.geo.tributary_area_m2

        bx_sw = floor.beam_x.self_weight_kN_per_m(rho_c)
        by_sw = floor.beam_y.self_weight_kN_per_m(rho_c)
        bx_wall = floor.beam_x.wall_line_load_kN_per_m(self.d.storey_height_m, rho_w)
        by_wall = floor.beam_y.wall_line_load_kN_per_m(self.d.storey_height_m, rho_w)

        # Four beams frame into the column. The x-direction pair spans
        # left_x_m and right_x_m, delivering w*(left/2 + right/2) = w*tx.
        # The y-direction pair likewise delivers w*ty. Both pairs count.
        span_x = self.geo.tributary_width_x_m
        span_y = self.geo.tributary_width_y_m
        bx_reaction = self.d.gamma_G * (bx_sw + bx_wall) * span_x
        by_reaction = self.d.gamma_G * (by_sw + by_wall) * span_y

        col_sw = self.column_self_weight_kN(level)
        total = slab_to_column + bx_reaction + by_reaction + col_sw

        return {
            "Gk": Gk, "Qk": Qk, "q_uls": q_uls,
            "slab_to_column": slab_to_column,
            "bx_sw": bx_sw, "by_sw": by_sw,
            "bx_wall": bx_wall, "by_wall": by_wall,
            "bx_reaction": bx_reaction, "by_reaction": by_reaction,
            "span_x": span_x, "span_y": span_y,
            "column_self_weight": col_sw,
            "total_floor_load": total,
        }

    def floor_for(self, level: str) -> FloorTemplate:
        sp = self.d.level_specs.get(level)
        if sp is not None and sp.floor is not None:
            return sp.floor
        return self.d.roof_floor if level == "Roof" else self.d.typical_floor

    def typical(self) -> Dict[str, float]:
        return self.floor_breakdown(self.d.typical_floor)

    def roof(self) -> Dict[str, float]:
        return self.floor_breakdown(self.d.roof_floor)

    def level_names(self) -> List[str]:
        return ["Roof"] + [f"Typical_Floor_{i}"
                           for i in range(self.d.number_of_typical_floors, 0, -1)]

    def axial_by_level(self) -> Dict[str, float]:
        """
        Cumulative NEd at each level, ordered top down. Roof first, then
        Typical_Floor_n ... Typical_Floor_1, so the last entry carries the
        largest load. The critical level is taken by value, not position.
        """
        results: Dict[str, float] = {}
        running = 0.0
        for name in self.level_names():
            # Each level's own floor template and own column section.
            running += self.floor_breakdown(self.floor_for(name), name)["total_floor_load"]
            results[name] = running
        return results


# ============================================================
# 6. SECTION ANALYSIS — STRAIN COMPATIBILITY
# ============================================================

class SectionAnalysis:
    """
    Rectangular section, symmetric perimeter reinforcement, uniaxial
    bending about one axis. Sign convention: compression positive.
    """

    def __init__(self, geo: Geometry, mat: Materials, axis: str):
        self.geo = geo
        self.mat = mat
        self.axis = axis
        self.depth = geo.section_depth(axis)       # section depth in bending plane
        self.width = geo.section_width(axis)
        self.bars = geo.bar_depths(axis)

    # ---------- strain profile ----------
    def strain_at(self, y: float, x: float) -> float:
        """
        Strain at depth y from the compression face for neutral axis depth x.

        x <= depth : pivot at the compression face, eps_cu3
        x >  depth : pivot at point C, eps_c3 at depth h*(1 - eps_c3/eps_cu3)
        """
        eps_cu3 = self.mat.eps_cu3
        eps_c3 = self.mat.eps_c3
        if x <= 0:
            return 0.0
        if x <= self.depth:
            return eps_cu3 * (x - y) / x
        y_c = self.depth * (1.0 - eps_c3 / eps_cu3)
        return eps_c3 * (x - y) / (x - y_c)

    # ---------- resultants ----------
    def forces(self, x: float) -> Tuple[float, float]:
        """
        Return (N_kN, M_kNm) for neutral axis depth x, moment taken about
        the section centroid. Bars inside the compression block have the
        displaced concrete deducted.
        """
        mat = self.mat
        eta_fcd = mat.eta_block * mat.fcd
        a = min(mat.lambda_block * x, self.depth)      # stress block depth
        a = max(a, 0.0)

        Fc = eta_fcd * self.width * a                  # N
        centroid = self.depth / 2.0
        M = Fc * (centroid - a / 2.0)                  # N.mm
        N = Fc

        for (y, area) in self.bars:
            eps = self.strain_at(y, x)
            sigma = mat.steel_stress(eps)
            if y <= a:                                 # bar sits in the block
                sigma -= eta_fcd
            Fs = area * sigma
            N += Fs
            M += Fs * (centroid - y)

        return N / 1000.0, M / 1e6

    # ---------- capacity envelope ----------
    def N_pure_compression(self) -> float:
        """NRd at uniform strain eps_c3 (steel does not reach fyd here)."""
        mat = self.mat
        eta_fcd = mat.eta_block * mat.fcd
        sigma_s = mat.steel_stress(mat.eps_c3)
        As = sum(a for (_y, a) in self.bars)
        return (eta_fcd * (self.width * self.depth - As) + As * sigma_s) / 1000.0

    def N_simplified_kN(self) -> float:
        """
        Textbook form: NRd = Ac*fcd + As*fyd.

        Reported for reconciliation only, never used for the design check.
        It differs from N_pure_compression() in two ways: it does not deduct
        the concrete displaced by the bars, and it assumes the steel reaches
        fyd, which cannot happen in pure compression because the concrete
        pivot eps_c3 caps the steel strain below eps_yd for B500.
        """
        As = sum(a for (_y, a) in self.bars)
        return (self.width * self.depth * self.mat.fcd + As * self.mat.fyd) / 1000.0

    def N_pure_tension(self) -> float:
        As = sum(a for (_y, a) in self.bars)
        return -As * self.mat.fyd / 1000.0

    def MRd_at(self, NEd_kN: float) -> float:
        """
        Moment capacity at the given axial load, by bisection on the
        neutral axis depth. N(x) is monotonic for symmetric reinforcement,
        so the solution is unique.
        """
        N_max = self.N_pure_compression()
        if NEd_kN >= N_max:
            return 0.0
        if NEd_kN <= self.N_pure_tension():
            return 0.0

        lo, hi = 1e-6, self.depth
        # grow hi until it brackets NEd
        while self.forces(hi)[0] < NEd_kN and hi < 100.0 * self.depth:
            hi *= 2.0

        for _ in range(200):
            mid = 0.5 * (lo + hi)
            if self.forces(mid)[0] < NEd_kN:
                lo = mid
            else:
                hi = mid
            if hi - lo < 1e-9 * self.depth:
                break

        x = 0.5 * (lo + hi)
        return max(self.forces(x)[1], 0.0)

    def interaction_curve(self, n_points: int = 40) -> List[Dict[str, float]]:
        """Sampled N-M diagram, useful for plotting on the results page."""
        pts: List[Dict[str, float]] = []
        x_max = 6.0 * self.depth
        for i in range(n_points + 1):
            t = i / n_points
            x = 0.02 * self.depth * (x_max / (0.02 * self.depth)) ** t
            N, M = self.forces(x)
            pts.append({"N_kN": round(N, 3), "M_kNm": round(M, 3), "x_mm": round(x, 2)})
        return pts


# ============================================================
# 7. SLENDERNESS + SECOND ORDER
# ============================================================

class Slenderness:
    def __init__(self, d: ColumnInput, geo: Geometry, mat: Materials):
        self.d = d
        self.geo = geo
        self.mat = mat

    @property
    def K(self) -> float:
        return support_k(self.d.end_condition)

    @property
    def clear_height_mm(self) -> float:
        h = self.d.clear_height_m if self.d.clear_height_m is not None else self.d.storey_height_m
        return h * 1000.0

    def l0_source(self, axis: str) -> str:
        if (self.d.l0_override_x_mm if axis == "x" else self.d.l0_override_y_mm) is not None:
            return "override"
        k1 = self.d.k1_x if axis == "x" else self.d.k1_y
        k2 = self.d.k2_x if axis == "x" else self.d.k2_y
        if k1 is not None and k2 is not None:
            return "k-factors"
        return "idealised K"

    def l0_axis_mm(self, axis: str) -> float:
        """
        EN 1992-1-1 Cl. 5.8.3.2(3).
            braced   Eq. 5.15: l0 = 0.5*l*sqrt((1+k1/(0.45+k1))*(1+k2/(0.45+k2)))
            unbraced Eq. 5.16: l0 = l*max(sqrt(1+10*k1*k2/(k1+k2)),
                                          (1+k1/(1+k1))*(1+k2/(1+k2)))
        k is the joint flexibility. EC2 notes k = 0 is a theoretical value
        only, so 0.1 is taken as the practical lower bound.
        """
        ov = self.d.l0_override_x_mm if axis == "x" else self.d.l0_override_y_mm
        if ov is not None:
            return float(ov)

        k1 = self.d.k1_x if axis == "x" else self.d.k1_y
        k2 = self.d.k2_x if axis == "x" else self.d.k2_y
        l = self.clear_height_mm
        if k1 is not None and k2 is not None:
            k1 = max(float(k1), 0.1)
            k2 = max(float(k2), 0.1)
            if self.d.braced:
                return 0.5 * l * math.sqrt(
                    (1.0 + k1 / (0.45 + k1)) * (1.0 + k2 / (0.45 + k2))
                )
            return l * max(
                math.sqrt(1.0 + 10.0 * k1 * k2 / (k1 + k2)),
                (1.0 + k1 / (1.0 + k1)) * (1.0 + k2 / (1.0 + k2)),
            )
        return self.K * l

    @property
    def l0_mm(self) -> float:
        """Back-compatible scalar: the larger of the two axis values."""
        return max(self.l0_axis_mm("x"), self.l0_axis_mm("y"))

    def lambda_axis(self, axis: str) -> float:
        i = self.geo.ix if axis == "x" else self.geo.iy
        return self.l0_axis_mm(axis) / i

    def imperfection_ecc_mm(self, axis: str) -> float:
        """EN 1992-1-1 Cl. 5.2: ei = l0/400 for an isolated member."""
        if not self.d.include_geometric_imperfections:
            return 0.0
        return self.l0_axis_mm(axis) / 400.0

    def n_relative(self, NEd_kN: float) -> float:
        return (NEd_kN * 1000.0) / (self.geo.Ac * self.mat.fcd)

    def factor_A(self) -> float:
        """EC2 Cl. 5.8.3.1: A = 1/(1 + 0.2*phi_ef), or 0.7 by default."""
        if self.d.use_default_A_B:
            return 0.7
        return 1.0 / (1.0 + 0.2 * self.d.effective_creep_ratio)

    def factor_B(self) -> float:
        """EC2 Cl. 5.8.3.1: B = sqrt(1 + 2*omega), or 1.1 by default."""
        if self.d.use_default_A_B:
            return 1.1
        omega = self.geo.As_total * self.mat.fyd / (self.geo.Ac * self.mat.fcd)
        return math.sqrt(1.0 + 2.0 * omega)

    def factor_C(self, M01: float, M02: float) -> float:
        """
        EC2 Cl. 5.8.3.1: C = 1.7 - rm, rm = M01/M02.
        C = 0.7 where the moment ratio is unknown or the member is unbraced.
        """
        if not self.d.braced:
            return 0.7
        if abs(M02) < 1e-9:
            return 0.7
        rm = M01 / M02                      # M01 is the smaller magnitude
        return max(0.7, min(2.7, 1.7 - rm))

    def lambda_lim(self, NEd_kN: float, M01: float = 0.0, M02: float = 0.0) -> float:
        n = max(self.n_relative(NEd_kN), 1e-6)
        A, B, C = self.factor_A(), self.factor_B(), self.factor_C(M01, M02)
        return 20.0 * A * B * C / math.sqrt(n)

    def second_order_moment_kNm(self, NEd_kN: float, axis: str) -> Dict[str, float]:
        """
        Nominal curvature method, EC2 Cl. 5.8.8.
            e2 = (1/r) * l0^2 / c,  c = 10
            1/r = Kr * Kphi * 1/r0,  1/r0 = eps_yd / (0.45*d)
        """
        geo, mat = self.geo, self.mat
        depth = geo.section_depth(axis)
        d_eff = depth - geo.d_prime

        omega = geo.As_total * mat.fyd / (geo.Ac * mat.fcd)
        n = self.n_relative(NEd_kN)
        n_u = 1.0 + omega
        n_bal = 0.4
        Kr = (n_u - n) / (n_u - n_bal) if (n_u - n_bal) > 0 else 1.0
        Kr = max(0.0, min(1.0, Kr))

        lam = self.lambda_axis(axis)
        beta = 0.35 + mat.fck / 200.0 - lam / 150.0
        Kphi = max(1.0, 1.0 + beta * self.d.effective_creep_ratio)

        inv_r0 = mat.eps_yd / (0.45 * d_eff)
        inv_r = Kr * Kphi * inv_r0
        e2 = inv_r * self.l0_axis_mm(axis) ** 2 / 10.0
        M2 = NEd_kN * e2 / 1000.0

        return {
            "omega": omega, "n": n, "n_u": n_u, "Kr": Kr,
            "beta": beta, "Kphi": Kphi, "d_eff": d_eff,
            "inv_r0": inv_r0, "inv_r": inv_r, "e2_mm": e2, "M2_kNm": M2,
        }


# ============================================================
# 8. DETAILING
# ============================================================

def min_tie_diameter_mm(main_bar_dia: float) -> float:
    """EC2 Cl. 9.5.3(1)."""
    return max(6.0, main_bar_dia / 4.0)


def max_tie_spacing_mm(main_bar_dia: float, b: float, h: float) -> float:
    """EC2 Cl. 9.5.3(3): min(20*phi_long, lesser column dimension, 400)."""
    return min(20.0 * main_bar_dia, min(b, h), 400.0)


def reduced_tie_spacing_mm(s_max: float) -> float:
    """EC2 Cl. 9.5.3(4): 0.6*s_max near beams/slabs and at lap zones."""
    return 0.6 * s_max


def As_min_mm2(NEd_kN: float, Ac: float, fyd: float) -> Tuple[float, float, float]:
    """EC2 Cl. 9.5.2(2). Returns (governing, basis_1, basis_2)."""
    basis_1 = 0.10 * NEd_kN * 1000.0 / fyd
    basis_2 = 0.002 * Ac
    return max(basis_1, basis_2), basis_1, basis_2


def As_max_mm2(Ac: float) -> float:
    """EC2 Cl. 9.5.2(3), outside lap locations."""
    return 0.04 * Ac


# ============================================================
# 9. REPORT HELPERS
# ============================================================

def row(reference: str, calculation: str, output: str = "") -> Dict[str, str]:
    return {"reference": reference, "calculation": calculation, "output": output}


def section(title: str, rows: List[Dict[str, str]]) -> Dict:
    return {"title": title, "rows": rows}


def f3(v: float) -> str:
    return f"{v:,.3f}"


def f1(v: float) -> str:
    return f"{v:,.1f}"


# ============================================================
# 10. ENGINE
# ============================================================

class ColumnEngine:
    def __init__(self, d: ColumnInput):
        self.d = d
        self.mat = Materials(d)
        self.geo = Geometry(d, self.mat)
        self.slender = Slenderness(d, self.geo, self.mat)
        self.sec_x = SectionAnalysis(self.geo, self.mat, "x")
        self.sec_y = SectionAnalysis(self.geo, self.mat, "y")

        # Per-storey objects. With no level_specs every entry is the base
        # column, so this is the original single-section behaviour exactly.
        self.geo_by_level: Dict[str, Geometry] = {}
        self.slender_by_level: Dict[str, Slenderness] = {}
        self.sec_by_level: Dict[str, Tuple[SectionAnalysis, SectionAnalysis]] = {}
        names = ["Roof"] + [f"Typical_Floor_{i}"
                            for i in range(d.number_of_typical_floors, 0, -1)]
        if d.NEd_override_kN is not None:
            names = ["Design"]
        for name in names:
            di = self._level_input(name)
            if di is d:
                g, sl, sx, sy = self.geo, self.slender, self.sec_x, self.sec_y
            else:
                g = Geometry(di, self.mat)
                sl = Slenderness(di, g, self.mat)
                sx = SectionAnalysis(g, self.mat, "x")
                sy = SectionAnalysis(g, self.mat, "y")
            self.geo_by_level[name] = g
            self.slender_by_level[name] = sl
            self.sec_by_level[name] = (sx, sy)

        self.takedown = LoadTakedown(d, self.geo, self.geo_by_level)
        self.ctype = (d.column_type or "biaxial").strip().lower()
        if self.ctype not in ("axial", "uniaxial", "biaxial"):
            raise ValueError("column_type must be axial, uniaxial or biaxial")
        self.uni_axis = (d.uniaxial_axis or "x").strip().lower()
        if self.uni_axis not in ("x", "y"):
            raise ValueError("uniaxial_axis must be x or y")

    def _level_input(self, level: str) -> ColumnInput:
        """A ColumnInput with this level's overrides applied, or the base one."""
        sp = self.d.level_specs.get(level)
        if sp is None:
            return self.d
        kw = {}
        for f in ("b_mm", "h_mm", "main_bar_dia_mm", "n_bars_total",
                  "n_bars_b_face", "n_bars_h_face", "link_dia_mm",
                  "storey_height_m"):
            v = getattr(sp, f, None)
            if v is not None:
                kw[f] = v
        return dataclasses.replace(self.d, **kw) if kw else self.d

    def geo_for(self, level: str) -> Geometry:
        return self.geo_by_level.get(level, self.geo)

    def sections_for(self, level: str):
        return self.sec_by_level.get(level, (self.sec_x, self.sec_y))

    def slender_for(self, level: str) -> Slenderness:
        return self.slender_by_level.get(level, self.slender)

    # ---------- moments ----------
    @staticmethod
    def M0e(M01: float, M02: float) -> float:
        """
        EC2 Cl. 5.8.8.2(2): M0e = max(0.6*M02 + 0.4*M01, 0.4*M02), signs kept.

        This is the EQUIVALENT first order moment, used only as the base for
        the second order moment M2. It is NOT the design moment on its own:
        the end section still has to carry M02. Returned as a magnitude.
        """
        return abs(max(0.6 * M02 + 0.4 * M01, 0.4 * M02, key=abs))

    def end_moments(self, level: str, axis: str) -> Tuple[float, float]:
        """Ordered (M01, M02) for the level and axis, zero on the axial route."""
        if self.ctype == "axial":
            return 0.0, 0.0
        if self.ctype == "uniaxial" and axis != self.uni_axis:
            return 0.0, 0.0
        src01 = self.d.M01x_kNm if axis == "x" else self.d.M01y_kNm
        src02 = self.d.M02x_kNm if axis == "x" else self.d.M02y_kNm
        return order_end_moments(src01.get(level, 0.0), src02.get(level, 0.0))

    def min_ecc_moment(self, NEd_kN: float, axis: str, geo: Geometry = None) -> float:
        g = geo or self.geo
        e0 = g.e0_x_mm() if axis == "x" else g.e0_y_mm()
        return NEd_kN * e0 / 1000.0

    # ---------- biaxial exponent ----------
    def biaxial_exponent(self, NEd_kN: float, geo: Geometry = None) -> Tuple[float, float]:
        """
        EC2 Cl. 5.8.9(4): a interpolated on NEd/NRd, where
        NRd = Ac*fcd + As*fyd (the code's own definition for this clause).
        """
        g = geo or self.geo
        NRd = (g.Ac * self.mat.fcd + g.As_total * self.mat.fyd) / 1000.0
        ratio = NEd_kN / NRd if NRd > 0 else 0.0
        pts = [(0.1, 1.0), (0.7, 1.5), (1.0, 2.0)]
        if ratio <= pts[0][0]:
            a = pts[0][1]
        elif ratio >= pts[-1][0]:
            a = pts[-1][1]
        else:
            a = pts[-1][1]
            for (r0, a0), (r1, a1) in zip(pts, pts[1:]):
                if r0 <= ratio <= r1:
                    a = a0 + (a1 - a0) * (ratio - r0) / (r1 - r0)
                    break
        return a, ratio

    # ---------- per-level design ----------
    def design_level(self, level: str, NEd_kN: float) -> Dict:
        # This storey's own section, cage, slenderness and section analyses.
        geo = self.geo_for(level)
        sl = self.slender_for(level)
        sec_x, sec_y = self.sections_for(level)
        res: Dict = {"level": level, "NEd_kN": NEd_kN,
                     "b_mm": geo.b, "h_mm": geo.h,
                     "bar_dia_mm": geo.bar_dia, "n_bars": geo.n_bars,
                     "link_dia_mm": geo.link_dia,
                     "As_provided_mm2": round(geo.As_total, 1),
                     "cover_mm": round(geo.cover, 1),
                     "rho_pct": round(100.0 * geo.As_total / geo.Ac, 3)}

        for axis in ("x", "y"):
            lam = sl.lambda_axis(axis)
            # An axially loaded column is designed for minimum eccentricity
            # only, so its moment diagram is effectively uniform and the
            # frame moments must not leak into factor C. Same for the weak
            # axis of a uniaxial column.
            uses_frame_moments = (
                self.ctype == "biaxial"
                or (self.ctype == "uniaxial" and axis == self.uni_axis)
            )
            if uses_frame_moments:
                M01, M02 = self.end_moments(level, axis)
            else:
                M01 = M02 = 0.0
            lam_lim = sl.lambda_lim(NEd_kN, M01, M02)
            is_slender = lam > lam_lim

            # EC2 Cl. 5.2 geometric imperfection, added to the first order
            # moment before anything else.
            ei = sl.imperfection_ecc_mm(axis)
            M_imp = NEd_kN * ei / 1000.0

            # Two distinct first order moments, both of which must be carried:
            #   M_end  - the larger end moment, governs a short column
            #   M_eq   - the equivalent moment, the base for M2 on a slender one
            M_end = abs(M02) + M_imp
            M_eq = self.M0e(M01, M02) + M_imp
            M_min = self.min_ecc_moment(NEd_kN, axis, geo) if self.d.include_min_eccentricity else 0.0

            so = sl.second_order_moment_kNm(NEd_kN, axis)
            M2 = so["M2_kNm"] if is_slender else 0.0

            M_first = max(M_end, M_eq, M_min)
            MEd = max(M_end, M_eq + M2, M_min)

            override = self.d.MEdx_override_kNm if axis == "x" else self.d.MEdy_override_kNm
            if override is not None:
                MEd = float(override)

            sec = sec_x if axis == "x" else sec_y
            MRd = sec.MRd_at(NEd_kN)

            # MRd is zero when NEd already exceeds the axial capacity. Guard
            # against inf/NaN here: JSON has no representation for either, so
            # an unguarded value would break the FastAPI response.
            if MRd > 1e-9:
                util = MEd / MRd
            else:
                util = UTIL_CAP if MEd > 1e-9 else 0.0
            util = min(util, UTIL_CAP)

            res[axis] = {
                "lambda": lam, "lambda_lim": lam_lim, "slender": is_slender,
                "l0_mm": sl.l0_axis_mm(axis),
                "l0_source": sl.l0_source(axis),
                "M01": M01, "M02": M02, "M0e": self.M0e(M01, M02),
                "ei_mm": ei, "M_imp": M_imp, "M_end": M_end, "M_eq": M_eq,
                "M_min": M_min,
                "M_first": M_first, "M2": M2, "MEd": MEd, "MRd": MRd,
                "second_order": so,
                "utilisation": util,
            }

        # axial capacity
        NRd_max = sec_x.N_pure_compression()
        res["NRd_max_kN"] = NRd_max
        res["NRd_simplified_kN"] = sec_x.N_simplified_kN()
        res["axial_utilisation"] = NEd_kN / NRd_max if NRd_max > 0 else float("inf")

        # interaction
        if self.ctype == "biaxial":
            a, ratio = self.biaxial_exponent(NEd_kN, geo)
            ux = res["x"]["utilisation"]
            uy = res["y"]["utilisation"]
            interaction = min(ux ** a + uy ** a, UTIL_CAP)
            res["biaxial"] = {"a": a, "N_ratio": ratio, "interaction": interaction}
            res["governing_utilisation"] = interaction
        else:
            # Both axial and uniaxial columns are checked about BOTH axes:
            # the weak axis still carries minimum eccentricity, and if it is
            # slender it also carries a second order moment. EC2 Cl. 5.8.9(2)
            # permits separate design in each principal direction, but it does
            # not permit ignoring one of them.
            res["governing_utilisation"] = max(
                res["x"]["utilisation"], res["y"]["utilisation"]
            )

        # steel limits
        As_req, b1, b2 = As_min_mm2(NEd_kN, geo.Ac, self.mat.fyd)
        res["As_min"] = As_req
        res["As_min_basis_1"] = b1
        res["As_min_basis_2"] = b2

        checks = []
        checks.append(("Axial resistance", res["axial_utilisation"] <= 1.0))
        if self.ctype == "biaxial":
            checks.append(("Biaxial interaction", res["biaxial"]["interaction"] <= 1.0))
        elif self.ctype == "uniaxial":
            bend, other = self.uni_axis, ("y" if self.uni_axis == "x" else "x")
            checks.append((f"Uniaxial bending M{bend}", res[bend]["utilisation"] <= 1.0))
            checks.append((f"Other axis M{other} (min ecc + 2nd order)",
                           res[other]["utilisation"] <= 1.0))
        else:
            checks.append(("Minimum eccentricity Mx", res["x"]["utilisation"] <= 1.0))
            checks.append(("Minimum eccentricity My", res["y"]["utilisation"] <= 1.0))
        checks.append(("As,min", geo.As_total >= As_req))
        checks.append(("As,max", geo.As_total <= As_max_mm2(geo.Ac)))

        s_max = max_tie_spacing_mm(geo.bar_dia, geo.b, geo.h)
        res["detailing"] = {
            "phi_t_min_mm": min_tie_diameter_mm(geo.bar_dia),
            "link_dia_mm": geo.link_dia,
            "s_max_mm": s_max,
            "s_reduced_mm": reduced_tie_spacing_mm(s_max),
            "As_provided_mm2": geo.As_total,
            "As_min_mm2": As_req,
            "As_min_basis_1_mm2": b1,
            "As_min_basis_2_mm2": b2,
            "As_max_mm2": As_max_mm2(geo.Ac),
            "rho_pct": 100.0 * geo.As_total / geo.Ac,
            "n_bars_b_face": geo.n_b_face,
            "n_bars_h_face": geo.n_h_face,
            "d_prime_mm": geo.d_prime,
            "Ac_mm2": geo.Ac,
        }
        res["interaction_x"] = sec_x.interaction_curve()
        res["interaction_y"] = sec_y.interaction_curve()

        res["checks"] = [{"name": n, "pass": bool(p)} for n, p in checks]
        res["status"] = "PASS" if all(p for _n, p in checks) else "FAIL"
        return res

    # ---------- automatic bar selection ----------
    def _trial_level(self, level: str, dia: float, n: int):
        """Build this level's objects for a trial cage, without committing."""
        base = self.d.level_specs.get(level)
        sp = (dataclasses.replace(base, main_bar_dia_mm=float(dia), n_bars_total=int(n),
                                  n_bars_b_face=None, n_bars_h_face=None)
              if base is not None else
              LevelSpec(main_bar_dia_mm=float(dia), n_bars_total=int(n)))
        saved = self.d.level_specs.get(level)
        self.d.level_specs[level] = sp
        try:
            di = self._level_input(level)
            g = Geometry(di, self.mat)
            sl = Slenderness(di, g, self.mat)
            return g, sl, SectionAnalysis(g, self.mat, "x"), SectionAnalysis(g, self.mat, "y")
        finally:
            if saved is None:
                self.d.level_specs.pop(level, None)
            else:
                self.d.level_specs[level] = saved

    def autosize_level(self, level: str, NEd_kN: float, min_dia: float = 0.0) -> Dict:
        """
        Walk the candidate list and keep the first cage that satisfies every
        check at this storey.

        The user's own chosen diameter for this storey is tried FIRST, at
        rising bar counts, before falling back to the general candidate list.
        Someone who picked Y20 on step 2 gets a Y20 cage if one fits -- not
        whatever diameter happens to sit first in AUTOSIZE_CANDIDATES.

        min_dia enforces bar continuity up the column: a lap can only pass as
        much force as its weaker bar, and standard detailing does not let bar
        size drop going down a building. run() carries the diameter chosen at
        the storey above into this one, top down, and no candidate below that
        diameter is offered here.

        Bars do not change the take-down: N_Ed comes from the gross section, so
        there is nothing to iterate. Every candidate is evaluated against the
        same N_Ed.

        Returns the chosen level result with an "autosize" block attached,
        listing every candidate tried and whether it passed -- that list is what
        a results-page dropdown offers, so an engineer can take a bigger cage
        for bar continuity without leaving the app.
        """
        saved = (self.geo_by_level.get(level), self.slender_by_level.get(level),
                 self.sec_by_level.get(level))
        base_cands = self.d.autosize_candidates or AUTOSIZE_CANDIDATES

        # This storey's own chosen diameter, tried first at rising counts.
        di = self._level_input(level)
        own_dia = int(di.main_bar_dia_mm)
        own_counts = sorted({n for dia, n in base_cands if dia == own_dia} | {4, 6, 8})
        preferred = [(own_dia, n) for n in own_counts]
        cands = preferred + [c for c in base_cands if c not in preferred]
        # Bar continuity: nothing offered below what the storey above used.
        cands = [c for c in cands if c[0] >= min_dia]

        attempts: List[Dict] = []
        chosen: Optional[Dict] = None

        for dia, n in cands:
            g, sl, sx, sy = self._trial_level(level, dia, n)
            fits, why = bars_fit(g)
            if not fits:
                attempts.append({"bars": f"{g.n_bars}Y{int(dia)}", "bar_dia_mm": float(dia),
                                 "n_bars": g.n_bars, "As_mm2": round(g.As_total, 1),
                                 "passes": False, "reason": why, "utilisation": None})
                continue
            self.geo_by_level[level] = g
            self.slender_by_level[level] = sl
            self.sec_by_level[level] = (sx, sy)
            res = self.design_level(level, NEd_kN)
            ok = res["status"] == "PASS"
            failed = [c["name"] for c in res["checks"] if not c["pass"]]
            attempts.append({"bars": f"{g.n_bars}Y{int(dia)}", "bar_dia_mm": float(dia),
                             "n_bars": g.n_bars, "As_mm2": round(g.As_total, 1),
                             "passes": bool(ok),
                             "reason": "" if ok else "; ".join(failed),
                             "utilisation": round(res["governing_utilisation"], 4)})
            if ok and chosen is None:
                chosen = res
                chosen_objs = (g, sl, (sx, sy))
                # keep going so the dropdown can offer the larger options too

        if chosen is None:
            # Nothing worked. Restore and hand back the user's own cage with
            # the attempt list, so the failure says why rather than just FAIL.
            if saved[0] is not None:
                self.geo_by_level[level], self.slender_by_level[level], self.sec_by_level[level] = saved
            reason = ("No candidate cage satisfies every check in this section. "
                      "Increase the section or the concrete grade.")
            if min_dia > 0 and not any(a["bar_dia_mm"] >= min_dia for a in attempts):
                reason = (f"No candidate at or above Y{int(min_dia)} was even tried in this "
                         f"section -- the bar list does not reach the diameter carried down "
                         f"from the storey above. Widen the section or raise the candidate list.")
            res = self.design_level(level, NEd_kN)
            res["autosize"] = {"applied": False, "chosen": None, "reason": reason,
                               "attempts": attempts}
            return res

        self.geo_by_level[level], self.slender_by_level[level], self.sec_by_level[level] = \
            chosen_objs[0], chosen_objs[1], chosen_objs[2]
        used_own = abs(chosen["bar_dia_mm"] - own_dia) < 1e-6
        reason = (f"smallest count at your Y{own_dia} that passes every check"
                  if used_own else
                  f"Y{own_dia} does not fit or pass here, so the smallest cage that does "
                  f"is offered instead")
        if min_dia > 0:
            reason += f" (Y{int(min_dia)} minimum, carried down from the storey above)"
        chosen["autosize"] = {
            "applied": True,
            "chosen": f"{chosen['n_bars']}Y{int(chosen['bar_dia_mm'])}",
            "reason": reason,
            "attempts": attempts,
        }
        return chosen

    # ---------- orchestration ----------
    def run(self) -> Dict:
        d, geo, mat = self.d, self.geo, self.mat

        if d.NEd_override_kN is not None:
            axial = {"Design": float(d.NEd_override_kN)}
            used_takedown = False
        else:
            axial = self.takedown.axial_by_level()
            used_takedown = True

        critical_level = max(axial, key=lambda k: axial[k])
        NEd_crit = axial[critical_level]

        if d.autosize_bars:
            # axial.items() is already ordered top down (Roof first, then each
            # floor below it), which is exactly the order bar continuity needs:
            # each storey's minimum diameter is whatever was chosen for the one
            # above it.
            levels = []
            min_dia = 0.0
            for lv, n in axial.items():
                res = self.autosize_level(lv, n, min_dia=min_dia)
                if res.get("autosize", {}).get("applied"):
                    min_dia = res["bar_dia_mm"]
                levels.append(res)
        else:
            levels = [self.design_level(lv, n) for lv, n in axial.items()]
        crit = next(r for r in levels if r["level"] == critical_level)

        failed = []
        for r in levels:
            for c in r["checks"]:
                if not c["pass"]:
                    failed.append(f"{c['name']} — {r['level']}")

        status = "PASS" if not failed else "FAIL"

        result = {
            "summary": {
                "column_id": d.column_id,
                "column_type": self.ctype,
                "uniaxial_axis": self.uni_axis if self.ctype == "uniaxial" else None,
                "design_code": d.design_code,
                "b_mm": geo.b, "h_mm": geo.h,
                "storey_height_m": d.storey_height_m,
                "end_condition": d.end_condition,
                "braced": d.braced,
                "concrete_grade": d.concrete_grade,
                "steel_grade": d.steel_grade,
                "exposure_class": d.exposure_class,
                "cover_mm": geo.cover,
                "n_bars": geo.n_bars,
                "bar_dia_mm": geo.bar_dia,
                "link_dia_mm": geo.link_dia,
                "As_provided_mm2": geo.As_total,
                "critical_level": critical_level,
                "NEd_critical_kN": NEd_crit,
                "used_takedown": used_takedown,
                "status": status,
            },
            "materials": {
                "fck": mat.fck, "fcd": mat.fcd, "fyk": mat.fyk, "fyd": mat.fyd,
                "eps_cu3": mat.eps_cu3, "eps_c3": mat.eps_c3,
                "lambda_block": mat.lambda_block, "eta_block": mat.eta_block,
            },
            "axial_by_level": axial,
            "levels": levels,
            "interaction_x": self.sec_x.interaction_curve(),
            "interaction_y": self.sec_y.interaction_curve(),
            "detailing": {
                "phi_t_min_mm": min_tie_diameter_mm(geo.bar_dia),
                "link_dia_mm": geo.link_dia,
                "s_max_mm": max_tie_spacing_mm(geo.bar_dia, geo.b, geo.h),
                "s_reduced_mm": reduced_tie_spacing_mm(
                    max_tie_spacing_mm(geo.bar_dia, geo.b, geo.h)),
                "As_provided_mm2": geo.As_total,
                "As_min_mm2": crit["As_min"],
                "As_min_basis_1_mm2": crit["As_min_basis_1"],
                "As_min_basis_2_mm2": crit["As_min_basis_2"],
                "As_max_mm2": As_max_mm2(geo.Ac),
                "rho_pct": 100.0 * geo.As_total / geo.Ac,
                "n_bars_b_face": geo.n_b_face,
                "n_bars_h_face": geo.n_h_face,
                "d_prime_mm": geo.d_prime,
                "Ac_mm2": geo.Ac,
            },
            "failed_checks": failed,
            "report": self.build_report(axial, levels, critical_level, used_takedown),
        }
        return result

    # ---------- report ----------
    def build_report(self, axial, levels, critical_level, used_takedown) -> List[Dict]:
        d, geo, mat = self.d, self.geo, self.mat
        sec_list: List[Dict] = []

        # 1 ------------------------------------------------------
        sec_list.append(section("1. BASIC INPUT DATA", [
            row("User input", f"Column ID = {d.column_id}", d.column_id),
            row("Design route", f"Column type = {self.ctype}", self.ctype),
            row("User input", f"Section b x h = {f1(geo.b)} x {f1(geo.h)}", f"{f1(geo.b)} x {f1(geo.h)} mm"),
            row("User input", f"Storey height = {d.storey_height_m}", f"{d.storey_height_m} m"),
            row("Support condition", f"End condition = {d.end_condition}", d.end_condition),
            row("Bracing", "Braced" if d.braced else "Unbraced", "Braced" if d.braced else "Unbraced"),
            row("Durability", f"Exposure class = {d.exposure_class}", d.exposure_class),
            row("Load path", "Take-down from building geometry" if used_takedown
                else "NEd supplied directly (override)", "take-down" if used_takedown else "override"),
        ]))

        # 2 ------------------------------------------------------
        sec_list.append(section("2. MATERIAL PROPERTIES", [
            row("EN 1992-1-1 Table 3.1", f"fck from {d.concrete_grade}", f"{f1(mat.fck)} MPa"),
            row("EN 1992-1-1 Cl. 3.1.6", f"fcd = {mat.alpha_cc} x {f1(mat.fck)} / {mat.gamma_c}", f"{f3(mat.fcd)} MPa"),
            row("EN 1992-1-1 Cl. 3.2.7", f"fyk from {d.steel_grade}", f"{f1(mat.fyk)} MPa"),
            row("EN 1992-1-1 Cl. 3.2.7", f"fyd = {f1(mat.fyk)} / {mat.gamma_s}", f"{f3(mat.fyd)} MPa"),
            row("EN 1992-1-1 Cl. 3.2.7", f"eps_yd = fyd / Es = {f3(mat.fyd)} / {f1(Es_MPA)}", f"{mat.eps_yd:.5f}"),
            row("EN 1992-1-1 Cl. 3.1.7(3)", f"lambda (block depth factor) = {mat.lambda_block}", f"{f3(mat.lambda_block)}"),
            row("EN 1992-1-1 Cl. 3.1.7(3)", f"eta (block strength factor) = {mat.eta_block}", f"{f3(mat.eta_block)}"),
            row("EN 1992-1-1 Table 3.1", f"eps_cu3 = {mat.eps_cu3}", f"{mat.eps_cu3:.5f}"),
            row("EN 1992-1-1 Table 3.1", f"eps_c3 = {mat.eps_c3}", f"{mat.eps_c3:.5f}"),
        ]))

        # 3 ------------------------------------------------------
        rows = [
            row("EN 1992-1-1 Cl. 4.4.1.2(3)", f"c_min,b = max(phi_bar, phi_link) = max({f1(geo.bar_dia)}, {f1(geo.link_dia)})", f"{f1(geo.c_min_b())} mm"),
            row("EN 1992-1-1 Table 4.4N", f"c_min,dur for {d.exposure_class}", f"{f1(geo.c_min_dur())} mm"),
            row("EN 1992-1-1 Cl. 4.4.1.2", f"c_min = max({f1(geo.c_min_b())}, {f1(geo.c_min_dur())}, 10)", f"{f1(geo.c_min())} mm"),
            row("EN 1992-1-1 Cl. 4.4.1.3", f"c_nom = c_min + dc_dev = {f1(geo.c_min())} + {f1(d.delta_c_dev_mm)}", f"{f1(geo.cover)} mm"),
        ]
        if d.clear_cover_override_mm is not None:
            rows.append(row("User override", f"cover forced to {f1(d.clear_cover_override_mm)}", f"{f1(geo.cover)} mm"))
        rows += [
            row("Section geometry", f"Ac = {f1(geo.b)} x {f1(geo.h)}", f"{f1(geo.Ac)} mm2"),
            row("Section property", f"Ix = b*h^3/12 = {f1(geo.b)} x {f1(geo.h)}^3 / 12", f"{geo.Ix:,.0f} mm4"),
            row("Section property", f"Iy = h*b^3/12 = {f1(geo.h)} x {f1(geo.b)}^3 / 12", f"{geo.Iy:,.0f} mm4"),
            row("Section property", "ix = sqrt(Ix/Ac)", f"{f3(geo.ix)} mm"),
            row("Section property", "iy = sqrt(Iy/Ac)", f"{f3(geo.iy)} mm"),
            row("Bar layout", f"{geo.n_b_face} bars per b-face, {geo.n_h_face} per h-face, corners shared", f"{geo.n_bars} x Y{int(geo.bar_dia)}"),
            row("Bar layout", f"As = {geo.n_bars} x pi x {f1(geo.bar_dia)}^2 / 4", f"{f1(geo.As_total)} mm2"),
            row("Bar layout", f"d' = cover + link + phi/2 = {f1(geo.cover)} + {f1(geo.link_dia)} + {f1(geo.bar_dia/2)}", f"{f1(geo.d_prime)} mm"),
        ]
        # The rows above describe ONE column: the base section and cage from
        # step 2. That stops being the whole story once a storey ends up with
        # different values -- either because it was explicitly edited
        # (level_specs) or because auto-size chose a different cage there
        # than it chose elsewhere. self.geo_by_level already reflects
        # whichever of those happened, by the time the report is built (it is
        # assigned fresh in autosize_level() for any storey that passed a
        # search, and never touches self.geo, the base object, so a mismatch
        # here is real divergence, not a stale read).
        def _differs(g2):
            return (abs(g2.b - geo.b) > 1e-6 or abs(g2.h - geo.h) > 1e-6
                    or abs(g2.bar_dia - geo.bar_dia) > 1e-6 or g2.n_bars != geo.n_bars
                    or abs(g2.link_dia - geo.link_dia) > 1e-6 or abs(g2.cover - geo.cover) > 1e-6)

        diverging = [lv2 for lv2, g2 in self.geo_by_level.items() if _differs(g2)]
        if d.level_specs or diverging:
            cause = []
            if d.level_specs:
                cause.append(f"{len(d.level_specs)} storey(s) edited on input")
            if d.autosize_bars:
                cause.append("bars chosen independently per storey by auto-size")
            rows.append(row("Per-storey", "the values above are the base column; the "
                                          "storeys below differ from it "
                                          f"({', '.join(cause) if cause else 'per-storey values differ'})",
                            f"{len(diverging)} storey(s) differ" if diverging
                            else f"{len(d.level_specs)} storey(s) edited"))
            for lv2 in self.geo_by_level:
                g2 = self.geo_by_level[lv2]
                flag = "" if g2 in (geo,) or not _differs(g2) else "  <- differs from base"
                rows.append(row(f"{lv2}",
                                f"b x h = {f1(g2.b)} x {f1(g2.h)}, {g2.n_bars} x Y{int(g2.bar_dia)}, "
                                f"links Y{int(g2.link_dia)}, cover {f1(g2.cover)}, d' = {f1(g2.d_prime)}",
                                f"ix {f3(g2.ix)}, iy {f3(g2.iy)} mm{flag}"))
        sec_list.append(section("3. GEOMETRY, COVER AND BAR LAYOUT", rows))

        # 4 / 5 --------------------------------------------------
        if used_takedown:
            tr = self.takedown.typical()
            rr = self.takedown.roof()
            tf = d.typical_floor
            sec_list.append(section("4. TRIBUTARY GEOMETRY", [
                row("Tributary area method", f"tx = {d.left_x_m}/2 + {d.right_x_m}/2", f"{f3(geo.tributary_width_x_m)} m"),
                row("Tributary area method", f"ty = {d.top_y_m}/2 + {d.bottom_y_m}/2", f"{f3(geo.tributary_width_y_m)} m"),
                row("Tributary area method", f"At = {f3(geo.tributary_width_x_m)} x {f3(geo.tributary_width_y_m)}", f"{f3(geo.tributary_area_m2)} m2"),
            ]))
            sec_list.append(section("5. TYPICAL FLOOR LOAD BUILD-UP", [
                row("EN 1991-1-1 Table 6.2", f"Qk for use = {tf.building_use}", f"{f3(tr['Qk'])} kN/m2"),
                row("EN 1991-1-1", f"Slab self weight = {tf.slab_thickness_m} x {d.concrete_density_kN_per_m3}", f"{f3(tf.slab_self_weight_kN_per_m2(d.concrete_density_kN_per_m3))} kN/m2"),
                row("EN 1991-1-1", "Gk = slab + finishes + services + partitions", f"{f3(tr['Gk'])} kN/m2"),
                row("EN 1990 Eq. 6.10", f"q_uls = {d.gamma_G} x {f3(tr['Gk'])} + {d.gamma_Q} x {f3(tr['Qk'])}", f"{f3(tr['q_uls'])} kN/m2"),
                row("Tributary transfer", f"Slab to column = {f3(tr['q_uls'])} x {f3(geo.tributary_area_m2)}", f"{f3(tr['slab_to_column'])} kN"),
                row("EN 1991-1-1", f"Beam x self wt = {tf.beam_x.width_m} x {tf.beam_x.depth_m} x {d.concrete_density_kN_per_m3}", f"{f3(tr['bx_sw'])} kN/m"),
                row("Wall line load", "thickness x clear height x density", f"{f3(tr['bx_wall'])} kN/m"),
                row("Both x beams, L_left/2 + L_right/2", f"Beam x reaction = {d.gamma_G} x ({f3(tr['bx_sw'])} + {f3(tr['bx_wall'])}) x {f3(tr['span_x'])}", f"{f3(tr['bx_reaction'])} kN"),
                row("EN 1991-1-1", f"Beam y self wt = {tf.beam_y.width_m} x {tf.beam_y.depth_m} x {d.concrete_density_kN_per_m3}", f"{f3(tr['by_sw'])} kN/m"),
                row("Wall line load", "thickness x clear height x density", f"{f3(tr['by_wall'])} kN/m"),
                row("Both y beams, L_top/2 + L_bottom/2", f"Beam y reaction = {d.gamma_G} x ({f3(tr['by_sw'])} + {f3(tr['by_wall'])}) x {f3(tr['span_y'])}", f"{f3(tr['by_reaction'])} kN"),
                row("EN 1991-1-1", "Column self weight = gG x b x h x H x density", f"{f3(tr['column_self_weight'])} kN"),
                row("Load build-up", "Total per typical floor", f"{f3(tr['total_floor_load'])} kN"),
                row("Load build-up", "Total per roof level", f"{f3(rr['total_floor_load'])} kN"),
            ]))
        else:
            sec_list.append(section("4. DESIGN ACTIONS (OVERRIDE)", [
                row("User / frame analysis", f"NEd supplied directly = {f3(float(d.NEd_override_kN))}", f"{f3(float(d.NEd_override_kN))} kN"),
                row("Note", "Tributary take-down bypassed by NEd_override_kN", "override active"),
            ]))

        # 6 ------------------------------------------------------
        sec_list.append(section("6. AXIAL LOAD TAKE-DOWN", [
            row("Cumulative take-down", f"NEd at {lv}", f"{f3(n)} kN") for lv, n in axial.items()
        ] + [
            row("Governing", f"Critical level = {critical_level}", f"{f3(axial[critical_level])} kN")
        ]))

        # 7 ------------------------------------------------------
        rows = []
        for r in levels:
            lv = r["level"]
            for axis, label in (("x", "Mx (depth h)"), ("y", "My (depth b)")):
                a = r[axis]
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.2", f"{lv} {label}: ordered ends |M02| >= |M01|: M01={f3(a['M01'])}, M02={f3(a['M02'])}", f"rm = {f3(a['M01']/a['M02']) if abs(a['M02'])>1e-9 else 'n/a'}"))
                rows.append(row("EN 1992-1-1 Cl. 5.2", f"{lv} {label}: ei = l0/400 = {f3(a['l0_mm'])}/400", f"{f3(a['ei_mm'])} mm"))
                rows.append(row("EN 1992-1-1 Cl. 5.2", f"{lv} {label}: M_imp = NEd x ei = {f3(r['NEd_kN'])} x {f3(a['ei_mm']/1000)}", f"{f3(a['M_imp'])} kNm"))
                rows.append(row("End section", f"{lv} {label}: M_end = |M02| + M_imp = {f3(abs(a['M02']))} + {f3(a['M_imp'])}", f"{f3(a['M_end'])} kNm"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.2", f"{lv} {label}: M0e = max(0.6M02+0.4M01, 0.4M02) = {f3(a['M0e'])}, + M_imp", f"{f3(a['M_eq'])} kNm"))
                e0 = geo.e0_x_mm() if axis == "x" else geo.e0_y_mm()
                depth_sym = "h" if axis == "x" else "b"
                rows.append(row("EN 1992-1-1 Cl. 6.1(4)", f"{lv} e0 = max({depth_sym}/30, 20) = max({f3((geo.h if axis=='x' else geo.b)/30)}, 20)", f"{f3(e0)} mm"))
                rows.append(row("Minimum eccentricity", f"{lv} M_min = NEd x e0 = {f3(r['NEd_kN'])} x {f3(e0/1000)}", f"{f3(a['M_min'])} kNm"))
                rows.append(row("Governing first order", f"{lv} {label}: M_first = max(M_end, M_eq, M_min)", f"{f3(a['M_first'])} kNm"))
        sec_list.append(section("7. FIRST ORDER MOMENTS AND ECCENTRICITY", rows))

        # 8 ------------------------------------------------------
        rows = []
        for r in levels:
            lv = r["level"]
            # Each storey may have its own section and height, so the working
            # must quote THAT storey's values, not the base column's.
            gl = self.geo_for(lv)
            sl_lv = self.slender_for(lv)
            for axis, i_sym in (("x", "ix"), ("y", "iy")):
                a = r[axis]
                i_val = gl.ix if axis == "x" else gl.iy
                src = a["l0_source"]
                if src == "override":
                    calc = f"{lv} l0,{axis} supplied directly"
                elif src == "k-factors":
                    k1 = d.k1_x if axis == "x" else d.k1_y
                    k2 = d.k2_x if axis == "x" else d.k2_y
                    eq = "5.15 (braced)" if d.braced else "5.16 (unbraced)"
                    calc = (f"{lv} l0,{axis} by Eq. {eq} with l = {f3(sl_lv.clear_height_mm)} mm, "
                            f"k1 = {f3(max(float(k1), 0.1))}, k2 = {f3(max(float(k2), 0.1))}")
                else:
                    calc = (f"{lv} l0,{axis} = K x l = {f3(sl_lv.K)} x "
                            f"{sl_lv.clear_height_mm:,.0f}")
                rows.append(row("EN 1992-1-1 Cl. 5.8.3.2", calc, f"{f3(a['l0_mm'])} mm"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.3.2", f"{lv} lambda_{axis} = l0 / {i_sym} = {f3(a['l0_mm'])} / {f3(i_val)}", f"{f3(a['lambda'])}"))
                if d.use_default_A_B:
                    rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", "A = 0.7 (code default, phi_ef taken as not known)", f"{f3(sl_lv.factor_A())}"))
                    rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", "B = 1.1 (code default, omega taken as not known)", f"{f3(sl_lv.factor_B())}"))
                else:
                    rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", f"A = 1/(1+0.2*phi_ef) = 1/(1+0.2x{d.effective_creep_ratio})", f"{f3(sl_lv.factor_A())}"))
                    rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", "B = sqrt(1+2*omega), computed from the provided steel", f"{f3(sl_lv.factor_B())}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", "C = 1.7 - rm (0.7 if unknown/unbraced)", f"{f3(sl_lv.factor_C(a['M01'], a['M02']))}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", f"{lv} n = NEd/(Ac*fcd) = {f3(r['NEd_kN']*1000)}/({f1(gl.Ac)} x {f3(mat.fcd)})", f"{f3(sl_lv.n_relative(r['NEd_kN']))}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", f"{lv} lambda_lim = 20*A*B*C/sqrt(n)", f"{f3(a['lambda_lim'])}"))
                rows.append(row("Classification", f"{lv} lambda_{axis} {'>' if a['slender'] else '<='} lambda_lim", "SLENDER" if a["slender"] else "SHORT"))
        sec_list.append(section("8. SLENDERNESS — BOTH AXES", rows))

        # 9 ------------------------------------------------------
        rows = []
        any_slender = False
        for r in levels:
            lv = r["level"]
            for axis in ("x", "y"):
                a = r[axis]
                if not a["slender"]:
                    continue
                any_slender = True
                so = a["second_order"]
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.3", f"{lv} {axis}: omega = As*fyd/(Ac*fcd)", f"{f3(so['omega'])}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.3", f"{lv} {axis}: Kr = (nu-n)/(nu-nbal) = ({f3(so['n_u'])}-{f3(so['n'])})/({f3(so['n_u'])}-0.4)", f"{f3(so['Kr'])}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.3", f"{lv} {axis}: beta = 0.35 + fck/200 - lambda/150", f"{f3(so['beta'])}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.3", f"{lv} {axis}: Kphi = 1 + beta*phi_ef", f"{f3(so['Kphi'])}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.3", f"{lv} {axis}: 1/r0 = eps_yd/(0.45d) = {mat.eps_yd:.5f}/(0.45 x {f3(so['d_eff'])})", f"{so['inv_r0']:.3e} /mm"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.2", f"{lv} {axis}: e2 = (1/r)*l0^2/c, c = 10", f"{f3(so['e2_mm'])} mm"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.8.2", f"{lv} {axis}: M2 = NEd x e2", f"{f3(so['M2_kNm'])} kNm"))
                rows.append(row("Design moment", f"{lv} {axis}: MEd = max(M_end, M_eq + M2, M_min) = max({f3(a['M_end'])}, {f3(a['M_eq'])}+{f3(a['M2'])}, {f3(a['M_min'])})", f"{f3(a['MEd'])} kNm"))
        if not any_slender:
            rows.append(row("EN 1992-1-1 Cl. 5.8.3.1", "All levels short about both axes — second order effects may be ignored", "M2 = 0"))
        sec_list.append(section("9. SECOND ORDER EFFECTS (NOMINAL CURVATURE)", rows))

        # 10 -----------------------------------------------------
        crit = next(r for r in levels if r["level"] == critical_level)
        sec_list.append(section("10. SECTION CAPACITY BY STRAIN COMPATIBILITY", [
            row("Method", "Rectangular stress block, bilinear steel, layered bars", "strain compatibility"),
            row("EN 1992-1-1 Cl. 3.1.7", f"Block: eta*fcd = {f3(mat.eta_block)} x {f3(mat.fcd)} over depth {f3(mat.lambda_block)}x", f"{f3(mat.eta_block*mat.fcd)} MPa"),
            row("Pure compression pivot", f"Uniform strain eps_c3 = {mat.eps_c3:.5f}, so sigma_s = Es*eps_c3 = {f3(min(Es_MPA*mat.eps_c3, mat.fyd))}", f"{f3(min(Es_MPA*mat.eps_c3, mat.fyd))} MPa"),
            row("Axial resistance (governing)", "NRd,max = eta*fcd*(Ac - As) + As*sigma_s", f"{f3(crit['NRd_max_kN'])} kN"),
            row("Textbook form, for comparison", f"NRd = Ac*fcd + As*fyd = {f1(geo.Ac)} x {f3(mat.fcd)} + {f1(geo.As_total)} x {f3(mat.fyd)}", f"{f3(crit['NRd_simplified_kN'])} kN"),
            row("Difference explained", f"(a) concrete displaced by bars not deducted: As*eta*fcd = {f3(geo.As_total*mat.eta_block*mat.fcd/1000)} kN; (b) steel assumed at fyd though eps_c3 caps it at {f3(min(Es_MPA*mat.eps_c3, mat.fyd))} MPa: As*(fyd - sigma_s) = {f3(geo.As_total*(mat.fyd - min(Es_MPA*mat.eps_c3, mat.fyd))/1000)} kN", f"{f3(crit['NRd_simplified_kN'] - crit['NRd_max_kN'])} kN"),
            row("Design check", f"NEd = {f3(crit['NEd_kN'])} vs NRd,max = {f3(crit['NRd_max_kN'])}", "PASS" if crit["axial_utilisation"] <= 1 else "FAIL"),
            row("Interaction", f"MRd,x at NEd = {f3(crit['NEd_kN'])} kN", f"{f3(crit['x']['MRd'])} kNm"),
            row("Interaction", f"MRd,y at NEd = {f3(crit['NEd_kN'])} kN", f"{f3(crit['y']['MRd'])} kNm"),
        ]))

        # 11 -----------------------------------------------------
        rows = []
        for r in levels:
            lv = r["level"]
            if self.ctype == "biaxial":
                bi = r["biaxial"]
                rows.append(row("EN 1992-1-1 Cl. 5.8.9(4)", f"{lv}: NEd/NRd = {f3(bi['N_ratio'])} -> a = {f3(bi['a'])}", f"a = {f3(bi['a'])}"))
                rows.append(row("EN 1992-1-1 Cl. 5.8.9(4)", f"{lv}: (MEdx/MRdx)^a + (MEdy/MRdy)^a = ({f3(r['x']['MEd'])}/{f3(r['x']['MRd'])})^{f3(bi['a'])} + ({f3(r['y']['MEd'])}/{f3(r['y']['MRd'])})^{f3(bi['a'])}", f"{f3(bi['interaction'])}"))
                rows.append(row("Design check", f"{lv}: interaction <= 1.0 ?", "PASS" if bi["interaction"] <= 1.0 else "FAIL"))
            elif self.ctype == "uniaxial":
                bend = self.uni_axis
                other = "y" if bend == "x" else "x"
                rows.append(row(f"Uniaxial check, bending about {bend}", f"{lv}: MEd{bend}/MRd{bend} = {f3(r[bend]['MEd'])}/{f3(r[bend]['MRd'])}", f"{f3(r[bend]['utilisation'])}"))
                rows.append(row(f"Other axis {other}, min ecc + 2nd order", f"{lv}: MEd{other}/MRd{other} = {f3(r[other]['MEd'])}/{f3(r[other]['MRd'])}", f"{f3(r[other]['utilisation'])}"))
                rows.append(row("Design check", f"{lv}: both <= 1.0 ?", "PASS" if max(r['x']['utilisation'], r['y']['utilisation']) <= 1.0 else "FAIL"))
            else:
                rows.append(row("Axial + min ecc", f"{lv}: MEdx/MRdx = {f3(r['x']['MEd'])}/{f3(r['x']['MRd'])}", f"{f3(r['x']['utilisation'])}"))
                rows.append(row("Axial + min ecc", f"{lv}: MEdy/MRdy = {f3(r['y']['MEd'])}/{f3(r['y']['MRd'])}", f"{f3(r['y']['utilisation'])}"))
                rows.append(row("Design check", f"{lv}: both <= 1.0 ?", "PASS" if max(r['x']['utilisation'], r['y']['utilisation']) <= 1.0 else "FAIL"))
        sec_list.append(section("11. INTERACTION CHECK", rows))

        # 12 -----------------------------------------------------
        gcrit = self.geo_for(critical_level)
        As_max = As_max_mm2(gcrit.Ac)
        rows = [
            row("EN 1992-1-1 Cl. 9.5.2(2)", f"Basis 1 — axial: 0.10*NEd/fyd = 0.10 x {f3(crit['NEd_kN']*1000)} / {f3(mat.fyd)}", f"{f1(crit['As_min_basis_1'])} mm2"),
            row("EN 1992-1-1 Cl. 9.5.2(2)", f"Basis 2 — 0.2% of section: 0.002 x {f1(gcrit.Ac)}", f"{f1(crit['As_min_basis_2'])} mm2"),
            row("EN 1992-1-1 Cl. 9.5.2(2)", "As,min = max(Basis 1, Basis 2)", f"{f1(crit['As_min'])} mm2"),
            row("EN 1992-1-1 Cl. 9.5.2(3)", f"As,max = 0.04 x {f1(gcrit.Ac)}", f"{f1(As_max)} mm2"),
            row("Provided", f"As = {gcrit.n_bars} x Y{int(gcrit.bar_dia)} ({critical_level})", f"{f1(gcrit.As_total)} mm2"),
            row("Design check", "As,min <= As <= As,max ?", "PASS" if crit['As_min'] <= gcrit.As_total <= As_max else "FAIL"),
        ]
        sec_list.append(section("12. LONGITUDINAL REINFORCEMENT LIMITS", rows))

        # 13 -----------------------------------------------------
        phi_t_min = min_tie_diameter_mm(gcrit.bar_dia)
        s_max = max_tie_spacing_mm(gcrit.bar_dia, gcrit.b, gcrit.h)
        s_red = reduced_tie_spacing_mm(s_max)
        sec_list.append(section("13. TRANSVERSE REINFORCEMENT (TIES)", [
            row("EN 1992-1-1 Cl. 9.5.3(1)", f"phi_t,min = max(6, phi_long/4) = max(6, {f1(geo.bar_dia)}/4)", f"{f3(phi_t_min)} mm"),
            row("Provided", f"phi_t = {f1(geo.link_dia)}", f"Y{int(geo.link_dia)}"),
            row("Design check", "phi_t >= phi_t,min ?", "PASS" if geo.link_dia >= phi_t_min else "FAIL"),
            row("EN 1992-1-1 Cl. 9.5.3(3)", f"s_cl,tmax = min(20 x {f1(geo.bar_dia)}, min({f1(geo.b)}, {f1(geo.h)}), 400)", f"{f1(s_max)} mm"),
            row("EN 1992-1-1 Cl. 9.5.3(4)", f"Reduced zones (near beams/slabs, laps) = 0.6 x {f1(s_max)}", f"{f1(s_red)} mm"),
        ]))

        # 14 -----------------------------------------------------
        failed = []
        for r in levels:
            for c in r["checks"]:
                if not c["pass"]:
                    failed.append(f"{c['name']} — {r['level']}")
        rows = [
            row("Governing", f"Critical level = {critical_level}", f"NEd = {f3(crit['NEd_kN'])} kN"),
            row("Axial", "NEd / NRd,max", f"{f3(crit['axial_utilisation'])}"),
            row("Bending", "Governing utilisation", f"{f3(crit['governing_utilisation'])}"),
            row("Reinforcement", f"Provided {geo.n_bars}Y{int(geo.bar_dia)} with Y{int(geo.link_dia)} ties", f"{f1(geo.As_total)} mm2"),
            row("Detailing", f"Ties Y{int(geo.link_dia)} at {f1(s_red)} mm in end/lap zones, {f1(s_max)} mm elsewhere", "adopted"),
        ]
        if failed:
            rows.append(row("FAILED CHECKS", "; ".join(failed), "FAIL"))
        else:
            rows.append(row("Overall", "All checks satisfied", "PASS"))
        sec_list.append(section("14. SUMMARY", rows))

        return sec_list


def design_column(d: ColumnInput) -> Dict:
    return ColumnEngine(d).run()