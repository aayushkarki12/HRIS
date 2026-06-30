from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import os
import uuid

logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant, get_current_employee
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.document import Document
from ...schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/my", response_model=List[DocumentResponse])
def get_my_documents(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all documents for current employee."""
    return db.query(Document).filter(
        Document.employee_id == current_employee.id,
        Document.tenant_id == tenant.id
    ).all()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    document_type: str = Query(..., description="Document type (passport, id, resume, contract, etc.)"),
    description: Optional[str] = None,
    file: UploadFile = File(...),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Upload a document for current employee."""
    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Validate file size without reading the whole thing into memory first.
    # UploadFile wraps a SpooledTemporaryFile, so we can seek to check size.
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB."
        )

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = f"uploads/documents/{current_employee.id}/{unique_filename}"

    # Create directory if not exists
    os.makedirs(f"uploads/documents/{current_employee.id}", exist_ok=True)

    # Save file
    content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Create document record
    db_document = Document(
        employee_id=current_employee.id,
        document_type=document_type,
        document_name=file.filename,
        file_url=file_path,
        file_size=len(content),
        file_type=file.content_type,
        description=description,
        is_verified=False,
        tenant_id=tenant.id
    )
    
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    return db_document

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get document by ID."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.tenant_id == tenant.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check authorization
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or document.employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return document

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.tenant_id == tenant.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check authorization
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or document.employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk. The DB record is the source of truth, so a missing
    # or already-deleted file shouldn't block deletion of the record - but we
    # do want to know about it rather than silently swallowing every error.
    try:
        os.remove(document.file_url)
    except FileNotFoundError:
        logger.warning(f"Document file already missing on disk: {document.file_url}")
    except OSError as e:
        logger.error(f"Failed to delete document file {document.file_url}: {e}", exc_info=True)
    
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.put("/{document_id}/verify")
def verify_document(
    document_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Verify a document (admin only)."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.tenant_id == tenant.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    from datetime import datetime
    document.is_verified = True
    document.verified_by = current_user.id
    document.verified_at = datetime.now()
    
    db.commit()
    db.refresh(document)
    
    return {"message": "Document verified successfully"}