from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DocumentBase(BaseModel):
    document_type: str = Field(..., min_length=2, max_length=50)
    document_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    document_name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_verified: Optional[bool] = None


class DocumentResponse(DocumentBase):
    id: int
    employee_id: int
    file_url: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    is_verified: bool
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True