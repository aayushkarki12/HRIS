from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import os
import uuid

logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# The stored file's extension is derived from this mapping - keyed off the
# content-type we ourselves validated - never from the client-supplied
# filename. Trusting the filename's extension while only checking the
# (separately client-controlled) Content-Type header let an attacker upload
# a "safe" content-type with a .html filename; the file was then saved as
# .html and served as real HTML by the static file server, i.e. stored XSS.
_CONTENT_TYPE_EXTENSIONS = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'application/zip': '.zip',
}


def _storage_key(file_url: str) -> str:
    """Documents uploaded before the SeaweedFS migration have file_url stored
    as 'uploads/documents/...' (a disk path); new uploads store the bare
    object-storage key 'documents/...' directly. Normalize either to a key
    so old rows keep working against the same storage service."""
    return file_url[len("uploads/"):] if file_url.startswith("uploads/") else file_url


from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_tenant, get_current_employee
from ...core.permissions import require_permission
from ...core.storage import storage
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.document import Document
from ...schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=List[DocumentResponse])
def get_all_documents(
    current_user: User = Depends(require_permission("documents.verify")),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Every document in the tenant, for review/verification - admin/
    documents.verify only. Regular employees only ever see their own via
    GET /documents/my; the frontend picks which one to call based on
    hasPermission('documents.verify')."""
    documents = db.query(Document).filter(Document.tenant_id == tenant.id).order_by(Document.created_at.desc()).all()
    responses = []
    for doc in documents:
        resp = DocumentResponse.model_validate(doc)
        resp.employee_name = doc.employee.full_name if doc.employee else None
        responses.append(resp)
    return responses


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
    document_name: Optional[str] = Query(None, description="Display name for the document"),
    description: Optional[str] = Query(None),
    file: UploadFile = File(...),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Upload a document for current employee."""
    # Validate file type
    if file.content_type not in _CONTENT_TYPE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' is not allowed. Accepted: PDF, images, Word, Excel, plain text, ZIP.")

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

    # Generate a unique filename - extension comes from the validated
    # content-type mapping above, never from the client-supplied filename.
    file_extension = _CONTENT_TYPE_EXTENSIONS[file.content_type]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    storage_key = f"documents/{tenant.id}/{current_employee.id}/{unique_filename}"

    content = await file.read()
    storage.put_object(storage_key, content, content_type=file.content_type)

    # Create document record
    db_document = Document(
        employee_id=current_employee.id,
        document_type=document_type,
        document_name=document_name or file.filename or "Untitled Document",
        file_url=storage_key,
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

@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Stream a document's file bytes.

    Documents are deliberately NOT served through a public static mount -
    this endpoint re-checks the same tenant/ownership/role authorization as
    GET /{document_id} on every download, so a leaked or guessed URL alone
    can never expose someone's resume, contract, or ID. Bytes come from
    SeaweedFS object storage when configured, local disk otherwise.
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.tenant_id == tenant.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or document.employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    content = storage.get_object(_storage_key(document.file_url))
    if content is None:
        raise HTTPException(status_code=404, detail="File is missing from storage")

    filename = document.document_name or _storage_key(document.file_url).rsplit("/", 1)[-1]
    return Response(
        content=content,
        media_type=document.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

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
    
    # The DB record is the source of truth, so a failed/missing storage
    # delete shouldn't block deletion of the record - delete_object() is
    # already best-effort and logs its own failures.
    storage.delete_object(_storage_key(document.file_url))

    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.put("/{document_id}/verify")
def verify_document(
    document_id: int,
    current_user: User = Depends(require_permission("documents.verify")),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Verify a document (admin/documents.verify only)."""
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