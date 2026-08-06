'use client';

import React, { useState } from 'react';
import { Terminal, Activity, Zap, Filter, Code2, Check, RefreshCw } from 'lucide-react';
import type { DomainEventStreamItem } from '@/modules/bella-healthcare/types/encounter-aggregate';

export interface EventStreamViewerProps {
  readonly events: DomainEventStreamItem[];
  readonly onSimulateEvent?: () => void;
}

export function EventStreamViewer({ events, onSimulateEvent }: EventStreamViewerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEvents = events.filter((e) =>
    selectedCategory === 'all' ? true : e.category === selectedCategory
  );

  const getCategoryBadge = (category: DomainEventStreamItem['category']) => {
    switch (category) {
      case 'encounter':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md">ENCOUNTER</span>;
      case 'clinical':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-md">CLINICAL</span>;
      case 'prescription':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-md">PRESCRIPTION</span>;
      case 'resource':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">RESOURCE</span>;
      case 'billing':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">BILLING</span>;
    }
  };

  const handleCopyPayload = (evt: DomainEventStreamItem) => {
    navigator.clipboard.writeText(JSON.stringify(evt, null, 2));
    setCopiedId(evt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 rounded-[28px] bg-slate-950 text-white border border-slate-800 shadow-2xl space-y-5 font-sans relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Terminal className="w-5 h-5" />
            </span>
            Event Sourcing Log & Real-time Event Stream
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Nhật ký sự kiện miền (Domain Event Log) phát tán qua EventBus — Phục vụ Developer Debugging & AI Context Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {events.length} Events Logged
          </span>
          {onSimulateEvent && (
            <button
              onClick={onSimulateEvent}
              className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-850 hover:bg-slate-800 text-white border border-slate-750 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'encounter', label: 'Encounter' },
          { key: 'clinical', label: 'Clinical' },
          { key: 'prescription', label: 'Prescription' },
          { key: 'resource', label: 'Resource' },
          { key: 'billing', label: 'Billing' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key)}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border transition-all whitespace-nowrap ${
              selectedCategory === tab.key
                ? 'bg-teal-500 text-slate-950 border-teal-400 font-black shadow-md shadow-teal-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event Stream Terminal Window */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 max-h-[320px] overflow-y-auto space-y-2.5 scrollbar-thin font-mono text-xs">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-850 hover:border-slate-750 flex items-start justify-between gap-3 group transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-slate-500">{evt.timestamp}</span>
                  {getCategoryBadge(evt.category)}
                  <span className="text-xs font-bold text-teal-400">{evt.eventName}</span>
                </div>
                <p className="text-xs text-slate-200 font-sans font-medium">{evt.description}</p>
                <span className="text-[10px] text-slate-500 font-sans block">Tác nhân: {evt.actor}</span>
              </div>

              <button
                onClick={() => handleCopyPayload(evt)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-all shrink-0"
                title="Copy Event JSON"
              >
                {copiedId === evt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-slate-500 font-sans text-xs">
            Chưa có event nào trong danh mục chọn
          </div>
        )}
      </div>
    </div>
  );
}
