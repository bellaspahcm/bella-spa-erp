'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  Flower2,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  Loader2,
  TrendingUp,
  ChevronDown,
  X,
  FileEdit,
  Save,
  AlertCircle,
  ShieldCheck,
  UserCircle,
  MessageSquare,
  RotateCcw,
  XCircle,
  PlusCircle,
  History
} from 'lucide-react';
import { getSessionsWithDetails, completeSession, getSessionLogs, updateSessionLog, saveSessionNote, reusePackage, addExtraSession, rescheduleSession, syncBookingProgress } from '@/services/booking-actions';
import { cn, resolvePackageName } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';

import { PremiumSelect } from '@/components/ui/PremiumSelect';

function SessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialBookingId = searchParams.get('bookingId') || '';
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Cập nhật thành công!');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [userRole, setUserRole] = useState<'KTV' | 'ADMIN'>('KTV');
  const [selectedSessionLog, setSelectedSessionLog] = useState<any>(null);
  const [currentNote, setCurrentNote] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [quickNoteBookingId, setQuickNoteBookingId] = useState<string | null>(null);
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [originalDateString, setOriginalDateString] = useState<string | null>(null);

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Hoàn thành'];
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter,  setYearFilter]  = useState(String(new Date().getFullYear()));
  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: 'all', label: 'Tất cả tháng' },
    ...Array.from({length:12}, (_,i) => ({ value: String(i+1).padStart(2,'0'), label: `Tháng ${i+1}` }))
  ];
  const yearOptions = Array.from({length:4}, (_,i) => String(currentYear - i));

  useEffect(() => {
    loadSessions();

    // REALTIME SUBSCRIPTION
    const supabase = createClient() as any;
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        loadSessions();
        if (selectedBooking) {
          fetchSessionLogs(selectedBooking.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Remove selectedBooking dependency to prevent reload loop

  useEffect(() => {
    if (selectedBooking) {
      fetchSessionLogs(selectedBooking.id);
    }
  }, [selectedBooking]);

  const fetchSessionLogs = async (bookingId: string) => {
    setIsLoadingLogs(true);
    try {
      // Auto-sync progress count whenever modal opens
      syncBookingProgress(bookingId).then(res => {
        if (res?.synced) {
          loadSessions(); // Reload list to reflect synced count
        }
      });

      const logs = await getSessionLogs(bookingId);
      setSessionLogs(logs);
      
      // Select the first scheduled session or the last completed one by default
      const nextScheduled = logs.find((log: any) => log.status === 'scheduled');
      if (nextScheduled) {
        setSelectedSessionLog(nextScheduled);
        setCurrentNote(nextScheduled.notes || '');
      } else if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        setSelectedSessionLog(lastLog);
        setCurrentNote(lastLog.notes || '');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadSessions = async () => {
    setIsSyncing(true);
    const data = await getSessionsWithDetails();
    setSessions(data || []);
    applyFilters(data || [], searchQuery, statusFilter);
    setIsSyncing(false);
    return data;
  };

  // Dedicated Effect for Auto-opening from URL - Runs once after first data load
  useEffect(() => {
    if (initialBookingId && sessions.length > 0 && !hasAutoOpened) {
      const target = sessions.find((s: any) => s.id === initialBookingId);
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

  const applyFilters = (data: any[], query: string, status: string) => {
    let result = [...data];
    
    if (query) {
      const q = query.toLowerCase().trim();
      result = result.filter(s => {
        const pkgName    = resolvePackageName(s).toLowerCase();
        const ktvName    = s.assigned_ktv?.full_name?.toLowerCase() || '';
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
    
    setFilteredSessions(result);
  };

  useEffect(() => {
    applyFilters(sessions, searchQuery, statusFilter);
  }, [searchQuery, statusFilter, sessions]);

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

  const isUpdatedToday = (booking: any) => {
    const today = new Date().toLocaleDateString('sv-SE');
    return booking.last_updated_date === today;
  };

  const handleUpdateProgress = async (bookingId: string) => {
    const booking = sessions.find(s => s.id === bookingId);
    const note = quickNoteBookingId === bookingId ? quickNoteValue : '';

    // Hard Lock: Chặn ngay tại UI nếu chưa phân KTV
    if (!booking?.assigned_ktv_id) {
      setToastMessage('⚠️ Chưa phân công KTV. Vui lòng vào trang Chi tiết khách hàng để phân KTV trước!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return;
    }
    
    if (isUpdatedToday(booking) && userRole !== 'ADMIN') {
      setToastMessage('Bạn đã cập nhật buổi tập hôm nay rồi. Chỉ Admin mới có quyền điều chỉnh thêm!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setUpdatingId(bookingId);
    
    try {
      const logs = await getSessionLogs(bookingId);
      const nextSession = logs.find((log: any) => log.status === 'scheduled');
      
      if (nextSession) {
        // Save note if provided
        if (note) {
          await saveSessionNote(nextSession.id, note);
        }
        
        const result = await completeSession(nextSession.id, bookingId);
        
        // Kiểm tra lỗi từ server action
        if (result && 'error' in result && result.error) {
          setToastMessage('❌ ' + result.error);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 6000);
          return;
        }

        // Reset quick note
        setQuickNoteValue('');
        setQuickNoteBookingId(null);
        
        await loadSessions();
        if (selectedBooking?.id === bookingId) {
          await fetchSessionLogs(bookingId);
        }

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

  useEffect(() => {
    if (selectedSessionLog) {
      setCurrentNote(selectedSessionLog.notes || '');
      // DEFAULT TO TODAY IF NO ASSIGNED DATE (Using local time)
      const todayLocal = new Date().toLocaleDateString('sv-SE');
      setSelectedDate(selectedSessionLog.assigned_date || todayLocal);
      setSelectedTime(selectedSessionLog.assigned_time || '');
      setSelectedStatus(selectedSessionLog.status || 'scheduled');
      setOriginalDateString(selectedSessionLog.assigned_date || todayLocal);
    }
  }, [selectedSessionLog]);

  const handleSaveFullUpdate = async (forcedStatus?: string) => {
    if (!selectedSessionLog || !selectedBooking) return;
    
    const finalStatus = forcedStatus || selectedStatus;
    
    if (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled') {
      setToastMessage('Buổi tập này đã hoàn thành hoặc bị hủy. Chỉ Quản trị viên mới có quyền điều chỉnh lịch sử!');
      setShowToast(true);
      return;
    }

    setIsSavingNote(true);
    try {
      // Detect date change for rescheduling
      const dateChanged = selectedDate && originalDateString && selectedDate !== originalDateString;
      
      if (dateChanged && finalStatus === 'scheduled') {
        const rescheduleResult = await rescheduleSession(selectedSessionLog.id, selectedDate);
        if (rescheduleResult.error) {
          setToastMessage('Lỗi dời lịch: ' + rescheduleResult.error);
          setShowToast(true);
          setIsSavingNote(false);
          return;
        }
        setToastMessage('Đã tự động dời lịch các buổi tiếp theo!');
        setShowToast(true);
      }

      const updates = {
        notes: currentNote || null,
        assigned_date: selectedDate || null,
        assigned_time: selectedTime || null,
        status: finalStatus,
        completed_date: finalStatus === 'completed' ? (selectedSessionLog.completed_date || new Date().toISOString()) : null
      };

      const result = await updateSessionLog(selectedSessionLog.id, updates);
      
      if (result.data) {
        // 1. Prepare updated log object
        const updatedLog = { ...selectedSessionLog, ...updates };

        // 2. Update the grid state immediately for UI response
        setSessionLogs(prev => prev.map(log => 
          log.id === selectedSessionLog.id ? updatedLog : log
        ));
        
        // 3. Update selection and status state
        setSelectedSessionLog(updatedLog);
        setSelectedStatus(finalStatus);
        
        // 4. Update local state for booking count if status changed
        if (selectedSessionLog.status !== finalStatus) {
          const diff = finalStatus === 'completed' ? 1 : (selectedSessionLog.status === 'completed' ? -1 : 0);
          if (diff !== 0) {
            const currentBookingCount = selectedBooking.completed_sessions || 0;
            const newCount = Math.max(0, currentBookingCount + diff);
            
            // Update the main sessions list locally to trigger immediate isNextToRun update
            setSessions(prev => prev.map(b => 
              b.id === selectedBooking.id ? { ...b, completed_sessions: newCount } : b
            ));
          }
        }
        
        setToastMessage('Đã cập nhật trạng thái buổi tập thành công!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);

        // 5. Finally, refresh from server to ensure everything is in sync
        await loadSessions();
      } else if (result.error) {
        setToastMessage('Lỗi DB: ' + result.error);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    } catch (error: any) {
      console.error('Update failed:', error);
      setToastMessage('Lỗi hệ thống: ' + (error.message || 'Không rõ nguyên nhân'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Dedicated handler for Restore/Cancel - ONLY changes status & completed_date
  const handleStatusChange = async (newStatus: 'scheduled' | 'cancelled') => {
    if (!selectedSessionLog || !selectedBooking) return;
    if (userRole !== 'ADMIN') return;

    setIsSavingNote(true);
    try {
      const updates: any = {
        status: newStatus,
        completed_date: null, // always clear completed_date when restoring/cancelling
      };

      const result = await updateSessionLog(selectedSessionLog.id, updates);

      if (result.data) {
        const updatedLog = { ...selectedSessionLog, ...updates };

        // Update grid immediately
        setSessionLogs(prev => prev.map(log =>
          log.id === selectedSessionLog.id ? updatedLog : log
        ));

        // Update selected log & dropdown
        setSelectedSessionLog(updatedLog);
        setSelectedStatus(newStatus);


        // Adjust booking count
        if (selectedSessionLog.status === 'completed') {
          const newCount = Math.max(0, (selectedBooking.completed_sessions || 0) - 1);
          setSessions(prev => prev.map(b =>
            b.id === selectedBooking.id ? { ...b, completed_sessions: newCount } : b
          ));
        }

        setToastMessage(newStatus === 'scheduled' ? 'Đã khôi phục buổi tập thành công!' : 'Đã hủy buổi tập thành công!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);

        // Refresh from server
        await loadSessions();
        if (selectedBooking?.id) {
          await fetchSessionLogs(selectedBooking.id);
        }
      } else if (result.error) {
        setToastMessage('Lỗi: ' + result.error);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    } catch (error: any) {
      console.error('Status change failed:', error);
      setToastMessage('Lỗi: ' + (error.message || 'Không rõ'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setIsSavingNote(false);
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
  
  const handleAddExtraSession = async (bookingId: string) => {
    if (!window.confirm('Bạn có muốn thêm một buổi tập bổ sung vào gói này không?')) return;
    
    setIsSyncing(true);
    try {
      const result = await addExtraSession(bookingId);
      if (result.success) {
        setToastMessage('Đã thêm buổi tập bổ sung thành công!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        await loadSessions();
        // Also reload current logs if modal is open
        if (selectedBooking && selectedBooking.id === bookingId) {
          const logs = await getSessionLogs(bookingId);
          setSessionLogs(logs);
        }
      } else {
        setToastMessage('Lỗi: ' + result.error);
        setShowToast(true);
      }
    } catch (error) {
      console.error('Add extra session failed:', error);
      setToastMessage('Có lỗi xảy ra');
      setShowToast(true);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto relative" onClick={() => setIsFilterOpen(false)}>
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
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setUserRole('KTV')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                userRole === 'KTV' ? "bg-primary text-white shadow-lg shadow-rose-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <UserCircle className="w-3.5 h-3.5" /> KTV
            </button>
            <button 
              onClick={() => setUserRole('ADMIN')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                userRole === 'ADMIN' ? "bg-emerald-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </button>
          </div>

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
        {/* Month dropdown */}
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="w-full md:w-40 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {/* Year dropdown */}
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="w-full md:w-32 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
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
        <div className="grid grid-cols-1 gap-6">
          {displaySessions.map((booking: any, idx: number) => {
            const completedCount = Number(booking.completed_sessions) || 0;
            const totalCount = Number(booking.total_sessions) || 15;
            const progress = (completedCount / Math.max(1, totalCount)) * 100;
            const isUpdating = updatingId === booking.id;
            const isFullyCompleted = (booking.completed_sessions || 0) >= (booking.total_sessions || 15);
            const alreadyDoneToday = isUpdatedToday(booking);
            const today = new Date().toLocaleDateString('sv-SE');
            const isScheduledForToday = booking.next_session_date === today;
            const canUpdate = isScheduledForToday || userRole === 'ADMIN';
            const hasKtv = !!booking.assigned_ktv_id;

            return (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedBooking(booking)}
                className="group luxury-card-white p-6 rounded-[2.5rem] transition-all flex flex-col md:flex-row md:items-center gap-8 relative cursor-pointer"
              >
                {/* Background blur container with overflow-hidden */}
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="w-20 h-20 bg-gradient-to-br from-pink-50 to-white rounded-3xl flex items-center justify-center flex-shrink-0 border border-pink-100 shadow-inner group-hover:scale-110 transition-transform relative z-10">
                  <Flower2 className="text-primary w-10 h-10" />
                </div>
                
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-slate-900 truncate tracking-tight uppercase">
                      Mẹ {booking.customers?.name_mother} {booking.customers?.name_baby ? `& Bé ${booking.customers.name_baby}` : ''}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-rose-50 text-primary rounded-lg text-[9px] font-black uppercase tracking-[0.05em] border border-primary/10">
                        {resolvePackageName(booking)}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                        {booking.booking_number}
                      </span>
                    </div>
                    <span className={cn(
                      "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                      isFullyCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-primary/5 text-primary border-primary/10'
                    )}>
                      {isFullyCompleted ? 'Hoàn thành' : 'Đang chăm sóc'}
                    </span>
                    {/* Badge cảnh báo chưa phân KTV */}
                    {!hasKtv && !isFullyCompleted && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
                        <AlertCircle className="w-3 h-3" />
                        Chưa phân KTV
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm font-bold text-slate-500 mb-5">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-primary/60" />
                      Tiến độ: <span className="text-slate-900 font-black">{completedCount}/{totalCount} buổi</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-primary/60" />
                      Bắt đầu: <span className="text-slate-900 font-black tracking-tighter">{booking.start_date || '---'}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <UserCircle className="w-4 h-4 text-primary/60" />
                      KTV: <span className={cn("font-black", hasKtv ? "text-slate-900" : "text-amber-500")}>
                        {booking.assigned_ktv_name || 'Chưa phân công'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn("h-full relative", isFullyCompleted ? 'bg-emerald-500' : 'bg-primary')}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </motion.div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:items-end md:border-l md:pl-8 border-slate-100 min-w-[280px] justify-center relative z-10">
                  {/* Continuity Context: Show last session's note before the new update */}
                  {(() => {
                    const completedLogs = (booking.session_logs || [])
                      .filter((l: any) => l.status === 'completed')
                      .sort((a: any, b2: any) => (b2.session_number || 0) - (a.session_number || 0));
                    const lastLog = completedLogs[0];
                    if (lastLog && lastLog.notes && !isFullyCompleted && !alreadyDoneToday) {
                      return (
                        <div className="w-full mb-1 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <History className="w-3 h-3 text-amber-500" />
                            <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter">Ghi chú buổi {lastLog.session_number}</span>
                          </div>
                          <p className="text-[10px] font-medium text-slate-600 line-clamp-2 leading-tight italic">"{lastLog.notes}"</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {!isFullyCompleted && !alreadyDoneToday && (
                    <div className="relative w-full">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <input 
                        type="text"
                        placeholder="Ghi chú nhanh buổi này..."
                        value={quickNoteBookingId === booking.id ? quickNoteValue : ''}
                        onChange={(e) => {
                          setQuickNoteBookingId(booking.id);
                          setQuickNoteValue(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  )}
                  
                  {!isFullyCompleted ? (
                    !hasKtv ? (
                      // Hard Lock UI: Chưa phân KTV
                      <div className="w-full flex flex-col gap-2">
                        <div className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-black text-[10px] uppercase tracking-widest justify-center">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Chưa phân công KTV</span>
                        </div>
                        <p className="text-center text-[9px] font-bold text-slate-400 leading-snug">
                          Vào <Link href={`/dashboard/customers/${booking.customers?.id}?bookingId=${booking.id}`} className="text-primary hover:underline font-black cursor-pointer underline-offset-2">Chi tiết khách hàng</Link> để phân KTV trước khi cập nhật buổi
                        </p>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (alreadyDoneToday && userRole !== 'ADMIN') {
                            setToastMessage('Bạn đã cập nhật buổi tập hôm nay rồi!');
                            setShowToast(true);
                            setTimeout(() => setShowToast(false), 3000);
                            return;
                          }
                          if (!isScheduledForToday && userRole !== 'ADMIN') {
                            setToastMessage(`Buổi này được hẹn vào ngày ${booking.next_session_date || 'chưa xác định'}. Chỉ có thể cập nhật vào đúng ngày hẹn!`);
                            setShowToast(true);
                            setTimeout(() => setShowToast(false), 3000);
                            return;
                          }
                          handleUpdateProgress(booking.id); 
                        }}
                        disabled={isUpdating}
                        className={cn(
                          "w-full flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all text-[10px] uppercase tracking-widest justify-center shadow-lg active:scale-95",
                          (alreadyDoneToday || (!isScheduledForToday && userRole !== 'ADMIN')) 
                            ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed" 
                            : "bg-primary text-white shadow-pink-100 hover:bg-primary-hover"
                        )}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : alreadyDoneToday && userRole !== 'ADMIN' ? (
                          <><CheckCircle2 className="w-4 h-4" /> Đã xong hôm nay</>
                        ) : !isScheduledForToday && userRole !== 'ADMIN' ? (
                          <><Clock className="w-4 h-4" /> Chưa đến ngày ({booking.next_session_date || '---'})</>
                        ) : (
                          <><ChevronRight className="w-4 h-4" /> Cập nhật buổi {(booking.completed_sessions || 0) + 1}</>
                        )}
                      </button>
                    )
                  ) : (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-widest text-[10px] bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-200 justify-center">
                        <CheckCircle2 className="w-4 h-4" /> Đã hoàn tất
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReusePackage(booking.id, `Mẹ ${booking.customers?.name_mother || ''}${booking.customers?.name_baby ? ` & Bé ${booking.customers.name_baby}` : ''}` || 'Khách hàng');
                        }}
                        disabled={isReusingId === booking.id}
                        className="w-full flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95 justify-center"
                      >
                        {isReusingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                        Tái sử dụng gói nhanh
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white"
            >
              {/* Modal Header */}
              <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Flower2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                      Thẻ liệu trình: Mẹ {selectedBooking.customers?.name_mother} {selectedBooking.customers?.name_baby ? `& Bé ${selectedBooking.customers.name_baby}` : ''}
                    </h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-3">
                      <span className="text-primary">{selectedBooking.package_name}</span>
                      <span className="text-slate-300">•</span>
                      <span>KTV: {selectedBooking.assigned_ktv_name}</span>
                      <span className="text-slate-300">•</span>
                      <span>Tiến độ: {selectedBooking.completed_sessions || 0}/{selectedBooking.total_sessions || 15}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest",
                    userRole === 'ADMIN' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                  )}>
                    {userRole === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <UserCircle className="w-3 h-3" />}
                    Quyền: {userRole}
                  </div>
                  <Link
                    href={`/dashboard/customers/${selectedBooking.customers?.id}?bookingId=${selectedBooking.id}`}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-pink-100 active:scale-95 flex items-center gap-2"
                  >
                    <UserCircle className="w-3.5 h-3.5" /> Hồ sơ
                  </Link>
                  <button 
                    onClick={handleCloseModal}
                    className="w-12 h-12 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Info & Notes */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <FileEdit className="w-4 h-4 text-primary" /> 
                        {selectedSessionLog ? `Cập nhật buổi ${selectedSessionLog.session_number}/${selectedBooking.total_sessions || 21}` : 'Hành trình chăm sóc'}
                      </h3>
                      
                      <div className="space-y-4">
                        {!selectedSessionLog ? (
                          <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                            <div className="flex flex-col items-center text-center py-4">
                              <History className="w-10 h-10 text-amber-400 mb-4 opacity-50" />
                              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Thông tin buổi trước</h4>
                              {(() => {
                                const completedLogs = (selectedBooking.session_logs || [])
                                  .filter((l: any) => l.status === 'completed')
                                  .sort((a: any, b2: any) => (b2.session_number || 0) - (a.session_number || 0));
                                const lastLog = completedLogs[0];
                                if (lastLog) {
                                  return (
                                    <>
                                      <p className="text-[10px] font-bold text-slate-500 italic mb-4">"{lastLog.notes || 'Không có ghi chú'}"</p>
                                      <div className="bg-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest text-primary shadow-sm border border-pink-50">
                                        Đã làm buổi {lastLog.session_number} vào {lastLog.completed_date || lastLog.assigned_date || 'N/A'}
                                      </div>
                                    </>
                                  );
                                }
                                return <p className="text-[10px] font-bold text-slate-400 italic">Chưa có lịch sử chăm sóc</p>;
                              })()}
                              <p className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Chọn một buổi trong lịch trình để cập nhật tiếp</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Ngày dự kiến</label>
                                <div className="relative">
                                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                      type="date"
                                      value={selectedDate}
                                      onChange={(e) => setSelectedDate(e.target.value)}
                                      disabled={!selectedSessionLog || (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled')}
                                      className="w-full pl-8 pr-2 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
                                    />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Giờ hẹn</label>
                                <div className="relative">
                                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                      type="time"
                                      value={selectedTime}
                                      onChange={(e) => setSelectedTime(e.target.value)}
                                      disabled={!selectedSessionLog || (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled')}
                                      className="w-full pl-8 pr-2 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
                                    />
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Trạng thái</label>
                              <PremiumSelect
                                value={selectedStatus}
                                options={[
                                  { value: 'scheduled', label: 'Đã lên lịch', icon: <Clock className="w-4 h-4" /> },
                                  { value: 'completed', label: 'Đã hoàn thành', icon: <CheckCircle2 className="w-4 h-4" /> },
                                  { value: 'cancelled', label: 'Đã hủy', icon: <X className="w-4 h-4" /> }
                                ]}
                                onChange={(value) => setSelectedStatus(value)}
                                disabled={!selectedSessionLog || (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled')}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nội dung & Tiến độ buổi tập</label>
                              <textarea 
                                placeholder="Hôm nay mẹ và bé thế nào? Các bước kỹ thuật đã thực hiện, lưu ý cho buổi sau..."
                                value={currentNote}
                                onChange={(e) => setCurrentNote(e.target.value)}
                                disabled={!selectedSessionLog || (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled')}
                                className="w-full h-32 p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 placeholder:text-slate-300 resize-none transition-all disabled:opacity-50 text-xs shadow-inner"
                              />
                            </div>
                            
                            {selectedSessionLog.status === 'completed' && (
                              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3 mb-2">
                                <UserCircle className="w-5 h-5 text-emerald-500" />
                                <div>
                                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Kỹ thuật viên thực hiện</p>
                                  <p className="text-xs font-bold text-emerald-900">{selectedSessionLog.ktv?.full_name || 'KTV hệ thống'}</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleSaveFullUpdate()}
                            disabled={isSavingNote || !selectedSessionLog || (userRole !== 'ADMIN' && selectedSessionLog.status !== 'scheduled')}
                            className="w-full mt-2 bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-pink-100 flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                            Cập nhật thông tin
                          </button>

                          {userRole === 'ADMIN' && selectedSessionLog && selectedSessionLog.status !== 'scheduled' && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button 
                                onClick={() => handleStatusChange('scheduled')}
                                disabled={isSavingNote}
                                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Khôi phục buổi
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm('Bạn có chắc muốn hủy buổi tập này?')) {
                                    handleStatusChange('cancelled');
                                  }
                                }}
                                disabled={isSavingNote}
                                className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Hủy buổi này
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {userRole === 'ADMIN' && (
                      <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-200">
                        <div className="flex items-center gap-3 text-amber-700 font-black uppercase text-[10px] tracking-widest mb-2">
                          <AlertCircle className="w-4 h-4" /> Chế độ Admin
                        </div>
                        <p className="text-[11px] font-bold text-amber-600 leading-relaxed">
                          Bạn có quyền chỉnh sửa lịch sử và các buổi tập đã hoàn thành. Hãy cẩn trọng khi thay đổi dữ liệu.
                        </p>
                      </div>
                    )}

                    <div className="luxury-card-pink p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Tóm tắt tiến độ</h3>
                        {selectedBooking.completed_sessions >= (selectedBooking.total_sessions || 21) && (
                          <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Done</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6 relative z-10">
                        <div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm">
                          <p className="text-[9px] opacity-60 font-black uppercase tracking-widest mb-1">Hoàn thành</p>
                          <p className="text-3xl font-black text-slate-900">{selectedBooking.completed_sessions || 0}</p>
                        </div>
                        <div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm relative group">
                          <p className="text-[9px] opacity-60 font-black uppercase tracking-widest mb-1">Tổng cộng</p>
                          <p className="text-3xl font-black text-slate-900">{selectedBooking.total_sessions || 15}</p>
                          {userRole === 'ADMIN' && (
                            <button 
                              onClick={() => handleAddExtraSession(selectedBooking.id)}
                              className="absolute top-1 right-1 p-1 bg-white/80 rounded-lg text-primary hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                              title="Thêm buổi bổ sung"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 relative z-10">
                        <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${((selectedBooking.completed_sessions || 0) / (selectedBooking.total_sessions || 15)) * 100}%` }}
                          />
                        </div>
                      </div>

                      {selectedBooking.completed_sessions >= (selectedBooking.total_sessions || 21) && (
                         <button 
                         onClick={() => handleReusePackage(selectedBooking.id, `Mẹ ${selectedBooking.customers?.name_mother || ''}${selectedBooking.customers?.name_baby ? ` & Bé ${selectedBooking.customers.name_baby}` : ''}` || 'Khách hàng')}
                         disabled={isReusingId === selectedBooking.id}
                         className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[9px] shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all relative z-10"
                       >
                         {isReusingId === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} 
                         Tái sử dụng gói nhanh
                       </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Calendar Grid */}
                  <div className="lg:col-span-2">
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 h-full">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                          <Calendar className="w-6 h-6 text-primary" /> Lịch trình
                        </h3>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Xong</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Hủy</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Hôm nay</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-3">
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                          <div key={day} className="text-center py-2">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{day}</span>
                          </div>
                        ))}
                        
                        {isLoadingLogs ? (
                          <div className="col-span-7 py-20 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                            <p className="text-xs font-bold text-slate-400">Đang tải lịch trình...</p>
                          </div>
                        ) : sessionLogs.length > 0 ? (
                          <>
                            {/* Empty placeholders to align with day of week */}
                            {Array.from({ 
                              length: sessionLogs[0]?.assigned_date ? new Date(sessionLogs[0].assigned_date).getDay() : 0 
                            }).map((_, i) => (
                              <div key={`empty-${i}`} className="aspect-square" />
                            ))}
                            
                            {sessionLogs.map((log, i) => {
                            const status = log.status;
                            const isUpdating = updatingId === log.id;
                            const nextScheduledIndex = sessionLogs.findIndex(l => l.status === 'scheduled');
                            const isNextToRun = status === 'scheduled' && i === nextScheduledIndex;
                            const canEdit = userRole === 'ADMIN' || isNextToRun;

                            return (
                              <div 
                                key={log.id} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Always select to show notes
                                  setSelectedSessionLog(log);
                                  setCurrentNote(log.notes || '');
                                  
                                  // Auto-toggle for demo if double click or specific UI intent
                                  // For demo, let's make it so clicking 'Hoàn thành' inside the circle works
                                }}
                                className={cn(
                                  "aspect-square rounded-2xl flex flex-col items-center justify-center border transition-all cursor-pointer group relative overflow-hidden",
                                  status === 'completed' ? 'bg-emerald-500 border-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                                  status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 shadow-sm' :
                                  isNextToRun ? 'bg-amber-50 border-amber-300 text-amber-600 ring-4 ring-amber-50 shadow-lg' :
                                  'bg-slate-50/50 border-slate-100 text-slate-300 hover:bg-slate-100',
                                  selectedSessionLog?.id === log.id && "ring-2 ring-primary border-primary/50 shadow-inner",
                                  !canEdit && status === 'scheduled' && "grayscale opacity-50",
                                  isUpdating && "animate-pulse"
                                )}
                              >
                                {isNextToRun && (
                                  <div className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full m-2 animate-ping" />
                                )}
                                <span className={cn("text-xs font-black mb-1", status === 'completed' ? "text-white" : "text-slate-900")}>
                                  {log.session_number}
                                </span>
                                {status !== 'scheduled' && (
                                  <p className={cn("text-[8px] font-black uppercase", status === 'completed' ? "text-white/90" : "opacity-60")}>
                                    {status === 'completed' ? 'Xong' : 'Hủy'}
                                  </p>
                                )}
                                {isNextToRun && (
                                  <p className="text-[8px] font-black uppercase text-amber-600">Làm ngay</p>
                                )}
                                
                                <div className="absolute inset-0 bg-primary/90 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center z-20">
                                  <p className="text-[7px] font-black uppercase mb-1">Buổi {log.session_number}</p>
                                  <p className="text-[6px] font-bold opacity-80 mb-1">{log.assigned_date || 'Chưa hẹn'}</p>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSessionLog(log);
                                    }}
                                    className="bg-white text-primary px-2 py-1 rounded-lg text-[8px] font-black uppercase mt-1 hover:bg-pink-50 transition-colors"
                                  >
                                    Cập nhật
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                        ) : (
                          <div className="col-span-7 py-20 text-center italic text-slate-400 font-bold">
                            Chưa khởi tạo lịch trình cho hợp đồng này
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
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
