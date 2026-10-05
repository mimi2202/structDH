# backend/engine/two_way_slab_engine.py
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple
import math


class DesignCode(Enum):
    EUROCODE_2 = "EC2"


class SupportCondition(Enum):
    SSSS_2W = "SSSS_2W"
    TWO_WAY_BEAM_SUPPORTED = "TWO_WAY_BEAM_SUPPORTED"


class PanelType(Enum):
    TWO_WAY = "TWO_WAY"


class EdgeCondition(Enum):
    INTERIOR_PANEL = "INTERIOR_PANEL"
    ONE_SHORT_EDGE_DISCONTINUOUS = "ONE_SHORT_EDGE_DISCONTINUOUS"
    ONE_LONG_EDGE_DISCONTINUOUS = "ONE_LONG_EDGE_DISCONTINUOUS"
    TWO_ADJACENT_EDGES_DISCONTINUOUS = "TWO_ADJACENT_EDGES_DISCONTINUOUS"
    TWO_SHORT_EDGES_DISCONTINUOUS = "TWO_SHORT_EDGES_DISCONTINUOUS"
    TWO_LONG_EDGES_DISCONTINUOUS = "TWO_LONG_EDGES_DISCONTINUOUS"
    THREE_EDGES_ONE_LONG_CONTINUOUS = "THREE_EDGES_ONE_LONG_CONTINUOUS"
    THREE_EDGES_ONE_SHORT_CONTINUOUS = "THREE_EDGES_ONE_SHORT_CONTINUOUS"
    FOUR_EDGES_DISCONTINUOUS = "FOUR_EDGES_DISCONTINUOUS"


class TwoWayMomentMethod(Enum):
    ELASTIC_PLATE_FE = "ELASTIC_PLATE_FE"
    COEFFICIENT_TABLE = "COEFFICIENT_TABLE"


class PartitionMode(Enum):
    PERMANENT_GK = "PERMANENT_GK"
    VARIABLE_QK = "VARIABLE_QK"


class OccupancyCategory(Enum):
    RESIDENTIAL_HOTEL = "RESIDENTIAL_HOTEL"
    OFFICE_EDUCATION = "OFFICE_EDUCATION"
    HEALTHCARE_RETAIL = "HEALTHCARE_RETAIL"


CONCRETE_GRADES = {
    "C12/15": 12, "C16/20": 16, "C20/25": 20, "C25/30": 25, "C30/37": 30,
    "C35/45": 35, "C40/50": 40, "C45/55": 45, "C50/60": 50, "C55/67": 55,
    "C60/75": 60, "C70/85": 70, "C80/95": 80, "C90/105": 90,
}

STEEL_GRADES = {"B500": 500.0, "B460": 460.0}

BUILDING_USE_LIVE_LOADS = {
    "residential": 2.0, "hotel": 2.0, "office": 3.0, "school_classroom": 3.0,
    "education": 3.0, "corridor": 4.0, "stairs": 4.0, "retail": 4.0,
    "shopping_mall": 5.0, "hospital_ward": 3.0, "hospital_operating_room": 4.0,
    "healthcare": 4.0, "roof_access": 1.5, "roof_no_access": 0.75,
    "balcony": 3.0, "plant_room": 5.0,
}

EXPOSURE_MIN_DUR_MM = {"XC1": 20.0, "XC2": 25.0, "XC3": 30.0, "XC4": 35.0}

