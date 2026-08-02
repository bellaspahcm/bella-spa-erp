'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CalendarRange, Wallet, UserSquare2 } from 'lucide-react';

export function PartnerBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/partner/dashboard',
      label: 'Trang chủ',
      icon: LayoutDashboard,
    },
    {
      href: '/partner/inventory',
      label: 'Giỏ hàng',
      icon: Building2,
    },
    {
      href: '/partner/bookings',
      label: 'Giữ chỗ',
      icon: CalendarRange,
    },
    {
      href: '/partner/commission',
      label: 'Hoa hồng',
      icon: Wallet,
    },
    {
      href: '/partner/profile',
      label: 'Cá nhân',
      icon: UserSquare2,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-2 py-2 flex justify-between items-center z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
      <div className="w-full max-w-lg mx-auto flex justify-between items-center px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={
                isActive
                  ? "text-primary flex flex-col items-center gap-1 transition-colors scale-105"
                  : "text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-hover flex flex-col items-center gap-1 transition-colors"
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
