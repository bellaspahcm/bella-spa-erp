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
    <aside className="w-72 glass-pink border-r border-pink-100 flex flex-col h-screen sticky top-0 shadow-xl relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
      
      <div className="p-8">
        <Link href="/dashboard" className="flex items-center gap-4">
          <div className="p-1.5 bg-white rounded-2xl shadow-sm border border-pink-50">
            <img src="/logo.png" alt="Bella Spa" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tighter uppercase leading-none">Bella Spa</h2>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Management</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {menuItems.map((item: any) => {
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
              BS
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-foreground truncate">Quản trị viên</p>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest">Hệ thống</p>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-4 w-full px-5 py-4 text-muted-foreground hover:text-accent hover:bg-pink-50 rounded-2xl transition-all font-black text-sm uppercase tracking-widest group">
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
