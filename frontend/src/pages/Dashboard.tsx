import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderSearch,
  CheckCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  FileText,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';
import type { DashboardStats, OperationBatch } from '../types';
import { StatusPill } from '../components/StatusPill';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState<number | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats();
      setStats(res);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleUndoBatch = async (batchId: number) => {
    setUndoLoading(batchId);
    try {
      await api.undoBatch(batchId);
      await loadStats();
    } catch (err: any) {
      alert(`Undo failed: ${err.message}`);
    } finally {
      setUndoLoading(null);
    }
  };

  const handleSeedDemo = () => {
    navigate('/scan');
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-stone-500">
        <div className="w-8 h-8 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading workspace metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#1B4332] via-[#2D6A4F] to-[#1B4332] text-white p-8 sm:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-medium border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hacktoberfest AI Challenge — Slow & Steady</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Stop organizing files manually. Let your local AI do the boring work.
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
            LazyDesk AI analyzes document purpose locally on your device, suggests clean filenames and categories, and waits for your approval before safely organizing.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/scan')}
              className="px-6 py-3 rounded-xl bg-white text-[#1B4332] font-semibold text-sm hover:bg-emerald-50 transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FolderSearch className="w-4 h-4" />
              Organize My Files
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition backdrop-blur-xs border border-white/10 cursor-pointer"
            >
              Verify Local AI Status
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          Notice: {errorMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs hover:border-[#2D6A4F]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Files Scanned
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <FolderSearch className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-stone-900">
            {stats?.total_files_scanned ?? 0}
          </p>
          <p className="mt-1 text-xs text-stone-500">Across local scan sessions</p>
        </div>

        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs hover:border-[#2D6A4F]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Awaiting Review
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-stone-900">
            {stats?.files_awaiting_review ?? 0}
          </p>
          <p className="mt-1 text-xs text-stone-500">Requiring your approval</p>
        </div>

        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs hover:border-[#2D6A4F]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Files Organized
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#1B4332]">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-stone-900">
            {stats?.files_organized ?? 0}
          </p>
          <p className="mt-1 text-xs text-stone-500">Categorized & renamed</p>
        </div>

        <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs hover:border-[#2D6A4F]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Undo Available
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-stone-900">
            {stats?.operations_can_be_undone ?? 0}
          </p>
          <p className="mt-1 text-xs text-stone-500">Reversible file moves</p>
        </div>
      </div>

      {/* Trust & Safety Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E6E0D5] flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#EDF7F1] text-[#1B4332] shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-stone-900 text-sm">Protected Allowed Roots</h4>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Filesystem actions are restricted to verified permitted directories. Path traversal and symlinks are rejected.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E6E0D5] flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-stone-900 text-sm">Strict Preview & Review</h4>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              No files are moved silently. You review AI suggested names and destination folders before applying changes.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E6E0D5] flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-stone-900 text-sm">Hash-Checked Undo</h4>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Every operation records SHA-256 hashes and original paths. Moves can be safely reverted anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-5 border-b border-[#E6E0D5] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900 text-base">Recent Organizing Activity</h3>
            <p className="text-xs text-stone-500 mt-0.5">Live record of execution batches and undo actions</p>
          </div>
          {stats?.recent_batches && stats.recent_batches.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="text-xs font-semibold text-[#1B4332] hover:underline"
            >
              View Full History &rarr;
            </button>
          )}
        </div>

        {stats?.recent_batches && stats.recent_batches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-stone-600 text-xs uppercase font-medium border-b border-[#E6E0D5]">
                <tr>
                  <th className="px-6 py-3.5">Batch ID</th>
                  <th className="px-6 py-3.5">Executed At</th>
                  <th className="px-6 py-3.5">Files Processed</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E0D5]">
                {stats.recent_batches.map((batch: OperationBatch) => (
                  <tr key={batch.id} className="hover:bg-[#FAF8F5]/80 transition">
                    <td className="px-6 py-4 font-mono font-medium text-stone-900">
                      #{batch.id}
                    </td>
                    <td className="px-6 py-4 text-stone-600 text-xs">
                      {new Date(batch.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-stone-700">
                      <span className="font-semibold text-emerald-800">{batch.successful_operations}</span>
                      <span className="text-stone-400"> / {batch.total_operations} successful</span>
                      {batch.failed_operations > 0 && (
                        <span className="ml-2 text-xs text-rose-600">({batch.failed_operations} failed)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={batch.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {batch.successful_operations > (batch.undone_operations || 0) && (
                        <button
                          onClick={() => handleUndoBatch(batch.id)}
                          disabled={undoLoading === batch.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${undoLoading === batch.id ? 'animate-spin' : ''}`} />
                          Undo Batch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 px-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EDF7F1] text-[#1B4332] flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-stone-900 text-base">No file organization batches yet</h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Scan a cluttered folder to extract text, let the local AI categorize your files, and safely organize your workspace.
            </p>
            <div className="pt-2">
              <button
                onClick={handleSeedDemo}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:bg-[#2D6A4F] transition shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <FolderSearch className="w-4 h-4" />
                Scan a Folder Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
