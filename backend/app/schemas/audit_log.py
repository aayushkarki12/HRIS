from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogUser(BaseModel):
    id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    severity: str = "info"
    module: str = "Other"
    created_at: datetime
    user: Optional[AuditLogUser] = None

    class Config:
        from_attributes = True
