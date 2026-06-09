from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional, Dict, Any
import json

from db.database import get_db
from models.core import User, TestCase, Execution, Version
from schemas.api_models import StandardResponse
from middleware.rbac import require_permission, get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/testcases", tags=["testcases"])

class TestCaseCreate(BaseModel):
    title: str
    project_id: str
    steps_json: dict

class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    project_id: Optional[str] = None
    steps_json: Optional[dict] = None
    is_approved: Optional[bool] = None
    version_id: Optional[str] = None

class ApprovalRequest(BaseModel):
    version_id: str = "v1.0.0"

@router.get("", response_model=StandardResponse)
async def list_test_cases(
    project_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:read"))
):
    # Join with Execution to get the latest status
    stmt = select(TestCase, Execution.status).outerjoin(
        Execution, 
        Execution.id == select(Execution.id).where(Execution.test_case_id == TestCase.id).order_by(Execution.started_at.desc()).limit(1).correlate(TestCase).scalar_subquery()
    )
    
    if project_id:
        stmt = stmt.where(TestCase.project_id == project_id)
        
    result = await db.execute(stmt)
    rows = result.all()
    
    data = []
    for tc, status in rows:
        if search and search.lower() not in tc.title.lower() and search.lower() not in f"tc-{tc.id}":
            continue
            
        data.append({
            "id": tc.id,
            "project_id": tc.project_id,
            "title": tc.title,
            "steps_json": tc.steps_json,
            "created_by": tc.created_by,
            "created_at": tc.created_at.isoformat() if tc.created_at else None,
            "latest_status": status or "Idle"
        })
        
    # Sort descending by ID
    data.sort(key=lambda x: x["id"], reverse=True)
    
    return StandardResponse(status="success", data=data)

@router.post("", response_model=StandardResponse)
async def create_test_case(
    req: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    new_tc = TestCase(
        title=req.title,
        project_id=req.project_id,
        steps_json=req.steps_json,
        created_by=current_user.id
    )
    db.add(new_tc)
    await db.commit()
    await db.refresh(new_tc)
    
    return StandardResponse(status="success", data={
        "id": new_tc.id,
        "title": new_tc.title,
        "project_id": new_tc.project_id
    })

@router.put("/{test_id}", response_model=StandardResponse)
async def update_test_case(
    test_id: int,
    req: TestCaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    stmt = select(TestCase).where(TestCase.id == test_id)
    result = await db.execute(stmt)
    tc = result.scalars().first()
    
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
        
    if req.title is not None:
        tc.title = req.title
    if req.project_id is not None:
        tc.project_id = req.project_id
    if req.steps_json is not None:
        tc.steps_json = req.steps_json
        
    await db.commit()
    await db.refresh(tc)
    
    return StandardResponse(status="success", data={
        "id": tc.id,
        "title": tc.title,
        "project_id": tc.project_id
    })

@router.delete("/{test_id}", response_model=StandardResponse)
async def delete_test_case(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    stmt = select(TestCase).where(TestCase.id == test_id)
    result = await db.execute(stmt)
    tc = result.scalars().first()
    
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
        
    await db.delete(tc)
    await db.commit()
    
    return StandardResponse(status="success", message="Test case deleted successfully")

@router.post("/bulk-approve-and-execute", response_model=StandardResponse)
async def bulk_approve_and_execute(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    """
    Saves new generated test cases and triggers execution.
    Input: { "project_id": "...", "title": "...", "test_cases": [...], "version_id": "..." }
    """
    project_id = payload.get("project_id", "default")
    title = payload.get("title", "Generated Suite")
    test_cases_data = payload.get("test_cases", [])
    version_val = payload.get("version_id", "v1.0.0")
    
    version_id = None
    if isinstance(version_val, int):
        version_id = version_val
    elif isinstance(version_val, str):
        if version_val.isdigit():
            version_id = int(version_val)
        else:
            stmt = select(Version).where(Version.version_number == version_val)
            result = await db.execute(stmt)
            version = result.scalars().first()
            if version:
                version_id = version.id
    
    if not test_cases_data:
        raise HTTPException(status_code=400, detail="No test cases provided")
        
    created_ids = []
    
    for tc_data in test_cases_data:
        new_tc = TestCase(
            title=tc_data.get("scenario", title),
            project_id=project_id,
            steps_json=tc_data,
            created_by=current_user.id,
            is_approved=True,
            version_id=version_id
        )
        db.add(new_tc)
        await db.flush() # get id
        created_ids.append(new_tc.id)
        
        # Create execution for each
        new_execution = Execution(
            test_case_id=new_tc.id,
            status="Pending",
            logs=[]
        )
        db.add(new_execution)
        
    await db.commit()
    
    return StandardResponse(
        status="success", 
        message=f"Successfully saved and scheduled {len(created_ids)} test cases.",
        data={"test_case_ids": created_ids}
    )
