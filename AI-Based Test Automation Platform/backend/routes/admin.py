from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, or_
from typing import List, Optional
from datetime import datetime, timedelta

from db.database import get_db, engine
from models.core import User, Role, TestCase, Execution, Bug, Workflow, WorkflowInstance, AuditLog
from schemas.api_models import StandardResponse
from middleware.rbac import require_permission, get_current_user
import json

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/overview", response_model=StandardResponse)
async def get_overview(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("admin:read"))):
    today = datetime.utcnow().date()
    
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_test_cases = (await db.execute(select(func.count(TestCase.id)))).scalar_one()
    
    # Executions started today
    exec_stmt = select(func.count(Execution.id)).where(Execution.started_at >= today)
    executions_today = (await db.execute(exec_stmt)).scalar_one()
    
    # Failed tests today
    failed_stmt = select(func.count(Execution.id)).where(Execution.started_at >= today, Execution.status == "FAIL")
    failed_tests = (await db.execute(failed_stmt)).scalar_one()

    # Open bugs
    open_bugs_stmt = select(func.count(Bug.id)).where(Bug.status == "Open")
    open_bugs = (await db.execute(open_bugs_stmt)).scalar_one()

    # Simulate active sessions (for example, users created/active recently)
    active_sessions = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar_one()

    # Recent activity feed
    activity_stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10)
    activity_res = await db.execute(activity_stmt)
    activities = []
    
    for activity in activity_res.scalars().all():
        # Get user email
        user_email = "System"
        if activity.user_id:
            user_stmt = select(User).where(User.id == activity.user_id)
            user_rec = (await db.execute(user_stmt)).scalar_one_or_none()
            if user_rec:
                user_email = user_rec.email
                
        activities.append({
            "id": activity.id,
            "user": user_email,
            "action": activity.action,
            "resource": activity.resource,
            "timestamp": activity.timestamp.isoformat() if activity.timestamp else None
        })

    return StandardResponse(status="success", data={
        "total_users": total_users,
        "active_sessions": active_sessions,
        "total_test_cases": total_test_cases,
        "executions_today": executions_today,
        "failed_tests": failed_tests,
        "open_bugs": open_bugs,
        "recent_activity": activities
    })

@router.get("/users", response_model=StandardResponse)
async def get_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("admin:read"))):
    stmt = select(User, Role.name.label("role_name")).outerjoin(Role, User.role_id == Role.id).order_by(User.id.desc())
    result = await db.execute(stmt)
    users = result.all()
    
    data = []
    for u, role_name in users:
        data.append({
            "id": u.id,
            "email": u.email,
            "role": role_name or "None",
            "status": "Active" if u.is_active else "Disabled",
            "last_active": u.created_at.isoformat() if u.created_at else None
        })
        
    return StandardResponse(status="success", data=data)

@router.get("/system-health", response_model=StandardResponse)
async def get_system_health(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("admin:read"))):
    # Determine DB Status
    db_status = "Healthy"
    try:
        await db.execute(select(1))
    except Exception:
        db_status = "Critical"

    # Execution Engine check
    pending_execs = (await db.execute(select(func.count(Execution.id)).where(Execution.status == "Running"))).scalar_one()
    engine_status = "Healthy" if pending_execs < 50 else "Warning"
    
    # Active workflows
    active_workflows = (await db.execute(select(func.count(WorkflowInstance.id)).where(WorkflowInstance.current_state != "Completed"))).scalar_one()

    return StandardResponse(status="success", data={
        "api_response_time": "12ms", # Simulated metric for now
        "db_connection": db_status,
        "execution_engine": engine_status,
        "pending_executions": pending_execs,
        "active_workflows": active_workflows
    })

@router.get("/workflows", response_model=StandardResponse)
async def get_admin_workflows(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("admin:read"))):
    stmt = select(Workflow).order_by(Workflow.created_at.desc())
    workflows = (await db.execute(stmt)).scalars().all()
    
    data = []
    for w in workflows:
        # Get count of instances for this workflow
        instances_stmt = select(func.count(WorkflowInstance.id)).where(WorkflowInstance.workflow_id == w.id)
        trigger_count = (await db.execute(instances_stmt)).scalar_one()
        
        data.append({
            "id": w.id,
            "name": w.name,
            "trigger_count": trigger_count,
            "success_rate": "100%", # Simplify for now
            "last_executed": w.created_at.isoformat() if w.created_at else None
        })
        
    return StandardResponse(status="success", data=data)

@router.get("/logs", response_model=StandardResponse)
async def get_audit_logs(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("admin:read"))):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100)
    logs = (await db.execute(stmt)).scalars().all()
    
    data = []
    for log in logs:
        # Resolve user
        user_email = "System"
        if log.user_id:
            user_rec = (await db.execute(select(User).where(User.id == log.user_id))).scalar_one_or_none()
            if user_rec:
                user_email = user_rec.email
                
        data.append({
            "id": log.id,
            "user": user_email,
            "action": log.action,
            "resource": log.resource,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        })
        
    return StandardResponse(status="success", data=data)

@router.get("/ai-insights", response_model=StandardResponse)
async def get_ai_insights(current_user: User = Depends(require_permission("admin:read"))):
    # Simulated AI suggestions based on system patterns
    insights = [
        {"id": 1, "type": "warning", "message": "High failure rate on 'Login Flow v2'. Consider increasing test timeout.", "action": "View Tests"},
        {"id": 2, "type": "info", "message": "'Regression Suite' execution time increased by 15%. Parallelization recommended.", "action": "Optimize Config"},
        {"id": 3, "type": "suggestion", "message": "Multiple unassigned High severity bugs detected. Route automatically?", "action": "Setup Workflow"}
    ]
    return StandardResponse(status="success", data=insights)
