// src/services/analysisService.js
import { API_BASE, get, post } from "./api";

export async function healthCheck() {
  return get("/api/health");
}

export async function analyzeText({ projectId, applicationUrl, targetType = "website", requirementText }) {
  return post("/api/analyze", { projectId, applicationUrl, targetType, requirementText });
}

export async function analyzeUpload({ projectId, applicationUrl, targetType = "website", file }) {
  const form = new FormData();
  form.append("projectId", projectId);
  form.append("applicationUrl", applicationUrl);
  form.append("targetType", targetType);
  form.append("file", file);
  return post("/api/analyze/upload", form, true);
}

export async function getLatestAnalysis() {
  return get("/api/analysis/latest");
}

export async function getApprovedScenario() {
  return get("/api/scenario/approved");
}

export async function approveScenario(scenario) {
  return post("/api/approve", { scenario });
}

export { API_BASE };
