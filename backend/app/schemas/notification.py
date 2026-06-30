from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
