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
  ChevronLeft,
  MessageSquare,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QuickAddCustomerModal } from '@/components/features/QuickAddCustomerModal';
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
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
      <aside className="w-72 glass-pink border-r border-pink-100 flex flex-col h-screen min-h-screen sticky top-0 shadow-xl relative z-30">
        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
        
        <div className="p-8">
          <Link href="/dashboard" className="flex flex-col items-center gap-3 text-center py-4">
            <img 
              src="/FullLogo_Transparent_NoBuffer.png" 
              alt="Bella Spa" 
              className="w-20 h-20 object-contain" 
            />
            <div>
              <h2 className="text-[3.45rem] font-handwriting text-primary leading-tight">Bella Spa</h2>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] block -mt-1">Management System</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-4">
          {user?.role !== 'ktv' && (
            <button 
              onClick={() => setIsQuickAddOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-5 py-4 rounded-2xl transition-all shadow-lg shadow-rose-200 mb-6 font-bold tracking-tight active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              <span>Thêm khách nhanh</span>
            </button>
          )}
          {filteredMenuItems.map((item: any) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold tracking-tight group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-pink-200" 
                    : "text-muted-foreground hover:bg-white hover:text-primary"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  isActive ? "text-white" : "text-primary/60 group-hover:text-primary"
                )} />
                <span className="text-sm">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill-v2"
                    className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-white/80 backdrop-blur rounded-[2rem] p-5 shadow-sm border border-pink-50 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-pink-100">
              {user?.full_name?.charAt(0) || 'B'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-foreground truncate">{user?.full_name || 'Đang tải...'}</p>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest">
                {user?.role === 'ktv' ? 'Kỹ thuật viên' : user?.role === 'customer' ? 'Khách hàng' : 'Quản trị viên'}
              </p>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-4 w-full px-5 py-4 text-muted-foreground hover:text-accent hover:bg-pink-50 rounded-2xl transition-all font-black text-sm uppercase tracking-widest group">
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          Đăng xuất
        </button>
      </div>
    </aside>
    <QuickAddCustomerModal 
      isOpen={isQuickAddOpen} 
      onClose={() => setIsQuickAddOpen(false)} 
    />
  </>
  );
}
