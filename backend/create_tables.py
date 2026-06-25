from app.core.database import Base, engine

# Import all models
from app.models.user import User
from app.models.employee import Employee
from app.models.resource import Resource
from app.models.project import Project
from app.models.assignment import Assignment

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")