from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from db.database import get_db
from models.core import User, Workflow
from schemas.api_models import StandardResponse, WorkflowCreate, WorkflowUpdate
from middleware.rbac import require_permission
from workflow_engine.engine import WorkflowEngine, STLCWorkflowOrchestrator
from workflow_engine.pipeline_orchestrator import orchestrator

router = APIRouter(prefix="/api/workflows", tags=["workflows"])

@router.get("", response_model=StandardResponse)
async def list_workflows(db: AsyncSession = Depends(get_db)):
    stmt = select(Workflow).order_by(Workflow.id.desc())
    result = await db.execute(stmt)
    workflows = result.scalars().all()
    
    data = []
    for wf in workflows:
        data.append({
            "id": wf.id,
            "name": wf.name,
            "description": wf.description,
            "trigger_event": wf.trigger_event,
            "ast_json": wf.ast_json,
            "created_at": wf.created_at.isoformat() if wf.created_at else None
        })
    return StandardResponse(status="success", data=data)

@router.post("/", response_model=StandardResponse)
async def create_workflow(workflow_data: WorkflowCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("workflows:create"))):
    new_workflow = Workflow(
        name=workflow_data.name,
        description=workflow_data.description,
        trigger_event=workflow_data.trigger_event,
        ast_json=workflow_data.ast_json
    )
    db.add(new_workflow)
    await db.commit()
    await db.refresh(new_workflow)
    
    data = {
        "id": new_workflow.id,
        "name": new_workflow.name,
        "description": new_workflow.description,
        "trigger_event": new_workflow.trigger_event,
        "ast_json": new_workflow.ast_json,
        "created_at": new_workflow.created_at.isoformat() if new_workflow.created_at else None
    }
    return StandardResponse(status="success", message="Workflow created successfully", data=data)

@router.put("/{workflow_id}", response_model=StandardResponse)
async def update_workflow(workflow_id: int, workflow_data: WorkflowUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("workflows:edit"))):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await db.execute(stmt)
    workflow = result.scalars().first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    if workflow_data.name is not None:
        workflow.name = workflow_data.name
    if workflow_data.description is not None:
        workflow.description = workflow_data.description
    if workflow_data.trigger_event is not None:
        workflow.trigger_event = workflow_data.trigger_event
    if workflow_data.ast_json is not None:
        workflow.ast_json = workflow_data.ast_json
        
    await db.commit()
    await db.refresh(workflow)
    return StandardResponse(status="success", message="Workflow updated successfully")

@router.delete("/{workflow_id}", response_model=StandardResponse)
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("workflows:edit"))):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await db.execute(stmt)
    workflow = result.scalars().first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    await db.delete(workflow)
    await db.commit()
    return StandardResponse(status="success", message="Workflow deleted successfully")

@router.post("/{event_name}/trigger", response_model=StandardResponse)
async def manual_trigger_workflow(event_name: str, payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("workflows:execute"))):
    engine = WorkflowEngine(db)
    
    # Normally target entity comes from event logic
    target_type = payload.get("target_type", "manual_trigger")
    target_id = payload.get("target_id", 0)
    
    await engine.trigger_event(event_name, target_type, target_id, payload)
    
    return StandardResponse(status="success", message=f"Trigger '{event_name}' executed via workflow engine.")

@router.post("/generate", response_model=StandardResponse)
async def generate_workflow_from_text(payload: dict, db: AsyncSession = Depends(get_db)):
    """Convert natural language to a workflow AST using AI."""
    import os
    import json
    from groq import AsyncGroq
    
    prompt = payload.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return StandardResponse(status="error", message="GROQ_API_KEY is not configured.")
        
    system_instruction = """
    You are an AI that converts user requests into a Workflow AST JSON.
    Available Node Types: trigger, condition, action, delay, retry
    Action Types: create_bug, notify_slack, send_email, log_dashboard, capture_screenshot, retry_test
    Return ONLY valid JSON matching this schema:
    {
      "trigger_event": "...",
      "ast_json": {
         "ui": {
            "nodes": [ { "id": "...", "type": "...", "position": {"x":0, "y":0}, "data": { "label": "...", "config": {} } } ],
            "edges": [ { "id": "...", "source": "...", "target": "...", "label": "TRUE" } ]
         }
      }
    }
    """
    try:
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1
        )
        content = response.choices[0].message.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        workflow_data = json.loads(content)
        return StandardResponse(status="success", message="Workflow generated", data=workflow_data)
    except Exception as e:
        return StandardResponse(status="error", message=f"Failed to generate workflow: {str(e)}")

# ── Pipeline Orchestration ───────────────────────────────────────────────────

@router.post("/pipeline/run")
async def run_pipeline(payload: dict = {}):
    # Start thread/task for background execution
    import asyncio
    input_text = payload.get("input", "Standard Test Run")
    asyncio.create_task(orchestrator.run_full_workflow(input_text))
    return {"status": "success", "message": "Pipeline execution started"}

@router.get("/pipeline/status")
async def get_pipeline_status():
    return orchestrator.get_status()

    return {"status": "success", "message": "Pipeline state reset"}

@router.post("/stlc/run", response_model=StandardResponse)
async def run_stlc_pipeline(payload: dict, db: AsyncSession = Depends(get_db)):
    """Runs the full linear pipeline: Analysis -> Generation -> Execution -> Reporting."""
    orchestrator = STLCWorkflowOrchestrator(db)
    input_text = payload.get("requirement_text", "")
    project_name = payload.get("project_name", "Auto-Project")
    
    if not input_text:
        throw = HTTPException(status_code=400, detail="Requirement text is required")
    
    result = await orchestrator.run_pipeline(input_text, project_name)
    return StandardResponse(status=result["status"], data=result)
