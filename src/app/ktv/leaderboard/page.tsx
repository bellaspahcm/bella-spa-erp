'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Medal, 
  Star, 
  ChevronLeft,
  RefreshCw,
  TrendingUp,
  Clock,
  DollarSign,
  Calendar as CalendarIcon
} from 'lucide-react';
import { getKTVLeaderboard } from '@/services/ktv-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function KTVLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getKTVLeaderboard(selectedMonth);
      setLeaderboard(data);
    } catch (error) {
      toast.error('Lỗi khi tải bảng xếp hạng');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-rose-500 text-white px-6 pt-12 pb-24 rounded-b-[40px] relative overflow-hidden shadow-2xl shadow-rose-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-between mb-8">
            <Link href="/ktv/dashboard" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">Bảng vinh danh</h1>
            <button onClick={() => fetchData()} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-[32px] backdrop-blur-md border border-white/30 mb-4 shadow-xl">
             <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black mb-1">Top Ngôi sao Bella</h2>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Tháng {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}</p>
        </div>
      </div>

      {/* Podium (Top 3) */}
      <div className="px-6 -mt-12 relative z-20">
         <div className="flex items-end justify-center gap-2 mb-8">
            {/* Rank 2 */}
            {leaderboard[1] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border-2 border-slate-100 flex items-center justify-center mb-3 overflow-hidden relative">
                     <span className="text-xl font-black text-slate-400">2</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-900 text-center truncate w-full">{leaderboard[1].full_name}</p>
                  <span className="text-[8px] font-black text-slate-400 uppercase">{leaderboard[1].total_sessions} ca</span>
                  <div className="h-16 w-full bg-slate-200 mt-2 rounded-t-2xl flex items-end justify-center pb-2">
                     <Medal className="w-5 h-5 text-slate-400" />
                  </div>
               </div>
            )}

            {/* Rank 1 */}
            {leaderboard[0] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-20 h-20 bg-white rounded-[32px] shadow-2xl border-4 border-amber-400 flex items-center justify-center mb-4 overflow-hidden relative scale-110">
                     <span className="text-2xl font-black text-amber-500">1</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 text-center truncate w-full">{leaderboard[0].full_name}</p>
                  <span className="text-[10px] font-black text-amber-500 uppercase">{leaderboard[0].total_sessions} ca</span>
                  <div className="h-24 w-full bg-amber-400 mt-2 rounded-t-3xl flex items-end justify-center pb-4 shadow-lg shadow-amber-100">
                     <Trophy className="w-6 h-6 text-white" />
                  </div>
               </div>
            )}

            {/* Rank 3 */}
            {leaderboard[2] && (
               <div className="flex flex-col items-center flex-1">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border-2 border-slate-100 flex items-center justify-center mb-3 overflow-hidden relative">
                     <span className="text-xl font-black text-slate-300">3</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-900 text-center truncate w-full">{leaderboard[2].full_name}</p>
                  <span className="text-[8px] font-black text-slate-400 uppercase">{leaderboard[2].total_sessions} ca</span>
                  <div className="h-12 w-full bg-rose-200 mt-2 rounded-t-2xl flex items-end justify-center pb-2">
                     <Medal className="w-5 h-5 text-rose-400" />
                  </div>
               </div>
            )}
         </div>

         {/* Rest of the List */}
         <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            {leaderboard.slice(3).map((item, index) => (
               <div key={item.ktv_id} className="flex items-center justify-between p-5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-4">
                     <span className="text-xs font-black text-slate-300 w-4">{index + 4}</span>
                     <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                        <span className="text-xs font-black text-slate-400">{item.full_name.charAt(0)}</span>
                     </div>
                     <div>
                        <h4 className="text-sm font-black text-slate-900">{item.full_name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Hạng {item.rank} • {item.total_sessions} ca làm</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="flex items-center gap-1 text-amber-500 font-black text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        <span>5.0</span>
                     </div>
                     <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Đánh giá</p>
                  </div>
               </div>
            ))}

            {leaderboard.length === 0 && !isLoading && (
              <div className="p-12 text-center text-slate-400 text-sm">
                 Chưa có dữ liệu thi đua tháng này
              </div>
            )}
         </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
        <Link href="/ktv/dashboard" className="text-slate-300 flex flex-col items-center gap-1">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </Link>
        <Link href="/ktv/earnings" className="text-slate-300 flex flex-col items-center gap-1">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Thu nhập</span>
        </Link>
        <button className="text-primary flex flex-col items-center gap-1">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Cá nhân</span>
        </button>
      </div>
    </div>
  );
}
