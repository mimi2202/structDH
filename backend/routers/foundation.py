# backend/routers/foundation.py
"""
Mounted in server.py as:
    app.include_router(foundation.router, prefix="/api/foundation")
"""
from fastapi import APIRouter, HTTPException

from models.foundation_schemas import PadFoundationRequest, CombinedFootingRequest
from services.foundation_service import calculate_pad_foundation, calculate_combined_footing

router = APIRouter()


@router.post("/pad/design/sync")
async def design_pad_sync(request: PadFoundationRequest):
    try:
        return calculate_pad_foundation(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pad foundation design failed: {e}")


@router.post("/combined/design/sync")
async def design_combined_sync(request: CombinedFootingRequest):
    try:
        return calculate_combined_footing(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Combined footing design failed: {e}")