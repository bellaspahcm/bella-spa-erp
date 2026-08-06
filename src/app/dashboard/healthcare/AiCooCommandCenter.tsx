'use client';

import React from 'react';
import { Bot, Zap, ArrowRight, AlertCircle, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import type { AiCooAction } from '@/modules/bella-healthcare/types/encounter-aggregate';

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
        return <span className="px-2 py-0.5 text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-md">HIGH PRIORITY</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md">MEDIUM</span>;
      case 'info':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md">INFO</span>;
    }
  };

  return (
    <div className="p-6 rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-850 to-teal-950 text-white border border-slate-800 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-black flex items-center justify-center shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
                AI COO Agent Active
              </span>
            </div>
            <h3 className="text-base font-black text-white leading-tight">
              Executive Command Center — Gợi ý Hành động Thông minh
            </h3>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          {actions.length} Gợi ý trực tiếp
        </span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((act) => (
          <div
            key={act.id}
            className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 transition-all flex flex-col justify-between gap-3 text-left group"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                {getPriorityBadge(act.priority)}
                <span className="text-[10px] font-bold text-slate-400 capitalize">{act.category}</span>
              </div>
              <h4 className="font-extrabold text-xs text-white group-hover:text-teal-300 transition-colors leading-tight">
                {act.title}
              </h4>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                {act.description}
              </p>
            </div>

            <button
              onClick={() => onExecuteAction && onExecuteAction(act.id, act.actionType)}
              className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-1"
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
