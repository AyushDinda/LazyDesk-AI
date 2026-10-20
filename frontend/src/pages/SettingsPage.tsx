import React, { useState, useEffect } from 'react';
import {
  Bot,
  ShieldCheck,
  FolderLock,
  Save,
  CheckCircle,
  AlertCircle,
  RotateCw,
  FolderPlus
} from 'lucide-react';
import { api } from '../services/api';
import type { AppSettings, AIStatus } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [mockAi, setMockAi] = useState(false);
  const [newRootInput, setNewRootInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, aiRes] = await Promise.all([api.getSettings(), api.getAIStatus()]);
      setSettings(sRes);
      setAiStatus(aiRes);

      setOllamaUrl(sRes.ollama_base_url);
      setOllamaModel(sRes.ollama_model);
      setMockAi(sRes.mock_ai);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const updated = await api.updateSettings({
        ollama_base_url: ollamaUrl,
        ollama_model: ollamaModel,
        mock_ai: mockAi,
      });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      const newStatus = await api.getAIStatus();
      setAiStatus(newStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoot = async () => {
    if (!newRootInput.trim()) return;
    try {
      const updated = await api.updateSettings({
        add_allowed_root: newRootInput.trim(),
      });
      setSettings(updated);
      setNewRootInput('');
      alert('Allowed root successfully added.');
    } catch (err: any) {
      alert(`Could not add root: ${err.message}`);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-stone-500">
        <div className="w-8 h-8 border-3 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading settings and checking Ollama daemon...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Settings & Local AI Status
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Configure Ollama endpoints, switch active open-weight models, manage allowed directories, and review security boundaries.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-[#1B4332] text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Local AI Status Card */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EDF7F1] text-[#1B4332] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">Local AI Inference Health</h3>
              <p className="text-xs text-stone-500">Ollama local REST API connection</p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
            title="Refresh status"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D5]">
            <span className="text-[11px] font-semibold text-stone-500 uppercase block">Status</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  aiStatus?.running ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="text-sm font-semibold text-stone-800">
                {aiStatus?.running ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D5]">
            <span className="text-[11px] font-semibold text-stone-500 uppercase block">Active Model</span>
            <span className="text-sm font-semibold text-stone-800 mt-1 block truncate">
              {aiStatus?.active_model || 'None'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D5]">
            <span className="text-[11px] font-semibold text-stone-500 uppercase block">Mock Mode</span>
            <span className="text-sm font-semibold text-stone-800 mt-1 block">
              {aiStatus?.mock_mode ? 'Enabled (Deterministic)' : 'Disabled (Live Ollama)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-stone-500">{aiStatus?.message}</p>
      </div>

      {/* AI Configuration Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="font-semibold text-stone-900 text-sm">Ollama & Model Preferences</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Ollama Base URL
            </label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-mono bg-[#FAF8F5]/50 focus:outline-hidden focus:ring-1 focus:ring-[#2D6A4F]"
            />
            <span className="text-[11px] text-stone-400 mt-1 block">
              Default: http://localhost:11434
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Target Open-Weight Model
            </label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs font-mono bg-[#FAF8F5]/50 focus:outline-hidden focus:ring-1 focus:ring-[#2D6A4F]"
              placeholder="e.g. qwen3, llama3.1"
            />
            {aiStatus?.available_models && aiStatus.available_models.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[11px] text-stone-400">Detected on device:</span>
                {aiStatus.available_models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setOllamaModel(m)}
                    className="text-[11px] font-mono text-[#1B4332] bg-[#EDF7F1] px-1.5 py-0.5 rounded border border-[#D8F3DC] hover:bg-[#D8F3DC]"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deterministic Mock Mode Toggle */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
          <div>
            <span className="font-semibold text-stone-800 text-sm block">Mock AI Mode</span>
            <span className="text-xs text-stone-500">
              Run offline with deterministic intelligent keyword heuristic analysis (great for testing or low-RAM environments).
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={mockAi}
              onChange={(e) => setMockAi(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4332]" />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Allowed Roots Security Panel */}
      <div className="bg-white border border-[#E6E0D5] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FolderLock className="w-5 h-5 text-[#2D6A4F]" />
          <h3 className="font-semibold text-stone-900 text-sm">Configured Allowed Directory Roots</h3>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          LazyDesk AI strictly adheres to a zero-trust filesystem perimeter. Only directories explicitly configured here can be scanned, organized, or restored.
        </p>

        <div className="space-y-1.5 font-mono text-xs">
          {settings?.allowed_roots.map((r, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200 text-stone-700 flex items-center justify-between select-all"
            >
              <span className="truncate">{r}</span>
              <span className="text-[11px] text-emerald-700 font-sans font-semibold">Active</span>
            </div>
          ))}
        </div>

        {/* Add new allowed root */}
        <div className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={newRootInput}
            onChange={(e) => setNewRootInput(e.target.value)}
            placeholder="Add absolute directory path (e.g. D:\Projects\MessyFiles)"
            className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono bg-white focus:outline-hidden focus:ring-1 focus:ring-[#2D6A4F]"
          />
          <button
            type="button"
            onClick={handleAddRoot}
            className="px-4 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-[#E6E0D5] text-stone-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#2D6A4F]" />
            Add Allowed Root
          </button>
        </div>
      </div>

      {/* Trust & Privacy Model Documentation */}
      <div className="bg-[#FAF8F5] border border-[#E6E0D5] rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-stone-800 font-semibold text-sm">
          <ShieldCheck className="w-5 h-5 text-[#2D6A4F]" />
          <span>Local Privacy & Security Model</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600 leading-relaxed">
          <div className="space-y-1">
            <span className="font-semibold text-stone-900 block">• Zero Cloud Transmission</span>
            <p>Your documents, text extracts, and metadata never leave your localhost. No third-party AI APIs or tracking.</p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-stone-900 block">• Untrusted Model Principle</span>
            <p>AI suggestions are treated as untrusted strings. The backend enforces category whitelists and OS filename rules.</p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-stone-900 block">• Non-Destructive Operation</span>
            <p>Files are never overwritten or deleted. Suffixes like ` (1)` prevent data loss on name collisions.</p>
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-stone-900 block">• Hash-Backed Undo</span>
            <p>Every operation stores SHA-256 integrity checksums so accidental moves can be reverted reliably.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
