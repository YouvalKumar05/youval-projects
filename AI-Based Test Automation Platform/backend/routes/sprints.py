from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import date
from db.database import get_db
from models.core import Sprint, Version, Project
from schemas.api_models import StandardResponse
from pydantic import BaseModel
from services.versioning_service import VersioningService

router = APIRouter(prefix="/api/sprints", tags=["sprints"])

class SprintCreate(BaseModel):
    project_id: int
    name: str
    start_date: date
    end_date: date

class VersionCreate(BaseModel):
    sprint_id: int
    change_type: str = "minor" # major, minor, fix

@router.get("/{project_id}", response_model=StandardResponse)
async def list_sprints(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.id.desc()))
    sprints = result.scalars().all()
    return StandardResponse(status="success", data=[{
        "id": s.id, 
        "name": s.name, 
        "start_date": s.start_date.isoformat(), 
        "end_date": s.end_date.isoformat(),
        "status": s.status
    } for s in sprints])

@router.post("", response_model=StandardResponse)
async def create_sprint(req: SprintCreate, db: AsyncSession = Depends(get_db)):
    new_s = Sprint(project_id=req.project_id, name=req.name, start_date=req.start_date, end_date=req.end_date)
    db.add(new_s)
    await db.commit()
    await db.refresh(new_s)
    return StandardResponse(status="success", message="Sprint created", data={"id": new_s.id})

@router.get("/versions/{sprint_id}", response_model=StandardResponse)
async def list_versions(sprint_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Version).where(Version.sprint_id == sprint_id).order_by(Version.id.desc()))
    versions = result.scalars().all()
    return StandardResponse(status="success", data=[{
        "id": v.id, 
        "version_number": v.version_number, 
        "status": v.status,
        "created_at": v.created_at.isoformat()
    } for v in versions])

@router.post("/versions", response_model=StandardResponse)
async def create_version(req: VersionCreate, db: AsyncSession = Depends(get_db)):
    v_num = await VersioningService.get_next_version(db, req.sprint_id, req.change_type)
    new_v = await VersioningService.create_new_version(db, req.sprint_id, v_num)
    return StandardResponse(status="success", message=f"Version {v_num} created", data={"id": new_v.id, "version_number": v_num})
