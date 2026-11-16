# backend/models/column_schemas.py
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from models.schemas import DesignCode


# ============================================================
# ENUMS
# ============================================================

class ColumnType(str, Enum):
    AXIAL = "axial"
    UNIAXIAL = "uniaxial"
    BIAXIAL = "biaxial"


class EffectiveLengthMethod(str, Enum):
    IDEALISED = "idealised"      # K from the end condition
    K_FACTORS = "k_factors"      # EC2 Eq. 5.15 / 5.16 joint flexibilities
    DIRECT = "direct"            # l0 entered per axis


class UniaxialAxis(str, Enum):
    X = "x"
    Y = "y"


class EndCondition(str, Enum):
    FIXED_FIXED = "fixed-fixed"
    FIXED_PINNED = "fixed-pinned"
    PINNED_PINNED = "pinned-pinned"
    FIXED_FREE = "fixed-free"


VALID_EXPOSURE = {
    "X0", "XC1", "XC2", "XC3", "XC4",
    "XD1", "XD2", "XD3", "XS1", "XS2", "XS3",
}

VALID_CONCRETE = {
    "C12/15", "C16/20", "C20/25", "C25/30", "C30/37", "C35/45", "C40/50",
    "C45/55", "C50/60", "C55/67", "C60/75", "C70/85", "C80/95", "C90/105",
}

VALID_STEEL = {"B500", "B460"}

VALID_BUILDING_USE = {
    "residential", "office", "corridor", "stairs", "retail", "shopping_mall",
    "assembly_fixed_seating", "assembly_movable_seating", "assembly_concert_hall",
    "assembly_dance_floor", "storage_light", "storage_heavy", "warehouse_general",
    "warehouse_heavy", "parking_cars", "parking_trucks", "hospital_ward",
    "hospital_operating_room", "school_classroom", "library_reading",
    "library_stack", "gymnasium", "roof_access", "roof_no_access",
    "balcony", "plant_room",
}


def _distribute_faces(n_total: int, b_mm: float, h_mm: float):
    """
    Face counts only, mirroring column_engine.distribute_bars exactly.

    Kept in step with the engine on purpose: a validator that distributes
    bars differently from the engine would reject cages the engine would
    have built, and accept ones it would not.
    """
    n = max(4, int(n_total))
    if n % 2 == 1:
        n += 1
    s = n // 2 + 2
    n_h = int(round(s * h_mm / (b_mm + h_mm)))
    n_h = max(2, min(s - 2, n_h))
    return s - n_h, n_h


def _smallest_total_keeping(b_mm, h_mm, need_b, need_h, start_total, limit=80):
    """
    Smallest even bar total, from start_total up, whose distribution on this
    section puts at least need_b on the b-face and need_h on the h-face.
    Returns (total, n_b, n_h) or None. Used only to word a suggestion.
    """
    n = max(4, int(start_total))
    if n % 2:
        n += 1
    while n <= limit:
        nb, nh = _distribute_faces(n, b_mm, h_mm)
        if nb >= need_b and nh >= need_h:
            return n, nb, nh
        n += 2
    return None


def _effective_faces(b_mm, h_mm, n_total, n_b, n_h):
    """An explicit face split wins; otherwise the engine's distribution."""
    if n_b is not None and n_h is not None:
        return int(n_b), int(n_h)
    return _distribute_faces(n_total, b_mm, h_mm)


# ============================================================
# REQUEST
# ============================================================

class ColWall(BaseModel):
    present: bool = False
    thickness_m: float = Field(0.15, ge=0)
    density_kN_per_m3: Optional[float] = Field(None, gt=0)
    opening_ratio: float = Field(0.0, ge=0, le=0.9)


class ColBeam(BaseModel):
    """
    The PAIR of beams framing into the column in one direction.

    There is no span field on purpose. Spans come from the tributary
    geometry (left_x_m/right_x_m for the x pair, top_y_m/bottom_y_m for
    the y pair), so a span here could contradict them.
    """
    width_m: float = Field(0.23, gt=0)
    depth_m: float = Field(0.45, gt=0)
    wall: ColWall = ColWall()


class ColFloorTemplate(BaseModel):
    building_use: str = "office"
    slab_thickness_m: float = Field(0.150, gt=0)
    finishes_kN_per_m2: float = Field(1.0, ge=0)
    services_kN_per_m2: float = Field(0.5, ge=0)
    partitions_kN_per_m2: float = Field(1.0, ge=0)
    beam_x: ColBeam = ColBeam()
    beam_y: ColBeam = ColBeam()
    imposed_override_kN_per_m2: Optional[float] = Field(None, ge=0)

    @field_validator("building_use")
    @classmethod
    def _use_known(cls, v: str) -> str:
        key = (v or "").strip().lower()
        if key not in VALID_BUILDING_USE:
            raise ValueError(
                f"Unsupported building use '{v}'. Expected one of: "
                + ", ".join(sorted(VALID_BUILDING_USE))
            )
        return key


class ColGeometry(BaseModel):
    b_mm: float = Field(230.0, gt=0, description="Section width, x direction")
    h_mm: float = Field(460.0, gt=0, description="Section depth, y direction")
    storey_height_m: float = Field(3.0, gt=0)
    clear_height_m: Optional[float] = Field(
        None, gt=0,
        description="Clear height between restraints. Defaults to storey_height_m.",
    )

    left_x_m: float = Field(4.0, ge=0)
    right_x_m: float = Field(5.0, ge=0)
    top_y_m: float = Field(3.5, ge=0)
    bottom_y_m: float = Field(3.5, ge=0)


class ColEffectiveLength(BaseModel):
    """
    Effective length, in order of precedence:
        1. l0_override_*_mm  — a value computed elsewhere
        2. k1/k2             — EC2 Cl. 5.8.3.2 Eq. 5.15 (braced) / 5.16
        3. neither           — idealised K from end_condition

    The k-factor route matters for real frame columns: the same clear height
    gives a different l0 about each axis because the restraining beams differ.
    """
    l0_override_x_mm: Optional[float] = Field(None, gt=0)
    l0_override_y_mm: Optional[float] = Field(None, gt=0)
    k1_x: Optional[float] = Field(None, ge=0)
    k2_x: Optional[float] = Field(None, ge=0)
    k1_y: Optional[float] = Field(None, ge=0)
    k2_y: Optional[float] = Field(None, ge=0)

    @model_validator(mode="after")
    def _k_pairs_complete(self):
        for a, b, axis in ((self.k1_x, self.k2_x, "x"), (self.k1_y, self.k2_y, "y")):
            if (a is None) != (b is None):
                raise ValueError(
                    f"Give both k1_{axis} and k2_{axis}, or neither. A single "
                    f"joint flexibility is not enough to evaluate Eq. 5.15."
                )
        return self


class ColReinforcement(BaseModel):
    # Frontend sends the preferred diameter first; the engine respects the
    # given order and must not sort it.
    main_bar_dia_mm: float = Field(16.0, gt=0)
    n_bars_total: int = Field(8, ge=4)
    n_bars_b_face: Optional[int] = Field(None, ge=2)
    n_bars_h_face: Optional[int] = Field(None, ge=2)
    link_dia_mm: float = Field(8.0, gt=0)

    @field_validator("main_bar_dia_mm")
    @classmethod
    def _bar_min(cls, v: float) -> float:
        if v < 12.0:
            raise ValueError(
                "Main bar diameter must be at least 12 mm for columns "
                "(EN 1992-1-1 Cl. 9.5.2(1) with the UK National Annex)."
            )
        return v

    @model_validator(mode="after")
    def _faces_consistent(self):
        if (self.n_bars_b_face is None) != (self.n_bars_h_face is None):
            raise ValueError(
                "Specify both n_bars_b_face and n_bars_h_face, or neither "
                "(leave both blank to let the engine distribute the bars)."
            )
        return self


class ColEffectiveLength(BaseModel):
    """
    How l0 is obtained. An explicit method rather than silent precedence:
    a stale k-factor left over from a previous method should not quietly
    override the value the user thinks is being used.
    """
    method: EffectiveLengthMethod = EffectiveLengthMethod.IDEALISED
    clear_height_m: Optional[float] = Field(
        None, gt=0, description="Clear height between restraints; defaults to storey height"
    )
    k1_x: Optional[float] = Field(None, ge=0)
    k2_x: Optional[float] = Field(None, ge=0)
    k1_y: Optional[float] = Field(None, ge=0)
    k2_y: Optional[float] = Field(None, ge=0)
    l0_x_mm: Optional[float] = Field(None, gt=0)
    l0_y_mm: Optional[float] = Field(None, gt=0)

    @model_validator(mode="after")
    def _method_complete(self):
        if self.method == EffectiveLengthMethod.K_FACTORS:
            missing = [n for n in ("k1_x", "k2_x", "k1_y", "k2_y")
                       if getattr(self, n) is None]
            if missing:
                raise ValueError(
                    "The k-factor method needs all four joint flexibilities. "
                    f"Missing: {', '.join(missing)}. EN 1992-1-1 Cl. 5.8.3.2 "
                    "treats k = 0 as theoretical only, so values below 0.1 are "
                    "raised to 0.1."
                )
        if self.method == EffectiveLengthMethod.DIRECT:
            missing = [n for n in ("l0_x_mm", "l0_y_mm") if getattr(self, n) is None]
            if missing:
                raise ValueError(
                    "Entering l0 directly needs a value for both axes. "
                    f"Missing: {', '.join(missing)}."
                )
        return self


