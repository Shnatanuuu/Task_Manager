#!/usr/bin/env python3
"""
Startup script for TaskFlow FastAPI backend
"""
import uvicorn
import os
from pathlib import Path

def main():
    # Set environment variables if not already set
   if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://task_aymz_user:0huPRUaQPcEowyWi2M3Zn0f6s0hVz2Rz@dpg-d2v68l6r433s73et1rr0-a/task_aymz"

    
    if not os.getenv("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "your-secret-key-change-in-production"
    
    # Start the FastAPI server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()