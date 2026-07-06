'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  getKTVActiveSessions,
  getKTVUpcomingSessions,
  startSession,
  completeKTVSession,
  getKTVEarnings,
  getKTVNotifications,
  markNotificationAsRead,
  getKTVLeaderboard,
  getKTVDashboardData,
} from '@/services/ktv-actions';
import { getKTVTodayAttendance, ktvCheckIn, ktvCheckOut, submitKTVLeaveRequest, getKTVLeaveHistory } from '@/services/attendance-actions';
import { getCurrentUser } from '@/services/user-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { getDefaultTenantModuleKey, type TenantModuleKey } from '@/lib/business-rules/tenant-modules';
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
import { getTenantSettings } from '@/services/tenant-actions';
import { getLocalDateString } from '@/lib/utils';

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
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false); // Track background data loading
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
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null);
  
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
  const [isShiftCheckOutModalOpen, setIsShiftCheckOutModalOpen] = useState(false);

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
  // Re-fetch when profile opens or pending count changes, but don't depend on fetchOfflineActions itself
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, isProfileOpen]);

  const handleLogout = async () => {
    try {
      // Clear user cache before logout
      if (user?.id) {
        const { clearUserCache } = await import('@/lib/offline-db');
        await clearUserCache(user.id);
      }
      
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

  const fetchAttendance = useCallback(async (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;
    
    try {
      const today = getLocalDateString(); // YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
      
      // Try cache first
      const { getCachedAttendance, setCachedAttendance } = await import('@/lib/offline-db');
      const cached = await getCachedAttendance(targetUserId, today);
      
      if (cached) {
        setTodayAttendance(cached);
        // Refresh in background
        getKTVTodayAttendance().then(fresh => {
          setTodayAttendance(fresh);
          void setCachedAttendance(targetUserId, today, fresh);
        }).catch(() => {
          // Silent fail - cached data still valid
        });
        return;
      }
      
      // Cache miss - fetch from API
      const att = await getKTVTodayAttendance();
      setTodayAttendance(att);
      void setCachedAttendance(targetUserId, today, att);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Lỗi khi tải chấm công hôm nay'));
    }
  }, [user?.id]);

  /**
   * Refresh session list silently — does NOT trigger setIsLoading(true).
   * Prevents the full-page white-screen that hides the success toast.
   * Also invalidates session cache.
   */
  const refreshDataSilently = useCallback(async () => {
    try {
      const u = user || await getCurrentUser();
      if (!u) return;
      
      const [active, upcoming] = await Promise.all([
        getKTVActiveSessions(u),
        getKTVUpcomingSessions(u),
      ]);
      setActiveSessions(active);
      setUpcomingSessions(upcoming);
      
      // Update cache with fresh data
      const { setCachedSessions } = await import('@/lib/offline-db');
      void setCachedSessions(u.id, active, upcoming);
    } catch {
      // silent — full fetchData handles errors on next explicit reload
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const perfStart = performance.now();
    const perfMarks: Record<string, number> = {};
    
    try {
      console.log('[KTV Dashboard] ⏱️ Starting data fetch...');
      
      // Import cache helpers
      const cacheImportStart = performance.now();
      const {
        getCachedSessions,
        setCachedSessions,
        getCachedEarnings,
        setCachedEarnings,
        getCachedNotifications,
        setCachedNotifications,
      } = await import('@/lib/offline-db');
      perfMarks['cache_import'] = performance.now() - cacheImportStart;
      
      // Priority 1: Critical data for initial render (show UI ASAP)
      const criticalStart = performance.now();
      const [u, tenant] = await Promise.all([
        getCurrentUser(),
        getTenantSettings(),
      ]);
      perfMarks['critical_data'] = performance.now() - criticalStart;
      console.log(`[KTV Dashboard] ✅ Critical data loaded in ${perfMarks['critical_data'].toFixed(0)}ms`);
      
      if (!u) {
        console.log('[KTV Dashboard] ❌ No user found, aborting');
        setIsLoading(false);
        return;
      }
      
      // Set user and tenantModuleKey together to avoid double render
      const moduleKey = getDefaultTenantModuleKey(tenant?.enabled_modules);
      setUser(u as KtvUser | null);
      setTenantModuleKey(moduleKey);
      
      // IMPORTANT: Don't set isLoading=false until we have moduleKey!
      // Otherwise UI will try to render without tenantModuleKey and show blank screen
      
      // Try to load sessions from cache first
      const cacheCheckStart = performance.now();
      const cachedSessions = await getCachedSessions(u.id);
      perfMarks['cache_check'] = performance.now() - cacheCheckStart;

      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Try to load earnings and notifications from cache immediately
      const [cachedEarnings, cachedNotifs] = await Promise.all([
        getCachedEarnings(u.id, monthStr),
        getCachedNotifications(u.id),
      ]);
      
      if (cachedEarnings) {
        setEarnings(cachedEarnings);
      }
      
      if (cachedNotifs) {
        setNotifications(cachedNotifs as KtvDashboardNotification[]);
      }

      let dashboardPromise: Promise<any>;
      
      if (cachedSessions) {
        console.log(`[KTV Dashboard] 💾 Cache HIT - loaded sessions in ${perfMarks['cache_check'].toFixed(0)}ms`);
        setActiveSessions(cachedSessions.active as KtvDashboardSession[]);
        setUpcomingSessions(cachedSessions.upcoming as KtvDashboardSession[]);
        
        // Only set isLoading=false after we have ALL critical data (user, tenant, moduleKey, sessions)
        setIsLoading(false); // Show UI with cached data immediately
        
        const totalTime = performance.now() - perfStart;
        console.log(`[KTV Dashboard] 🎉 UI READY in ${totalTime.toFixed(0)}ms (cached path)`);
        
        // Fetch fresh data in background using single batched endpoint
        dashboardPromise = getKTVDashboardData(monthStr);
      } else {
        console.log(`[KTV Dashboard] 💨 Cache MISS - fetching all dashboard data in 1 request...`);
        dashboardPromise = getKTVDashboardData(monthStr);
        setIsLoading(true);
        const data = await dashboardPromise;
        if (data) {
          setActiveSessions(data.active as KtvDashboardSession[]);
          setUpcomingSessions(data.upcoming as KtvDashboardSession[]);
          void setCachedSessions(u.id, data.active, data.upcoming);
        }
        setIsLoading(false); // Show UI after fetch
        
        const totalTime = performance.now() - perfStart;
        console.log(`[KTV Dashboard] 🎉 UI READY in ${totalTime.toFixed(0)}ms (API path)`);
      }
      
      // Update other background fields and cache silently when dashboardPromise resolves
      setIsBackgroundLoading(true);
      const bgStart = performance.now();
      dashboardPromise.then((data) => {
        if (!data) return;
        const bgTime = performance.now() - bgStart;
        console.log(`[KTV Dashboard] 📊 Background data loaded in ${bgTime.toFixed(0)}ms`);
        
        setActiveSessions(data.active);
        setUpcomingSessions(data.upcoming);
        setTodayAttendance(data.attendance);
        setEarnings(data.earnings);
        setNotifications(data.notifications);
        const myStats = (data.leaderboard as KtvLeaderboardRow[]).find((k) => k.ktv_id === u.id);
        setMyRating(myStats?.average_rating ?? null);
        
        // Update caches
        void setCachedSessions(u.id, data.active, data.upcoming);
        const today = getLocalDateString();
        import('@/lib/offline-db').then((m) => {
          void m.setCachedAttendance(u.id, today, data.attendance);
          void m.setCachedEarnings(u.id, monthStr, data.earnings);
          void m.setCachedNotifications(u.id, data.notifications);
        });
      }).catch((error) => {
        console.error('[KTV Dashboard] Background data fetch failed:', error);
      }).finally(() => {
        setIsBackgroundLoading(false);
      });
      
      // Summary log
      console.log('[KTV Dashboard] ⚡ Performance Summary:', {
        cache_import: `${perfMarks['cache_import']?.toFixed(0) || 0}ms`,
        critical_data: `${perfMarks['critical_data']?.toFixed(0) || 0}ms`,
        cache_check: `${perfMarks['cache_check']?.toFixed(0) || 0}ms`,
        total_to_ui: `${(performance.now() - perfStart).toFixed(0)}ms`,
      });
    } catch (error) {
      const errorTime = performance.now() - perfStart;
      console.error(`[KTV Dashboard] ❌ Error after ${errorTime.toFixed(0)}ms:`, error);
      setIsLoading(false);
      toast.error(getErrorMessage(error, 'Lỗi khi tải dữ liệu'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - don't depend on fetchAttendance to avoid infinite loop

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only ONCE on mount - fetchData is stable

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
        
        // Invalidate attendance cache first, then fetch fresh data
        if (user?.id) {
          const { clearAttendanceCache } = await import('@/lib/offline-db');
          const today = getLocalDateString();
          await clearAttendanceCache(user.id, today);
        }
        
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

  const handleCheckOut = () => {
    setIsShiftCheckOutModalOpen(true);
  };

  const confirmShiftCheckOut = async () => {
    setIsShiftCheckOutModalOpen(false);
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
        
        // Invalidate attendance cache first, then fetch fresh data
        if (user?.id) {
          const { clearAttendanceCache } = await import('@/lib/offline-db');
          const today = getLocalDateString();
          await clearAttendanceCache(user.id, today);
        }
        
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

  // Guards against double-submission (double-tap on mobile before React disables the button)
  const isStartingRef = useRef<string | null>(null);
  const isCompletingRef = useRef<string | null>(null);

  const handleStart = async (sessionId: string) => {
    // Synchronous guard — blocks re-entry before React's async state update
    if (isStartingRef.current === sessionId) return;
    isStartingRef.current = sessionId;
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
        // Move session from upcoming → active immediately (no white-screen flash)
        setActiveSessions(prev => [
          ...prev,
          ...upcomingSessions.filter(s => s.id === sessionId).map(s => ({
            ...s,
            status: 'in_progress',
            start_time: new Date().toISOString()
          }))
        ]);
        setUpcomingSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success('Đã bắt đầu buổi chăm sóc!');
        // Silent background refresh — does not trigger loading spinner
        setTimeout(() => void refreshDataSilently(), 1500);
      } else {
        toast.error((res && res.error) || 'Không thể bắt đầu buổi chăm sóc');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể bắt đầu buổi chăm sóc'));
    } finally {
      setIsActionLoading(null);
      isStartingRef.current = null;
    }
  };

  const [ktvCheckoutNote, setKtvCheckoutNote] = useState<string>('');

  const handleComplete = async (sessionId: string, notes: string, checkoutNoteVal: string = '') => {
    // Synchronous guard — prevents double-tap from sending two requests
    if (isCompletingRef.current === sessionId) return;
    isCompletingRef.current = sessionId;
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
        // 1. Immediately close modal + remove session from list (instant visual feedback)
        setCheckoutSession(null);
        setCheckoutNotes('');
        setKtvCheckoutNote('');
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
        // 2. Show success toast — stays visible because we do NOT call setIsLoading(true)
        toast.success('Đã hoàn thành buổi chăm sóc!');
        // 3. Silent background refresh after toast has had time to display (2.5s)
        setTimeout(() => void refreshDataSilently(), 2500);
      } else {
        toast.error((res && res.error) || 'Không thể hoàn tất buổi chăm sóc');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể hoàn tất buổi chăm sóc'));
    } finally {
      setIsActionLoading(null);
      isCompletingRef.current = null;
    }
  };


  // Show skeleton if loading OR missing critical data
  if (isLoading || !tenantModuleKey || !user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] dark:bg-[#5D1C34] pb-20">
        {/* Skeleton Header */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-200/60 dark:bg-white/20 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-rose-200/60 dark:bg-white/20 rounded animate-pulse" />
                <div className="h-3 w-24 bg-rose-200/50 dark:bg-white/15 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-200/60 dark:bg-white/20 animate-pulse" />
          </div>
          <div className="h-3 w-full bg-rose-200/40 dark:bg-white/10 rounded animate-pulse" />
        </div>
        
        {/* Skeleton Cards */}
        <div className="px-4 space-y-4 mt-4">
          <div className="h-32 bg-rose-200/40 dark:bg-white/10 rounded-2xl animate-pulse" />
          <div className="h-48 bg-rose-200/40 dark:bg-white/10 rounded-2xl animate-pulse" />
          <div className="h-48 bg-rose-200/40 dark:bg-white/10 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="min-h-screen bg-[#F5F5F0] dark:bg-[#5D1C34] pb-20">
      {/* Background loading indicator - sticky at top */}
      {isBackgroundLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 h-1 animate-pulse">
          <div className="h-full bg-white/30 animate-[shimmer_1.5s_ease-in-out_infinite]" 
               style={{
                 background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                 backgroundSize: '200% 100%',
                 animation: 'shimmer 1.5s ease-in-out infinite'
               }} />
        </div>
      )}
      
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
        tenantModuleKey={tenantModuleKey}
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

      {/* Modal xác nhận check-out ca làm (thay thế window.confirm bị block trên mobile webview) */}
      <AnimatePresence>
        {isShiftCheckOutModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShiftCheckOutModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <div className="fixed inset-0 flex items-end justify-center p-4 z-[101] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="pointer-events-auto w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Xác nhận check-out</p>
                      <p className="text-xs text-slate-400">Ca làm hôm nay</p>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2">Kết thúc ca làm?</h3>
                  <p className="text-xs text-slate-500 mt-1">Hệ thống sẽ ghi nhận giờ check-out ca làm của bạn ngay bây giờ.</p>
                </div>
                <div className="px-6 py-4 flex flex-col gap-2">
                  <button
                    onClick={confirmShiftCheckOut}
                    disabled={isAttendanceLoading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    {isAttendanceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Xác nhận Check-out'}
                  </button>
                  <button
                    onClick={() => setIsShiftCheckOutModalOpen(false)}
                    disabled={isAttendanceLoading}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs py-3.5 rounded-2xl uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                  >
                    Quay lại
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