class ColAutosizeAttempt(BaseModel):
    bars: str
    bar_dia_mm: float
    n_bars: int
    As_mm2: float
    passes: bool
    reason: str
    utilisation: Optional[float] = None


class ColAutosize(BaseModel):
    applied: bool
    chosen: Optional[str] = None
    reason: str
    attempts: List[ColAutosizeAttempt]


class ColFrameOptions(BaseModel):
    """
    How the design actions are obtained. Default is to derive them: the user
    supplies building geometry and loads, never moments.
    """
    derive_moments: bool = True
    base_fixed: bool = Field(
        False,
        description="True if the foundation is designed to resist moment. A pinned "
                    "base carries none, so the lowest column has zero moment there.",
    )
    cracked_beam_stiffness: bool = Field(
        True,
        description="Halve beam I for cracking when distributing the joint moment. "
                    "EC2 practice halves it; BS 8110 worked examples typically do not. "
                    "Halving raises the column's share, so it is the conservative side.",
    )


class ColAnalysisOptions(BaseModel):
    include_min_eccentricity: bool = True
    include_geometric_imperfections: bool = True
    effective_creep_ratio: float = Field(2.0, ge=0, le=6.0)
    autosize_bars: bool = Field(
        False,
        description="Propose the smallest cage that passes every check at each storey, "
                    "within whatever section that storey has. Sections are never changed: "
                    "if no candidate fits, the result says the section is too small.",
    )
    use_default_A_B: bool = Field(
        True,
        description=(
            "EN 1992-1-1 Cl. 5.8.3.1. True uses the code defaults A = 0.7 and "
            "B = 1.1. False computes them from the creep ratio and the provided "
            "steel, which raises lambda_lim and is less conservative."
        ),
    )


class ColMaterials(BaseModel):
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"
    concrete_density_kN_per_m3: float = Field(25.0, gt=0)
    masonry_density_kN_per_m3: float = Field(20.0, gt=0)

    @field_validator("concrete_grade")
    @classmethod
    def _conc(cls, v: str) -> str:
        if v not in VALID_CONCRETE:
            raise ValueError(f"Unsupported concrete grade '{v}'.")
        return v

    @field_validator("steel_grade")
    @classmethod
    def _steel(cls, v: str) -> str:
        if v not in VALID_STEEL:
            raise ValueError(f"Unsupported steel grade '{v}'.")
        return v


class ColDurability(BaseModel):
    exposure_class: str = "XC1"
    delta_c_dev_mm: float = Field(10.0, ge=0)
    clear_cover_override_mm: Optional[float] = Field(None, gt=0)

    @field_validator("exposure_class")
    @classmethod
    def _exposure(cls, v: str) -> str:
        key = (v or "").strip().upper()
        if key not in VALID_EXPOSURE:
            raise ValueError(
                f"Unsupported exposure class '{v}'. Expected one of: "
                + ", ".join(sorted(VALID_EXPOSURE))
            )
        return key


class ColPartialFactors(BaseModel):
    gamma_G: float = Field(1.35, gt=0)
    gamma_Q: float = Field(1.50, gt=0)
    gamma_c: float = Field(1.50, gt=0)
    gamma_s: float = Field(1.15, gt=0)
    alpha_cc: float = Field(0.85, gt=0, le=1.0)


class ColLevelSpec(BaseModel):
    """
    Per-storey overrides. Anything left None falls back to the column-wide
    value, so a request that sets none of these behaves exactly as before.
    """
    b_mm: Optional[float] = Field(None, gt=0)
    h_mm: Optional[float] = Field(None, gt=0)
    main_bar_dia_mm: Optional[float] = Field(None, gt=0)
    n_bars_total: Optional[int] = Field(None, ge=4)
    n_bars_b_face: Optional[int] = Field(None, ge=2)
    n_bars_h_face: Optional[int] = Field(None, ge=2)
    link_dia_mm: Optional[float] = Field(None, gt=0)
    storey_height_m: Optional[float] = Field(None, gt=0)
    floor: Optional[ColFloorTemplate] = None

    @field_validator("main_bar_dia_mm")
    @classmethod
    def _level_bar_min(cls, v):
        # Same rule as the base column. Without it a storey edited through
        # the API could carry a bar the base column would have refused.
        if v is not None and v < 12.0:
            raise ValueError(
                "Main bar diameter must be at least 12 mm for columns "
                "(UK National Annex to EN 1992-1-1, Cl. 9.5.2(1))."
            )
        return v

    @model_validator(mode="after")
    def _faces_together(self):
        if (self.n_bars_b_face is None) != (self.n_bars_h_face is None):
            raise ValueError(
                "Set both n_bars_b_face and n_bars_h_face for a level, or neither."
            )
        return self


class ColDesignBasis(BaseModel):
    """
    Optional names for the design summary a building control body asks for
    (City of London District Surveyor's guidance on structural calculations).

    All free text, all optional. They are printed on the report when given and
    printed as "not entered" when not. Nothing is ever filled in on the
    engineer's behalf: who designed and who checked is a statement the
    engineer makes, not something the software can supply.
    """
    designer_name: Optional[str] = Field(None, max_length=120)
    designer_qualifications: Optional[str] = Field(None, max_length=160)
    checked_by: Optional[str] = Field(None, max_length=120)
    checker_qualifications: Optional[str] = Field(None, max_length=160)
    stability_responsible: Optional[str] = Field(
        None, max_length=160,
        description="Organisation or individual with overall responsibility for "
                    "the stability of the structure.",
    )


