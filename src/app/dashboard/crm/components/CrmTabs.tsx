'use client';

import { Bell, Clock, Gift, Settings } from 'lucide-react';
import type { CrmTabId } from '../types';

interface CrmTabsProps {
  activeTab: CrmTabId;
  onTabChange: (tab: CrmTabId) => void;
}

const tabs: Array<{ id: CrmTabId; label: string; icon: typeof Settings }> = [
  { id: 'overview', label: 'Tổng quan & cài đặt Zalo', icon: Settings },
  { id: 'reminders', label: 'Thông báo nhắc hẹn', icon: Bell },
  { id: 'marketing', label: 'Sinh nhật & chiến dịch', icon: Gift },
  { id: 'logs', label: 'Nhật ký gửi tin', icon: Clock },
];

export function CrmTabs({ activeTab, onTabChange }: CrmTabsProps) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
      <div className="flex min-w-max items-center gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
