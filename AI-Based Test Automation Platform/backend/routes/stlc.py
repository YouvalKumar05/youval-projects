from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
import traceback

from db.database import get_db
from models.core import User, TestCase, ConnectionConfig, Analysis, Execution
from schemas.api_models import StandardResponse
from middleware.rbac import require_permission
from services.ai_service import AIService

from workflow_engine.engine import WorkflowEngine
from fastapi import BackgroundTasks
from services.playwright_service import PlaywrightService
from routes.ws import manager
from utils.json_utils import safe_json_parse
from fastapi.responses import JSONResponse
import json

router = APIRouter(prefix="/api/requirements", tags=["requirements"])
ai_svc = AIService()

import traceback
import os
import glob

def extract_text_from_uploads():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(base_dir, "data", "uploads")
    if not os.path.exists(upload_dir):
        return ""
    
    texts = []
    # Get all files and read their content
    for filepath in glob.glob(os.path.join(upload_dir, "*")):
        if os.path.isfile(filepath):
            try:
                ext = os.path.splitext(filepath)[1].lower()
                if ext in ['.txt', '.json', '.yaml', '.yml', '.md']:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        texts.append(f"Content from {os.path.basename(filepath)}:\n{f.read()}")
                # Basic support for other types could be added here
            except Exception as e:
                print(f"DEBUG: Could not read {filepath}: {e}")
    
    return "\n\n".join(texts)

def clear_uploads():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(base_dir, "data", "uploads")
    if os.path.exists(upload_dir):
        for f in glob.glob(os.path.join(upload_dir, "*")):
            try: os.remove(f)
            except: pass


@router.post("/analyze")
async def analyze_requirements(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("testcases:write"))):
    print(f"DEBUG: Processing analysis request at {datetime.now()}")
    try:
        requirement_text = payload.get("requirementText", "")
        
        # If text is empty, try to extract from uploaded documents
        if not requirement_text:
            print("DEBUG: Requirement text empty, checking uploads...")
            requirement_text = extract_text_from_uploads()
            
        if not requirement_text:
            return JSONResponse(status_code=400, content={
                "status": "error",
                "message": "No requirements found. Please provide text input or upload documents."
            })
        
        print(f"DEBUG: Requirement text length: {len(requirement_text)}")
        
        # 1. AI Analysis Phase
        try:
            analysis_result = ai_svc.analyze_requirement(
                requirement_text, 
                payload.get("projectId"),
                config=payload.get("config")
            )
            if isinstance(analysis_result, str):
                analysis_result = safe_json_parse(analysis_result)
            
            if not analysis_result:
                raise ValueError("AI Service returned empty or invalid response")
                
        except Exception as ai_e:
            print(f"ERROR: AI Phase failed: {str(ai_e)}")
            return JSONResponse(status_code=502, content={
                "status": "error",
                "message": "AI Engine failed to process requirement",
                "details": str(ai_e)
            })

        # 2. Database Persistence Phase
        try:
            # Ensure types are correct for DB
            r_score = 0
            try: r_score = int(analysis_result.get("riskScore", 0))
            except: pass
            
            c_pct = 0
            try: c_pct = int(analysis_result.get("coveragePct", 0))
            except: pass

            # 1.5 Pre-generate scripts for all scenarios directly in the Analysis JSON
            from services.rag_script_generator import RAGScriptGenerator
            from db.database import AsyncSessionLocal
            import asyncio
            
            scenarios = analysis_result.get("scenarios", [])
            sem = asyncio.Semaphore(10)  # Increased concurrency for faster processing
            
            async def generate_for_scenario(scenario):
                async with sem:
                    async with AsyncSessionLocal() as session:
                        generator = RAGScriptGenerator(session)
                        temp_tc = TestCase(
                            title=scenario.get("title", "Generated Test Case"),
                            steps_json=scenario,
                            project_id=str(payload.get("projectName", "default"))
                        )
                        script = await generator.generate_script(temp_tc, base_url=payload.get("baseUrl"))
                        scenario["script"] = script

            if scenarios:
                await asyncio.gather(*(generate_for_scenario(s) for s in scenarios))
                
            config = payload.get("config", {})
            config["baseUrl"] = payload.get("baseUrl")

            new_analysis = Analysis(
                project_name=payload.get("projectName", "default"),
                requirement_text=requirement_text,
                scenarios=scenarios,
                risk_score=r_score,
                coverage_pct=c_pct,
                status="Pending",
                config_json=config
            )
            db.add(new_analysis)
            await db.commit()
            await db.refresh(new_analysis)
            
            # Clear uploads after successful processing
            clear_uploads()
            
            return JSONResponse(content={
                "status": "success",
                "data": {
                    "analysis_id": new_analysis.id, 
                    "risk": new_analysis.risk_score
                }
            })
        except Exception as db_e:
            traceback.print_exc()
            print(f"ERROR: DB Phase failed: {str(db_e)}")
            return JSONResponse(status_code=500, content={
                "status": "error",
                "message": f"Database Error: {str(db_e)}"
            })

    except Exception as e:
        traceback.print_exc()
        print(f"ERROR: General Analysis Failure: {str(e)}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": f"Analysis failed: {str(e)}"
        })