class ColumnDesignRequest(BaseModel):
    column_id: str = "C1"
    column_type: ColumnType = ColumnType.BIAXIAL
    # Which axis a uniaxial column bends about. Ignored on the other routes.
    uniaxial_axis: UniaxialAxis = UniaxialAxis.X
    design_code: DesignCode = DesignCode.EC2
    design_basis: ColDesignBasis = ColDesignBasis()

    end_condition: EndCondition = EndCondition.FIXED_FIXED
    braced: bool = True

    geometry: ColGeometry = ColGeometry()
    effective_length: ColEffectiveLength = ColEffectiveLength()
    analysis: ColAnalysisOptions = ColAnalysisOptions()
    frame: ColFrameOptions = ColFrameOptions()

    # Per-storey edits, keyed by level name ("Roof", "Typical_Floor_3", ...).
    # Empty means one section and one cage for the whole column.
    levels: Dict[str, ColLevelSpec] = Field(default_factory=dict)

    crank_max_slope: float = Field(
        1.0 / 6.0, gt=0, le=1.0,
        description="Maximum bar crank slope (rise:run) allowed between storeys with "
                    "different sections. 1/6 is common UK detailing practice, not a "
                    "numbered EC2 clause -- widen it only where a shallower crank has "
                    "been checked separately.",
    )
    crank_zone_mm: float = Field(
        300.0, gt=0,
        description="Assumed vertical length available to form the crank, just above "
                    "the lap. A fixed assumption, not derived from storey height -- a "
                    "tall storey does not usually leave more room to crank in, since "
                    "the bars still need a straight run into the beam-column joint "
                    "above and out of the starter below. Raise it only where the "
                    "actual detail has been checked to allow more.",
    )
    reinforcement: ColReinforcement = ColReinforcement()
    materials: ColMaterials = ColMaterials()
    durability: ColDurability = ColDurability()
    factors: ColPartialFactors = ColPartialFactors()

    number_of_typical_floors: int = Field(3, ge=0, le=60)
    typical_floor: ColFloorTemplate = ColFloorTemplate()
    roof_floor: ColFloorTemplate = ColFloorTemplate(
        building_use="roof_no_access",
        finishes_kN_per_m2=0.75,
        services_kN_per_m2=0.25,
        partitions_kN_per_m2=0.0,
        beam_x=ColBeam(wall=ColWall(present=False)),
        beam_y=ColBeam(wall=ColWall(present=False)),
    )

    M01x_kNm: Dict[str, float] = Field(default_factory=dict)
    M02x_kNm: Dict[str, float] = Field(default_factory=dict)
    M01y_kNm: Dict[str, float] = Field(default_factory=dict)
    M02y_kNm: Dict[str, float] = Field(default_factory=dict)

    # Bypass the take-down and design from frame-analysis output directly.
    NEd_override_kN: Optional[float] = Field(None, gt=0)
    MEdx_override_kNm: Optional[float] = Field(None, ge=0)
    MEdy_override_kNm: Optional[float] = Field(None, ge=0)

    # ---------- cross-field validation ----------
    @model_validator(mode="after")
    def _design_code_is_implemented(self):
        """
        The engine implements EN 1992-1-1 and nothing else. It never reads
        design_code, so any other value would run the EC2 formulas and print
        the other code's name on the result. Building control asks that the
        analysis be compatible with the standard the design claims to use, so
        this is refused rather than relabelled. The beam schema does the same.
        """
        code = getattr(self.design_code, "value", self.design_code)
        if str(code).upper() != "EC2":
            raise ValueError(
                f"Design code '{code}' is not implemented for columns. Only EC2 "
                f"(EN 1992-1-1) is. Results would otherwise be calculated to "
                f"EC2 and labelled as {code}."
            )
        return self

    @model_validator(mode="after")
    def _bars_fit_in_section(self):
        """
        EN 1992-1-1 Cl. 8.2: clear horizontal spacing between bars must be at
        least max(bar diameter, 20 mm). Reject layouts that cannot physically
        be built rather than producing a design for an impossible cage.
        """
        geo, rf, dur = self.geometry, self.reinforcement, self.durability

        cover = dur.clear_cover_override_mm
        if cover is None:
            cover = 45.0  # upper-bound placeholder; engine derives the real value
        edge = cover + rf.link_dia_mm
        s_min = max(rf.main_bar_dia_mm, 20.0)

        n_b, n_h = rf.n_bars_b_face, rf.n_bars_h_face
        if n_b is None or n_h is None:
            total = rf.n_bars_total + (rf.n_bars_total % 2)
            s = total // 2 + 2
            n_h = max(2, min(s - 2, round(s * geo.h_mm / (geo.b_mm + geo.h_mm))))
            n_b = s - n_h

        for n, dim, label in ((n_b, geo.b_mm, "width b"), (n_h, geo.h_mm, "depth h")):
            if n < 2:
                continue
            needed = 2 * edge + n * rf.main_bar_dia_mm + (n - 1) * s_min
            if needed > dim:
                raise ValueError(
                    f"{n} bars of {rf.main_bar_dia_mm:.0f} mm will not fit across the "
                    f"{label} of {dim:.0f} mm. Minimum required is {needed:.0f} mm "
                    f"allowing cover, links and {s_min:.0f} mm clear spacing "
                    f"(EN 1992-1-1 Cl. 8.2). Increase the section, reduce the bar "
                    f"count, or use a smaller diameter."
                )
        return self

    @model_validator(mode="after")
    def _storey_sections_can_lap(self):
        """
        Column bars carry on from one storey to the next by lapping just above
        each floor. Where the section changes size, the bars cannot simply run
        straight through -- they have to be bent inward or outward ("cranked")
        to reach the new position, over a short length just above the lap.

        There is no single EC2 clause that sets a crank slope; the 1-in-6 limit
        used here is common UK column-detailing practice (see e.g. the
        Standard Method of Detailing). It is deliberately conservative and can
        be widened with crank_max_slope on a request where a shallower crank
        has been checked separately.

        This blocks a section step the bars cannot physically reach across in
        the assumed zone -- it does not forbid stepping the section, which is
        normal and often necessary going up a tall building.
        """
        g = self.geometry
        names = ["Roof"] + [f"Typical_Floor_{i}"
                            for i in range(self.number_of_typical_floors, 0, -1)]
        if len(names) < 2:
            return self

        def eff(name):
            sp = self.levels.get(name)
            b = sp.b_mm if (sp and sp.b_mm is not None) else g.b_mm
            h = sp.h_mm if (sp and sp.h_mm is not None) else g.h_mm
            sh = sp.storey_height_m if (sp and sp.storey_height_m is not None) else g.storey_height_m
            return b, h, sh

        slope = self.crank_max_slope
        for i in range(len(names) - 1):
            b_a, h_a, _ = eff(names[i])
            b_b, h_b, _sh_b = eff(names[i + 1])  # storey height not used in the zone assumption
            if b_a == b_b and h_a == h_b:
                continue
            available_mm = self.crank_zone_mm
            for axis, dim_a, dim_b in (("b", b_a, b_b), ("h", h_a, h_b)):
                offset = abs(dim_b - dim_a) / 2.0
                if offset < 1e-6:
                    continue
                required_mm = offset / slope
                if required_mm > available_mm:
                    raise ValueError(
                        f"{names[i]} ({b_a:.0f}x{h_a:.0f}) to {names[i + 1]} "
                        f"({b_b:.0f}x{h_b:.0f}): the {axis} face moves "
                        f"{offset:.0f} mm, needing a crank at least "
                        f"{required_mm:.0f} mm long at a {slope:.3f} slope. "
                        f"Only about {available_mm:.0f} mm is assumed available "
                        f"in {names[i + 1]}'s storey height. Step the section "
                        f"more gradually, or raise crank_max_slope if a "
                        f"shallower crank has been checked separately."
                    )
        return self

    @model_validator(mode="after")
    def _bar_diameter_non_decreasing(self):
        """
        A lap is limited by its weaker bar, so standard detailing does not let
        the main bar diameter drop going down a building: the storey above
        must not ask for a bigger bar than the one below it provides.

        Only applies when autosize is off. With it on, diameters are chosen by
        the engine at run time and continuity is enforced there instead (see
        ColumnEngine.autosize_level), because the value being checked does not
        exist yet at request time.
        """
        if self.analysis.autosize_bars:
            return self
        names = ["Roof"] + [f"Typical_Floor_{i}"
                            for i in range(self.number_of_typical_floors, 0, -1)]
        if len(names) < 2:
            return self

        def dia(name):
            sp = self.levels.get(name)
            return sp.main_bar_dia_mm if (sp and sp.main_bar_dia_mm is not None) \
                else self.reinforcement.main_bar_dia_mm

        prev_name, prev_dia = names[0], dia(names[0])
        for name in names[1:]:
            this_dia = dia(name)
            if this_dia < prev_dia:
                raise ValueError(
                    f"{name} specifies Y{this_dia:.0f}, smaller than Y{prev_dia:.0f} "
                    f"on {prev_name} above it. A lap is limited by its weaker bar, so "
                    f"the main bar diameter must not decrease going down the "
                    f"building. Raise {name}'s bar diameter to at least "
                    f"Y{prev_dia:.0f}, or increase it on {prev_name} instead if "
                    f"that storey was meant to match."
                )
            prev_name, prev_dia = name, this_dia
        return self

    def _level_names(self):
        return ["Roof"] + [f"Typical_Floor_{i}"
                           for i in range(self.number_of_typical_floors, 0, -1)]

    def _faces_at(self, name):
        """
        (n_b_face, n_h_face, set_by_hand, b, h, n_total) for one storey, after
        inheritance.

        set_by_hand says the split came from the request rather than from the
        engine's distribution, which matters because a hand-set split is not
        touched by auto-size.
        """
        g, rf = self.geometry, self.reinforcement
        sp = self.levels.get(name)
        b = sp.b_mm if (sp and sp.b_mm is not None) else g.b_mm
        h = sp.h_mm if (sp and sp.h_mm is not None) else g.h_mm
        n_b = sp.n_bars_b_face if sp else None
        n_h = sp.n_bars_h_face if sp else None
        by_hand = n_b is not None and n_h is not None
        if not by_hand:
            n_b, n_h = rf.n_bars_b_face, rf.n_bars_h_face
            by_hand = n_b is not None and n_h is not None
        n_total = (sp.n_bars_total if (sp and sp.n_bars_total is not None)
                   else rf.n_bars_total)
        n_b, n_h = _effective_faces(b, h, n_total, n_b, n_h)
        return n_b, n_h, by_hand, b, h, n_total

    @model_validator(mode="after")
    def _level_bars_fit_in_section(self):
        """
        EN 1992-1-1 Cl. 8.2 again, this time per storey.

        _bars_fit_in_section checks the base column only. Once a storey can
        carry its own face split, a cage that cannot physically be tied can
        be entered on a storey whose section is smaller than the base one,
        and nothing downstream catches it: design_level checks capacity, not
        buildability.

        Only storeys actually edited are checked, so this cannot newly reject
        a request that sets no per-storey values. With auto-size on, a storey
        whose bars the engine will choose is skipped -- the entered count is a
        starting point there, not the cage.
        """
        g, rf, dur = self.geometry, self.reinforcement, self.durability
        cover = dur.clear_cover_override_mm
        if cover is None:
            cover = 45.0  # upper-bound placeholder; engine derives the real value

        for name, sp in self.levels.items():
            touched = any(v is not None for v in (
                sp.b_mm, sp.h_mm, sp.main_bar_dia_mm, sp.n_bars_total,
                sp.n_bars_b_face, sp.n_bars_h_face, sp.link_dia_mm))
            if not touched:
                continue
            by_hand = sp.n_bars_b_face is not None and sp.n_bars_h_face is not None
            if self.analysis.autosize_bars and not by_hand:
                continue

            b = sp.b_mm if sp.b_mm is not None else g.b_mm
            h = sp.h_mm if sp.h_mm is not None else g.h_mm
            dia = sp.main_bar_dia_mm if sp.main_bar_dia_mm is not None \
                else rf.main_bar_dia_mm
            link = sp.link_dia_mm if sp.link_dia_mm is not None else rf.link_dia_mm
            n_b, n_h, *_ = self._faces_at(name)

            edge = cover + link
            s_min = max(dia, 20.0)
            for n, dim, label in ((n_b, b, "width b"), (n_h, h, "depth h")):
                if n < 2:
                    continue
                needed = 2 * edge + n * dia + (n - 1) * s_min
                if needed > dim:
                    raise ValueError(
                        f"{name}: {n} bars of {dia:.0f} mm will not fit across the "
                        f"{label} of {dim:.0f} mm. Minimum required is {needed:.0f} mm "
                        f"allowing cover, links and {s_min:.0f} mm clear spacing "
                        f"(EN 1992-1-1 Cl. 8.2). Reduce that face's bar count on "
                        f"{name}, use a smaller diameter, or widen the section."
                    )
        return self

    @model_validator(mode="after")
    def _bar_count_per_face_non_decreasing(self):
        """
        Every bar laps into a bar in the storey below, so a face that loses a
        bar going down the building leaves the extra bar above it with nothing
        to continue into.

        Same detailing principle as _bar_diameter_non_decreasing, applied to
        the count rather than the size. Note the count can drop without anyone
        typing it: the engine puts more bars on the longer face, so a storey
        that widens redistributes the same total and can end up with fewer on
        one face.

        Skipped when auto-size is on, because the counts it will choose do not
        exist yet at request time; ColumnEngine.autosize_level carries the
        face counts down instead, and checks a hand-set storey against them.
        """
        if self.analysis.autosize_bars:
            return self
        names = self._level_names()
        if len(names) < 2:
            return self

        prev_name = names[0]
        prev_b, prev_h, prev_hand, prev_bb, prev_hh, prev_total = self._faces_at(prev_name)
        for name in names[1:]:
            n_b, n_h, by_hand, bb, hh, n_total = self._faces_at(name)
            for face, above, below in (("b", prev_b, n_b), ("h", prev_h, n_h)):
                if below >= above:
                    continue
                if by_hand:
                    raise ValueError(
                        f"{name} has {below} bars on each {face}-face, fewer than the "
                        f"{above} on {prev_name} above it. A lap needs a bar beneath "
                        f"each bar it continues from, so the count on a face must not "
                        f"decrease going down the building. Raise {name}'s {face}-face "
                        f"count to at least {above}, or lower it on {prev_name} if that "
                        f"storey was the one meant to change."
                    )
                # Nobody typed a face split on THIS storey, so the engine
                # spread its total by the section shape. Name what actually
                # produced the shortfall, because it is one of three different
                # things and a wrong explanation sends the engineer to the
                # wrong field.
                if prev_hand:
                    cause = "that split was set by hand on the storey above"
                elif abs(bb - prev_bb) > 1e-6 or abs(hh - prev_hh) > 1e-6:
                    cause = (f"the section changes from {prev_bb:.0f}x{prev_hh:.0f} on "
                             f"{prev_name} to {bb:.0f}x{hh:.0f} here, which moves bars "
                             f"between faces")
                else:
                    cause = (f"it carries {prev_total} bars against {n_total} here")
                fix = _smallest_total_keeping(bb, hh, prev_b, prev_h, n_total)
                suggestion = (
                    f"Raise the number of bars on {name} to {fix[0]} "
                    f"(that gives {fix[1]} per b-face and {fix[2]} per h-face), "
                    f"or tick 'Set bars per face manually' for {name} and set the "
                    f"faces yourself."
                    if fix else
                    f"Tick 'Set bars per face manually' for {name} and set the "
                    f"faces yourself."
                )
                raise ValueError(
                    f"{name}: {n_total} bars on its {bb:.0f}x{hh:.0f} section spread as "
                    f"{n_b} per b-face and {n_h} per h-face, but {prev_name} above has "
                    f"{prev_b} and {prev_h}: {cause}. The {face}-face now has {below} "
                    f"where {above} sit above it. A lap needs a bar beneath each bar it "
                    f"continues from, so a face cannot lose a bar going down the "
                    f"building. {suggestion}"
                )
            prev_name, prev_b, prev_h = name, n_b, n_h
            prev_hand, prev_bb, prev_hh, prev_total = by_hand, bb, hh, n_total
        return self

    @model_validator(mode="after")
    def _levels_known(self):
        if not self.levels:
            return self
        valid = {"Roof"} | {f"Typical_Floor_{i}"
                            for i in range(1, self.number_of_typical_floors + 1)}
        unknown = sorted(set(self.levels) - valid - {"Design"})
        if unknown:
            raise ValueError(
                f"Unknown level name(s): {', '.join(unknown)}. Expected "
                f"'Roof' or 'Typical_Floor_1'..'Typical_Floor_"
                f"{self.number_of_typical_floors}'."
            )
        return self

    @model_validator(mode="after")
    def _tributary_present(self):
        if self.NEd_override_kN is not None:
            return self
        g = self.geometry
        if (g.left_x_m + g.right_x_m) <= 0 or (g.top_y_m + g.bottom_y_m) <= 0:
            raise ValueError(
                "Tributary spans must be greater than zero in both directions "
                "when the load take-down is used. Supply NEd_override_kN "
                "instead if you already have the axial load."
            )
        return self

    @model_validator(mode="after")
    def _moments_match_route(self):
        if self.column_type == ColumnType.AXIAL:
            return self
        if self.frame.derive_moments:
            # The sub-frame produces them; demanding them as input would
            # defeat the point of deriving them.
            return self
        if self.column_type == ColumnType.UNIAXIAL:
            ax = self.uniaxial_axis.value
            src = self.M02x_kNm if ax == "x" else self.M02y_kNm
            ovr = self.MEdx_override_kNm if ax == "x" else self.MEdy_override_kNm
            if not src and ovr is None:
                raise ValueError(
                    f"A uniaxial column bending about {ax} needs first order moments "
                    f"about {ax}. Supply M02{ax}_kNm per level, or MEd{ax}_override_kNm, "
                    "or switch the column type to 'axial' for a minimum-eccentricity "
                    "design."
                )
        if self.column_type == ColumnType.BIAXIAL:
            has_x = bool(self.M02x_kNm) or self.MEdx_override_kNm is not None
            if not has_x:
                raise ValueError(
                    "A biaxial column needs first order moments about x. Supply "
                    "M02x_kNm per level, or MEdx_override_kNm."
                )
        if self.column_type == ColumnType.BIAXIAL:
            has_y = bool(self.M02y_kNm) or self.MEdy_override_kNm is not None
            if not has_y:
                raise ValueError(
                    "A biaxial column needs first order moments about y. Supply "
                    "M02y_kNm per level, or MEdy_override_kNm, or switch the "
                    "column type to 'uniaxial'."
                )
        return self


