'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
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
import { KtvAttendanceCard, type KtvTodayAttendance } from './components/KtvAttendanceCard';
import { KtvBottomNav } from './components/KtvBottomNav';
import { KtvChangePasswordModal } from './components/KtvChangePasswordModal';
import { KtvCheckinConfirmModal } from './components/KtvCheckinConfirmModal';
import { KtvCheckoutConfirmModal } from './components/KtvCheckoutConfirmModal';
import { KtvDashboardHeader, type KtvDashboardNotification } from './components/KtvDashboardHeader';
import { KtvLeaveHistoryModal, KtvLeaveRequestModal, type KtvLeaveHistoryItem, type KtvLeaveType } from './components/KtvLeaveModals';
import { KtvNotificationDetailModal } from './components/KtvNotificationDetailModal';
import { KtvOfflineSyncBanner } from './components/KtvOfflineSyncBanner';
import { KtvProfileDrawer, type KtvOfflineAction, type KtvProfileUser } from './components/KtvProfileDrawer';
import { KtvSessionSections, type KtvDashboardSession } from './components/KtvSessionSections';

type KtvUser = NonNullable<KtvProfileUser> & {
  id: string;
};

type KtvLeaderboardRow = {
  ktv_id?: string | null;
  average_rating?: number | null;
};

