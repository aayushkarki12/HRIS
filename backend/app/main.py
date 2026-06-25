from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1 import auth, employees, resources, projects, assignments, user

app = FastAPI(
    title="HRIS System API",
    description="Human Resource Information System",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(user.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(resources.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to HRIS System API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/v1/auth/login")
def login_info():
    return {"message": "Login endpoint is at /api/v1/auth/login", "method": "POST"}