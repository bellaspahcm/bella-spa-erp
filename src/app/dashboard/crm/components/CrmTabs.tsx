'use client';

import { Bell, Clock, Gift, Settings } from 'lucide-react';
import type { CrmTabId } from '../types';

interface CrmTabsProps {
  activeTab: CrmTabId;
  onTabChange: (tab: CrmTabId) => void;
}
const tabs: Array<{ id: CrmTabId; label: string; icon: typeof Settings }> = [
  { id: 'overview', label: 'TỔNG QUAN & CÀI ĐẶT ZALO', icon: Settings },
  { id: 'reminders', label: 'THÔNG BÁO NHẮC HẸN', icon: Bell },
  { id: 'marketing', label: 'SINH NHẬT & CHIẾN DỊCH', icon: Gift },
  { id: 'logs', label: 'NHẬT KÝ GỬI TIN', icon: Clock },
];

export function CrmTabs({ activeTab, onTabChange }: CrmTabsProps) {
  return (
    <div className="flex border-b border-rose-100 bg-white p-2.5 rounded-[1.8rem] shadow-sm gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-[1.25rem] transition-all duration-300 font-black text-xs uppercase tracking-wider ${
            activeTab === tab.id
              ? 'bg-primary text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <tab.icon className="w-4.5 h-4.5" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
