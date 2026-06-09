#!/usr/bin/env python3
import os
import re
import json
import time
import shutil
import asyncio
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

try:
    from playwright.async_api import async_playwright
except Exception:
    async_playwright = None

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
except Exception:
    A4 = None


ROOT = Path(".").resolve()
DATADIR = ROOT / "data"
ARTIFACTSDIR = ROOT / "artifacts"
REPORTSDIR = ROOT / "reports"
SCREENSHOTSDIR = ROOT / "screenshots"

LATEST_ANALYSIS = DATADIR / "latest_analysis.json"
APPROVED_SCENARIO = DATADIR / "approved_scenario.json"
RUNSFILE = DATADIR / "runs.json"              # dict keyed by runid
REPORTINDEX = DATADIR / "report_index.json"   # dict {reports: [ ... ]}


SUPPORTEDACTIONS = {
    "goto",
    "waitforselector",
    "click",
    "fill",
    "press",
    "waitfortimeout",
    "expecturlcontains",
    "expecttextvisible",
}

PROJECTS = {
    "checkout-web": "Checkout Web",
    "mobile-app": "Mobile App",
    "admin-portal": "Admin Portal",
}


def ensuredirs() -> None:
    for d in (DATADIR, ARTIFACTSDIR, REPORTSDIR, SCREENSHOTSDIR):
        d.mkdir(parents=True, exist_ok=True)

    if not RUNSFILE.exists():
        RUNSFILE.write_text(json.dumps({}, indent=2), encoding="utf-8")

    if not REPORTINDEX.exists():
        REPORTINDEX.write_text(json.dumps({"reports": []}, indent=2), encoding="utf-8")

    if not LATEST_ANALYSIS.exists():
        LATEST_ANALYSIS.write_text(json.dumps({}, indent=2), encoding="utf-8")

    if not APPROVED_SCENARIO.exists():
        APPROVED_SCENARIO.write_text(json.dumps({}, indent=2), encoding="utf-8")


