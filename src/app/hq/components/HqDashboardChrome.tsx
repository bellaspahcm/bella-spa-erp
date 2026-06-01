'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { ExternalLink, LogOut, PieChart, Plus, RefreshCw } from 'lucide-react';
import ThemeToggle from '@/components/common/ThemeToggle';
import type { CurrentUser } from '@/types/domain';

export type HqDashboardTab = 'branches' | 'franchise' | 'clearing' | 'transfers' | 'audit' | 'subscriptions' | 'services';

interface HqDashboardHeaderProps {
  currentUser: CurrentUser;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

const tabs: { key: HqDashboardTab; label: string }[] = [
  { key: 'branches', label: 'Chi nhánh Spa' },
  { key: 'franchise', label: 'Nhượng quyền & Royalty' },
  { key: 'clearing', label: 'Bù trừ liên chi nhánh' },
  { key: 'transfers', label: 'Cung ứng & Chuyển kho' },
  { key: 'audit', label: 'Nhật ký hệ thống' },
  { key: 'subscriptions', label: 'Thuê bao & Hạn ngạch' },
  { key: 'services', label: 'Liệu trình chuẩn' },
];

export function HqDashboardHeader({
  currentUser,
  loading,
  onRefresh,
  onLogout,
}: HqDashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-[#11100F]/80 border-b border-slate-100 dark:border-[#3E3A35] px-4 sm:px-6 py-3 md:py-4 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 transition-colors duration-300 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="drop-shadow-lg"
        >
          <Image src="/logo.png" alt="Bella Spa Logo" width={120} height={40} className="h-10 w-auto object-contain" priority />
        </motion.div>
        <div className="h-6 w-px bg-slate-200 dark:bg-[#3E3A35]" />
        <div>
          <h1 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] tracking-wider uppercase flex items-center gap-1.5">
            Bella Spa Headquarter
            <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">HQ Portal</span>
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-[#CDBCAB] font-bold uppercase tracking-wider">Hệ thống Quản trị Cấp cao</p>
        </div>
      </div>

      <div className="w-full max-w-[420px] mx-auto px-1 grid grid-cols-1 gap-3 md:max-w-none md:mx-0 md:px-0 md:w-auto md:flex md:items-center md:gap-2 md:flex-wrap">
        <div className="w-full md:w-auto flex items-center justify-start gap-2 bg-white/90 dark:bg-[#1C1B19]/90 border border-slate-100 dark:border-[#3E3A35] rounded-2xl md:rounded-full py-2 md:py-1 pl-3 pr-4 md:pl-2 md:pr-3 shadow-sm transition-colors duration-300">
          <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-[#5D1C34] flex items-center justify-center font-black text-[10px] text-primary dark:text-[#EFE9E1]">
            {currentUser.full_name?.charAt(0) || 'A'}
          </div>
          <div className="text-left leading-none">
            <p className="text-[10px] font-black text-slate-800 dark:text-[#EFE9E1] truncate max-w-[100px]">{currentUser.full_name || 'Super Admin'}</p>
            <span className="text-[7px] font-black text-primary dark:text-rose-400 uppercase tracking-widest">Cấp cao</span>
          </div>
        </div>

        <div className="w-full md:w-auto grid grid-cols-2 gap-2.5 md:gap-2">
          <a
            href="/hq/financial-overview"
            className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider px-3 md:px-3.5 py-2.5 md:py-2 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <PieChart size={10} className="md:w-3.5 md:h-3.5" />
            Tổng quan
          </a>
          <a
            href="/dashboard"
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider px-3 md:px-3.5 py-2.5 md:py-2 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <ExternalLink size={10} className="md:w-3.5 md:h-3.5" />
            Spa chính
          </a>
          <a
            href="/signup"
            className="col-span-2 flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-650 hover:from-rose-600 hover:to-pink-700 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider px-3 md:px-3.5 py-3 md:py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Plus size={10} className="md:w-3.5 md:h-3.5" />
            Đăng ký Chi nhánh
          </a>
        </div>

        <div className="w-full md:w-auto grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 md:flex md:gap-1.5 md:flex-nowrap">
          <div className="min-w-0 md:w-40 md:shrink-0">
            <ThemeToggle />
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-11 h-11 md:w-8 md:h-8 rounded-xl md:rounded-lg border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#1C1B19] flex items-center justify-center text-slate-500 dark:text-[#CDBCAB] hover:text-primary dark:hover:text-primary transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="Đồng bộ lại"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
          </button>
          <button
            onClick={onLogout}
            className="w-11 h-11 md:w-8 md:h-8 rounded-xl md:rounded-lg border border-rose-100 dark:border-[#3E3A35] bg-rose-50 dark:bg-[#5D1C34]/30 hover:bg-rose-100 dark:hover:bg-[#5D1C34]/50 flex items-center justify-center text-rose-500 dark:text-rose-400 transition-all active:scale-95 shadow-sm"
            title="Đăng xuất"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

interface HqDashboardTabsProps {
  activeTab: HqDashboardTab;
  onTabChange: (tab: HqDashboardTab) => void;
}

export function HqDashboardTabs({ activeTab, onTabChange }: HqDashboardTabsProps) {
  return (
    <div className="flex justify-center w-full px-4 sm:px-6">
      <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-white/95 border border-slate-100 backdrop-blur-md rounded-[2rem] md:rounded-3xl p-1.5 shadow-sm max-w-7xl w-full gap-1 sm:gap-1.5 whitespace-nowrap scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 shrink-0 py-2.5 px-2.5 sm:px-4 lg:px-5 rounded-2xl font-black text-[9px] sm:text-[10px] lg:text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap text-center ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
