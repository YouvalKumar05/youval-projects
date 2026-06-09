from fastapi import APIRouter, Depends
from typing import Dict, Any
from .ai import analyze_full

router = APIRouter(prefix="/api", tags=["analyze"])

@router.post("/analyze")
async def analyze_alias(payload: Dict[str, Any], result: Any = Depends(analyze_full)):
    return result
