import React from 'react';

interface CategoryBadgeProps {
  category: string | null | undefined;
}

const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
  Documents: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Education: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  Work: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  Finance: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  Projects: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Images: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  Notes: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  Other: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' },
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => {
  const cat = category || 'Other';
  const style = categoryStyles[cat] || categoryStyles.Other;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {cat}
    </span>
  );
};
