import os
import json
import csv
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak


class ReportingService:
    def __init__(self):
        self.reports_dir = Path("reports")
        self.reports_dir.mkdir(exist_ok=True)

    # -------------------------------
    # MAIN REPORT GENERATOR
    # -------------------------------
    async def generate_all_reports(self, execution_data: dict, test_case_data: dict):
        try:
            exec_id = execution_data.get("id", f"unknown_{int(datetime.now().timestamp())}")

            json_path = self.generate_json(execution_data, test_case_data)
            pdf_path = self.generate_pdf(execution_data, test_case_data)
            csv_path = self.generate_csv(execution_data, test_case_data)

            return {
                "status": "success",
                "execution_id": exec_id,
                "files": {
                    "json": str(json_path),
                    "pdf": str(pdf_path),
                    "csv": str(csv_path)
                }
            }

        except Exception as e:
            print("REPORT GENERATION ERROR:", str(e))
            return {
                "status": "error",
                "message": "Failed to generate reports",
                "details": str(e)
            }

    # -------------------------------
    # JSON REPORT
    # -------------------------------
    def generate_json(self, execution, test_case):
        path = self.reports_dir / f"report_{execution.get('id','unknown')}.json"

        report = {
            "execution_id": execution.get("id"),
            "test_case": test_case.get("title", "N/A"),
            "status": execution.get("status", "UNKNOWN"),
            "started_at": execution.get("started_at"),
            "completed_at": execution.get("completed_at"),
            "steps": execution.get("step_results", []),
            "logs": execution.get("logs", [])
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=4)

        return path

    # -------------------------------
    # CSV REPORT
    # -------------------------------
    def generate_csv(self, execution, test_case):
        path = self.reports_dir / f"report_{execution.get('id','unknown')}.csv"
        steps = execution.get("step_results", [])

        with open(path, "w", newline='', encoding="utf-8") as f:
            writer = csv.writer(f)

            writer.writerow(["Step Index", "Step Name", "Status", "Duration (ms)", "Error"])

            for s in steps:
                writer.writerow([
                    s.get("index", 0) + 1,
                    s.get("name", ""),
                    s.get("status", ""),
                    s.get("duration", 0),
                    s.get("error", "")
                ])

        return path

    # -------------------------------
    # PDF REPORT
    # -------------------------------
    def generate_pdf(self, execution, test_case):
        path = self.reports_dir / f"report_{execution.get('id','unknown')}.pdf"

        doc = SimpleDocTemplate(str(path), pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # -------------------------------
        # HEADER
        # -------------------------------
        elements.append(Paragraph(f"Execution Report: RUN-{execution.get('id')}", styles['Title']))
        elements.append(Spacer(1, 12))

        elements.append(Paragraph(f"<b>Test Case:</b> {test_case.get('title', 'N/A')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Status:</b> {execution.get('status', 'UNKNOWN')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Started:</b> {execution.get('started_at', '')}", styles['Normal']))
        elements.append(Paragraph(f"<b>Completed:</b> {execution.get('completed_at', '')}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # -------------------------------
        # SUMMARY METRICS (IMPORTANT)
        # -------------------------------
        steps = execution.get("step_results", [])
        total = len(steps)
        passed = len([s for s in steps if s.get("status") == "PASS"])
        failed = len([s for s in steps if s.get("status") == "FAIL"])

        elements.append(Paragraph(f"<b>Total Steps:</b> {total}", styles['Normal']))
        elements.append(Paragraph(f"<b>Passed:</b> {passed}", styles['Normal']))
        elements.append(Paragraph(f"<b>Failed:</b> {failed}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # -------------------------------
        # TABLE (WITH PAGINATION)
        # -------------------------------
        table_data = [["#", "Step Name", "Status", "Duration"]]

        for s in steps:
            table_data.append([
                s.get("index", 0) + 1,
                s.get("name", "")[:50],
                s.get("status", ""),
                f"{s.get('duration', 0)} ms"
            ])

        # Split table for large data
        chunk_size = 25
        for i in range(0, len(table_data), chunk_size):
            chunk = table_data[i:i + chunk_size]

            t = Table(chunk, colWidths=[30, 280, 70, 80])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))

            elements.append(t)
            elements.append(Spacer(1, 10))

            if i + chunk_size < len(table_data):
                elements.append(PageBreak())

        # -------------------------------
        # SCREENSHOT / EVIDENCE
        # -------------------------------
        screenshot_path = execution.get("screenshot")
        if screenshot_path and os.path.exists(screenshot_path):
            elements.append(PageBreak())
            elements.append(Paragraph("<b>Final Screenshot / Evidence</b>", styles['Heading2']))
            elements.append(Spacer(1, 10))
            
            # Use ReportLab's Image
            from reportlab.platypus import Image
            try:
                # We want to fit it on the page nicely. A typical page is ~600x800.
                # The browser viewport was 1280x720, so we scale it down.
                img = Image(screenshot_path, width=500, height=280)
                elements.append(img)
            except Exception as e:
                elements.append(Paragraph(f"<i>Could not render image: {str(e)}</i>", styles['Normal']))

        doc.build(elements)
        return path