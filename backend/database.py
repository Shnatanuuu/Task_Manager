from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Department, User, UserRole
import os
from datetime import datetime
import bcrypt
from dotenv import load_dotenv
load_dotenv()

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_db():
    """Initialize database with tables and seed data"""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Seed initial data
    db = SessionLocal()
    try:
        # Check if departments exist
        if db.query(Department).count() == 0:
            # Create departments
            departments = [
                Department(name="Engineering", description="Software Development Team"),
                Department(name="Marketing", description="Marketing and Sales Team"),
                Department(name="HR", description="Human Resources Team"),
                Department(name="Finance", description="Finance and Accounting Team"),
            ]
            
            for dept in departments:
                db.add(dept)
            db.commit()
            
            # Get the engineering department for default users
            eng_dept = db.query(Department).filter(Department.name == "Engineering").first()
            hr_dept = db.query(Department).filter(Department.name == "HR").first()
            
            # Create default users if they don't exist
            if db.query(User).count() == 0:
                users = [
                    User(
                        name="John",
                        email="employee@company.com",
                        password=hash_password("password123"),
                        role=UserRole.EMPLOYEE,
                        department_id=eng_dept.id
                    ),
                    User(
                        name="Jane",
                        email="hod@company.com",
                        password=hash_password("password123"),
                        role=UserRole.HOD,
                        department_id=eng_dept.id
                    ),
                    User(
                        name="CEO",
                        email="admin@company.com",
                        password=hash_password("password123"),
                        role=UserRole.SUPER_ADMIN,
                        department_id=hr_dept.id
                    ),
                ]
                
                for user in users:
                    db.add(user)
                db.commit()
                
                print("Database initialized with seed data")
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()