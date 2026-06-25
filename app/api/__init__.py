from .v1.auth import router as auth_router
from .v1.user import router as user_router
from .v1.employees import router as employees_router
from .v1.resources import router as resources_router
from .v1.projects import router as projects_router
from .v1.assignments import router as assignments_router

__all__ = [
    "auth_router",
    "user_router",
    "employees_router",
    "resources_router",
    "projects_router",
    "assignments_router",
]