# ============================================================
# RESPONSE
# ============================================================

class ReportRow(BaseModel):
    reference: str
    calculation: str
    output: str


class ReportSection(BaseModel):
    title: str
    rows: List[ReportRow]


class ColSecondOrder(BaseModel):
    omega: float
    n: float
    n_u: float
    Kr: float
    beta: float
    Kphi: float
    d_eff: float
    inv_r0: float
    inv_r: float
    e2_mm: float
    M2_kNm: float


class ColAxisResult(BaseModel):
    lambda_: float = Field(..., alias="lambda")
    lambda_lim: float
    slender: bool
    l0_mm: float
    l0_source: str
    M01: float
    M02: float
    M0e: float
    ei_mm: float
    M_imp: float
    M_end: float
    M_eq: float
    M_min: float
    M_first: float
    M2: float
    MEd: float
    MRd: float
    second_order: ColSecondOrder
    utilisation: float

    model_config = {"populate_by_name": True}


class ColBiaxial(BaseModel):
    a: float
    N_ratio: float
    interaction: float


class ColCheck(BaseModel):
    name: str
    passed: bool = Field(..., alias="pass")

    model_config = {"populate_by_name": True}


class ColInteractionPoint(BaseModel):
    N_kN: float
    M_kNm: float
    x_mm: float


class ColDetailing(BaseModel):
    phi_t_min_mm: float
    link_dia_mm: float
    s_max_mm: float
    s_reduced_mm: float
    As_provided_mm2: float
    As_min_mm2: float
    As_min_basis_1_mm2: float
    As_min_basis_2_mm2: float
    As_max_mm2: float
    rho_pct: float
    n_bars_b_face: int
    n_bars_h_face: int
    d_prime_mm: float
    Ac_mm2: float


class ColLevelResult(BaseModel):
    level: str
    NEd_kN: float
    # This storey's own section and cage. With no per-level edits these are
    # the same on every level.
    b_mm: float
    h_mm: float
    bar_dia_mm: float
    n_bars: int
    link_dia_mm: float
    As_provided_mm2: float
    cover_mm: float
    rho_pct: float
    x: ColAxisResult
    y: ColAxisResult
    NRd_max_kN: float
    NRd_simplified_kN: float
    axial_utilisation: float
    biaxial: Optional[ColBiaxial] = None
    governing_utilisation: float
    As_min: float
    As_min_basis_1: float
    As_min_basis_2: float
    checks: List[ColCheck]
    autosize: Optional[ColAutosize] = None
    detailing: ColDetailing
    interaction_x: List[ColInteractionPoint]
    interaction_y: List[ColInteractionPoint]
    status: str


class ColSummary(BaseModel):
    column_id: str
    column_type: str
    uniaxial_axis: Optional[str] = None
    design_code: str
    b_mm: float
    h_mm: float
    storey_height_m: float
    end_condition: str
    braced: bool
    concrete_grade: str
    steel_grade: str
    exposure_class: str
    cover_mm: float
    n_bars: int
    bar_dia_mm: float
    link_dia_mm: float
    As_provided_mm2: float
    critical_level: str
    NEd_critical_kN: float
    used_takedown: bool
    status: str


class ColMaterialsOut(BaseModel):
    fck: float
    fcd: float
    fyk: float
    fyd: float
    eps_cu3: float
    eps_c3: float
    lambda_block: float
    eta_block: float


class ColumnDesignResult(BaseModel):
    summary: ColSummary
    materials: ColMaterialsOut
    axial_by_level: Dict[str, float]
    levels: List[ColLevelResult]
    detailing: ColDetailing
    interaction_x: List[ColInteractionPoint]
    interaction_y: List[ColInteractionPoint]
    failed_checks: List[str]
    report: List[ReportSection]# backend/models/column_schemas.py
from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from models.schemas import DesignCode


# ============================================================
# ENUMS
# ============================================================

class ColumnType(str, Enum):
    AXIAL = "axial"
    UNIAXIAL = "uniaxial"
    BIAXIAL = "biaxial"