# Bending moment coefficients (Eurocode/Concrete-Centre Table) for rectangular
# panels supported on four sides.
bending_moment_coeffs = {
    "interior_panel": {
        "negative": {"short": {1.0: 0.031, 1.1: 0.037, 1.2: 0.042, 1.3: 0.046, 1.4: 0.050, 1.5: 0.053, 1.75: 0.059, 2.0: 0.063},
                     "long": 0.032},
        "positive": {"short": {1.0: 0.024, 1.1: 0.028, 1.2: 0.032, 1.3: 0.035, 1.4: 0.037, 1.5: 0.040, 1.75: 0.044, 2.0: 0.048},
                     "long": 0.024}
    },
    "one_short_edge_discontinuous": {
        "negative": {"short": {1.0: 0.039, 1.1: 0.044, 1.2: 0.048, 1.3: 0.052, 1.4: 0.055, 1.5: 0.058, 1.75: 0.063, 2.0: 0.067},
                     "long": 0.037},
        "positive": {"short": {1.0: 0.029, 1.1: 0.033, 1.2: 0.036, 1.3: 0.039, 1.4: 0.041, 1.5: 0.043, 1.75: 0.047, 2.0: 0.050},
                     "long": 0.028}
    },
    "one_long_edge_discontinuous": {
        "negative": {"short": {1.0: 0.039, 1.1: 0.049, 1.2: 0.056, 1.3: 0.062, 1.4: 0.068, 1.5: 0.073, 1.75: 0.082, 2.0: 0.089},
                     "long": 0.037},
        "positive": {"short": {1.0: 0.030, 1.1: 0.036, 1.2: 0.042, 1.3: 0.047, 1.4: 0.051, 1.5: 0.055, 1.75: 0.062, 2.0: 0.067},
                     "long": 0.028}
    },
    "two_adjacent_edges_discontinuous": {
        "negative": {"short": {1.0: 0.047, 1.1: 0.056, 1.2: 0.063, 1.3: 0.069, 1.4: 0.074, 1.5: 0.078, 1.75: 0.087, 2.0: 0.093},
                     "long": 0.045},
        "positive": {"short": {1.0: 0.036, 1.1: 0.042, 1.2: 0.047, 1.3: 0.051, 1.4: 0.055, 1.5: 0.059, 1.75: 0.065, 2.0: 0.070},
                     "long": 0.034}
    },
    "two_short_edges_discontinuous": {
        "negative": {"short": {1.0: 0.046, 1.1: 0.050, 1.2: 0.054, 1.3: 0.057, 1.4: 0.060, 1.5: 0.062, 1.75: 0.067, 2.0: 0.070},
                     "long": None},
        "positive": {"short": {1.0: 0.034, 1.1: 0.038, 1.2: 0.040, 1.3: 0.043, 1.4: 0.045, 1.5: 0.047, 1.75: 0.050, 2.0: 0.053},
                     "long": 0.034}
    },
    "two_long_edges_discontinuous": {
        "negative": {"short": None, "long": 0.045},
        "positive": {"short": {1.0: 0.034, 1.1: 0.046, 1.2: 0.056, 1.3: 0.065, 1.4: 0.072, 1.5: 0.078, 1.75: 0.091, 2.0: 0.100},
                     "long": 0.034}
    },
    "three_edges_one_long_continuous": {
        # One LONG edge remains continuous; the other long edge and both short
        # edges are discontinuous. Hogging only develops at the continuous
        # long edge -- table gives it as the short-span (x) negative row.
        "negative": {"short": {1.0: 0.057, 1.1: 0.065, 1.2: 0.071, 1.3: 0.076, 1.4: 0.081, 1.5: 0.084, 1.75: 0.092, 2.0: 0.098},
                     "long": None},
        "positive": {"short": {1.0: 0.043, 1.1: 0.048, 1.2: 0.053, 1.3: 0.057, 1.4: 0.060, 1.5: 0.063, 1.75: 0.069, 2.0: 0.074},
                     "long": 0.044}
    },
    "three_edges_one_short_continuous": {
        # One SHORT edge remains continuous; the other short edge and both
        # long edges are discontinuous. Hogging only develops at the
        # continuous short edge -- table gives it as the long-span (y) row.
        "negative": {"short": None, "long": 0.058},
        "positive": {"short": {1.0: 0.042, 1.1: 0.054, 1.2: 0.063, 1.3: 0.071, 1.4: 0.078, 1.5: 0.084, 1.75: 0.096, 2.0: 0.105},
                     "long": 0.044}
    },
    "four_edges_discontinuous": {
        # No continuous edge anywhere -- this is the coefficient-table
        # equivalent of a true SSSS panel: zero hogging in both directions,
        # positive (sagging) moment only.
        "negative": {"short": None, "long": None},
        "positive": {"short": {1.0: 0.055, 1.1: 0.065, 1.2: 0.074, 1.3: 0.081, 1.4: 0.087, 1.5: 0.092, 1.75: 0.103, 2.0: 0.111},
                     "long": 0.056}
    },
}

AUTO_PRESETS = {
    OccupancyCategory.RESIDENTIAL_HOTEL: [
        (4.0, 150, 10, 200, "OK"), (5.0, 150, 10, 175, "OK"), (6.0, 175, 12, 175, "OK"),
        (7.0, 200, 12, 150, "OK"), (float("inf"), 200, 12, 150, "FLAG_SOLID_SLAB_NOT_PREFERRED"),
    ],
    OccupancyCategory.OFFICE_EDUCATION: [
        (4.0, 150, 10, 175, "OK"), (5.0, 175, 12, 200, "OK"), (6.0, 200, 12, 175, "OK"),
        (7.0, 225, 12, 150, "OK"), (float("inf"), 225, 12, 150, "FLAG_REVIEW_FLAT_SLAB_OR_BEAM_AND_SLAB"),
    ],
    OccupancyCategory.HEALTHCARE_RETAIL: [
        (4.0, 150, 12, 200, "OK"), (5.0, 175, 12, 175, "OK"), (6.0, 200, 12, 150, "OK"),
        (7.0, 225, 16, 175, "OK"), (float("inf"), 225, 16, 175, "FLAG_SOLID_SLAB_LIKELY_INEFFICIENT"),
    ],
}


