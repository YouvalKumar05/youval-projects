from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from services.accuracy_engine import AccuracyEngine

router = APIRouter(prefix="/api/accuracy", tags=["accuracy"])
engine = AccuracyEngine()

class AccuracyRequest(BaseModel):
    requirement: str
    test_cases: List[Dict[str, Any]]

@router.post("")
async def evaluate_accuracy(request: AccuracyRequest):
    try:
        if not request.requirement:
            raise HTTPException(status_code=400, detail="Requirement text is required")
        if not request.test_cases:
            raise HTTPException(status_code=400, detail="Test cases are required for evaluation")
            
        result = engine.calculate_accuracy(request.requirement, request.test_cases)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Also supporting GET if needed for existing results (dummy for now as per objective)
@router.get("")
async def get_latest_accuracy():
    # In a real app, this would fetch from DB
    return {
        "overall_accuracy": 0,
        "metrics": {
            "coverage": 0,
            "validity": 0,
            "assertion": 0,
            "redundancy": 0,
            "ai_confidence": 0,
            "edge": 0
        }
    }