class EffectiveLengthMethod(str, Enum):
    IDEALISED = "idealised"      # K from the end condition
    K_FACTORS = "k_factors"      # EC2 Eq. 5.15 / 5.16 joint flexibilities
    DIRECT = "direct"            # l0 entered per axis


class UniaxialAxis(str, Enum):
    X = "x"
    Y = "y"


class EndCondition(str, Enum):
    FIXED_FIXED = "fixed-fixed"
    FIXED_PINNED = "fixed-pinned"
    PINNED_PINNED = "pinned-pinned"
    FIXED_FREE = "fixed-free"


VALID_EXPOSURE = {
    "X0", "XC1", "XC2", "XC3", "XC4",
    "XD1", "XD2", "XD3", "XS1", "XS2", "XS3",
}

VALID_CONCRETE = {
    "C12/15", "C16/20", "C20/25", "C25/30", "C30/37", "C35/45", "C40/50",
    "C45/55", "C50/60", "C55/67", "C60/75", "C70/85", "C80/95", "C90/105",
}

VALID_STEEL = {"B500", "B460"}

VALID_BUILDING_USE = {
    "residential", "office", "corridor", "stairs", "retail", "shopping_mall",
    "assembly_fixed_seating", "assembly_movable_seating", "assembly_concert_hall",
    "assembly_dance_floor", "storage_light", "storage_heavy", "warehouse_general",
    "warehouse_heavy", "parking_cars", "parking_trucks", "hospital_ward",
    "hospital_operating_room", "school_classroom", "library_reading",
    "library_stack", "gymnasium", "roof_access", "roof_no_access",
    "balcony", "plant_room",
}


def _distribute_faces(n_total: int, b_mm: float, h_mm: float):
    """
    Face counts only, mirroring column_engine.distribute_bars exactly.

    Kept in step with the engine on purpose: a validator that distributes
    bars differently from the engine would reject cages the engine would
    have built, and accept ones it would not.
    """
    n = max(4, int(n_total))
    if n % 2 == 1:
        n += 1
    s = n // 2 + 2
    n_h = int(round(s * h_mm / (b_mm + h_mm)))
    n_h = max(2, min(s - 2, n_h))
    return s - n_h, n_h


def _smallest_total_keeping(b_mm, h_mm, need_b, need_h, start_total, limit=80):
    """
    Smallest even bar total, from start_total up, whose distribution on this
    section puts at least need_b on the b-face and need_h on the h-face.
    Returns (total, n_b, n_h) or None. Used only to word a suggestion.
    """
    n = max(4, int(start_total))
    if n % 2:
        n += 1
    while n <= limit:
        nb, nh = _distribute_faces(n, b_mm, h_mm)
        if nb >= need_b and nh >= need_h:
            return n, nb, nh
        n += 2
    return None


def _effective_faces(b_mm, h_mm, n_total, n_b, n_h):
    """An explicit face split wins; otherwise the engine's distribution."""
    if n_b is not None and n_h is not None:
        return int(n_b), int(n_h)
    return _distribute_faces(n_total, b_mm, h_mm)


# ============================================================
# REQUEST
# ============================================================

class ColWall(BaseModel):
    present: bool = False
    thickness_m: float = Field(0.15, ge=0)
    density_kN_per_m3: Optional[float] = Field(None, gt=0)
    opening_ratio: float = Field(0.0, ge=0, le=0.9)


class ColBeam(BaseModel):
    """
    The PAIR of beams framing into the column in one direction.

    There is no span field on purpose. Spans come from the tributary
    geometry (left_x_m/right_x_m for the x pair, top_y_m/bottom_y_m for
    the y pair), so a span here could contradict them.
    """
    width_m: float = Field(0.23, gt=0)
    depth_m: float = Field(0.45, gt=0)
    wall: ColWall = ColWall()


class ColFloorTemplate(BaseModel):
    building_use: str = "office"
    slab_thickness_m: float = Field(0.150, gt=0)
    finishes_kN_per_m2: float = Field(1.0, ge=0)
    services_kN_per_m2: float = Field(0.5, ge=0)
    partitions_kN_per_m2: float = Field(1.0, ge=0)
    beam_x: ColBeam = ColBeam()
    beam_y: ColBeam = ColBeam()
    imposed_override_kN_per_m2: Optional[float] = Field(None, ge=0)

    @field_validator("building_use")
    @classmethod
    def _use_known(cls, v: str) -> str:
        key = (v or "").strip().lower()
        if key not in VALID_BUILDING_USE:
            raise ValueError(
                f"Unsupported building use '{v}'. Expected one of: "
                + ", ".join(sorted(VALID_BUILDING_USE))
            )
        return key


class ColGeometry(BaseModel):
    b_mm: float = Field(230.0, gt=0, description="Section width, x direction")
    h_mm: float = Field(460.0, gt=0, description="Section depth, y direction")
    storey_height_m: float = Field(3.0, gt=0)
    clear_height_m: Optional[float] = Field(
        None, gt=0,
        description="Clear height between restraints. Defaults to storey_height_m.",
    )

    left_x_m: float = Field(4.0, ge=0)
    right_x_m: float = Field(5.0, ge=0)
    top_y_m: float = Field(3.5, ge=0)
    bottom_y_m: float = Field(3.5, ge=0)


class ColEffectiveLength(BaseModel):
    """
    Effective length, in order of precedence:
        1. l0_override_*_mm  — a value computed elsewhere
        2. k1/k2             — EC2 Cl. 5.8.3.2 Eq. 5.15 (braced) / 5.16
        3. neither           — idealised K from end_condition

    The k-factor route matters for real frame columns: the same clear height
    gives a different l0 about each axis because the restraining beams differ.
    """
    l0_override_x_mm: Optional[float] = Field(None, gt=0)
    l0_override_y_mm: Optional[float] = Field(None, gt=0)
    k1_x: Optional[float] = Field(None, ge=0)
    k2_x: Optional[float] = Field(None, ge=0)
    k1_y: Optional[float] = Field(None, ge=0)
    k2_y: Optional[float] = Field(None, ge=0)

    @model_validator(mode="after")
    def _k_pairs_complete(self):
        for a, b, axis in ((self.k1_x, self.k2_x, "x"), (self.k1_y, self.k2_y, "y")):
            if (a is None) != (b is None):
                raise ValueError(
                    f"Give both k1_{axis} and k2_{axis}, or neither. A single "
                    f"joint flexibility is not enough to evaluate Eq. 5.15."
                )
        return self


class ColReinforcement(BaseModel):
    # Frontend sends the preferred diameter first; the engine respects the
    # given order and must not sort it.
    main_bar_dia_mm: float = Field(16.0, gt=0)
    n_bars_total: int = Field(8, ge=4)
    n_bars_b_face: Optional[int] = Field(None, ge=2)
    n_bars_h_face: Optional[int] = Field(None, ge=2)
    link_dia_mm: float = Field(8.0, gt=0)

    @field_validator("main_bar_dia_mm")
    @classmethod
    def _bar_min(cls, v: float) -> float:
        if v < 12.0:
            raise ValueError(
                "Main bar diameter must be at least 12 mm for columns "
                "(EN 1992-1-1 Cl. 9.5.2(1) with the UK National Annex)."
            )
        return v

    @model_validator(mode="after")
    def _faces_consistent(self):
        if (self.n_bars_b_face is None) != (self.n_bars_h_face is None):
            raise ValueError(
                "Specify both n_bars_b_face and n_bars_h_face, or neither "
                "(leave both blank to let the engine distribute the bars)."
            )
        return self


class ColEffectiveLength(BaseModel):
    """
    How l0 is obtained. An explicit method rather than silent precedence:
    a stale k-factor left over from a previous method should not quietly
    override the value the user thinks is being used.
    """
    method: EffectiveLengthMethod = EffectiveLengthMethod.IDEALISED
    clear_height_m: Optional[float] = Field(
        None, gt=0, description="Clear height between restraints; defaults to storey height"
    )
    k1_x: Optional[float] = Field(None, ge=0)
    k2_x: Optional[float] = Field(None, ge=0)
    k1_y: Optional[float] = Field(None, ge=0)
    k2_y: Optional[float] = Field(None, ge=0)
    l0_x_mm: Optional[float] = Field(None, gt=0)
    l0_y_mm: Optional[float] = Field(None, gt=0)

    @model_validator(mode="after")
    def _method_complete(self):
        if self.method == EffectiveLengthMethod.K_FACTORS:
            missing = [n for n in ("k1_x", "k2_x", "k1_y", "k2_y")
                       if getattr(self, n) is None]
            if missing:
                raise ValueError(
                    "The k-factor method needs all four joint flexibilities. "
                    f"Missing: {', '.join(missing)}. EN 1992-1-1 Cl. 5.8.3.2 "
                    "treats k = 0 as theoretical only, so values below 0.1 are "
                    "raised to 0.1."
                )
        if self.method == EffectiveLengthMethod.DIRECT:
            missing = [n for n in ("l0_x_mm", "l0_y_mm") if getattr(self, n) is None]
            if missing:
                raise ValueError(
                    "Entering l0 directly needs a value for both axes. "
                    f"Missing: {', '.join(missing)}."
                )
        return self


class ColAutosizeAttempt(BaseModel):
    bars: str
    bar_dia_mm: float
    n_bars: int
    As_mm2: float
    passes: bool
    reason: str
    utilisation: Optional[float] = None


