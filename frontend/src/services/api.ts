import type {
  HealthResponse,
  AIStatus,
  FolderValidation,
  FolderBrowseResponse,
  ScanFolderResponse,
  FileItem,
  PreviewResponse,
  OperationBatch,
  DashboardStats,
  AppSettings
} from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async getAIStatus(): Promise<AIStatus> {
    const res = await fetch(`${API_BASE}/ai/status`);
    return handleResponse<AIStatus>(res);
  },

  async validateFolder(folder_path: string): Promise<FolderValidation> {
    const res = await fetch(`${API_BASE}/folders/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path }),
    });
    return handleResponse<FolderValidation>(res);
  },

  async browseFolder(folder_path?: string): Promise<FolderBrowseResponse> {
    const res = await fetch(`${API_BASE}/folders/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path }),
    });
    return handleResponse<FolderBrowseResponse>(res);
  },

  async scanFolder(folder_path: string): Promise<ScanFolderResponse> {
    const res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_path }),
    });
    return handleResponse<ScanFolderResponse>(res);
  },

  async analyzeSession(session_id: number, force_mock?: boolean): Promise<{ session_id: number; total_analyzed: number; files: FileItem[] }> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, force_mock }),
    });
    return handleResponse(res);
  },

  async updateFileItem(
    file_id: number,
    updates: {
      proposed_filename?: string;
      proposed_category?: string;
      is_approved?: boolean;
      analysis_status?: string;
    }
  ): Promise<FileItem> {
    const res = await fetch(`${API_BASE}/files/${file_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<FileItem>(res);
  },

  async getPreview(session_id: number): Promise<PreviewResponse> {
    const res = await fetch(`${API_BASE}/operations/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    });
    return handleResponse<PreviewResponse>(res);
  },

  async executeOperations(session_id: number): Promise<{ batch: OperationBatch; message: string }> {
    const res = await fetch(`${API_BASE}/operations/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id }),
    });
    return handleResponse(res);
  },

  async listOperations(): Promise<OperationBatch[]> {
    const res = await fetch(`${API_BASE}/operations`);
    return handleResponse<OperationBatch[]>(res);
  },

  async getBatchDetails(batch_id: number): Promise<OperationBatch> {
    const res = await fetch(`${API_BASE}/operations/${batch_id}`);
    return handleResponse<OperationBatch>(res);
  },

  async undoOperation(op_id: number): Promise<{ success: boolean; message: string; batch?: OperationBatch }> {
    const res = await fetch(`${API_BASE}/operations/${op_id}/undo`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async undoBatch(batch_id: number): Promise<{
    batch_id: number;
    total_attempted: number;
    successfully_undone: number;
    failed_to_undo: number;
    details: string[];
  }> {
    const res = await fetch(`${API_BASE}/operations/batches/${batch_id}/undo`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    return handleResponse<DashboardStats>(res);
  },

  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<AppSettings>(res);
  },

  async updateSettings(updates: {
    ollama_base_url?: string;
    ollama_model?: string;
    mock_ai?: boolean;
    add_allowed_root?: string;
  }): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<AppSettings>(res);
  },
};
