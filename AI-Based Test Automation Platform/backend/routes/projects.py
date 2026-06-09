from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sql_delete
from db.database import get_db
from models.core import Project
from schemas.api_models import StandardResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


@router.get("", response_model=StandardResponse)
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.id.desc()))
    projects = result.scalars().all()
    return StandardResponse(
        status="success",
        data=[{"id": p.id, "name": p.name, "description": p.description} for p in projects]
    )


@router.post("", response_model=StandardResponse)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Project).where(Project.name == req.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Project name already exists")

    new_p = Project(name=req.name, description=req.description)
    db.add(new_p)
    await db.commit()
    await db.refresh(new_p)
    return StandardResponse(status="success", message="Project created", data={"id": new_p.id})


@router.delete("/{project_id}", response_model=StandardResponse)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        await db.execute(sql_delete(Project).where(Project.id == project_id))
        await db.commit()
        return StandardResponse(
            status="success",
            message=f"Project '{project.name}' deleted successfully"
        )
    except Exception as e:
        await db.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")
