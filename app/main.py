import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .core.config import settings
from .core.logging_config import setup_logging

setup_logging()

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
    attendance_router,
    timesheets_router,
    accounting_router,
    payroll_router,
    expense_router,
    invoice_router,
    work_locations_router,
    audit_logs_router,
    notifications_router,
    resource_requests_router,
    voucher_router,
    inventory_router,
    budget_router,
)

app = FastAPI(
    title="HRIS System API",
    description="Human Resource Information System - Complete HR Management",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting is handled at the edge (nginx `limit_req`), not in the app -
# see /etc/nginx/sites-available/hris-api.cantordust.org.conf.

# Configure CORS - explicit origin allow-list only, no wildcard.
# Set CORS_ORIGINS in .env to override (comma-separated) for staging/production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
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
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(payroll_router, prefix="/api/v1")
app.include_router(expense_router, prefix="/api/v1")
app.include_router(invoice_router, prefix="/api/v1")
app.include_router(work_locations_router, prefix="/api/v1")
app.include_router(audit_logs_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(resource_requests_router, prefix="/api/v1")
app.include_router(voucher_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(budget_router, prefix="/api/v1")

# Avatars are low-sensitivity and rendered via plain <img> tags all over the
# UI, so they stay on a public static mount. Employee documents (resumes,
# contracts, IDs) are NOT mounted here on purpose - unlike avatars they can
# be genuinely sensitive, and serving them from a public, unauthenticated
# path would bypass every tenant/ownership check the /documents API
# enforces. Those are served through the authenticated
# GET /api/v1/documents/{id}/download endpoint instead (see document.py).
_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
_avatars_dir = os.path.join(_uploads_dir, "avatars")
os.makedirs(_avatars_dir, exist_ok=True)
app.mount("/uploads/avatars", StaticFiles(directory=_avatars_dir), name="avatars")

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
            "Accounting",
            "Multi-Tenant Support"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/api/v1/health")
def api_health_check():
    return {"status": "healthy"}