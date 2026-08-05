'use client';

import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  limit?: number;
  priorityFilter?: 'critical' | 'high' | 'medium' | 'low';
}

export function NextBestActionsPanel({ limit = 10, priorityFilter }: Props) {
  const actions = [
    {
      id: '1',
      customer: 'Nguyễn Văn A',
      title: 'Gọi điện chăm sóc báo giá',
      description: 'Khách nhận báo giá 5 ngày trước chưa phản hồi',
      priority: 'high' as const,
      confidenceScore: 0.85,
    },
    {
      id: '2',
      customer: 'Trần Thị B',
      title: 'Khách không hài lòng - Liên hệ ngay',
      description: 'NPS 4/10. Lý do: "Giá hơi cao"',
      priority: 'critical' as const,
      confidenceScore: 1.0,
    },
  ];

  const filteredActions = actions
    .filter(a => !priorityFilter || a.priority === priorityFilter)
    .slice(0, limit);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shadow-sm animate-pulse">
            <AlertTriangle className="h-3 w-3" /> Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 shadow-sm">
            <Sparkles className="h-3 w-3" /> High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400 border border-yellow-200/60 dark:border-yellow-900/40 shadow-sm">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
            Low
          </span>
        );
    }
  };

  return (
    <div className="space-y-3.5">
      {filteredActions.map((action) => (
        <div
          key={action.id}
          className="p-4 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl hover:border-cyan-300 dark:hover:border-cyan-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(8,145,178,0.1)] transition-all duration-300 group"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                {getPriorityBadge(action.priority)}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-2 py-0.5 rounded-full">
                  AI Confidence: {Math.round(action.confidenceScore * 100)}%
                </span>
              </div>
              <div className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                {action.customer}
              </div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {action.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {action.description}
              </div>
            </div>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-cyan-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0">
              <span>Thực hiện</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
