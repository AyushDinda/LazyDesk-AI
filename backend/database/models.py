import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.database.session import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id = Column(Integer, primary_key=True, index=True)
    folder_path = Column(String(1024), nullable=False)
    total_files = Column(Integer, default=0)
    scanned_files = Column(Integer, default=0)
    status = Column(String(50), default="scanning")  # scanning, analyzed, completed, failed
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    files = relationship("FileItem", back_populates="session", cascade="all, delete-orphan")
    batches = relationship("OperationBatch", back_populates="session")


class FileItem(Base):
    __tablename__ = "file_items"

    id = Column(Integer, primary_key=True, index=True)
    scan_session_id = Column(Integer, ForeignKey("scan_sessions.id"), nullable=False)
    
    original_path = Column(String(1024), nullable=False)
    original_filename = Column(String(512), nullable=False)
    file_extension = Column(String(32), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(128), default="application/octet-stream")
    extracted_text_preview = Column(Text, nullable=True)
    
    proposed_filename = Column(String(512), nullable=True)
    proposed_category = Column(String(64), nullable=True)
    proposed_destination_path = Column(String(1024), nullable=True)
    reason = Column(Text, nullable=True)
    
    analysis_status = Column(String(32), default="pending")  # pending, analyzed, excluded, approved, rejected, failed
    is_approved = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    session = relationship("ScanSession", back_populates="files")
    operations = relationship("FileOperation", back_populates="file_item")


class OperationBatch(Base):
    __tablename__ = "operation_batches"

    id = Column(Integer, primary_key=True, index=True)
    scan_session_id = Column(Integer, ForeignKey("scan_sessions.id"), nullable=True)
    
    total_operations = Column(Integer, default=0)
    successful_operations = Column(Integer, default=0)
    failed_operations = Column(Integer, default=0)
    undone_operations = Column(Integer, default=0)
    status = Column(String(32), default="completed")  # completed, partially_failed, undone, partially_undone
    
    created_at = Column(DateTime, default=utcnow)

    session = relationship("ScanSession", back_populates="batches")
    operations = relationship("FileOperation", back_populates="batch", cascade="all, delete-orphan")


class FileOperation(Base):
    __tablename__ = "file_operations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("operation_batches.id"), nullable=False)
    file_item_id = Column(Integer, ForeignKey("file_items.id"), nullable=True)
    
    source_path = Column(String(1024), nullable=False)
    destination_path = Column(String(1024), nullable=False)
    operation_type = Column(String(32), default="move_rename")
    
    status = Column(String(32), default="pending")  # pending, success, failed, undone, undo_failed
    file_hash_before = Column(String(128), nullable=True)
    file_hash_after = Column(String(128), nullable=True)
    error_message = Column(Text, nullable=True)
    
    executed_at = Column(DateTime, default=utcnow)
    undone_at = Column(DateTime, nullable=True)

    batch = relationship("OperationBatch", back_populates="operations")
    file_item = relationship("FileItem", back_populates="operations")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(128), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
