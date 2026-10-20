import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { ScanFolder } from './pages/ScanFolder';
import { ReviewSuggestions } from './pages/ReviewSuggestions';
import { PreviewOperations } from './pages/PreviewOperations';
import { OperationHistory } from './pages/OperationHistory';
import { SettingsPage } from './pages/SettingsPage';
import { FolderTree } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 selection:bg-[#D8F3DC] selection:text-[#1B4332]">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<ScanFolder />} />
            <Route path="/review/:sessionId" element={<ReviewSuggestions />} />
            <Route path="/preview/:sessionId" element={<PreviewOperations />} />
            <Route path="/history" element={<OperationHistory />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Clean, premium footer */}
        <footer className="border-t border-[#E6E0D5] bg-[#FFFFFF] py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-[#2D6A4F]" />
              <span className="font-semibold text-stone-800">LazyDesk AI</span>
              <span>— Local AI File Organizer for Hacktoberfest 2026 Week 3</span>
            </div>

            <div className="flex items-center gap-4">
              <span>Open-Weight AI • Slow and Steady</span>
              <span>•</span>
              <span>100% Local Processing</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
