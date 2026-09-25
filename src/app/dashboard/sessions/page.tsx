'use client';

import { createClient } from '@/lib/supabase-client';
import { resolvePackageName } from '@bella/shared';
import { cn } from '@/lib/utils';;
import { reusePackage } from '@/core/services/order';
import {
completeSession,
getSessionLogs,
getSessionsWithDetails,
saveSessionNote
} from '@/core/services/order';
import { getPendingLeaveRequests } from '@/services/attendance-actions';
import { useUser } from '@/lib/user-context';
import { useProgressiveLoad } from '@/hooks/useProgressiveLoad';
import { AnimatePresence,motion } from 'framer-motion';
import {
Calendar,
CheckCircle2,
Filter,
Loader2,
Search,
ShieldCheck,
TrendingUp,
UserCircle
} from 'lucide-react';
import { useRouter,useSearchParams } from 'next/navigation';
import { Suspense,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { toast } from 'sonner';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import { SessionCard } from './components/SessionCard';
import { LeaveRequest,SessionBooking } from './types';
import dynamic from 'next/dynamic';

const LeaveApprovalModal = dynamic(
  () => import('./components/LeaveApprovalModal').then(m => m.LeaveApprovalModal),
  { ssr: false }
);

const SessionLogsDetailsModal = dynamic(
  () => import('./components/SessionLogsDetailsModal').then(m => m.SessionLogsDetailsModal),
  { ssr: false }
);

function getErrorMessage(error: unknown, fallback = 'Loi khong xac dinh') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function SessionsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[2rem] border border-slate-100 bg-white/80 p-6 shadow-sm sm:rounded-[2.5rem] sm:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-6 w-full max-w-md animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-full max-w-xs animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100 lg:w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionsContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialBookingId = searchParams.get('bookingId') || '';
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const [sessions, setSessions] = useState<SessionBooking[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionBooking[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLoadedSessions, setHasLoadedSessions] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Cập nhật thành công!');
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [sortFilter, setSortFilter] = useState('Ngày tạo mới nhất');
  const [userRole, setUserRole] = useState<'KTV' | 'admin' | ''>('');
  const [selectedBooking, setSelectedBooking] = useState<SessionBooking | null>(null);
  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const vocab = useModuleVocabulary(tenantModuleKey);
  const sessionPageTitle = vocab.booking.singular;
  const sessionPageSubtitle = `Quản lý lộ trình & ghi chú ${vocab.service.singular.toLowerCase()}`;
  const sessionSearchPlaceholder = `Tìm tên khách, hồ sơ, SĐT, ${vocab.worker.short}, tên gói...`;
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const activeBooking = useMemo(() => {
    if (!selectedBooking) return null;
    return sessions.find((s) => s.id === selectedBooking.id) || selectedBooking;
  }, [sessions, selectedBooking]);

  // Admin Leave Approval States
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [isLeavesOpen, setIsLeavesOpen] = useState(false);

  const today = new Date().toLocaleDateString('sv-SE');
  const statusOptions = ['Tất cả trạng thái', `Đang ${vocab.service.singular.toLowerCase()}`, 'Hoàn thành', 'Quá hạn (Trễ lịch)'];
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: 'all', label: 'Tất cả tháng' },
    ...Array.from({length:12}, (_,i) => ({ value: String(i+1).padStart(2,'0'), label: `Tháng ${i+1}` }))
  ];
  const yearOptions = Array.from({length:4}, (_,i) => String(currentYear - i));

  const loadPendingLeaves = useCallback(async () => {
    try {
      const leaves = await getPendingLeaveRequests() as LeaveRequest[];
      setPendingLeaves(leaves);
    } catch (err: unknown) {
      console.error("Failed to load pending leaves:", err);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const options = initialBookingId ? undefined : { year: yearFilter, month: monthFilter };
      const data = await getSessionsWithDetails(options) as SessionBooking[];
      setSessions(data || []);
      return data;
    } catch (error: unknown) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      toast.error('Không thể tải danh sách buổi dịch vụ: ' + getErrorMessage(error));
      return [];
    } finally {
      setHasLoadedSessions(true);
      setIsSyncing(false);
    }
  }, [initialBookingId, monthFilter, yearFilter]);

  const scheduleSessionsReload = useCallback(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadSessions();
    }, 400);
  }, [loadSessions]);

  // ── Progressive Data Loading ───────────────────────────────────────────────
  const { criticalReady } = useProgressiveLoad({
    critical: async () => {
      if (!user) return;
      // 1. Get user details from pre-warmed context
      const role = user.role?.toLowerCase() === 'admin' ? 'admin' : 'KTV';
      setUserRole(role);
      
      // 2. Fetch primary session data
      await loadSessions();
    },
    secondary: async () => {
      if (user?.role?.toLowerCase() === 'admin') {
        await loadPendingLeaves();
      }
    },
    deps: [loadSessions, loadPendingLeaves, user],
  });

  // REALTIME SUBSCRIPTION EFFECT
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        scheduleSessionsReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        scheduleSessionsReload();
      })
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [scheduleSessionsReload]);


  const handleSoftRefresh = useCallback(async () => {
    await Promise.all([
      loadSessions(),
      refreshTenantModuleKey(),
      userRole === 'admin' ? loadPendingLeaves() : Promise.resolve(),
    ]);
  }, [loadPendingLeaves, loadSessions, refreshTenantModuleKey, userRole]);

  usePageRefresh(handleSoftRefresh);

  // Dedicated Effect for Auto-opening from URL - Runs once after first data load
  useEffect(() => {
    if (initialBookingId && sessions.length > 0 && !hasAutoOpened) {
      const target = sessions.find((s) => s.id === initialBookingId);
      if (target) {
        setSelectedBooking(target);
        setHasAutoOpened(true);
      }
    }
  }, [initialBookingId, sessions, hasAutoOpened]);

  const handleCloseModal = () => {
    setSelectedBooking(null);
    // Clear bookingId from URL without full page reload
    const params = new URLSearchParams(searchParams.toString());
    params.delete('bookingId');
    const newPath = params.toString() ? `/dashboard/sessions?${params.toString()}` : '/dashboard/sessions';
    router.replace(newPath, { scroll: false });
  };

  const applyFilters = useCallback((data: SessionBooking[], query: string, status: string, sort: string) => {
    let result = [...data];
    
    if (query) {
      const q = query.toLowerCase().trim();
      result = result.filter(s => {
        const pkgName    = resolvePackageName(s).toLowerCase();
        const ktvName    = s.assigned_ktv?.full_name?.toLowerCase() || s.assigned_ktv_name?.toLowerCase() || '';
        const motherName = s.customers?.name_mother?.toLowerCase() || '';
        const babyName   = s.customers?.name_baby?.toLowerCase() || '';
        const bNumber    = s.booking_number?.toLowerCase() || '';
        const phone      = s.customers?.phone || '';
        const dobBaby    = s.customers?.dob_expected || '';
        return motherName.includes(q) || babyName.includes(q) || bNumber.includes(q)
            || pkgName.includes(q) || ktvName.includes(q) || phone.includes(q)
            || dobBaby.includes(q);
      });
    }
    
    if (status !== 'Tất cả trạng thái') {
      if (status === 'Đang chăm sóc') {
        result = result.filter(s => (s.completed_sessions || 0) < (s.total_sessions || 15));
      } else if (status === 'Hoàn thành') {
        result = result.filter(s => (s.completed_sessions || 0) >= (s.total_sessions || 15));
      } else if (status === 'Quá hạn (Trễ lịch)') {
        // Buổi scheduled nhưng next_session_date đã qua, admin chưa dời lịch
        result = result.filter(s =>
          s.status !== 'cancelled' &&
          (s.completed_sessions || 0) < (s.total_sessions || 15) &&
          !!s.next_session_date &&
          s.next_session_date < today
        );
      }
    }

    if (sort === 'Ngày tạo mới nhất') {
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else if (sort === 'Ngày tạo cũ nhất') {
      result.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    } else if (sort === 'Tên A-Z') {
      result.sort((a, b) => {
        const nameA = a.customers?.name_mother || '';
        const nameB = b.customers?.name_mother || '';
        return nameA.localeCompare(nameB);
      });
    } else if (sort === 'Tên Z-A') {
      result.sort((a, b) => {
        const nameA = a.customers?.name_mother || '';
        const nameB = b.customers?.name_mother || '';
        return nameB.localeCompare(nameA);
      });
    }
    
    setFilteredSessions(result);
  }, [today]);

  useEffect(() => {
    applyFilters(sessions, searchQuery, statusFilter, sortFilter);
  }, [applyFilters, searchQuery, statusFilter, sortFilter, sessions]);


  // Date filter applied on top of text+status filter
  const displaySessions = useMemo(() => {
    if (monthFilter === 'all' && !yearFilter) return filteredSessions;
    return filteredSessions.filter(s => {
      const ref = s.created_at || s.start_date || '';
      const okMonth = monthFilter === 'all' || ref.slice(5,7) === monthFilter;
      const okYear  = !yearFilter            || ref.slice(0,4) === yearFilter;
      return okMonth && okYear;
    });
  }, [filteredSessions, monthFilter, yearFilter]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortFilter, monthFilter, yearFilter]);

  const totalPages = Math.ceil(displaySessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    return displaySessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [displaySessions, currentPage]);

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, displaySessions.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isUpdatedToday = (booking: SessionBooking) => {
    const today = new Date().toLocaleDateString('sv-SE');
    return booking.last_updated_date === today;
  };

  const handleUpdateProgress = async (bookingId: string, quickNote: string) => {
    const booking = sessions.find(s => s.id === bookingId);

    // Hard Lock: Chặn ngay tại UI nếu chưa phân KTV
    if (!booking?.assigned_ktv_id) {
      setToastMessage('⚠️ Chưa phân công KTV. Vui lòng vào trang Chi tiết khách hàng để phân KTV trước!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return;
    }
    
    if (isUpdatedToday(booking) && userRole !== 'admin') {
      setToastMessage('Bạn đã cập nhật buổi tập hôm nay rồi. Chỉ Admin mới có quyền điều chỉnh thêm!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setUpdatingId(bookingId);
    
    try {
      const logs = await getSessionLogs(bookingId);
      const nextSession = logs.find((log) => log.status && ['scheduled', 'in_progress'].includes(log.status));
      
      if (nextSession?.id) {
        // Save note if provided
        if (quickNote) {
          await saveSessionNote(nextSession.id, quickNote);
        }
        
        const result = await completeSession(nextSession.id, bookingId);
        
        // Kiểm tra lỗi từ server action
        if (result && 'error' in result && result.error) {
          setToastMessage('❌ ' + result.error);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 6000);
          return;
        }

        await loadSessions();

        setToastMessage('✅ Cập nhật tiến độ thành công!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        setToastMessage('Không tìm thấy buổi tập nào để cập nhật.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error: unknown) {
      console.error('Update failed:', error);
      setToastMessage('Lỗi hệ thống: ' + getErrorMessage(error, 'Không rõ nguyên nhân'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setUpdatingId(null);
    }
  };

  const [isReusingId, setIsReusingId] = useState<string | null>(null);
  
  const handleReusePackage = async (bookingId: string, customerName: string) => {
    if (!bookingId) return;

    const confirm = window.confirm(`Bạn có chắc chắn muốn tái sử dụng gói dịch vụ nhanh cho khách hàng ${customerName}?`);
    if (!confirm) return;
    
    setIsReusingId(bookingId);
    try {
      const result = await reusePackage(bookingId);
      if ('error' in result && result.error) {
        setToastMessage('Lỗi: ' + result.error);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else if ('data' in result && result.data) {
        setToastMessage(`Đã tái sử dụng gói cho ${customerName} thành công!`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setSelectedBooking(null);
        await loadSessions();
      }
    } catch (error) {
      console.error('Reuse failed:', error);
      setToastMessage('Có lỗi xảy ra khi xử lý');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsReusingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 relative">
      {/* Non-intrusive loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {/* Header & Role Switcher */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase sm:text-3xl">{sessionPageTitle}</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">{sessionPageSubtitle}</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="hidden bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setUserRole('KTV')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                userRole === 'KTV' ? "bg-primary text-white shadow-lg shadow-rose-100 dark:shadow-none" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <UserCircle className="w-3.5 h-3.5" /> KTV
            </button>
            <button 
              onClick={() => setUserRole('admin')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                userRole === 'admin' ? "bg-emerald-50 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </button>
          </div>

          {userRole === 'admin' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLeavesOpen(true);
              }}
              className="relative flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <Calendar className="w-4 h-4 text-rose-500" />
              Nghỉ phép {vocab.worker.short}
              {pendingLeaves.length > 0 && (
                <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full h-4 w-4 px-1 animate-pulse">
                  {pendingLeaves.length}
                </span>
              )}
            </button>
          )}

          <div className={cn(
            "flex min-h-12 items-center justify-center gap-3 rounded-2xl border px-5 py-3 transition-all",
            sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
            Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 15), 0)) > 0.5 
              ? "bg-emerald-50 border-emerald-100" 
              : "bg-amber-50 border-amber-100"
          )}>
            <TrendingUp className={cn(
              "w-5 h-5",
              sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
              Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 15), 0)) > 0.5 
                ? "text-emerald-500" 
                : "text-amber-500"
            )} />
            <span className={cn(
              "font-black text-sm uppercase tracking-tighter",
              sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
              Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 15), 0)) > 0.5 
                ? "text-emerald-700" 
                : "text-amber-700"
            )}>
              Hiệu suất: {Math.round((sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
                Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 15), 0))) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bella-toolbar mb-6 flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 md:mb-8 lg:flex-row lg:items-center lg:flex-wrap">
        <div className="relative w-full min-w-0 flex-1 group lg:min-w-[260px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={sessionSearchPlaceholder}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-sm"
          />
        </div>
        <div className="w-full sm:min-w-52 sm:flex-1 lg:w-52 lg:flex-none">
          <PremiumSelect
            value={statusFilter}
            options={statusOptions.map(opt => ({
              value: opt,
              label: opt,
              icon: <Filter className="w-4 h-4" />
            }))}
            onChange={(val) => setStatusFilter(val)}
            placeholder="Lọc trạng thái..."
          />
        </div>
        <div className="w-full sm:min-w-48 sm:flex-1 lg:w-48 lg:flex-none">
          <PremiumSelect
            value={sortFilter}
            options={['Ngày tạo mới nhất', 'Ngày tạo cũ nhất', 'Tên A-Z', 'Tên Z-A'].map(opt => ({ value: opt, label: opt }))}
            onChange={val => setSortFilter(val)}
            placeholder="Sắp xếp..."
          />
        </div>
        {/* Month dropdown */}
        <div className="w-full sm:min-w-36 sm:flex-1 lg:w-36 lg:flex-none">
          <PremiumSelect
            value={monthFilter}
            options={monthOptions}
            onChange={val => setMonthFilter(val)}
            placeholder="Tháng..."
          />
        </div>
        {/* Year dropdown */}
        <div className="w-full sm:min-w-32 sm:flex-1 lg:w-32 lg:flex-none">
          <PremiumSelect
            value={yearFilter}
            options={yearOptions.map(y => ({ value: y, label: y }))}
            onChange={val => setYearFilter(val)}
            placeholder="Năm..."
          />
        </div>
      </div>
      {!criticalReady ? (
        <SessionsListSkeleton />
      ) : displaySessions.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center sm:rounded-[3rem] sm:p-20">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy kết quả</h3>
          <p className="text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {paginatedSessions.map((booking, idx) => (
              <SessionCard
                key={booking.id}
                booking={booking}
                idx={idx}
                userRole={userRole}
                tenantModuleKey={tenantModuleKey}
                updatingId={updatingId}
                isReusingId={isReusingId}
                onSelect={() => setSelectedBooking(booking)}
                onUpdateProgress={handleUpdateProgress}
                onReusePackage={handleReusePackage}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-10 flex flex-col items-center justify-between gap-6 md:flex-row">
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{displaySessions.length}</span> {vocab.booking.singular.toLowerCase()}
              </p>
              
              <div className="bella-pagination">
                <button 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    if (totalPages > 7) {
                      if (page > 1 && page < totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                        if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-300">...</span>;
                        return null;
                      }
                    }
                    
                    return (
                      <button 
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={cn(
                          "w-10 h-10 rounded-xl font-black text-sm transition-all active:scale-90",
                          currentPage === page 
                            ? "bg-primary text-white shadow-lg shadow-rose-200 dark:shadow-none" 
                            : "bg-white border border-slate-100 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Detail Modal */}
      <SessionLogsDetailsModal
        isOpen={!!activeBooking}
        activeBooking={activeBooking}
        onClose={handleCloseModal}
        onSuccess={loadSessions}
        userRole={userRole}
        tenantModuleKey={tenantModuleKey}
      />
      
      {/* Leave Approval Panel */}
      <LeaveApprovalModal
        isOpen={isLeavesOpen}
        onClose={() => {
          setIsLeavesOpen(false);
          loadPendingLeaves();
        }}
        onSuccess={loadSessions}
        userRole={userRole}
      />

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 z-[150] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-[#1A0A0E] px-4 py-4 text-center font-black text-white shadow-2xl sm:bottom-10 sm:w-auto sm:min-w-[300px] sm:px-8"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 p-10 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
