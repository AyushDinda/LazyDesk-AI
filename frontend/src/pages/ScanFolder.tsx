import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderSearch,
  FolderOpen,
  Sparkles,
  FileCheck,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { FolderPickerModal } from '../components/FolderPickerModal';
import type { ScanFolderResponse, FileItem } from '../types';

export const ScanFolder: React.FC = () => {
  const navigate = useNavigate();
  const [folderPath, setFolderPath] = useState<string>('');
  const [allowedRoots, setAllowedRoots] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanFolderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load allowed roots and initialize default sample path
    api.getSettings().then((res) => {
      setAllowedRoots(res.allowed_roots);
      if (res.allowed_roots.length > 0) {
        // Find if sample_messy_folder exists or use first allowed root
        const sampleRoot = res.allowed_roots.find(r => r.includes('sample_messy_folder'));
        setFolderPath(sampleRoot || res.allowed_roots[0]);
      }
    }).catch(() => {});
  }, []);

  const handleScan = async (pathOverride?: string) => {
    const target = pathOverride || folderPath;
    if (!target.trim()) {
      setError('Please provide or select a folder path.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const res = await api.scanFolder(target.trim());
      setScanResult(res);
      if (res.files.length === 0) {
        setError('No supported documents or image files found in this directory.');
      }
    } catch (err: any) {
      setError(err.message || 'Folder scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const handleProceedToReview = () => {
    if (scanResult && scanResult.session_id) {
      navigate(`/review/${scanResult.session_id}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Scan & Organize Folder
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Select a directory to inspect supported documents and extract text locally before running AI categorization.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
            Target Directory Path
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="e.g. C:\Users\ayush\OneDrive\Desktop\Hacktober\dev4\sample_messy_folder"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-[#2D6A4F] text-stone-800 text-sm font-mono bg-[#FAF8F5]/50"
              />
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-4 py-3 rounded-xl border border-[#E6E0D5] bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 text-sm font-medium transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-[#2D6A4F]" />
              Browse Folders
            </button>
            <button
              onClick={() => handleScan()}
              disabled={isScanning}
              className="px-6 py-3 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-sm font-semibold transition flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderSearch className="w-4 h-4" />
                  Scan Folder
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Presets & Allowed Roots */}
        <div className="pt-2 border-t border-[#E6E0D5] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-stone-600">
            <ShieldCheck className="w-4 h-4 text-[#2D6A4F]" />
            <span>Permitted Allowed Roots:</span>
            <div className="flex flex-wrap gap-1.5">
              {allowedRoots.map((root) => (
                <button
                  key={root}
                  onClick={() => {
                    setFolderPath(root);
                    handleScan(root);
                  }}
                  className="font-mono bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-[#1B4332] px-2 py-0.5 rounded-md border border-stone-200 transition cursor-pointer"
                  title="Click to select this root"
                >
                  {root.split(/[\\/]/).pop()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-400">Supported:</span>
            {['PDF', 'DOCX', 'TXT', 'MD', 'CSV', 'Images'].map((fmt) => (
              <span
                key={fmt}
                className="px-1.5 py-0.5 rounded-md bg-[#EDF7F1] text-[#1B4332] font-medium text-[11px]"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <h5 className="font-semibold">Unable to complete scan</h5>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Scan Results Card */}
      {scanResult && (
        <div className="bg-white border border-[#E6E0D5] rounded-2xl overflow-hidden shadow-xs space-y-4">
          <div className="px-6 py-5 border-b border-[#E6E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF8F5]">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#2D6A4F]" />
                <h3 className="font-semibold text-stone-900 text-base">
                  Discovered {scanResult.files.length} Supported File{scanResult.files.length === 1 ? '' : 's'}
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 font-mono truncate max-w-xl">
                {scanResult.folder_path}
              </p>
            </div>

            {scanResult.files.length > 0 && (
              <button
                onClick={handleProceedToReview}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                Analyze with Local AI
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Files List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5]/80 text-stone-600 text-xs uppercase font-medium border-b border-[#E6E0D5]">
                <tr>
                  <th className="px-6 py-3">File Name</th>
                  <th className="px-6 py-3">Format</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">Preview Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E0D5]">
                {scanResult.files.map((file: FileItem) => (
                  <tr key={file.id} className="hover:bg-[#FAF8F5]/50 transition">
                    <td className="px-6 py-3.5 font-medium text-stone-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                      <span className="truncate max-w-xs">{file.original_filename}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs font-mono">
                        {file.file_extension}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-stone-500 text-xs">
                      {formatBytes(file.file_size_bytes)}
                    </td>
                    <td className="px-6 py-3.5 text-stone-500 text-xs">
                      <p className="truncate max-w-md italic font-serif">
                        {file.extracted_text_preview || '[No textual content]'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Any scan warnings */}
          {scanResult.errors && scanResult.errors.length > 0 && (
            <div className="px-6 py-4 bg-amber-50/60 border-t border-amber-200 text-xs text-amber-800 space-y-1">
              <span className="font-semibold block">Scan Notices:</span>
              {scanResult.errors.map((e, idx) => (
                <p key={idx}>• {e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Directory picker modal */}
      <FolderPickerModal
        isOpen={pickerOpen}
        initialPath={folderPath}
        onSelect={(selected) => {
          setFolderPath(selected);
          handleScan(selected);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
};
