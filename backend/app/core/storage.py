"""Object storage for employee documents.

Primary target is SeaweedFS' S3 gateway (shared with the dossier project -
same env var names, different bucket) via boto3. Every write also lands on
local disk as a durable fallback, and reads prefer object storage over the
local copy, falling back to it when object storage is unset or unreachable -
same pattern as dossier_backend/app/core/storage.py.
"""

import logging
from pathlib import Path
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from .config import settings

logger = logging.getLogger(__name__)

# HRIS_backend/ - two levels up from app/core/storage.py
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
LOCAL_UPLOADS_DIR = _BACKEND_ROOT / "uploads"


class StorageService:
    """Storage abstraction for uploaded employee documents."""

    def __init__(self) -> None:
        self.bucket_name = settings.SEAWEED_BUCKET_NAME
        self.s3 = self._create_s3_client()
        if self.object_storage_enabled:
            logger.info("Document storage: object storage bucket '%s'", self.bucket_name)
        else:
            logger.info("Document storage: SEAWEED_S3_ENDPOINT not configured - local disk only at %s", LOCAL_UPLOADS_DIR)

    def _create_s3_client(self):
        """Build an S3-compatible client. Path-style addressing + s3v4 signing
        keep SeaweedFS (and MinIO) happy."""
        endpoint_url = settings.SEAWEED_S3_ENDPOINT
        access_key_id = settings.SEAWEED_ACCESS_KEY
        secret_access_key = settings.SEAWEED_SECRET_KEY

        if not (endpoint_url and self.bucket_name and access_key_id and secret_access_key):
            return None
        try:
            return boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                region_name=settings.SEAWEED_REGION,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )
        except Exception as exc:
            logger.warning("Failed to initialize object storage client: %s", exc)
            return None

    @property
    def object_storage_enabled(self) -> bool:
        return bool(self.s3 and self.bucket_name)

    def put_object(self, key: str, content: bytes, content_type: Optional[str] = None) -> bool:
        """Store an object both remotely (if configured) and locally.

        Returns True if the object storage write succeeded, False if it was
        skipped/failed (the local copy is written either way, so the upload
        itself never fails just because object storage is down).
        """
        local_path = LOCAL_UPLOADS_DIR / key
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)

        if not self.object_storage_enabled:
            return False
        try:
            extra = {"ContentType": content_type} if content_type else {}
            self.s3.put_object(Bucket=self.bucket_name, Key=key, Body=content, **extra)
            return True
        except Exception as exc:
            logger.warning("Object storage write failed for %s (kept local copy): %s", key, exc)
            return False

    def get_object(self, key: str) -> Optional[bytes]:
        """Fetch an object's bytes, preferring object storage over the local copy."""
        if self.object_storage_enabled:
            try:
                resp = self.s3.get_object(Bucket=self.bucket_name, Key=key)
                body = resp.get("Body")
                if body is not None:
                    return body.read()
            except ClientError:
                pass  # not in object storage (or unreachable) - fall back to local

        local_path = LOCAL_UPLOADS_DIR / key
        return local_path.read_bytes() if local_path.is_file() else None

    def delete_object(self, key: str) -> None:
        """Best-effort delete from both object storage and local disk."""
        if self.object_storage_enabled:
            try:
                self.s3.delete_object(Bucket=self.bucket_name, Key=key)
            except Exception as exc:
                logger.warning("Object storage delete failed for %s: %s", key, exc)

        local_path = LOCAL_UPLOADS_DIR / key
        try:
            local_path.unlink()
        except FileNotFoundError:
            pass
        except OSError as exc:
            logger.warning("Local delete failed for %s: %s", local_path, exc)


storage = StorageService()
