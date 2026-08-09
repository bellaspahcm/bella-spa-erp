'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, Award, Target, TrendingUp, Loader2, ChevronLeft, 
  ChevronRight, Sparkles, BarChart3, Medal
} from 'lucide-react';
import { getMyKpiProgress, getWorkforceLeaderboard, KpiTargetsAndActuals, LeaderboardEntry } from '@/services/workforce-actions';
import { formatCurrency } from '@bella/shared';
import { toast } from 'sonner';
import Link from 'next/link';

export default function KpiCenter() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [kpiData, setKpiData] = useState<KpiTargetsAndActuals | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKpiAndLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [kpi, lead] = await Promise.all([
        getMyKpiProgress(selectedMonth),
        getWorkforceLeaderboard(selectedMonth)
      ]);
      setKpiData(kpi);
      setLeaderboard(lead);
    } catch (err: unknown) {
      console.error('[KpiCenter] Fetch failed:', err);
      toast.error('Lỗi khi tải dữ liệu hiệu suất');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchKpiAndLeaderboard();
  }, [fetchKpiAndLeaderboard]);

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-emerald-500';
    if (percent >= 75) return 'bg-sky-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Hiệu suất & Thi đua</h2>
        </div>
      </div>

      {/* MONTH NAV */}
      <div className="flex items-center justify-center gap-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="bg-slate-50 dark:bg-slate-800 px-5 py-2 rounded-full border border-slate-100 dark:border-slate-700">
          <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-350">
            Tháng {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}
          </span>
        </div>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
          <ChevronRight className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải bảng vàng...</p>
          </div>
        ) : (
          <>
            {/* MY KPI PROGRESS */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-650 dark:text-slate-350 uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Mục tiêu cá nhân
                </h3>
                {kpiData && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-100">
                    Đạt: {kpiData.progress.revenue}% doanh số
                  </span>
                )}
              </div>

              {kpiData && (
                <div className="space-y-4">
                  {/* KPI 1: Leads */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>Tiếp nhận Lead mới</span>
                      <span>{kpiData.actuals.leads} / {kpiData.targets.leads}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(kpiData.progress.leads)}`} style={{ width: `${Math.min(kpiData.progress.leads, 100)}%` }} />
                    </div>
                  </div>

                  {/* KPI 2: Bookings */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>Căn giữ chỗ (Holdings)</span>
                      <span>{kpiData.actuals.bookings} / {kpiData.targets.bookings}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(kpiData.progress.bookings)}`} style={{ width: `${Math.min(kpiData.progress.bookings, 100)}%` }} />
                    </div>
                  </div>

                  {/* KPI 3: Contracts */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>Ký Hợp đồng thành công</span>
                      <span>{kpiData.actuals.contracts} / {kpiData.targets.contracts}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(kpiData.progress.contracts)}`} style={{ width: `${Math.min(kpiData.progress.contracts, 100)}%` }} />
                    </div>
                  </div>

                  {/* KPI 4: Revenue */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>Doanh số (Doanh thu đem lại)</span>
                      <span>{formatCurrency(kpiData.actuals.revenue)} / {formatCurrency(kpiData.targets.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(kpiData.progress.revenue)}`} style={{ width: `${Math.min(kpiData.progress.revenue, 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LEADERBOARD */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> Bảng xếp hạng chiến thần
              </h3>

              {leaderboard.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-100 dark:border-slate-850">
                  <Sparkles className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
                  <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang cập nhật thứ hạng thi đua...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {leaderboard.map((entry, idx) => (
                    <div 
                      key={entry.user_id} 
                      className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-4 ${entry.rank <= 3 ? 'border-amber-200 dark:border-amber-900/30 bg-amber-50/10' : 'border-slate-100 dark:border-slate-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-black flex items-center justify-center text-xs ${entry.rank === 1 ? 'bg-amber-450 text-white bg-amber-500' : entry.rank === 2 ? 'bg-slate-300 text-slate-800' : entry.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          {entry.rank}
                        </div>
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs">
                            {entry.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{entry.name}</h4>
                          <p className="text-[10px] text-slate-400 font-medium">Tỷ lệ đạt mục tiêu: {entry.achievement_rate}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-150">{formatCurrency(entry.actual_revenue)}</p>
                        <p className="text-[8px] font-bold text-slate-350 dark:text-slate-500 uppercase tracking-wider">Doanh số</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
