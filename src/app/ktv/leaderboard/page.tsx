'use client';

import { useCallback,useEffect,useState } from 'react';
import { 
  Trophy, 
  Medal, 
  Star, 
  ChevronLeft,
  RefreshCw,
  Clock,
  DollarSign,
  Calendar as CalendarIcon
} from 'lucide-react';
import { getKTVLeaderboard } from '@/services/ktv-actions';
import { toast } from 'sonner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type KTVLeaderboardEntry = Awaited<ReturnType<typeof getKTVLeaderboard>>[number];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];

export default function KTVLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<KTVLeaderboardEntry[]>([]);
  const [selectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getKTVLeaderboard(selectedMonth);
      setLeaderboard(data);
    } catch {
      toast.error('Lỗi khi tải bảng xếp hạng');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();

    // Set up realtime listener to fetch fresh data instantly when session changes occur
    const supabaseClient = createClient();
    const channel = supabaseClient
      .channel(`leaderboard-realtime-${selectedMonth}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_logs'
        },
        (payload: RealtimePostgresChangesPayload<SessionLogRow>) => {
          console.log('Realtime session log update, refetching leaderboard:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [fetchData, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-24 rounded-b-[40px] relative overflow-hidden shadow-2xl shadow-rose-100 dark:shadow-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-between mb-8">
            <Link href="/ktv/dashboard" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div className="text-sm font-black uppercase tracking-[0.2em] text-white">Bảng vinh danh</div>
            <button onClick={() => fetchData()} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-[32px] backdrop-blur-md border border-white/30 mb-4 shadow-xl">
             <Trophy className="w-10 h-10 text-white" />
          </div>
          <div className="text-2xl font-black text-white mb-1">Top Ngôi sao Bella</div>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Tháng {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}</p>
        </div>
      </div>

      {/* Podium (Top 3) */}
      <div className="px-6 -mt-12 relative z-20">
         <div className="flex items-end justify-center gap-2 mb-8">
            {/* Rank 2 */}
            {leaderboard[1] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 bg-white dark:bg-[#292623] rounded-2xl shadow-lg border-2 border-slate-100 dark:border-[#3E3A35] flex items-center justify-center mb-3 overflow-hidden relative">
                     <span className="text-xl font-black text-slate-600 dark:text-[#D4C5B6]">2</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-900 dark:text-[#EFE9E1] text-center truncate w-full">{leaderboard[1].full_name}</p>
                  <span className="text-[8px] font-black text-slate-700 dark:text-[#D4C5B6] uppercase">{leaderboard[1].sessions ?? 0} ca</span>
                  <div className="h-16 w-full bg-gradient-to-br from-rose-200 to-pink-200 dark:bg-[#3E3A35] mt-2 rounded-t-2xl flex items-end justify-center pb-2 shadow-md shadow-rose-100/50 dark:shadow-none">
                     <Medal className="w-5 h-5 text-rose-600 dark:text-[#A67D44]" />
                  </div>
               </div>
            )}

            {/* Rank 1 */}
            {leaderboard[0] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-20 h-20 bg-white dark:bg-[#292623] rounded-[32px] shadow-2xl border-4 border-amber-400 dark:border-[#A67D44] flex items-center justify-center mb-4 overflow-hidden relative scale-110">
                     <span className="text-2xl font-black text-amber-500 dark:text-[#A67D44]">1</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] text-center truncate w-full">{leaderboard[0].full_name}</p>
                  <span className="text-[10px] font-black text-amber-500 dark:text-[#A67D44] uppercase">{leaderboard[0].sessions ?? 0} ca</span>
                  <div className="h-24 w-full bg-amber-400 dark:bg-[#5D1C34] mt-2 rounded-t-3xl flex items-end justify-center pb-4 shadow-lg shadow-amber-100 dark:shadow-none">
                     <Trophy className="w-6 h-6 text-white" />
                  </div>
               </div>
            )}

            {/* Rank 3 */}
            {leaderboard[2] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 bg-white dark:bg-[#292623] rounded-2xl shadow-lg border-2 border-slate-100 dark:border-[#3E3A35] flex items-center justify-center mb-3 overflow-hidden relative">
                     <span className="text-xl font-black text-slate-600 dark:text-[#D4C5B6]">3</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-900 dark:text-[#EFE9E1] text-center truncate w-full">{leaderboard[2].full_name}</p>
                  <span className="text-[8px] font-black text-slate-700 dark:text-[#D4C5B6] uppercase">{leaderboard[2].sessions ?? 0} ca</span>
                  <div className="h-12 w-full bg-rose-200 dark:bg-[#3E3A35] mt-2 rounded-t-2xl flex items-end justify-center pb-2">
                     <Medal className="w-5 h-5 text-rose-400 dark:text-[#A67D44]" />
                  </div>
               </div>
            )}
         </div>

         {/* Rest of the List */}
         <div className="bg-white dark:bg-[#1C1B19] rounded-[40px] shadow-sm border border-slate-100 dark:border-[#3E3A35] overflow-hidden">
            {leaderboard.slice(3).map((item, index) => {
               const composite = item.average_rating;  // RPC returns composite blend here
               const hasRating = composite !== null && composite !== undefined;
               const ratingDisplay = hasRating ? Number(composite).toFixed(1) : '—';
               const ratingTooltip = hasRating
                 ? `Khách: ${item.customer_rating ?? '—'} (60%) · Kỷ luật: ${item.discipline_score ?? '—'} (40%)`
                 : 'Chưa có dữ liệu ca / chấm công tháng này';
               return (
                 <div key={item.ktv_id} className="flex items-center justify-between p-5 border-b border-slate-50 dark:border-[#2E2B27] last:border-0">
                    <div className="flex items-center gap-4">
                       <span className="text-xs font-black text-slate-500 dark:text-[#D4C5B6] w-4">{index + 4}</span>
                       <div className="w-10 h-10 bg-slate-50 dark:bg-[#292623] rounded-xl flex items-center justify-center border border-slate-100 dark:border-[#3E3A35]">
                          <span className="text-xs font-black text-slate-600 dark:text-[#D4C5B6]">{item.full_name.charAt(0)}</span>
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1]">{item.full_name}</h4>
                          <p className="text-[10px] text-slate-700 dark:text-[#D4C5B6] font-medium">Hạng {item.rank} • {item.sessions ?? 0} ca làm</p>
                       </div>
                    </div>
                    <div className="text-right" title={ratingTooltip}>
                       <div className={`flex items-center gap-1 font-black text-xs ${hasRating ? 'text-amber-500 dark:text-[#A67D44]' : 'text-slate-700 dark:text-[#D4C5B6]'}`}>
                          <Star className={`w-3 h-3 ${hasRating ? 'fill-current' : ''}`} />
                          <span>{ratingDisplay}</span>
                       </div>
                       <p className="text-[8px] font-black text-slate-700 dark:text-[#D4C5B6] uppercase tracking-widest">Đánh giá</p>
                    </div>
                 </div>
               );
            })}

            {leaderboard.length === 0 && !isLoading && (
              <div className="p-12 text-center text-slate-700 dark:text-[#D4C5B6] text-sm">
                 Chưa có dữ liệu thi đua tháng này
              </div>
            )}
         </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1C1B19]/95 backdrop-blur-xl border-t border-slate-100 dark:border-[#3E3A35] px-8 py-4 flex justify-between items-center z-50">
        <Link href="/ktv/dashboard" className="text-slate-500 dark:text-[#D4C5B6] hover:text-primary dark:hover:text-[#A67D44] flex flex-col items-center gap-1 transition-colors">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </Link>
        <Link href="/ktv/earnings" className="text-slate-500 dark:text-[#D4C5B6] hover:text-primary dark:hover:text-[#A67D44] flex flex-col items-center gap-1 transition-colors">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Thu nhập</span>
        </Link>
        <Link href="/ktv/leaderboard" className="text-primary dark:text-[#A67D44] flex flex-col items-center gap-1">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Cá nhân</span>
        </Link>
      </div>
    </div>
  );
}
