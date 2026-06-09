// src/services/executionReportService.js
import { API_BASE, get, post } from "./api";

export async function runApprovedScenario({ headless = true, keepBrowserOpen = false } = {}) {
  return post("/api/run", { headless, keepBrowserOpen });
}

export async function listRuns() {
  return get("/api/runs");
}

export async function listReports() {
  return get("/api/reports");
}

// Helper to build artifact URLs from run/report ids
export function buildJsonReportUrl(runId) {
  return `${API_BASE}/files/reports/${runId}.json`;
}

export function buildPdfReportUrl(runId) {
  return `${API_BASE}/files/reports/${runId}.pdf`;
}

export function buildScreenshotUrl(runId) {
  return `${API_BASE}/files/screenshots/${runId}.png`;
}

export { API_BASE };
