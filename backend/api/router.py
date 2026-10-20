import os
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.config import settings
from backend.database.session import get_db
from backend.database.models import ScanSession, FileItem, OperationBatch, FileOperation, AppSetting
from backend.services.security_service import security_service, ALLOWED_CATEGORIES
from backend.services.ai_service import ai_service
from backend.services.filesystem_service import filesystem_service
from backend.schemas.api_schemas import (
    HealthResponse,
    AIStatusResponse,
    FolderValidationRequest,
    FolderValidationResponse,
    FolderBrowseRequest,
    FolderBrowseResponse,
    FolderDirectoryItem,
    ScanFolderRequest,
    ScanFolderResponse,
    AnalyzeSessionRequest,
    AnalyzeSessionResponse,
    UpdateFileItemRequest,
    FileItemSchema,
    PreviewRequest,
    PreviewResponse,
    ExecuteRequest,
    ExecuteResponse,
    OperationBatchSchema,
    UndoResponse,
    BatchUndoResponse,
    DashboardStatsResponse,
    SettingsResponse,
    SettingsUpdateRequest
)

api_router = APIRouter(prefix="/api")

@api_router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="healthy",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc)
    )

@api_router.get("/ai/status", response_model=AIStatusResponse)
async def get_ai_status():
    status_data = await ai_service.check_status()
    return AIStatusResponse(
        running=status_data.get("running", False),
        active_model=status_data.get("active_model", settings.OLLAMA_MODEL),
        model_available=status_data.get("model_available", False),
        mock_mode=status_data.get("mock_mode", False),
        available_models=status_data.get("available_models", []),
        message=status_data.get("message", "")
    )

@api_router.post("/folders/validate", response_model=FolderValidationResponse)
def validate_folder(req: FolderValidationRequest):
    is_valid, canonical, err = security_service.validate_folder(req.folder_path)
    return FolderValidationResponse(
        is_valid=is_valid,
        canonical_path=canonical if is_valid else None,
        error_message=err,
        allowed_roots=security_service.get_allowed_roots()
    )

@api_router.post("/folders/browse", response_model=FolderBrowseResponse)
def browse_folder(req: FolderBrowseRequest):
    """
    Assists user in picking a folder within configured allowed roots.
    Only exposes subdirectories inside permitted roots.
    """
    allowed_roots = security_service.get_allowed_roots()
    target_path = req.folder_path.strip() if req.folder_path else allowed_roots[0]

    within, _ = security_service.is_path_within_allowed_roots(target_path)
    if not within or not os.path.exists(target_path):
        target_path = allowed_roots[0]

    canonical_target = os.path.realpath(target_path)
    parent = str(Path(canonical_target).parent)
    parent_within, _ = security_service.is_path_within_allowed_roots(parent)

    dirs = []
    try:
        with os.scandir(canonical_target) as it:
            for entry in it:
                if entry.is_dir() and not entry.name.startswith(".") and not entry.is_symlink():
                    full_p = os.path.realpath(entry.path)
                    dirs.append(FolderDirectoryItem(
                        name=entry.name,
                        path=full_p,
                        is_allowed_root=full_p in allowed_roots
                    ))
    except Exception:
        pass

    dirs.sort(key=lambda d: d.name.lower())

    return FolderBrowseResponse(
        current_path=canonical_target,
        parent_path=parent if parent_within else None,
        directories=dirs,
        allowed_roots=allowed_roots
    )

@api_router.post("/scan", response_model=ScanFolderResponse)
def scan_folder(req: ScanFolderRequest, db: Session = Depends(get_db)):
    try:
        session, items, errors = filesystem_service.scan_directory(req.folder_path, db)
        return ScanFolderResponse(
            session_id=session.id,
            folder_path=session.folder_path,
            total_files=len(items),
            files=[FileItemSchema.model_validate(item) for item in items],
            errors=errors
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scanning failed: {str(e)}"
        )

@api_router.post("/analyze", response_model=AnalyzeSessionResponse)
async def analyze_session(req: AnalyzeSessionRequest, db: Session = Depends(get_db)):
    try:
        items = await filesystem_service.analyze_scan_session(
            session_id=req.session_id,
            db=db,
            force_mock=req.force_mock or False
        )
        return AnalyzeSessionResponse(
            session_id=req.session_id,
            total_analyzed=len(items),
            files=[FileItemSchema.model_validate(item) for item in items]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Analysis failed: {str(e)}"
        )

