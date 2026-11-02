from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import slab, rates
from routers import beam
from routers import continuous_beam
from routers import continuous_slab
import os
import uvicorn
from routers import column
from routers import foundation
from routers import staircase
  
app = FastAPI(
    title="StructAI Design Engine",
    description="AI-driven structural design optimization for reinforced concrete slabs",
    version="1.0.0",
)

# CORS — wildcard failsafe (no credentials, so "*" is allowed and cannot mismatch)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(slab.router, prefix="/api/slab", tags=["Slab Design"])
app.include_router(rates.router, prefix="/api/rates", tags=["Material Rates"])
app.include_router(beam.router, prefix="/api/beam")
app.include_router(continuous_beam.router, prefix="/api/continuous-beam")
app.include_router(continuous_slab.router, prefix="/api/continuous-slab")
app.include_router(column.router)
app.include_router(foundation.router, prefix="/api/foundation")
app.include_router(staircase.router, prefix="/api/staircase")

@app.get("/")
async def root():
    return {"status": "running", "app": "StructAI Design Engine", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    # Render injects $PORT; fall back to 8000 locally
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)