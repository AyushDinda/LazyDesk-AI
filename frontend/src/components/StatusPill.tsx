import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, RotateCcw, XCircle } from 'lucide-react';

interface StatusPillProps {
  status: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'success':
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Success
        </span>
      );
    case 'undone':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
          <RotateCcw className="w-3 h-3 text-indigo-600" />
          Restored (Undone)
        </span>
      );
    case 'partially_failed':
    case 'partially_undone':
    case 'renamed_to_avoid_collision':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          {status.replace(/_/g, ' ')}
        </span>
      );
    case 'failed':
    case 'undo_failed':
    case 'source_missing':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          {status.replace(/_/g, ' ')}
        </span>
      );
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-600" />
          Ready
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
          <Clock className="w-3 h-3 text-stone-500" />
          {status}
        </span>
      );
  }
};