@router.get("/analysis/{analysis_id}", response_model=StandardResponse)
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    
    return StandardResponse(status="success", data={
        "id": analysis.id,
        "project_name": analysis.project_name,
        "requirement_text": analysis.requirement_text,
        "scenarios": analysis.scenarios,
        "risk_score": analysis.risk_score,
        "coverage_pct": analysis.coverage_pct,
        "status": analysis.status
    })


@router.delete("/analysis/{analysis_id}/scenario/{scenario_index}")
async def delete_scenario(
    analysis_id: int,
    scenario_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Analysis not found"})
    if analysis.status == "Approved":
        return JSONResponse(status_code=400, content={"status": "error", "message": "Cannot modify approved analysis. Re-analyze to make changes."})
    scenarios = analysis.scenarios
    if isinstance(scenarios, str):
        try: scenarios = json.loads(scenarios)
        except: scenarios = []
    if not (0 <= scenario_index < len(scenarios)):
        return JSONResponse(status_code=400, content={"status": "error", "message": "Invalid scenario index"})
    scenarios.pop(scenario_index)
    stmt_upd = update(Analysis).where(Analysis.id == analysis_id).values(scenarios=scenarios)
    await db.execute(stmt_upd)
    await db.commit()
    return JSONResponse(content={"status": "success", "data": {"message": "Scenario deleted", "scenarios": scenarios}})

@router.delete("/analysis/{analysis_id}")
async def delete_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    # 1. Fetch analysis to get project name
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Analysis not found"})
    
    project_name = analysis.project_name.strip()
    
    try:
        from sqlalchemy import delete, func
        from models.core import TestCase, Execution, Task, Bug, Project
        
        # 2. Get all test case IDs for this project to cleanup tasks later
        # Use trimmed match for robustness
        tc_stmt = select(TestCase.id).where(func.trim(TestCase.project_id) == project_name)
        tc_result = await db.execute(tc_stmt)
        tc_ids = [r for r in tc_result.scalars().all()]
        
        # 3. Delete related Tasks (testcase references)
        if tc_ids:
            # Also find all executions and bugs for these test cases to cleanup their tasks
            exec_stmt = select(Execution.id).where(Execution.test_case_id.in_(tc_ids))
            exec_result = await db.execute(exec_stmt)
            exec_ids = [r for r in exec_result.scalars().all()]
            
            if exec_ids:
                bug_stmt = select(Bug.id).where(Bug.execution_id.in_(exec_ids))
                bug_result = await db.execute(bug_stmt)
                bug_ids = [r for r in bug_result.scalars().all()]
                
                if bug_ids:
                    await db.execute(delete(Task).where(Task.reference_type == 'bug', Task.reference_id.in_(bug_ids)))
            
            await db.execute(delete(Task).where(Task.reference_type == 'testcase', Task.reference_id.in_(tc_ids)))
        
        # 4. Delete TestCases (cascades to Executions and Bugs)
        await db.execute(delete(TestCase).where(func.trim(TestCase.project_id) == project_name))
        
        # 5. Delete from Projects table if it exists
        await db.execute(delete(Project).where(func.trim(Project.name) == project_name))
        
        # 6. Delete the Analysis itself
        await db.execute(delete(Analysis).where(Analysis.id == analysis_id))
        
        await db.commit()
        return JSONResponse(content={"status": "success", "message": f"Project '{project_name}' and all associated records deleted successfully"})
        
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"status": "error", "message": f"Deletion failed: {str(e)}"})


@router.put("/analysis/{analysis_id}/scenarios", response_model=StandardResponse)
async def update_analysis_scenarios(
    analysis_id: int,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write"))
):
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    scenarios = payload.get("scenarios")
    if scenarios is not None:
        analysis.scenarios = scenarios
        
    await db.commit()
    return StandardResponse(status="success", message="Scenarios updated successfully")

