"""
Enterprise Reports API — Optimized, Secure, Scalable
"""

import csv
import io
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, case, text

from db.database import get_db
from models.core import TestCase, Execution, Bug
from middleware.rbac import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ─────────────────────────────────────────────
# SUMMARY KPI
# ─────────────────────────────────────────────
@router.get("/summary")
async def get_report_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        result = await db.execute(
            select(
                func.count(TestCase.id),
                func.count(Execution.id),
                func.sum(case((Execution.status == "PASS", 1), else_=0)),
                func.sum(case((Execution.status == "FAIL", 1), else_=0)),
                func.count(Bug.id)
            )
            .select_from(TestCase)
            .join(Execution, isouter=True)
            .join(Bug, isouter=True)
        )

        total_tc, total_exec, pass_count, fail_count, active_bugs = result.one()

        pass_rate = round((pass_count / total_exec * 100), 2) if total_exec else 0

        return {
            "status": "success",
            "data": {
                "total_test_cases": total_tc or 0,
                "total_executions": total_exec or 0,
                "pass_count": pass_count or 0,
                "fail_count": fail_count or 0,
                "pass_rate": pass_rate,
                "active_bugs": active_bugs or 0
            }
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Summary failed",
            "details": str(e)
        })


# ─────────────────────────────────────────────
# BUG REPORT
# ─────────────────────────────────────────────
@router.get("/bugs")
async def get_bugs_report(
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        stmt = select(Bug).order_by(desc(Bug.created_at))
        if severity and severity.strip():
            stmt = stmt.where(Bug.severity == severity)
        result = await db.execute(stmt)
        bugs = result.scalars().all()
        data = []
        for b in bugs:
            data.append({
                "id": b.id,
                "title": b.title,
                "severity": b.severity,
                "status": b.status,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            })
        return {"status": "success", "data": data}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Bug report failed",
            "details": str(e)
        })


# ─────────────────────────────────────────────
# EXECUTION REPORT (WITH PAGINATION)
# ─────────────────────────────────────────────
@router.get("/executions")
async def get_execution_report(
    status: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(50),
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        stmt = (
            select(Execution, TestCase.title, TestCase.project_id)
            .join(TestCase)
            .where(Execution.started_at >= cutoff)
            .order_by(desc(Execution.started_at))
            .offset((page - 1) * limit)
            .limit(limit)
        )

        if status and status not in ("All", ""):
            stmt = stmt.where(Execution.status == status)

        result = await db.execute(stmt)

        data = []
        for ex, title, project_id in result:
            # Compute duration
            duration = None
            if ex.started_at and ex.completed_at:
                secs = int((ex.completed_at - ex.started_at).total_seconds())
                duration = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"

            # Compute step pass/fail counts
            steps = ex.step_results or []
            step_count = len(steps)
            pass_steps = len([s for s in steps if s.get("status") == "PASS"])

            data.append({
                "id": ex.id,
                "test_case_title": title,
                "project_id": project_id or "—",
                "status": ex.status,
                "duration": duration,
                "step_count": step_count,
                "pass_steps": pass_steps,
                "started_at": ex.started_at.isoformat() if ex.started_at else None,
                "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
                "logs_path": ex.logs_path,
                "screenshot_path": ex.logs_path,  # logs_path stores the screenshot path
                "step_results": steps,
            })

        return {"status": "success", "page": page, "limit": limit, "data": data}

    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Execution report failed",
            "details": str(e)
        })


