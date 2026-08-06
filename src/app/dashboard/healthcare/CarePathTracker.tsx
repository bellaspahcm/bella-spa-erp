'use client';

import React from 'react';
import { Route, CheckCircle2, ChevronRight, Sparkles, Calendar, Layers } from 'lucide-react';
import type { CarePathStep } from '@/modules/bella-healthcare/types/encounter-aggregate';

export interface CarePathTrackerProps {
  readonly title?: string;
  readonly steps: CarePathStep[];
}

export function CarePathTracker({
  title = 'Lộ trình Điều trị Implant Chuyên sâu (Care Path)',
  steps,
}: CarePathTrackerProps) {
  const currentStep = steps.find((s) => s.status === 'in_progress') || steps[0];

  return (
    <div className="p-6 rounded-[28px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Route className="w-5 h-5" />
            </span>
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Theo dõi tiến trình phác đồ kỹ thuật cao nhiều đợt — AI nhận diện vị trí hiện tại
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Giai đoạn hiện tại: {currentStep?.title} (Giai đoạn {currentStep?.stepNumber}/{steps.length})
          </span>
        </div>
      </div>

      {/* Timeline Steps Track */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 overflow-x-auto p-1">
        {steps.map((step) => {
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in_progress';

          return (
            <div
              key={step.stepNumber}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
                  : isInProgress
                  ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-md ring-2 ring-indigo-500/20'
                  : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center border border-indigo-500/20">
                    {step.stepNumber}
                  </span>
                  {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {isInProgress && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
                  )}
                </div>

                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight mb-1">
                  {step.title}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {step.subtitle}
                </p>
              </div>

              {step.date && (
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{step.date}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
