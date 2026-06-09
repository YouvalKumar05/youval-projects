import os
import json
import requests
from typing import Dict, Any
from datetime import datetime

from utils.json_utils import safe_json_parse


class AIService:
    def __init__(self):
        self.groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
        self.perplexity_key = (os.getenv("PERPLEXITY_API_KEY") or "").strip()
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.pplx_model = os.getenv("PPLX_MODEL", "sonar-pro")

    # -------------------------------
    # SAFE RESPONSE EXTRACTION
    # -------------------------------
    def _safe_get_content(self, response_json):
        try:
            return response_json["choices"][0]["message"]["content"]
        except Exception:
            print("Invalid API response format:", response_json)
            return ""

    # -------------------------------
    # JSON EXTRACTION + VALIDATION
    # -------------------------------
    def _extract_json(self, text: str) -> Dict[str, Any]:
        print("\n[DEBUG] LLM RAW RESPONSE:\n", text)

        parsed = safe_json_parse(text)

        if not parsed:
            raise ValueError("LLM returned unusable JSON")

        return parsed

    # -------------------------------
    # SCHEMA VALIDATION
    # -------------------------------
    def _validate_structure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        required_keys = ["interpretedIntent", "scenarios", "riskScore", "coveragePct", "findings"]

        for key in required_keys:
            if key not in data:
                print(f"[WARN] Missing key: {key}")
                data[key] = [] if key in ["scenarios", "findings"] else ""

        # Ensure scenarios list
        if not isinstance(data["scenarios"], list):
            data["scenarios"] = []

        return data

    # -------------------------------
    # MAIN ANALYSIS FUNCTION
    # -------------------------------
    def analyze_requirement(self, requirement_text: str, project_id: int = None, config: Dict[str, Any] = None) -> Dict[str, Any]:
        request_id = f"REQ-{datetime.utcnow().timestamp()}"
        print(f"\n[INFO] Processing Request: {request_id} with config: {config}")

        # Extract config values with defaults
        test_case_count = config.get("testCaseCount", 10) if config else 10
        priority = config.get("priorityLevel", "Medium") if config else "Medium"
        complexity = config.get("complexityLevel", "Intermediate") if config else "Intermediate"
        coverage = config.get("coverageLevel", "Standard") if config else "Standard"
        environment = config.get("environment", "Production") if config else "Production"
        testing_types = config.get("testingTypes", ["Functional Testing"]) if config else ["Functional Testing"]

        system_prompt = (
            f"You are a Senior QA Automation Architect.\n"
            f"Generate exactly {test_case_count} test scenarios based on the requirements.\n"
            f"Focus on the following testing types: {', '.join(testing_types)}.\n"
            f"Set priority to {priority}, complexity focus to {complexity}, and coverage goal to {coverage}.\n"
            f"Target environment: {environment}.\n\n"
            "Return ONLY valid JSON. No text.\n"
            "Ensure no trailing commas.\n"
            "Use double quotes.\n\n"
            "Output format:\n"
            "{\n"
            "  \"interpretedIntent\": \"string\",\n"
            "  \"scenarios\": [{ \"testCaseId\": \"string\", \"title\": \"string\", \"actions\": [{ \"type\": \"string\", \"description\": \"string\", \"url\": \"string\", \"selector\": \"string\", \"text\": \"string\" }] }],\n"
            "  \"riskScore\": 0,\n"
            "  \"coveragePct\": 0,\n"
            "  \"findings\": []\n"
            "}"
        )

        user_prompt = f"Requirement: {requirement_text}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # -------------------------------
        # SELECT PROVIDER
        # -------------------------------
        if self.groq_key:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
            payload = {"model": self.groq_model, "messages": messages, "temperature": 0.1}
        elif self.perplexity_key:
            url = "https://api.perplexity.ai/chat/completions"
            headers = {"Authorization": f"Bearer {self.perplexity_key}", "Content-Type": "application/json"}
            payload = {"model": self.pplx_model, "messages": messages, "temperature": 0.1}
        else:
            print("[WARN] No API key found, using fallback")
            return self._get_fallback_mock(requirement_text)

        # -------------------------------
        # RETRY MECHANISM
        # -------------------------------
        for attempt in range(2):
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=30)
                response.raise_for_status()

                response_json = response.json()
                raw_text = self._safe_get_content(response_json)

                parsed = self._extract_json(raw_text)
                validated = self._validate_structure(parsed)

                print(f"[SUCCESS] Parsed successfully on attempt {attempt+1}")
                return validated

            except Exception as e:
                print(f"[ERROR] Attempt {attempt+1} failed:", str(e))

                # Retry with stricter instruction
                messages.append({
                    "role": "user",
                    "content": "Your previous output was invalid. Return ONLY valid JSON."
                })

        print("[FALLBACK] Using mock response")
        return self._get_fallback_mock(requirement_text)

    # -------------------------------
    # FALLBACK RESPONSE
    # -------------------------------
    def _get_fallback_mock(self, text: str) -> Dict[str, Any]:
        return {
            "interpretedIntent": f"Fallback analysis for: {text[:50]}...",
            "scenarios": [
                {
                    "testCaseId": "TC-FALLBACK-001",
                    "title": "Basic Navigation Test",
                    "actions": [
                        {"type": "goto", "url": "https://www.google.com", "description": "Open homepage"},
                        {"type": "expecttextvisible", "text": "Google", "description": "Verify content"}
                    ]
                }
            ],
            "riskScore": 10,
            "coveragePct": 50,
            "findings": [
                {
                    "severity": "Low",
                    "category": "Fallback",
                    "title": "Mock Data Used",
                    "detail": "AI service unavailable or invalid response"
                }
            ]
        }