class ColAutosize(BaseModel):
    applied: bool
    chosen: Optional[str] = None
    reason: str
    attempts: List[ColAutosizeAttempt]


class ColFrameOptions(BaseModel):
    """
    How the design actions are obtained. Default is to derive them: the user
    supplies building geometry and loads, never moments.
    """
    derive_moments: bool = True
    base_fixed: bool = Field(
        False,
        description="True if the foundation is designed to resist moment. A pinned "
                    "base carries none, so the lowest column has zero moment there.",
    )
    cracked_beam_stiffness: bool = Field(
        True,
        description="Halve beam I for cracking when distributing the joint moment. "
                    "EC2 practice halves it; BS 8110 worked examples typically do not. "
                    "Halving raises the column's share, so it is the conservative side.",
    )


class ColAnalysisOptions(BaseModel):
    include_min_eccentricity: bool = True
    include_geometric_imperfections: bool = True
    effective_creep_ratio: float = Field(2.0, ge=0, le=6.0)
    autosize_bars: bool = Field(
        False,
        description="Propose the smallest cage that passes every check at each storey, "
                    "within whatever section that storey has. Sections are never changed: "
                    "if no candidate fits, the result says the section is too small.",
    )
    use_default_A_B: bool = Field(
        True,
        description=(
            "EN 1992-1-1 Cl. 5.8.3.1. True uses the code defaults A = 0.7 and "
            "B = 1.1. False computes them from the creep ratio and the provided "
            "steel, which raises lambda_lim and is less conservative."
        ),
    )


class ColMaterials(BaseModel):
    concrete_grade: str = "C30/37"
    steel_grade: str = "B500"
    concrete_density_kN_per_m3: float = Field(25.0, gt=0)
    masonry_density_kN_per_m3: float = Field(20.0, gt=0)

    @field_validator("concrete_grade")
    @classmethod
    def _conc(cls, v: str) -> str:
        if v not in VALID_CONCRETE:
            raise ValueError(f"Unsupported concrete grade '{v}'.")
        return v

    @field_validator("steel_grade")
    @classmethod
    def _steel(cls, v: str) -> str:
        if v not in VALID_STEEL:
            raise ValueError(f"Unsupported steel grade '{v}'.")
        return v


class ColDurability(BaseModel):
    exposure_class: str = "XC1"
    delta_c_dev_mm: float = Field(10.0, ge=0)
    clear_cover_override_mm: Optional[float] = Field(None, gt=0)

    @field_validator("exposure_class")
    @classmethod
    def _exposure(cls, v: str) -> str:
        key = (v or "").strip().upper()
        if key not in VALID_EXPOSURE:
            raise ValueError(
                f"Unsupported exposure class '{v}'. Expected one of: "
                + ", ".join(sorted(VALID_EXPOSURE))
            )
        return key


class ColPartialFactors(BaseModel):
    gamma_G: float = Field(1.35, gt=0)
    gamma_Q: float = Field(1.50, gt=0)
    gamma_c: float = Field(1.50, gt=0)
    gamma_s: float = Field(1.15, gt=0)
    alpha_cc: float = Field(0.85, gt=0, le=1.0)


class ColLevelSpec(BaseModel):
    """
    Per-storey overrides. Anything left None falls back to the column-wide
    value, so a request that sets none of these behaves exactly as before.
    """
    b_mm: Optional[float] = Field(None, gt=0)
    h_mm: Optional[float] = Field(None, gt=0)
    main_bar_dia_mm: Optional[float] = Field(None, gt=0)
    n_bars_total: Optional[int] = Field(None, ge=4)
    n_bars_b_face: Optional[int] = Field(None, ge=2)
    n_bars_h_face: Optional[int] = Field(None, ge=2)
    link_dia_mm: Optional[float] = Field(None, gt=0)
    storey_height_m: Optional[float] = Field(None, gt=0)
    floor: Optional[ColFloorTemplate] = None

    @field_validator("main_bar_dia_mm")
    @classmethod
    def _level_bar_min(cls, v):
        # Same rule as the base column. Without it a storey edited through
        # the API could carry a bar the base column would have refused.
        if v is not None and v < 12.0:
            raise ValueError(
                "Main bar diameter must be at least 12 mm for columns "
                "(UK National Annex to EN 1992-1-1, Cl. 9.5.2(1))."
            )
        return v

    @model_validator(mode="after")
    def _faces_together(self):
        if (self.n_bars_b_face is None) != (self.n_bars_h_face is None):
            raise ValueError(
                "Set both n_bars_b_face and n_bars_h_face for a level, or neither."
            )
        return self


class ColDesignBasis(BaseModel):
    """
    Optional names for the design summary a building control body asks for
    (City of London District Surveyor's guidance on structural calculations).

    All free text, all optional. They are printed on the report when given and
    printed as "not entered" when not. Nothing is ever filled in on the
    engineer's behalf: who designed and who checked is a statement the
    engineer makes, not something the software can supply.
    """
    designer_name: Optional[str] = Field(None, max_length=120)
    designer_qualifications: Optional[str] = Field(None, max_length=160)
    checked_by: Optional[str] = Field(None, max_length=120)
    checker_qualifications: Optional[str] = Field(None, max_length=160)
    stability_responsible: Optional[str] = Field(
        None, max_length=160,
        description="Organisation or individual with overall responsibility for "
                    "the stability of the structure.",
    )
    # Left None unless the designer says otherwise. The software never sets
    # this: whether an independent check is needed or has been done is the
    # designer's statement to make.
    independent_check: Optional[Literal["required", "completed"]] = None


