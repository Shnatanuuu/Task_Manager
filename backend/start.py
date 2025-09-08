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
        os.environ["DATABASE_URL"] = "mysql+pymysql://root:Shantanu%40241@localhost:3306/taskflow"
    
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