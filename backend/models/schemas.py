# backend/models/schemas.py
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Union, Literal
from enum import Enum

class SlabType(str, Enum):
    ONE_WAY = "one_way"
    TWO_WAY = "two_way"

class ContinuityCondition(str, Enum):
    ALL_EDGES_DISCONTINUOUS = "all_edges_discontinuous"   # SSSS -- simply supported on all four edges, no continuity
    ALL_EDGES_CONTINUOUS = "all_edges_continuous"
    ONE_SHORT_DISCONTINUOUS = "one_short_discontinuous"
    ONE_LONG_DISCONTINUOUS = "one_long_discontinuous"
    TWO_ADJACENT_DISCONTINUOUS = "two_adjacent_discontinuous"
    TWO_SHORT_DISCONTINUOUS = "two_short_discontinuous"
    TWO_LONG_DISCONTINUOUS = "two_long_discontinuous"
    THREE_EDGES_ONE_LONG_CONTINUOUS = "three_edges_one_long_continuous"
    THREE_EDGES_ONE_SHORT_CONTINUOUS = "three_edges_one_short_continuous"

class OneWayContinuity(str, Enum):
    SIMPLY_SUPPORTED = "simply_supported"
    ONE_END_CONTINUOUS = "one_end_continuous"
    BOTH_ENDS_CONTINUOUS = "both_ends_continuous"
    CANTILEVER = "cantilever"

class DesignCode(str, Enum):
    EC2 = "EC2"
    BS8110 = "BS8110"
    ACI318 = "ACI318"

class AnalysisMethod(str, Enum):
    LIMIT_STATE = "limit_state"
    WORKING_STRESS = "working_stress"
    ELASTIC = "elastic"

class ExposureClass(str, Enum):
    XC1 = "XC1"
    XC2 = "XC2"
    XC3 = "XC3"
    XC4 = "XC4"

# ============ REQUEST MODELS ============

class GeometryInput(BaseModel):
    span_lx: float = Field(..., gt=0, description="Short span in meters")
    span_ly: float = Field(..., gt=0, description="Long span in meters")
    thickness: float = Field(..., gt=0, description="Slab thickness in mm")
    effective_depth: Optional[float] = Field(None, description="Deprecated: derived from geometry (bar + cover)")
    clear_cover: float = Field(25, ge=0, description="Clear cover in mm (0 is valid -- a fixed 5mm detailing tolerance is always added on top)")

class MaterialInput(BaseModel):
    concrete_grade: str = Field(..., description="e.g., C30/37")
    steel_grade: str = Field(..., description="e.g., B500")
    unit_weight_concrete: float = Field(25.0, description="kN/m³")
    unit_weight_steel: float = Field(78.5, description="kN/m³")

class LoadInput(BaseModel):
    dead_load: float = Field(0, ge=0, description="Additional dead load in kN/m²")
    floor_finish: float = Field(0, ge=0, description="Floor finish load in kN/m²")
    live_load: float = Field(0, ge=0, description="Live load in kN/m²")
    additional_dead_load: float = Field(0, ge=0, description="Additional dead load in kN/m²")
    additional_live_load: float = Field(0, ge=0, description="Additional live load in kN/m²")

class DesignParameters(BaseModel):
    design_code: DesignCode = DesignCode.EC2
    analysis_method: AnalysisMethod = AnalysisMethod.LIMIT_STATE
    exposure_class: ExposureClass = ExposureClass.XC3
    fire_rating: int = Field(60, description="Fire rating in minutes")
    crack_width_limit: float = Field(0.3, description="Crack width limit in mm")
    deflection_limit: int = Field(250, description="Deflection limit as L/?")

