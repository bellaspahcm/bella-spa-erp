'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  BookOpen,
  Calendar,
  Activity,
  PenTool,
  BarChart3,
  GitCompareArrows,
  ClipboardCheck,
  ShieldCheck,
  ChevronDown,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Tổng quan', href: '/dashboard/accounting', icon: Scale },
  { label: 'Sức khỏe sổ', href: '/dashboard/accounting/health', icon: ShieldCheck },
  { label: 'Hệ thống tài khoản (COA)', href: '/dashboard/accounting/chart-of-accounts', icon: BookOpen },
  { label: 'Nhật ký chung', href: '/dashboard/accounting/journals', icon: Activity },
  { label: 'Bút toán thủ công', href: '/dashboard/accounting/manual-entry', icon: PenTool },
  { label: 'Kỳ kế toán', href: '/dashboard/accounting/periods', icon: Calendar },
  { label: 'Sẵn sàng dữ liệu', href: '/dashboard/accounting/readiness', icon: ClipboardCheck },
  { label: 'Đối soát chéo', href: '/dashboard/accounting/reconciliation', icon: GitCompareArrows },
  { label: 'Đối soát lương', href: '/dashboard/accounting/salary-reconciliation', icon: GitCompareArrows },
  { label: 'Báo cáo tài chính', href: '/dashboard/accounting/reports', icon: BarChart3 },
];

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-[#11100F] overflow-auto">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFE4E6]/30 dark:bg-[#5D1C34]/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Sub-Navigation Header Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 dark:bg-[#11100F]/80 border-b border-[#FFE4E6]/60 dark:border-[#3E3A35]/50 px-6 py-4 shrink-0 transition-colors duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 max-w-7xl mx-auto flex-wrap">
          <div className="w-full lg:w-auto">
            <h1 className="text-2xl font-black text-[#4C243B] dark:text-[#EFE9E1] tracking-tight uppercase flex items-center gap-2.5">
              <Scale className="w-6 h-6 text-primary dark:text-[#A67D44] animate-pulse" />
              Hệ thống Kế toán Sổ cái
            </h1>
            <p className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mt-1">
              Phân hệ quản trị tài chính doanh nghiệp chuẩn Thông tư 133
            </p>
          </div>

          {/* Mobile Navigation Dropdown Select */}
          <div className="block md:hidden w-full mt-2 relative" ref={dropdownRef}>
            <label className="text-[10px] font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest block mb-2">Danh mục phân hệ</label>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300 bg-white dark:bg-[#1E1C1A] border-[#FFE4E6] dark:border-[#3E3A35] text-slate-800 dark:text-[#EFE9E1] shadow-sm hover:shadow-md active:scale-[0.98] outline-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const currentTab = tabs.find(t => t.href === pathname) || tabs[0];
                  const Icon = currentTab.icon;
                  return (
                    <>
                      <Icon className="w-4 h-4 text-[#BE185D] dark:text-[#A67D44] shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider truncate">
                        {currentTab.label}
                      </span>
                    </>
                  );
                })()}
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-slate-400 dark:text-[#CDBCAB]/60 transition-transform duration-300 shrink-0",
                isOpen && "rotate-180 text-[#BE185D] dark:text-[#A67D44]"
              )} />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute left-0 right-0 z-50 mt-2 bg-white dark:bg-[#1E1C1A] border border-[#FFE4E6] dark:border-[#3E3A35] rounded-2xl shadow-xl overflow-hidden py-2"
                >
                  <div className="max-h-[280px] overflow-y-auto">
                    {tabs.map((tab) => {
                      const isActive = pathname === tab.href;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.href}
                          type="button"
                          onClick={() => {
                            router.push(tab.href);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors",
                            isActive
                              ? "bg-rose-50/50 dark:bg-[#5D1C34]/20 text-[#BE185D] dark:text-[#EFE9E1] font-black"
                              : "text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#11100F] hover:text-slate-900 dark:hover:text-[#EFE9E1]"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={cn(
                              "w-4 h-4 transition-colors shrink-0",
                              isActive ? "text-[#BE185D] dark:text-[#A67D44]" : "text-slate-400 dark:text-[#CDBCAB]/60"
                            )} />
                            <span className="text-xs font-bold uppercase tracking-wider truncate">{tab.label}</span>
                          </div>
                          {isActive && (
                            <Check className="w-4 h-4 text-[#BE185D] dark:text-[#A67D44] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex md:flex-wrap items-center gap-1.5 mt-6 lg:mt-0 w-full lg:w-auto">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link key={tab.href} href={tab.href} className="relative block shrink-0 w-full md:w-auto">
                  <div className={cn(
                    "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 cursor-pointer w-full justify-start",
                    isActive
                      ? "text-[#BE185D] dark:text-[#EFE9E1]"
                      : "text-slate-500 hover:text-[#BE185D] dark:text-[#CDBCAB]/80 dark:hover:text-[#EFE9E1]"
                  )}>
                    <tab.icon className={cn(
                      "w-4 h-4 transition-colors shrink-0",
                      isActive ? "text-[#BE185D] dark:text-[#A67D44]" : "text-slate-400 dark:text-[#CDBCAB]/60"
                    )} />
                    <span className="truncate">{tab.label}</span>
 
                    {isActive && (
                      <motion.div
                        layoutId="active-sub-tab"
                        className="absolute inset-0 bg-white dark:bg-[#5D1C34]/40 border border-[#FFE4E6] dark:border-[#A67D44]/30 rounded-xl shadow-sm -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content body container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full relative z-10">
        {children}
      </main>
    </div>
  );
}
