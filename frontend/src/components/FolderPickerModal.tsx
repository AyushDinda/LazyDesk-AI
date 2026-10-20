import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ArrowUp, X, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { FolderBrowseResponse } from '../types';

interface FolderPickerModalProps {
  isOpen: boolean;
  initialPath?: string;
  onSelect: (folderPath: string) => void;
  onClose: () => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  initialPath,
  onSelect,
  onClose,
}) => {
  const [data, setData] = useState<FolderBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(initialPath || '');

  const loadDirectories = async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.browseFolder(path);
      setData(res);
      setCurrentPath(res.current_path);
    } catch (err: any) {
      setError(err.message || 'Failed to load directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectories(initialPath);
    }
  }, [isOpen, initialPath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] border border-[#E6E0D5] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E0D5] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#2D6A4F]" />
            <h3 className="font-semibold text-stone-900 text-lg">Select Folder to Organize</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2.5 bg-[#EDF7F1] border-b border-[#D8F3DC] flex items-center gap-2 text-xs text-[#1B4332]">
          <ShieldCheck className="w-4 h-4 text-[#2D6A4F] shrink-0" />
          <span>
            Browsing is restricted to configured allowed roots for security. Symbolic links and outside directories are blocked.
          </span>
        </div>

        {/* Current Path Bar & Parent Navigation */}
        <div className="px-6 py-3 border-b border-[#E6E0D5] bg-stone-50 flex items-center gap-2">
          {data?.parent_path && (
            <button
              onClick={() => loadDirectories(data.parent_path!)}
              className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 transition"
              title="Go Up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
          <div className="font-mono text-xs text-stone-700 bg-white border border-stone-200 px-3 py-1.5 rounded-lg truncate flex-1 select-all">
            {currentPath}
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-stone-500">
              <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Reading directory structure...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {data?.directories && data.directories.length > 0 ? (
                data.directories.map((dir) => (
                  <div
                    key={dir.path}
                    onClick={() => loadDirectories(dir.path)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF8F5] cursor-pointer group transition border border-transparent hover:border-[#E6E0D5]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="w-5 h-5 text-[#40916C] group-hover:text-[#1B4332] shrink-0" />
                      <span className="text-sm font-medium text-stone-800 truncate group-hover:text-stone-900">
                        {dir.name}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400 group-hover:text-stone-600">Open &rarr;</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-stone-400 text-sm">
                  No subdirectories found in this folder.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E6E0D5] bg-[#FAF8F5] flex items-center justify-between">
          <div className="text-xs text-stone-500">
            Selected: <span className="font-mono font-medium text-stone-700">{currentPath.split(/[\\/]/).pop()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelect(currentPath);
                onClose();
              }}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-[#1B4332] text-white hover:bg-[#2D6A4F] transition flex items-center gap-1.5 shadow-xs"
            >
              <Check className="w-4 h-4" />
              Use This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
