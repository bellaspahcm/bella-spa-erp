'use client';

import React from 'react';
import { Clock, CheckCircle2, AlertCircle, ArrowRight, Activity, PlusCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { TimelineStep } from '@/modules/bella-healthcare/contexts/shared/domain-models';

export interface ClinicalTimelineProps {
  readonly steps: TimelineStep[];
  readonly onAddStep?: (title: string) => void;
}

export function ClinicalTimeline({ steps, onAddStep }: ClinicalTimelineProps) {
  const totalDurationMinutes = steps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const bottlenecksCount = steps.filter((s) => s.isBottleneck).length;

  return (
    <div className="p-6 rounded-[28px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-xl space-y-5">
      {/* Timeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </span>
            Clinical Timeline & SLA Bottleneck Monitor
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Dòng thời gian vận hành đợt khám và phát hiện nút thắt cổ chai (Bottlenecks) theo SLA y tế
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {bottlenecksCount > 0 ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {bottlenecksCount} Nút thắt SLA (&gt;20p)
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Đạt chuẩn SLA 100%
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Tổng thời gian: {totalDurationMinutes} phút
          </span>
        </div>
      </div>

      {/* Horizontal Steps Track */}
      <div className="relative overflow-x-auto pb-4 pt-2 scrollbar-thin">
        <div className="flex items-start gap-4 min-w-[720px] p-2">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';

            return (
              <div key={step.id} className="flex-1 relative flex flex-col group">
                {/* Step Connector Line */}
                {!isLast && (
                  <div
                    className={`absolute top-5 left-1/2 w-full h-1 z-0 transition-colors ${
                      isCompleted ? 'bg-teal-500 dark:bg-teal-600' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}

                {/* Step Circle & Time */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md transition-all duration-300 ${
                      isCompleted
                        ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-500/20'
                        : isCurrent
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/20 ring-4 ring-amber-500/20 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>

                  <span className="text-[11px] font-mono font-extrabold text-slate-800 dark:text-slate-200 mt-2 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    {step.time}
                  </span>
                </div>

                {/* Step Content Card */}
                <div
                  className={`mt-3 p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                    step.isBottleneck
                      ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/40 shadow-sm'
                      : isCurrent
                      ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40'
                      : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      {step.title}
                    </span>
                    {step.isBottleneck && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500 text-white uppercase">
                        SLA Alert
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Thực hiện bởi: <b className="text-slate-700 dark:text-slate-300">{step.actor}</b>
                  </p>

                  {step.durationMinutes !== undefined && (
                    <div className="mt-2 text-[10px] font-extrabold flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Activity className="w-3 h-3 text-teal-500" />
                      <span>Thời lượng: {step.durationMinutes} phút</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
