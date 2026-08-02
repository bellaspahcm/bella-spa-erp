'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Award, Sparkles, Building2, TrendingUp, Wallet, Bell, Loader2,
  Calendar, CheckCircle2, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { getPartnerDashboardData, PartnerDashboardData } from '@/services/partner-actions';
import { getCachedCurrentUser } from '@/lib/dashboard-client-context';
import { toast } from 'sonner';
import Link from 'next/link';

export default function PartnerDashboard() {
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [dbData, currentUser] = await Promise.all([
        getPartnerDashboardData(),
        getCachedCurrentUser()
      ]);
      setData(dbData);
      setUser(currentUser);
    } catch (err) {
      console.error('[PartnerDashboard] Load failed:', err);
      toast.error('Lỗi khi tải dữ liệu trang chủ');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Đang chuẩn bị dữ liệu đối tác...
        </p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-6 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Đối Tác Bella Land
            </span>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-200">
              Xin chào, {user?.full_name || 'Đối tác'}!
            </h1>
          </div>
          <Link href="/partner/profile" className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-full flex items-center justify-center font-bold text-primary shadow-sm hover:scale-105 transition-transform">
            {user?.full_name ? user.full_name.split(' ').pop()?.slice(0, 2).toUpperCase() : 'PT'}
          </Link>
        </div>

        {/* BELLA AI DAILY BRIEF */}
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full blur-xl pointer-events-none" />
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-primary/10 rounded-2xl">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Bella AI Trợ Lý Đối Tác
            </h3>
          </div>
          <div className="mt-3.5 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed space-y-2">
            <p>
              Chào mừng bạn đến với Cổng thông tin đối tác Bella Land.
            </p>
            <p>
              ✨ **Hôm nay có gì mới?** Sàn liên kết vừa cập nhật chính sách bán hàng mới cho phân khu Sapphire và Villa Riverside. Hiện tại bạn có **{data?.pendingBookingsCount || 0} giữ chỗ đang chờ duyệt** và tổng doanh số đối tác tích lũy của bạn đạt **{formatCurrency(data?.totalSalesValue || 0)}**.
            </p>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 mt-1">
              Khám phá tài liệu dự án để tư vấn khách ngay &rarr;
            </p>
          </div>
        </div>
      </div>

      {/* QUICK INDICATORS */}
      <div className="px-6 grid grid-cols-2 gap-4">
        {/* DOANH SỐ */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh số</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
              {formatCurrency(data?.totalSalesValue || 0)}
            </h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {data?.totalSalesCount || 0} giao dịch cọc
            </p>
          </div>
        </div>

        {/* HOA HỒNG */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ví hoa hồng</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950 rounded-xl">
              <Wallet className="w-4 h-4 text-indigo-500" />
            </div>
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
              {formatCurrency(data?.commission?.total || 0)}
            </h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Chờ duyệt: {formatCurrency(data?.commission?.pending || 0)}
            </p>
          </div>
        </div>

        {/* GIỮ CHỖ CHỜ DUYỆT */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giữ chỗ chờ duyệt</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950 rounded-xl">
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
              {data?.pendingBookingsCount || 0} yêu cầu
            </h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              24h giữ chỗ tạm khóa
            </p>
          </div>
        </div>

        {/* ĐÃ CHỐT THÀNH CÔNG */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chốt thành công</span>
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
            </div>
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
              {data?.approvedBookingsCount || 0} căn hộ
            </h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Đã ký hợp đồng mua bán
            </p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mt-6 px-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Tác vụ nhanh</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href="/partner/inventory" className="flex items-center justify-between p-3.5 bg-primary text-white rounded-2xl font-bold text-xs hover:opacity-90 shadow-md">
            <span>Check bảng hàng</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/partner/bookings" className="flex items-center justify-between p-3.5 bg-slate-900 dark:bg-slate-850 text-white rounded-2xl font-bold text-xs hover:bg-slate-800">
            <span>Tạo booking mới</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ANNOUNCEMENT BOARD */}
      <div className="mt-8 px-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Bản tin sàn & Chính sách mới</h3>
          <Bell className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-3.5 space-y-3">
          {data?.announcements.map((ann) => (
            <div key={ann.id} className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-start gap-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                  {ann.title}
                </h4>
                {ann.tag && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest rounded-full flex-shrink-0">
                    {ann.tag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {ann.content}
              </p>
              <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest block">
                {ann.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
