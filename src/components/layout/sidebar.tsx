'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  Package,
  Settings, 
  LogOut,
  Flower2,
  Sparkles,
  MessageSquare,
  Banknote,
  ShieldAlert,
  History,
  Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { getCurrentUser } from '@/services/user-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import { createClient } from '@/lib/supabase-client';
import ThemeToggle from '@/components/common/ThemeToggle';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',      href: '/dashboard' },
  { icon: Users,           label: 'Khách hàng',     href: '/dashboard/customers' },
  { icon: Calendar,        label: 'Lịch hẹn',       href: '/dashboard/bookings' },
  { icon: Flower2,         label: 'Thẻ liệu trình', href: '/dashboard/sessions' },
  { icon: MessageSquare,   label: 'Tin nhắn',        href: '/dashboard/chat' },
  { icon: Megaphone,       label: 'CRM & Zalo',     href: '/dashboard/crm' },
  { icon: Sparkles,        label: 'Dịch vụ',         href: '/dashboard/services' },
  { icon: DollarSign,      label: 'Tài chính',       href: '/dashboard/finance' },
  { icon: ShieldAlert,     label: 'Đối soát',        href: '/dashboard/finance/reconciliation' },
  { icon: Package,         label: 'Kho hàng',        href: '/dashboard/inventory' },
  { icon: Banknote,        label: 'Bảng lương',      href: '/dashboard/salary' },
  { icon: History,         label: 'Nhật ký hệ thống', href: '/dashboard/audit' },
  { icon: Settings,        label: 'Cài đặt',         href: '/dashboard/settings' },
];

