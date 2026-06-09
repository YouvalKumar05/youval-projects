import time
import asyncio
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.sql import func

logger = logging.getLogger("playwright_service")
logger.setLevel(logging.DEBUG)

try:
    from playwright.async_api import async_playwright, expect
except ImportError:
    async_playwright = None
    expect = None


from workflow_engine.engine import WorkflowEngine
from models.core import Execution, TestCase
from services.reporting_service import ReportingService

class PlaywrightService:
    _active_tasks: Dict[int, asyncio.Task] = {}

    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine = WorkflowEngine(db)
        self.reporter = ReportingService()

    @classmethod
    def cancel_execution(cls, execution_id: int) -> bool:
        task = cls._active_tasks.get(execution_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    @classmethod
    async def run_in_background(cls, execution_id: int, test_case_id: int, config: Dict[str, Any], on_event: Any):
        from db.database import AsyncSessionLocal
        from models.core import TestCase
        from sqlalchemy.future import select

        async with AsyncSessionLocal() as session:
            stmt = select(TestCase).where(TestCase.id == test_case_id)
            result = await session.execute(stmt)
            test_case = result.scalars().first()
            if not test_case:
                logger.error(f"[EXEC-{execution_id}] TestCase {test_case_id} not found in DB!")
                return
            svc = cls(session)
            await svc.execute_test_case(execution_id, test_case, config, on_event)

    async def execute_test_case(self, execution_id: int, test_case: TestCase, config: Dict[str, Any] = None, on_event: Any = None):
        # Register task for cancellation support
        self._active_tasks[execution_id] = asyncio.current_task()
        try:
            await self._execute_inner(execution_id, test_case, config, on_event)
        except asyncio.CancelledError:
            await self._finalize_execution(execution_id, "FAIL", "Execution cancelled by user.")
            raise
        except Exception as e:
            logger.error(f"[EXEC-{execution_id}] Unhandled error: {e}\n{traceback.format_exc()}")
            await self._finalize_execution(execution_id, "FAIL", f"Unhandled execution error: {str(e)}")
        finally:
            self._active_tasks.pop(execution_id, None)

    async def _finalize_execution(self, execution_id: int, status: str, err_msg: str = ""):
        try:
            await self.db.rollback()
        except:
            pass
        try:
            stmt = update(Execution).where(Execution.id == execution_id).values(
                status=status,
                completed_at=func.current_timestamp()
            )
            await self.db.execute(stmt)
            await self.db.commit()
        except Exception as ex:
            logger.error(f"CRITICAL: Failed to finalize execution {execution_id}: {ex}")

        try:
            from routes.ws import broadcast_dashboard_event, manager
            await broadcast_dashboard_event({"type": "execution_status", "status": status, "execution_id": execution_id})
            await manager.broadcast_to_execution(execution_id, {"type": "execution_status", "status": status, "message": err_msg or f"Execution {status}"})
        except:
            pass

    async def _execute_inner(self, execution_id: int, test_case: TestCase, config: Dict[str, Any] = None, on_event: Any = None):
        config = config or {}
        headless = config.get("headless", True)
        browser_type = config.get("browser_type", "chromium").lower()
        delay = config.get("delay", 2.0)

        SCREENSHOTSDIR = Path("screenshots")
        VIDEOSDIR = Path("videos")
        SCREENSHOTSDIR.mkdir(exist_ok=True)
        VIDEOSDIR.mkdir(exist_ok=True)
        
        screenshotpath = SCREENSHOTSDIR / f"exec_{execution_id}.png"
        videodir = VIDEOSDIR / str(execution_id)
        videodir.mkdir(exist_ok=True)

        # Generate Script via RAG LLM
        from services.rag_script_generator import RAGScriptGenerator
        generator = RAGScriptGenerator(self.db)
        
        steps_data = test_case.steps_json or {}
        script = steps_data.get("script")
        if not script:
            logger.info(f"[EXEC-{execution_id}] Generating script via LLM for: {test_case.title}")
            script = await generator.generate_script(test_case)
            steps_data["script"] = script
            stmt = update(TestCase).where(TestCase.id == test_case.id).values(steps_json=steps_data)
            await self.db.execute(stmt)
            await self.db.commit()

        if not script:
            logger.error(f"[EXEC-{execution_id}] No script could be generated!")
            await self._finalize_execution(execution_id, "FAIL", "Failed to generate Playwright script.")
            return

        logger.info(f"[EXEC-{execution_id}] Starting execution for: {test_case.title}")
        ok, msg, err, step_results, final_screenshot, final_video = await self._run_playwright_script(
            execution_id, script, headless, browser_type, delay, screenshotpath, videodir, on_event
        )
        logger.info(f"[EXEC-{execution_id}] Finished with status: {'PASS' if ok else 'FAIL'} | {msg}")
        
        final_status = "PASS" if ok else "FAIL"
        
        # Transform logs into clean step results for the DB and Report
        clean_steps = []
        for log in step_results: # step_results actually contains raw execution_logs here
            if log.get("step") and log.get("status") in ["passed", "failed"]:
                action_name = log.get("action", log.get("type", "Unknown")).replace("_", " ").title()
                clean_steps.append({
                    "index": log.get("step", 1) - 1,
                    "name": f"Step {log.get('step')}: {action_name}",
                    "status": "PASS" if log.get("ok", True) else "FAIL",
                    "duration": 0,
                    "error": "" if log.get("ok", True) else log.get("msg", "")
                })
        
        # Update execution with final details
        stmt = update(Execution).where(Execution.id == execution_id).values(
            status=final_status,
            logs_path=final_screenshot,
            video_path=final_video,
            step_results=clean_steps,
            completed_at=func.current_timestamp()
        )
        await self.db.execute(stmt)
        await self.db.commit()

        # Notify dashboard
        try:
            from routes.ws import broadcast_dashboard_event, manager
            await broadcast_dashboard_event({"type": "execution_status", "status": final_status, "execution_id": execution_id})
            await manager.broadcast_to_execution(execution_id, {"type": "execution_status", "status": final_status, "message": msg})
        except:
            pass

        # Trigger workflow events
        try:
            if not ok:
                payload = {"execution_id": execution_id, "severity": "High", "error_msg": err, "status": "FAIL"}
                await self.engine.trigger_event("test_failed", "execution", execution_id, payload)
            else:
                payload = {"execution_id": execution_id, "status": "PASS"}
                await self.engine.trigger_event("test_passed", "execution", execution_id, payload)
        except Exception as we:
            logger.warning(f"Workflow trigger error (non-fatal): {we}")

        # Generate Reports
        try:
            exec_data = {
                "id": execution_id,
                "status": final_status,
                "started_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "step_results": clean_steps,
                "screenshot": final_screenshot,
                "logs": []
            }
            tc_data = {"title": test_case.title}
            await self.reporter.generate_all_reports(exec_data, tc_data)
        except Exception as re:
            logger.warning(f"Report generation error (non-fatal): {re}")

    async def _run_playwright_script(
        self, execution_id: int, script: str, headless: bool, 
        browser_type: str, delay: float, screenshotpath: Path, 
        videodir: Path, on_event: Any = None
    ) -> Tuple[bool, str, str, List, str, str]:
        """
        Core execution engine. Returns:
        (success, message, error_trace, step_results, screenshot_path, video_path)
        """
        if async_playwright is None:
            return False, "Playwright not installed.", "Missing dependency", [], None, None
            
        browser = None
        ctx = None
        page = None
        execution_logs = []

        # ─── Helper: Unified Event Emitter ───────────────────────────
        async def emit(evt):
            ts = datetime.now().strftime("%H:%M:%S")
            status_str = str(evt.get("status", "info")).upper()
            log_msg = evt.get("message") or evt.get("log") or ""
            
            log_entry = {
                "t": ts,
                "type": evt.get("type", "step"),
                "msg": log_msg,
                "status": evt.get("status"),
                "ok": evt.get("status") != "failed" if "status" in evt else evt.get("ok", True),
                "step": evt.get("step"),
                "action": evt.get("action")
            }
            execution_logs.append(log_entry)
            
            # Terminal output for debugging
            print(f"[{ts}] [EXEC-{execution_id}] [{status_str}] {log_msg}")
            
            # Websocket broadcast to frontend
            if on_event:
                try:
                    await on_event(evt)
                except Exception:
                    pass  # Don't let WS errors crash execution

        # ─── Helper: Screenshot Capture ──────────────────────────────
        async def take_screenshot(page_obj, step=0, stage="after"):
            try:
                fname = f"exec_{execution_id}_step_{step}_{stage}.png"
                spath = screenshotpath.parent / fname
                await page_obj.screenshot(path=str(spath), full_page=True)
                relative_path = f"screenshots/{fname}"
                await emit({
                    "type": "artifact",
                    "status": "info",
                    "message": f"Screenshot: {fname}",
                    "step": step
                })
                return relative_path
            except Exception as se:
                logger.warning(f"Screenshot failed (step {step}): {se}")
                return None

        # ─── Main Execution ──────────────────────────────────────────
        try:
            async with async_playwright() as p:
                # 1. Launch Browser
                await emit({"type": "system", "status": "running", "message": f"Launching {browser_type} (headless={headless})..."})
                
                launch_opts = {"headless": headless, "slow_mo": int(delay * 1000)}
                if browser_type == "firefox":
                    browser = await p.firefox.launch(**launch_opts)
                elif browser_type == "webkit":
                    browser = await p.webkit.launch(**launch_opts)
                else:
                    browser = await p.chromium.launch(**launch_opts)

                # 2. Create Context with stealth settings
                await emit({"type": "system", "status": "running", "message": "Creating browser context..."})
                ctx = await browser.new_context(
                    record_video_dir=str(videodir),
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 720},
                    locale="en-US",
                    timezone_id="America/New_York"
                )
                
                # 3. Create Page
                page = await ctx.new_page()
                await emit({"type": "system", "status": "passed", "message": "Browser ready."})

                # 4. Compile & Load Script
                await emit({"type": "system", "status": "running", "message": "Compiling test script..."})
                
                local_scope = {
                    "page": page,
                    "expect": expect,
                    "emit": emit,
                    "take_screenshot": take_screenshot,
                    "asyncio": asyncio,
                }

                try:
                    compiled = compile(script, f"exec_{execution_id}_script.py", "exec")
                    exec(compiled, local_scope)
                except SyntaxError as se:
                    error_msg = f"Script syntax error at line {se.lineno}: {se.msg}"
                    await emit({"type": "system", "status": "failed", "message": error_msg})
                    return False, error_msg, traceback.format_exc(), execution_logs, None, None
                except Exception as ce:
                    error_msg = f"Script compilation error: {ce}"
                    await emit({"type": "system", "status": "failed", "message": error_msg})
                    return False, error_msg, traceback.format_exc(), execution_logs, None, None

                if "run_test" not in local_scope:
                    error_msg = "Script does not define 'async def run_test(page, expect, emit, input_data)'"
                    await emit({"type": "system", "status": "failed", "message": error_msg})
                    return False, error_msg, error_msg, execution_logs, None, None

                await emit({"type": "system", "status": "passed", "message": "Script compiled successfully."})

                # 5. Execute run_test
                await emit({"type": "system", "status": "running", "message": f"Executing test: {execution_id}..."})
                input_data = {}

                try:
                    await asyncio.wait_for(
                        local_scope["run_test"](page, expect, emit, input_data),
                        timeout=300.0
                    )
                except asyncio.TimeoutError:
                    await emit({"type": "system", "status": "failed", "message": "Test timed out after 5 minutes."})
                    # Take a failure screenshot before cleanup
                    err_shot = await take_screenshot(page, step=99, stage="timeout")
                    return False, "Timed out after 5 minutes", "TimeoutError", execution_logs, err_shot or str(screenshotpath), None
                except Exception as run_err:
                    await emit({"type": "system", "status": "failed", "message": f"Test error: {run_err}"})
                    err_shot = await take_screenshot(page, step=99, stage="error")
                    if not headless:
                        await asyncio.sleep(3)
                    return False, f"Test failed: {run_err}", traceback.format_exc(), execution_logs, err_shot or str(screenshotpath), None

                # 6. Success! Take final screenshot
                await emit({"type": "system", "status": "passed", "message": "All test steps passed."})
                final_shot = await take_screenshot(page, step=0, stage="final")
                
                # If headed, give the user a moment to see the result
                if not headless:
                    await asyncio.sleep(3)

                # 7. Cleanup & collect video
                final_video = None
                try:
                    await ctx.close()  # This finalizes the video recording
                    video_path_obj = await page.video.path() if page.video else None
                    if video_path_obj:
                        final_video = str(video_path_obj)
                except Exception:
                    pass

                return True, "All steps passed", "", execution_logs, final_shot or str(screenshotpath), final_video

        except Exception as e:
            error_trace = traceback.format_exc()
            logger.error(f"[EXEC-{execution_id}] Fatal error:\n{error_trace}")
            
            try:
                await emit({"type": "system", "status": "failed", "message": f"Fatal error: {e}"})
            except:
                pass

            return False, f"Fatal error: {e}", error_trace, execution_logs, None, None

        finally:
            # Guaranteed cleanup
            if browser:
                try:
                    await browser.close()
                except:
                    pass
