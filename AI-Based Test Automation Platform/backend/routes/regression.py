"""
Regression API — Real STLC regression lifecycle management.
Queries actual executions, bugs, tasks and test_cases from PostgreSQL.
"""

from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, and_, text

from db.database import get_db
from models.core import User, TestCase, Execution, Bug, Task
from schemas.api_models import StandardResponse, TriggerExecutionRequest
from middleware.rbac import get_current_user
from services.playwright_service import PlaywrightService
from routes.ws import manager, broadcast_dashboard_event

import asyncio

router = APIRouter(prefix="/api/regression", tags=["regression"])


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/regression/failed-tests
# All test cases that have at least one FAIL execution.
# Enriched with bug linkage and failure frequency.
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/failed-tests", response_model=StandardResponse)
async def get_failed_tests(
    project: Optional[str] = Query(None),
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Subquery: count fails per test case, get most recent fail
    try:
        result = await db.execute(
            text("""
                SELECT
                    tc.id                           AS test_case_id,
                    tc.title,
                    tc.project_id,
                    COUNT(e.id) FILTER (WHERE e.status = 'FAIL') AS fail_count,
                    COUNT(e.id) FILTER (WHERE e.status = 'PASS') AS pass_count,
                    MAX(e.started_at)               AS last_run,
                    MAX(e.started_at) FILTER (WHERE e.status = 'FAIL') AS last_failed,
                    CASE
                        WHEN COUNT(e.id) FILTER (WHERE e.status = 'FAIL') > 0
                         AND COUNT(e.id) FILTER (WHERE e.status = 'PASS') > 0
                        THEN TRUE ELSE FALSE
                    END                             AS is_flaky,
                    (SELECT e2.id FROM executions e2
                     WHERE e2.test_case_id = tc.id
                     ORDER BY e2.started_at DESC LIMIT 1) AS latest_exec_id,
                    (SELECT e2.status FROM executions e2
                     WHERE e2.test_case_id = tc.id
                     ORDER BY e2.started_at DESC LIMIT 1) AS latest_status
                FROM test_cases tc
                JOIN executions e ON e.test_case_id = tc.id
                WHERE e.started_at >= :cutoff
                  AND e.status = 'FAIL'
                GROUP BY tc.id, tc.title, tc.project_id
                ORDER BY fail_count DESC
            """),
            {"cutoff": cutoff}
        )
        rows = result.fetchall()
    except Exception as e:
        return StandardResponse(status="error", message=str(e), data=[])

    # Fetch linked bugs per test case via executions
    bug_map: dict = {}
    try:
        bug_result = await db.execute(
            text("""
                SELECT b.id, b.title, b.severity, b.status, e.test_case_id, u.email AS assigned_to
                FROM bugs b
                JOIN executions e ON e.id = b.execution_id
                LEFT JOIN users u ON u.id = b.assigned_to
                WHERE e.started_at >= :cutoff
            """),
            {"cutoff": cutoff}
        )
        for bug in bug_result.fetchall():
            tc_id = bug.test_case_id
            if tc_id not in bug_map:
                bug_map[tc_id] = []
            bug_map[tc_id].append({
                "id": bug.id,
                "title": bug.title,
                "severity": bug.severity,
                "status": bug.status,
                "assigned_to": bug.assigned_to,
            })
    except Exception:
        pass

    data = []
    for row in rows:
        if project and row.project_id != project:
            continue
        data.append({
            "test_case_id": row.test_case_id,
            "title": row.title,
            "project_id": row.project_id,
            "fail_count": row.fail_count,
            "pass_count": row.pass_count,
            "last_failed": row.last_failed.isoformat() if row.last_failed else None,
            "last_run": row.last_run.isoformat() if row.last_run else None,
            "is_flaky": bool(row.is_flaky),
            "latest_exec_id": row.latest_exec_id,
            "latest_status": row.latest_status,
            "bugs": bug_map.get(row.test_case_id, []),
        })

    return StandardResponse(status="success", data=data)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/regression/compare/{test_case_id}
# Returns last 2 executions for a test case (before vs after comparison)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/compare/{test_case_id}", response_model=StandardResponse)
async def compare_executions(
    test_case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Execution)
        .where(Execution.test_case_id == test_case_id)
        .order_by(desc(Execution.started_at))
        .limit(2)
    )
    result = await db.execute(stmt)
    execs = result.scalars().all()

    def serialize(ex: Execution):
        duration = None
        if ex.started_at and ex.completed_at:
            secs = int((ex.completed_at - ex.started_at).total_seconds())
            duration = f"{secs // 60}m {secs % 60}s"
        return {
            "id": ex.id,
            "status": ex.status,
            "started_at": ex.started_at.isoformat() if ex.started_at else None,
            "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
            "duration": duration,
            "logs": ex.logs or [],
            "step_results": ex.step_results or [],
            "logs_path": ex.logs_path,
        }

    after  = serialize(execs[0]) if len(execs) > 0 else None
    before = serialize(execs[1]) if len(execs) > 1 else None

    return StandardResponse(status="success", data={"before": before, "after": after})


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/regression/stats  — Summary analytics
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/stats", response_model=StandardResponse)
async def get_regression_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    week_ago = datetime.utcnow() - timedelta(days=7)

    total_fail = (await db.execute(
        select(func.count(Execution.id)).where(Execution.status == "FAIL")
    )).scalar_one()

    open_bugs = (await db.execute(
        select(func.count(Bug.id)).where(Bug.status == "Open")
    )).scalar_one()

    total_tc = (await db.execute(select(func.count(TestCase.id)))).scalar_one()

    # Flaky tests: have both PASS and FAIL in last 7 days
    try:
        flaky_result = await db.execute(
            text("""
                SELECT COUNT(*) FROM (
                    SELECT test_case_id
                    FROM executions
                    WHERE started_at >= :cutoff
                    GROUP BY test_case_id
                    HAVING COUNT(*) FILTER (WHERE status = 'PASS') > 0
                       AND COUNT(*) FILTER (WHERE status = 'FAIL') > 0
                ) sub
            """),
            {"cutoff": week_ago}
        )
        flaky_count = flaky_result.scalar() or 0
    except Exception:
        flaky_count = 0

    return StandardResponse(status="success", data={
        "total_failures": total_fail,
        "open_bugs": open_bugs,
        "total_test_cases": total_tc,
        "flaky_tests": flaky_count,
    })


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/regression/rerun/{test_case_id}
# Trigger a fresh Playwright execution and return execution_id
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/rerun/{test_case_id}", response_model=StandardResponse)
async def rerun_test(
    test_case_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(TestCase).where(TestCase.id == test_case_id)
    result = await db.execute(stmt)
    test_case = result.scalars().first()

    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")

    execution = Execution(test_case_id=test_case_id, status="Running")
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    await broadcast_dashboard_event({
        "type": "execution", "status": "started", "execution_id": execution.id
    })

    svc = PlaywrightService(db)

    async def on_event(evt):
        await manager.broadcast_to_execution(execution.id, evt)

    background_tasks.add_task(
        PlaywrightService.run_in_background, execution.id, test_case.id, {"headless": True, "browser_type": "chromium", "delay": 2.0}, on_event
    )

    return StandardResponse(
        status="success",
        message="Regression re-run triggered",
        data={"execution_id": execution.id}
    )
