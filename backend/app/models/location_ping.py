from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class LocationPing(Base):
    """A periodic whereabouts report from the mobile app.

    Separate from Attendance on purpose: attendance is one authoritative row
    per employee per day, while pings are a high-volume append-only stream
    that admins read as "where is everyone right now". Keeping them apart
    means the tracking stream can be pruned/retained independently without
    touching payroll-relevant attendance data.

    recorded_at is the device clock at the moment of the GPS fix; received_at
    is when the server got it. They differ when the device was offline and
    the app flushed a queued batch later - that gap is exactly how the admin
    view knows a device went dark.
    """

    __tablename__ = "location_pings"
    __table_args__ = (
        Index("ix_location_pings_employee_recorded", "employee_id", "recorded_at"),
        Index("ix_location_pings_tenant_recorded", "tenant_id", "recorded_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    battery_level = Column(Integer, nullable=True)

    # Resolved server-side against the tenant office / work locations, the
    # same way a clock-in is, so the admin view doesn't re-derive geofences.
    location_status = Column(String(20), default="unknown")
    location_name = Column(String(100), nullable=True)

    # True when this ping sat in the app's offline queue before reaching us.
    was_queued = Column(Boolean, default=False, nullable=False)

    recorded_at = Column(DateTime(timezone=True), nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee")
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<LocationPing {self.employee_id} @ {self.recorded_at}>"
