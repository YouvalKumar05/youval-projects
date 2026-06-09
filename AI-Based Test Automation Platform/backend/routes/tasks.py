from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
import json

from db.database import get_db
from models.core import User, Task, Bug, TestCase, Sprint
from schemas.api_models import StandardResponse, TaskCreate, TaskUpdate, TaskStatusUpdate
from middleware.rbac import require_permission, get_current_user
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("", response_model=StandardResponse)
async def list_tasks(
    sprint_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tasks:read"))
):
    stmt = select(Task).options(
        joinedload(Task.sprint)
    )
    
    if sprint_id:
        stmt = stmt.where(Task.sprint_id == sprint_id)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if status:
        stmt = stmt.where(Task.status == status)
        
    # Enforces separation: non-admins only see their own tasks if restricted
    if current_user.role and current_user.role.name != "Admin" and False: # Disabled for demo purposes so user can see all tasks on board
        stmt = stmt.where(Task.assignee_id == current_user.id)
        
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    
    # Enrichment
    assignee_ids = {t.assignee_id for t in tasks if t.assignee_id}
    assignee_map = {}
    if assignee_ids:
        users = await db.execute(select(User).where(User.id.in_(assignee_ids)))
        for u in users.scalars().all():
            assignee_map[u.id] = {"id": u.id, "email": u.email}
            
    data = []
    for t in tasks:
        data.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "sprint_id": t.sprint_id,
            "sprint_name": t.sprint.name if t.sprint else None,
            "assignee": assignee_map.get(t.assignee_id),
            "status": t.status,
            "reference_type": t.reference_type,
            "reference_id": t.reference_id,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
        
    return StandardResponse(status="success", data=data)

@router.post("", response_model=StandardResponse)
async def create_task(
    req: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tasks:write"))
):
    new_task = Task(
        title=req.title,
        description=req.description,
        priority=req.priority,
        due_date=req.due_date,
        assignee_id=req.assignee_id,
        status=req.status,
        reference_type=req.reference_type,
        reference_id=req.reference_id
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    return StandardResponse(status="success", message="Task created", data={"id": new_task.id})

@router.put("/{task_id}", response_model=StandardResponse)
async def update_task(
    task_id: int,
    req: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tasks:write"))
):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if req.title is not None:
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.priority is not None:
        task.priority = req.priority
    if req.due_date is not None:
        task.due_date = req.due_date
    if req.assignee_id is not None:
        task.assignee_id = req.assignee_id
    if req.status is not None:
        task.status = req.status
    if req.reference_type is not None:
        task.reference_type = req.reference_type
    if req.reference_id is not None:
        task.reference_id = req.reference_id
        
    await db.commit()
    await db.refresh(task)
    
    return StandardResponse(status="success", message="Task updated", data={"id": task.id})

@router.patch("/{task_id}/status", response_model=StandardResponse)
async def update_task_status(
    task_id: int,
    req: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tasks:write"))
):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = req.status
    await db.commit()
    
    # Workflow trigger for task completion
    if req.status == "Done":
        try:
            from workflow_engine.engine import WorkflowEngine
            engine = WorkflowEngine(db)
            await engine.trigger_event("task_completed", "task", task.id, {"status": "Done"})
        except Exception:
            pass
            
    return StandardResponse(status="success", message="Task status updated")

@router.delete("/{task_id}", response_model=StandardResponse)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("tasks:write"))
):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await db.delete(task)
    await db.commit()
    
    return StandardResponse(status="success", message="Task deleted")
