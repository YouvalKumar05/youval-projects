import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from db.database import get_db
from models.core import User, TestCase, Execution
from schemas.api_models import StandardResponse, TriggerExecutionRequest
from middleware.rbac import require_permission
from services.playwright_service import PlaywrightService
from routes.ws import manager, broadcast_dashboard_event

router = APIRouter(prefix="/api/executions", tags=["executions"])

@router.post("/run/{test_case_id}", response_model=StandardResponse)
async def run_test_case(test_case_id: int, req: TriggerExecutionRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("executions:write"))):
    stmt = select(TestCase).where(TestCase.id == test_case_id)
    result = await db.execute(stmt)
    test_case = result.scalars().first()
    
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    execution = Execution(test_case_id=test_case_id, status="Running")
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    
    # Broadcast to dashboard
    await broadcast_dashboard_event({"type": "execution", "status": "started", "execution_id": execution.id})
    
    svc = PlaywrightService(db)
    
    async def on_event(evt):
        await manager.broadcast_to_execution(execution.id, evt)
 
    # Run in background to prevent blocking HTTP 
    config = {
        "headless": req.headless,
        "browser_type": req.browser_type,
        "delay": req.delay
    }
    background_tasks.add_task(PlaywrightService.run_in_background, execution.id, test_case.id, config, on_event)
    
    return StandardResponse(status="success", message="Playwright Execution triggered asynchronously", data={"execution_id": execution.id})

@router.post("/bulk-run", response_model=StandardResponse)
async def bulk_run_test_cases(req: dict, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("executions:write"))):
    test_case_ids = req.get("test_case_ids", [])
    if not test_case_ids:
        raise HTTPException(status_code=400, detail="No test case IDs provided")
        
    execution_ids = []
    svc = PlaywrightService(db)
    config = {
        "headless": req.get("headless", True),
        "browser_type": req.get("browser_type", "chromium"),
        "delay": req.get("delay", 2.0)
    }

    for tc_id in test_case_ids:
        stmt = select(TestCase).where(TestCase.id == tc_id)
        result = await db.execute(stmt)
        test_case = result.scalars().first()
        if not test_case:
            continue
            
        execution = Execution(test_case_id=tc_id, status="Running")
        db.add(execution)
        await db.flush()
        execution_ids.append(execution.id)
        
        # Broadcast to dashboard for real-time UI update
        await broadcast_dashboard_event({"type": "execution", "status": "started", "execution_id": execution.id})
        
        # Capture current execution id for closure
        async def make_on_event(eid):
            async def on_event(evt):
                await manager.broadcast_to_execution(eid, evt)
            return on_event
            
        on_event_cb = await make_on_event(execution.id)
        background_tasks.add_task(PlaywrightService.run_in_background, execution.id, test_case.id, config, on_event_cb)
        
    await db.commit()
    return StandardResponse(status="success", message=f"Triggered {len(execution_ids)} executions", data={"execution_ids": execution_ids})


from fastapi.responses import JSONResponse

@router.get("")
async def list_executions(db: AsyncSession = Depends(get_db)):
    try:
        # Join with TestCase to get the title
        stmt = select(Execution, TestCase.title, TestCase.project_id).join(TestCase, Execution.test_case_id == TestCase.id).order_by(Execution.started_at.desc())
        result = await db.execute(stmt)
        executions = []
        for row in result:
            exec_obj, title, project_id = row
            executions.append({
                "id": exec_obj.id,
                "test_case_id": exec_obj.test_case_id,
                "test_case_title": title,
                "project_id": project_id,
                "status": exec_obj.status,
                "started_at": exec_obj.started_at.isoformat() if exec_obj.started_at else None,
                "completed_at": exec_obj.completed_at.isoformat() if exec_obj.completed_at else None,
                "logs_path": exec_obj.logs_path
            })
        return JSONResponse(content={"status": "success", "data": executions})
    except Exception as e:
        print(f"ERROR list_executions: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": "Failed to fetch executions", "details": str(e)})

@router.get("/testcase/{test_case_id}", response_model=StandardResponse)
async def get_testcase_executions(test_case_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Execution).where(Execution.test_case_id == test_case_id).order_by(Execution.started_at.desc())
    result = await db.execute(stmt)
    executions = []
    for exec_obj in result.scalars().all():
        executions.append({
            "id": exec_obj.id,
            "test_case_id": exec_obj.test_case_id,
            "status": exec_obj.status,
            "started_at": exec_obj.started_at.isoformat() if exec_obj.started_at else None,
            "completed_at": exec_obj.completed_at.isoformat() if exec_obj.completed_at else None,
            "logs_path": exec_obj.logs_path
        })
    return StandardResponse(status="success", data=executions)



@router.get("/{execution_id}", response_model=StandardResponse)
async def get_execution(execution_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Execution, TestCase.title, TestCase.project_id, TestCase.steps_json).join(TestCase, Execution.test_case_id == TestCase.id).where(Execution.id == execution_id)
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    exec_obj, title, project_id, steps_json = row
    
    script_str = (steps_json or {}).get("script", "No script available.")
    
    data = {
        "id": exec_obj.id,
        "test_case_id": exec_obj.test_case_id,
        "test_case_title": title,
        "project_id": project_id,
        "status": exec_obj.status,
        "started_at": exec_obj.started_at.isoformat() if exec_obj.started_at else None,
        "completed_at": exec_obj.completed_at.isoformat() if exec_obj.completed_at else None,
        "logs_path": exec_obj.logs_path,
        "video_path": exec_obj.video_path,
        "logs": exec_obj.logs,
        "step_results": exec_obj.step_results,
        "script": script_str
    }
    
    return StandardResponse(status="success", data=data)
    
@router.get("/preview/{test_case_id}", response_model=StandardResponse)
async def preview_script(test_case_id: int, base_url: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    stmt = select(TestCase).where(TestCase.id == test_case_id)
    result = await db.execute(stmt)
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
        
    steps_data = test_case.steps_json or {}
    script = steps_data.get("script")
    
    # If a custom base_url is provided, we MUST regenerate the script to include it.
    # Otherwise, if script exists, we return it.
    if base_url or not script:
        from services.rag_script_generator import RAGScriptGenerator
        generator = RAGScriptGenerator(db)
        script = await generator.generate_script(test_case, base_url=base_url)
        # Store for future use
        steps_data["script"] = script
        stmt_upd = update(TestCase).where(TestCase.id == test_case.id).values(steps_json=steps_data)
        await db.execute(stmt_upd)
        await db.commit()
        
    return StandardResponse(status="success", data={"script": script})

@router.post("/stop/{execution_id}", response_model=StandardResponse)
async def stop_execution(execution_id: int):
    """Attempt to cancel a running Playwright task."""
    cancelled = PlaywrightService.cancel_execution(execution_id)
    if cancelled:
        return StandardResponse(status="success", message=f"Execution {execution_id} stopping...")
    return StandardResponse(status="error", message="Execution not found or already finished.")

@router.delete("/{execution_id}", response_model=StandardResponse)
async def delete_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("executions:write"))
):
    stmt = select(Execution).where(Execution.id == execution_id)
    result = await db.execute(stmt)
    execution = result.scalars().first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    await db.delete(execution)
    await db.commit()
    
    return StandardResponse(status="success", message="Execution deleted successfully")
