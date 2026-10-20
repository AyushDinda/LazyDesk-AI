import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import type { OperationBatch, FileOperation } from '../types';
import { StatusPill } from '../components/StatusPill';

export const OperationHistory: React.FC = () => {
  const [batches, setBatches] = useState<OperationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded batch ID: number | null
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [batchDetails, setBatchDetails] = useState<Record<number, FileOperation[]>>({});
  const [detailsLoading, setDetailsLoading] = useState<number | null>(null);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listOperations();
      setBatches(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const toggleExpand = async (batchId: number) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }

    setExpandedBatchId(batchId);
    if (!batchDetails[batchId]) {
      setDetailsLoading(batchId);
      try {
        const batch = await api.getBatchDetails(batchId);
        setBatchDetails((prev) => ({
          ...prev,
          [batchId]: batch.operations || [],
        }));
      } catch (err: any) {
        alert(`Failed to load details: ${err.message}`);
      } finally {
        setDetailsLoading(null);
      }
    }
  };

  const handleUndoBatch = async (batchId: number) => {
    if (!confirm(`Are you sure you want to revert all operations in Batch #${batchId}?`)) return;
    setActionLoading(batchId);
    try {
      const res = await api.undoBatch(batchId);
      alert(`Restored ${res.successfully_undone} files (${res.failed_to_undo} failed).`);
      await loadBatches();
      // Reload expanded details if open
      if (expandedBatchId === batchId) {
        const refreshed = await api.getBatchDetails(batchId);
        setBatchDetails((prev) => ({ ...prev, [batchId]: refreshed.operations || [] }));
      }
    } catch (err: any) {
      alert(`Undo error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndoSingle = async (opId: number, batchId: number) => {
    setActionLoading(opId);
    try {
      const res = await api.undoOperation(opId);
      if (res.success) {
        alert(res.message);
      } else {
        alert(`Cannot undo: ${res.message}`);
      }
      await loadBatches();
      const refreshed = await api.getBatchDetails(batchId);
      setBatchDetails((prev) => ({ ...prev, [batchId]: refreshed.operations || [] }));
    } catch (err: any) {
      alert(`Undo error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Operation History & Safe Undo
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Inspect previous organization batches, review original and destination paths, and safely restore files with SHA-256 integrity checks.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-stone-500">
          <div className="w-8 h-8 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading operation logs...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-12 text-center space-y-3">
          <History className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-semibold text-stone-800 text-base">No previous operations</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Once you scan and organize folders, every action with SHA-256 checksums will be logged here for rollback capability.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;
            const operations = batchDetails[batch.id] || [];
            const isBatchLoading = detailsLoading === batch.id;
            const canUndoBatch = batch.successful_operations > (batch.undone_operations || 0);

            return (
              <div
                key={batch.id}
                className="bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs transition"
              >
                {/* Batch Header Row */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF8F5]/50">
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      onClick={() => toggleExpand(batch.id)}
                      className="p-1 rounded-lg hover:bg-stone-200 text-stone-500 transition cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-base">
                          Batch #{batch.id}
                        </span>
                        <StatusPill status={batch.status} />
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {new Date(batch.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-xs text-stone-600">
                      <span className="font-semibold text-emerald-800">
                        {batch.successful_operations}
                      </span>{' '}
                      successful •{' '}
                      <span className="font-semibold text-indigo-700">
                        {batch.undone_operations || 0}
                      </span>{' '}
                      undone •{' '}
                      <span className="font-semibold text-rose-700">
                        {batch.failed_operations}
                      </span>{' '}
                      failed
                    </div>

                    {canUndoBatch && (
                      <button
                        onClick={() => handleUndoBatch(batch.id)}
                        disabled={actionLoading === batch.id}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-stone-200 text-stone-800 hover:bg-stone-100 transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${
                            actionLoading === batch.id ? 'animate-spin' : ''
                          }`}
                        />
                        Undo All ({batch.successful_operations - (batch.undone_operations || 0)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Detailed Operation List */}
                {isExpanded && (
                  <div className="border-t border-[#E6E0D5] p-5 bg-white">
                    {isBatchLoading ? (
                      <div className="py-6 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                        Fetching operation log details...
                      </div>
                    ) : operations.length === 0 ? (
                      <div className="py-6 text-center text-xs text-stone-400">
                        No sub-operations recorded in this batch.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#FAF8F5] text-stone-500 uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-2.5">Original Source</th>
                              <th className="px-4 py-2.5">Current Destination</th>
                              <th className="px-4 py-2.5">SHA-256 Hash</th>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 font-mono">
                            {operations.map((op) => (
                              <tr key={op.id} className="hover:bg-stone-50/60">
                                <td className="px-4 py-3 text-stone-700 max-w-xs truncate" title={op.source_path}>
                                  {op.source_path}
                                </td>
                                <td className="px-4 py-3 text-[#1B4332] font-medium max-w-xs truncate" title={op.destination_path}>
                                  {op.destination_path}
                                </td>
                                <td className="px-4 py-3 text-stone-400 text-[11px] truncate max-w-[120px]" title={op.file_hash_after || ''}>
                                  {op.file_hash_after ? `${op.file_hash_after.slice(0, 10)}...` : 'N/A'}
                                </td>
                                <td className="px-4 py-3 font-sans">
                                  <StatusPill status={op.status} />
                                </td>
                                <td className="px-4 py-3 text-right font-sans">
                                  {op.status === 'success' && (
                                    <button
                                      onClick={() => handleUndoSingle(op.id, batch.id)}
                                      disabled={actionLoading === op.id}
                                      className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Undo
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
