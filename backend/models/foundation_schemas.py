# backend/models/foundation_schemas.py
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class FoundationDesignBasis(BaseModel):
    """
    Printed on the first page of the Detailed Report. All optional and all
    free text: who designed, who checked, and whether an independent check
    is required or done are the designer's own statements -- nothing here is
    inferred or filled in automatically. Left blank, the report says
    "not entered" rather than silently omitting the row.

    Shared across foundation types (pad now, combined footing later), same
    as SlabDesignBasis is shared across one-way/two-way/continuous slab.
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


class PadFoundationRequest(BaseModel):
    """
    Matches FoundationInput.jsx's foundationAPI.designPad(...) payload field
    for field. The page also collects a number of display-only fields
    (design approach, analysis method, min/max reinforcement ratio, the
    eccentricity/punching check toggles, pedestal and below-ground geometry)
    that the engine does not use -- by design, per the page's own banner
    text ("Extra fields are recorded, not calculated"). Those are not part
    of this request; only what the engine actually consumes is here.
    """
    axial_load_kN: float = Field(..., gt=0)
    moment_x_kNm: float = 0.0
    moment_y_kNm: float = 0.0

    footing_length_mm: float = Field(..., gt=0)
    footing_width_mm: float = Field(..., gt=0)
    footing_depth_mm: float = Field(..., gt=0)

    column_x_mm: float = Field(..., gt=0)
    column_y_mm: float = Field(..., gt=0)

    concrete_grade_fck: float = Field(..., gt=0)
    steel_grade_fyk: float = Field(..., gt=0)

    allowable_bearing_kN_m2: float = Field(..., gt=0)

    cover_mm: float = Field(..., ge=0)
    bar_dia_mm: float = Field(..., gt=0)

    gamma_c: float = Field(1.5, gt=0)
    gamma_s: float = Field(1.15, gt=0)

    design_basis: FoundationDesignBasis = FoundationDesignBasis()

    @model_validator(mode="after")
    def check_column_fits_footing(self):
        if self.column_x_mm >= self.footing_length_mm or self.column_y_mm >= self.footing_width_mm:
            raise ValueError(
                f"Column ({self.column_x_mm:.0f} x {self.column_y_mm:.0f} mm) does not fit inside "
                f"the footing ({self.footing_length_mm:.0f} x {self.footing_width_mm:.0f} mm). "
                f"The footing must be larger than the column on both sides."
            )
        return self

    @model_validator(mode="after")
    def check_cover_and_bars_fit_depth(self):
        min_depth = self.cover_mm + 2 * self.bar_dia_mm
        if self.footing_depth_mm <= min_depth:
            raise ValueError(
                f"Footing depth ({self.footing_depth_mm:.0f} mm) is not enough for cover "
                f"({self.cover_mm:.0f} mm) plus two layers of Y{self.bar_dia_mm:.0f} bars -- "
                f"needs at least {min_depth:.0f} mm. Increase the depth, reduce the cover, or "
                f"use a smaller bar."
            )
        return self


# ============================================================
# RESPONSE -- shaped to match FoundationResults.jsx exactly.
#
# r.status, r.load_case
# r.geometry.{footing_length_mm, footing_width_mm, footing_depth_mm,
#             column_x_mm, column_y_mm, projection_x_mm, projection_y_mm,
#             d_eff_x_mm, d_eff_y_mm, cover_mm}
# r.soil_pressure.{q0, qmax, qmin, bearing_ok, uplift_ok, corners.{c1,c2,c3,c4}}
# r.design_moments.{Mx_kNm_per_m, My_kNm_per_m}
# r.flexure.x / r.flexure.y .{d_eff_mm, As_req, As_min, As_provided, bar_dia,
#                              spacing_mm, status}
# r.one_way_shear.x / r.one_way_shear.y .{VEd_kN_per_m, VRdc_kN_per_m, status}
# r.punching.{vEd_MPa, vRdc_MPa, status}
# r.utilisation.{overall_pct, bearing_pct, shear_pct, punching_pct}
# r.materials.allowable_bearing_kN_m2
# r.report[].section, r.report[].rows[].{ref, calc, out}
# ============================================================

class ReportRow(BaseModel):
    ref: str
    calc: str
    out: str


class ReportSection(BaseModel):
    section: str
    rows: List[ReportRow]


class GeometryOut(BaseModel):
    footing_length_mm: float
    footing_width_mm: float
    footing_depth_mm: float
    column_x_mm: float
    column_y_mm: float
    projection_x_mm: float
    projection_y_mm: float
    d_eff_x_mm: float
    d_eff_y_mm: float
    cover_mm: float


class CornersOut(BaseModel):
    c1: float   # (+ex, +ey)
    c2: float   # (+ex, -ey)
    c3: float   # (-ex, +ey)
    c4: float   # (-ex, -ey)


class SoilPressureOut(BaseModel):
    q0: float
    qmax: float
    qmin: float
    bearing_ok: bool
    uplift_ok: bool
    corners: CornersOut


class DesignMomentsOut(BaseModel):
    Mx_kNm_per_m: float
    My_kNm_per_m: float


class FlexureDirectionOut(BaseModel):
    d_eff_mm: float
    As_req: float
    As_min: float
    As_provided: float
    bar_dia: float
    spacing_mm: float
    status: str


class FlexureOut(BaseModel):
    x: FlexureDirectionOut
    y: FlexureDirectionOut


class ShearDirectionOut(BaseModel):
    VEd_kN_per_m: float
    VRdc_kN_per_m: float
    status: str


class OneWayShearOut(BaseModel):
    x: ShearDirectionOut
    y: ShearDirectionOut


class PunchingOut(BaseModel):
    vEd_MPa: float
    vRdc_MPa: float
    status: str


class UtilisationOut(BaseModel):
    overall_pct: float
    bearing_pct: float
    shear_pct: float
    punching_pct: float


class MaterialsOut(BaseModel):
    concrete_grade_fck: float
    steel_grade_fyk: float
    allowable_bearing_kN_m2: float


class PadFoundationResponse(BaseModel):
    task_id: str
    status: str
    foundation_type: str = "pad"
    load_case: str
    geometry: GeometryOut
    soil_pressure: SoilPressureOut
    design_moments: DesignMomentsOut
    flexure: FlexureOut
    one_way_shear: OneWayShearOut
    punching: PunchingOut
    utilisation: UtilisationOut
    materials: MaterialsOut
    report: List[ReportSection] = []


# ============================================================
# COMBINED FOOTING -- two columns sharing one footing.
#
# No pre-existing results page to match (confirmed: none exists yet), so
# this response shape was designed to slot into a branched version of
# FoundationResults.jsx, reusing the same soil_pressure.corners.{c1..c4}
# shape pad already uses (so SoilPressure3D can be reused unchanged) and
# the same section/ref/calc/out report convention.
# ============================================================

class ColumnLoadRequest(BaseModel):
    axial_load_kN: float = Field(..., gt=0)          # ULS
    moment_x_kNm: float = 0.0
    moment_y_kNm: float = 0.0
    # SLS axial load for the bearing check; omitted -> the ULS load is used (conservative)
    service_axial_kN: Optional[float] = Field(None, gt=0)


class CombinedFootingRequest(BaseModel):
    column_1: ColumnLoadRequest
    column_2: ColumnLoadRequest
    column_spacing_m: float = Field(..., gt=0)
    left_projection_m: float = Field(..., ge=0)

    footing_length_m: float = Field(..., gt=0)
    footing_width_m: float = Field(..., gt=0)
    footing_depth_mm: float = Field(..., gt=0)

    column_x_mm: float = Field(..., gt=0)
    column_y_mm: float = Field(..., gt=0)

    concrete_grade_fck: float = Field(..., gt=0)
    steel_grade_fyk: float = Field(..., gt=0)

    allowable_bearing_kN_m2: float = Field(..., gt=0)

    cover_mm: float = Field(..., ge=0)
    bar_dia_mm: float = Field(..., gt=0)

    gamma_c: float = Field(1.5, gt=0)
    gamma_s: float = Field(1.15, gt=0)
    unit_weight_concrete: float = Field(25.0, gt=0)

    design_basis: FoundationDesignBasis = FoundationDesignBasis()

    @model_validator(mode="after")
    def check_columns_fit_on_footing(self):
        x2 = self.left_projection_m + self.column_spacing_m
        if x2 > self.footing_length_m:
            raise ValueError(
                f"Column 2 sits at {x2:.3f} m from the left edge (left projection "
                f"{self.left_projection_m:.3f} + spacing {self.column_spacing_m:.3f}), which is "
                f"beyond the footing length of {self.footing_length_m:.3f} m. Increase the footing "
                f"length or reduce the spacing/projection."
            )
        return self

    @model_validator(mode="after")
    def check_cover_and_bars_fit_depth(self):
        min_depth = self.cover_mm + 2 * self.bar_dia_mm
        if self.footing_depth_mm <= min_depth:
            raise ValueError(
                f"Footing depth ({self.footing_depth_mm:.0f} mm) is not enough for cover "
                f"({self.cover_mm:.0f} mm) plus two layers of Y{self.bar_dia_mm:.0f} bars -- "
                f"needs at least {min_depth:.0f} mm. Increase the depth, reduce the cover, or "
                f"use a smaller bar."
            )
        return self


class ColumnPositionOut(BaseModel):
    axial_load_kN: float
    moment_x_kNm: float
    moment_y_kNm: float
    position_m: float


class ColumnsOut(BaseModel):
    column_1: ColumnPositionOut
    column_2: ColumnPositionOut
    spacing_m: float
    total_load_kN: float
    resultant_position_m: float


class CombinedGeometryOut(BaseModel):
    footing_length_mm: float
    footing_width_mm: float
    footing_depth_mm: float
    column_x_mm: float
    column_y_mm: float
    d_long_mm: float
    d_trans_mm: float
    cover_mm: float


class CombinedMomentsOut(BaseModel):
    Mx_total_kNm: float
    My_total_kNm: float
    ex_m: float
    ey_m: float


class LongitudinalOut(BaseModel):
    Mmax_kNm: float
    location_m: float
    d_eff_mm: float
    As_req: float
    As_min: float
    As_provided: float
    bar_dia: float
    spacing_mm: float
    status: str


class TransverseOut(BaseModel):
    M_kNm: float
    projection_m: float
    d_eff_mm: float
    As_req: float
    As_min: float
    As_provided: float
    bar_dia: float
    spacing_mm: float
    status: str


class CombinedShearSectionOut(BaseModel):
    label: str
    x_m: float
    VEd_kN: float
    tension_face: str
    rho_l: float
    VRdc_kN: float
    status: str


class CombinedShearOut(BaseModel):
    VEd_kN: float
    VRdc_kN: float
    status: str
    location_m: float
    label: str
    sections: List[CombinedShearSectionOut]


class ColumnPunchingOut(BaseModel):
    column: int
    applicable: bool
    a_mm: float
    u_m: float
    beta: float
    VEd_red_kN: float
    vEd_MPa: float
    vRd_MPa: float
    v0_MPa: float
    vRdmax_MPa: float
    status: str


class CombinedPunchingOut(BaseModel):
    vEd_MPa: float          # governing column, governing perimeter
    vRdc_MPa: float         # v_Rd,c x 2d/a at that perimeter
    status: str
    d_eff_mm: float
    rho_l: float
    columns: List[ColumnPunchingOut]


class CombinedUtilisationOut(BaseModel):
    overall_pct: float
    bearing_pct: float
    shear_pct: float
    punching_pct: float


class CombinedFootingResponse(BaseModel):
    task_id: str
    status: str
    foundation_type: str = "combined"
    case_type: str
    columns: ColumnsOut
    geometry: CombinedGeometryOut
    soil_pressure: SoilPressureOut        # SLS, incl. footing self-weight: bearing / uplift
    soil_pressure_uls: SoilPressureOut    # ULS net pressure: structural design
    sls_from_uls: bool
    moments: CombinedMomentsOut
    longitudinal_bottom: LongitudinalOut  # sagging, under the columns
    longitudinal_top: LongitudinalOut     # hogging, between the columns
    transverse: TransverseOut
    shear: CombinedShearOut
    punching: CombinedPunchingOut
    utilisation: CombinedUtilisationOut
    materials: MaterialsOut
    report: List[ReportSection] = []