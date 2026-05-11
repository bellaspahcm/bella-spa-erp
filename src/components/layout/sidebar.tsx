'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  Settings, 
  LogOut,
  Flower2,
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Khách hàng', href: '/dashboard/customers' },
  { icon: Calendar, label: 'Lịch hẹn', href: '/dashboard/bookings' },
  { icon: MessageSquare, label: 'Tin nhắn', href: '/dashboard/chat' },
  { icon: DollarSign, label: 'Tài chính', href: '/dashboard/finance' },
  { icon: Settings, label: 'Cài đặt', href: '/dashboard/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Flower2 className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">Bella Spa</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                isActive 
                  ? "bg-rose-50 text-rose-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  isActive ? "text-rose-600" : "text-slate-400 group-hover:text-slate-900"
                )} />
                <span className="font-bold text-sm">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 bg-rose-500 rounded-full"
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-50">
        <div className="bg-slate-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-200 rounded-full flex items-center justify-center text-rose-700 font-bold">
              AD
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Admin User</p>
              <p className="text-xs text-slate-500 font-medium truncate w-32">admin@bellaspa.vn</p>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all font-bold text-sm">
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
