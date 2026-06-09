import asyncio
import time
from typing import List, Dict, Any
from datetime import datetime

class PipelineOrchestrator:
    def __init__(self):
        # In-memory storage for demonstration (should be in DB for production)
        self.workflow_state = {
            "status": "Idle",
            "current_step": None,
            "steps": [
                {"id": "input", "name": "Input", "status": "Pending", "logs": [], "output": None},
                {"id": "analysis", "name": "Analysis", "status": "Pending", "logs": [], "output": None},
                {"id": "test_gen", "name": "Test Generation", "status": "Pending", "logs": [], "output": None},
                {"id": "approval", "name": "Approval", "status": "Pending", "logs": [], "output": None},
                {"id": "execution", "name": "Execution", "status": "Pending", "logs": [], "output": None},
                {"id": "report", "name": "Report", "status": "Pending", "logs": [], "output": None},
            ],
            "last_updated": None
        }
        self.is_running = False

    def get_status(self) -> Dict[str, Any]:
        return self.workflow_state

    async def run_step(self, step_id: str, payload: Any = None):
        step = next((s for s in self.workflow_state["steps"] if s["id"] == step_id), None)
        if not step:
            return
        
        step["status"] = "Running"
        step["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] Starting {step['name']}...")
        self.workflow_state["current_step"] = step_id
        self.workflow_state["last_updated"] = time.time()

        # Simulate work (In real app, call services like AIService, TestGenerator, etc.)
        await asyncio.sleep(2) 
        
        if step_id == "input":
            step["output"] = "Requirement text received."
        elif step_id == "analysis":
            step["output"] = {"risk_score": 85, "complexity": "Medium"}
        elif step_id == "test_gen":
            step["output"] = {"test_cases_count": 5}
        elif step_id == "approval":
            # Wait for manual approval if needed, or auto-approve
            step["output"] = "Manual approval granted."
        elif step_id == "execution":
            step["output"] = {"passed": 4, "failed": 1}
        elif step_id == "report":
            step["output"] = "Report generated successfully."

        step["status"] = "Completed"
        step["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] {step['name']} finished.")
        self.workflow_state["last_updated"] = time.time()

    async def run_full_workflow(self, input_data: str):
        if self.is_running:
            return
        
        self.is_running = True
        self.workflow_state["status"] = "Running"
        
        # Reset steps
        for step in self.workflow_state["steps"]:
            step["status"] = "Pending"
            step["logs"] = []
            step["output"] = None

        try:
            for step in self.workflow_state["steps"]:
                await self.run_step(step["id"])
                # If a step fails, you could break here
            
            self.workflow_state["status"] = "Completed"
        except Exception as e:
            self.workflow_state["status"] = "Failed"
            print(f"Workflow Error: {e}")
        finally:
            self.is_running = False
            self.workflow_state["current_step"] = None
            self.workflow_state["last_updated"] = time.time()

    def reset_workflow(self):
        self.is_running = False
        self.workflow_state["status"] = "Idle"
        self.workflow_state["current_step"] = None
        for step in self.workflow_state["steps"]:
            step["status"] = "Pending"
            step["logs"] = []
            step["output"] = None
        self.workflow_state["last_updated"] = time.time()

# Singleton for instance tracking across requests
orchestrator = PipelineOrchestrator()