# ------------------------------------------------------------
# CONTINUOUS_COEFFICIENT_TABLE — built from bending_moment_coeffs.
# Shape expected by interpolate_continuous_coeffs():
#   { EdgeCondition: { r_nodes:[...], alpha_x_neg:[...], alpha_x_pos:[...],
#                      alpha_y_neg:[...], alpha_y_pos:[...] } }
# Short-span (x) varies with aspect ratio; long-span (y) is constant per the
# table, so it is broadcast to every node. A None short-span entry (e.g.
# x_neg for two_long_edges_discontinuous, where no short edge is continuous)
# becomes zero at every node rather than the whole panel type being dropped.
# ------------------------------------------------------------
_EDGE_KEYMAP = {
    EdgeCondition.INTERIOR_PANEL: "interior_panel",
    EdgeCondition.ONE_SHORT_EDGE_DISCONTINUOUS: "one_short_edge_discontinuous",
    EdgeCondition.ONE_LONG_EDGE_DISCONTINUOUS: "one_long_edge_discontinuous",
    EdgeCondition.TWO_ADJACENT_EDGES_DISCONTINUOUS: "two_adjacent_edges_discontinuous",
    EdgeCondition.TWO_SHORT_EDGES_DISCONTINUOUS: "two_short_edges_discontinuous",
    EdgeCondition.TWO_LONG_EDGES_DISCONTINUOUS: "two_long_edges_discontinuous",
    EdgeCondition.THREE_EDGES_ONE_LONG_CONTINUOUS: "three_edges_one_long_continuous",
    EdgeCondition.THREE_EDGES_ONE_SHORT_CONTINUOUS: "three_edges_one_short_continuous",
    EdgeCondition.FOUR_EDGES_DISCONTINUOUS: "four_edges_discontinuous",
}


def _build_continuous_table() -> Dict[EdgeCondition, Dict[str, list]]:
    table: Dict[EdgeCondition, Dict[str, list]] = {}
    for ec, key in _EDGE_KEYMAP.items():
        src = bending_moment_coeffs.get(key)
        if not src:
            continue
        xneg = src["negative"]["short"]
        xpos = src["positive"]["short"]
        yneg = src["negative"]["long"]
        ypos = src["positive"]["long"]
        # The r-node list comes from whichever short-span table is actually
        # populated. x_pos is always present in this table; x_neg is None
        # whenever no short edge is continuous (e.g. two_long_edges_discontinuous,
        # four_edges_discontinuous), in which case x_neg is simply zero at
        # every node rather than the whole panel type being unusable.
        nodes_source = xneg if xneg is not None else xpos
        if nodes_source is None:
            continue  # defensive only -- every real entry has at least x_pos
        nodes = sorted(nodes_source.keys())
        table[ec] = {
            "r_nodes": nodes,
            "alpha_x_neg": [(xneg[r] if xneg is not None else 0.0) for r in nodes],
            "alpha_x_pos": [(xpos[r] if xpos is not None else 0.0) for r in nodes],
            "alpha_y_neg": [(yneg if yneg is not None else 0.0)] * len(nodes),
            "alpha_y_pos": [(ypos if ypos is not None else 0.0)] * len(nodes),
        }
    return table


CONTINUOUS_COEFFICIENT_TABLE = _build_continuous_table()


def get_fck(grade: str) -> float:
    if grade not in CONCRETE_GRADES:
        raise ValueError(f"Unsupported concrete grade: {grade}")
    return float(CONCRETE_GRADES[grade])


def get_fyk(grade: str) -> float:
    if grade not in STEEL_GRADES:
        raise ValueError(f"Unsupported steel grade: {grade}")
    return STEEL_GRADES[grade]


def live_load_for_use(building_use: str) -> float:
    key = building_use.strip().lower()
    if key not in BUILDING_USE_LIVE_LOADS:
        raise ValueError(f"Unsupported building use: {building_use}")
    return BUILDING_USE_LIVE_LOADS[key]


def get_code_parameters(code: DesignCode) -> Dict[str, float]:
    if code == DesignCode.EUROCODE_2:
        return {"gamma_G": 1.35, "gamma_Q": 1.50, "gamma_c": 1.50, "gamma_s": 1.15, "alpha_cc": 0.85}
    raise ValueError("Unsupported design code.")


def bar_area_mm2(d_mm: float) -> float:
    return math.pi * d_mm ** 2 / 4.0


def interpolate_linear(x: float, xs: List[float], ys: List[float]) -> float:
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i])
    return ys[-1]


def fctm_ec2(fck: float) -> float:
    if fck <= 50.0:
        return 0.30 * fck ** (2.0 / 3.0)
    return 2.12 * math.log(1.0 + (fck + 8.0) / 10.0)


def classify_occupancy(building_use: str) -> OccupancyCategory:
    key = building_use.strip().lower()
    if key in {"residential", "hotel"}:
        return OccupancyCategory.RESIDENTIAL_HOTEL
    if key in {"office", "school_classroom", "education"}:
        return OccupancyCategory.OFFICE_EDUCATION
    if key in {"healthcare", "hospital_ward", "hospital_operating_room", "retail", "shopping_mall"}:
        return OccupancyCategory.HEALTHCARE_RETAIL
    return OccupancyCategory.OFFICE_EDUCATION


@dataclass
class Material:
    design_code: DesignCode = DesignCode.EUROCODE_2
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"

    @property
    def code_params(self) -> Dict[str, float]:
        return get_code_parameters(self.design_code)

    @property
    def fck(self) -> float:
        return get_fck(self.concrete_grade)

    @property
    def fyk(self) -> float:
        return get_fyk(self.steel_grade)

    @property
    def gamma_G(self) -> float:
        return self.code_params["gamma_G"]

    @property
    def gamma_Q(self) -> float:
        return self.code_params["gamma_Q"]

    @property
    def gamma_c(self) -> float:
        return self.code_params["gamma_c"]

    @property
    def gamma_s(self) -> float:
        return self.code_params["gamma_s"]

    @property
    def alpha_cc(self) -> float:
        return self.code_params["alpha_cc"]

    @property
    def fcd(self) -> float:
        return self.alpha_cc * self.fck / self.gamma_c

    @property
    def fyd(self) -> float:
        return self.fyk / self.gamma_s

    @property
    def fctm(self) -> float:
        return fctm_ec2(self.fck)

    @property
    def Ecm_MPa(self) -> float:
        return 22000.0 * ((self.fck + 8.0) / 10.0) ** 0.3