def stamp() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def normalizeurl(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return "https://" + url


def readjson(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        txt = path.read_text(encoding="utf-8").strip()
        if not txt:
            return default
        return json.loads(txt)
    except Exception:
        return default


def writejson(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def extractjsonobject(text: str) -> Dict[str, Any]:
    if not text or not text.strip():
        raise ValueError("Empty model response.")
    cleaned = text.strip()
    cleaned = re.sub(r"^```", "", cleaned.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    m = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not m:
        raise ValueError("Could not locate JSON object in model output.")
    return json.loads(m.group(0))


class GroqClient:
    def __init__(self, apikey: str, model: str = "llama-3.3-70b-versatile"):
        self.apikey = apikey
        self.model = model
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    def chattext(self, messages: List[Dict[str, str]], temperature: float = 0.2, maxtokens: int = 2200) -> str:
        headers = {"Authorization": f"Bearer {self.apikey}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": messages, "temperature": temperature, "max_tokens": maxtokens}
        r = requests.post(self.url, headers=headers, json=payload, timeout=120)
        if not (200 <= r.status_code < 300):
            raise RuntimeError(f"Groq HTTP {r.status_code}: {r.text}")
        data = r.json()
        return data["choices"][0]["message"]["content"]

    def chatjson(self, messages: List[Dict[str, str]], temperature: float = 0.2, maxtokens: int = 2200) -> Dict[str, Any]:
        txt = self.chattext(messages, temperature=temperature, maxtokens=maxtokens)
        rawpath = ARTIFACTSDIR / f"groq_raw_{stamp()}.txt"
        rawpath.write_text(txt, encoding="utf-8")
        return extractjsonobject(txt)


class PerplexityClient:
    def __init__(self, apikey: str, model: str = "sonar-pro"):
        self.apikey = apikey
        self.model = model
        self.url = "https://api.perplexity.ai/chat/completions"

    def chattext(self, messages: List[Dict[str, str]], temperature: float = 0.2, maxtokens: int = 2200) -> str:
        headers = {"Authorization": f"Bearer {self.apikey}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": messages, "temperature": temperature, "max_tokens": maxtokens}
        r = requests.post(self.url, headers=headers, json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]

    def chatjson(self, messages: List[Dict[str, str]], temperature: float = 0.2, maxtokens: int = 2200) -> Dict[str, Any]:
        txt = self.chattext(messages, temperature=temperature, maxtokens=maxtokens)
        rawpath = ARTIFACTSDIR / f"pplx_raw_{stamp()}.txt"
        rawpath.write_text(txt, encoding="utf-8")
        return extractjsonobject(txt)


def build_analysis_prompt(payload: Dict[str, Any], combinedtext: str) -> List[Dict[str, str]]:
    system = (
        "You are an expert QA analyst. Turn requirement text into structured scenarios and analysis.\n"
        "Return JSON ONLY with schema:\n"
        "{\n"
        '  "interpretedIntent": "...",\n'
        '  "confidenceScore": 95,\n'
        '  "projectId": "...",\n'
        '  "applicationUrl": "...",\n'
        '  "targetType": "website" | "api",\n'
        '  "scenario": {\n'
        '    "title": "...",\n'
        '    "kind": "website" | "api",\n'
        '    "actions": [\n'
        '      {"testCaseId": "TC-...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "Medium", "type":"goto","url":"...","waitUntil":"domcontentloaded"},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "High", "type":"waitforselector","selector":"...","timeoutMs":15000},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "High", "type":"click","selector":"...","timeoutMs":15000},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "High", "type":"fill","selector":"...","text":"...","timeoutMs":15000},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "High", "type":"press","selector":"...","key":"Enter","timeoutMs":15000},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "Low", "type":"waitfortimeout","timeoutMs":1000},\n'
        '      {"testCaseId": "...", "description": "...", "reason": "...", "expectedOutcome": "...", "severity": "High", "type":"expecttextvisible","text":"...","timeoutMs":15000}\n'
        "    ]\n"
        "  },\n"
        '  "quality": {\n'
        '    "readinessScore": 0,\n'
        '    "requirementCoveragePct": 0,\n'
        '    "filesImpacted": 0,\n'
        '    "scenarioReadiness": "Ready" | "Needs review",\n'
        '    "openClarifications": 0\n'
        "  },\n"
        '  "findings": [ {"severity":"Low|Medium|High","category":"Gap|Ambiguity|Edge","title":"...","detail":"..."} ],\n'
        '  "coverage": {"happy":0,"negative":0,"edge":0,"nonFunctional":0},\n'
        '  "riskHotspots": [ {"module":"...","risk":"Low|Medium|High","owner":"...","reason":"..."} ]\n'
        "}\n"
        "Rules:\n"
        "- Keep output valid JSON.\n"
        "- Prefer stable selectors: id or name first, then aria-label. Avoid data-testid unless no other option.\n"
        "- Actions should be minimal and robust.\n"
    )
    user = (
        f"ProjectId: {payload.get('projectId')}\n"
        f"ApplicationUrl: {payload.get('applicationUrl')}\n"
        f"TargetType: {payload.get('targetType')}\n"
        f"RequirementText:\n{combinedtext}\n"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def get_llm():
    groqkey = (os.getenv("GROQ_API_KEY") or os.getenv("GROQAPIKEY") or "").strip()
    pplxkey = (os.getenv("PERPLEXITY_API_KEY") or os.getenv("PERPLEXITYAPIKEY") or "").strip()
    if groqkey:
        model = (os.getenv("GROQ_MODEL") or os.getenv("GROQMODEL") or "llama-3.3-70b-versatile").strip()
        return GroqClient(apikey=groqkey, model=model), "Groq"
    if pplxkey:
        model = (os.getenv("PPLX_MODEL") or os.getenv("PPLXMODEL") or "sonar-pro").strip()
        return PerplexityClient(apikey=pplxkey, model=model), "Perplexity"
    return None, None


def analyze_input(payload: Dict[str, Any], combinedtext: str) -> Dict[str, Any]:
    llm, llmname = get_llm()
    if llm is None:
        raise RuntimeError("No LLM key set. Set GROQ_API_KEY or PERPLEXITY_API_KEY in backend/.env")

    # Use dynamic prompt only for Groq, else use normal static prompt
    if llmname == "Groq":
        msgs = build_analysis_promptpayload_dynamic(payload, combinedtext, llm)
    else:
        msgs = build_analysis_prompt(payload, combinedtext)

    try:
        out = llm.chatjson(msgs, temperature=0.2, maxtokens=3200)
    except Exception:
        txt = llm.chattext(msgs, temperature=0.2, maxtokens=3200)
        out = {
            "error": "Model returned non-JSON output",
            "rawText": txt,
            "projectId": payload.get("projectId"),
            "applicationUrl": payload.get("applicationUrl"),
            "targetType": payload.get("targetType"),
        }

    out.setdefault("projectId", payload.get("projectId"))
    out.setdefault("applicationUrl", payload.get("applicationUrl"))
    out.setdefault("targetType", payload.get("targetType"))
    return out


def msv(v: Any, default: int) -> int:
    if v is None:
        return default
    try:
        return int(v)
    except Exception:
        return default
def resolve_selectors(action: Dict[str, Any]) -> List[str]:
    """
    Force correct selectors for Amazon site or return multiple fallbacks.
    """
    t = (action.get("type") or "").strip().lower()

    amz_sel = ""
    # Search box
    if t in ("fill", "waitforselector", "press"):
        amz_sel = "#twotabsearchtextbox"
    elif t in ("click", "waitforselector") and "submit" in (action.get("text", "") + action.get("value", "")).lower():
        amz_sel = "#nav-search-submit-button"
    elif t in ("click", "waitforselector") and "cart" in (action.get("text", "") + action.get("value", "")).lower():
        amz_sel = "#nav-cart"
    elif t in ("waitforselector", "expecttextvisible"):
        amz_sel = "[data-component-type='s-search-result']"

    results = []
    if amz_sel: results.append(amz_sel)

    sel = action.get("selector")
    if isinstance(sel, dict) and "value" in sel:
        if sel["value"] not in results: results.append(sel["value"])
    elif isinstance(sel, str):
        if sel not in results: results.append(sel)
        
    if "selectors" in action and isinstance(action["selectors"], list):
        for s in action["selectors"]:
            if s and isinstance(s, str) and s not in results:
                results.append(s)

    return results if results else [""]

async def runactions(
    actions: List[Dict[str, Any]],
    headless: bool,
    screenshotpath: Path,
    keepbrowseropen: bool = False,
    on_step: Optional[Any] = None,
) -> Tuple[bool, str, Optional[str], List[Dict[str, Any]]]:
    if async_playwright is None:
        return False, "Playwright not installed.", "Missing playwright dependency", []

    if not actions or not isinstance(actions, list):
        return False, "No valid actions provided.", "Execution aborted due to empty actions list.", []

    page = None
    browser = None
    started = time.time()
    results: List[Dict[str, Any]] = []

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=headless)
            ctx = await browser.new_context()
            page = await ctx.new_page()

            for i, a in enumerate(actions, start=1):
                t = (a.get("type") or "").strip()
                if t not in SUPPORTEDACTIONS:
                    raise ValueError(f"Unsupported action type {t!r}")

                # Normalize selector: if it's an object, take its "value"
                # Normalize selector: handle dicts and lists
                    # Normalize selector: handle dicts and lists
                # Always resolve Amazon selectors first
                selectors = resolve_selectors(a)
                chosen_selector = selectors[0] if selectors else ""

                stepstarted = time.time()
                stepstatus = "PASS"
                steperr = None

                if on_step:
                    try:
                        await on_step({"type": "step_start", "idx": i, "testCaseId": a.get("testCaseId"), "description": a.get("description"), "actionType": t})
                    except Exception:
                        pass

                try:
                    print(f"DEBUG: Step execution (idx={i}): type={t}, description=\"{a.get('description', '')}\"")
                    if t == "goto":
                        url = a.get("url", "")
                        if not url:
                            sel_list = a.get("selectors", [])
                            if isinstance(sel_list, list):
                                for s in sel_list:
                                    if isinstance(s, dict) and s.get("type") == "url":
                                        url = s.get("value", "")
                                        break
                                    elif isinstance(s, str) and s.startswith("http"):
                                        url = s
                                        break
                        if not url:
                            raise ValueError(f"URL is missing for goto action in step {i}. Ensure 'url' or 'selectors' is properly defined.")
                        print(f"DEBUG: URL extracted for goto action: {url}")
                        await page.goto(normalizeurl(url), wait_until=a.get("waitUntil", "domcontentloaded"))
                    elif t == "waitfortimeout":
                        await page.wait_for_timeout(msv(a.get("timeoutMs"), 1000))
                    elif t == "expecturlcontains":
                        expected = a.get("text", "") or a.get("urlContains", "")
                        if expected and expected not in page.url:
                            raise AssertionError(f"Step {i} URL mismatch. Expected contains {expected!r}, got {page.url!r}")
                    elif t == "expecttextvisible": 
                        txt = a.get("text", "") or a.get("value", "") 
                        await page.get_by_text(txt).first.wait_for(timeout=msv(a.get("timeoutMs"), 15000))
                    else:
                        # Fallback loop for selector-based actions
                        last_err = None
                        success = False
                        for sel in selectors:
                            try:
                                if t == "waitforselector":
                                    await page.wait_for_selector(sel, timeout=msv(a.get("timeoutMs"), 15000))
                                elif t == "click":
                                    await page.click(sel, timeout=msv(a.get("timeoutMs"), 15000))
                                elif t == "fill": 
                                    await page.fill(sel, a.get("text", "") or a.get("value", ""), timeout=msv(a.get("timeoutMs"), 15000))
                                elif t == "press":
                                    await page.press(sel, a.get("key", "Enter"), timeout=msv(a.get("timeoutMs"), 15000))
                                
                                chosen_selector = sel
                                success = True
                                break
                            except Exception as e:
                                last_err = e
                        if not success and last_err:
                            raise last_err

                except Exception as e:
                    stepstatus = "FAIL"
                    steperr = str(e)
                    raise
                finally:
                    durms = int((time.time() - stepstarted) * 1000)
                    if on_step:
                        try:
                            await on_step({"type": "step_end", "idx": i, "status": stepstatus, "error": steperr})
                        except Exception:
                            pass
                    results.append(
                        {
                            "idx": i,
                            "testCaseId": a.get("testCaseId", f"TC-{i:03d}"),
                            "description": a.get("description", t),
                            "actionType": t,
                            "reason": a.get("reason", ""),
                            "expectedOutcome": a.get("expectedOutcome", "Action completed"),
                            "observedOutcome": "Passed successfully" if stepstatus == "PASS" else f"Failed: {steperr}",
                            "severity": a.get("severity", "Medium"),
                            "status": stepstatus,
                            "error": steperr,
                            "durationMs": durms,
                            "chosenLocator": chosen_selector,
                        }
                    )

            await page.screenshot(path=str(screenshotpath), full_page=True)

            elapsed = round(time.time() - started, 2)
            actual = f"Executed {len(actions)} actions successfully in {elapsed}s."

            if keepbrowseropen and not headless:
                input("Browser kept open. Press Enter to close...")
            await browser.close()

            return True, actual, None, results

        except Exception as e:
            try:
                if page is not None:
                    await page.screenshot(path=str(screenshotpath), full_page=True)
            except Exception:
                pass

            if browser is not None:
                if keepbrowseropen and not headless:
                    print("Run failed, browser kept open for debugging.")
                    print(f"Error: {e}")
                    input("Press Enter to close browser...")
                try:
                    await browser.close()
                except Exception:
                    pass

            return False, "Execution failed.", str(e), results


def generatepdfreport(runrecord: Dict[str, Any], pdfpath: Path) -> None:
    if A4 is None:
        raise RuntimeError("reportlab not installed. Install: pip install reportlab")

    styles = getSampleStyleSheet()
    title = ParagraphStyle("T", parent=styles["Heading1"], fontSize=18, textColor=colors.HexColor("#1f4788"))
    h = ParagraphStyle("H", parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor("#2c5aa0"))

    doc = SimpleDocTemplate(str(pdfpath), pagesize=A4, leftMargin=0.7 * inch, rightMargin=0.7 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    story: List[Any] = []

    story.append(Paragraph("Test Execution Report", title))
    story.append(Paragraph(f"Generated at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
    story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("Run Summary", h))
    summarydata = [
        ["Run ID", runrecord.get("runId", "")],
        ["Project", runrecord.get("projectId", "")],
        ["Environment", runrecord.get("environment", "")],
        ["Status", runrecord.get("status", "")],
        ["Started", runrecord.get("startedAt", "")],
        ["Finished", runrecord.get("finishedAt", "")],
        ["Error", runrecord.get("error") or "None"],
    ]
    summary = Table(summarydata, colWidths=[1.5 * inch, 4.7 * inch])
    summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef4fb")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(summary)
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph("Scenario", h))
    scenario = runrecord.get("scenario") or {}
    story.append(Paragraph(f"<b>Title</b>: {scenario.get('title', 'Untitled')}", styles["Normal"]))
    story.append(Spacer(1, 0.12 * inch))

    ars = runrecord.get("actionResults") or []
    if ars:
        story.append(Paragraph("Action Results", h))
        scenario_title_text = (scenario.get('title') or 'Untitled')
        if len(scenario_title_text) > 30: scenario_title_text = scenario_title_text[:27] + "..."
        scenario_title = Paragraph(scenario_title_text, styles["Normal"])
        
        normal_font = ParagraphStyle("S", parent=styles["Normal"], fontSize=8, leading=10)
        bold_font = ParagraphStyle("B", parent=styles["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold", textColor=colors.white)
        
        data = [[
            Paragraph("Scenario", bold_font), 
            Paragraph("TC ID", bold_font), 
            Paragraph("Description", bold_font), 
            Paragraph("Action", bold_font), 
            Paragraph("Expected", bold_font), 
            Paragraph("Observed", bold_font), 
            Paragraph("Status", bold_font), 
            Paragraph("Sev", bold_font)
        ]]
        
        for a in ars:
            data.append(
                [
                    scenario_title,
                    Paragraph(str(a.get("testCaseId", "")), normal_font),
                    Paragraph(str(a.get("description", "")), normal_font),
                    Paragraph(str(a.get("actionType", "")), normal_font),
                    Paragraph(str(a.get("expectedOutcome", "")), normal_font),
                    Paragraph(str(a.get("observedOutcome", "")), normal_font),
                    Paragraph(str(a.get("status", "")), normal_font),
                    Paragraph(str(a.get("severity", "")), normal_font),
                ]
            )
            
        tbl = Table(data, colWidths=[0.8 * inch, 0.6 * inch, 1.1 * inch, 0.7 * inch, 1.0 * inch, 1.3 * inch, 0.6 * inch, 0.5 * inch])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#208078")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(tbl)
        story.append(Spacer(1, 0.2 * inch))

    screenshot = runrecord.get("screenshot")
    if screenshot and Path(screenshot).exists():
        story.append(Paragraph("Screenshot", h))
        try:
            story.append(RLImage(screenshot, width=6.2 * inch, height=3.6 * inch))
        except Exception as e:
            story.append(Paragraph(f"Could not embed screenshot: {e}", styles["Normal"]))

    doc.build(story)


def generate_playwright_script(scenario: Dict[str, Any], script_path: Path) -> None:
    lines = [
        "import asyncio",
        "from playwright.async_api import async_playwright",
        "",
        "async def run():",
        "    async with async_playwright() as p:",
        "        browser = await p.chromium.launch(headless=False)",
        "        context = await browser.new_context()",
        "        page = await context.new_page()",
        ""
    ]
    
    actions = scenario.get("actions", [])
    for idx, a in enumerate(actions, start=1):
        t = (a.get("type") or "").strip().lower()
        desc = a.get("description", "")
        if desc: lines.append(f"        # Step {idx}: {desc}")
        
        timeout = msv(a.get("timeoutMs"), 15000)
        
        if t == "goto":
            url = normalizeurl(a.get("url", ""))
            lines.append(f"        await page.goto({url!r})")
        elif t == "waitforselector":
            sel = a.get("selector", "")
            if isinstance(sel, dict) and "value" in sel: sel = sel["value"]
            elif "selectors" in a and isinstance(a["selectors"], list) and a["selectors"]: sel = a["selectors"][0]
            lines.append(f"        await page.wait_for_selector({sel!r}, timeout={timeout})")
        elif t == "click":
            sel = a.get("selector", "")
            if isinstance(sel, dict) and "value" in sel: sel = sel["value"]
            elif "selectors" in a and isinstance(a["selectors"], list) and a["selectors"]: sel = a["selectors"][0]
            lines.append(f"        await page.click({sel!r}, timeout={timeout})")
        elif t == "fill":
            sel = a.get("selector", "")
            if isinstance(sel, dict) and "value" in sel: sel = sel["value"]
            elif "selectors" in a and isinstance(a["selectors"], list) and a["selectors"]: sel = a["selectors"][0]
            val = a.get("text", "") or a.get("value", "")
            lines.append(f"        await page.fill({sel!r}, {val!r}, timeout={timeout})")
        elif t == "press":
            sel = a.get("selector", "")
            if isinstance(sel, dict) and "value" in sel: sel = sel["value"]
            elif "selectors" in a and isinstance(a["selectors"], list) and a["selectors"]: sel = a["selectors"][0]
            key = a.get("key", "Enter")
            lines.append(f"        await page.press({sel!r}, {key!r}, timeout={timeout})")
        elif t == "waitfortimeout":
            timeoutms = msv(a.get("timeoutMs"), 1000)
            lines.append(f"        await page.wait_for_timeout({timeoutms})")
        elif t == "expecturlcontains":
            val = a.get("text", "") or a.get("urlContains", "")
            lines.append(f"        assert {val!r} in page.url")
        elif t == "expecttextvisible":
            val = a.get("text", "") or a.get("value", "")
            lines.append(f"        await page.get_by_text({val!r}).first.wait_for(timeout={timeout})")
    
    lines.extend([
        "",
        "        await browser.close()",
        "",
        "if __name__ == '__main__':",
        "    asyncio.run(run())",
        ""
    ])
    
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text("\n".join(lines), encoding="utf-8")


def upsertrun(runid: str, runobj: Dict[str, Any]) -> None:
    runs = readjson(RUNSFILE, {})
    if not isinstance(runs, dict):
        runs = {}
    runs[runid] = runobj
    writejson(RUNSFILE, runs)


def registerreport(runid: str, jsonreport: Path, pdfreport: Optional[Path], screenshotpath: Optional[Path]) -> None:
    idx = readjson(REPORTINDEX, {"reports": []})
    if not isinstance(idx, dict):
        idx = {"reports": []}
    if "reports" not in idx or not isinstance(idx["reports"], list):
        idx["reports"] = []

    idx["reports"].append(
        {
            "runId": runid,
            "json": str(jsonreport),
            "pdf": str(pdfreport) if pdfreport else None,
            "screenshot": str(screenshotpath) if screenshotpath else None,
            "createdAt": datetime.now().isoformat(),
        }
    )
    writejson(REPORTINDEX, idx)


def promptmultiline(label: str) -> str:
    print(label)
    lines = []
    while True:
        line = input()
        if not line.strip():
            break
        lines.append(line)
    return "\n".join(lines).strip()


def cli_menu() -> None:
    load_dotenv()
    ensuredirs()

    while True:
        print("-" * 70)
        print("AI Test Automation - Menu Driven CLI")
        print("-" * 70)
        print("1  Data Input Text")
        print("2  Data Input Files/ZIP (store as artifact)")
        print("3  Analysis Review View latest")
        print("4  Send to Test Console Approve")
        print("5  Test Console Run approved")
        print("6  Execution Dashboard List runs")
        print("7  Reports List export paths")
        print("8  Start Web Server (FastAPI)")
        print("9  Exit")
        choice = input("> ").strip()

        if choice == "1":
            print("Project ids:", ", ".join(PROJECTS.keys()))
            projectid = input("Project id: ").strip() or "checkout-web"
            appurl = input("Application URL: ").strip()
            targettype = (input("Target type website/api: ").strip().lower() or "website")
            reqtext = promptmultiline("Requirement text (multi-line). Press Enter on empty line to finish:")

            payload = {"projectId": projectid, "applicationUrl": normalizeurl(appurl), "targetType": targettype}
            analysis = analyze_input(payload, reqtext)
            writejson(LATEST_ANALYSIS, analysis)
            print(f"Saved latest analysis -> {LATEST_ANALYSIS}")

        elif choice == "2":
            print("Project ids:", ", ".join(PROJECTS.keys()))
            projectid = input("Project id: ").strip() or "checkout-web"
            appurl = input("Application URL: ").strip()
            targettype = (input("Target type website/api: ").strip().lower() or "website")
            filepath = input("Path to file/zip/folder: ").strip()
            p = Path(filepath)
            if not p.exists():
                print("File not found.")
                continue

            dest = ARTIFACTSDIR / f"input_{stamp()}_{p.name}"
            if p.is_dir():
                shutil.make_archive(str(dest), "zip", root_dir=str(p))
                combined = f"Folder uploaded: {p} -> {dest}.zip"
            else:
                shutil.copy2(p, dest)
                combined = f"File uploaded: {dest.name}"

            payload = {"projectId": projectid, "applicationUrl": normalizeurl(appurl), "targetType": targettype}
            analysis = analyze_input(payload, combined)
            writejson(LATEST_ANALYSIS, analysis)
            print(f"Saved latest analysis -> {LATEST_ANALYSIS}")

        elif choice == "3":
            print(LATEST_ANALYSIS.read_text(encoding="utf-8"))

        elif choice == "4":
            analysis = readjson(LATEST_ANALYSIS, {})
            scenario = analysis.get("scenario")
            if not isinstance(scenario, dict):
                print("Latest analysis does not contain a structured scenario.")
                continue
            writejson(APPROVED_SCENARIO, scenario)
            print(f"Approved scenario saved -> {APPROVED_SCENARIO}")

        elif choice == "5":
            scenario = readjson(APPROVED_SCENARIO, {})
            actions = scenario.get("actions") if isinstance(scenario, dict) else None
            if not actions:
                print("No approved scenario/actions. Use option 4 first.")
                continue

            headless = (os.getenv("HEADLESS", "true").strip().lower() != "false")
            keepopenenv = (os.getenv("KEEP_BROWSER_OPEN", "false").strip().lower() == "true")
            keepbrowseropen = keepopenenv
            if not headless:
                ans = input("Keep browser open after run? yN ").strip().lower()
                if ans in ("y", "yes"):
                    keepbrowseropen = True

            runid = f"run_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(3).hex()}"
            screenshotpath = SCREENSHOTSDIR / f"{runid}.png"
            startedat = datetime.now().isoformat()

            ok, actual, err, actionresults = asyncio.run(
                runactions(actions, headless=headless, screenshotpath=screenshotpath, keepbrowseropen=keepbrowseropen)
            )

            finishedat = datetime.now().isoformat()
            status = "PASS" if ok else "FAIL"

            latest = readjson(LATEST_ANALYSIS, {})
            projectid = latest.get("projectId") or "checkout-web"

            jsonreportpath = REPORTSDIR / f"{runid}.json"
            pdfreportpath = REPORTSDIR / f"{runid}.pdf"
            scriptpath = REPORTSDIR / f"{runid}_playwright_script.py"

            runobj: Dict[str, Any] = {
                "runId": runid,
                "projectId": projectid,
                "environment": "Chrome headless" if headless else "Chrome",
                "runType": "full-execution",
                "status": status,
                "startedAt": startedat,
                "finishedAt": finishedat,
                "error": err,
                "actionResults": actionresults,
                "scenario": scenario,
                "actualResult": actual,
                "screenshot": str(screenshotpath) if screenshotpath.exists() else None,
                "reportPaths": {"json": str(jsonreportpath), "pdf": str(pdfreportpath) if A4 is not None else None, "script": str(scriptpath)},
            }

            writejson(jsonreportpath, runobj)

            try:
                generate_playwright_script(scenario, scriptpath)
            except Exception:
                runobj["reportPaths"]["script"] = None

            pdfok = False
            if A4 is not None:
                try:
                    generatepdfreport(runobj, pdfreportpath)
                    pdfok = True
                except Exception as e:
                    runobj["reportPaths"]["pdf"] = None
                    runobj["pdfError"] = str(e)
                    writejson(jsonreportpath, runobj)

            upsertrun(runid, runobj)
            registerreport(runid, jsonreportpath, pdfreportpath if pdfok else None, screenshotpath if screenshotpath.exists() else None)

            print(json.dumps({k: runobj.get(k) for k in ("runId", "status", "startedAt", "finishedAt", "error")}, indent=2))
            print(f"Report JSON saved: {jsonreportpath}")
            print(f"Report PDF saved:  {pdfreportpath if pdfok else 'Not generated'}")

        elif choice == "6":
            runs = readjson(RUNSFILE, {})
            if not runs:
                print("No runs yet.")
                continue
            for runid, r in list(runs.items())[-20:]:
                title = ((r.get("scenario") or {}).get("title")) if isinstance(r, dict) else ""
                print(f"- {runid}  {r.get('status')}  {title}  {r.get('startedAt')}")

        elif choice == "7":
            idx = readjson(REPORTINDEX, {"reports": []})
            reps = idx.get("reports") if isinstance(idx, dict) else []
            if not reps:
                print("No reports yet.")
                continue
            for r in reps[-30:]:
                print(f"- runId: {r.get('runId')}")
                print(f"  json: {r.get('json')}")
                print(f"  pdf:  {r.get('pdf')}")
                print(f"  screenshot: {r.get('screenshot')}")

        elif choice == "8":
            start_fastapi_server()

        elif choice == "9":
            print("Bye.")
            return

        else:
            print("Invalid option.")


def start_fastapi_server() -> None:
    ensuredirs()
    load_dotenv()

    try:
        from fastapi import FastAPI, UploadFile, File
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.staticfiles import StaticFiles
        from pydantic import BaseModel
        import uvicorn
    except Exception:
        print("FastAPI/uvicorn not installed. Install: pip install fastapi uvicorn pydantic")
        return

    app = FastAPI(title="AI Test Automation Server")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/files/reports", StaticFiles(directory=str(REPORTSDIR)), name="reports")
    app.mount("/files/screenshots", StaticFiles(directory=str(SCREENSHOTSDIR)), name="screenshots")
    app.mount("/files/artifacts", StaticFiles(directory=str(ARTIFACTSDIR)), name="artifacts")

    class AnalyzeRequest(BaseModel):
        projectId: str
        applicationUrl: str
        targetType: str = "website"
        requirementText: str

    class ApproveRequest(BaseModel):
        scenario: Dict[str, Any]

    class RunRequest(BaseModel):
        headless: bool = True
        keepBrowserOpen: bool = False

    @app.get("/api/health")
    def health():
        return {"status": "ok", "time": datetime.now().isoformat()}

    @app.get("/api/analysis/latest")
    def api_latest_analysis():
        return readjson(LATEST_ANALYSIS, {})

    @app.post("/api/analyze")
    def api_analyze(req: AnalyzeRequest):
        print(f"DEBUG: API hit /api/analyze for Project={req.projectId}, URL={req.applicationUrl}")
        payload = {
            "projectId": req.projectId,
            "applicationUrl": normalizeurl(req.applicationUrl),
            "targetType": req.targetType,
        }
        analysis = analyze_input(payload, req.requirementText)
        
        scenario = analysis.get("scenario")
        if not scenario or not isinstance(scenario, dict):
            print("WARNING: Malformed scenario generated. Using fallback.")
            analysis["scenario"] = {"title": "Failed to generate scenario", "actions": []}
            if "findings" not in analysis:
                analysis["findings"] = []
            analysis["findings"].append({"severity": "High", "category": "Ambiguity", "title": "Generation Failed", "detail": "The AI failed to generate a well-structured scenario."})
            
        print(f"DEBUG: Scenario received with {len(analysis.get('scenario', {}).get('actions', []))} actions.")
        writejson(LATEST_ANALYSIS, analysis)
        return analysis

    @app.post("/api/analyze/upload")
    async def api_analyze_upload(
        projectId: str,
        applicationUrl: str,
        targetType: str = "website",
        file: UploadFile = File(...),
    ):
        print(f"DEBUG: API hit /api/analyze/upload for Project={projectId}, URL={applicationUrl}")
        ensuredirs()
        fname = f"upload_{stamp()}_{file.filename}"
        dest = ARTIFACTSDIR / fname
        content = await file.read()
        dest.write_bytes(content)

        payload = {"projectId": projectId, "applicationUrl": normalizeurl(applicationUrl), "targetType": targetType}
        combinedtext = f"Uploaded file saved as {fname}. Use it as context to generate scenario."
        analysis = analyze_input(payload, combinedtext)
        
        scenario = analysis.get("scenario")
        if not scenario or not isinstance(scenario, dict):
            print("WARNING: Malformed scenario generated from upload. Using fallback.")
            analysis["scenario"] = {"title": "Failed to generate scenario", "actions": []}
            if "findings" not in analysis:
                analysis["findings"] = []
            analysis["findings"].append({"severity": "High", "category": "Ambiguity", "title": "Generation Failed", "detail": "The AI failed to generate a well-structured scenario."})
            
        print(f"DEBUG: Scenario received with {len(analysis.get('scenario', {}).get('actions', []))} actions.")
        writejson(LATEST_ANALYSIS, analysis)
        return analysis

    @app.get("/api/scenario/approved")
    def api_get_approved():
        return readjson(APPROVED_SCENARIO, {})

    @app.post("/api/approve")
    def api_approve(req: ApproveRequest):
        if not isinstance(req.scenario, dict):
            raise ValueError("scenario must be an object")
        writejson(APPROVED_SCENARIO, req.scenario)
        return {"status": "ok", "approvedScenarioPath": str(APPROVED_SCENARIO)}

    from fastapi.responses import StreamingResponse

    @app.get("/api/scenario/script")
    def api_scenario_script():
        scenario = readjson(APPROVED_SCENARIO, {})
        if not scenario:
            return {"status": "error", "message": "No approved scenario."}
        tmp_path = ARTIFACTSDIR / f"tmp_script_{stamp()}.py"
        try:
            generate_playwright_script(scenario, tmp_path)
            code = tmp_path.read_text(encoding="utf-8")
        except Exception as e:
            return {"status": "error", "message": str(e)}
        return {"status": "ok", "script": code}

    @app.post("/api/run/stream")
    async def api_run_stream(req: RunRequest):
        print("DEBUG: API hit /api/run/stream")
        scenario = readjson(APPROVED_SCENARIO, {})
        actions = scenario.get("actions") if isinstance(scenario, dict) else None
        if not actions or not isinstance(actions, list):
            print("WARNING: /api/run/stream aborted due to missing or invalid scenario actions.")
            async def err_gen(): yield json.dumps({"status": "error", "message": "No approved scenario or actions list is invalid."}) + "\n"
            return StreamingResponse(err_gen(), media_type="application/x-ndjson")

        runid = f"run_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(3).hex()}"
        screenshotpath = SCREENSHOTSDIR / f"{runid}.png"
        startedat = datetime.now().isoformat()
        q = asyncio.Queue()

        async def on_step(evt):
            await q.put(evt)

        async def run_task():
            try:
                ok, actual, err, actionresults = await runactions(
                    actions, headless=req.headless, screenshotpath=screenshotpath, keepbrowseropen=req.keepBrowserOpen, on_step=on_step
                )
                
                finishedat = datetime.now().isoformat()
                status = "PASS" if ok else "FAIL"
                latest = readjson(LATEST_ANALYSIS, {})
                projectid = latest.get("projectId") or "checkout-web"
                jsonreportpath = REPORTSDIR / f"{runid}.json"
                pdfreportpath = REPORTSDIR / f"{runid}.pdf"
                scriptpath = REPORTSDIR / f"{runid}_playwright_script.py"

                runobj = {
                    "runId": runid,
                    "projectId": projectid,
                    "environment": "Chrome headless" if req.headless else "Chrome",
                    "runType": "full-execution",
                    "status": status,
                    "startedAt": startedat,
                    "finishedAt": finishedat,
                    "error": err,
                    "actionResults": actionresults,
                    "scenario": scenario,
                    "actualResult": actual,
                    "screenshot": str(screenshotpath) if screenshotpath.exists() else None,
                    "reportPaths": {"json": str(jsonreportpath), "pdf": str(pdfreportpath) if A4 is not None else None, "script": str(scriptpath)},
                }
                writejson(jsonreportpath, runobj)

                try:
                    generate_playwright_script(scenario, scriptpath)
                except Exception:
                    runobj["reportPaths"]["script"] = None

                pdfok = False
                if A4 is not None:
                    try:
                        generatepdfreport(runobj, pdfreportpath)
                        pdfok = True
                    except Exception:
                        runobj["reportPaths"]["pdf"] = None
                        writejson(jsonreportpath, runobj)

                upsertrun(runid, runobj)
                registerreport(runid, jsonreportpath, pdfreportpath if pdfok else None, screenshotpath if screenshotpath.exists() else None)
                
                await q.put({
                    "type": "finish", "ok": ok, "err": err, "runId": runid, "run": runobj,
                    "files": {
                        "reportJsonUrl": f"/files/reports/{runid}.json",
                        "reportPdfUrl": f"/files/reports/{runid}.pdf" if pdfok else None,
                        "screenshotUrl": f"/files/screenshots/{runid}.png" if screenshotpath.exists() else None,
                    }
                })
            except Exception as e:
                await q.put({"type": "finish", "ok": False, "err": str(e), "runId": runid})
            finally:
                await q.put(None)

        asyncio.create_task(run_task())

        async def stream_generator():
            yield json.dumps({"type": "start", "runId": runid}) + "\n"
            while True:
                evt = await q.get()
                if evt is None: break
                yield json.dumps(evt) + "\n"

        return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

    @app.post("/api/run")
    async def api_run(req: RunRequest):
        print("DEBUG: API hit /api/run")
        scenario = readjson(APPROVED_SCENARIO, {})
        actions = scenario.get("actions") if isinstance(scenario, dict) else None
        if not actions or not isinstance(actions, list):
            print("WARNING: /api/run aborted due to missing or invalid scenario actions.")
            return {"status": "error", "message": "No approved scenario/actions list is invalid. Call /api/approve first."}

        runid = f"run_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(3).hex()}"
        screenshotpath = SCREENSHOTSDIR / f"{runid}.png"
        startedat = datetime.now().isoformat()

        ok, actual, err, actionresults = await runactions(
            actions, headless=req.headless, screenshotpath=screenshotpath, keepbrowseropen=req.keepBrowserOpen
        )

        finishedat = datetime.now().isoformat()
        status = "PASS" if ok else "FAIL"

        latest = readjson(LATEST_ANALYSIS, {})
        projectid = latest.get("projectId") or "checkout-web"

        jsonreportpath = REPORTSDIR / f"{runid}.json"
        pdfreportpath = REPORTSDIR / f"{runid}.pdf"
        scriptpath = REPORTSDIR / f"{runid}_playwright_script.py"

        runobj: Dict[str, Any] = {
            "runId": runid,
            "projectId": projectid,
            "environment": "Chrome headless" if req.headless else "Chrome",
            "runType": "full-execution",
            "status": status,
            "startedAt": startedat,
            "finishedAt": finishedat,
            "error": err,
            "actionResults": actionresults,
            "scenario": scenario,
            "actualResult": actual,
            "screenshot": str(screenshotpath) if screenshotpath.exists() else None,
            "reportPaths": {"json": str(jsonreportpath), "pdf": str(pdfreportpath) if A4 is not None else None, "script": str(scriptpath)},
        }

        writejson(jsonreportpath, runobj)

        try:
            generate_playwright_script(scenario, scriptpath)
        except Exception:
            runobj["reportPaths"]["script"] = None

        pdfok = False
        if A4 is not None:
            try:
                generatepdfreport(runobj, pdfreportpath)
                pdfok = True
            except Exception as e:
                runobj["reportPaths"]["pdf"] = None
                runobj["pdfError"] = str(e)
                writejson(jsonreportpath, runobj)

        upsertrun(runid, runobj)
        registerreport(runid, jsonreportpath, pdfreportpath if pdfok else None, screenshotpath if screenshotpath.exists() else None)

        return {
            "status": "ok",
            "run": runobj,
            "files": {
                "reportJsonUrl": f"/files/reports/{runid}.json",
                "reportPdfUrl": f"/files/reports/{runid}.pdf" if pdfok else None,
                "screenshotUrl": f"/files/screenshots/{runid}.png" if screenshotpath.exists() else None,
            },
        }

    @app.get("/api/runs")
    def api_runs():
        return readjson(RUNSFILE, {})

    @app.get("/api/reports")
    def api_reports():
        return readjson(REPORTINDEX, {"reports": []})

    print("Starting FastAPI on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

from urllib.parse import urlparse

def _domain_from_url(url: str) -> str:
    try:
        u = urlparse(url.strip())
        return (u.netloc or "").lower()
    except Exception:
        return ""

def build_dynamic_prompt_with_groq(
    groq: "GroqClient",
    application_url: str,
    target_type: str = "website",
) -> str:
    domain = _domain_from_url(application_url)

    system_meta = (
        "You create system prompts for a Playwright-style test action generator. "
        "Output ONLY the system prompt text (no JSON, no markdown, no quotes). "
        "The prompt MUST be general-purpose and robust across websites."
    )

    user_meta = f"""
Target: {target_type}
Application URL: {application_url}
Domain: {domain}

Generate a system prompt that forces the model to:
- Return JSON ONLY with schema: interpretedIntent, confidenceScore, projectid, applicationurl, targettype, scenario{{title,kind,actions}}, quality, findings, coverage, riskhotspots
- For EVERY action in actions include: testCaseId, description, reason, expectedOutcome, severity (Low|Medium|High)
- Use ONLY these action types: goto, waitforselector, click, fill, press, waitfortimeout, expecturlcontains, expecttextvisible
- Prefer stable selectors (data-testid/data-test/data-cy, aria-label, name, placeholder, unique id)
- Avoid brittle selectors (deep CSS chains, nth-child, generated classes, ambiguous ids)
- For every interactive action (click/fill/press), generate 1 primary selector AND 1–3 fallbacks using a "selectors": [...] array
- Always add waitforselector before click/fill/press using the same selector(s)
- Add site-aware hints only if needed (based on domain), but do not hardcode a single site; keep it general.
"""

    txt = groq.chattext(
        messages=[
            {"role": "system", "content": system_meta},
            {"role": "user", "content": user_meta},
        ],
        temperature=0.2,
        maxtokens=900,
    )
    return txt.strip()


def build_analysis_promptpayload_dynamic(
    payload: Dict[str, Any],
    combinedtext: str,
    groq: "GroqClient",
) -> List[Dict[str, str]]:
    # Step 1: get a site-aware system prompt
    dyn_system = build_dynamic_prompt_with_groq(
        groq=groq,
        application_url=payload.get("applicationUrl", ""),
        target_type=payload.get("targetType", "website"),
    )

    # Step 2: use that system prompt to generate the actual scenario JSON
    user = (
        f"Project: {payload.get('projectId')}\n"
        f"Application URL: {payload.get('applicationUrl')}\n"
        f"Target type: {payload.get('targetType')}\n"
        f"Requirement text:\n{combinedtext}\n"
        f"Return JSON only."
    )

    return [
        {"role": "system", "content": dyn_system},
        {"role": "user", "content": user},
    ]


if __name__ == "__main__":
    cli_menu()