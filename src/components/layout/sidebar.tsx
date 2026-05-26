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
  Megaphone,
  Menu,
  X,
  Scale
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { getCurrentUser } from '@/services/user-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import { createClient } from '@/lib/supabase-client';
import ThemeToggle from '@/components/common/ThemeToggle';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',      href: '/dashboard' },
  { icon: Sparkles,        label: 'AI Copilot',     href: '/dashboard/ai-copilot' },
  { icon: Users,           label: 'Khách hàng',     href: '/dashboard/customers' },
  { icon: Calendar,        label: 'Lịch hẹn',       href: '/dashboard/bookings' },
  { icon: Flower2,         label: 'Thẻ liệu trình', href: '/dashboard/sessions' },
  { icon: MessageSquare,   label: 'Tin nhắn',        href: '/dashboard/chat' },
  { icon: Megaphone,       label: 'CRM & Zalo',     href: '/dashboard/crm' },
  { icon: Sparkles,        label: 'Dịch vụ',         href: '/dashboard/services' },
  { icon: DollarSign,      label: 'Tài chính',       href: '/dashboard/finance' },
  { icon: ShieldAlert,     label: 'Đối soát',        href: '/dashboard/finance/reconciliation' },
  { icon: Scale,           label: 'Kế toán sổ cái',   href: '/dashboard/accounting' },
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
  const [isOpen, setIsOpen] = useState<boolean>(false);

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

  // Auto close mobile drawer on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const filteredMenuItems = user?.role?.toLowerCase() === 'customer'
    ? customerMenuItems
    : menuItems.filter(item => {
        if (user && user.role !== 'admin' && user.role !== 'customer') {
          if (rolePermissions) {
            const moduleMap: Record<string, string> = {
              'Dashboard': 'dashboard',
              'AI Copilot': 'ai_copilot',
              'Khách hàng': 'customers',
              'Lịch hẹn': 'bookings',
              'Thẻ liệu trình': 'sessions',
              'Tin nhắn': 'chat',
              'CRM & Zalo': 'crm',
              'Dịch vụ': 'services',
              'Tài chính': 'finance',
              'Đối soát': 'reconciliation',
              'Kế toán sổ cái': 'accounting',
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
              return !['Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát', 'Nhật ký hệ thống', 'Kho hàng', 'Kế toán sổ cái', 'AI Copilot'].includes(item.label);
            }
            if (user.role === 'ktv_lead') {
              return !['Tài chính', 'Cài đặt', 'Bảng lương', 'Đối soát', 'Nhật ký hệ thống', 'Kho hàng', 'Khách hàng', 'Kế toán sổ cái', 'AI Copilot'].includes(item.label);
            }
            if (user.role === 'admin_staff') {
              return !['Đối soát', 'Bảng lương', 'Nhật ký hệ thống', 'Cài đặt', 'Kế toán sổ cái', 'AI Copilot'].includes(item.label);
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
      {/* ── Mobile Top Header Bar (lg:hidden) ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#11100F]/95 border-b border-[#FFE4E6] dark:border-[#3E3A35] backdrop-blur-md z-30 px-6 flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-colors duration-300">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 rounded-xl text-[#BE185D] dark:text-[#A67D44] hover:bg-rose-50 dark:hover:bg-[#1C1B19] active:scale-95 transition-all"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
        
        <div className="flex items-center gap-2">
          <img
            src="/FullLogo_Transparent_NoBuffer.png"
            alt="Bella Spa"
            className="w-7 h-7 object-contain"
          />
          <span className="font-handwriting text-2xl text-[#BE185D] dark:text-[#A67D44] leading-none mt-1">Bella Spa</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-[#FFE4E6] dark:bg-[#5D1C34]/40 flex items-center justify-center text-[#BE185D] dark:text-[#A67D44] font-black text-xs border border-pink-100 dark:border-[#3E3A35]">
          {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
        </div>
      </div>

      {/* ── Overlay Backdrop for Mobile ── */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 
        Premium Responsive Sidebar
        - Desktop: Sticky w-80 sidebar
        - Mobile: Slide-out fixed drawer based on `isOpen` state
      */}
      <aside className={cn(
        "w-80 bg-[#FFF0F3] border-r border-[#FBCFE8] dark:bg-[#1C1B19] dark:border-[#3E3A35] flex flex-col h-screen md:h-[111.2vh] fixed inset-y-0 left-0 z-50 transform lg:translate-x-0 lg:sticky lg:top-0 transition-transform duration-300 ease-in-out overflow-hidden shadow-[10px_0_40px_rgba(244,63,94,0.06)] dark:shadow-[10px_0_40px_rgba(0,0,0,0.5)]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Soft decorative light glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-pink-300/30 dark:bg-[#5D1C34]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-300/25 dark:bg-[#A67D44]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* ── Logo & Mobile Close Button ── */}
        <div className="px-8 pt-10 pb-6 shrink-0 relative z-10 flex items-center justify-between lg:block">
          <Link href="/dashboard" className="flex flex-col items-center group">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 dark:bg-[#A67D44]/15 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-500" />
              <img
                src="/FullLogo_Transparent_NoBuffer.png"
                alt="Bella Spa"
                className="w-24 h-24 object-contain relative z-10 transform group-hover:rotate-[5deg] transition-transform duration-500"
              />
            </div>
            <div className="text-center">
              <h2 className="text-[3.2rem] font-handwriting leading-[0.8] mb-2 drop-shadow-sm text-[#BE185D] dark:text-[#A67D44]">Bella Spa</h2>
              <span className="text-[10px] font-extrabold text-[#8A6D7C] dark:text-[#CDBCAB] uppercase tracking-[0.25em] block mt-1">Management System</span>
            </div>
          </Link>

          {/* Close button inside Drawer for Mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 rounded-xl text-[#BE185D] dark:text-[#A67D44] hover:bg-white/60 dark:hover:bg-[#1C1B19]/50 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Nav (scrollable) ── */}
        <nav className="flex-1 min-h-0 px-5 space-y-1.5 overflow-y-auto relative z-10 pb-2
                        [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-rose-200/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#3E3A35]">
          {filteredMenuItems.map((item: any) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 rounded-[1.5rem] transition-all duration-300 relative group cursor-pointer border",
                    isActive
                      ? "bg-white text-[#BE185D] border-[#FFE4E6] shadow-[0_8px_20px_rgba(219,39,119,0.08)] dark:bg-[#5D1C34]/30 dark:text-[#EFE9E1] dark:border-[#A67D44]/30 dark:shadow-none"
                      : "text-[#8A6D7C] bg-transparent border-transparent hover:bg-white/70 hover:text-[#BE185D] hover:shadow-[0_4px_12px_rgba(219,39,119,0.03)] hover:border-[#FFE4E6]/50 dark:text-[#CDBCAB] dark:hover:bg-[#1C1B19]/50 dark:hover:text-[#EFE9E1] dark:hover:border-[#3E3A35]/50"
                  )}
                >
                  <item.icon className={cn(
                    "w-[18px] h-[18px] transition-all duration-300",
                    isActive 
                      ? "text-[#BE185D] dark:text-[#A67D44] scale-105" 
                      : "text-[#A07888] dark:text-[#CDBCAB]/80 group-hover:text-[#BE185D] dark:group-hover:text-[#A67D44]"
                  )} />
                  <span className={cn(
                    "text-[14px] tracking-tight transition-all duration-300",
                    isActive 
                      ? "font-extrabold text-[#BE185D] dark:text-[#EFE9E1]" 
                      : "font-semibold"
                  )}>{item.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-5 w-1.5 h-1.5 bg-[#BE185D] dark:bg-[#A67D44] rounded-full shadow-[0_0_6px_rgba(219,39,119,0.4)] dark:shadow-[0_0_6px_rgba(166,125,68,0.4)]"
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

          {/* User profile card */}
          <div className="bg-white/80 dark:bg-[#1C1B19] p-3 rounded-[1.5rem] shadow-[0_4px_20px_rgba(219,39,119,0.04)] dark:shadow-none border border-[#FFE4E6] dark:border-[#3E3A35] group cursor-pointer transition-all duration-300 hover:border-rose-300 dark:hover:border-[#A67D44]/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-[#FFE4E6] dark:bg-[#5D1C34]/40 rounded-full flex items-center justify-center text-[#BE185D] dark:text-[#A67D44] font-extrabold text-sm shadow-sm transition-transform duration-300 group-hover:scale-105">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#11100F] rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold text-[#4C243B] dark:text-[#EFE9E1] truncate leading-tight">{user?.full_name || 'Admin Bella Spa'}</p>
                <p className="text-[9px] text-[#BE185D] dark:text-[#A67D44] font-black uppercase tracking-[0.1em] mt-0.5">{roleLabel}</p>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-[#8A6D7C] dark:text-[#CDBCAB] hover:text-[#BE185D] dark:hover:text-[#A67D44] transition-all font-extrabold text-[10px] uppercase tracking-[0.15em] group"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#FFE4E6] dark:bg-[#1C1B19] group-hover:bg-[#FFF0F3] dark:group-hover:bg-[#5D1C34]/40 group-hover:text-[#BE185D] dark:group-hover:text-[#A67D44] transition-colors">
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            ĐĂNG XUẤT
          </button>
        </div>
      </aside>
    </>
  );
}