class ColumnDesignRequest(BaseModel):
    column_id: str = "C1"
    column_type: ColumnType = ColumnType.BIAXIAL
    # Which axis a uniaxial column bends about. Ignored on the other routes.
    uniaxial_axis: UniaxialAxis = UniaxialAxis.X
    design_code: DesignCode = DesignCode.EC2
    design_basis: ColDesignBasis = ColDesignBasis()

    end_condition: EndCondition = EndCondition.FIXED_FIXED
    braced: bool = True

    geometry: ColGeometry = ColGeometry()
    effective_length: ColEffectiveLength = ColEffectiveLength()
    analysis: ColAnalysisOptions = ColAnalysisOptions()
    frame: ColFrameOptions = ColFrameOptions()

    # Per-storey edits, keyed by level name ("Roof", "Typical_Floor_3", ...).
    # Empty means one section and one cage for the whole column.
    levels: Dict[str, ColLevelSpec] = Field(default_factory=dict)

    crank_max_slope: float = Field(
        1.0 / 6.0, gt=0, le=1.0,
        description="Maximum bar crank slope (rise:run) allowed between storeys with "
                    "different sections. 1/6 is common UK detailing practice, not a "
                    "numbered EC2 clause -- widen it only where a shallower crank has "
                    "been checked separately.",
    )
    crank_zone_mm: float = Field(
        300.0, gt=0,
        description="Assumed vertical length available to form the crank, just above "
                    "the lap. A fixed assumption, not derived from storey height -- a "
                    "tall storey does not usually leave more room to crank in, since "
                    "the bars still need a straight run into the beam-column joint "
                    "above and out of the starter below. Raise it only where the "
                    "actual detail has been checked to allow more.",
    )
    reinforcement: ColReinforcement = ColReinforcement()
    materials: ColMaterials = ColMaterials()
    durability: ColDurability = ColDurability()
    factors: ColPartialFactors = ColPartialFactors()

    number_of_typical_floors: int = Field(3, ge=0, le=60)
    typical_floor: ColFloorTemplate = ColFloorTemplate()
    roof_floor: ColFloorTemplate = ColFloorTemplate(
        building_use="roof_no_access",
        finishes_kN_per_m2=0.75,
        services_kN_per_m2=0.25,
        partitions_kN_per_m2=0.0,
        beam_x=ColBeam(wall=ColWall(present=False)),
        beam_y=ColBeam(wall=ColWall(present=False)),
    )

    M01x_kNm: Dict[str, float] = Field(default_factory=dict)
    M02x_kNm: Dict[str, float] = Field(default_factory=dict)
    M01y_kNm: Dict[str, float] = Field(default_factory=dict)
    M02y_kNm: Dict[str, float] = Field(default_factory=dict)

    # Bypass the take-down and design from frame-analysis output directly.
    NEd_override_kN: Optional[float] = Field(None, gt=0)
    MEdx_override_kNm: Optional[float] = Field(None, ge=0)
    MEdy_override_kNm: Optional[float] = Field(None, ge=0)

    # ---------- cross-field validation ----------
    @model_validator(mode="after")
    def _design_code_is_implemented(self):
        """
        The engine implements EN 1992-1-1 and nothing else. It never reads
        design_code, so any other value would run the EC2 formulas and print
        the other code's name on the result. Building control asks that the
        analysis be compatible with the standard the design claims to use, so
        this is refused rather than relabelled. The beam schema does the same.
        """
        code = getattr(self.design_code, "value", self.design_code)
        if str(code).upper() != "EC2":
            raise ValueError(
                f"Design code '{code}' is not implemented for columns. Only EC2 "
                f"(EN 1992-1-1) is. Results would otherwise be calculated to "
                f"EC2 and labelled as {code}."
            )
        return self

    @model_validator(mode="after")
    def _bars_fit_in_section(self):
        """
        EN 1992-1-1 Cl. 8.2: clear horizontal spacing between bars must be at
        least max(bar diameter, 20 mm). Reject layouts that cannot physically
        be built rather than producing a design for an impossible cage.
        """
        geo, rf, dur = self.geometry, self.reinforcement, self.durability

        cover = dur.clear_cover_override_mm
        if cover is None:
            cover = 45.0  # upper-bound placeholder; engine derives the real value
        edge = cover + rf.link_dia_mm
        s_min = max(rf.main_bar_dia_mm, 20.0)

        n_b, n_h = rf.n_bars_b_face, rf.n_bars_h_face
        if n_b is None or n_h is None:
            total = rf.n_bars_total + (rf.n_bars_total % 2)
            s = total // 2 + 2
            n_h = max(2, min(s - 2, round(s * geo.h_mm / (geo.b_mm + geo.h_mm))))
            n_b = s - n_h

        for n, dim, label in ((n_b, geo.b_mm, "width b"), (n_h, geo.h_mm, "depth h")):
            if n < 2:
                continue
            needed = 2 * edge + n * rf.main_bar_dia_mm + (n - 1) * s_min
            if needed > dim:
                raise ValueError(
                    f"{n} bars of {rf.main_bar_dia_mm:.0f} mm will not fit across the "
                    f"{label} of {dim:.0f} mm. Minimum required is {needed:.0f} mm "
                    f"allowing cover, links and {s_min:.0f} mm clear spacing "
                    f"(EN 1992-1-1 Cl. 8.2). Increase the section, reduce the bar "
                    f"count, or use a smaller diameter."
                )
        return self

    @model_validator(mode="after")
    def _storey_sections_can_lap(self):
        """
        Column bars carry on from one storey to the next by lapping just above
        each floor. Where the section changes size, the bars cannot simply run
        straight through -- they have to be bent inward or outward ("cranked")
        to reach the new position, over a short length just above the lap.

        There is no single EC2 clause that sets a crank slope; the 1-in-6 limit
        used here is common UK column-detailing practice (see e.g. the
        Standard Method of Detailing). It is deliberately conservative and can
        be widened with crank_max_slope on a request where a shallower crank
        has been checked separately.

        This blocks a section step the bars cannot physically reach across in
        the assumed zone -- it does not forbid stepping the section, which is
        normal and often necessary going up a tall building.
        """
        g = self.geometry
        names = ["Roof"] + [f"Typical_Floor_{i}"
                            for i in range(self.number_of_typical_floors, 0, -1)]
        if len(names) < 2:
            return self

        def eff(name):
            sp = self.levels.get(name)
            b = sp.b_mm if (sp and sp.b_mm is not None) else g.b_mm
            h = sp.h_mm if (sp and sp.h_mm is not None) else g.h_mm
            sh = sp.storey_height_m if (sp and sp.storey_height_m is not None) else g.storey_height_m
            return b, h, sh

        slope = self.crank_max_slope
        for i in range(len(names) - 1):
            b_a, h_a, _ = eff(names[i])
            b_b, h_b, _sh_b = eff(names[i + 1])  # storey height not used in the zone assumption
            if b_a == b_b and h_a == h_b:
                continue
            available_mm = self.crank_zone_mm
            for axis, dim_a, dim_b in (("b", b_a, b_b), ("h", h_a, h_b)):
                offset = abs(dim_b - dim_a) / 2.0
                if offset < 1e-6:
                    continue
                required_mm = offset / slope
                if required_mm > available_mm:
                    raise ValueError(
                        f"{names[i]} ({b_a:.0f}x{h_a:.0f}) to {names[i + 1]} "
                        f"({b_b:.0f}x{h_b:.0f}): the {axis} face moves "
                        f"{offset:.0f} mm, needing a crank at least "
                        f"{required_mm:.0f} mm long at a {slope:.3f} slope. "
                        f"Only about {available_mm:.0f} mm is assumed available "
                        f"in {names[i + 1]}'s storey height. Step the section "
                        f"more gradually, or raise crank_max_slope if a "
                        f"shallower crank has been checked separately."
                    )
        return self

    @model_validator(mode="after")
    def _bar_diameter_non_decreasing(self):
        """
        A lap is limited by its weaker bar, so standard detailing does not let
        the main bar diameter drop going down a building: the storey above
        must not ask for a bigger bar than the one below it provides.

        Only applies when autosize is off. With it on, diameters are chosen by
        the engine at run time and continuity is enforced there instead (see
        ColumnEngine.autosize_level), because the value being checked does not
        exist yet at request time.
        """
        if self.analysis.autosize_bars:
            return self
        names = ["Roof"] + [f"Typical_Floor_{i}"
                            for i in range(self.number_of_typical_floors, 0, -1)]
        if len(names) < 2:
            return self

        def dia(name):
            sp = self.levels.get(name)
            return sp.main_bar_dia_mm if (sp and sp.main_bar_dia_mm is not None) \
                else self.reinforcement.main_bar_dia_mm

        prev_name, prev_dia = names[0], dia(names[0])
        for name in names[1:]:
            this_dia = dia(name)
            if this_dia < prev_dia:
                raise ValueError(
                    f"{name} specifies Y{this_dia:.0f}, smaller than Y{prev_dia:.0f} "
                    f"on {prev_name} above it. A lap is limited by its weaker bar, so "
                    f"the main bar diameter must not decrease going down the "
                    f"building. Raise {name}'s bar diameter to at least "
                    f"Y{prev_dia:.0f}, or increase it on {prev_name} instead if "
                    f"that storey was meant to match."
                )
            prev_name, prev_dia = name, this_dia
        return self

    def _level_names(self):
        return ["Roof"] + [f"Typical_Floor_{i}"
                           for i in range(self.number_of_typical_floors, 0, -1)]

    def _faces_at(self, name):
        """
        (n_b_face, n_h_face, set_by_hand, b, h, n_total) for one storey, after
        inheritance.

        set_by_hand says the split came from the request rather than from the
        engine's distribution, which matters because a hand-set split is not
        touched by auto-size.
        """
        g, rf = self.geometry, self.reinforcement
        sp = self.levels.get(name)
        b = sp.b_mm if (sp and sp.b_mm is not None) else g.b_mm
        h = sp.h_mm if (sp and sp.h_mm is not None) else g.h_mm
        n_b = sp.n_bars_b_face if sp else None
        n_h = sp.n_bars_h_face if sp else None
        by_hand = n_b is not None and n_h is not None
        if not by_hand:
            n_b, n_h = rf.n_bars_b_face, rf.n_bars_h_face
            by_hand = n_b is not None and n_h is not None
        n_total = (sp.n_bars_total if (sp and sp.n_bars_total is not None)
                   else rf.n_bars_total)
        n_b, n_h = _effective_faces(b, h, n_total, n_b, n_h)
        return n_b, n_h, by_hand, b, h, n_total

    @model_validator(mode="after")
    def _level_bars_fit_in_section(self):
        """
        EN 1992-1-1 Cl. 8.2 again, this time per storey.

        _bars_fit_in_section checks the base column only. Once a storey can
        carry its own face split, a cage that cannot physically be tied can
        be entered on a storey whose section is smaller than the base one,
        and nothing downstream catches it: design_level checks capacity, not
        buildability.

        Only storeys actually edited are checked, so this cannot newly reject
        a request that sets no per-storey values. With auto-size on, a storey
        whose bars the engine will choose is skipped -- the entered count is a
        starting point there, not the cage.
        """
        g, rf, dur = self.geometry, self.reinforcement, self.durability
        cover = dur.clear_cover_override_mm
        if cover is None:
            cover = 45.0  # upper-bound placeholder; engine derives the real value

        for name, sp in self.levels.items():
            touched = any(v is not None for v in (
                sp.b_mm, sp.h_mm, sp.main_bar_dia_mm, sp.n_bars_total,
                sp.n_bars_b_face, sp.n_bars_h_face, sp.link_dia_mm))
            if not touched:
                continue
            by_hand = sp.n_bars_b_face is not None and sp.n_bars_h_face is not None
            if self.analysis.autosize_bars and not by_hand:
                continue

            b = sp.b_mm if sp.b_mm is not None else g.b_mm
            h = sp.h_mm if sp.h_mm is not None else g.h_mm
            dia = sp.main_bar_dia_mm if sp.main_bar_dia_mm is not None \
                else rf.main_bar_dia_mm
            link = sp.link_dia_mm if sp.link_dia_mm is not None else rf.link_dia_mm
            n_b, n_h, *_ = self._faces_at(name)

            edge = cover + link
            s_min = max(dia, 20.0)
            for n, dim, label in ((n_b, b, "width b"), (n_h, h, "depth h")):
                if n < 2:
                    continue
                needed = 2 * edge + n * dia + (n - 1) * s_min
                if needed > dim:
                    raise ValueError(
                        f"{name}: {n} bars of {dia:.0f} mm will not fit across the "
                        f"{label} of {dim:.0f} mm. Minimum required is {needed:.0f} mm "
                        f"allowing cover, links and {s_min:.0f} mm clear spacing "
                        f"(EN 1992-1-1 Cl. 8.2). Reduce that face's bar count on "
                        f"{name}, use a smaller diameter, or widen the section."
                    )
        return self

    @model_validator(mode="after")
    def _bar_count_per_face_non_decreasing(self):
        """
        Every bar laps into a bar in the storey below, so a face that loses a
        bar going down the building leaves the extra bar above it with nothing
        to continue into.

        Same detailing principle as _bar_diameter_non_decreasing, applied to
        the count rather than the size. Note the count can drop without anyone
        typing it: the engine puts more bars on the longer face, so a storey
        that widens redistributes the same total and can end up with fewer on
        one face.

        Skipped when auto-size is on, because the counts it will choose do not
        exist yet at request time; ColumnEngine.autosize_level carries the
        face counts down instead, and checks a hand-set storey against them.
        """
        if self.analysis.autosize_bars:
            return self
        names = self._level_names()
        if len(names) < 2:
            return self

        prev_name = names[0]
        prev_b, prev_h, prev_hand, prev_bb, prev_hh, prev_total = self._faces_at(prev_name)
        for name in names[1:]:
            n_b, n_h, by_hand, bb, hh, n_total = self._faces_at(name)
            for face, above, below in (("b", prev_b, n_b), ("h", prev_h, n_h)):
                if below >= above:
                    continue
                if by_hand:
                    raise ValueError(
                        f"{name} has {below} bars on each {face}-face, fewer than the "
                        f"{above} on {prev_name} above it. A lap needs a bar beneath "
                        f"each bar it continues from, so the count on a face must not "
                        f"decrease going down the building. Raise {name}'s {face}-face "
                        f"count to at least {above}, or lower it on {prev_name} if that "
                        f"storey was the one meant to change."
                    )
                # Nobody typed a face split on THIS storey, so the engine
                # spread its total by the section shape. Name what actually
                # produced the shortfall, because it is one of three different
                # things and a wrong explanation sends the engineer to the
                # wrong field.
                if prev_hand:
                    cause = "that split was set by hand on the storey above"
                elif abs(bb - prev_bb) > 1e-6 or abs(hh - prev_hh) > 1e-6:
                    cause = (f"the section changes from {prev_bb:.0f}x{prev_hh:.0f} on "
                             f"{prev_name} to {bb:.0f}x{hh:.0f} here, which moves bars "
                             f"between faces")
                else:
                    cause = (f"it carries {prev_total} bars against {n_total} here")
                fix = _smallest_total_keeping(bb, hh, prev_b, prev_h, n_total)
                suggestion = (
                    f"Raise the number of bars on {name} to {fix[0]} "
                    f"(that gives {fix[1]} per b-face and {fix[2]} per h-face), "
                    f"or tick 'Set bars per face manually' for {name} and set the "
                    f"faces yourself."
                    if fix else
                    f"Tick 'Set bars per face manually' for {name} and set the "
                    f"faces yourself."
                )
                raise ValueError(
                    f"{name}: {n_total} bars on its {bb:.0f}x{hh:.0f} section spread as "
                    f"{n_b} per b-face and {n_h} per h-face, but {prev_name} above has "
                    f"{prev_b} and {prev_h}: {cause}. The {face}-face now has {below} "
                    f"where {above} sit above it. A lap needs a bar beneath each bar it "
                    f"continues from, so a face cannot lose a bar going down the "
                    f"building. {suggestion}"
                )
            prev_name, prev_b, prev_h = name, n_b, n_h
            prev_hand, prev_bb, prev_hh, prev_total = by_hand, bb, hh, n_total
        return self

    @model_validator(mode="after")
    def _levels_known(self):
        if not self.levels:
            return self
        valid = {"Roof"} | {f"Typical_Floor_{i}"
                            for i in range(1, self.number_of_typical_floors + 1)}
        unknown = sorted(set(self.levels) - valid - {"Design"})
        if unknown:
            raise ValueError(
                f"Unknown level name(s): {', '.join(unknown)}. Expected "
                f"'Roof' or 'Typical_Floor_1'..'Typical_Floor_"
                f"{self.number_of_typical_floors}'."
            )
        return self

    @model_validator(mode="after")
    def _tributary_present(self):
        if self.NEd_override_kN is not None:
            return self
        g = self.geometry
        if (g.left_x_m + g.right_x_m) <= 0 or (g.top_y_m + g.bottom_y_m) <= 0:
            raise ValueError(
                "Tributary spans must be greater than zero in both directions "
                "when the load take-down is used. Supply NEd_override_kN "
                "instead if you already have the axial load."
            )
        return self

    @model_validator(mode="after")
    def _moments_match_route(self):
        if self.column_type == ColumnType.AXIAL:
            return self
        if self.frame.derive_moments:
            # The sub-frame produces them; demanding them as input would
            # defeat the point of deriving them.
            return self
        if self.column_type == ColumnType.UNIAXIAL:
            ax = self.uniaxial_axis.value
            src = self.M02x_kNm if ax == "x" else self.M02y_kNm
            ovr = self.MEdx_override_kNm if ax == "x" else self.MEdy_override_kNm
            if not src and ovr is None:
                raise ValueError(
                    f"A uniaxial column bending about {ax} needs first order moments "
                    f"about {ax}. Supply M02{ax}_kNm per level, or MEd{ax}_override_kNm, "
                    "or switch the column type to 'axial' for a minimum-eccentricity "
                    "design."
                )
        if self.column_type == ColumnType.BIAXIAL:
            has_x = bool(self.M02x_kNm) or self.MEdx_override_kNm is not None
            if not has_x:
                raise ValueError(
                    "A biaxial column needs first order moments about x. Supply "
                    "M02x_kNm per level, or MEdx_override_kNm."
                )
        if self.column_type == ColumnType.BIAXIAL:
            has_y = bool(self.M02y_kNm) or self.MEdy_override_kNm is not None
            if not has_y:
                raise ValueError(
                    "A biaxial column needs first order moments about y. Supply "
                    "M02y_kNm per level, or MEdy_override_kNm, or switch the "
                    "column type to 'uniaxial'."
                )
        return self


