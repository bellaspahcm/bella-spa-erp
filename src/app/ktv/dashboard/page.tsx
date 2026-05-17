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
  RefreshCw,
  Bell,
  X,
  Mail,
  Megaphone
} from 'lucide-react';
import { 
  getKTVActiveSessions, 
  getKTVUpcomingSessions, 
  startSession, 
  completeKTVSession, 
  getKTVEarnings,
  getKTVNotifications,
  markNotificationAsRead
} from '@/services/ktv-actions';
import { getCurrentUser } from '@/services/user-actions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function KTVDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, sessions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [systemTime, setSystemTime] = useState<string>('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const router = useRouter();

  const handleLogout = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Đăng xuất thành công');
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await markNotificationAsRead(notifId);
      setNotifications(prev => 
        prev.map(n => n.id === notifId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      toast.error('Không thể cập nhật trạng thái thông báo');
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      };
      setSystemTime(now.toLocaleDateString('vi-VN', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
        const [earn, notifs] = await Promise.all([
          getKTVEarnings(monthStr),
          getKTVNotifications()
        ]);
        setEarnings(earn);
        setNotifications(notifs);
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

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-6 rounded-b-[40px] shadow-sm border-b border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100/50">
            <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">{systemTime}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 relative ${
                  isNotifOpen ? 'bg-primary text-white border-primary shadow-lg shadow-pink-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              <AnimatePresence>
                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black uppercase tracking-widest text-xs text-slate-800">Thông báo</h3>
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase">
                          {unreadCount} Mới
                        </span>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => {
                            // Cấu hình loại thông báo: Lịch ca mới, Đối soát lương, Thông báo hệ thống, Cá nhân
                            const type = notif.type || 'personal';
                            let iconElement = <Bell className="w-4 h-4" />;
                            let badgeLabel = 'Thông báo';
                            let iconBgStyle = '';

                            if (type === 'booking') {
                              iconElement = <CalendarIcon className="w-4 h-4" />;
                              badgeLabel = 'Lịch ca mới';
                              iconBgStyle = !notif.isRead 
                                ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' 
                                : 'bg-indigo-50 text-indigo-400 border border-indigo-100';
                            } else if (type === 'salary' || type === 'payroll') {
                              iconElement = <DollarSign className="w-4 h-4" />;
                              badgeLabel = 'Đối soát lương';
                              iconBgStyle = !notif.isRead 
                                ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                                : 'bg-emerald-50 text-emerald-400 border border-emerald-100';
                            } else if (type === 'system') {
                              iconElement = <Megaphone className="w-4 h-4" />;
                              badgeLabel = 'Hệ thống';
                              iconBgStyle = !notif.isRead 
                                ? 'bg-amber-100 text-amber-600 border border-amber-200' 
                                : 'bg-amber-50 text-amber-400 border border-amber-100';
                            } else {
                              // Personal or default
                              iconElement = <User className="w-4 h-4" />;
                              badgeLabel = 'Cá nhân';
                              iconBgStyle = !notif.isRead 
                                ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                                : 'bg-rose-50 text-rose-400 border border-rose-100';
                            }

                            return (
                              <div 
                                key={notif.id}
                                onClick={() => {
                                  handleMarkAsRead(notif.id);
                                  setIsNotifOpen(false);
                                }}
                                className={`p-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left ${
                                  !notif.isRead ? 'bg-rose-50/30 border-rose-100 font-bold' : 'bg-slate-50/50 border-slate-100 opacity-60'
                                }`}
                              >
                                <div className="flex gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBgStyle}`}>
                                    {iconElement}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <h4 className="font-bold text-xs text-slate-800 truncate">{notif.title}</h4>
                                      <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-black uppercase shrink-0 ${
                                        type === 'booking' ? 'bg-indigo-50 text-indigo-600' :
                                        type === 'salary' || type === 'payroll' ? 'bg-emerald-50 text-emerald-600' :
                                        type === 'system' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                      }`}>
                                        {badgeLabel}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">{notif.message}</p>
                                    <span className="text-[8px] text-slate-400 mt-1 block">
                                      {new Date(notif.createdAt).toLocaleDateString('vi-VN')} {new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-8 text-center">
                            <span className="text-2xl mb-2 block">🔔</span>
                            <p className="text-slate-400 font-bold text-xs italic">Không có thông báo mới</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Settings Button */}
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:text-primary transition-all active:scale-95"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Kỹ thuật viên</p>
          <h1 className="text-2xl font-black text-slate-900">{user?.full_name || 'Kỹ thuật viên'}</h1>
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

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50">
        <Link href="/ktv/dashboard" className="text-primary flex flex-col items-center gap-1">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Lịch ca</span>
        </Link>
        <Link href="/ktv/earnings" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Thu nhập</span>
        </Link>
        <Link href="/ktv/leaderboard" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase">Cá nhân</span>
        </Link>
      </div>

      {/* Profile Setting Drawer */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] shadow-2xl p-6 z-50 max-h-[85vh] overflow-y-auto border-t border-slate-100 flex flex-col"
            >
              {/* Drag Handle Indicator */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Hồ sơ & Thiết lập</h2>
                <button 
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card */}
              <div className="bg-slate-900 text-white p-6 rounded-[32px] mb-6 relative overflow-hidden shadow-xl shadow-slate-200">
                <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-rose-500/20 rounded-full blur-[40px]"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 text-white font-black text-2xl">
                    {user?.full_name?.charAt(0) || 'K'}
                  </div>
                  <div>
                    <h3 className="font-black text-xl">{user?.full_name || 'Kỹ thuật viên'}</h3>
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest mt-1.5 inline-block">
                      {user?.role === 'ktv' ? 'Kỹ thuật viên' : user?.role || 'Kỹ thuật viên'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-white/10 space-y-3 text-xs text-white/70">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{user?.email || 'Chưa cập nhật email'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                    <span>Trạng thái hoạt động: <strong className="text-emerald-400 capitalize">{user?.status || 'Active'}</strong></span>
                  </div>
                </div>
              </div>

              {/* KTV Related Stats */}
              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Thống kê ca làm & KPI tháng này</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Thu nhập ước tính</p>
                    <p className="text-base font-black text-slate-800">{formatCurrency(earnings.total)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Số ca đã chạy</p>
                    <p className="text-base font-black text-slate-800">{earnings.sessions} ca</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Đánh giá trung bình</p>
                    <p className="text-base font-black text-slate-800">5.0 / 5.0 ⭐</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                    Xuất sắc
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mt-auto">
                <button 
                  onClick={handleLogout}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất tài khoản
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
