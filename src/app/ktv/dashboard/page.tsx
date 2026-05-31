'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Baby,
  KeyRound,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  getKTVActiveSessions,
  getKTVUpcomingSessions,
  startSession,
  completeKTVSession,
  getKTVEarnings,
  getKTVNotifications,
  markNotificationAsRead,
  getKTVLeaderboard,
} from '@/services/ktv-actions';
import { getKTVTodayAttendance, ktvCheckIn, ktvCheckOut, submitKTVLeaveRequest, getKTVLeaveHistory } from '@/services/attendance-actions';
import { getCurrentUser } from '@/services/user-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { KtvAttendanceCard } from './components/KtvAttendanceCard';
import { KtvBottomNav } from './components/KtvBottomNav';
import { KtvCheckinConfirmModal } from './components/KtvCheckinConfirmModal';
import { KtvDashboardHeader } from './components/KtvDashboardHeader';
import { KtvNotificationDetailModal } from './components/KtvNotificationDetailModal';
import { KtvOfflineSyncBanner } from './components/KtvOfflineSyncBanner';
import { KtvProfileDrawer } from './components/KtvProfileDrawer';
import { KtvSessionSections } from './components/KtvSessionSections';

export default function KTVDashboard() {
  const [user, setUser] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, sessions: 0 });
  const [myRating, setMyRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [systemTime, setSystemTime] = useState<string>('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdShowing, setPwdShowing] = useState(false);
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState<string>('');
  const [checkinSession, setCheckinSession] = useState<any | null>(null);
  
  // Attendance States
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Leave Request States
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaveHistoryOpen, setIsLeaveHistoryOpen] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [leaveDate, setLeaveDate] = useState<string>('');
  const [leaveType, setLeaveType] = useState<'full_day' | 'morning' | 'afternoon'>('full_day');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [isLeaveHistoryLoading, setIsLeaveHistoryLoading] = useState(false);

  const fetchLeaveHistory = async () => {
    setIsLeaveHistoryLoading(true);
    try {
      const history = await getKTVLeaveHistory();
      setLeaveHistory(history);
    } catch (e) {
      toast.error('Lỗi khi tải lịch sử nghỉ phép');
    } finally {
      setIsLeaveHistoryLoading(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate) {
      toast.error('Vui lòng chọn ngày nghỉ phép');
      return;
    }
    setIsLeaveSubmitting(true);
    try {
      const res = await submitKTVLeaveRequest({
        leave_date: leaveDate,
        leave_type: leaveType,
        reason: leaveReason
      });
      if (res.success) {
        toast.success('Gửi đơn xin nghỉ phép thành công, vui lòng chờ duyệt!');
        setIsLeaveModalOpen(false);
        setLeaveDate('');
        setLeaveReason('');
        setLeaveType('full_day');
        fetchLeaveHistory();
      } else {
        toast.error(res.error || 'Gửi đơn thất bại');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Có lỗi xảy ra');
    } finally {
      setIsLeaveSubmitting(false);
    }
  };

  const router = useRouter();
  const { isOnline, pendingCount, executeAction, triggerSync, refreshQueue } = useOfflineSync();
  const [offlineActions, setOfflineActions] = useState<any[]>([]);

  const fetchOfflineActions = async () => {
    const { offlineDB } = await import('@/lib/offline-db');
    if (offlineDB) {
      const actions = await offlineDB.offlineQueue.toArray();
      setOfflineActions(actions);
    }
  };

  const handleDiscardAction = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy bỏ thao tác ngoại tuyến này? Thao tác bị hủy sẽ không thể khôi phục.')) return;
    const { offlineDB } = await import('@/lib/offline-db');
    if (offlineDB) {
      await offlineDB.offlineQueue.delete(id);
      toast.success('Đã hủy bỏ thao tác ngoại tuyến thành công!');
      await refreshQueue();
      await fetchOfflineActions();
    }
  };


  useEffect(() => {
    fetchOfflineActions();
  }, [pendingCount, isProfileOpen]);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pwdNew !== pwdConfirm) {
      toast.error('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (pwdNew.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (pwdNew === pwdCurrent) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setIsChangingPwd(true);
    const supabase = createClient();
    try {
      const { data: { user: authUser }, error: getUserErr } = await supabase.auth.getUser();
      if (getUserErr || !authUser?.email) {
        toast.error('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
        return;
      }

      // Verify current password by attempting re-login (doesn't actually rotate session)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: pwdCurrent,
      });
      if (signInErr) {
        toast.error('Mật khẩu hiện tại không đúng');
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: pwdNew });
      if (updateErr) {
        toast.error('Không thể đổi mật khẩu: ' + updateErr.message);
        return;
      }

      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      setIsPasswordOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'lỗi không xác định';
      toast.error('Đã xảy ra lỗi: ' + msg);
    } finally {
      setIsChangingPwd(false);
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

  const fetchAttendance = async () => {
    try {
      const att = await getKTVTodayAttendance();
      setTodayAttendance(att);
    } catch (e) {
      console.error(e);
    }
  };

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
        const [earn, notifs, lb] = await Promise.all([
          getKTVEarnings(monthStr),
          getKTVNotifications(),
          getKTVLeaderboard(monthStr),
        ]);
        fetchAttendance();
        setEarnings(earn);
        setNotifications(notifs);
        const myStats = lb.find((k: any) => k.ktv_id === u.id);
        setMyRating(myStats?.average_rating ?? null);
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

  const handleCheckIn = async () => {
    setIsAttendanceLoading(true);
    try {
      const res = await executeAction('KTV_SHIFT_CHECKIN', {}, () => ktvCheckIn());
      if (res && res.offline) {
        setTodayAttendance({
          checkin_time: new Date().toISOString(),
          status: 'present'
        });
      } else if (res && res.success) {
        toast.success(res.data?.status === 'late' ? 'Check-in thành công (Trễ giờ)!' : 'Check-in thành công!');
        fetchAttendance();
      } else {
        toast.error((res && res.error) || 'Check-in thất bại');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Check-in thất bại');
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn Check-out ca làm việc hôm nay?')) return;
    setIsAttendanceLoading(true);
    try {
      const res = await executeAction('KTV_SHIFT_CHECKOUT', {}, () => ktvCheckOut());
      if (res && res.offline) {
        setTodayAttendance((prev: any) => ({
          ...prev,
          checkout_time: new Date().toISOString()
        }));
      } else if (res && res.success) {
        toast.success('Check-out thành công!');
        fetchAttendance();
      } else {
        toast.error((res && res.error) || 'Check-out thất bại');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Check-out thất bại');
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const handleStart = async (sessionId: string) => {
    setIsActionLoading(sessionId);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        if ('geolocation' in navigator) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true
            });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
        }
      } catch (geoError) {
        console.warn('Geolocation failed:', geoError);
        toast.warning('Không thể xác định vị trí GPS. Ca làm việc vẫn được bắt đầu.');
      }

      const res = await executeAction('CHECKIN', { sessionId, lat, lon }, () => startSession(sessionId, lat, lon));
      if (res && res.offline) {
        setActiveSessions(prev => [
          ...prev,
          ...upcomingSessions.filter(s => s.id === sessionId).map(s => ({
            ...s,
            status: 'in_progress',
            start_time: new Date().toISOString()
          }))
        ]);
        setUpcomingSessions(prev => prev.filter(s => s.id !== sessionId));
      } else if (res && res.success) {
        toast.success('Đã bắt đầu buổi chăm sóc!');
        fetchData();
      } else {
        toast.error((res && res.error) || 'Không thể bắt đầu buổi chăm sóc');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể bắt đầu buổi chăm sóc');
    } finally {
      setIsActionLoading(null);
    }
  };

  const [ktvCheckoutNote, setKtvCheckoutNote] = useState<string>('');

  const handleComplete = async (sessionId: string, notes: string, checkoutNoteVal: string = '') => {
    setIsActionLoading(sessionId);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        if ('geolocation' in navigator) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true
            });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
        }
      } catch (geoError) {
        console.warn('Geolocation checkout failed:', geoError);
        toast.warning('Không thể xác định vị trí GPS check-out. Ca làm việc vẫn được hoàn tất.');
      }

      const res = await executeAction(
        'CHECKOUT',
        { sessionId, notes, ktvCheckoutNote: checkoutNoteVal, lat, lon },
        () => completeKTVSession(sessionId, notes, checkoutNoteVal, lat, lon)
      );
      if (res && res.offline) {
        setCheckoutSession(null);
        setCheckoutNotes('');
        setKtvCheckoutNote('');
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
      } else if (res && res.success) {
        toast.success('Đã hoàn thành buổi chăm sóc!');
        setCheckoutSession(null);
        setCheckoutNotes('');
        setKtvCheckoutNote('');
        fetchData();
      } else {
        toast.error((res && res.error) || 'Không thể hoàn tất buổi chăm sóc');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể hoàn tất buổi chăm sóc');
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
      <KtvDashboardHeader
        user={user}
        earnings={earnings}
        systemTime={systemTime}
        isOnline={isOnline}
        pendingCount={pendingCount}
        isNotifOpen={isNotifOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        onToggleNotifications={() => setIsNotifOpen((current) => !current)}
        onCloseNotifications={() => setIsNotifOpen(false)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onRefresh={() => window.location.reload()}
        onTriggerSync={triggerSync}
        onMarkAsRead={handleMarkAsRead}
        onSelectNotification={setSelectedNotif}
      />

      <KtvOfflineSyncBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        onTriggerSync={triggerSync}
      />

      <KtvAttendanceCard
        todayAttendance={todayAttendance}
        isAttendanceLoading={isAttendanceLoading}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
        onOpenLeaveHistory={() => {
          setIsLeaveHistoryOpen(true);
          fetchLeaveHistory();
        }}
      />

      <KtvSessionSections
        activeSessions={activeSessions}
        upcomingSessions={upcomingSessions}
        currentUserId={user?.id}
        isActionLoading={isActionLoading}
        onOpenCheckout={(session) => {
          setCheckoutSession(session);
          setCheckoutNotes('');
        }}
        onOpenCheckin={setCheckinSession}
      />

      <KtvBottomNav />

      <KtvProfileDrawer
        isOpen={isProfileOpen}
        user={user}
        earnings={earnings}
        myRating={myRating}
        offlineActions={offlineActions}
        isOnline={isOnline}
        onClose={() => setIsProfileOpen(false)}
        onOpenPassword={() => {
          setIsProfileOpen(false);
          setIsPasswordOpen(true);
        }}
        onLogout={handleLogout}
        onDiscardAction={handleDiscardAction}
        onTriggerSync={triggerSync}
      />

      {/* Change Password Modal */}
      <AnimatePresence>
        {isPasswordOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => !isChangingPwd && setIsPasswordOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto relative"
              >
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 rounded-t-[32px]" />

                <button
                  onClick={() => setIsPasswordOpen(false)}
                  disabled={isChangingPwd}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="mt-4 flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-md bg-rose-100 text-rose-600 border border-rose-200/50 shadow-rose-100">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Đổi mật khẩu</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Nhập mật khẩu hiện tại để xác nhận, rồi đặt mật khẩu mới.</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {/* Current */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Mật khẩu hiện tại
                    </label>
                    <div className="relative">
                      <input
                        type={pwdShowing ? 'text' : 'password'}
                        value={pwdCurrent}
                        onChange={(e) => setPwdCurrent(e.target.value)}
                        autoComplete="current-password"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setPwdShowing((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {pwdShowing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <KeyRound className="w-3 h-3" /> Mật khẩu mới (tối thiểu 6 ký tự)
                    </label>
                    <input
                      type={pwdShowing ? 'text' : 'password'}
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                      placeholder="••••••••"
                    />
                  </div>

                  {/* Confirm */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> Xác nhận mật khẩu mới
                    </label>
                    <input
                      type={pwdShowing ? 'text' : 'password'}
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPwd}
                    className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 mt-2"
                  >
                    {isChangingPwd ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Đang cập nhật...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Xác nhận đổi mật khẩu
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <KtvNotificationDetailModal
        notification={selectedNotif}
        onClose={() => setSelectedNotif(null)}
        onShowTodayScheduleHint={() => {
          setSelectedNotif(null);
          toast.success('Hãy xem danh sách \u0027Lịch hôm nay\u0027 bên dưới!');
        }}
      />

      {/* Checkout Confirmation Modal */}
      <AnimatePresence>
        {checkoutSession && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (isActionLoading === null) setCheckoutSession(null);
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            {/* Modal Box */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
              {(() => {
                let elapsedMinutes = 0;
                let standardDuration = 60;
                let timeDeviation = 0;
                let isUnderTime = false;
                let isOverTime = false;

                if (checkoutSession) {
                  const startTime = checkoutSession.start_time ? new Date(checkoutSession.start_time) : null;
                  if (startTime) {
                    elapsedMinutes = Math.round((new Date().getTime() - startTime.getTime()) / 60000);
                  }
                  const durationStr = checkoutSession.bookings?.packages?.duration;
                  if (durationStr) {
                    const match = durationStr.match(/(\d+)/);
                    if (match) {
                      standardDuration = parseInt(match[1], 10);
                    }
                  }
                  timeDeviation = elapsedMinutes - standardDuration;
                  isUnderTime = timeDeviation < 0 && Math.abs(timeDeviation) > 5;
                  isOverTime = timeDeviation > 0;
                }

                const isCheckoutDisabled = isUnderTime && !ktvCheckoutNote.trim();

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 350 }}
                    className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto flex flex-col relative overflow-hidden max-h-[90vh] overflow-y-auto"
                  >
                    {/* Decorative emerald header line */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
                    
                    {/* Close Button */}
                    <button 
                      onClick={() => {
                        if (isActionLoading === null) setCheckoutSession(null);
                      }}
                      disabled={isActionLoading !== null}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Content */}
                    <div className="mt-4 flex flex-col items-center text-center">
                      {/* Large Check circle icon */}
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-md shadow-emerald-50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>

                      {/* Badge */}
                      <span className="text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest mb-3 bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Xác nhận hoàn thành
                      </span>

                      {/* Title */}
                      <h3 className="text-lg font-black text-slate-900 leading-tight mb-4 px-2">
                        Hoàn thành buổi chăm sóc?
                      </h3>

                      {/* Session Summary Card */}
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full text-left space-y-3 mb-5">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-block mb-1">
                              {checkoutSession.bookings?.package_name}
                            </span>
                            <div className="font-black text-sm text-slate-800 truncate">{checkoutSession.bookings?.customers?.name_mother}</div>
                            <div className="text-xs text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                              <Baby className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Bé: {checkoutSession.bookings?.customers?.name_baby || 'Chưa sinh/Chưa có'}</span>
                            </div>
                          </div>
                          <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ml-2">
                            Buổi {checkoutSession.session_number}/{checkoutSession.bookings?.total_sessions || '--'}
                          </span>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Bắt đầu: {new Date(checkoutSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>Hôm nay ({elapsedMinutes} phút)</span>
                        </div>
                      </div>

                      {/* Warning Banners */}
                      {isUnderTime && (
                        <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 text-left mb-5">
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-1">⚠️ Cảnh báo thiếu thời gian</p>
                          <p className="text-xs text-rose-600 font-bold leading-normal">
                            Bạn làm chưa đủ thời gian tiêu chuẩn của gói liệu trình ({standardDuration} phút). Thực tế chỉ mới thực hiện được {elapsedMinutes} phút (thiếu {Math.abs(timeDeviation)} phút).
                          </p>
                          <p className="text-[10px] text-rose-500 italic mt-2">
                            * Vui lòng nhập lý do cụ thể ở phần phản hồi bắt buộc dưới đây.
                          </p>
                        </div>
                      )}

                      {isOverTime && (
                        <div className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-5">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">⏰ Cảnh báo quá giờ</p>
                          <p className="text-xs text-amber-600 font-bold leading-normal">
                            Bạn đã làm quá thời gian quy định của gói ({standardDuration} phút). Hãy sắp xếp nhanh để kịp ca chăm khách theo lịch phía sau!
                          </p>
                        </div>
                      )}

                      {/* Mandatory warning note for under-time */}
                      {isUnderTime && (
                        <div className="w-full text-left mb-4">
                          <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-2 block">
                            Lý do làm thiếu thời gian (Bắt buộc)
                          </label>
                          <textarea
                            value={ktvCheckoutNote}
                            onChange={(e) => setKtvCheckoutNote(e.target.value)}
                            placeholder="Nhập lý do vì sao buổi chăm sóc kết thúc sớm (ví dụ: Bé quấy khóc, Khách yêu cầu dừng sớm...)"
                            disabled={isActionLoading !== null}
                            className="w-full border border-rose-200 focus:ring-rose-500 rounded-2xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all min-h-[80px] resize-none"
                          />
                        </div>
                      )}

                      {/* Notes input */}
                      <div className="w-full text-left mb-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                          Ghi chú chăm sóc (không bắt buộc)
                        </label>
                        <textarea
                          value={checkoutNotes}
                          onChange={(e) => setCheckoutNotes(e.target.value)}
                          placeholder="Nhập tình trạng của bé, sữa bé uống, lưu ý cho buổi sau..."
                          disabled={isActionLoading !== null}
                          className="w-full border border-slate-200 rounded-2xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[80px] resize-none"
                        />
                      </div>
                    </div>

                    {/* Footer CTA Actions */}
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleComplete(checkoutSession.id, checkoutNotes, ktvCheckoutNote)}
                        disabled={isActionLoading !== null || isCheckoutDisabled}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100 disabled:opacity-50"
                      >
                        {isActionLoading !== null ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Xác nhận & Check-out
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => setCheckoutSession(null)}
                        disabled={isActionLoading !== null}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                      >
                        Quay lại
                      </button>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </>
        )}
      </AnimatePresence>

      <KtvCheckinConfirmModal
        session={checkinSession}
        isActionLoading={isActionLoading}
        onClose={() => setCheckinSession(null)}
        onConfirm={async (session) => {
          setCheckinSession(null);
          await handleStart(session.id);
        }}
      />

      {/* Leave Request Form Modal */}
      <AnimatePresence>
        {isLeaveModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            {/* Modal Box */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto flex flex-col relative overflow-hidden max-h-[90vh]"
              >
                {/* Header pattern / decorative background */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500" />
                
                {/* Close Button */}
                <button 
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="mt-2 mb-6">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Đăng ký nghỉ phép</h3>
                  <p className="text-xs text-slate-400 font-medium">Gửi yêu cầu nghỉ phép đến Quản trị viên</p>
                </div>

                <form onSubmit={handleLeaveSubmit} className="space-y-4 flex-grow overflow-y-auto pr-1">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                      Chọn ngày nghỉ phép
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}
                      className="w-full border border-slate-200 focus:ring-rose-500 focus:border-transparent rounded-2xl p-4 min-h-[56px] text-[16px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                      Thời gian nghỉ
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['full_day', 'morning', 'afternoon'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLeaveType(t)}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                            leaveType === t
                              ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-100 dark:shadow-none'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t === 'full_day' ? 'Cả ngày' : t === 'morning' ? 'Sáng' : 'Chiều'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                      Lý do xin nghỉ
                    </label>
                    <textarea
                      required
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Nêu rõ lý do cụ thể để quản lý duyệt..."
                      rows={3}
                      className="w-full border border-slate-200 focus:ring-rose-500 focus:border-transparent rounded-2xl p-4 text-[16px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLeaveSubmitting}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 dark:shadow-none disabled:opacity-50 mt-4 animate-pulse"
                  >
                    {isLeaveSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Gửi đơn xin nghỉ'
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Leave History Modal */}
      <AnimatePresence>
        {isLeaveHistoryOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveHistoryOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            {/* Modal Box */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto flex flex-col relative overflow-hidden max-h-[80vh]"
              >
                {/* Header pattern / decorative background */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900" />
                
                {/* Close Button */}
                <button 
                  onClick={() => setIsLeaveHistoryOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="mt-2 mb-6">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Lịch sử nghỉ phép</h3>
                  <p className="text-xs text-slate-400 font-medium">Danh sách đơn xin nghỉ phép của bạn</p>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
                  {isLeaveHistoryLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-2" />
                      <p className="text-xs text-slate-400 font-bold animate-pulse">Đang tải lịch sử...</p>
                    </div>
                  ) : leaveHistory.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-xs text-slate-400 font-bold">Bạn chưa gửi đơn xin nghỉ phép nào</p>
                    </div>
                  ) : (
                    leaveHistory.map((leave) => {
                      const formattedDate = new Date(leave.leave_date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                      
                      const statusColor = 
                        leave.status === 'approved' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : leave.status === 'rejected' 
                          ? 'bg-rose-50 text-rose-700 border-rose-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100';
                          
                      const statusText = 
                        leave.status === 'approved' 
                          ? 'Đã duyệt' 
                          : leave.status === 'rejected' 
                          ? 'Từ chối' 
                          : 'Chờ duyệt';

                      return (
                        <div key={leave.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-slate-800">{formattedDate}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${statusColor}`}>
                              {statusText}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold flex gap-3">
                            <span>Ca: <strong className="text-slate-700 uppercase">{leave.leave_type === 'full_day' ? 'Cả ngày' : leave.leave_type === 'morning' ? 'Sáng' : 'Chiều'}</strong></span>
                            <span>Gửi ngày: {new Date(leave.created_at).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                            {leave.reason}
                          </div>
                          {leave.status === 'rejected' && leave.rejection_reason && (
                            <div className="text-[10px] text-rose-600 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50 leading-relaxed font-medium">
                              <strong>Lý do từ chối:</strong> {leave.rejection_reason}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
