export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  timestamp: string;
}

export interface AIStatus {
  running: boolean;
  active_model: string;
  model_available: boolean;
  mock_mode: boolean;
  available_models: string[];
  message: string;
}

export interface FolderValidation {
  is_valid: boolean;
  canonical_path: string | null;
  error_message: string | null;
  allowed_roots: string[];
}

export interface FolderDirectoryItem {
  name: string;
  path: string;
  is_allowed_root: boolean;
}

export interface FolderBrowseResponse {
  current_path: string;
  parent_path: string | null;
  directories: FolderDirectoryItem[];
  allowed_roots: string[];
}

export interface FileItem {
  id: number;
  scan_session_id: number;
  original_path: string;
  original_filename: string;
  file_extension: string;
  file_size_bytes: number;
  mime_type: string;
  extracted_text_preview?: string | null;
  proposed_filename?: string | null;
  proposed_category?: string | null;
  proposed_destination_path?: string | null;
  reason?: string | null;
  analysis_status: 'pending' | 'analyzed' | 'excluded' | 'approved' | 'rejected' | 'failed';
  is_approved: boolean;
  error_message?: string | null;
}

export interface ScanFolderResponse {
  session_id: number;
  folder_path: string;
  total_files: number;
  files: FileItem[];
  errors: string[];
}

export interface PreviewItem {
  file_item_id: number;
  original_filename: string;
  original_path: string;
  proposed_filename: string;
  proposed_category: string | null;
  proposed_destination_path: string;
  operation: string;
  source_exists: boolean;
  status: 'ready' | 'renamed_to_avoid_collision' | 'no_change_needed' | 'source_missing';
  had_collision: boolean;
}

export interface PreviewResponse {
  session_id: number;
  total_items: number;
  preview_items: PreviewItem[];
}

export interface FileOperation {
  id: number;
  batch_id: number;
  file_item_id: number | null;
  source_path: string;
  destination_path: string;
  operation_type: string;
  status: 'pending' | 'success' | 'failed' | 'undone' | 'undo_failed';
  file_hash_before: string | null;
  file_hash_after: string | null;
  error_message: string | null;
  executed_at: string;
  undone_at: string | null;
}

export interface OperationBatch {
  id: number;
  scan_session_id: number | null;
  total_operations: number;
  successful_operations: number;
  failed_operations: number;
  undone_operations: number;
  status: 'completed' | 'partially_failed' | 'undone' | 'partially_undone';
  created_at: string;
  operations?: FileOperation[];
}

export interface DashboardStats {
  total_files_scanned: number;
  files_awaiting_review: number;
  files_organized: number;
  operations_can_be_undone: number;
  mock_mode: boolean;
  active_model: string;
  allowed_roots: string[];
  recent_batches: OperationBatch[];
}

export interface AppSettings {
  allowed_roots: string[];
  ollama_base_url: string;
  ollama_model: string;
  mock_ai: boolean;
  max_file_size_bytes: number;
  max_extract_chars: number;
}
