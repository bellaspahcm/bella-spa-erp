'use client';

import React from 'react';
import { ManagedLead } from '@/platform/lead-engine';
import { Clock, User, ShieldAlert, CheckCircle2, ArrowRightLeft, X } from 'lucide-react';

interface LeadTimelineDrawerProps {
  lead: ManagedLead | null;
  onClose: () => void;
}

export function LeadTimelineDrawer({ lead, onClose }: LeadTimelineDrawerProps) {
  if (!lead) return null;

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'lead_assigned':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'lead_accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'sla_timer_started':
        return <Clock className="w-4 h-4 text-violet-500" />;
      case 'sla_breached':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'lead_rotated':
        return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
      case 'lead_converted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-600" />
              Lịch Sử Timeline Lead
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lead.fullName} • {lead.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Lead Info Summary */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Sale phụ trách hiện tại:</span>
            <span className="font-semibold text-violet-600 dark:text-violet-400">{lead.currentSaleName || 'Chưa phân'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Trạng thái:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase">{lead.state}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Số lần chưa nghe máy:</span>
            <span className="font-semibold text-amber-600">{lead.noAnswerCount} lần</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Số vòng đã xoay:</span>
            <span className="font-semibold text-purple-600">{lead.rotationCount} vòng</span>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(!lead.auditTimeline || lead.auditTimeline.length === 0) ? (
            <div className="text-center py-10 text-xs text-slate-400">Chưa có lịch sử sự kiện</div>
          ) : (
            lead.auditTimeline.map((event, idx) => (
              <div key={event.id || idx} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-1">
                <div className="absolute -left-[9px] top-0 bg-white dark:bg-slate-900 p-0.5 rounded-full">
                  {getEventIcon(event.eventType)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{event.actorName}</span>
                  <span>{new Date(event.timestamp).toLocaleString('vi-VN')}</span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {event.description}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
