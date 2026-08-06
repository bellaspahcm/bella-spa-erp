'use client';

import React from 'react';
import { Bot, Zap, ArrowRight } from 'lucide-react';
import type { AiCooAction } from '@/modules/bella-healthcare/contexts/shared/domain-models';

export interface AiCooCommandCenterProps {
  readonly actions: AiCooAction[];
  readonly onExecuteAction?: (actionId: string, type: AiCooAction['actionType']) => void;
}

export function AiCooCommandCenter({
  actions,
  onExecuteAction,
}: AiCooCommandCenterProps) {
  const getPriorityBadge = (priority: AiCooAction['priority']) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200/60 rounded-md">ƯU TIÊN CAO</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md">TRUNG BÌNH</span>;
      case 'info':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md">THÔNG TIN</span>;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'chair':
        return 'Ghế điều trị';
      case 'patient_wait':
        return 'Thời gian chờ';
      case 'capacity':
        return 'Công suất vận hành';
      default:
        return category;
    }
  };

  return (
    <div className="p-6 rounded-[28px] bg-white text-slate-900 border border-slate-200/80 shadow-md space-y-5 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-black flex items-center justify-center shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-200/50">
                AI COO Đang hoạt động
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 leading-tight mt-0.5">
              Executive Command Center — Gợi ý Hành động Thông minh
            </h3>
          </div>
        </div>

        <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          {actions.length} Gợi ý trực tiếp
        </span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((act) => (
          <div
            key={act.id}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-teal-500/40 transition-all flex flex-col justify-between gap-3 text-left group"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {getPriorityBadge(act.priority)}
                <span className="text-[10px] font-bold text-slate-500">{getCategoryLabel(act.category)}</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-teal-700 transition-colors leading-tight">
                {act.title}
              </h4>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                {act.description}
              </p>
            </div>

            <button
              onClick={() => onExecuteAction && onExecuteAction(act.id, act.actionType)}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-1"
            >
              <span>{act.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
