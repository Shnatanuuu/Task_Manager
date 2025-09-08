from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date
from .models import UserRole, TaskStatus, TaskPriority, WFHStatus

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole

class UserCreate(UserBase):
    password: str
    department_id: Optional[str] = None

class UserResponse(UserBase):
    id: str
    department: Optional[str] = None
    departmentId: Optional[str] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True

# Authentication Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

# Task Schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    dueDate: Optional[datetime] = None

class TaskCreate(TaskBase):
    assigneeIds: List[str]

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    dueDate: Optional[datetime] = None

class TaskAssigneeResponse(BaseModel):
    assigneeId: str
    assigneeName: str

class TaskResponse(TaskBase):
    id: str
    status: TaskStatus
    assignerId: str
    assignees: List[TaskAssigneeResponse]
    createdAt: str
    updatedAt: str
    
    class Config:
        from_attributes = True

# Task Log Schemas
class TaskLogBase(BaseModel):
    description: str
    date: date

class TaskLogCreate(TaskLogBase):
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    durationMinutes: Optional[int] = None

class TaskLogResponse(TaskLogBase):
    id: str
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    durationMinutes: Optional[int] = None
    userId: str
    createdAt: str
    
    class Config:
        from_attributes = True

# Attendance Schemas
class AttendanceResponse(BaseModel):
    id: str
    checkIn: str
    checkOut: Optional[str] = None
    date: str
    
    class Config:
        from_attributes = True

class AttendanceStatusResponse(BaseModel):
    isCheckedIn: bool
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None

# WFH Request Schemas
class WFHRequestBase(BaseModel):
    reason: str
    startDate: date
    endDate: date

class WFHRequestCreate(WFHRequestBase):
    pass

class WFHRequestResponse(WFHRequestBase):
    id: str
    status: WFHStatus
    userId: str
    userName: str
    createdAt: str
    
    class Config:
        from_attributes = True

# Department Schemas
class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True