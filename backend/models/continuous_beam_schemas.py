# backend/models/continuous_beam_schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from models.schemas import DesignCode


class CBGeometry(BaseModel):
    n_spans: int = Field(..., ge=2, le=8)
    span_lengths: List[float] = Field(..., description="mm, one per span")
    width: float = Field(..., gt=0, description="mm")
    depth: float = Field(..., gt=0, description="mm")
    effective_depth: Optional[float] = Field(None, gt=0)
    cover: float = Field(25, gt=0)


class CBMaterials(BaseModel):
    concrete_grade: str = "C25/30"
    steel_grade: str = "B500"
    unit_weight_concrete: float = 25.0
    unit_weight_steel: float = 78.5


class CBLoads(BaseModel):
    self_weight_auto: bool = True
    wall_load: float = Field(0, ge=0)
    finishes: float = Field(0, ge=0)
    additional_dead_load: float = Field(0, ge=0)
    live_load: float = Field(0, ge=0)
    other_live_load: float = Field(0, ge=0)


class CBSpanLoad(BaseModel):
    index: int
    wall_load: Optional[float] = None
    finishes: Optional[float] = None
    additional_dead_load: Optional[float] = None
    live_load: Optional[float] = None
    other_live_load: Optional[float] = None


class CBDesignParams(BaseModel):
    design_working_life: int = 50
    exposure_class: str = "XC1"
    cracked_section_sls: bool = True


class ContinuousBeamRequest(BaseModel):
    beam_id: str = "CB1"
    design_code: DesignCode = DesignCode.EC2
    analysis_method: str = "Linear Elastic"
    geometry: CBGeometry
    materials: CBMaterials
    loads: CBLoads
    span_loads: Optional[List[CBSpanLoad]] = None
    end_support: str = "simple"            # simple | continuous
    design_params: CBDesignParams = CBDesignParams()
    bar_diameters: Optional[List[int]] = Field([16, 20, 25, 32])
    link_diameter: int = 8
    region: str = "Nigeria"


# ---------- response ----------
class CBSpanResult(BaseModel):
    index: int
    length: float
    w_ultimate: float
    w_service: float
    m_sagging: float
    bottom_steel: Dict


class CBSupportResult(BaseModel):
    index: int
    label: str
    m_hogging: float
    shear: float
    top_steel: Dict
    links: Dict


class CBMaterialsOut(BaseModel):
    fck: float
    fcd: float
    fyk: float
    fyd: float
    modular_ratio: float
    unit_weight_concrete: float


class CBLoadSummary(BaseModel):
    components: List[Dict]
    total_dead: float
    total_live: float
    total_service: float


class CBForces(BaseModel):
    max_sagging: float
    max_hogging: float
    max_shear: float
    ultimate_combo: str


class CBCapacity(BaseModel):
    utilization_bending: float
    utilization_shear: float


class CBSLS(BaseModel):
    deflection_actual: float
    deflection_limit: float
    deflection_status: str
    crack_width: float
    crack_limit: float
    crack_status: str


class CBReaction(BaseModel):
    index: int
    label: str
    reaction: float
    percent: float


class ReportRow(BaseModel):
    reference: str
    calculation: str
    output: str


class ReportSection(BaseModel):
    title: str
    rows: List[ReportRow]


class CBSummary(BaseModel):
    beam_id: str
    design_code: str
    analysis: str
    n_spans: int
    span_lengths: List[float]
    width: float
    depth: float
    effective_depth: float
    cover: float
    concrete_grade: str
    steel_grade: str
    status: str


class ContinuousBeamResult(BaseModel):
    summary: CBSummary
    materials: CBMaterialsOut
    loads: CBLoadSummary
    spans: List[CBSpanResult]
    supports: List[CBSupportResult]
    reactions: List[CBReaction]
    forces: CBForces
    capacity: CBCapacity
    sls: CBSLS
    # Structured shear/deflection derivation, matching the level of detail
    # already exposed for the simply-supported beam (beam_schemas.py) --
    # the engine already computed these values, they just weren't surfaced
    # as response fields before, only as formatted text inside `report`.
    shear_detail: Optional[Dict] = None
    deflection_detail: Optional[Dict] = None
    report: List[ReportSection]
    warnings: List[str]
    notes: List[str]