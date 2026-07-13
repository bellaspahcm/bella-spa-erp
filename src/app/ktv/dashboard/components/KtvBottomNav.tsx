'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, DollarSign, Trophy } from 'lucide-react';

export function KtvBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/ktv/dashboard',
      label: 'Lịch ca',
      icon: Clock,
    },
    {
      href: '/ktv/earnings',
      label: 'Thu nhập',
      icon: DollarSign,
    },
    {
      href: '/ktv/leaderboard',
      label: 'Vinh danh',
      icon: Trophy,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1C1B19]/95 backdrop-blur-xl border-t border-slate-100 dark:border-[#3E3A35] px-8 py-4 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={
              isActive
                ? "text-rose-700 dark:text-[#A67D44] flex flex-col items-center gap-1 transition-colors"
                : "text-slate-500 dark:text-[#D4C5B6] hover:text-rose-700 dark:hover:text-[#A67D44] flex flex-col items-center gap-1 transition-colors"
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
