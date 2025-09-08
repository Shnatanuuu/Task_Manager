#!/usr/bin/env python3
"""
Combined startup script for TaskFlow backend + frontend
"""

import os
import subprocess
import uvicorn
from database import init_db
from pathlib import Path

def start_frontend():
    frontend_path = Path(__file__).parent / "frontend"
    # Run frontend server on port 8080
    subprocess.Popen(
        ["python", "-m", "http.server", "8080"],
        cwd=frontend_path
    )
    print("Frontend server started on http://localhost:8080")

def start_backend():
    # Set environment variables if not already set
    if not os.getenv("DATABASE_URL"):
        os.environ["DATABASE_URL"] = "postgresql://task_aymz_user:0huPRUaQPcEowyWi2M3Zn0f6s0hVz2Rz@dpg-d2v68l6r433s73et1rr0-a/task_aymz"
    
    if not os.getenv("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "your-secret-key-change-in-production"
    
    # Initialize database
    init_db()
    print("Database initialized successfully")
    
    # Start FastAPI backend
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    start_frontend()   # optional, only if you want Render to serve frontend too
    start_backend()
