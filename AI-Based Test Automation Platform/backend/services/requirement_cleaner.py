"""
requirement_cleaner.py
-----------------------
Utility to strip previous AI-generated formatting from a requirement string
before re-sending it to the LLM.  Guarantees the LLM always receives only
the raw, original user intent — no matter how many times "Refine" is clicked.
"""

import re


# ── Heading tokens that our refine prompt emits ───────────────────────────────
# Add any new section headers here and they will be stripped automatically.
_KNOWN_HEADINGS = [
    "REFINED REQUIREMENT",
    "OBJECTIVE",
    "ACCEPTANCE CRITERIA",
    "PRECONDITIONS",
    "OUT OF SCOPE",
    "NOTES",
    "EDGE CASES",
    "DEPENDENCIES",
]

# Compiled once at import time for efficiency
_HEADING_RE = re.compile(
    r"^(?:" + "|".join(re.escape(h) for h in _KNOWN_HEADINGS) + r")\s*:?",
    re.IGNORECASE | re.MULTILINE,
)

# Numbered / bulleted list prefixes  (e.g. "1.", "2.", "•", "-", "*")
_LIST_PREFIX_RE = re.compile(r"^\s*(?:\d+\.|[-•*])\s+", re.MULTILINE)

# Markdown bold / italic artefacts
_MARKDOWN_RE = re.compile(r"[*_]{1,3}")

# Multiple consecutive blank lines → single blank line
_MULTI_BLANK_RE = re.compile(r"\n{3,}")


def extract_raw_requirement(text: str) -> str:
    """
    Given any text (raw user input OR previously refined output), return only
    the clean, original user requirement.

    Strategy
    --------
    1. If the text does NOT contain any known heading tokens, it is already raw
       — return it stripped.
    2. If it DOES contain headings, try to extract the value after OBJECTIVE:.
       That is the closest approximation of the original intent.
    3. Fallback: strip all heading lines and list prefixes, collapse whitespace.
    """
    stripped = text.strip()

    # Fast path: no AI-generated headings present
    if not _HEADING_RE.search(stripped):
        return stripped

    # Try to pull out the OBJECTIVE value (first sentence / clause)
    objective_match = re.search(
        r"OBJECTIVE\s*:?\s*(.+?)(?=\n[A-Z ]{4,}:|\Z)",
        stripped,
        re.IGNORECASE | re.DOTALL,
    )
    if objective_match:
        candidate = objective_match.group(1).strip()
        # Remove nested list bullets inside the objective block
        candidate = _LIST_PREFIX_RE.sub("", candidate)
        candidate = _MARKDOWN_RE.sub("", candidate)
        candidate = _MULTI_BLANK_RE.sub("\n\n", candidate).strip()
        if len(candidate) > 20:          # sanity: must be meaningful
            return candidate

    # Fallback: remove every known heading line and clean up the rest
    cleaned = _HEADING_RE.sub("", stripped)
    cleaned = _LIST_PREFIX_RE.sub("", cleaned)
    cleaned = _MARKDOWN_RE.sub("", cleaned)
    cleaned = _MULTI_BLANK_RE.sub("\n\n", cleaned).strip()
    return cleaned


def build_refine_prompt(raw_requirement: str) -> str:
    """
    Returns a prompt that instructs the LLM to produce exactly ONE clean,
    structured output — no repetition, no nested refinements.
    """
    return f"""You are a senior QA requirements analyst.

INPUT (raw user requirement):
\"\"\"
{raw_requirement}
\"\"\"

INSTRUCTIONS:
- Read the INPUT above carefully.
- Rewrite it as a concise, unambiguous software quality requirement.
- Do NOT include any commentary, preamble, or meta-text.
- Do NOT repeat this instruction block in your output.
- Output ONLY the following sections, each on its own line:

OBJECTIVE: <one sentence describing the primary testable goal>

ACCEPTANCE CRITERIA:
1. <criterion>
2. <criterion>
3. <criterion>

PRECONDITIONS: <any prerequisite state or data needed>

EDGE CASES: <comma-separated list of edge cases to validate>

OUTPUT NOTHING ELSE. No introduction. No conclusion. No markdown fences."""
