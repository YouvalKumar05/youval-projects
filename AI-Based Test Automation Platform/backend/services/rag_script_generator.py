import os
import ast
import json
import logging
import asyncio
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.core import TestCase, Execution
try:
    from groq import AsyncGroq  # installed in .venv — Pyrefly false-positive
except ImportError:
    AsyncGroq = None  # type: ignore

logger = logging.getLogger(__name__)

class RAGScriptGenerator:
    def __init__(self, db: AsyncSession):
        self.db = db
        # We assume the API key is set in the environment or we use a fallback
        self.api_key = os.environ.get("GROQ_API_KEY", "dummy")
        self.client = AsyncGroq(api_key=self.api_key)

    async def _retrieve_context(self, project_id: Any, requirement: str) -> str:
        """Simple RAG retrieval: get recent test cases for the same project."""
        if not project_id:
            return "No specific project context available."
            
        stmt = select(TestCase).where(TestCase.project_id == project_id).limit(3)
        result = await self.db.execute(stmt)
        test_cases = result.scalars().all()
        
        if not test_cases:
            return "No previous test cases found for this project."
            
        context = "Previous test cases for context (use for business logic, NOT for code style):\n"
        for tc in test_cases:
            context += f"- Title: {tc.title}\n"
            steps = tc.steps_json.get("steps", []) or tc.steps_json.get("actions", [])
            if steps:
                context += f"  Steps: {json.dumps(steps)}\n"
        return context

    def _validate_script(self, script: str) -> bool:
        """Validate that the script is valid Python and contains async_playwright usage."""
        try:
            tree = ast.parse(script)
            has_async_def = False
            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef) and node.name == "run_test":
                    # Check for 4 arguments: page, expect, emit, input_data
                    if len(node.args.args) == 4:
                        has_async_def = True
            return has_async_def
        except SyntaxError as e:
            logger.error(f"Syntax error in generated script: {e}")
            return False

    async def generate_script(self, test_case: TestCase, requirement: str = "", base_url: str = None) -> str:
        """Generate a validated Playwright Python script using LLM and RAG."""
        
        description = (test_case.steps_json or {}).get("description") or (test_case.steps_json or {}).get("interpretedIntent") or ""
        req_text = requirement or description or test_case.title
        
        context = await self._retrieve_context(test_case.project_id, req_text)

        # Extract URL from scenario actions if not explicitly provided
        actions = (test_case.steps_json or {}).get('actions', (test_case.steps_json or {}).get('steps', []))
        if not base_url:
            for action in actions:
                if isinstance(action, dict) and action.get('url'):
                    base_url = action.get('url')
                    break

        website_info = f"\nTarget Website URL: {base_url}" if base_url else "\nTarget Website URL: (not specified — infer from context or use a reasonable placeholder)"

        # Build a detailed, numbered action plan for the LLM
        action_lines = []
        for i, action in enumerate(actions):
            if isinstance(action, dict):
                parts = [f"Step {i+1}:"]
                if action.get('type'): parts.append(f"type={action['type']}")
                if action.get('description'): parts.append(f"description=\"{action['description']}\"")
                if action.get('url'): parts.append(f"url={action['url']}")
                if action.get('selector'): parts.append(f"selector={action['selector']}")
                if action.get('text'): parts.append(f"text=\"{action['text']}\"")
                action_lines.append(" | ".join(parts))
            else:
                action_lines.append(f"Step {i+1}: {action}")
        
        actions_text = "\n".join(action_lines) if action_lines else "No specific steps provided — generate reasonable steps based on the test title."

        input_data = (test_case.steps_json or {}).get('input_data', {})
        input_text = json.dumps(input_data, indent=2) if input_data else "None"

        safe_base_url = base_url or "https://your-target-app.com"
        
        system_prompt = f"""You are a Senior Lead QA Automation Engineer.
Generate a SIMPLE, ROBUST, and CLEAN Playwright Python (async) script. 
Avoid over-complicating, but follow these enterprise-grade rules strictly:

========================
GENERAL RULES
========================
- Signature: `async def run_test(page, expect, emit, input_data):`
- Output ONLY valid Python code.
- Every action MUST be awaited.
- Screenshot Call: `await take_screenshot(page, step=N, stage="after")` (Must pass `page`!)
- CRITICAL: When navigating, ALWAYS use the exact Target Website URL provided below. NEVER use placeholders like example.com or your-target-app.com.

========================
LOCATOR STRATEGY (STABILITY)
========================
Use the most stable, unique locator in this priority:
1. page.get_by_role() -> Use `role="link"` for navigation items, `role="button"` for actual buttons.
2. page.locator("input[name='search_query']") -> Prefer standard attributes like `name` or `id`.
3. page.get_by_label() / get_by_placeholder() -> Use as fallback.
4. page.locator("a[href*='history']") -> Use attribute-based selectors for navigation links.

CRITICAL: AVOID STRICT MODE VIOLATIONS
If a locator might match multiple elements (e.g. multiple search bars or buttons), ALWAYS append `.first` to avoid Playwright "strict mode violation" errors.
Example: `page.locator("input[name='q']").first.fill("test")`
Example: `await page.get_by_role("button", name="Search").first.click()`

========================
STEP STRUCTURE & WAITS
========================
For each step (Navigate, Click, Fill, Verify):
1. Emit a log: `await emit({{"step": N, "action": "action_name", "status": "running", "message": "..."}})`
2. Perform the action:
   - BEFORE CLICK: `await locator.wait_for(state="visible", timeout=5000)`
   - NAVIGATION: `await page.goto(url, timeout=30000)`
   - SPA NAV (YouTube/Gmail): After clicking, use `await page.wait_for_url("**/target_path")` or `await page.wait_for_selector("success_indicator")`.
3. Take Evidence: `await take_screenshot(page, step=N, stage="after")`.
4. Update log: `await emit({{"step": N, "action": "action_name", "status": "passed", "message": "..."}})`

========================
ERROR HANDLING
========================
Wrap each step in a dedicated `try/except` block.
On error:
1. `await take_screenshot(page, step=N, stage="error")`
2. `await emit({{"step": N, "action": "action_name", "status": "failed", "message": str(e)}})`
3. Raise the exception to abort if critical.

========================
EXAMPLE (FOLLOW THIS STYLE)
========================
async def run_test(page, expect, emit, input_data):
    # Step 1: Navigate
    try:
        current_step = 1
        await emit({{"step": current_step, "action": "navigate", "status": "running", "message": "Initializing browser..."}})
        await asyncio.sleep(1) # Small delay for browser stabilization
        
        await emit({{"step": current_step, "action": "navigate", "status": "running", "message": "Opening Website"}})
        # Use wait_until="commit" then wait for load state for more resilience
        response = await page.goto(input_data.get("url", "{safe_base_url}"), timeout=30000, wait_until="commit")
        await page.wait_for_load_state("domcontentloaded")
        
        # Check for common bot-detection keywords in page title or content
        content = await page.content()
        if "captcha" in content.lower() or "robot check" in content.lower():
            await emit({{"step": current_step, "action": "navigate", "status": "failed", "message": "Bot detection/CAPTCHA encountered"}})
            await take_screenshot(page, step=current_step, stage="error")
            raise Exception("Bot detection/CAPTCHA encountered")
            
        await take_screenshot(page, step=current_step, stage="after")
        await emit({{"step": current_step, "action": "navigate", "status": "passed", "message": "Website opened successfully"}})
    except Exception as e:
        await take_screenshot(page, step=1, stage="error")
        await emit({{"step": 1, "action": "navigate", "status": "failed", "message": f"Navigation failed: {{str(e)}}"}})
        raise e

    # Step 2: Search
    try:
        current_step = 2
        await emit({{"step": current_step, "action": "search", "status": "running", "message": "Searching..."}})
        search_box = page.locator("input[name='search_query']").first
        await search_box.fill(input_data.get("query", "news"))
        await page.get_by_role("button", name="Search").first.click()
        await page.locator("ytd-video-renderer").first.wait_for(state="visible", timeout=5000)
        await take_screenshot(page, step=current_step, stage="after")
        await emit({{"step": current_step, "action": "search", "status": "passed", "message": "Results found"}})
    except Exception as e:
        await take_screenshot(page, step=2, stage="error")
        await emit({{"step": 2, "action": "search", "status": "failed", "message": str(e)}})
        raise e
"""

        user_prompt = f"""Now, generate the robust Playwright script for the following Requirement.

========================
REQUIREMENT DETAILS
========================
TITLE: {test_case.title}
DESCRIPTION: {description or 'Not provided'}
{website_info}

========================
TEST SCENARIO STEPS (Follow these EXACTLY)
========================
{actions_text}

========================
AVAILABLE INPUT DATA (Use dictionary keys below)
========================
{input_text}

========================
CONTEXT FROM PROJECT (For reference only)
========================
{context}

REMINDER: 
1. The function signature MUST be `async def run_test(page, expect, emit, input_data):`.
2. Follow EVERY rule in the Senior QA Automation Engineer instructions above.
3. Return ONLY valid Python code.
"""

        max_retries = 2
        last_error = ""
        script = ""

        for attempt in range(max_retries + 1):
            if attempt > 0:
                user_prompt += f"\n\nPREVIOUS ATTEMPT FAILED:\n{last_error}\nFix the issue and return ONLY valid Python code for the `run_test` function."
                
            try:
                response = await self.client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    model="llama-3.1-8b-instant",
                    temperature=0.05,
                    max_tokens=2048
                )
                script = response.choices[0].message.content.strip()
                
                # Strip markdown fences if LLM ignored instructions
                if "```python" in script:
                    script = script.split("```python", 1)[1]
                if "```" in script:
                    script = script.split("```")[0]
                script = script.strip()

                if self._validate_script(script):
                    logger.info(f"Successfully generated script for: {test_case.title}")
                    return script
                else:
                    last_error = "Script is missing 'async def run_test(page, expect, emit):' or has a syntax error."
                    logger.warning(f"Attempt {attempt+1}: Validation failed — {last_error}")
            except Exception as e:
                logger.error(f"LLM Generation failed: {e}")
                last_error = str(e)

        # Fallback script using real URL
        logger.warning("Failed to generate valid script via LLM. Using fallback.")
        goto_url = base_url or 'https://example.com'
        fallback_script = f"""async def run_test(page, expect, emit, input_data):
    await emit({{"step": 1, "action": "navigate", "status": "failed", "message": "Running fallback script for {test_case.title}"}})
    await page.goto('{goto_url}')
    await page.wait_for_load_state('domcontentloaded')
    await emit({{"step": 2, "action": "system", "status": "failed", "message": "Script generation failed — please regenerate."}})
    raise Exception("Script generation failed")
"""
        return fallback_script.strip()
