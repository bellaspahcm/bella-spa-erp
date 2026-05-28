'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Calendar,
  Loader2,
  TrendingUp,
  UserCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { 
  getSessionsWithDetails, 
  completeSession, 
  getSessionLogs, 
  saveSessionNote 
} from '@/modules/booking/actions/session-actions';
import { reusePackage } from '@/modules/booking/actions/lifecycle-actions';
import { getPendingLeaveRequests } from '@/services/attendance-actions';
import { toast } from 'sonner';
import { cn, resolvePackageName } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import { getCurrentUser } from '@/services/user-actions';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { SessionBooking, LeaveRequest } from './types';
import { SessionCard } from './components/SessionCard';
import { SessionLogsDetailsModal } from './components/SessionLogsDetailsModal';
import { LeaveApprovalModal } from './components/LeaveApprovalModal';

function SessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialBookingId = searchParams.get('bookingId') || '';
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const [sessions, setSessions] = useState<SessionBooking[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionBooking[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Cập nhật thành công!');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [sortFilter, setSortFilter] = useState('Ngày tạo mới nhất');
  const [userRole, setUserRole] = useState<'KTV' | 'admin' | ''>('');
  const [selectedBooking, setSelectedBooking] = useState<SessionBooking | null>(null);
  
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

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Hoàn thành'];
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: 'all', label: 'Tất cả tháng' },
    ...Array.from({length:12}, (_,i) => ({ value: String(i+1).padStart(2,'0'), label: `Tháng ${i+1}` }))
  ];
  const yearOptions = Array.from({length:4}, (_,i) => String(currentYear - i));

  const loadPendingLeaves = async () => {
    try {
      const leaves = await getPendingLeaveRequests() as LeaveRequest[];
      setPendingLeaves(leaves);
    } catch (err) {
      console.error("Failed to load pending leaves:", err);
    }
  };

  const loadSessions = async () => {
    setIsSyncing(true);
    const data = await getSessionsWithDetails() as SessionBooking[];
    setSessions(data || []);
    applyFilters(data || [], searchQuery, statusFilter, sortFilter);
    setIsSyncing(false);
    return data;
  };

  useEffect(() => {
    loadSessions();
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user?.role?.toLowerCase() === 'admin') {
        setUserRole('admin');
        loadPendingLeaves();
      } else {
        setUserRole('KTV');
      }
    };
    fetchUser();

    // REALTIME SUBSCRIPTION
    const supabase = createClient();
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        loadSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  function applyFilters(data: SessionBooking[], query: string, status: string, sort: string) {
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
  };

  useEffect(() => {
    applyFilters(sessions, searchQuery, statusFilter, sortFilter);
  }, [searchQuery, statusFilter, sortFilter, sessions]);

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
      const nextSession = logs.find((log: any) => ['scheduled', 'in_progress'].includes(log.status));
      
      if (nextSession) {
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
    } catch (error: any) {
      console.error('Update failed:', error);
      setToastMessage('Lỗi hệ thống: ' + (error.message || 'Không rõ nguyên nhân'));
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
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto relative" onClick={() => setIsFilterOpen(false)}>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Thẻ liệu trình</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">Quản lý lộ trình & ghi chú chăm sóc</p>
        </div>
        
        <div className="flex items-center gap-4">
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
              className="relative px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
            >
              <Calendar className="w-4 h-4 text-rose-500" />
              Nghỉ phép KTV
              {pendingLeaves.length > 0 && (
                <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full h-4 w-4 px-1 animate-pulse">
                  {pendingLeaves.length}
                </span>
              )}
            </button>
          )}

          <div className={cn(
            "flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all",
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
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[220px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên mẹ, tên bé, SĐT, tên KTV, tên gói..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-sm"
          />
        </div>
        <div className="w-full md:w-52">
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
        <div className="w-full md:w-48">
          <PremiumSelect
            value={sortFilter}
            options={['Ngày tạo mới nhất', 'Ngày tạo cũ nhất', 'Tên A-Z', 'Tên Z-A'].map(opt => ({ value: opt, label: opt }))}
            onChange={val => setSortFilter(val)}
            placeholder="Sắp xếp..."
          />
        </div>
        {/* Month dropdown */}
        <div className="w-full md:w-36">
          <PremiumSelect
            value={monthFilter}
            options={monthOptions}
            onChange={val => setMonthFilter(val)}
            placeholder="Tháng..."
          />
        </div>
        {/* Year dropdown */}
        <div className="w-full md:w-32">
          <PremiumSelect
            value={yearFilter}
            options={yearOptions.map(y => ({ value: y, label: y }))}
            onChange={val => setYearFilter(val)}
            placeholder="Năm..."
          />
        </div>
      </div>

      {displaySessions.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy kết quả</h3>
          <p className="text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            {paginatedSessions.map((booking, idx) => (
              <SessionCard
                key={booking.id}
                booking={booking}
                idx={idx}
                userRole={userRole}
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
            <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{displaySessions.length}</span> thẻ liệu trình
              </p>
              
              <div className="flex items-center gap-2">
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] bg-[#1A0A0E] text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 border border-white/10 text-center min-w-[300px]"
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
