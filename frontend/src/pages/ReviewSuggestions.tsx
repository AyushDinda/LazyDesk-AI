import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Check,
  X,
  RotateCw,
  Edit2,
  ArrowRight,
  Bot
} from 'lucide-react';
import { api } from '../services/api';
import type { FileItem, AIStatus } from '../types';

const CATEGORIES = [
  'Documents',
  'Education',
  'Work',
  'Finance',
  'Projects',
  'Images',
  'Notes',
  'Other',
];

export const ReviewSuggestions: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // Inline editing state: { [fileId]: string }
  const [editingNames, setEditingNames] = useState<Record<number, string>>({});

  const fetchSessionAndAnalyze = async (autoAnalyze = true) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // Check AI Status
      const statusRes = await api.getAIStatus();
      setAiStatus(statusRes);

      if (autoAnalyze) {
        setAnalyzing(true);
        const res = await api.analyzeSession(Number(sessionId));
        setFiles(res.files);
      }
    } catch (err: any) {
      setError(err.message || 'AI Analysis failed');
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchSessionAndAnalyze(true);
  }, [sessionId]);

  const handleUpdateItem = async (
    fileId: number,
    updates: {
      proposed_filename?: string;
      proposed_category?: string;
      is_approved?: boolean;
    }
  ) => {
    try {
      const updated = await api.updateFileItem(fileId, updates);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleApproveAll = async () => {
    for (const f of files) {
      if (!f.is_approved) {
        await handleUpdateItem(f.id, { is_approved: true });
      }
    }
  };

  const handleExcludeAll = async () => {
    for (const f of files) {
      if (f.is_approved) {
        await handleUpdateItem(f.id, { is_approved: false });
      }
    }
  };

  const handleRetryAnalysis = () => {
    fetchSessionAndAnalyze(true);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const approvedCount = files.filter((f) => f.is_approved).length;

  if (loading || analyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-stone-600">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-[#EDF7F1] flex items-center justify-center text-[#1B4332]">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-[#2D6A4F] border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-stone-900 text-lg">
            Analyzing Document Context with Local AI...
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-md">
            Extracting document summaries, proposing conservative filenames, and categorizing into safe destinations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Review AI Suggestions
            </h1>
            {aiStatus?.mock_mode && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Mock Mode
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Review proposed filenames and destination categories. Edit or exclude any item before previewing changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetryAnalysis}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Re-analyze
          </button>
          <button
            onClick={() => navigate(`/preview/${sessionId}`)}
            disabled={approvedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-sm font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            Preview {approvedCount} Approved Changes
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Model banner / Offline Notice */}
      {aiStatus && (
        <div className="p-4 rounded-2xl bg-white border border-[#E6E0D5] flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#2D6A4F]" />
            <span>
              Inference Engine:{' '}
              <strong className="text-stone-800">{aiStatus.active_model}</strong>
              {aiStatus.mock_mode ? ' (Deterministic Smart Fallback)' : ' (Live Ollama)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApproveAll}
              className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
            >
              Approve All ({files.length})
            </button>
            <span className="text-stone-300">|</span>
            <button
              onClick={handleExcludeAll}
              className="text-stone-500 hover:text-stone-700 cursor-pointer"
            >
              Exclude All
            </button>
          </div>
        </div>
      )}

      {/* Table of Suggestions */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-stone-600 text-xs uppercase font-medium border-b border-[#E6E0D5]">
              <tr>
                <th className="px-6 py-3.5 w-12 text-center">Approve</th>
                <th className="px-6 py-3.5">Original File</th>
                <th className="px-6 py-3.5">Proposed Filename</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">AI Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E0D5]">
              {files.map((file) => {
                const isEditing = editingNames[file.id] !== undefined;
                const currentEdit = isEditing
                  ? editingNames[file.id]
                  : file.proposed_filename || file.original_filename;

                return (
                  <tr
                    key={file.id}
                    className={`transition ${
                      !file.is_approved
                        ? 'opacity-40 bg-stone-50'
                        : 'hover:bg-[#FAF8F5]/60'
                    }`}
                  >
                    {/* Checkbox / Toggle */}
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={file.is_approved}
                        onChange={(e) =>
                          handleUpdateItem(file.id, { is_approved: e.target.checked })
                        }
                        className="w-4 h-4 rounded-md accent-[#1B4332] cursor-pointer"
                      />
                    </td>

                    {/* Original filename & metadata */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-stone-900 max-w-xs truncate">
                        {file.original_filename}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400">
                        <span>{file.file_extension}</span>
                        <span>•</span>
                        <span>{formatBytes(file.file_size_bytes)}</span>
                      </div>
                    </td>

                    {/* Proposed Filename (Inline Editable) */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={currentEdit}
                            onChange={(e) =>
                              setEditingNames((prev) => ({
                                ...prev,
                                [file.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1 text-xs rounded-lg border border-[#2D6A4F] bg-white text-stone-900 font-mono focus:outline-hidden focus:ring-1 focus:ring-[#2D6A4F] w-56"
                          />
                          <button
                            onClick={() => {
                              handleUpdateItem(file.id, {
                                proposed_filename: currentEdit,
                              });
                              setEditingNames((prev) => {
                                const next = { ...prev };
                                delete next[file.id];
                                return next;
                              });
                            }}
                            className="p-1 rounded-md bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingNames((prev) => {
                                const next = { ...prev };
                                delete next[file.id];
                                return next;
                              });
                            }}
                            className="p-1 rounded-md text-stone-400 hover:text-stone-600 transition"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span className="font-mono text-xs text-[#1B4332] font-semibold truncate max-w-xs">
                            {file.proposed_filename || file.original_filename}
                          </span>
                          <button
                            onClick={() =>
                              setEditingNames((prev) => ({
                                ...prev,
                                [file.id]: file.proposed_filename || file.original_filename,
                              }))
                            }
                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-700 transition rounded-md"
                            title="Edit filename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Category Selector */}
                    <td className="px-6 py-4">
                      <select
                        value={file.proposed_category || 'Other'}
                        onChange={(e) =>
                          handleUpdateItem(file.id, {
                            proposed_category: e.target.value,
                          })
                        }
                        className="text-xs font-medium px-2 py-1 rounded-lg border border-[#E6E0D5] bg-white text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#2D6A4F] cursor-pointer"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Reasoning */}
                    <td className="px-6 py-4">
                      <p className="text-xs text-stone-600 max-w-sm line-clamp-2 leading-relaxed">
                        {file.reason || 'General categorization based on document contents.'}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