# ─────────────────────────────────────────────
# TRENDS (PASS vs FAIL + CHARTS)
# ─────────────────────────────────────────────
@router.get("/trends")
async def get_trends(
    days: int = Query(14),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        # 1. Execution trend per day
        query = text("""
            SELECT DATE(started_at) as day,
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
                   SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as fail_count
            FROM executions
            WHERE started_at >= :cutoff
            GROUP BY DATE(started_at)
            ORDER BY day
        """)
        result = await db.execute(query, {"cutoff": cutoff})

        execution_trend = []
        total_pass = 0
        total_fail = 0
        for r in result:
            execution_trend.append({
                "date": str(r.day),
                "total": r.total,
                "passed": r.pass_count,
                "failed": r.fail_count
            })
            total_pass += (r.pass_count or 0)
            total_fail += (r.fail_count or 0)

        # 2. Bug severity distribution
        sev_result = await db.execute(
            select(Bug.severity, func.count(Bug.id))
            .group_by(Bug.severity)
        )
        severity_distribution = []
        for sev, cnt in sev_result:
            severity_distribution.append({
                "severity": sev or "Unknown",
                "count": cnt
            })
        # If no bugs, show empty placeholders
        if not severity_distribution:
            severity_distribution = [
                {"severity": "High", "count": 0},
                {"severity": "Medium", "count": 0},
                {"severity": "Low", "count": 0}
            ]

        return {
            "status": "success",
            "data": {
                "execution_trend": execution_trend,
                "pass_fail_totals": {
                    "pass": total_pass,
                    "fail": total_fail
                },
                "severity_distribution": severity_distribution
            }
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Trend failed",
            "details": str(e)
        })


# ─────────────────────────────────────────────
# EXPORT (CSV / JSON)
# ─────────────────────────────────────────────
from fastapi.responses import FileResponse
import os
from services.reporting_service import ReportingService

@router.get("/execution/{execution_id}/export")
async def export_single_execution_report(
    execution_id: int,
    format: str = Query("pdf"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Execution, TestCase.title).join(TestCase).where(Execution.id == execution_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
         return JSONResponse(status_code=404, content={"status": "error", "message": "Not found"})
    ex, title = row

    reports_dir = os.path.join(os.getcwd(), "reports")
    file_path = os.path.join(reports_dir, f"report_{execution_id}.{format}")
    
    # Always generate on the fly to get latest data
    svc = ReportingService()
    exec_data = {
        "id": ex.id,
        "status": ex.status,
        "started_at": ex.started_at.isoformat() if ex.started_at else None,
        "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
        "step_results": ex.step_results,
        "logs": ex.logs
    }
    tc_data = {"title": title}
    await svc.generate_all_reports(exec_data, tc_data)
        
    if not os.path.exists(file_path):
         return JSONResponse(status_code=404, content={"status": "error", "message": "Failed to generate report"})

    media_type = "application/json"
    if format == "pdf": media_type = "application/pdf"
    if format == "csv": media_type = "text/csv"
    
    return FileResponse(path=file_path, media_type=media_type, filename=f"Execution_Report_{execution_id}.{format}")

@router.get("/export")
async def export_report(
    format: str = Query("csv"),
    days: int = Query(30),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = await db.execute(
            select(Execution, TestCase.title, TestCase.project_id)
            .join(TestCase)
            .where(Execution.started_at >= cutoff)
            .order_by(desc(Execution.started_at))
            .limit(1000)
        )

        rows = result.all()

        if format.lower() == "json":
            data = []
            for ex, title, project_id in rows:
                data.append({
                    "id": ex.id,
                    "test_case": title,
                    "project_id": project_id,
                    "status": ex.status,
                    "started_at": ex.started_at.isoformat() if ex.started_at else None,
                    "completed_at": ex.completed_at.isoformat() if ex.completed_at else None,
                    "step_results": ex.step_results,
                    "logs": ex.logs
                })
            return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=execution_report.json"})

        # Default CSV export
        def generate():
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Execution ID", "Test Case", "Project", "Status", "Started At", "Completed At"])
            
            for ex, title, project_id in rows:
                writer.writerow([
                    ex.id, 
                    title, 
                    project_id or "N/A", 
                    ex.status, 
                    ex.started_at.isoformat() if ex.started_at else "", 
                    ex.completed_at.isoformat() if ex.completed_at else ""
                ])
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=execution_report.csv"}
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": "Export failed",
            "details": str(e)
        })