class SlabDesignBasis(BaseModel):
    """
    Printed on the first page of the Detailed Report. All optional and all
    free text: who designed, who checked, and whether an independent check
    is required or done are the designer's own statements -- nothing here is
    inferred or filled in automatically. Left blank, the report says
    "not entered" rather than silently omitting the row.
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
    independent_check: Optional[Literal["required", "completed"]] = None

class SlabDesignRequest(BaseModel):
    slab_type: SlabType
    # Accepts either the two-way set or the one-way set; validated against slab_type below.
    continuity: Union[ContinuityCondition, OneWayContinuity]
    geometry: GeometryInput
    materials: MaterialInput
    loads: LoadInput
    design_params: DesignParameters
    bar_diameters: Optional[List[int]] = Field([10, 12, 16], description="Bar diameters to try in mm")
    thickness_options: Optional[List[float]] = Field(None, description="Alternative thicknesses to try in mm")
    use_ai: bool = Field(False, description="Enable AI recommendation")
    region: str = Field("UK", description="Region for cost rates")
    building_use: str = Field("office", description="Occupancy for two-way EC2 engine presets / auto-loads")
    design_basis: SlabDesignBasis = SlabDesignBasis()

    @model_validator(mode="after")
    def check_continuity_matches_type(self):
        one_way_vals = {c.value for c in OneWayContinuity}
        two_way_vals = {c.value for c in ContinuityCondition}
        val = self.continuity.value if hasattr(self.continuity, "value") else self.continuity
        if self.slab_type == SlabType.ONE_WAY and val not in one_way_vals:
            raise ValueError(f"one_way slab requires continuity in {sorted(one_way_vals)}")
        if self.slab_type == SlabType.TWO_WAY and val not in two_way_vals:
            raise ValueError(f"two_way slab requires continuity in {sorted(two_way_vals)}")
        return self

    @model_validator(mode="after")
    def check_lx_ly_order(self):
        # Lx is always the short span, Ly always the long span. A two-way
        # panel with Lx > Ly is either a data-entry mistake or the axes are
        # swapped -- catch it here with a clear message rather than letting
        # it fail deep inside the engine (or silently produce wrong moments).
        if self.slab_type == SlabType.TWO_WAY and self.geometry.span_lx > self.geometry.span_ly:
            raise ValueError(
                f"span_lx ({self.geometry.span_lx} m) must not be greater than span_ly "
                f"({self.geometry.span_ly} m). Lx is always the short span and Ly the long span -- "
                f"swap the values if the short span is actually the larger number you entered."
            )
        return self

    @model_validator(mode="after")
    def check_design_code_disabled(self):
        """
        BS8110 and ACI318 are both blocked here, for two different reasons.

        BS8110 used to run a separate, simplified formula set in
        slab_service.py's non-EC2 fallback branch -- fixed effective depth
        instead of the iterative bar-diameter convergence the EC2 engines do,
        and a generic deflection check rather than full EC2 Cl. 7.4.2. That
        branch was removed on 2026-10-03, so there is no BS8110 slab path at
        all; this validator is what stops such a request.

        ACI318 is worse: slab_service.py only branches on an `is_bs` flag
        that is True for BS8110 and nothing else, so an ACI318 request falls
        into the SAME branch as EC2 and silently runs the EC2 K/z/As/shear
        formulas -- while the response's code_label separately prints
        "ACI 318" over that EC2 result. Disabled until a real, reviewed
        ACI 318 path exists; this is not a maturity gap, it is a design
        calculated to one code and labelled as another.
        """
        code = self.design_params.design_code
        code = code.value if hasattr(code, "value") else code
        if code == "BS8110":
            raise ValueError(
                "BS8110 is not available for slabs yet -- it runs a simplified "
                "formula set that has not been reviewed to the same standard as "
                "the EC2 engines. Please select EC2 for now."
            )
        if code == "ACI318":
            raise ValueError(
                "ACI318 is not available for slabs -- a request under this code "
                "currently runs the EC2 formulas and labels the result ACI 318, "
                "which is wrong, not just unreviewed. Please select EC2 for now."
            )
        return self

# ============ RESPONSE MODELS ============

class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str

class DesignSummary(BaseModel):
    status: str  # PASS, FAIL
    slab_type: str
    continuity: str
    span_lx: float
    span_ly: Optional[float] = None  # one-way slabs have no meaningful Ly -- omit it in the output
    thickness: float
    effective_depth: Optional[float] = None
    clear_cover: Optional[float] = None  # the actual cover used (clear cover input + fixed 5mm tolerance)
    concrete_grade: str
    steel_grade: str
    selected_bar_diameter: int
    selected_spacing: int
    total_cost: float
    optimization_rank: int
    utilization_ratio: float

class DesignForces(BaseModel):
    max_sagging_moment: float  # kNm/m
    max_hogging_moment: float  # kNm/m
    max_shear_force: float     # kN/m
    ultimate_load: float       # kN/m²
    service_load: float        # kN/m²

class ReinforcementDetails(BaseModel):
    bottom_steel: Dict
    top_steel: Dict

class DeflectionResult(BaseModel):
    actual_deflection: float
    allowable_deflection: float
    status: str
    ratio: float

class ShearResult(BaseModel):
    design_shear: float
    shear_resistance: float
    status: str
    ratio: float

class ComplianceCheck(BaseModel):
    check: str
    status: str
    ratio: float
    limit: float
    note: Optional[str] = None

class CostBreakdown(BaseModel):
    concrete: Dict
    steel: Dict
    formwork: Dict
    total: float
    total_per_sqm: float

class OptimizationOption(BaseModel):
    rank: int
    thickness: float
    bar_diameter: int
    spacing: int
    cost: float
    status: str
    utilization_ratio: float

class ReportRow(BaseModel):
    reference: str
    calculation: str
    output: str

class ReportSection(BaseModel):
    title: str
    rows: List[ReportRow]

class SlabDesignResult(BaseModel):
    task_id: str
    status: str
    summary: DesignSummary
    design_forces: DesignForces
    reinforcement: ReinforcementDetails
    deflection: DeflectionResult
    shear: ShearResult
    compliance: List[ComplianceCheck]
    cost_breakdown: CostBreakdown
    optimization_options: List[OptimizationOption]
    report: List[ReportSection] = []

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # pending, running, completed, failed
    progress: float = 0
    result: Optional[SlabDesignResult] = None
    error: Optional[str] = None


# ============ CONTINUOUS ONE-WAY SLAB (multi-span) ============

class SupportType(str, Enum):
    PINNED = "pinned"
    FIXED = "fixed"

class ContinuousSlabRequest(BaseModel):
    span_lengths: List[float] = Field(..., min_length=1, description="Span lengths in metres (left to right)")
    start_support: SupportType = SupportType.PINNED
    end_support: SupportType = SupportType.PINNED
    geometry_thickness: float = Field(..., gt=0, description="Slab thickness in mm")
    clear_cover: float = Field(25, ge=0, description="Clear cover in mm (0 is valid -- a fixed 5mm detailing tolerance is always added on top)")
    materials: MaterialInput
    loads: LoadInput
    design_params: DesignParameters
    bar_diameters: Optional[List[int]] = Field([10, 12, 16])
    region: str = Field("UK")
    occupancy: Optional[str] = None   # sets psi_2 for the crack check; None = not stated (psi_2 = 0.6 assumed)
    design_basis: SlabDesignBasis = SlabDesignBasis()

    @model_validator(mode="after")
    def check_spans(self):
        if any(s <= 0 for s in self.span_lengths):
            raise ValueError("All span lengths must be > 0")
        # A one-way slab spanning more than ~4.5m stops being economical --
        # deflection typically governs and fails well before bending does
        # (see the 5-span worked example: a 6.0m span fails deflection at
        # 48.0 actual vs 25.18 allowable L/d, while every span <= 4.5m passes).
        # Beyond this, a two-way slab, a beam-and-slab system, or a flat slab
        # is the more sensible choice -- flag it here rather than silently
        # producing a design that's technically compliant but impractical.
        oversized = [s for s in self.span_lengths if s > 4.5]
        if oversized:
            raise ValueError(
                f"Span length(s) {oversized} m exceed the practical one-way slab limit of 4.5 m. "
                f"Spans beyond 4.5 m are not economical as a one-way slab -- deflection governs and "
                f"typically fails well before bending does. Consider a two-way slab, beam-and-slab "
                f"system, or flat slab for this span instead."
            )
        return self
    @model_validator(mode="after")
    def check_design_code_disabled(self):
        """
        continuous_slab_service.py has no code branching at all: every
        request runs through the one EC2 continuous engine regardless of
        design_code, and DesignSummary has no design_code field to even
        print a (correct or incorrect) label. BS8110 and ACI318 are both
        blocked here for the identical reason -- there is no separate path
        for either, so selecting one currently produces a silent EC2 design
        with nothing on the output to say so.
        """
        code = self.design_params.design_code
        code = code.value if hasattr(code, "value") else code
        if code in ("BS8110", "ACI318"):
            raise ValueError(
                f"{code} is not available for continuous slabs -- there is no "
                f"{code} calculation path; a request under this code would "
                f"silently run the EC2 continuous engine with nothing on the "
                f"output to indicate that. Please select EC2 for now."
            )
        return self


class SpanDesignOut(BaseModel):
    index: int
    length: float
    max_sagging_moment: float        # kNm/m
    area_required: float
    area_provided: float
    bar_diameter: int
    spacing: int
    status: str

class SupportDesignOut(BaseModel):
    index: int
    position: str
    hogging_moment: float            # kNm/m (magnitude)
    shear: float                     # kN/m (peak shear at the support face)
    shear_reduced: float = 0.0       # kN/m (design shear at d from face, EC2 6.2.1(8))
    area_required: float
    area_provided: float
    bar_diameter: int
    spacing: int
    status: str

class EnvelopeOut(BaseModel):
    max_sagging_moment: float
    max_hogging_moment: float
    max_shear_force: float
    ultimate_load: float
    service_load: float

class DiagramOut(BaseModel):
    x: List[float]                   # metres along beam
    bmd: List[float]                 # kNm/m
    sfd: List[float]                 # kN/m

class ContinuousSlabResult(BaseModel):
    task_id: str
    status: str
    summary: DesignSummary
    envelope: EnvelopeOut
    spans: List[SpanDesignOut]
    supports: List[SupportDesignOut]
    deflection: DeflectionResult
    shear: ShearResult
    compliance: List[ComplianceCheck]
    cost_breakdown: CostBreakdown
    diagram: DiagramOut
    report: List[ReportSection] = []