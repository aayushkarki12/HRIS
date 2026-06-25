from .auth import router as auth_router
from .employees import router as employees_router
from .resources import router as resources_router
from .projects import router as projects_router
from .assignments import router as assignments_router

__all__ = [
    "auth_router",
    "employees_router",
    "resources_router",
    "projects_router",
    "assignments_router",
]