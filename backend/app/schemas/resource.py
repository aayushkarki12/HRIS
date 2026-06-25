from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime, date
import re

class ResourceBase(BaseModel):
    asset_tag: Optional[str] = Field(None, min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    type: str = Field(..., pattern="^(laptop|monitor|keyboard|mouse|other)$")
    model: Optional[str] = Field(None, min_length=2, max_length=100)
    serial_number: str = Field(..., min_length=2, max_length=50)
    status: str = Field("available", pattern="^(available|assigned|maintenance|repair)$")
    purchase_date: Optional[date] = None
    warranty_until: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    asset_tag: Optional[str] = Field(None, min_length=2, max_length=50)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    type: Optional[str] = Field(None, pattern="^(laptop|monitor|keyboard|mouse|other)$")
    model: Optional[str] = Field(None, min_length=2, max_length=100)
    serial_number: Optional[str] = Field(None, min_length=2, max_length=50)
    status: Optional[str] = Field(None, pattern="^(available|assigned|maintenance|repair)$")
    assigned_to: Optional[int] = None
    purchase_date: Optional[date] = None
    warranty_until: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)


class ResourceResponse(ResourceBase):
    id: int
    assigned_to: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True