@dataclass
class AutoPresetResult:
    occupancy_category: OccupancyCategory
    governing_span_m: float
    thickness_mm: int
    main_bar_dia_mm: int
    main_bar_spacing_mm: int
    preset_status: str


@dataclass
class BarArrangement:
    bar_dia_mm: int
    spacing_mm: int
    As_provided_mm2_per_m: float


@dataclass
class TwoWaySlabInput:
    lx_m: float
    ly_m: float
    support_condition: SupportCondition
    panel_type: PanelType
    edge_condition: Optional[EdgeCondition] = None
    alpha_x: Optional[float] = None
    alpha_y: Optional[float] = None
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"
    building_use: str = "office"
    partition_mode: PartitionMode = PartitionMode.PERMANENT_GK
    exposure_class: str = "XC1"
    thickness_mm: Optional[int] = None
    cover_mm: Optional[float] = None
    delta_c_dev_mm: float = 5.0
    gk_finish_kN_m2: Optional[float] = None
    gk_partition_kN_m2: Optional[float] = None
    qk_imposed_kN_m2: Optional[float] = None
    gk_self_kN_m2: Optional[float] = None
    gk_services_kN_m2: Optional[float] = None
    main_bar_diameter_mm: Optional[int] = None
    candidate_bar_diameters_mm: Optional[List[int]] = None
    candidate_spacing_mm: Optional[List[int]] = None
    two_way_moment_method: Optional[TwoWayMomentMethod] = None


@dataclass
class TwoWaySlabResult:
    preset_used: Optional[AutoPresetResult] = None
    thickness_mm: int = 0
    cover_mm: float = 0.0
    c_min_b_mm: float = 0.0
    c_min_dur_mm: float = 0.0
    delta_c_dur_gamma_mm: float = 0.0
    delta_c_dur_st_mm: float = 0.0
    delta_c_dur_add_mm: float = 0.0
    c_min_mm: float = 0.0
    delta_c_dev_mm: float = 0.0
    aspect_ratio_r: float = 0.0
    d_mm: float = 0.0
    z_mm: float = 0.0
    gk_self_kN_m2: float = 0.0
    gk_finish_kN_m2: float = 0.0
    gk_partition_kN_m2: float = 0.0
    gk_services_kN_m2: float = 0.0
    qk_imposed_kN_m2: float = 0.0
    Gk_total: float = 0.0
    Qk_total: float = 0.0
    wEd_area_kN_m2: float = 0.0
    analysis_method_used: str = ""
    coefficients_used: Dict[str, float] = field(default_factory=dict)
    MEd_x_neg_kN_m_per_m: float = 0.0
    MEd_x_pos_kN_m_per_m: float = 0.0
    MEd_y_neg_kN_m_per_m: float = 0.0
    MEd_y_pos_kN_m_per_m: float = 0.0
    alpha_x_neg: Optional[float] = None
    alpha_x_pos: Optional[float] = None
    alpha_y_neg: Optional[float] = None
    alpha_y_pos: Optional[float] = None
    As_req_x_neg: float = 0.0
    As_req_x_pos: float = 0.0
    As_req_y_neg: float = 0.0
    As_req_y_pos: float = 0.0
    As_req_x_main: float = 0.0
    As_req_y_main: float = 0.0
    As_min_1: float = 0.0
    As_min_2: float = 0.0
    As_min: float = 0.0
    As_target_x: float = 0.0
    As_target_y: float = 0.0
    main_x: Optional[BarArrangement] = None
    main_y: Optional[BarArrangement] = None
    dist_x: Optional[BarArrangement] = None
    dist_y: Optional[BarArrangement] = None
    dist_target_x: float = 0.0
    dist_target_y: float = 0.0
    dist_minimum: float = 0.0
    K_deflection: float = 0.0
    l_over_d_actual: float = 0.0
    rho: float = 0.0
    rho_0: float = 0.0
    l_over_d_lim_branch_A: float = 0.0
    l_over_d_lim_branch_B: float = 0.0
    l_over_d_lim_basic: float = 0.0
    F3: float = 0.0
    l_over_d_lim_final: float = 0.0
    bending_status_x: str = ""
    bending_status_y: str = ""
    min_steel_status_x: str = ""
    min_steel_status_y: str = ""
    deflection_status: str = ""
    deflection_base_status: str = ""
    deflection_enhanced: bool = False
    shear_status: str = ""
    overall_status: str = ""
    notes: List[str] = field(default_factory=list)


