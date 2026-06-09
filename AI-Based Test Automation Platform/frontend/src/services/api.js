/**
 * api.js — Centralized API client for AutoQA
 *
 * Key fixes vs. the original:
 *  1. Distinguishes network failure ("Failed to fetch" / TypeError) from HTTP errors
 *  2. postForm now checks response.ok and propagates errors correctly
 *  3. Adds a checkBackend() helper so the UI can detect "backend is down" early
 *  4. Provides clear error messages for every failure class
 */

// Empty string → Vite proxy is active → use relative paths (same-origin, no CORS)
// Full URL   → direct requests (production)
const _raw = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";
const API_BASE = _raw ? _raw.replace(/\/$/, "") : "";

// ── Error classes ────────────────────────────────────────────────────────────

export class NetworkError extends Error {
  constructor(endpoint) {
    super(`Cannot reach the backend server. Is it running at ${API_BASE}?`);
    this.name = "NetworkError";
    this.endpoint = endpoint;
  }
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ── Main client ──────────────────────────────────────────────────────────────

export const api = {
  /** Base URL exposed for use in WebSocket construction etc. */
  baseUrl: API_BASE,

  async request(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE}${endpoint}`;

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      // TypeError: Failed to fetch / net::ERR_CONNECTION_REFUSED
      // This means the backend is not reachable at all.
      console.error(`[API] Network failure on ${endpoint}:`, err.message);
      throw new NetworkError(endpoint);
    }

    // ── Auth expiry ──────────────────────────────────────────────────────────
    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      throw new ApiError("Session expired. Please log in again.", 401);
    }

    // ── No-content responses ─────────────────────────────────────────────────
    if (response.status === 204) {
      return { status: "success" };
    }

    // ── Parse JSON ───────────────────────────────────────────────────────────
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        `Server returned non-JSON response (${response.status} ${response.statusText})`,
        response.status
      );
    }

    if (!response.ok) {
      const msg =
        data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`;
      console.error(`[API] HTTP ${response.status} on ${endpoint}:`, msg);
      throw new ApiError(msg, response.status, data?.detail);
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  /** Multipart form upload — now with proper error handling */
  async postForm(endpoint, formData) {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const url = `${API_BASE}${endpoint}`;

    let response;
    try {
      response = await fetch(url, { method: "POST", body: formData, headers });
    } catch (err) {
      throw new NetworkError(endpoint);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        `Upload failed with status ${response.status}`,
        response.status
      );
    }

    if (!response.ok) {
      throw new ApiError(
        data?.detail || data?.message || "Upload failed",
        response.status
      );
    }

    return data;
  },

  /**
   * Ping the /health endpoint.
   * Returns true if backend is reachable, false otherwise.
   * Never throws — safe to call at app startup.
   */
  async checkBackend() {
    // In proxy mode API_BASE is empty — use relative path; Vite will forward it.
    // In direct mode use the full URL with a 4 s timeout.
    const url = API_BASE ? `${API_BASE}/health` : "/health";
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
