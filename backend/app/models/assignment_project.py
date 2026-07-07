from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint

from ..core.database import Base


class AssignmentProject(Base):
    __tablename__ = "assignment_projects"
    __table_args__ = (
        UniqueConstraint("assignment_id", "project_id", name="uq_assignment_project"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
