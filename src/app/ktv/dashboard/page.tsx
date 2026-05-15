'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  MapPin, 
  Phone, 
  ChevronRight,
  DollarSign,
  User,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { 
  getKTVActiveSessions, 
  getKTVUpcomingSessions, 
  startSession, 
  completeKTVSession, 
  getKTVEarnings 
} from '@/services/ktv-actions';
import { getCurrentUser } from '@/services/user-actions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function KTVDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, sessions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [u, active, upcoming] = await Promise.all([
        getCurrentUser(),
        getKTVActiveSessions(),
        getKTVUpcomingSessions()
      ]);
      
      setUser(u);
      setActiveSessions(active);
      setUpcomingSessions(upcoming);
      
      if (u) {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const earn = await getKTVEarnings(monthStr);
        setEarnings(earn);
      }
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStart = async (sessionId: string) => {
    setIsActionLoading(sessionId);
    try {
      await startSession(sessionId);
      toast.success('Đã bắt đầu buổi trị liệu!');
      fetchData();
    } catch (error) {
      toast.error('Không thể bắt đầu buổi trị liệu');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleComplete = async (sessionId: string) => {
    const notes = window.prompt('Ghi chú buổi trị liệu (không bắt buộc):') || '';
    setIsActionLoading(sessionId);
    try {
      await completeKTVSession(sessionId, notes);
      toast.success('Đã hoàn thành buổi trị liệu!');
      fetchData();
    } catch (error) {
      toast.error('Không thể hoàn tất buổi trị liệu');
    } finally {
      setIsActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-6 rounded-b-[40px] shadow-sm border-b border-slate-100">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Kỹ thuật viên</p>
            <h1 className="text-2xl font-black text-slate-900">{user?.full_name || 'Kỹ thuật viên'}</h1>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
            <User className="w-6 h-6 text-slate-400" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-3xl text-white">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Thu nhập tháng</p>
            <p className="text-lg font-black">{formatCurrency(earnings.total)}</p>
          </div>
          <div className="bg-rose-500 p-4 rounded-3xl text-white">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Số ca đã xong</p>
            <p className="text-lg font-black">{earnings.sessions} ca</p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-8 space-y-8">
        {/* Active Sessions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang thực hiện</h2>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          
          {activeSessions.length === 0 ? (
            <div className="bg-white p-8 rounded-[32px] border border-dashed border-slate-200 text-center">
              <p className="text-slate-400 text-sm font-medium">Không có ca nào đang chạy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <motion.div 
                  layoutId={session.id}
                  key={session.id} 
                  className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="bg-white/10 text-white/60 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">
                        {session.bookings?.package_name}
                      </span>
                      <h3 className="text-xl font-black">{session.bookings?.customers?.name_mother}</h3>
                    </div>
                    <div className="flex flex-col items-end">
                       <p className="text-[10px] font-black text-white/40 uppercase">Bắt đầu lúc</p>
                       <p className="font-black">{new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6 opacity-60">
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{session.bookings?.customers?.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{session.bookings?.customers?.phone}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleComplete(session.id)}
                    disabled={isActionLoading === session.id}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isActionLoading === session.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Kết thúc & Check-out
                      </>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Sessions */}
        <section>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lịch hôm nay</h2>
          
          {upcomingSessions.length === 0 ? (
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 text-center">
              <p className="text-slate-400 text-sm font-medium">Hôm nay không còn ca nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="bg-white p-5 rounded-[32px] border border-slate-100 flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 flex-shrink-0">
                    <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Giờ</span>
                    <span className="text-sm font-black text-slate-900 leading-none">{session.assigned_time || '--:--'}</span>
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">Buổi {session.session_number}</p>
                    <h3 className="text-base font-black text-slate-900 truncate">{session.bookings?.customers?.name_mother}</h3>
                    <p className="text-xs text-slate-400 truncate">{session.bookings?.package_name}</p>
                  </div>

                  <button 
                    onClick={() => handleStart(session.id)}
                    disabled={isActionLoading !== null}
                    className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile Bottom Nav (Placeholder for now) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
        <button className="text-primary flex flex-col items-center gap-1">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </button>
        <button className="text-slate-300 flex flex-col items-center gap-1">
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
