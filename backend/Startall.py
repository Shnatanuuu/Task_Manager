#!/usr/bin/env python3
"""
Startup script for TaskFlow full stack on Render
"""
import os
import subprocess
from pathlib import Path
import uvicorn

# Import your database initializer
from backend.database import init_db  # adjust import if your database.py is elsewhere

def start_frontend():
    """
    Optional: start frontend server if folder exists
    """
    # Adjust path: assumes frontend is sibling of backend folder
    frontend_path = Path(__file__).parent.parent / "frontend"

    if frontend_path.exists():
        print(f"Starting frontend at {frontend_path}")
        subprocess.Popen(
            ["python", "-m", "http.server", "8080"],
            cwd=frontend_path
        )
    else:
        print(f"Frontend folder not found at {frontend_path}, skipping frontend start.")

def main():
    # Initialize DB
    print("Initializing database...")
    init_db()
    print("Database initialized.")

    # Set environment variables
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://task_aymz_user:0huPRUaQPcEowyWi2M3Zn0f6s0hVz2Rz@dpg-d2v68l6r433s73et1rr0-a/task_aymz"
    )
    os.environ.setdefault("SECRET_KEY", "your-secret-key-change-in-production")

    # Optionally start frontend
    start_frontend()

    # Start FastAPI backend
    print("Starting FastAPI backend...")
    uvicorn.run(
        "backend.main:app",  # adjust if your main.py is elsewhere
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
