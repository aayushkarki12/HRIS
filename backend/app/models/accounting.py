from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_accounts_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    account_type = Column(String(20), nullable=False)
    parent_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="accounts")
    parent = relationship("Account", remote_side=[id], backref="children")
    journal_lines = relationship("JournalEntryLine", back_populates="account")

    def __repr__(self):
        return f"<Account {self.code} - {self.name}>"


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "entry_number", name="uq_journal_entries_tenant_entry_number"),
        Index("ix_journal_entries_tenant_date", "tenant_id", "date"),
        Index("ix_journal_entries_tenant_status", "tenant_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True)
    reference_type = Column(String(20), nullable=True)
    status = Column(String(20), default="draft", nullable=False)
    posted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="journal_entries")
    poster = relationship("User", foreign_keys=[posted_by])
    lines = relationship("JournalEntryLine", back_populates="journal_entry", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<JournalEntry {self.entry_number}>"


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    description = Column(String(255), nullable=True)
    debit = Column(Float, default=0, nullable=False)
    credit = Column(Float, default=0, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")
    tenant = relationship("Tenant", back_populates="journal_entry_lines")

    def __repr__(self):
        return f"<JournalEntryLine {self.id} D:{self.debit} C:{self.credit}>"
