import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import type { PreviewItem, OperationBatch } from '../types';
import { StatusPill } from '../components/StatusPill';

export const PreviewOperations: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Explicit confirmation checkbox state
  const [confirmed, setConfirmed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executedBatch, setExecutedBatch] = useState<OperationBatch | null>(null);

  const loadPreview = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPreview(Number(sessionId));
      setPreviewItems(res.preview_items);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [sessionId]);

  const handleExecute = async () => {
    if (!sessionId || !confirmed) return;
    setIsExecuting(true);
    setError(null);
    try {
      const res = await api.executeOperations(Number(sessionId));
      setExecutedBatch(res.batch);
    } catch (err: any) {
      setError(err.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleQuickUndo = async () => {
    if (!executedBatch) return;
    try {
      await api.undoBatch(executedBatch.id);
      alert('Batch was successfully restored!');
      navigate('/history');
    } catch (err: any) {
      alert(`Undo failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-stone-500">
        <div className="w-8 h-8 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Validating paths and generating filesystem preview...</p>
      </div>
    );
  }

  // Execution Complete Success View
  if (executedBatch) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#EDF7F1] text-[#1B4332] flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Files Successfully Organized!</h2>
          <p className="text-sm text-stone-500 mt-2">
            Organized {executedBatch.successful_operations} file{executedBatch.successful_operations === 1 ? '' : 's'}. 
            All operations were safely recorded in SQLite with SHA-256 hashes and can be reverted at any time.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E6E0D5] text-left text-xs text-stone-600 space-y-1 font-mono">
          <div>Batch ID: #{executedBatch.id}</div>
          <div>Successful: {executedBatch.successful_operations}</div>
          <div>Failed: {executedBatch.failed_operations}</div>
          <div>Status: {executedBatch.status}</div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => navigate('/history')}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#2D6A4F] transition shadow-xs cursor-pointer"
          >
            View in Operation History
          </button>
          <button
            onClick={handleQuickUndo}
            className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 transition flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Undo This Batch Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/review/${sessionId}`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Suggestions
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            Preview Before Applying
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Review the exact validated source and destination paths. No files will be moved without your explicit approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
              Files Affected
            </span>
            <span className="text-xl font-bold text-stone-900">
              {previewItems.length}
            </span>
          </div>
        </div>
      </div>

      {/* Trust & Collision Safeguards Banner */}
      <div className="p-4 rounded-2xl bg-[#EDF7F1] border border-[#D8F3DC] text-xs text-[#1B4332] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#2D6A4F] shrink-0 mt-0.5" />
        <div>
          <h5 className="font-semibold text-sm text-[#1B4332]">Strict Zero-Loss Safety Guarantee</h5>
          <p className="mt-0.5 leading-relaxed text-[#2D6A4F]">
            LazyDesk AI never overwrites existing files. If a destination file already exists, a safe non-destructive unique suffix is assigned.
            Source files are checked for presence, and every operation is recorded to support instant undo.
          </p>
        </div>
      </div>

      {/* Action Table */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-stone-600 text-xs uppercase font-medium border-b border-[#E6E0D5]">
              <tr>
                <th className="px-6 py-3.5">Original File Path</th>
                <th className="px-6 py-3.5">Proposed Destination Path</th>
                <th className="px-6 py-3.5">Operation</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E0D5]">
              {previewItems.map((item) => (
                <tr key={item.file_item_id} className="hover:bg-[#FAF8F5]/60 transition">
                  {/* Source Path */}
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-stone-700 max-w-sm truncate" title={item.original_path}>
                      {item.original_path}
                    </div>
                  </td>

                  {/* Destination Path */}
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-[#1B4332] font-semibold max-w-sm truncate" title={item.proposed_destination_path}>
                      {item.proposed_destination_path}
                    </div>
                  </td>

                  {/* Operation */}
                  <td className="px-6 py-4 text-xs font-medium text-stone-600">
                    {item.operation}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <StatusPill status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation & Execution Panel */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-5 h-5 rounded-md accent-[#1B4332] mt-0.5 cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-stone-700 leading-snug">
            I confirm that I have reviewed the proposed file moves and approve LazyDesk AI to organize these {previewItems.length} files.
          </span>
        </label>

        <button
          onClick={handleExecute}
          disabled={!confirmed || isExecuting || previewItems.length === 0}
          className="px-6 py-3 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-sm font-semibold transition flex items-center gap-2 shadow-xs shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Organizing Files...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Execute Approved Moves
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}
    </div>
  );
};
