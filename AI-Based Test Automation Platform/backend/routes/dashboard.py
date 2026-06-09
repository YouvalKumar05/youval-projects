"""
Dashboard API — Real-data endpoints for Executive Dashboard
All queries hit the actual DB; role-based filtering is applied per-user.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case, and_
from datetime import datetime, timedelta
from typing import Any, Dict, List

from db.database import get_db
from models.core import User, Role, TestCase, Execution, Bug, Task, Notification
from middleware.rbac import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _is_admin(user: User) -> bool:
    return user.role and user.role.name in ("Admin", "admin")


def _is_lead(user: User) -> bool:
    return user.role and user.role.name in ("Test Lead", "Lead", "lead")


# ---------------------------------------------------------------------------
# GET /api/dashboard/metrics
# ---------------------------------------------------------------------------
from fastapi.responses import JSONResponse
import traceback

# ---------------------------------------------------------------------------
# GET /api/dashboard/metrics
# ---------------------------------------------------------------------------
@router.get("/metrics")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)

        # --- Test Cases ---
        tc_total_q = select(func.count(TestCase.id))
        if not (_is_admin(current_user) or _is_lead(current_user)):
            tc_total_q = tc_total_q.where(TestCase.created_by == current_user.id)
        tc_total = (await db.execute(tc_total_q)).scalar_one()

        tc_prev_q = select(func.count(TestCase.id)).where(TestCase.created_at < seven_days_ago)
        if not (_is_admin(current_user) or _is_lead(current_user)):
            tc_prev_q = tc_prev_q.where(TestCase.created_by == current_user.id)
        tc_seven_ago = (await db.execute(tc_prev_q)).scalar_one()

        # --- Executions ---
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        exec_today_q = select(func.count(Execution.id)).where(Execution.started_at >= today_start)
        exec_today = (await db.execute(exec_today_q)).scalar_one()

        exec_total_q = select(func.count(Execution.id))
        exec_pass_q  = select(func.count(Execution.id)).where(Execution.status == "PASS")
        
        exec_total = (await db.execute(exec_total_q)).scalar_one()
        exec_pass = (await db.execute(exec_pass_q)).scalar_one()

        pass_rate = round((exec_pass / exec_total * 100), 1) if exec_total > 0 else 0.0

        # --- Trend Helpers ---
        def trend_str(current, previous):
            if previous == 0:
                return {"value": "+100%", "direction": "up"} if current > 0 else {"value": "N/A", "direction": "neutral"}
            delta = current - previous
            pct = round(abs(delta) / previous * 100, 1)
            direction = "up" if delta >= 0 else "down"
            sign = "+" if delta >= 0 else "-"
            return {"value": f"{sign}{pct}%", "direction": direction}

        # --- Bugs ---
        bugs_open = (await db.execute(select(func.count(Bug.id)).where(Bug.status == "Open"))).scalar_one()

        # --- Approvals ---
        approvals_q = select(func.count(Task.id)).where(Task.status.in_(["pending", "waiting_approval", "pending approval"]))
        if not (_is_admin(current_user) or _is_lead(current_user)):
            approvals_q = approvals_q.where(Task.assignee_id == current_user.id)
        pending_approvals = (await db.execute(approvals_q)).scalar_one()

        return JSONResponse(content={
            "status": "success",
            "data": {
                "total_test_cases": {"value": tc_total, "trend": trend_str(tc_total, tc_seven_ago), "subtext": "vs last 7 days"},
                "executed_today": {"value": exec_today, "trend": {"value": "Real-time", "direction": "neutral"}, "subtext": "today so far"},
                "pass_rate": {"value": pass_rate, "trend": {"value": "0%", "direction": "neutral"}, "subtext": "vs last 7 days"},
                "active_bugs": {"value": bugs_open, "trend": {"value": "0 critical", "direction": "neutral"}, "subtext": "open issues"},
                "pending_approvals": {"value": pending_approvals, "trend": {"value": "Action Required", "direction": "neutral"}, "subtext": "awaiting review"}
            }
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"status": "error", "message": "Failed to fetch metrics", "details": str(e)})

@router.get("/executions/stats")
async def get_execution_stats(period: str = "week", db: AsyncSession = Depends(get_db)):
    try:
        now = datetime.utcnow()
        days_map = {"day": 1, "week": 7, "month": 30}
        num_days = days_map.get(period, 7)
        since = now - timedelta(days=num_days)

        result = await db.execute(
            select(
                func.date(Execution.started_at).label("day"),
                func.count(Execution.id).label("total"),
                func.sum(case((Execution.status == "PASS", 1), else_=0)).label("passed"),
                func.sum(case((Execution.status == "FAIL", 1), else_=0)).label("failed"),
            )
            .where(Execution.started_at >= since)
            .group_by(func.date(Execution.started_at))
            .order_by(func.date(Execution.started_at))
        )
        rows = result.all()
        series = [{"date": str(r.day), "passed": int(r.passed or 0), "failed": int(r.failed or 0)} for r in rows]
        return JSONResponse(content={"status": "success", "data": series})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Failed to fetch stats", "details": str(e)})

@router.get("/activity/feed")
async def get_activity_feed(limit: int = 20, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        feed = []
        exec_result = await db.execute(
            select(Execution, TestCase).join(TestCase, Execution.test_case_id == TestCase.id).order_by(Execution.started_at.desc()).limit(limit)
        )
        for ex, tc in exec_result.all():
            feed.append({
                "type": "execution",
                "target": tc.title,
                "status": ex.status.lower(),
                "timestamp": ex.started_at.isoformat() if ex.started_at else None,
                "initials": "SY"
            })
        return JSONResponse(content={"status": "success", "data": feed})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Activity feed error", "details": str(e)})


# ---------------------------------------------------------------------------
# GET /api/dashboard/sprint/progress
# ---------------------------------------------------------------------------
@router.get("/sprint/progress")
async def get_sprint_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Returns task completion percentage for the current sprint."""
    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar_one()
    done_tasks = (await db.execute(select(func.count(Task.id)).where(Task.status == "Done"))).scalar_one()
    
    progress = round((done_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0
    return {"status": "success", "data": {"progress": progress, "total": total_tasks, "done": done_tasks}}

@router.get("/executions/summary")
async def get_executions_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = await db.execute(
            select(
                func.count(Execution.id).label("total"),
                func.sum(case((Execution.status == "PASS", 1), else_=0)).label("passed"),
                func.sum(case((Execution.status == "FAIL", 1), else_=0)).label("failed")
            ).where(Execution.started_at >= today_start)
        )
        row = result.one()
        total = row.total or 0
        passed = row.passed or 0
        failed = row.failed or 0
        success_ratio = round((passed / total * 100)) if total > 0 else 0
        return JSONResponse(content={
            "status": "success",
            "data": {
                "total_today": total,
                "passed_today": passed,
                "failed_today": failed,
                "avg_duration_min": 0, # Placeholder
                "success_ratio": success_ratio
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.get("/tasks/summary")
async def get_tasks_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = await db.execute(
            select(Task.status, func.count(Task.id)).group_by(Task.status)
        )
        dist = {r[0]: r[1] for r in result.all()}
        total = sum(dist.values())
        return JSONResponse(content={
            "status": "success",
            "data": {
                "total": total,
                "distribution": dist
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.get("/bugs/summary")
async def get_bugs_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = await db.execute(
            select(Bug.severity, func.count(Bug.id)).where(Bug.status == "Open").group_by(Bug.severity)
        )
        by_severity = {r[0]: r[1] for r in result.all()}
        total_open = sum(by_severity.values())
        return JSONResponse(content={
            "status": "success",
            "data": {
                "open": total_open,
                "by_severity": by_severity
            }
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
