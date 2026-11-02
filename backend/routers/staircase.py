# backend/routers/staircase.py
# Mounted in server.py with prefix="/api/staircase".
from fastapi import APIRouter, HTTPException

from models.staircase_schemas import StaircaseRequest
from services.staircase_service import calculate_staircase

router = APIRouter()


@router.post("/design/sync")
async def design_staircase_sync(request: StaircaseRequest):
    try:
        return calculate_staircase(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Staircase design failed: {e}")
