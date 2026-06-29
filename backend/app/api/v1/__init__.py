from .auth import router as auth_router
from .user import router as users_router
from .employees import router as employees_router
from .resources import router as resources_router
from .projects import router as projects_router
from .assignments import router as assignments_router
from .tenant import router as tenants_router
from .document import router as documents_router
from .leave import router as leaves_router
from .attendance import router as attendance_router
from .timesheet import router as timesheets_router

__all__ = [
    "auth_router",
    "users_router",
    "employees_router",
    "resources_router",
    "projects_router",
    "assignments_router",
    "tenants_router",
    "documents_router",
    "leaves_router",
    "attendance_router",
    "timesheets_router",
]