@api_router.patch("/files/{file_id}", response_model=FileItemSchema)
def update_file_item(file_id: int, req: UpdateFileItemRequest, db: Session = Depends(get_db)):
    item = db.query(FileItem).filter(FileItem.id == file_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="File item not found")

    if req.proposed_filename is not None:
        sanitized = security_service.sanitize_filename(req.proposed_filename, fallback_ext=item.file_extension)
        item.proposed_filename = sanitized

    if req.proposed_category is not None:
        if req.proposed_category in ALLOWED_CATEGORIES:
            item.proposed_category = req.proposed_category

    if req.is_approved is not None:
        item.is_approved = req.is_approved

    if req.analysis_status is not None:
        item.analysis_status = req.analysis_status

    # Recompute proposed destination path
    if item.session and item.proposed_filename:
        dest_path, _ = security_service.resolve_destination_path(
            base_folder=item.session.folder_path,
            category=item.proposed_category or "Other",
            filename=item.proposed_filename,
            avoid_collision=True
        )
        item.proposed_destination_path = dest_path

    db.commit()
    db.refresh(item)
    return FileItemSchema.model_validate(item)

@api_router.post("/operations/preview", response_model=PreviewResponse)
def get_operations_preview(req: PreviewRequest, db: Session = Depends(get_db)):
    try:
        preview_rows = filesystem_service.generate_preview(req.session_id, db)
        return PreviewResponse(
            session_id=req.session_id,
            total_items=len(preview_rows),
            preview_items=preview_rows
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/operations/execute", response_model=ExecuteResponse)
def execute_operations(req: ExecuteRequest, db: Session = Depends(get_db)):
    try:
        batch = filesystem_service.execute_batch_operations(req.session_id, db)
        return ExecuteResponse(
            batch=OperationBatchSchema.model_validate(batch),
            message=f"Executed {batch.successful_operations} operations successfully ({batch.failed_operations} failed)."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Execution error: {str(e)}")

@api_router.get("/operations", response_model=List[OperationBatchSchema])
def list_operations(db: Session = Depends(get_db)):
    batches = db.query(OperationBatch).order_by(desc(OperationBatch.created_at)).limit(50).all()
    return [OperationBatchSchema.model_validate(b) for b in batches]

@api_router.get("/operations/{batch_id}", response_model=OperationBatchSchema)
def get_batch_details(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(OperationBatch).filter(OperationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return OperationBatchSchema.model_validate(batch)

@api_router.post("/operations/{op_id}/undo", response_model=UndoResponse)
def undo_single_operation(op_id: int, db: Session = Depends(get_db)):
    ok, message = filesystem_service.undo_operation(op_id, db)
    op = db.query(FileOperation).filter(FileOperation.id == op_id).first()
    batch_schema = OperationBatchSchema.model_validate(op.batch) if op and op.batch else None
    return UndoResponse(success=ok, message=message, batch=batch_schema)

@api_router.post("/operations/batches/{batch_id}/undo", response_model=BatchUndoResponse)
def undo_batch(batch_id: int, db: Session = Depends(get_db)):
    try:
        res = filesystem_service.undo_batch(batch_id, db)
        return BatchUndoResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_scanned = db.query(FileItem).count()
    awaiting_review = db.query(FileItem).filter(
        FileItem.analysis_status.in_(["analyzed", "pending"]),
        FileItem.is_approved == True
    ).count()
    
    successful_ops = db.query(FileOperation).filter(FileOperation.status == "success").count()
    undoable_ops = db.query(FileOperation).filter(FileOperation.status == "success").count()
    
    recent_batches = db.query(OperationBatch).order_by(desc(OperationBatch.created_at)).limit(5).all()

    return DashboardStatsResponse(
        total_files_scanned=total_scanned,
        files_awaiting_review=awaiting_review,
        files_organized=successful_ops,
        operations_can_be_undone=undoable_ops,
        mock_mode=settings.MOCK_AI,
        active_model=settings.OLLAMA_MODEL,
        allowed_roots=security_service.get_allowed_roots(),
        recent_batches=[OperationBatchSchema.model_validate(b) for b in recent_batches]
    )

@api_router.get("/settings", response_model=SettingsResponse)
def get_settings():
    return SettingsResponse(
        allowed_roots=security_service.get_allowed_roots(),
        ollama_base_url=settings.OLLAMA_BASE_URL,
        ollama_model=settings.OLLAMA_MODEL,
        mock_ai=settings.MOCK_AI,
        max_file_size_bytes=settings.MAX_FILE_SIZE_BYTES,
        max_extract_chars=settings.MAX_EXTRACT_CHARS
    )

@api_router.put("/settings", response_model=SettingsResponse)
def update_settings(req: SettingsUpdateRequest):
    if req.ollama_base_url is not None:
        settings.OLLAMA_BASE_URL = req.ollama_base_url.strip()
        ai_service.base_url = settings.OLLAMA_BASE_URL

    if req.ollama_model is not None:
        settings.OLLAMA_MODEL = req.ollama_model.strip()
        ai_service.model_name = settings.OLLAMA_MODEL

    if req.mock_ai is not None:
        settings.MOCK_AI = req.mock_ai
        ai_service.mock_mode = req.mock_ai

    if req.add_allowed_root is not None:
        clean_root = req.add_allowed_root.strip()
        if os.path.exists(clean_root) and os.path.isdir(clean_root):
            security_service.add_allowed_root(clean_root)

    return get_settings()
