import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { FolderTree, Bot, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import type { AIStatus } from '../types';

export const Navbar: React.FC = () => {
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getAIStatus();
      setAiStatus(res);
    } catch {
      // offline
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E6E0D5] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-[#1B4332] flex items-center justify-center text-white shadow-xs group-hover:bg-[#2D6A4F] transition">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-stone-900 text-lg tracking-tight">LazyDesk</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-[#EDF7F1] text-[#1B4332] border border-[#D8F3DC]">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 font-medium">Local-first file organizer</p>
              </div>
            </NavLink>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EDF7F1] text-[#1B4332]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/scan"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EDF7F1] text-[#1B4332]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`
                }
              >
                Scan & Organize
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EDF7F1] text-[#1B4332]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`
                }
              >
                Operation History
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EDF7F1] text-[#1B4332]'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`
                }
              >
                Settings & Model
              </NavLink>
            </nav>
          </div>

          {/* AI Status & Local Privacy Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E6E0D5] text-xs text-stone-600">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>100% Local Inference</span>
            </div>

            {aiStatus && (
              <NavLink
                to="/settings"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                  aiStatus.mock_mode
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    : aiStatus.running
                    ? 'bg-[#EDF7F1] text-[#1B4332] border-[#D8F3DC] hover:bg-[#D8F3DC]/40'
                    : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                }`}
                title={aiStatus.message}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiStatus.mock_mode
                      ? 'bg-amber-500 animate-pulse'
                      : aiStatus.running
                      ? 'bg-emerald-500'
                      : 'bg-stone-400'
                  }`}
                />
                <Bot className="w-3.5 h-3.5" />
                <span className="truncate max-w-[130px]">
                  {aiStatus.mock_mode
                    ? 'Mock AI Active'
                    : aiStatus.running
                    ? aiStatus.active_model
                    : 'Ollama Offline'}
                </span>
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
