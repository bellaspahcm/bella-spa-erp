'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award,
  Star,
  Clock
} from 'lucide-react';
import { getKTVEarnings, getKTVLeaderboard } from '@/services/ktv-actions';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

export default function KTVEarningsPage() {
  const [earnings, setEarnings] = useState<any>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const earn = await getKTVEarnings(selectedMonth);
      setEarnings(earn);

      // Fetch specific session details for the list
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const startOfMonth = `${selectedMonth}-01`;
        const nextMonth = new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)).toISOString().split('T')[0];

        const { data: sessions } = await supabase
          .from('session_logs')
          .select(`
            id,
            completed_date,
            session_number,
            bookings (
              package_name,
              ktv_commission,
              customers (
                name_mother
              )
            )
          `)
          .eq('completed_by_ktv_id', user.id)
          .eq('status', 'completed')
          .gte('completed_date', startOfMonth)
          .lt('completed_date', nextMonth)
          .order('completed_date', { ascending: false });

        setDetails(sessions || []);

        const lb = await getKTVLeaderboard(selectedMonth);
        const myStats = lb.find((k: any) => k.ktv_id === user.id) || { total_kpi_bonus: 0, average_rating: 0 };
        setLeaderboardData(myStats);
      }
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu thu nhập');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 pt-12 pb-20 rounded-b-[40px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <Link href="/ktv/dashboard" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">Thu nhập & Thưởng</h1>
            <button onClick={() => fetchData()} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 opacity-40" />
            </button>
            <div className="bg-white/10 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
              <span className="text-sm font-black uppercase tracking-widest">Tháng {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}</span>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 opacity-40" />
            </button>
          </div>

          <div className="text-center">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Tổng hoa hồng nhận</p>
            <h2 className="text-5xl font-black mb-2">{formatCurrency(earnings?.total || 0)}</h2>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
               <TrendingUp className="w-3.5 h-3.5" />
               +{earnings?.sessions || 0} ca hoàn thành
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-10 relative z-20 space-y-6">
         {/* Summary Cards */}
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
               <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-3">
                  <Award className="w-5 h-5" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Thưởng KPI</p>
               <p className="text-lg font-black text-slate-900">{formatCurrency(leaderboardData?.total_kpi_bonus || 0)}</p>
            </div>
            <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
               <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
                  <Star className="w-5 h-5" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đánh giá TB</p>
               <p className="text-lg font-black text-slate-900">{Number(leaderboardData?.average_rating || 0).toFixed(1)} ⭐</p>
            </div>
         </div>

         {/* Detailed List */}
         <section>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Lịch sử ca làm việc</h3>
            
            {details.length === 0 ? (
              <div className="bg-white p-12 rounded-[40px] text-center border border-slate-100 shadow-sm">
                <p className="text-slate-400 text-sm">Chưa có dữ liệu cho tháng này</p>
              </div>
            ) : (
              <div className="space-y-3">
                {details.map((session) => (
                  <div key={session.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 border border-slate-100">
                        <span className="text-[10px] font-black">{new Date(session.completed_date).getDate()}</span>
                        <span className="text-[8px] font-black uppercase">Th{new Date(session.completed_date).getMonth() + 1}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{session.bookings?.customers?.name_mother}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{session.bookings?.package_name} • Buổi {session.session_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-500">+{formatCurrency(session.bookings?.ktv_commission || 0)}</p>
                      <p className="text-[8px] font-black text-slate-300 uppercase">Hoa hồng</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
         </section>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
        <Link href="/ktv/dashboard" className="text-slate-300 flex flex-col items-center gap-1">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </Link>
        <button className="text-primary flex flex-col items-center gap-1">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Thu nhập</span>
        </button>
        <button className="text-slate-300 flex flex-col items-center gap-1">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Cá nhân</span>
        </button>
      </div>
    </div>
  );
}
