'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, Users, Calendar, CheckSquare, Banknote, 
  Plus, Search, Phone, FileText, MapPin, Milestone,
  ChevronRight, Award, Flame, RefreshCw, BellRing
} from 'lucide-react';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';

type CurrentUser = Awaited<ReturnType<typeof getCachedCurrentUser>>;
type TenantSettings = Awaited<ReturnType<typeof getCachedTenantSettings>>;
import { getWorkforceDashboardData, WorkforceDashboardData } from '@/services/workforce-actions';
import { formatCurrency } from '@bella/shared';
import { toast } from 'sonner';
import Link from 'next/link';

export default function WorkforceDashboard() {
  const [user, setUser] = useState<CurrentUser>(null);
  const [tenant, setTenant] = useState<TenantSettings>(null);
  const [dashboardData, setDashboardData] = useState<WorkforceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [u, t, data] = await Promise.all([
        getCachedCurrentUser(),
        getCachedTenantSettings(),
        getWorkforceDashboardData()
      ]);
      setUser(u);
      setTenant(t);
      setDashboardData(data);
    } catch (err: unknown) {
      console.error('[WorkforceDashboard] Load data failed:', err);
      toast.error('Lỗi khi tải dữ liệu trang tổng quan');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !user) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        </div>
        <div className="h-36 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6 bg-slate-900 text-white rounded-b-[36px] relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full border-2 border-white/20" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center font-bold text-white border-2 border-white/10">
                {user.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Nhân sự tác nghiệp</p>
              <h2 className="text-base font-black tracking-tight">{user.full_name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadData(true)} 
              className="p-2.5 bg-white/10 hover:bg-white/15 active:scale-95 rounded-full transition-all border border-white/5"
            >
              <RefreshCw className={`w-4 h-4 text-white/80 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link 
              href="/workforce/profile"
              className="p-2.5 bg-white/10 hover:bg-white/15 rounded-full border border-white/5 relative"
            >
              <BellRing className="w-4 h-4 text-white/80" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            </Link>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mt-6 relative z-10">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm nhanh khách hàng, mã căn, hợp đồng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/10 hover:border-white/20 focus:border-white/30 rounded-2xl py-3 pl-11 pr-4 text-xs text-white placeholder-white/40 outline-none transition-all"
            />
            <Search className="w-4 h-4 text-white/40 absolute left-4 top-3.5" />
          </div>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div className="px-5 -mt-6 relative z-20 space-y-6">
        
        {/* Bella AI Daily Brief */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-slate-900 dark:to-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-primary/20 text-primary rounded-lg border border-primary/20 animate-pulse">
              <Sparkles className="w-4 h-4 fill-primary" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Bella AI Daily Brief</h3>
          </div>
          <div className="text-xs text-slate-300 font-medium leading-relaxed space-y-2">
            <p>
              Chào buổi sáng, <strong>{user.full_name?.split(' ').pop()}</strong>! Hôm nay bạn có{' '}
              <span className="text-amber-400 font-black">{dashboardData?.newLeads || 0} Lead mới</span> cần phản hồi gấp và{' '}
              <span className="text-emerald-400 font-black">{dashboardData?.todayTasks || 0} nhiệm vụ</span> cần xử lý trong ngày.
            </p>
            <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
              <span>Đạt mục tiêu hoa hồng tháng: <strong>{formatCurrency(dashboardData?.pendingCommission || 0)}</strong></span>
              <span className="text-primary font-bold flex items-center gap-0.5">Tiến độ <ChevronRight className="w-3.5 h-3.5" /></span>
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/workforce/leads" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead mới</p>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">{dashboardData?.newLeads || 0}</h4>
            </div>
          </Link>

          <Link href="/workforce/tasks" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Việc hôm nay</p>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">{dashboardData?.todayTasks || 0}</h4>
            </div>
          </Link>

          <Link href="/workforce/calendar" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lịch hẹn</p>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">{dashboardData?.upcomingAppointments || 0}</h4>
            </div>
          </Link>

          <Link href="/workforce/commission" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3 hover:border-primary/20 transition-all active:scale-[0.98]">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tạm tính</p>
              <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-200 mt-1">{formatCurrency(dashboardData?.pendingCommission || 0)}</h4>
            </div>
          </Link>
        </div>

        {/* Shortcuts / Quick Utilities */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tiện ích nhanh</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Link href="/workforce/inventory" className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
              <div className="w-10 h-10 bg-slate-55 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Bảng hàng</span>
            </Link>
            
            <Link href="/workforce/attendance" className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Check-in</span>
            </Link>

            <Link href="/workforce/transactions" className="flex flex-col items-center gap-1.5 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 rounded-xl">
                <Milestone className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Giao dịch</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── FLOATING QUICK ACTION BUTTON ──────────────────────────────────── */}
      <div className="fixed bottom-20 right-6 z-40">
        <button 
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-hover active:scale-95 transition-all"
        >
          <Plus className={`w-6 h-6 transition-transform duration-300 ${showQuickActions ? 'rotate-45' : ''}`} />
        </button>
        {showQuickActions && (
          <div className="absolute bottom-16 right-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-3 w-48 space-y-2 animate-[slideUp_0.2s_ease-out]">
            <Link href="/workforce/attendance" className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-500" /> Check-in Dự án
            </Link>
            <Link href="/workforce/tasks" className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
              <CheckSquare className="w-4 h-4 text-indigo-500" /> Thêm Nhiệm vụ
            </Link>
            <a href="tel:0901234567" className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
              <Phone className="w-4 h-4 text-sky-500" /> Gọi điện Khách hàng
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
