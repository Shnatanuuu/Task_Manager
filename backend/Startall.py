#!/usr/bin/env python3
"""
Startup script for TaskFlow full stack on Render
"""
import os
import subprocess
from pathlib import Path
import uvicorn

# ✅ Use package-relative import so it works with `python -m backend.Startall`
from .database import init_db  

def start_frontend():
    """
    Optional: start frontend server if folder exists
    NOTE: This is not the recommended way for Render – see explanation below.
    """
    frontend_path = Path(__file__).resolve().parent.parent / "frontend"

    if frontend_path.exists():
        print(f"Starting frontend at {frontend_path}")
        subprocess.Popen(
            ["python", "-m", "http.server", "8080"],
            cwd=frontend_path
        )
    else:
        print(f"Frontend folder not found at {frontend_path}, skipping frontend start.")

def main():
    # Set environment variables early
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://task_aymz_user:0huPRUaQPcEowyWi2M3Zn0f6s0hVz2Rz@dpg-d2v68l6r433s73et1rr0-a/task_aymz"
    )
    os.environ.setdefault("SECRET_KEY", "your-secret-key-change-in-production")

    # Initialize database (run migrations)
    print("Initializing database...")
    init_db()
    print("✅ Database initialized.")

    # Optionally start frontend (not recommended on Render, see below)
    # start_frontend()

    # Start FastAPI backend
port = int(os.environ.get("PORT", 8000))

uvicorn.run(
    "backend.main:app",
    host="0.0.0.0",
    port=port,  # 👈 use Render's assigned port
    reload=False,
    log_level="info"
)


if __name__ == "__main__":
    main()