@router.post("/analysis/{analysis_id}/approve")
async def approve_analysis(
    analysis_id: int, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(require_permission("testcases:write"))
):
    print("APPROVE API HIT")
    print(f"Incoming Analysis ID: {analysis_id}")
    try:
        stmt = select(Analysis).where(Analysis.id == analysis_id)
        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            return JSONResponse(status_code=404, content={"status": "error", "message": "Analysis not found"})
        
        if analysis.status != "Pending":
            return JSONResponse(status_code=400, content={"status": "error", "message": f"Analysis is already {analysis.status}"})

        # 1. Convert Scenarios to TestCases and create Executions
        created_tc_ids = []
        created_execution_ids = []
        
        scenarios = analysis.scenarios
        if isinstance(scenarios, str):
            try: scenarios = json.loads(scenarios)
            except: scenarios = []
            
        if not scenarios:
            return JSONResponse(status_code=400, content={"status": "error", "message": "No scenarios found in analysis to approve"})

        for scenario in scenarios:
            # Safe title extraction
            title = scenario.get("title") or scenario.get("testCaseId") or "Generated Test Case"
            
            new_test = TestCase(
                project_id=str(analysis.project_name).strip()[:100], # ensure string length and trim
                title=title,
                steps_json=scenario,
                created_by=current_user.id,
                is_approved=True
            )
            db.add(new_test)
            await db.flush() # Get test case ID
            created_tc_ids.append(new_test.id)

            # 2. Create Initial Execution Record for the flow
            new_execution = Execution(
                test_case_id=new_test.id,
                status="Pending",
                logs=[],
                step_results=[]
            )
            db.add(new_execution)
            await db.flush()
            created_execution_ids.append(new_execution.id)

        # 3. Update Analysis Status
        analysis.status = "Approved"
        analysis.approved_by = current_user.id
        
        # 4. Trigger Workflow Engine (Safe Call)
        try:
            engine = WorkflowEngine(db)
            await engine.trigger_event(
                "analysis_approved", 
                "analysis", 
                analysis.id, 
                {"project": analysis.project_name, "testcase_count": len(created_tc_ids)}
            )
        except Exception as workflow_e:
            print(f"WARNING: Workflow trigger failed during approval: {workflow_e}")

        await db.commit()
        
        # 5. Pre-Generate Playwright Scripts in Background
        from services.rag_script_generator import RAGScriptGenerator
        from db.database import AsyncSessionLocal
        from sqlalchemy import update
        
        async def pre_generate_scripts(tc_ids, base_url=None):
            sem = asyncio.Semaphore(10)
            
            async def process_tc(tc_id):
                async with sem:
                    async with AsyncSessionLocal() as session:
                        generator = RAGScriptGenerator(session)
                        try:
                            stmt = select(TestCase).where(TestCase.id == tc_id)
                            res = await session.execute(stmt)
                            tc = res.scalars().first()
                            if tc and not tc.steps_json.get("script"):
                                script = await generator.generate_script(tc, base_url=base_url)
                                steps = tc.steps_json
                                steps["script"] = script
                                await session.execute(update(TestCase).where(TestCase.id == tc_id).values(steps_json=steps))
                                await session.commit()
                        except Exception as e:
                            print(f"Pre-generation failed for tc {tc_id}: {e}")
                            
            if tc_ids:
                await asyncio.gather(*(process_tc(tc_id) for tc_id in tc_ids))
                        
        # The user requested that the scripts be generated completely PRE-HAND before navigating to the dashboard.
        # We will block the API and await the generation here instead of doing it in the background.
        analysis_config = analysis.config_json or {}
        analysis_base_url = analysis_config.get("baseUrl")
        await pre_generate_scripts(created_tc_ids, base_url=analysis_base_url)
        
        print(f"SUCCESS: Analysis {analysis_id} approved. Created {len(created_tc_ids)} test cases.")
        
        return JSONResponse(content={
            "status": "success", 
            "message": f"Approved successfully. {len(created_tc_ids)} test cases ready for execution.",
            "data": {
                "analysis_id": analysis.id,
                "test_case_ids": created_tc_ids,
                "execution_ids": created_execution_ids,
                "redirect_url": f"/execution-dashboard?auto_run={created_execution_ids[0]}" if created_execution_ids else "/execution-dashboard"
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Approval process failed",
            "details": str(e)
        })

@router.get("/analyses", response_model=StandardResponse)
async def list_analyses(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("testcases:read"))):
    stmt = select(Analysis).order_by(Analysis.created_at.desc())
    result = await db.execute(stmt)
    analyses = result.scalars().all()
    return StandardResponse(status="success", data=[{
        "id": a.id,
        "project_name": a.project_name,
        "requirement_text": a.requirement_text[:100] + "...",
        "risk_score": a.risk_score,
        "coverage_pct": a.coverage_pct,
        "status": a.status,
        "created_at": a.created_at
    } for a in analyses])


@router.get("/testcases", response_model=StandardResponse)
async def list_test_cases(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("testcases:read"))):
    stmt = select(TestCase)
    result = await db.execute(stmt)
    test_cases = result.scalars().all()
    return StandardResponse(status="success", data=[{"id": tc.id, "title": tc.title, "steps_json": tc.steps_json} for tc in test_cases])
@router.get("/approved-scenario/{test_case_id}", response_model=StandardResponse)
async def get_approved_scenario(test_case_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(TestCase).where(TestCase.id == test_case_id)
    result = await db.execute(stmt)
    tc = result.scalar_one_or_none()
    if not tc:
        raise HTTPException(status_code=404, detail="Approved test case not found")
    
    return StandardResponse(status="success", data={
        "id": tc.id,
        "title": tc.title,
        "project": tc.project_id,
        "scenarios": tc.steps_json,
        "created_at": tc.created_at
    })