class TwoWaySlabDesigner:
    def __init__(self, slab_input: TwoWaySlabInput):
        self.input = slab_input
        self.material = Material(concrete_grade=slab_input.concrete_grade, steel_grade=slab_input.steel_grade)
        self.validate_input()

    def validate_input(self) -> None:
        if self.input.lx_m <= 0 or self.input.ly_m <= 0:
            raise ValueError("lx_m and ly_m must be greater than zero.")
        if self.input.ly_m < self.input.lx_m:
            raise ValueError("Use lx_m as short span and ly_m as long span.")
        if self.input.panel_type != PanelType.TWO_WAY:
            raise ValueError("Only TWO_WAY panel type is supported.")
        if self.input.support_condition == SupportCondition.TWO_WAY_BEAM_SUPPORTED and self.input.edge_condition is None:
            raise ValueError("edge_condition is required for TWO_WAY_BEAM_SUPPORTED.")

    def auto_method(self) -> TwoWayMomentMethod:
        if self.input.support_condition == SupportCondition.SSSS_2W:
            return TwoWayMomentMethod.ELASTIC_PLATE_FE
        return TwoWayMomentMethod.COEFFICIENT_TABLE

    def auto_preset(self) -> AutoPresetResult:
        category = classify_occupancy(self.input.building_use)
        span = self.input.lx_m
        for span_limit, thickness, dia, spacing, status in AUTO_PRESETS[category]:
            if span <= span_limit:
                return AutoPresetResult(category, span, thickness, dia, spacing, status)
        raise RuntimeError("Failed to select auto preset.")

    def auto_candidate_bar_diameters(self) -> List[int]:
        return [8, 10, 12, 16]

    def auto_candidate_spacing(self) -> List[int]:
        return list(range(100, 301, 25))

    def auto_finish_load(self) -> float:
        use = self.input.building_use.lower()
        if use in ("office", "retail", "shopping_mall", "corridor", "stairs", "education", "school_classroom"):
            return 1.0
        if use in ("roof_no_access", "roof_access"):
            return 0.75
        return 1.0

    def auto_partition_load(self) -> float:
        use = self.input.building_use.lower()
        if use in ("office", "residential", "school_classroom", "education", "hotel"):
            return 1.0
        if use in ("roof_no_access", "roof_access"):
            return 0.0
        return 0.5

    def auto_services_load(self) -> float:
        use = self.input.building_use.lower()
        if use in ("roof_no_access", "roof_access"):
            return 0.25
        return 0.5

    def cover_breakdown(self, bar_dia_mm: float) -> Dict[str, float]:
        c_min_b = max(bar_dia_mm, 20.0)
        c_min_dur = EXPOSURE_MIN_DUR_MM.get(self.input.exposure_class, 20.0)
        delta_c_dur_gamma = 0.0
        delta_c_dur_st = 0.0
        delta_c_dur_add = 0.0
        c_min = max(c_min_b, c_min_dur + delta_c_dur_gamma - delta_c_dur_st - delta_c_dur_add, 10.0)
        c_nom = c_min + self.input.delta_c_dev_mm
        return {
            "c_min_b_mm": c_min_b, "c_min_dur_mm": c_min_dur,
            "delta_c_dur_gamma_mm": delta_c_dur_gamma, "delta_c_dur_st_mm": delta_c_dur_st,
            "delta_c_dur_add_mm": delta_c_dur_add, "c_min_mm": c_min, "c_nom_mm": c_nom,
        }

    def interpolate_continuous_coeffs(self, r: float, edge_condition: EdgeCondition) -> Dict[str, float]:
        table = CONTINUOUS_COEFFICIENT_TABLE[edge_condition]
        nodes = table["r_nodes"]
        return {
            "alpha_x_neg": interpolate_linear(r, nodes, table["alpha_x_neg"]),
            "alpha_x_pos": interpolate_linear(r, nodes, table["alpha_x_pos"]),
            "alpha_y_neg": interpolate_linear(r, nodes, table["alpha_y_neg"]),
            "alpha_y_pos": interpolate_linear(r, nodes, table["alpha_y_pos"]),
        }

    def ssss_plate_series_moments(self, wEd_kN_m2: float, lx_m: float, ly_m: float, terms: int = 9) -> Tuple[float, float]:
        a = lx_m
        b = ly_m
        q = wEd_kN_m2
        nu = 0.2
        x = a / 2.0
        y = b / 2.0
        mx = 0.0
        my = 0.0
        for m in range(1, terms + 1, 2):
            for n in range(1, terms + 1, 2):
                denom = m * n * ((m / a) ** 2 + (n / b) ** 2) ** 2
                Wmn = 16.0 * q / (math.pi ** 6 * denom)
                s = math.sin(m * math.pi * x / a) * math.sin(n * math.pi * y / b)
                d2w_dx2 = -(m * math.pi / a) ** 2 * Wmn * s
                d2w_dy2 = -(n * math.pi / b) ** 2 * Wmn * s
                mx += -(d2w_dx2 + nu * d2w_dy2)
                my += -(d2w_dy2 + nu * d2w_dx2)
        return mx, my

    def reinforcement_required_mm2_per_m(self, MEd_kN_m_per_m: float, z_mm: float) -> float:
        return (MEd_kN_m_per_m * 1e6) / (self.material.fyd * z_mm)

    def minimum_steel_parts_mm2_per_m(self, d_mm: float) -> Tuple[float, float, float]:
        b = 1000.0
        expr1 = 0.26 * self.material.fctm / self.material.fyk * b * d_mm
        expr2 = 0.0013 * b * d_mm
        return expr1, expr2, max(expr1, expr2)

    def arrangement_from_bar_and_spacing(self, dia: int, spacing: int) -> BarArrangement:
        return BarArrangement(dia, spacing, bar_area_mm2(dia) * 1000.0 / spacing)

    def choose_bar_arrangement(self, As_target: float, candidate_diams: List[int], candidate_spacings: List[int]) -> BarArrangement:
        # Try diameters in the order given -- the frontend sends the user's
        # preferred bar FIRST. For each diameter, use the widest (most
        # economical) spacing that still satisfies demand. Only move on to
        # the next diameter if NO spacing of this one works at all -- do not
        # search globally across every diameter for the cheapest option,
        # which would silently override the user's choice whenever a smaller
        # diameter happened to need less steel.
        for dia in candidate_diams:
            feasible = [(s, bar_area_mm2(dia) * 1000.0 / s) for s in candidate_spacings
                        if bar_area_mm2(dia) * 1000.0 / s >= As_target]
            if feasible:
                s, As_prov = max(feasible, key=lambda t: t[0])
                return BarArrangement(dia, s, As_prov)
        return self.arrangement_from_bar_and_spacing(max(candidate_diams), min(candidate_spacings))

    def choose_distribution_arrangement(self, main: BarArrangement) -> BarArrangement:
        if main.bar_dia_mm in (10, 12) and main.spacing_mm == 200:
            return self.arrangement_from_bar_and_spacing(8, 250)
        if main.bar_dia_mm == 12 and main.spacing_mm in (150, 175):
            return self.arrangement_from_bar_and_spacing(10, 250)
        if main.bar_dia_mm == 16 and main.spacing_mm == 175:
            return self.arrangement_from_bar_and_spacing(10, 200)
        minimum = self.arrangement_from_bar_and_spacing(8, 250)
        target = 0.50 * main.As_provided_mm2_per_m
        candidates = [(8, 250), (8, 200), (10, 250), (10, 200), (12, 250), (12, 200)]
        feasible = []
        for dia, spacing in candidates:
            cand = self.arrangement_from_bar_and_spacing(dia, spacing)
            if cand.As_provided_mm2_per_m >= max(target, minimum.As_provided_mm2_per_m):
                feasible.append(cand)
        feasible.sort(key=lambda x: (x.As_provided_mm2_per_m, -x.spacing_mm, x.bar_dia_mm))
        return feasible[0] if feasible else minimum

    def deflection_K_factor(self) -> float:
        # EC2 Table 7.4N gives K for one-way structural systems (1.0 simply
        # supported / 1.3 end span / 1.5 interior span / 0.4 cantilever). It
        # has no direct equivalent for two-way panels, so K here is graded by
        # how many edges remain continuous -- more continuity means more
        # rotational restraint, closer to the "interior span" case; less
        # continuity moves toward "simply supported". This mapping is an
        # engineering judgement call, not a value taken directly from a
        # code table -- verify against your own design basis if this matters
        # for a governing deflection check.
        if self.input.support_condition == SupportCondition.SSSS_2W:
            return 1.0
        ec = self.input.edge_condition
        if ec == EdgeCondition.INTERIOR_PANEL:
            return 1.5          # 0 discontinuous edges -- most restrained
        if ec in (EdgeCondition.ONE_SHORT_EDGE_DISCONTINUOUS, EdgeCondition.ONE_LONG_EDGE_DISCONTINUOUS):
            return 1.3          # 1 discontinuous edge
        if ec in (EdgeCondition.TWO_ADJACENT_EDGES_DISCONTINUOUS, EdgeCondition.TWO_SHORT_EDGES_DISCONTINUOUS,
                  EdgeCondition.TWO_LONG_EDGES_DISCONTINUOUS):
            return 1.2          # 2 discontinuous edges
        if ec in (EdgeCondition.THREE_EDGES_ONE_LONG_CONTINUOUS, EdgeCondition.THREE_EDGES_ONE_SHORT_CONTINUOUS):
            return 1.0          # 3 discontinuous edges -- only one edge still restrained
        if ec == EdgeCondition.FOUR_EDGES_DISCONTINUOUS:
            return 1.0          # 0 continuous edges -- true SSSS behaviour
        return 1.3

    def run(self) -> TwoWaySlabResult:
        res = TwoWaySlabResult()
        preset = self.auto_preset()
        res.preset_used = preset

        method = self.input.two_way_moment_method or self.auto_method()
        main_bar_guess = self.input.main_bar_diameter_mm or preset.main_bar_dia_mm
        preset_spacing = preset.main_bar_spacing_mm

        res.thickness_mm = self.input.thickness_mm if self.input.thickness_mm is not None else preset.thickness_mm

        res.aspect_ratio_r = self.input.ly_m / self.input.lx_m

        res.gk_self_kN_m2 = self.input.gk_self_kN_m2 if self.input.gk_self_kN_m2 is not None else 25.0 * res.thickness_mm / 1000.0
        res.gk_finish_kN_m2 = self.input.gk_finish_kN_m2 if self.input.gk_finish_kN_m2 is not None else self.auto_finish_load()
        res.gk_partition_kN_m2 = self.input.gk_partition_kN_m2 if self.input.gk_partition_kN_m2 is not None else self.auto_partition_load()
        res.gk_services_kN_m2 = self.input.gk_services_kN_m2 if self.input.gk_services_kN_m2 is not None else self.auto_services_load()
        res.qk_imposed_kN_m2 = self.input.qk_imposed_kN_m2 if self.input.qk_imposed_kN_m2 is not None else live_load_for_use(self.input.building_use)

        if self.input.partition_mode == PartitionMode.VARIABLE_QK:
            res.Gk_total = res.gk_self_kN_m2 + res.gk_finish_kN_m2 + res.gk_services_kN_m2
            res.Qk_total = res.qk_imposed_kN_m2 + res.gk_partition_kN_m2
        else:
            res.Gk_total = res.gk_self_kN_m2 + res.gk_finish_kN_m2 + res.gk_partition_kN_m2 + res.gk_services_kN_m2
            res.Qk_total = res.qk_imposed_kN_m2

        res.wEd_area_kN_m2 = self.material.gamma_G * res.Gk_total + self.material.gamma_Q * res.Qk_total

        if self.input.support_condition == SupportCondition.SSSS_2W:
            mx, my = self.ssss_plate_series_moments(res.wEd_area_kN_m2, self.input.lx_m, self.input.ly_m)
            res.analysis_method_used = "SSSS elastic plate analysis"
            res.MEd_x_pos_kN_m_per_m = mx
            res.MEd_y_pos_kN_m_per_m = my
        else:
            coeffs = self.interpolate_continuous_coeffs(min(max(res.aspect_ratio_r, 1.0), 2.0), self.input.edge_condition)
            res.alpha_x_neg = coeffs["alpha_x_neg"]
            res.alpha_x_pos = coeffs["alpha_x_pos"]
            res.alpha_y_neg = coeffs["alpha_y_neg"]
            res.alpha_y_pos = coeffs["alpha_y_pos"]
            res.analysis_method_used = "Continuous slab coefficient method"
            res.MEd_x_neg_kN_m_per_m = res.alpha_x_neg * res.wEd_area_kN_m2 * self.input.lx_m ** 2
            res.MEd_x_pos_kN_m_per_m = res.alpha_x_pos * res.wEd_area_kN_m2 * self.input.lx_m ** 2
            res.MEd_y_neg_kN_m_per_m = res.alpha_y_neg * res.wEd_area_kN_m2 * self.input.lx_m ** 2
            res.MEd_y_pos_kN_m_per_m = res.alpha_y_pos * res.wEd_area_kN_m2 * self.input.lx_m ** 2

        candidates_d = self.input.candidate_bar_diameters_mm or self.auto_candidate_bar_diameters()
        candidates_s = self.input.candidate_spacing_mm or self.auto_candidate_spacing()

        # --- iterate: effective depth <-> actually-selected bar diameter ---
        # d_mm depends on the bar diameter, but the bar diameter selected can
        # differ from the initial guess if it can't satisfy demand. Re-derive
        # d_mm/z_mm from whichever diameter is actually governing and re-run
        # the design until it converges (max 3 passes).
        for _ in range(3):
            cover = self.cover_breakdown(main_bar_guess)
            res.c_min_b_mm = cover["c_min_b_mm"]
            res.c_min_dur_mm = cover["c_min_dur_mm"]
            res.delta_c_dur_gamma_mm = cover["delta_c_dur_gamma_mm"]
            res.delta_c_dur_st_mm = cover["delta_c_dur_st_mm"]
            res.delta_c_dur_add_mm = cover["delta_c_dur_add_mm"]
            res.c_min_mm = cover["c_min_mm"]
            res.delta_c_dev_mm = self.input.delta_c_dev_mm
            res.cover_mm = (self.input.cover_mm + self.input.delta_c_dev_mm) if self.input.cover_mm is not None else cover["c_nom_mm"]

            res.d_mm = res.thickness_mm - res.cover_mm - main_bar_guess / 2.0
            res.z_mm = 0.9 * res.d_mm

            res.As_req_x_neg = self.reinforcement_required_mm2_per_m(res.MEd_x_neg_kN_m_per_m, res.z_mm)
            res.As_req_x_pos = self.reinforcement_required_mm2_per_m(res.MEd_x_pos_kN_m_per_m, res.z_mm)
            res.As_req_y_neg = self.reinforcement_required_mm2_per_m(res.MEd_y_neg_kN_m_per_m, res.z_mm)
            res.As_req_y_pos = self.reinforcement_required_mm2_per_m(res.MEd_y_pos_kN_m_per_m, res.z_mm)

            res.As_req_x_main = max(res.As_req_x_neg, res.As_req_x_pos)
            res.As_req_y_main = max(res.As_req_y_neg, res.As_req_y_pos)
            res.As_min_1, res.As_min_2, res.As_min = self.minimum_steel_parts_mm2_per_m(res.d_mm)
            res.As_target_x = max(res.As_req_x_main, res.As_min)
            res.As_target_y = max(res.As_req_y_main, res.As_min)

            auto_main = self.arrangement_from_bar_and_spacing(main_bar_guess, preset_spacing)
            res.main_x = auto_main if auto_main.As_provided_mm2_per_m >= res.As_target_x else self.choose_bar_arrangement(res.As_target_x, candidates_d, candidates_s)
            res.main_y = auto_main if auto_main.As_provided_mm2_per_m >= res.As_target_y else self.choose_bar_arrangement(res.As_target_y, candidates_d, candidates_s)

            governing_dia = max(res.main_x.bar_dia_mm, res.main_y.bar_dia_mm)
            if governing_dia == main_bar_guess:
                break
            main_bar_guess = governing_dia

        res.dist_x = self.choose_distribution_arrangement(res.main_x)
        res.dist_y = self.choose_distribution_arrangement(res.main_y)
        res.dist_target_x = 0.50 * res.main_x.As_provided_mm2_per_m
        res.dist_target_y = 0.50 * res.main_y.As_provided_mm2_per_m
        res.dist_minimum = self.arrangement_from_bar_and_spacing(8, 250).As_provided_mm2_per_m

        res.K_deflection = self.deflection_K_factor()
        res.l_over_d_actual = self.input.lx_m * 1000.0 / res.d_mm
        res.rho = res.As_req_x_main / (1000.0 * res.d_mm) if res.d_mm else 0.0
        res.rho_0 = 1e-3 * math.sqrt(self.material.fck)
        safe_rho = res.rho if res.rho > 0 else 1e-9
        # EC2 Eq. 7.16a (rho <= rho0) and 7.16b with rho' = 0 (rho > rho0). Branch A
        # was missing the 3.2 sqrt(fck)(rho0/rho - 1)^1.5 term (conservative) and
        # branch B was missing rho0/rho (unconservative).
        sqrt_fck = math.sqrt(self.material.fck)
        res.l_over_d_lim_branch_A = res.K_deflection * (11.0 + 1.5 * sqrt_fck * (res.rho_0 / safe_rho)
                                                        + 3.2 * sqrt_fck * max(res.rho_0 / safe_rho - 1.0, 0.0) ** 1.5)
        res.l_over_d_lim_branch_B = res.K_deflection * (11.0 + 1.5 * sqrt_fck * (res.rho_0 / safe_rho if res.rho > 0 else 1.0))
        res.l_over_d_lim_basic = res.l_over_d_lim_branch_A if res.rho <= res.rho_0 else res.l_over_d_lim_branch_B

        # Two-stage deflection check (matches the one-way engine): F3 is only
        # applied if the slab fails the base (unmodified) ratio. A slab that
        # already passes on the basic ratio doesn't need the enhancement.
        res.deflection_base_status = "PASS" if res.l_over_d_actual <= res.l_over_d_lim_basic else "FAIL"
        if res.deflection_base_status == "PASS":
            res.F3 = 1.0
            res.l_over_d_lim_final = res.l_over_d_lim_basic
            res.deflection_status = "PASS"
            res.deflection_enhanced = False
        else:
            res.F3 = min(res.main_x.As_provided_mm2_per_m / res.As_req_x_main, 1.5) if res.As_req_x_main else 1.0
            res.l_over_d_lim_final = res.l_over_d_lim_basic * res.F3
            res.deflection_status = "PASS" if res.l_over_d_actual <= res.l_over_d_lim_final else "FAIL"
            res.deflection_enhanced = True

        res.bending_status_x = "PASS" if res.main_x.As_provided_mm2_per_m >= res.As_req_x_main else "FAIL"
        res.bending_status_y = "PASS" if res.main_y.As_provided_mm2_per_m >= res.As_req_y_main else "FAIL"
        res.min_steel_status_x = "PASS" if res.main_x.As_provided_mm2_per_m >= res.As_min else "FAIL"
        res.min_steel_status_y = "PASS" if res.main_y.As_provided_mm2_per_m >= res.As_min else "FAIL"
        res.shear_status = "NOT_CHECKED_MVP"

        checks = [res.bending_status_x, res.bending_status_y, res.min_steel_status_x, res.min_steel_status_y, res.deflection_status]
        res.overall_status = "PASS" if all(c == "PASS" for c in checks) else "FAIL"

        if preset.preset_status != "OK":
            res.notes.append(preset.preset_status)

        return res


def example_continuous_two_way() -> TwoWaySlabInput:
    return TwoWaySlabInput(
        lx_m=4.0, ly_m=5.0,
        support_condition=SupportCondition.TWO_WAY_BEAM_SUPPORTED,
        panel_type=PanelType.TWO_WAY,
        edge_condition=EdgeCondition.INTERIOR_PANEL,
        concrete_grade="C30/37", steel_grade="B500",
        building_use="office", partition_mode=PartitionMode.PERMANENT_GK, exposure_class="XC1",
    )


if __name__ == "__main__":
    slab = example_continuous_two_way()
    designer = TwoWaySlabDesigner(slab)
    result = designer.run()
    print("method:", result.analysis_method_used)
    print("wEd:", round(result.wEd_area_kN_m2, 3), "kN/m2")
    print("MEd_x_pos:", round(result.MEd_x_pos_kN_m_per_m, 3), "MEd_x_neg:", round(result.MEd_x_neg_kN_m_per_m, 3))
    print("main_x:", result.main_x, "overall:", result.overall_status)