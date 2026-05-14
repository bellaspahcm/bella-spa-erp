'use client';

import { useState } from 'react';
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
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrentUser } from '@/services/user-actions';
import { useEffect } from 'react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Khách hàng', href: '/dashboard/customers' },
  { icon: Calendar, label: 'Lịch hẹn', href: '/dashboard/bookings' },
  { icon: Flower2, label: 'Thẻ liệu trình', href: '/dashboard/sessions' },
  { icon: MessageSquare, label: 'Tin nhắn', href: '/dashboard/chat' },
  { icon: Sparkles, label: 'Dịch vụ', href: '/dashboard/services' },
  { icon: DollarSign, label: 'Tài chính', href: '/dashboard/finance' },
  { icon: Users, label: 'Lương KTV', href: '/dashboard/salary' },
  { icon: Settings, label: 'Cài đặt', href: '/dashboard/settings' },
];

const customerMenuItems = [
  { icon: Flower2, label: 'Tiến trình liệu trình', href: '/dashboard/customer' },
  { icon: Calendar, label: 'Lịch sử buổi làm', href: '/dashboard/customer/history' },
  { icon: MessageSquare, label: 'Thông báo', href: '/dashboard/customer/notifications' },
  { icon: Settings, label: 'Hồ sơ cá nhân', href: '/dashboard/customer/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getCurrentUser();
      setUser(userData);
    };
    fetchUser();
  }, []);

  const filteredMenuItems = user?.role === 'customer' 
    ? customerMenuItems 
    : menuItems.filter(item => {
      if (user?.role === 'ktv') {
        // KTV can't see Finance or Settings or Users/Salary management
        return !['Tài chính', 'Cài đặt', 'Lương KTV'].includes(item.label);
      }
      return true;
    });

  // Special items for KTV
  if (user?.role === 'ktv') {
    // KTV has a personal income link instead of management
    const hasIncome = filteredMenuItems.some(i => i.label === 'Thu nhập cá nhân');
    if (!hasIncome) {
      filteredMenuItems.push({ icon: DollarSign, label: 'Thu nhập cá nhân', href: '/dashboard/salary' });
    }
  }

  return (
    <>
      <aside className="w-80 bg-white/40 backdrop-blur-2xl border-r border-rose-100/50 flex flex-col h-screen sticky top-0 z-40 overflow-hidden shadow-[10px_0_40px_rgba(255,192,203,0.1)]">
        {/* Soft decorative glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-200/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-300/10 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Logo Section */}
        <div className="px-8 pt-10 pb-6 shrink-0 relative z-10">
          <Link href="/dashboard" className="flex flex-col items-center group">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-500" />
              <img 
                src="/FullLogo_Transparent_NoBuffer.png" 
                alt="Bella Spa" 
                className="w-24 h-24 object-contain relative z-10 transform group-hover:rotate-[5deg] transition-transform duration-500" 
              />
            </div>
            <div className="text-center">
              <h2 className="text-[3.2rem] font-handwriting text-slate-800 leading-[0.8] mb-2 drop-shadow-sm">Bella Spa</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] block">Management System</span>
            </div>
          </Link>
        </div>

        {/* Nav Section - Scrollable */}
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar relative z-10 pb-6">
          <div className="px-4 mb-3 mt-2">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Menu chính</span>
          </div>
          {filteredMenuItems.map((item: any) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 6 }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 rounded-[1.5rem] transition-all duration-300 relative group",
                    isActive 
                      ? "bg-white text-primary shadow-[0_10px_25px_-10px_rgba(225,29,72,0.12)] border border-rose-50" 
                      : "text-slate-400 hover:bg-white/60 hover:text-slate-700"
                  )}
                >
                  <item.icon className={cn(
                    "w-4.5 h-4.5 transition-all duration-300",
                    isActive ? "text-primary scale-110" : "group-hover:text-primary"
                  )} />
                  <span className={cn(
                    "text-[12px] tracking-tight transition-all duration-300",
                    isActive ? "font-black" : "font-bold"
                  )}>{item.label}</span>
                  
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute right-5 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_#e11d48]"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout - Slimmed & Pinned */}
        <div className="px-4 pb-4 mt-auto bg-gradient-to-t from-rose-100/20 to-transparent pt-2 shrink-0 relative z-10">
          <div className="bg-white/80 p-2.5 rounded-[1.5rem] shadow-sm border border-rose-50 mb-2 group cursor-pointer hover:border-rose-200 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                  {user?.full_name?.charAt(0) || 'B'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-800 truncate leading-tight">{user?.full_name || 'Admin'}</p>
                <p className="text-[8px] text-rose-500 font-black uppercase tracking-widest mt-0.5">
                  {user?.role === 'ktv' ? 'Kỹ thuật viên' : user?.role === 'customer' ? 'Khách hàng' : 'Quản trị viên'}
                </p>
              </div>
            </div>
          </div>
          
          <button className="flex items-center gap-2.5 w-full px-3 py-1.5 text-slate-400 hover:text-rose-600 transition-all font-black text-[9px] uppercase tracking-[0.2em] group">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-50 group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">
              <LogOut className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
