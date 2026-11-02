# backend/models/staircase_schemas.py
# Request for the staircase element (engine/staircase_engine.py). Defaults are
# the Structville worked example, section 5.4 (flight 2 of the book's stair).
from typing import Optional
from pydantic import BaseModel, Field, model_validator
from models.beam_schemas import BeamDesignBasis


class StaircaseRequest(BaseModel):
    member_id: str = Field("ST1", max_length=40)
    n_risers: int = Field(10, ge=2, le=30)
    riser_mm: float = Field(150, gt=0, le=250)
    going_mm: float = Field(250, gt=0, le=450)
    flight_span_mm: float = Field(2515, gt=0, description="horizontal, top support to flight/landing junction")
    landing_mm: float = Field(1200, gt=0, description="horizontal, junction to landing support")
    thickness_mm: float = Field(175, ge=100, le=400, description="waist and landing")
    finishes_kN_m2: float = Field(1.2, ge=0)
    qk_kN_m2: float = Field(3.0, ge=0)
    fck: float = Field(25, ge=12, le=50)
    fyk: float = Field(460, ge=250, le=600)
    cover_mm: float = Field(25, ge=10, le=75)
    main_bar_mm: float = Field(12, ge=8, le=25)
    main_spacing_mm: Optional[float] = Field(None, ge=50, le=400)
    top_bar_mm: float = Field(12, ge=8, le=25)
    top_spacing_mm: Optional[float] = Field(None, ge=50, le=400)
    dist_bar_mm: float = Field(10, ge=6, le=20)
    dist_spacing_mm: Optional[float] = Field(None, ge=50, le=450)
    # detailing / bar schedule (book 9.9, 10.6)
    width_mm: float = Field(885, ge=500, le=4000, description="clear width of the flight and landing")
    support_width_mm: float = Field(230, ge=100, le=600, description="landing support (wall/beam) at C")
    n_members: int = Field(1, ge=1, le=100, description="identical staircases in the schedule")
    design_basis: Optional[BeamDesignBasis] = None

    @model_validator(mode="after")
    def _check(self):
        if self.flight_span_mm < (self.n_risers - 1) * self.going_mm * 0.5:
            raise ValueError("flight_span_mm is much shorter than the treads (n_risers - 1) x going: "
                             "check the flight span (horizontal, top support to landing).")
        d = self.thickness_mm - self.cover_mm - max(self.main_bar_mm, self.top_bar_mm) / 2
        if d < 50:
            raise ValueError(f"Effective depth {d:.0f} mm is too small: increase the thickness or reduce the cover.")
        return self
