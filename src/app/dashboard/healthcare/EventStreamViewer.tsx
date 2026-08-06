'use client';

import React, { useState } from 'react';
import { Terminal, Zap, Code2, Check, Cpu } from 'lucide-react';
import type { DomainEventStreamItem, OutboxEntry } from '@/modules/bella-healthcare/contexts/shared/domain-models';

export interface EventStreamViewerProps {
  readonly events: DomainEventStreamItem[];
  readonly outbox: OutboxEntry[];
  readonly activeSagasCount: number;
  readonly onSimulateEvent?: () => void;
}

export function EventStreamViewer({ events, outbox, activeSagasCount, onSimulateEvent }: EventStreamViewerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEvents = events.filter((e) =>
    selectedCategory === 'all' ? true : e.category === selectedCategory
  );

  const getCategoryBadge = (category: DomainEventStreamItem['category']) => {
    switch (category) {
      case 'encounter':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md">ENCOUNTER</span>;
      case 'clinical':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-teal-50 text-teal-700 border border-teal-200/60 rounded-md">CLINICAL</span>;
      case 'prescription':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200/60 rounded-md">PRESCRIPTION</span>;
      case 'resource':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md">RESOURCE</span>;
      case 'billing':
        return <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md">BILLING</span>;
    }
  };

  const handleCopyPayload = (evt: DomainEventStreamItem) => {
    navigator.clipboard.writeText(JSON.stringify(evt, null, 2));
    setCopiedId(evt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 rounded-[28px] bg-white text-slate-900 border border-slate-200/80 shadow-md space-y-5 font-sans relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="text-left">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/60">
              <Terminal className="w-5 h-5" />
            </span>
            Event Sourcing Log & Transactional Outbox
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Nhật ký sự kiện miền (Domain Event Log) và trạng thái Outbox gửi tin cậy đi qua EventBus
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Sagas Badge */}
          <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-purple-50 text-purple-750 border border-purple-200/60 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            {activeSagasCount} Active Sagas
          </span>

          {/* Outbox Pending Status */}
          <span className="px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5">
            Outbox: {outbox.filter((o) => o.status === 'pending').length} pending / {outbox.filter((o) => o.status === 'published').length} published
          </span>

          {onSimulateEvent && (
            <button
              onClick={onSimulateEvent}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
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
                ? 'bg-teal-600 text-white border-teal-500 font-bold shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event Stream Terminal Window */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 max-h-[320px] overflow-y-auto space-y-2.5 scrollbar-thin font-mono text-xs">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-start justify-between gap-3 group transition-all text-left"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-slate-400">{evt.timestamp}</span>
                  {getCategoryBadge(evt.category)}
                  <span className="text-xs font-bold text-teal-700">{evt.eventName}</span>
                </div>
                <p className="text-xs text-slate-800 font-sans font-semibold">{evt.description}</p>
                <span className="text-[10px] text-slate-500 font-sans block">Tác nhân: {evt.actor}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Outbox status marker */}
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                  Outbox: OK
                </span>
                <button
                  onClick={() => handleCopyPayload(evt)}
                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all shrink-0"
                  title="Copy Event JSON"
                >
                  {copiedId === evt.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-slate-400 font-sans text-xs">
            Chưa có event nào trong danh mục chọn
          </div>
        )}
      </div>
    </div>
  );
}
