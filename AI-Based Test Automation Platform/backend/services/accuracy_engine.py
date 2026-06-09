import re
import json
from typing import List, Dict, Any
import difflib

class AccuracyEngine:
    def __init__(self):
        # Common QA keywords for extraction
        self.qa_keywords = ["login", "search", "checkout", "payment", "user", "profile", "settings", "registration", "order", "product", "cart"]
        self.valid_actions = ["click", "input", "navigate", "verify", "goto", "expecttextvisible", "select", "hover", "press"]

    def extract_keywords(self, requirement: str) -> List[str]:
        """Extract meaningful keywords from requirement text."""
        # Simple extraction based on regex and filtering short words
        words = re.findall(r'\b\w{4,}\b', requirement.lower())
        # Filter common stopwords (simplified)
        stopwords = {"should", "would", "could", "must", "with", "from", "that"}
        keywords = [w for w in words if w not in stopwords]
        return list(set(keywords))

    def calculate_coverage(self, requirement: str, test_cases: List[Dict[str, Any]]) -> float:
        """Requirement Coverage Score: Match keywords from requirement with test case content."""
        keywords = self.extract_keywords(requirement)
        if not keywords:
            return 100.0
        
        test_case_text = " ".join([json.dumps(tc).lower() for tc in test_cases])
        matched = [k for k in keywords if k in test_case_text]
        
        return (len(matched) / len(keywords)) * 100

    def validate_steps(self, test_cases: List[Dict[str, Any]]) -> float:
        """Step Validity Score: Check valid actions and proper structure."""
        total_steps = 0
        valid_steps = 0
        
        for tc in test_cases:
            # Assuming 'actions' or 'steps' key
            steps = tc.get("actions", tc.get("steps", []))
            for step in steps:
                total_steps += 1
                action_type = step.get("type", "").lower()
                # Check if action is in valid list and has description
                if any(v in action_type for v in self.valid_actions) or action_type in self.valid_actions:
                    if step.get("description") or step.get("label"):
                        valid_steps += 1
                        
        if total_steps == 0:
            return 0.0
        return (valid_steps / total_steps) * 100

    def evaluate_assertions(self, test_cases: List[Dict[str, Any]]) -> float:
        """Assertion Quality Score: Detect meaningful validations."""
        assertion_keywords = ["verify", "expect", "assert", "should", "validate", "check"]
        total_tc = len(test_cases)
        if total_tc == 0:
            return 0.0
            
        good_assertions = 0
        for tc in test_cases:
            steps = tc.get("actions", tc.get("steps", []))
            has_good_assertion = False
            for step in steps:
                action_type = step.get("type", "").lower()
                desc = step.get("description", "").lower()
                
                # Check for assertion keywords in type or description
                if any(k in action_type or k in desc for k in assertion_keywords):
                    # Filter out generic ones
                    if not any(bad in desc for bad in ["check page", "verify layout", "check text"]):
                        has_good_assertion = True
                        break
                    elif "verify" in action_type and ("text" in desc or "url" in desc or "visible" in desc):
                        has_good_assertion = True
                        break
            
            if has_good_assertion:
                good_assertions += 1
                
        return (good_assertions / total_tc) * 100

    def check_redundancy(self, test_cases: List[Dict[str, Any]]) -> float:
        """Redundancy Score: Detect duplicate or very similar test cases."""
        if len(test_cases) <= 1:
            return 100.0
            
        unique_count = 0
        texts = [json.dumps(tc, sort_keys=True) for tc in test_cases]
        
        for i, text1 in enumerate(texts):
            is_redundant = False
            for j, text2 in enumerate(texts):
                if i == j:
                    continue
                # Use difflib for similarity
                similarity = difflib.SequenceMatcher(None, text1, text2).ratio()
                if similarity > 0.85: # 85% similarity threshold
                    is_redundant = True
                    break
            if not is_redundant:
                unique_count += 1
                
        return (unique_count / len(test_cases)) * 100

    def detect_edge_cases(self, test_cases: List[Dict[str, Any]]) -> float:
        """Edge Case Coverage: Detect presence of empty, invalid, boundary cases."""
        edge_keywords = ["empty", "invalid", "null", "none", "boundary", "max", "min", "limit", "special character", "negative"]
        edge_tc_count = 0
        
        for tc in test_cases:
            tc_str = json.dumps(tc).lower()
            if any(k in tc_str for k in edge_keywords):
                edge_tc_count += 1
                
        # If we have at least 15% edge cases, it's a good score (scaled to 100)
        # Or better: return % of test cases that are edge cases, but capped or scaled.
        # Requirement says "Return %" - usually meaning % of expected or just presence ratio.
        # Let's say we expect proportional edge cases.
        target_ratio = 0.2 # Expecting 20% edge cases
        actual_ratio = edge_tc_count / len(test_cases) if test_cases else 0
        
        score = min((actual_ratio / target_ratio) * 100, 100)
        return score

    def get_ai_confidence(self, test_cases: List[Dict[str, Any]]) -> float:
        """AI Confidence Score: Call LLM to rate (Simulated here, but structured for LLM)."""
        # In a real app, you'd call self.ai_service.evaluate(...)
        # For now, we return a calculated base score with some randomness/logic
        if not test_cases:
            return 0.0
            
        base_score = 80.0
        # More complex test cases (more steps) usually have higher AI confidence if valid
        avg_steps = sum(len(tc.get("actions", tc.get("steps", []))) for tc in test_cases) / len(test_cases)
        
        ai_score = base_score + min(avg_steps * 2, 20)
        return min(ai_score, 100.0)

    def calculate_accuracy(self, requirement: str, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Final Score Implementation."""
        coverage = self.calculate_coverage(requirement, test_cases)
        validity = self.validate_steps(test_cases)
        assertion = self.evaluate_assertions(test_cases)
        redundancy = self.check_redundancy(test_cases)
        ai_confidence = self.get_ai_confidence(test_cases)
        edge = self.detect_edge_cases(test_cases)
        
        # Weighted Accuracy Score
        # (0.25 × Coverage) + (0.20 × Step Validity) + (0.15 × Assertion Quality) + (0.10 × Redundancy) + (0.15 × AI Confidence) + (0.15 × Edge Coverage)
        
        accuracy_score = (
            (0.25 * coverage) +
            (0.20 * validity) +
            (0.15 * assertion) +
            (0.10 * redundancy) +
            (0.15 * ai_confidence) +
            (0.15 * edge)
        )
        
        return {
            "overall_accuracy": round(accuracy_score, 2),
            "metrics": {
                "coverage": round(coverage, 2),
                "validity": round(validity, 2),
                "assertion": round(assertion, 2),
                "redundancy": round(redundancy, 2),
                "ai_confidence": round(ai_confidence, 2),
                "edge": round(edge, 2)
            },
            "suggestion": self.get_suggestion(accuracy_score, metrics={
                "coverage": coverage, "validity": validity, "assertion": assertion, 
                "redundancy": redundancy, "edge": edge
            })
        }

    def get_suggestion(self, score: float, metrics: Dict) -> str:
        if score > 85:
            return "Excellent! The test cases are highly comprehensive and valid."
        elif score > 70:
            if metrics["edge"] < 50:
                return "Good start, but consider adding more edge cases for robust coverage."
            return "Solid test suite, but minor refinements in step validity could help."
        elif score > 50:
            if metrics["coverage"] < 60:
                return "The test suite misses key requirement keywords. Expand coverage."
            return "Moderate quality. Improve assertion depth and reduce redundancy."
        else:
            return "Low accuracy detected. Review requirement keywords and ensure all steps use valid actions."
