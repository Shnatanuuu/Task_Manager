# TaskFlow - Office Task Management System

A comprehensive office task management system with role-based access control, featuring Kanban boards, calendar views, task performance logging, and attendance tracking.

## Architecture

### Frontend (Vanilla HTML/CSS/JavaScript)
- **HTML**: Single-page application with multiple views
- **CSS**: Custom styling with CSS variables and responsive design
- **JavaScript**: ES6+ with fetch API for backend communication

### Backend (FastAPI)
- **Framework**: FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL
- **Authentication**: JWT tokens with bcrypt password hashing
- **API**: RESTful endpoints with automatic OpenAPI documentation

## Features

- **Role-based Access Control**: Employee, HOD, and Super Admin roles
- **Task Management**: Kanban board with drag-and-drop functionality
- **Calendar View**: Task scheduling and performance tracking
- **Task Performance Logging**: Individual task logging with time tracking
- **Attendance Tracking**: Check-in/check-out functionality
- **Work From Home Requests**: Request and approval system
- **Real-time Updates**: Live task status updates

## Setup Instructions

### Prerequisites
- Python 3.8+
- PostgreSQL database
- Node.js (optional, for development server)

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   Create a `.env` file in the backend directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/taskflow
   SECRET_KEY=your-super-secret-key-here
   ```

4. **Start the FastAPI server**:
   ```bash
   python start.py
   ```
   
   Or manually:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Serve the frontend** (choose one option):

   **Option A: Using Python's built-in server**:
   ```bash
   python -m http.server 8080
   ```

   **Option B: Using Node.js live-server**:
   ```bash
   npx live-server --port=8080
   ```

   **Option C: Direct file access**:
   Simply open `frontend/index.html` in your browser

### Database Setup

1. **Create PostgreSQL database**:
   ```sql
   CREATE DATABASE taskflow;
   ```

2. **The application will automatically**:
   - Create all necessary tables
   - Seed initial data (departments and demo users)

## Demo Credentials

The system comes with pre-configured demo users:

- **Employee**: employee@company.com / password123
- **HOD**: hod@company.com / password123  
- **Super Admin**: admin@company.com / password123

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
taskflow/
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styling
│   └── app.js             # JavaScript application logic
├── backend/
│   ├── main.py            # FastAPI application
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   ├── database.py        # Database configuration
│   ├── requirements.txt   # Python dependencies
│   └── start.py          # Startup script
└── README.md             # This file
```

## Features by Role

### Employee
- View assigned tasks in Kanban board
- Log individual task performance
- Check in/out attendance tracking
- Submit work-from-home requests
- View personal calendar with tasks

### HOD (Head of Department)
- All employee features
- Create and assign tasks to department members
- View department team tasks and performance
- Approve work-from-home requests
- View department calendar with employee selection

### Super Admin
- All HOD features across all departments
- User management capabilities
- System-wide performance reports
- Global task and attendance oversight

## Development

### Adding New Features

1. **Backend**: Add new endpoints in `main.py`, models in `models.py`, and schemas in `schemas.py`
2. **Frontend**: Add new views in the HTML, styles in CSS, and logic in JavaScript
3. **Database**: Modify models and run migrations

### API Endpoints

Key endpoints include:
- `POST /api/auth/login` - User authentication
- `GET /api/tasks` - Retrieve tasks based on user role
- `POST /api/task-logs` - Log task performance
- `GET /api/task-logs/{user_id}` - Get user task logs
- `POST /api/attendance/checkin` - Check in attendance
- `GET /api/departments/{dept_id}/users` - Get department users

## Security

- JWT token-based authentication
- bcrypt password hashing
- Role-based access control
- CORS protection
- Input validation with Pydantic

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License