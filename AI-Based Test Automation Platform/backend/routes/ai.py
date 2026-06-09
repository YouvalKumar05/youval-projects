from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any
import os
import requests
import json

from db.database import get_db
from models.core import User, ConnectionConfig, TestCase
from schemas.api_models import StandardResponse
from middleware.rbac import require_permission
from services.ai_service import AIService
from services.requirement_cleaner import extract_raw_requirement, build_refine_prompt
from utils.json_utils import safe_json_parse
from services.test_case_generator import (
    build_test_case_prompt, parse_test_cases, _stub_test_cases
)

router = APIRouter(prefix="/api/ai", tags=["ai"])
ai_svc = AIService()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama3-8b-8192")   # reads from .env
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "2048"))


def _call_groq(prompt: str, system: str = "") -> str:
    """
    Thin wrapper around the Groq chat completion API.
    Falls back to a deterministic stub when GROQ_API_KEY is not set.
    """
    if not GROQ_API_KEY:
        # ── Stub when no API key is configured ──────────────────────────────
        # Parse the raw requirement from the prompt for the stub output
        raw = ""
        for line in prompt.splitlines():
            if line.strip() and not line.startswith(("You are", "INPUT", '"""', "INSTRUCTIONS", "OUTPUT", "OBJECTIVE", "ACCEPTANCE", "PRECONDITIONS", "EDGE CASES", "-")):
                raw = line.strip()
                break
        first_sentence = raw.split(".")[0].strip() or raw[:80]
        return (
            f"OBJECTIVE: {first_sentence}\n\n"
            f"ACCEPTANCE CRITERIA:\n"
            f"1. System shall correctly execute the described workflow\n"
            f"2. All edge cases must be validated and handled gracefully\n"
            f"3. Data integrity must be maintained throughout the operation\n\n"
            f"PRECONDITIONS: Application is running and user is authenticated\n\n"
            f"EDGE CASES: empty input, network timeout, concurrent requests, invalid data formats"
        )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": GROQ_MAX_TOKENS,
    }

    try:
        resp = requests.post(GROQ_API_URL, headers=headers, json=body, timeout=20)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        raise RuntimeError(f"Groq API call failed: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/ai/refine
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/refine", response_model=StandardResponse)
async def refine_requirements(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("ai:refine")),
):
    raw_text = payload.get("text", "").strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Requirement text is required")

    # ── STEP 1: Strip any previously refined output ───────────────────────
    # This is the idempotency guard — regardless of how many times the user
    # clicks "Refine", the LLM always receives the original raw intent.
    clean_input = extract_raw_requirement(raw_text)

    # ── STEP 2: Build prompt that prevents repetition ─────────────────────
    prompt = build_refine_prompt(clean_input)

    # ── STEP 3: Call LLM ──────────────────────────────────────────────────
    try:
        refined_text = _call_groq(prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return StandardResponse(
        status="success",
        message="Requirements refined successfully",
        data={
            "refined_text": refined_text,
            "raw_input_used": clean_input,     # Useful for debugging in the UI
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/ai/analyze  (unchanged, kept for backward compat)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_full(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("testcases:write")),
):
    try:
        requirement_text = payload.get("requirementText") or payload.get("text", "")
        if not requirement_text:
            return JSONResponse(content={
                "status": "error",
                "message": "Invalid input"
            })

        connection_id = payload.get("connection_id") or payload.get("connectionId")
        application_url = "http://localhost:3000"

        if connection_id:
            stmt = select(ConnectionConfig).where(ConnectionConfig.id == connection_id)
            config = (await db.execute(stmt)).scalar_one_or_none()
            if config:
                application_url = config.base_url
            payload["applicationUrl"] = application_url

        try:
            analysis_result = ai_svc.analyze_requirement(requirement_text, payload.get("projectId"))
        except Exception as e:
            print("ERROR: LLM API failed", e)
            return JSONResponse(content={"status": "error", "message": "LLM API failed"})

        if isinstance(analysis_result, str):
            parsed = safe_parse_json(analysis_result)
            if not parsed:
                return JSONResponse(content={"status": "error", "message": "Failed to parse JSON from LLM"})
            analysis_result = parsed
            
        scenarios = analysis_result.get("scenarios", [])
        if not scenarios:
             scenarios = [{"title": "Default scenario", "actions": []}]

        new_test = TestCase(
            project_id=payload.get("projectName", "default"),
            title=scenarios[0].get("title", "Generated Test Case"),
            steps_json=scenarios[0],
            created_by=current_user.id,
        )
        db.add(new_test)
        await db.commit()
        await db.refresh(new_test)

        analysis_result["test_case_id"] = new_test.id

        return JSONResponse(content={
            "status": "success",
            "data": analysis_result
        })

    except Exception as e:
        print("ERROR:", e)
        return JSONResponse(content={
            "status": "error",
            "message": str(e)
        })

# ─────────────────────────────────────────────────────────────────────────────
# POST /api/ai/generate-test-cases
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generate-test-cases", response_model=StandardResponse)
async def generate_test_cases(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("testcases:write")),
):
    requirement = (payload.get("requirement") or payload.get("text", "")).strip()
    if not requirement:
        raise HTTPException(status_code=400, detail="Requirement text is required")

    project_name = payload.get("projectName", "")
    target_url = payload.get("target_url", "")
    num_cases = payload.get("num_cases", 10)
    testing_types = payload.get("testing_types", ["Functional Testing"])
    priority = payload.get("priority", "Medium")
    complexity = payload.get("complexity", "Intermediate")
    coverage_level = payload.get("coverage_level", "Standard")
    environment = payload.get("environment", "Production")

    # Always strip previously refined output before generating
    from services.requirement_cleaner import extract_raw_requirement
    clean_req = extract_raw_requirement(requirement)

    if not GROQ_API_KEY:
        # Return deterministic stub for demo environments
        test_cases = _stub_test_cases(clean_req)
    else:
        prompt = build_test_case_prompt(
            clean_req,
            project_name=project_name,
            target_url=target_url,
            num_cases=num_cases,
            testing_types=testing_types,
            priority=priority,
            complexity=complexity,
            coverage_level=coverage_level,
            environment=environment
        )
        try:
            raw_response = _call_groq(
                prompt,
                system="You are a senior QA engineer. Output ONLY valid JSON. No markdown. No explanation.",
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc))

        try:
            test_cases = parse_test_cases(raw_response)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    return StandardResponse(
        status="success",
        message=f"{len(test_cases)} test cases generated successfully.",
        data={
            "test_cases": test_cases,
            "count": len(test_cases),
            "requirement": clean_req,
        },
    )

