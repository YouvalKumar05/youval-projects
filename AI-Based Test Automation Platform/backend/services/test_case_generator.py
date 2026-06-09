"""
test_case_generator.py
-----------------------
Builds the LLM prompt and parses/validates the structured JSON response
for the "Generate Test Case Table" feature.

JSON contract (array of objects):
[
  {
    "id":               "TC-001",
    "scenario":         "Happy-path login with valid credentials",
    "description":      "Verify that an existing user can log in successfully...",
    "steps":            ["Step 1: Navigate to /login", "Step 2: ..."],
    "input_data":       {"username": "user@example.com", "password": "Valid@123"},
    "expected_outcome": "User is redirected to the dashboard and sees a welcome message.",
    "actual_outcome":   "",
    "status":           "To Be Tested",
    "bug_identified":   "",
    "severity":         "",
    "ai_suggestion":    "Consider also testing with SSO-enabled accounts."
  },
  ...
]
"""

import json
import re
from typing import Any, Dict, List


# ── Prompt builder ─────────────────────────────────────────────────────────────

def build_test_case_prompt(
    requirement: str,
    project_name: str = "",
    target_url: str = "",
    num_cases: int = 10,
    testing_types: List[str] = None,
    priority: str = "Medium",
    complexity: str = "Intermediate",
    coverage_level: str = "Standard",
    environment: str = "Production"
) -> str:
    testing_types = testing_types or ["Functional Testing"]
    project_ctx = f" for the project '{project_name}'" if project_name else ""
    url_ctx = f" Target URL: {target_url}" if target_url else ""
    
    return f"""You are a senior QA engineer{project_ctx}.

REQUIREMENT:
\"\"\"
{requirement}
\"\"\"

CONFIGURATION:
- Target URL: {target_url or 'N/A'}
- Number of test cases to generate: approximately {num_cases}
- Testing Types: {', '.join(testing_types)}
- Priority Level: {priority}
- Complexity Level: {complexity}
- Coverage Level: {coverage_level}
- Target Environment: {environment}

TASK:
Generate a comprehensive test case table covering the requested {coverage_level.lower()} coverage, specifically focusing on the requested testing types ({', '.join(testing_types)}). Ensure the test cases reflect a {complexity.lower()} complexity level and are suitable for a {environment.lower()} environment.

OUTPUT FORMAT:
Return ONLY a valid JSON array of {num_cases} test cases with NO markdown, NO explanation, NO wrapping text.
Each element must have these exact keys:

  "id"               : string  — e.g. "TC-001"
  "scenario"         : string  — short scenario name
  "description"      : string  — 1–2 sentence clarification
  "steps"            : array   — ordered list of human-readable action strings
  "input_data"       : object  — key-value pairs of test data (use empty {{}} if N/A)
  "expected_outcome" : string  — what should happen
  "actual_outcome"   : string  — always empty string ""
  "status"           : string  — always "To Be Tested"
  "bug_identified"   : string  — always empty string ""
  "severity"         : string  — always empty string ""
  "ai_suggestion"    : string  — one actionable QA hint for this case

  - Output must be parseable by json.loads() with zero post-processing.


START JSON ARRAY NOW:"""


# ── Fallback stub ──────────────────────────────────────────────────────────────

def _stub_test_cases(requirement: str) -> List[Dict[str, Any]]:
    """Deterministic demo output when no LLM key is available."""
    snippet = requirement[:60].rstrip() + ("..." if len(requirement) > 60 else "")
    return [
        {
            "id": "TC-001",
            "scenario": "Happy Path – Core Workflow",
            "description": f"Verify the primary success flow for: {snippet}",
            "steps": [
                "1. Navigate to the application.",
                "2. Enter valid credentials.",
                "3. Click login.",
                "4. Verify dashboard is visible.",
            ],
            "input_data": {"username": "qa_user@example.com", "password": "Valid@123"},
            "expected_outcome": "User is successfully logged in and sees the dashboard.",
            "actual_outcome": "",
            "status": "To Be Tested",
            "bug_identified": "",
            "severity": "",
            "ai_suggestion": "Verify that the session token is properly stored in localStorage.",
        },
        {
            "id": "TC-002",
            "scenario": "Invalid Login Attempt",
            "description": "Verify system shows error for wrong credentials.",
            "steps": [
                "1. Navigate to login.",
                "2. Enter wrong password.",
                "3. Click login.",
                "4. Verify error message.",
            ],
            "actions": [
                {"type": "goto", "url": "https://example.com/login", "description": "Navigate to login"},
                {"type": "fill", "selector": "#username", "text": "qa_user@example.com", "description": "Enter username"},
                {"type": "fill", "selector": "#password", "text": "WrongPass!", "description": "Enter wrong password"},
                {"type": "click", "selector": "#login-btn", "description": "Click login"},
                {"type": "expecttextvisible", "text": "Invalid credentials", "description": "Verify error message"}
            ],
            "input_data": {"username": "qa_user@example.com", "password": "WrongPass!"},
            "expected_outcome": "Error message 'Invalid credentials' is displayed.",
            "actual_outcome": "",
            "status": "To Be Tested",
            "bug_identified": "",
            "severity": "",
            "ai_suggestion": "Check for brute-force protection (account lockout) after 5 failed attempts.",
        }
    ]


# ── Response parser ────────────────────────────────────────────────────────────

_REQUIRED_KEYS = {
    "id", "scenario", "description", "steps", "actions",
    "input_data", "expected_outcome", "actual_outcome",
    "status", "bug_identified", "severity", "ai_suggestion",
}


def parse_test_cases(raw: str) -> List[Dict[str, Any]]:
    """
    Extracts and validates the JSON array from the LLM response.
    Strips markdown fences if present, validates schema per item.
    Raises ValueError on unrecoverable parse failures.
    """
    # Strip ```json ... ``` fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    # If the model wrapped it in an object, try to extract the array value
    if cleaned.startswith("{"):
        m = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if m:
            cleaned = m.group(0)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid JSON: {exc}\n\nRaw:\n{raw[:300]}") from exc

    if not isinstance(data, list):
        raise ValueError("LLM response was not a JSON array.")

    validated = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        # Ensure all required keys exist with sensible defaults
        item.setdefault("actual_outcome", "")
        item.setdefault("status", "To Be Tested")
        item.setdefault("bug_identified", "")
        item.setdefault("severity", "")
        item.setdefault("ai_suggestion", "")
        
        if not isinstance(item.get("steps"), list):
            item["steps"] = [str(item.get("steps", ""))]
            
        if not isinstance(item.get("actions"), list):
            # Try to map steps to actions if missing? For now just empty list
            item["actions"] = []
            
        if not isinstance(item.get("input_data"), dict):
            item["input_data"] = {}
        validated.append(item)

    return validated

