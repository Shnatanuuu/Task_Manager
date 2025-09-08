from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import jwt
from datetime import datetime, timedelta
import bcrypt
import os
from pathlib import Path

from database import get_db, init_db
from models import *
from schemas import *
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend to communicate
origins = [
    "http://localhost:8080",  # Your frontend
    "http://127.0.0.1:8080"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize FastAPI app
app = FastAPI(title="TaskFlow API", description="Office Task Management System", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"

# Serve static files
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")

# Authentication dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Utility functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Startup event
@app.on_event("startup")
async def startup_event():
    init_db()

# Root endpoint - serve the frontend
@app.get("/")
async def root():
    return FileResponse(str(frontend_path / "index.html"))

# Authentication Routes
@app.post("/api/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return LoginResponse(
        token=access_token,
        user=UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role,
            department=user.department.name if user.department else None,
            departmentId=str(user.department_id) if user.department_id else None
        )
    )

@app.post("/api/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    db_user = User(
        name=user_data.name,
        email=user_data.email,
        password=hashed_password,
        role=user_data.role,
        department_id=user_data.department_id
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return UserResponse(
        id=str(db_user.id),
        name=db_user.name,
        email=db_user.email,
        role=db_user.role,
        department=db_user.department.name if db_user.department else None,
        departmentId=str(db_user.department_id) if db_user.department_id else None
    )

# User Routes
@app.get("/api/user/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department=current_user.department.name if current_user.department else None,
        departmentId=str(current_user.department_id) if current_user.department_id else None
    )

# Department Routes
@app.get("/api/departments/{department_id}/users", response_model=List[UserResponse])
async def get_department_users(
    department_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check permission - only HOD and Super Admin can view department users
    if current_user.role not in ["HOD", "Super Admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # HOD can only see their department, Super Admin can see any department
    if current_user.role == "HOD" and str(current_user.department_id) != department_id:
        raise HTTPException(status_code=403, detail="Can only view your department")
    
    users = db.query(User).filter(User.department_id == department_id).all()
    
    return [
        UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role,
            department=user.department.name if user.department else None,
            departmentId=str(user.department_id) if user.department_id else None
        )
        for user in users
    ]

# Task Routes
@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get tasks based on user role
    if current_user.role == "Employee":
        # Employee sees only their assigned tasks
        tasks = db.query(Task).join(TaskAssignee).filter(
            TaskAssignee.assignee_id == current_user.id
        ).all()
    elif current_user.role == "HOD":
        # HOD sees tasks assigned to department members and tasks they created
        department_user_ids = db.query(User.id).filter(
            User.department_id == current_user.department_id
        ).subquery()
        
        tasks = db.query(Task).filter(
            (Task.assigner_id == current_user.id) |
            (Task.assignees.any(TaskAssignee.assignee_id.in_(department_user_ids)))
        ).all()
    else:  # Super Admin
        # Super Admin sees all tasks
        tasks = db.query(Task).all()
    
    return [
        TaskResponse(
            id=str(task.id),
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            dueDate=task.due_date.isoformat() if task.due_date else None,
            assignerId=str(task.assigner_id),
            assignees=[
                TaskAssigneeResponse(
                    assigneeId=str(ta.assignee_id),
                    assigneeName=ta.assignee.name
                )
                for ta in task.assignees
            ],
            createdAt=task.created_at.isoformat(),
            updatedAt=task.updated_at.isoformat()
        )
        for task in tasks
    ]

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only HOD and Super Admin can create tasks
    if current_user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot create tasks")
    
    # Create task
    db_task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        due_date=task_data.dueDate,
        assigner_id=current_user.id,
        status="To Do"
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Add assignees
    for assignee_id in task_data.assigneeIds:
        db_assignment = TaskAssignee(
            task_id=db_task.id,
            assignee_id=assignee_id
        )
        db.add(db_assignment)
    
    db.commit()
    db.refresh(db_task)
    
    return TaskResponse(
        id=str(db_task.id),
        title=db_task.title,
        description=db_task.description,
        status=db_task.status,
        priority=db_task.priority,
        dueDate=db_task.due_date.isoformat() if db_task.due_date else None,
        assignerId=str(db_task.assigner_id),
        assignees=[
            TaskAssigneeResponse(
                assigneeId=str(ta.assignee_id),
                assigneeName=ta.assignee.name
            )
            for ta in db_task.assignees
        ],
        createdAt=db_task.created_at.isoformat(),
        updatedAt=db_task.updated_at.isoformat()
    )

@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permission
    is_assignee = any(ta.assignee_id == current_user.id for ta in task.assignees)
    is_assigner = task.assigner_id == current_user.id
    is_admin = current_user.role == "Super Admin"
    
    if not (is_assignee or is_assigner or is_admin):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Update task
    if task_update.status is not None:
        task.status = task_update.status
    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.priority is not None:
        task.priority = task_update.priority
    if task_update.dueDate is not None:
        task.due_date = task_update.dueDate
    
    task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        dueDate=task.due_date.isoformat() if task.due_date else None,
        assignerId=str(task.assigner_id),
        assignees=[
            TaskAssigneeResponse(
                assigneeId=str(ta.assignee_id),
                assigneeName=ta.assignee.name
            )
            for ta in task.assignees
        ],
        createdAt=task.created_at.isoformat(),
        updatedAt=task.updated_at.isoformat()
    )

# Task Log Routes
@app.get("/api/task-logs/{user_id}", response_model=List[TaskLogResponse])
async def get_task_logs(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check permission
    can_view = (
        str(current_user.id) == user_id or  # Own logs
        current_user.role == "Super Admin" or  # Admin can see all
        (current_user.role == "HOD" and  # HOD can see department logs
         db.query(User).filter(
             User.id == user_id,
             User.department_id == current_user.department_id
         ).first())
    )
    
    if not can_view:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    logs = db.query(TaskLog).filter(TaskLog.user_id == user_id).order_by(TaskLog.created_at.desc()).all()
    
    return [
        TaskLogResponse(
            id=str(log.id),
            description=log.description,
            date=log.date.isoformat(),
            startTime=log.start_time.isoformat() if log.start_time else None,
            endTime=log.end_time.isoformat() if log.end_time else None,
            durationMinutes=log.duration_minutes,
            userId=str(log.user_id),
            createdAt=log.created_at.isoformat()
        )
        for log in logs
    ]

@app.post("/api/task-logs", response_model=TaskLogResponse)
async def create_task_log(
    log_data: TaskLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_log = TaskLog(
        description=log_data.description,
        date=log_data.date,
        start_time=log_data.startTime,
        end_time=log_data.endTime,
        duration_minutes=log_data.durationMinutes,
        user_id=current_user.id
    )
    
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    
    return TaskLogResponse(
        id=str(db_log.id),
        description=db_log.description,
        date=db_log.date.isoformat(),
        startTime=db_log.start_time.isoformat() if db_log.start_time else None,
        endTime=db_log.end_time.isoformat() if db_log.end_time else None,
        durationMinutes=db_log.duration_minutes,
        userId=str(db_log.user_id),
        createdAt=db_log.created_at.isoformat()
    )

# Attendance Routes
@app.get("/api/attendance/status", response_model=AttendanceStatusResponse)
async def get_attendance_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    
    if attendance and attendance.check_in and not attendance.check_out:
        return AttendanceStatusResponse(
            isCheckedIn=True,
            checkIn=attendance.check_in.isoformat(),
            checkOut=None
        )
    elif attendance and attendance.check_out:
        return AttendanceStatusResponse(
            isCheckedIn=False,
            checkIn=attendance.check_in.isoformat(),
            checkOut=attendance.check_out.isoformat()
        )
    else:
        return AttendanceStatusResponse(
            isCheckedIn=False,
            checkIn=None,
            checkOut=None
        )

@app.post("/api/attendance/checkin", response_model=AttendanceResponse)
async def check_in(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    now = datetime.utcnow()
    
    # Check if already checked in today
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    
    if existing and existing.check_in and not existing.check_out:
        raise HTTPException(status_code=400, detail="Already checked in today")
    
    if existing:
        # Update existing record
        existing.check_in = now
        existing.check_out = None
        db.commit()
        attendance = existing
    else:
        # Create new record
        attendance = Attendance(
            user_id=current_user.id,
            date=today,
            check_in=now
        )
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
    
    return AttendanceResponse(
        id=str(attendance.id),
        checkIn=attendance.check_in.isoformat(),
        checkOut=None,
        date=attendance.date.isoformat()
    )

@app.post("/api/attendance/checkout", response_model=AttendanceResponse)
async def check_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    now = datetime.utcnow()
    
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    
    if not attendance or not attendance.check_in:
        raise HTTPException(status_code=400, detail="Not checked in today")
    
    if attendance.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")
    
    attendance.check_out = now
    db.commit()
    
    return AttendanceResponse(
        id=str(attendance.id),
        checkIn=attendance.check_in.isoformat(),
        checkOut=attendance.check_out.isoformat(),
        date=attendance.date.isoformat()
    )

# WFH Routes
@app.get("/api/wfh", response_model=List[WFHRequestResponse])
async def get_wfh_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "Employee":
        requests = db.query(WFHRequest).filter(WFHRequest.user_id == current_user.id).all()
    elif current_user.role == "HOD":
        # HOD sees requests from their department
        department_user_ids = db.query(User.id).filter(
            User.department_id == current_user.department_id
        ).subquery()
        requests = db.query(WFHRequest).filter(
            WFHRequest.user_id.in_(department_user_ids)
        ).all()
    else:  # Super Admin
        requests = db.query(WFHRequest).all()
    
    return [
        WFHRequestResponse(
            id=str(req.id),
            reason=req.reason,
            startDate=req.start_date.isoformat(),
            endDate=req.end_date.isoformat(),
            status=req.status,
            userId=str(req.user_id),
            userName=req.user.name,
            createdAt=req.created_at.isoformat()
        )
        for req in requests
    ]

# Approval Routes (placeholder)
@app.get("/api/approvals")
async def get_approvals(current_user: User = Depends(get_current_user)):
    # Placeholder for approval system
    return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)