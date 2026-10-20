from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    timestamp: datetime

class AIStatusResponse(BaseModel):
    running: bool
    active_model: str
    model_available: bool
    mock_mode: bool
    available_models: List[str]
    message: str

class FolderValidationRequest(BaseModel):
    folder_path: str

class FolderValidationResponse(BaseModel):
    is_valid: bool
    canonical_path: Optional[str] = None
    error_message: Optional[str] = None
    allowed_roots: List[str]

class FolderBrowseRequest(BaseModel):
    folder_path: Optional[str] = None

class FolderDirectoryItem(BaseModel):
    name: str
    path: str
    is_allowed_root: bool

class FolderBrowseResponse(BaseModel):
    current_path: str
    parent_path: Optional[str] = None
    directories: List[FolderDirectoryItem]
    allowed_roots: List[str]

class ScanFolderRequest(BaseModel):
    folder_path: str

class FileItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_session_id: int
    original_path: str
    original_filename: str
    file_extension: str
    file_size_bytes: int
    mime_type: str
    extracted_text_preview: Optional[str]
    proposed_filename: Optional[str]
    proposed_category: Optional[str]
    proposed_destination_path: Optional[str]
    reason: Optional[str]
    analysis_status: str
    is_approved: bool
    error_message: Optional[str]

class ScanFolderResponse(BaseModel):
    session_id: int
    folder_path: str
    total_files: int
    files: List[FileItemSchema]
    errors: List[str]

class AnalyzeSessionRequest(BaseModel):
    session_id: int
    force_mock: Optional[bool] = False

class AnalyzeSessionResponse(BaseModel):
    session_id: int
    total_analyzed: int
    files: List[FileItemSchema]

class UpdateFileItemRequest(BaseModel):
    proposed_filename: Optional[str] = None
    proposed_category: Optional[str] = None
    is_approved: Optional[bool] = None
    analysis_status: Optional[str] = None

class PreviewItemSchema(BaseModel):
    file_item_id: int
    original_filename: str
    original_path: str
    proposed_filename: str
    proposed_category: Optional[str]
    proposed_destination_path: str
    operation: str
    source_exists: bool
    status: str
    had_collision: bool

class PreviewRequest(BaseModel):
    session_id: int

class PreviewResponse(BaseModel):
    session_id: int
    total_items: int
    preview_items: List[PreviewItemSchema]

class ExecuteRequest(BaseModel):
    session_id: int

class FileOperationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    file_item_id: Optional[int]
    source_path: str
    destination_path: str
    operation_type: str
    status: str
    file_hash_before: Optional[str]
    file_hash_after: Optional[str]
    error_message: Optional[str]
    executed_at: datetime
    undone_at: Optional[datetime]

class OperationBatchSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_session_id: Optional[int]
    total_operations: int
    successful_operations: int
    failed_operations: int
    undone_operations: int
    status: str
    created_at: datetime
    operations: Optional[List[FileOperationSchema]] = None

class ExecuteResponse(BaseModel):
    batch: OperationBatchSchema
    message: str

class UndoResponse(BaseModel):
    success: bool
    message: str
    batch: Optional[OperationBatchSchema] = None

class BatchUndoResponse(BaseModel):
    batch_id: int
    total_attempted: int
    successfully_undone: int
    failed_to_undo: int
    details: List[str]

class DashboardStatsResponse(BaseModel):
    total_files_scanned: int
    files_awaiting_review: int
    files_organized: int
    operations_can_be_undone: int
    mock_mode: bool
    active_model: str
    allowed_roots: List[str]
    recent_batches: List[OperationBatchSchema]

class SettingsResponse(BaseModel):
    allowed_roots: List[str]
    ollama_base_url: str
    ollama_model: str
    mock_ai: bool
    max_file_size_bytes: int
    max_extract_chars: int

class SettingsUpdateRequest(BaseModel):
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    mock_ai: Optional[bool] = None
    add_allowed_root: Optional[str] = None