# ─────────────────────────────────────────────────────────────────────────────
# POST /api/ai/enhance-script
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/enhance-script", response_model=StandardResponse)
async def enhance_script(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission("testcases:write")),
):
    current_script = payload.get("script", "").strip()
    scenario_info = payload.get("scenario", {})
    
    if not current_script:
        raise HTTPException(status_code=400, detail="Script is required")

    prompt = f"""
    You are an expert Playwright Automation Engineer.
    Review and enhance the following Playwright Python script.
    
    SCENARIO CONTEXT:
    Title: {scenario_info.get('title', 'N/A')}
    Steps: {json.dumps(scenario_info.get('steps', []))}
    
    CURRENT SCRIPT:
    ```python
    {current_script}
    ```
    
    USER ADDITIONAL INSTRUCTIONS:
    {payload.get('user_prompt', 'None provided')}
    
    GOAL:
    1. Fix any syntax or logical errors.
    2. Ensure the script correctly implements the scenario steps.
    3. Use Playwright best practices (e.g., `expect`, `wait_for_load_state`, reliable selectors).
    4. Keep the function signature as `async def run_test(page, expect, emit):`.
    5. Use `await emit({{"log": "..."}})` for logging progress.
    6. INCORPORATE the user's additional instructions if provided.
    
    OUTPUT:
    Return ONLY the corrected python code. No markdown formatting, no explanations, no backticks.
    """

    try:
        if not GROQ_API_KEY:
            # Simple improvement stub for demo
            enhanced_script = current_script + "\n# Enhanced by AI (Stub)\n# Added better error handling and logging"
        else:
            enhanced_script = _call_groq(
                prompt,
                system="You are a Playwright expert. Return ONLY code. No markdown. No comments outside the code."
            )
            # Remove any accidentally included markdown code blocks
            if "```python" in enhanced_script:
                enhanced_script = enhanced_script.split("```python")[1].split("```")[0].strip()
            elif "```" in enhanced_script:
                enhanced_script = enhanced_script.split("```")[1].split("```")[0].strip()

    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return StandardResponse(
        status="success",
        message="Script enhanced successfully",
        data={"enhanced_script": enhanced_script}
    )
