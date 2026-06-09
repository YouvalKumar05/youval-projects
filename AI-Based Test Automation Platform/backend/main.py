import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import traceback
import os

from db.database import engine, Base
from routes import (
    auth, workflows, executions, tasks, ws, stlc, dashboard,
    connection, upload, ai, analyze_router, reports, regression,
    testcases, rbac, communications, admin, settings, accuracy,
    projects, sprints
)

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AutoQA STLC Automation Platform", version="2.0.0")

# ── Global Error Handler ──────────────────────────────────────────────
@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Internal Server Error",
                "details": str(e)
            }
        )

# ── CORS ─────────────────────────────────────────────────────────────────────
# List every local origin variant so browsers never encounter a CORS rejection.
# In production replace these with your actual domain(s).
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",   # vite preview
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Total-Count"],
    max_age=600,   # cache preflight for 10 min
)

# ── OPTIONS pass-through ──────────────────────────────────────────────────────
# Starlette's CORS middleware handles OPTIONS before route handlers, but we add
# an explicit 200 catch-all so any unregistered path also returns correct headers
# (prevents the browser from showing "Failed to fetch" on preflight).
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str, request: Request):
    return JSONResponse(content={}, status_code=200)

# ── Include routers ───────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(workflows.router)
app.include_router(executions.router)
app.include_router(tasks.router)
app.include_router(ws.router)
app.include_router(stlc.router)
app.include_router(dashboard.router)
app.include_router(connection.router)
app.include_router(upload.router)
app.include_router(ai.router)
app.include_router(analyze_router.router)
app.include_router(reports.router)
app.include_router(regression.router)
app.include_router(testcases.router)
app.include_router(rbac.router)
app.include_router(communications.router)
app.include_router(admin.router)
app.include_router(settings.router)
app.include_router(accuracy.router)
app.include_router(projects.router)
app.include_router(sprints.router)

# ── Static Files (Reports & Screenshots) ──────────────────────────────────
os.makedirs("reports", exist_ok=True)
os.makedirs("screenshots", exist_ok=True)
os.makedirs("videos", exist_ok=True)

app.mount("/reports", StaticFiles(directory="reports"), name="reports")
app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")

# ── Health check (no auth required) ──────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AutoQA API"}

@app.get("/")
def read_root():
    return {"message": "AutoQA Enterprise API is running"}

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up AutoQA Engine. Initializing database schema...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized. Ready for connections.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        logger.warning("Server will start without DB — some routes will fail until DB is reachable.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