type OfflineActionResult<T = unknown> = {
  success?: boolean;
  offline?: boolean;
  data?: T;
  error?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function KTVDashboard() {
  const [user, setUser] = useState<KtvUser | null>(null);
  const [activeSessions, setActiveSessions] = useState<KtvDashboardSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<KtvDashboardSession[]>([]);
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
  const [selectedNotif, setSelectedNotif] = useState<KtvDashboardNotification | null>(null);
  const [notifications, setNotifications] = useState<KtvDashboardNotification[]>([]);
  const [checkoutSession, setCheckoutSession] = useState<KtvDashboardSession | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState<string>('');
  const [checkinSession, setCheckinSession] = useState<KtvDashboardSession | null>(null);
  
  // Attendance States
  const [todayAttendance, setTodayAttendance] = useState<KtvTodayAttendance>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Leave Request States
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaveHistoryOpen, setIsLeaveHistoryOpen] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState<KtvLeaveHistoryItem[]>([]);
  const [leaveDate, setLeaveDate] = useState<string>('');
  const [leaveType, setLeaveType] = useState<KtvLeaveType>('full_day');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [isLeaveHistoryLoading, setIsLeaveHistoryLoading] = useState(false);

  const fetchLeaveHistory = useCallback(async () => {
    setIsLeaveHistoryLoading(true);
    try {
      const history = await getKTVLeaveHistory();
      setLeaveHistory(history);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi khi tải lịch sử nghỉ phép'));
    } finally {
      setIsLeaveHistoryLoading(false);
    }
  }, []);

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
    } catch (error) {
      toast.error(getErrorMessage(error, 'Có lỗi xảy ra'));
    } finally {
      setIsLeaveSubmitting(false);
    }
  };

  const router = useRouter();
  const { isOnline, pendingCount, executeAction, triggerSync, refreshQueue } = useOfflineSync();
  const [offlineActions, setOfflineActions] = useState<KtvOfflineAction[]>([]);

  const fetchOfflineActions = useCallback(async () => {
    const { offlineDB } = await import('@/lib/offline-db');
    if (offlineDB) {
      const actions = await offlineDB.offlineQueue.toArray();
      setOfflineActions(actions);
    }
  }, []);

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
    const timeout = window.setTimeout(() => {
      void fetchOfflineActions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchOfflineActions, pendingCount, isProfileOpen]);

  const handleLogout = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Đăng xuất thành công');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
    } catch {
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

  const fetchAttendance = useCallback(async () => {
    try {
      const att = await getKTVTodayAttendance();
      setTodayAttendance(att);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi khi tải chấm công hôm nay'));
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [u, active, upcoming] = await Promise.all([
        getCurrentUser(),
        getKTVActiveSessions(),
        getKTVUpcomingSessions()
      ]);
      
      setUser(u as KtvUser | null);
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
        void fetchAttendance();
        setEarnings(earn);
        setNotifications(notifs);
        const myStats = (lb as KtvLeaderboardRow[]).find((k) => k.ktv_id === u.id);
        setMyRating(myStats?.average_rating ?? null);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi khi tải dữ liệu'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAttendance]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchData]);

  const handleCheckIn = async () => {
    setIsAttendanceLoading(true);
    try {
      const res = await executeAction('KTV_SHIFT_CHECKIN', {}, () => ktvCheckIn()) as OfflineActionResult<{ status?: string }>;
      if (res && res.offline) {
        setTodayAttendance({
          checkin_time: new Date().toISOString(),
          status: 'present'
        });
      } else if (res && res.success) {
        toast.success(res.data?.status === 'late' ? 'Check-in thành công (Trễ giờ)!' : 'Check-in thành công!');
        void fetchAttendance();
      } else {
        toast.error((res && res.error) || 'Check-in thất bại');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Check-in thất bại'));
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn Check-out ca làm việc hôm nay?')) return;
    setIsAttendanceLoading(true);
    try {
      const res = await executeAction('KTV_SHIFT_CHECKOUT', {}, () => ktvCheckOut()) as OfflineActionResult;
      if (res && res.offline) {
        setTodayAttendance((prev) => ({
          ...prev,
          checkout_time: new Date().toISOString()
        }));
      } else if (res && res.success) {
        toast.success('Check-out thành công!');
        void fetchAttendance();
      } else {
        toast.error((res && res.error) || 'Check-out thất bại');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Check-out thất bại'));
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

      const res = await executeAction('CHECKIN', { sessionId, lat, lon }, () => startSession(sessionId, lat, lon)) as OfflineActionResult;
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
        void fetchData();
      } else {
        toast.error((res && res.error) || 'Không thể bắt đầu buổi chăm sóc');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể bắt đầu buổi chăm sóc'));
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
      ) as OfflineActionResult;
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
        void fetchData();
      } else {
        toast.error((res && res.error) || 'Không thể hoàn tất buổi chăm sóc');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể hoàn tất buổi chăm sóc'));
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

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

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

      <KtvChangePasswordModal
        isOpen={isPasswordOpen}
        currentPassword={pwdCurrent}
        newPassword={pwdNew}
        confirmPassword={pwdConfirm}
        isPasswordVisible={pwdShowing}
        isChangingPassword={isChangingPwd}
        onClose={() => setIsPasswordOpen(false)}
        onSubmit={handleChangePassword}
        onCurrentPasswordChange={setPwdCurrent}
        onNewPasswordChange={setPwdNew}
        onConfirmPasswordChange={setPwdConfirm}
        onTogglePasswordVisibility={() => setPwdShowing((current) => !current)}
      />

      <KtvNotificationDetailModal
        notification={selectedNotif}
        onClose={() => setSelectedNotif(null)}
        onShowTodayScheduleHint={() => {
          setSelectedNotif(null);
          toast.success('Hãy xem danh sách \u0027Lịch hôm nay\u0027 bên dưới!');
        }}
      />

      <KtvCheckoutConfirmModal
        session={checkoutSession}
        checkoutNotes={checkoutNotes}
        ktvCheckoutNote={ktvCheckoutNote}
        isActionLoading={isActionLoading}
        onClose={() => setCheckoutSession(null)}
        onCheckoutNotesChange={setCheckoutNotes}
        onKtvCheckoutNoteChange={setKtvCheckoutNote}
        onConfirm={(session, notes, checkoutNote) => handleComplete(session.id, notes, checkoutNote)}
      />

      <KtvCheckinConfirmModal
        session={checkinSession}
        isActionLoading={isActionLoading}
        onClose={() => setCheckinSession(null)}
        onConfirm={async (session) => {
          setCheckinSession(null);
          await handleStart(session.id);
        }}
      />

      <KtvLeaveRequestModal
        isOpen={isLeaveModalOpen}
        leaveDate={leaveDate}
        leaveType={leaveType}
        leaveReason={leaveReason}
        isSubmitting={isLeaveSubmitting}
        minLeaveDate={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={handleLeaveSubmit}
        onLeaveDateChange={setLeaveDate}
        onLeaveTypeChange={setLeaveType}
        onLeaveReasonChange={setLeaveReason}
      />

      <KtvLeaveHistoryModal
        isOpen={isLeaveHistoryOpen}
        leaveHistory={leaveHistory}
        isLoading={isLeaveHistoryLoading}
        onClose={() => setIsLeaveHistoryOpen(false)}
      />
    </div>
  );
}
