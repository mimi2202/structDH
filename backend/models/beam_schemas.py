# backend/models/beam_schemas.py
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict
from enum import Enum
from models.schemas import DesignCode  # reuse EC2 / BS8110 / ACI318

class BeamSupport(str, Enum):
    BOTH_SIMPLE = "both_ends_simply_supported"
    BOTH_FIXED = "both_ends_fixed"
    ONE_FIXED_ONE_SIMPLE = "one_fixed_one_simple"
    CANTILEVER = "one_fixed_one_free"

class BeamTopRestraint(str, Enum):
    CONTINUOUS = "continuous"
    ONE_END_DISCONTINUOUS = "one_end_discontinuous"
    BOTH_ENDS_DISCONTINUOUS = "both_ends_discontinuous"

# ---------- request ----------
class BeamGeometry(BaseModel):
    span: float = Field(..., gt=0, description="mm")
    width: float = Field(..., gt=0, description="mm")
    depth: float = Field(..., gt=0, description="mm")
    effective_cover: float = Field(25, gt=0, description="mm")
    slab_thickness: float = Field(0, ge=0, description="mm (flange thickness for T-beam; 0 = rectangular)")
    left_adjacent_spacing: float = Field(0, ge=0, description="mm (c/c to adjacent beam, left; 0 = no flange)")
    right_adjacent_spacing: float = Field(0, ge=0, description="mm (c/c to adjacent beam, right; 0 = no flange)")

class BeamMaterials(BaseModel):
    concrete_grade: str = "C25/30"
    steel_grade: str = "B500"
    unit_weight_concrete: float = 25.0
    unit_weight_steel: float = 78.5

class BeamLoads(BaseModel):
    self_weight_auto: bool = True
    wall_load: float = Field(0, ge=0, description="kN/m")
    finishes: float = Field(0, ge=0, description="kN/m")
    additional_dead_load: float = Field(0, ge=0, description="kN/m")
    live_load: float = Field(0, ge=0, description="kN/m")
    other_live_load: float = Field(0, ge=0, description="kN/m")

class BeamDesignRequest(BaseModel):
    beam_id: str = "B1"
    design_code: DesignCode = DesignCode.EC2
    support_condition: BeamSupport = BeamSupport.BOTH_SIMPLE
    top_restraint: BeamTopRestraint = BeamTopRestraint.CONTINUOUS
    geometry: BeamGeometry
    materials: BeamMaterials
    loads: BeamLoads
    bar_diameters: Optional[List[int]] = Field([16, 20, 25, 32])
    link_diameter: int = 8
    region: str = "Nigeria"

    @model_validator(mode="after")
    def check_design_code_supported(self):
        code = self.design_code.value if hasattr(self.design_code, "value") else self.design_code
        if code != "EC2":
            raise ValueError(
                f"Design code '{code}' is not yet available for beams -- only EC2 (EN 1992-1-1) is "
                f"fully implemented. BS8110 and ACI318 selections currently either crash or silently "
                f"reuse the EC2 formulas under the wrong label, neither of which is safe to rely on. "
                f"Please select EC2 for now."
            )
        return self

# ---------- response ----------
class BeamForces(BaseModel):
    design_udl: float        # kN/m
    max_moment: float        # kNm
    max_shear: float         # kN
    ultimate_combo: str

class BeamCapacity(BaseModel):
    moment_resistance: float     # kNm
    shear_resistance: float      # kN
    utilization_bending: float
    utilization_shear: float

class BeamFlexureDetail(BaseModel):
    """Structured flexural derivation, matching the level of detail already
    shown for slabs (K/z/As substitution), instead of only being buried as
    formatted text inside the report array."""
    K: float
    K_balanced: float             # 0.167 EC2 / 0.156 BS8110
    z_mm: float
    beff_mm: float
    is_t_beam: bool
    neutral_axis_mm: float
    neutral_axis_in_flange: bool
    as_min_mm2: float

class BeamShearDetail(BaseModel):
    """Structured shear derivation (EC2 §6.2.2 term-by-term), matching the
    slab Shear Design tab's depth."""
    rho_l: float
    k_factor: float
    C_Rdc: float
    v_min_mpa: float
    v_rdc_mpa: float
    v_ed_mpa: float
    links_required: bool

class BeamDeflectionDetail(BaseModel):
    """Structured deflection derivation (EC2 §7.4.2, two-stage), matching
    the slab Deflection tab's depth."""
    rho: float
    rho0: float
    K_sys: float
    ld_basic: float
    base_status: str
    F3: float
    enhanced: bool

class BeamReinforcement(BaseModel):
    tension: Dict       # {count, bar_diameter, area_required, area_provided, label}
    compression: Dict
    stirrups: Dict      # {bar_diameter, spacing, legs, label}
    cover: float

class BeamSLS(BaseModel):
    deflection_actual: float
    deflection_limit: float
    deflection_status: str
    crack_width: float
    crack_limit: float
    crack_status: str

class BeamLoadSummary(BaseModel):
    components: List[Dict]   # [{name, kind(DL/LL), value}]
    total_dead: float
    total_live: float
    total_service: float

class BeamMaterialsOut(BaseModel):
    fck: float
    fcd: float
    fyk: float
    fyd: float
    modular_ratio: float
    unit_weight_concrete: float

class BeamSummary(BaseModel):
    beam_id: str
    support_condition: str
    top_restraint: str
    span: float
    width: float
    depth: float
    effective_depth: float
    effective_cover: float
    concrete_grade: str
    steel_grade: str
    design_code: str
    analysis: str
    status: str

class ReportRow(BaseModel):
    reference: str
    calculation: str
    output: str

class ReportSection(BaseModel):
    title: str
    rows: List[ReportRow]

class BeamDesignResult(BaseModel):
    summary: BeamSummary
    materials: BeamMaterialsOut
    loads: BeamLoadSummary
    forces: BeamForces
    capacity: BeamCapacity
    reinforcement: BeamReinforcement
    sls: BeamSLS
    flexure_detail: Optional[BeamFlexureDetail] = None
    shear_detail: Optional[BeamShearDetail] = None
    deflection_detail: Optional[BeamDeflectionDetail] = None
    notes: List[str]
    report: List[ReportSection] = []