# ============================================================
# RESPONSE
# ============================================================

class ReportRow(BaseModel):
    reference: str
    calculation: str
    output: str


class ReportSection(BaseModel):
    title: str
    rows: List[ReportRow]


class ColSecondOrder(BaseModel):
    omega: float
    n: float
    n_u: float
    Kr: float
    beta: float
    Kphi: float
    d_eff: float
    inv_r0: float
    inv_r: float
    e2_mm: float
    M2_kNm: float


class ColAxisResult(BaseModel):
    lambda_: float = Field(..., alias="lambda")
    lambda_lim: float
    slender: bool
    l0_mm: float
    l0_source: str
    M01: float
    M02: float
    M0e: float
    ei_mm: float
    M_imp: float
    M_end: float
    M_eq: float
    M_min: float
    M_first: float
    M2: float
    MEd: float
    MRd: float
    second_order: ColSecondOrder
    utilisation: float

    model_config = {"populate_by_name": True}


class ColBiaxial(BaseModel):
    a: float
    N_ratio: float
    interaction: float


class ColCheck(BaseModel):
    name: str
    passed: bool = Field(..., alias="pass")

    model_config = {"populate_by_name": True}


class ColInteractionPoint(BaseModel):
    N_kN: float
    M_kNm: float
    x_mm: float


class ColDetailing(BaseModel):
    phi_t_min_mm: float
    link_dia_mm: float
    s_max_mm: float
    s_reduced_mm: float
    As_provided_mm2: float
    As_min_mm2: float
    As_min_basis_1_mm2: float
    As_min_basis_2_mm2: float
    As_max_mm2: float
    rho_pct: float
    n_bars_b_face: int
    n_bars_h_face: int
    d_prime_mm: float
    Ac_mm2: float


class ColLevelResult(BaseModel):
    level: str
    NEd_kN: float
    # This storey's own section and cage. With no per-level edits these are
    # the same on every level.
    b_mm: float
    h_mm: float
    bar_dia_mm: float
    n_bars: int
    link_dia_mm: float
    As_provided_mm2: float
    cover_mm: float
    rho_pct: float
    x: ColAxisResult
    y: ColAxisResult
    NRd_max_kN: float
    NRd_simplified_kN: float
    axial_utilisation: float
    biaxial: Optional[ColBiaxial] = None
    governing_utilisation: float
    As_min: float
    As_min_basis_1: float
    As_min_basis_2: float
    checks: List[ColCheck]
    autosize: Optional[ColAutosize] = None
    detailing: ColDetailing
    interaction_x: List[ColInteractionPoint]
    interaction_y: List[ColInteractionPoint]
    status: str


class ColSummary(BaseModel):
    column_id: str
    column_type: str
    uniaxial_axis: Optional[str] = None
    design_code: str
    b_mm: float
    h_mm: float
    storey_height_m: float
    end_condition: str
    braced: bool
    concrete_grade: str
    steel_grade: str
    exposure_class: str
    cover_mm: float
    n_bars: int
    bar_dia_mm: float
    link_dia_mm: float
    As_provided_mm2: float
    critical_level: str
    NEd_critical_kN: float
    used_takedown: bool
    status: str


class ColMaterialsOut(BaseModel):
    fck: float
    fcd: float
    fyk: float
    fyd: float
    eps_cu3: float
    eps_c3: float
    lambda_block: float
    eta_block: float


class ColReportMeta(BaseModel):
    product: str
    title: str
    software_version: str
    build: str
    calculation_id: str
    generated_utc: str


class ColumnDesignResult(BaseModel):
    summary: ColSummary
    materials: ColMaterialsOut
    axial_by_level: Dict[str, float]
    levels: List[ColLevelResult]
    detailing: ColDetailing
    interaction_x: List[ColInteractionPoint]
    interaction_y: List[ColInteractionPoint]
    failed_checks: List[str]
    report_meta: Optional[ColReportMeta] = None
    report: List[ReportSection]
    bar_detailing: Optional[Dict] = None   # engine/member_detailing.py: marks, schedule, drawing
