'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Scale, 
  BookOpen, 
  Calendar, 
  Activity, 
  PenTool, 
  BarChart3 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Tổng quan', href: '/dashboard/accounting', icon: Scale },
  { label: 'Hệ thống tài khoản (COA)', href: '/dashboard/accounting/chart-of-accounts', icon: BookOpen },
  { label: 'Nhật ký chung', href: '/dashboard/accounting/journals', icon: Activity },
  { label: 'Bút toán thủ công', href: '/dashboard/accounting/manual-entry', icon: PenTool },
  { label: 'Kỳ kế toán', href: '/dashboard/accounting/periods', icon: Calendar },
  { label: 'Báo cáo tài chính', href: '/dashboard/accounting/reports', icon: BarChart3 },
];

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-[#11100F] overflow-auto">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFE4E6]/30 dark:bg-[#5D1C34]/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Sub-Navigation Header Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 dark:bg-[#11100F]/80 border-b border-[#FFE4E6]/60 dark:border-[#3E3A35]/50 px-6 py-4 shrink-0 transition-colors duration-300">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-black text-[#4C243B] dark:text-[#EFE9E1] tracking-tight uppercase flex items-center gap-2.5">
              <Scale className="w-6 h-6 text-primary dark:text-[#A67D44] animate-pulse" />
              Hệ thống Kế toán Sổ cái
            </h1>
            <p className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mt-1">
              Phân hệ quản trị tài chính doanh nghiệp chuẩn Thông tư 133
            </p>
          </div>

          {/* Sub tabs list */}
          <nav className="flex items-center gap-1 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link key={tab.href} href={tab.href} className="relative block shrink-0">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative z-10 cursor-pointer",
                    isActive
                      ? "text-[#BE185D] dark:text-[#EFE9E1]"
                      : "text-slate-500 hover:text-[#BE185D] dark:text-[#CDBCAB]/80 dark:hover:text-[#EFE9E1]"
                  )}>
                    <tab.icon className={cn(
                      "w-4 h-4 transition-colors",
                      isActive ? "text-[#BE185D] dark:text-[#A67D44]" : "text-slate-400 dark:text-[#CDBCAB]/60"
                    )} />
                    <span>{tab.label}</span>

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