const customerMenuItems = [
  { icon: Flower2,       label: 'Tiến trình liệu trình', href: '/dashboard/customer' },
  { icon: Calendar,      label: 'Lịch sử buổi làm',      href: '/dashboard/customer/history' },
  { icon: MessageSquare, label: 'Thông báo',              href: '/dashboard/customer/notifications' },
  { icon: Settings,      label: 'Hồ sơ cá nhân',          href: '/dashboard/customer/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rolePermissions, setRolePermissions] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const userData = await getCurrentUser();
      setUser(userData);
      
      if (userData?.role && userData.role !== 'admin' && userData.role !== 'customer') {
        try {
          const settings = await getTenantSettings();
          if (settings?.role_permissions) {
            setRolePermissions((settings.role_permissions as any)[userData.role] || null);
          }
        } catch (error) {
          console.error("Failed to load permissions", error);
        }
      }
    };
    fetchData();
  }, []);

  const filteredMenuItems = user?.role?.toLowerCase() === 'customer'
    ? customerMenuItems
    : menuItems.filter(item => {
        if (user && user.role !== 'admin' && user.role !== 'customer') {
          if (rolePermissions) {
            const moduleMap: Record<string, string> = {
              'Dashboard': 'dashboard',
              'Khách hàng': 'customers',
              'Lịch hẹn': 'bookings',
              'Thẻ liệu trình': 'sessions',
              'Tin nhắn': 'chat',
              'CRM & Zalo': 'crm',
              'Dịch vụ': 'services',
              'Tài chính': 'finance',
              'Đối soát': 'reconciliation',
              'Kho hàng': 'inventory',
              'Bảng lương': 'salary',
              'Nhật ký hệ thống': 'audit',
              'Cài đặt': 'settings'
            };
            const moduleId = moduleMap[item.label];
            if (moduleId && rolePermissions[moduleId] === false) {
              return false;
            }
          } else {
            // Default fallbacks while loading or if no custom permissions set
            if (user.role === 'ktv') {
              return !['Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát', 'Nhật ký hệ thống', 'Kho hàng'].includes(item.label);
            }
            if (user.role === 'ktv_lead') {
              return !['Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát', 'Nhật ký hệ thống', 'Kho hàng', 'Khách hàng'].includes(item.label);
            }
            if (user.role === 'admin_staff') {
              return !['Đối soát', 'Bảng lương', 'Nhật ký hệ thống', 'Cài đặt'].includes(item.label);
            }
          }
        }
        return true;
      });

  // KTV gets a personal income shortcut instead
  if (user?.role?.toLowerCase() === 'ktv') {
    const hasIncome = filteredMenuItems.some((i: any) => i.label === 'Thu nhập cá nhân');
    if (!hasIncome) {
      filteredMenuItems.push({ icon: DollarSign, label: 'Thu nhập cá nhân', href: '/ktv/earnings' });
    }
  }

  const handleLogout = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  const roleLabel =
    user?.role?.toLowerCase() === 'ktv' ? 'Kỹ thuật viên'
    : user?.role?.toLowerCase() === 'ktv_lead' ? 'KTV Trưởng'
    : user?.role?.toLowerCase() === 'admin_staff' ? 'Lễ tân / Staff'
    : user?.role?.toLowerCase() === 'customer' ? 'Khách hàng'
    : 'Quản trị viên';

  return (
    <>
      <aside className="w-80 bg-[#FFF8FA] dark:bg-[#140d12] border-r border-[#FCE4EC] dark:border-[#2d1f27] flex flex-col h-screen sticky top-0 z-40 overflow-hidden shadow-[4px_0_30px_rgba(157,23,77,0.04)] dark:shadow-[4px_0_30px_rgba(0,0,0,0.5)]">
        {/* Soft decorative glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-200/20 dark:bg-rose-950/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-300/10 dark:bg-purple-950/10 rounded-full blur-[100px] pointer-events-none" />

        {/* ── Logo ── */}
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
              <h2 className="text-[3.2rem] font-handwriting text-slate-800 dark:text-rose-100 leading-[0.8] mb-2 drop-shadow-sm">Bella Spa</h2>
              <span className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] block">Management System</span>
            </div>
          </Link>
        </div>

        {/* ── Nav (scrollable) ── */}
        <nav className="flex-1 min-h-0 px-4 space-y-1.5 overflow-y-auto relative z-10 pb-2
                        [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-rose-200/60">
          <div className="px-4 mb-3 mt-2">
            <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Menu chính</span>
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
                      ? "bg-white dark:bg-[#1f141b] text-primary dark:text-pink-350 shadow-[0_10px_25px_-10px_rgba(157,23,77,0.08)] dark:shadow-[0_10px_25px_-10px_rgba(0,0,0,0.4)] border border-[#FCE4EC] dark:border-[#2d1f27]/50"
                      : "text-slate-500 dark:text-[#a6959f] hover:bg-white/80 hover:text-slate-800 dark:hover:bg-[#1f141b]/60 dark:hover:text-slate-200"
                  )}
                >
                  <item.icon className={cn(
                    "w-4.5 h-4.5 transition-all duration-300",
                    isActive ? "text-primary scale-110" : "group-hover:text-primary dark:group-hover:text-primary-hover"
                  )} />
                  <span className={cn(
                    "text-[14px] tracking-tight transition-all duration-300",
                    isActive ? "font-black" : "font-bold"
                  )}>{item.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-5 w-1 h-1 bg-primary dark:bg-accent rounded-full shadow-[0_0_8px_#e11d48]"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* ── Theme Switcher, User Profile & Logout — pinned at bottom ── */}
        <div className="mt-auto shrink-0 relative z-10 px-6 pt-2 pb-4 flex flex-col gap-3">
          {/* Theme Toggle Button */}
          <div className="px-1">
            <ThemeToggle />
          </div>

          {/* Admin card */}
          <div className="bg-white dark:bg-[#1c1218] p-2.5 rounded-[1.25rem] shadow-sm border border-[#FCE4EC] dark:border-[#2d1f27] group cursor-pointer hover:border-rose-200 dark:hover:border-[#ff8fa3]/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-[#9D174D] dark:bg-[#ffb7c5] rounded-full flex items-center justify-center text-white dark:text-[#0d080c] font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                  {user?.full_name?.charAt(0) || 'B'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#1c1218] rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{user?.full_name || 'admin'}</p>
                <p className="text-[9px] text-rose-500 dark:text-pink-300 font-black uppercase tracking-widest mt-0.5">{roleLabel}</p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 transition-all font-black text-[10px] uppercase tracking-[0.2em] group"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#FFF6F8] dark:bg-[#1f141b] group-hover:bg-rose-50 dark:group-hover:bg-slate-800 group-hover:text-rose-600 dark:group-hover:text-[#ff9eaa] transition-colors">
              <LogOut className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            ĐĂNG XUẤT
          </button>
        </div>
      </aside>
    </>
  );
}
