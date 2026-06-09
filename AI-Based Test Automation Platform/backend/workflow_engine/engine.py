import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from models.core import Workflow, WorkflowInstance, Task, Bug, Role, User, Analysis, Project, TestCase, Version, Execution

class WorkflowEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def trigger_event(self, event_name: str, target_type: str, target_id: int, payload: dict):
        """Find workflows matching the trigger event and process them."""
        stmt = select(Workflow).where(Workflow.trigger_event == event_name)
        result = await self.db.execute(stmt)
        workflows = result.scalars().all()
        
        for workflow in workflows:
            # Create instance to track state
            instance = WorkflowInstance(
                workflow_id=workflow.id,
                target_entity_type=target_type,
                target_entity_id=target_id,
                current_state="triggered"
            )
            self.db.add(instance)
            await self.db.flush() # get instance id
            
            # Execute ast rules
            await self.evaluate_rules(workflow.ast_json, instance, target_type, target_id, payload)

    async def evaluate_rules(self, ast_json: dict, instance: WorkflowInstance, target_type: str, target_id: int, payload: dict):
        """Parse conditions and execute matching actions."""
        rules = ast_json.get("rules", [])
        
        for rule in rules:
            condition = rule.get("condition", {})
            action = rule.get("action", {})
            
            if self._evaluate_condition(condition, payload):
                await self._execute_action(action, instance, target_type, target_id, payload)

    def _evaluate_condition(self, condition: dict, payload: dict) -> bool:
        """Evaluate simple or complex AST conditions against payload."""
        if not condition:
            return True # No condition = always true
            
        rules = condition.get("rules", [])
        if not rules:
            # Fallback to simple format if rules array is missing
            return self._eval_single(condition, payload)
            
        logic = condition.get("logic", "AND")
        results = [self._eval_single(rule, payload) for rule in rules]
        
        if logic == "OR":
            return any(results)
        return all(results)

    def _eval_single(self, rule: dict, payload: dict) -> bool:
        field = rule.get("field")
        op = rule.get("operator")
        val = rule.get("value")
        
        payload_val = payload.get(field)
        
        if op == "==": return payload_val == val
        if op == "!=": return payload_val != val
        if op == ">" and isinstance(payload_val, (int, float)): return payload_val > float(val)
        if op == "<" and isinstance(payload_val, (int, float)): return payload_val < float(val)
        if op == ">=" and isinstance(payload_val, (int, float)): return payload_val >= float(val)
        if op == "<=" and isinstance(payload_val, (int, float)): return payload_val <= float(val)
        if op == "contains" and isinstance(payload_val, str): return str(val) in payload_val
        if op == "regex match" and isinstance(payload_val, str): 
            import re
            try: return bool(re.search(str(val), payload_val))
            except: return False
            
        return False

    async def _execute_action(self, action: dict, instance: WorkflowInstance, target_type: str, target_id: int, payload: dict):
        """Execute state mutations based on matched actions."""
        action_type = action.get("type")
        params = action.get("params", {})
        
        if action_type == "assign_to_role":
            role_name = params.get("role_name")
            await self.assign_task(target_type, target_id, role_name)
            instance.current_state = f"assigned_to_{role_name.lower()}"
            
        elif action_type == "create_bug":
            severity = params.get("default_severity", "Medium")
            # Usually payload holds execution info
            execution_id = payload.get("execution_id") 
            new_bug = Bug(
                execution_id=execution_id,
                title=f"Bug caused by {target_type} {target_id}",
                severity=severity,
                status="Open"
            )
            self.db.add(new_bug)
            await self.db.flush()
            instance.current_state = "bug_created"
            
            # Real-time update
            try:
                from routes.ws import broadcast_dashboard_event
                await broadcast_dashboard_event({"type": "bug", "status": "created", "id": new_bug.id})
            except ImportError:
                pass
            
        elif action_type == "create_task":
            priority = params.get("priority", "Medium")
            new_task = Task(
                title=params.get("title", f"Review failure in {target_type} #{target_id}"),
                description=params.get("description", f"Auto-generated task from workflow for {target_type} {target_id}"),
                priority=priority,
                status="To Do",
                reference_type=target_type,
                reference_id=target_id
            )
            self.db.add(new_task)
            await self.db.flush()
            instance.current_state = "task_created"
            
            try:
                from routes.ws import broadcast_dashboard_event
                await broadcast_dashboard_event({"type": "task", "status": "created", "id": new_task.id})
            except ImportError:
                pass

        elif action_type == "notify_slack":
            # Mock slack notification
            print(f"Workflow Engine: Slack Notification sent to {params.get('channel', '#general')}")
            instance.current_state = "slack_notified"
            
        elif action_type == "send_email":
            # Mock email sending
            print(f"Workflow Engine: Email sent to {params.get('recipient')}")
            instance.current_state = "email_sent"
            
        elif action_type == "delay":
            import asyncio
            seconds = int(params.get("seconds", 1))
            print(f"Workflow Engine: Delaying for {seconds}s")
            await asyncio.sleep(seconds)
            instance.current_state = "delay_completed"
            
        elif action_type == "retry_test":
            print(f"Workflow Engine: Retrying Test {target_id}")
            instance.current_state = "test_retried"
            # In real system, re-trigger execution pipeline here

        # Commit actions and update instance state
        await self.db.commit()

    async def assign_task(self, ref_type: str, ref_id: int, role_name: str):
        """Assign task to the first available user of a given role."""
        stmt = select(Role).where(Role.name == role_name)
        role = (await self.db.execute(stmt)).scalars().first()
        
        if not role:
            print(f"Workflow WARNING: Role '{role_name}' not found for assignment.")
            return

        user_stmt = select(User).where(User.role_id == role.id)
        user = (await self.db.execute(user_stmt)).scalars().first()
        
        assignee_id = user.id if user else None
        
        new_task = Task(
            title=f"Review {ref_type.capitalize()} #{ref_id}",
            description=f"Auto-generated task to review {ref_type} {ref_id}.",
            priority="High",
            assignee_id=assignee_id,
            status="To Do",
            reference_type=ref_type,
            reference_id=ref_id
        )

        self.db.add(new_task)
        # Flush to get ID if needed, but we mainly need to notify of a generic 'task' change
        await self.db.flush()
        
        try:
            from routes.ws import broadcast_dashboard_event
            await broadcast_dashboard_event({"type": "task", "status": "created", "id": new_task.id})
        except ImportError:
            pass

