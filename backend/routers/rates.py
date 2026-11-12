from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter()

@router.get("/{region}")
async def get_rates(region: str):
    """
    Get material rates for a specific region.
    """
    rates_path = os.path.join(os.path.dirname(__file__), '..', 'engine', 'rates_db.json')
    
    try:
        with open(rates_path, 'r') as f:
            rates_db = json.load(f)
        
        # regions sit under "regions" (same lookup as services/slab_service.resolve_rates);
        # reading the top level returned empty rates for every region
        root = rates_db.get("regions", rates_db)
        if region in root:
            return {"region": region, "version": rates_db.get("version"), "rates": root[region]}
        return {"region": region, "version": rates_db.get("version"), "rates": root.get("UK", {}),
                "note": "Region not found, using UK defaults"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Rates database not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def list_regions():
    """
    List available regions.
    """
    rates_path = os.path.join(os.path.dirname(__file__), '..', 'engine', 'rates_db.json')
    
    try:
        with open(rates_path, 'r') as f:
            rates_db = json.load(f)
        return {"regions": list(rates_db.get("regions", rates_db).keys()), "version": rates_db.get("version")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))