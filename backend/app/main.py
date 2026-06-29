from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import (
    auth_router,
    users_router,
    employees_router,
    resources_router,
    projects_router,
    assignments_router,
    tenants_router,
    documents_router,
    leaves_router,
    attendance_router,  # Make sure this is imported
    timesheets_router,
)

app = FastAPI(
    title="HRIS System API",
    description="Human Resource Information System - Complete HR Management",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include all routers - make sure attendance_router is included
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(assignments_router, prefix="/api/v1")
app.include_router(tenants_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(leaves_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")  # Make sure this line exists
app.include_router(timesheets_router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "message": "Welcome to HRIS System API",
        "version": "2.0.0",
        "features": [
            "Employee Management",
            "Resource Management",
            "Project Management",
            "Leave Management",
            "Attendance Tracking",
            "Timesheet Management",
            "Document Management",
            "Multi-Tenant Support"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/api/v1/health")
def api_health_check():
    return {"status": "healthy"}