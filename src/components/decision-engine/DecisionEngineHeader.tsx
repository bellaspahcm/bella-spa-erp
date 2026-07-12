'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, FileText, Activity, History } from 'lucide-react';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';

const getThemeColors = (moduleKey: string | null) => {
  const normKey = moduleKey === 'babycare' ? 'baby_care' : (moduleKey || 'baby_care');
  if (normKey === 'beauty_spa') {
    return {
      primary: 'emerald',
      gradient: 'from-emerald-500 to-teal-600',
      activeTab: 'border-primary text-primary dark:text-primary font-bold',
      inactiveTab: 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    };
  } else if (normKey === 'industrial_cleaning') {
    return {
      primary: 'indigo',
      gradient: 'from-indigo-500 to-blue-600',
      activeTab: 'border-primary text-primary dark:text-primary font-bold',
      inactiveTab: 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200',
      badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
    };
  } else {
    return {
      primary: 'rose',
      gradient: 'from-rose-500 to-pink-600',
      activeTab: 'border-primary text-primary dark:text-primary font-bold',
      inactiveTab: 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
    };
  }
};

export default function DecisionEngineHeader() {
  const pathname = usePathname();
  const { tenantModuleKey } = useTenantModuleKey();
  const theme = getThemeColors(tenantModuleKey);

  const tabs = [
    {
      name: 'Quản lý quy tắc luật',
      href: '/dashboard/rules',
      icon: FileText,
      pattern: /^\/dashboard\/rules(\/|$)/,
    },
    {
      name: 'Nhật ký quyết định',
      href: '/dashboard/decision-engine/audit',
      icon: History,
      pattern: /^\/dashboard\/decision-engine\/audit(\/|$)/,
    },
    {
      name: 'Chỉ số vận hành',
      href: '/dashboard/admin/booking-engine',
      icon: Activity,
      pattern: /^\/dashboard\/admin\/booking-engine(\/|$)/,
    },
  ];

  return (
    <div className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/50 pt-8 px-6 pb-0">
      <div className="container mx-auto space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${theme.gradient} text-white shadow-md`}>
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Hệ thống Luật nghiệp vụ
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cấu hình luật nghiệp vụ tự động và giám sát kết quả vận hành thời gian thực
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-6 overflow-x-auto custom-scrollbar" aria-label="Decision Engine Tabs">
          {tabs.map((tab) => {
            const isActive = tab.pattern.test(pathname);
            const TabIcon = tab.icon;

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`
                  flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-xs tracking-wide transition-all whitespace-nowrap
                  ${isActive ? theme.activeTab : theme.inactiveTab}
                `}
              >
                <TabIcon className="h-4 w-4" />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