class STLCWorkflowOrchestrator:
    """Manages the linear STLC Pipeline: Input -> Analysis -> Test Gen -> Approval -> Execution -> Report."""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run_pipeline(self, requirement_text: str, project_name: str):
        """Orchestrates the entire end-to-end pipeline flow."""
        try:
            # 1. Analyze
            analysis_data = await self.analyze(requirement_text, project_name)
            
            # 2. Generate Test Cases
            test_cases = await self.generate_test_cases(analysis_data, project_name)
            
            # 3. Execution (This usually waits for manual approval, but we simulate automated flow here)
            # In a real system, the pipeline might pause here for human check.
            execution_results = await self.execute(test_cases, project_name)
            
            # 4. Reporting
            report = await self.generate_report(execution_results, project_name)
            
            return {
                "status": "success",
                "analysis_id": analysis_data.get("id"),
                "test_case_count": len(test_cases),
                "execution_status": execution_results.get("status"),
                "report_link": report.get("pdf")
            }
        except Exception as e:
            return {"status": "error", "message": f"Pipeline failed: {str(e)}"}

    async def analyze(self, requirement_text: str, project_name: str) -> Analysis:
        # 1. Check for existing analysis to prevent duplication
        stmt = select(Analysis).where(Analysis.requirement_text == requirement_text, Analysis.status != "Rejected")
        result = await self.db.execute(stmt)
        existing = result.scalars().first()
        
        if existing:
            print(f"Workflow: Found existing analysis ID {existing.id}. Skipping new generation.")
            return existing

        # 2. Run new analysis
        from services.ai_service import AIService
        ai_service = AIService()
        project_id = None
        # Try to find project
        p_stmt = select(Project).where(Project.name == project_name)
        project = (await self.db.execute(p_stmt)).scalars().first()
        if project: project_id = project.id

        analysis_data = ai_service.analyze_requirement(requirement_text, project_name)
        
        analysis = Analysis(
            project_id=project_id,
            project_name=project_name,
            requirement_text=requirement_text,
            scenarios=analysis_data.get("scenarios", []),
            risk_score=analysis_data.get("riskScore", 0),
            coverage_pct=analysis_data.get("coveragePct", 0),
            status="Pending"
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)
        return analysis

    async def generate_test_cases(self, analysis_data: dict, project: str):
        from services.ai_service import AIService
        ai = AIService()
        # Flatten scenarios to text for generator
        scenarios_text = "\n".join([s.get("title", "") for s in analysis_data.get("scenarios", [])])
        result = await ai.generate_test_cases(scenarios_text, project)
        test_cases = result.get("test_cases", [])
        
        # Save to DB
        from models.core import TestCase
        saved_cases = []
        for tc_data in test_cases:
            new_tc = TestCase(
                title=tc_data.get("scenario", "Generated Case"),
                project_id=project,
                steps_json=tc_data,
                is_approved=True
            )
            self.db.add(new_tc)
            saved_cases.append(new_tc)
        
        await self.db.commit()
        return test_cases

    async def execute(self, test_cases: list, project: str):
        # Trigger actual execution via PlaywrightService
        from services.playwright_service import PlaywrightService
        from models.core import TestCase
        
        # Pick the first case for simulation in this quick-run orchestrator
        # In full mode, it would loop or batch
        stmt = select(TestCase).where(TestCase.project_id == project).limit(1)
        res = await self.db.execute(stmt)
        tc_obj = res.scalars().first()
        
        if not tc_obj:
            raise ValueError("No test cases found to execute")
            
        from models.core import Execution
        execution = Execution(test_case_id=tc_obj.id, status="Running")
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)
        
        svc = PlaywrightService(self.db)
        # Synchronous wait for this orchestrator demo
        await svc.execute_test_case(execution.id, tc_obj, config={"headless": True, "delay": 0.5})
        
        # Refresh execution to get results
        await self.db.refresh(execution)
        return {"id": execution.id, "status": execution.status, "results": execution.step_results}

    async def generate_report(self, execution_results: dict, project: str):
        from services.reporting_service import ReportingService
        reporter = ReportingService()
        
        # Format data for reporter
        exec_data = {
            "id": execution_results["id"],
            "status": execution_results["status"],
            "started_at": datetime.now().isoformat(),
            "completed_at": datetime.now().isoformat(),
            "step_results": execution_results.get("results", [])
        }
        tc_data = {"title": f"Project: {project}"}
        
        report_links = await reporter.generate_all_reports(exec_data, tc_data)
        return report_links
