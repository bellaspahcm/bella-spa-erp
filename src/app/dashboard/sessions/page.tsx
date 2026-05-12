'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  UserCircle
} from 'lucide-react';
import { getSessionsWithDetails, completeSession, getSessionLogs, updateSessionLog, saveSessionNote } from '@/services/booking-actions';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase-client';
import { MOCK_BOOKINGS } from '@/constants/mock-data';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>(MOCK_BOOKINGS);
  const [filteredSessions, setFilteredSessions] = useState<any[]>(MOCK_BOOKINGS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Cập nhật thành công!');
  
  // PERSISTENCE FOR DEMO: Track manual updates locally since DB might be restricted
  const [localBookingUpdates, setLocalBookingUpdates] = useState<Record<string, number>>({});
  const [localSessionLogUpdates, setLocalSessionLogUpdates] = useState<Record<string, string>>({});

  // Sync with localStorage on mount
  useEffect(() => {
    const savedBookingUpdates = localStorage.getItem('demo_booking_updates');
    const savedLogUpdates = localStorage.getItem('demo_log_updates');
    if (savedBookingUpdates) setLocalBookingUpdates(JSON.parse(savedBookingUpdates));
    if (savedLogUpdates) setLocalSessionLogUpdates(JSON.parse(savedLogUpdates));
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (Object.keys(localBookingUpdates).length > 0) {
      localStorage.setItem('demo_booking_updates', JSON.stringify(localBookingUpdates));
    }
  }, [localBookingUpdates]);

  useEffect(() => {
    if (Object.keys(localSessionLogUpdates).length > 0) {
      localStorage.setItem('demo_log_updates', JSON.stringify(localSessionLogUpdates));
    }
  }, [localSessionLogUpdates]);

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

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Hoàn thành'];

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
  }, [selectedBooking]);

  useEffect(() => {
    if (selectedBooking) {
      fetchSessionLogs(selectedBooking.id);
    }
  }, [selectedBooking]);

  const fetchSessionLogs = async (bookingId: string) => {
    setIsLoadingLogs(true);
    try {
      const logs = await getSessionLogs(bookingId);
      // Apply local updates
      const mergedLogs = logs.map((log: any) => ({
        ...log,
        status: localSessionLogUpdates[log.id] ?? log.status
      }));
      setSessionLogs(mergedLogs);
      
      // Select the first scheduled session or the last completed one by default
      const nextScheduled = mergedLogs.find((log: any) => log.status === 'scheduled');
      if (nextScheduled) {
        setSelectedSessionLog(nextScheduled);
        setCurrentNote(nextScheduled.notes || '');
      } else if (mergedLogs.length > 0) {
        const lastLog = mergedLogs[mergedLogs.length - 1];
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
    if (data && data.length > 0) {
      // Apply local updates
      const mergedData = data.map((b: any) => ({
        ...b,
        completed_sessions: localBookingUpdates[b.id] ?? b.completed_sessions
      }));
      setSessions(mergedData);
      applyFilters(mergedData, searchQuery, statusFilter);
    }
    setIsSyncing(false);
  };

  const applyFilters = (data: any[], query: string, status: string) => {
    let result = [...data];
    
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(s => 
        s.customers?.name_mother?.toLowerCase().includes(q) || 
        s.booking_number?.toLowerCase().includes(q)
      );
    }
    
    if (status !== 'Tất cả trạng thái') {
      if (status === 'Đang chăm sóc') {
        result = result.filter(s => (s.completed_sessions || 0) < (s.total_sessions || 21));
      } else if (status === 'Hoàn thành') {
        result = result.filter(s => (s.completed_sessions || 0) >= (s.total_sessions || 21));
      }
    }
    
    setFilteredSessions(result);
  };

  useEffect(() => {
    applyFilters(sessions, searchQuery, statusFilter);
  }, [searchQuery, statusFilter]);

  const isUpdatedToday = (booking: any) => {
    const today = new Date().toISOString().split('T')[0];
    return booking.last_updated_date === today;
  };

  const handleUpdateProgress = async (bookingId: string, note: string = '') => {
    const booking = sessions.find(s => s.id === bookingId);
    
    if (isUpdatedToday(booking) && userRole !== 'ADMIN') {
      setToastMessage('Bạn đã cập nhật buổi tập hôm nay rồi. Chỉ Admin mới có quyền điều chỉnh thêm!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setUpdatingId(bookingId);
    
    // OPTIMISTIC UPDATE for Demo
    const newCount = (booking.completed_sessions || 0) + 1;
    
    // PERSIST LOCALLY
    setLocalBookingUpdates(prev => ({ ...prev, [bookingId]: newCount }));

    try {
      const logs = await getSessionLogs(bookingId);
      const nextSession = logs.find((log: any) => {
        const status = localSessionLogUpdates[log.id] ?? log.status;
        return status === 'scheduled';
      });
      
      if (nextSession) {
        setLocalSessionLogUpdates(prev => ({ ...prev, [nextSession.id]: 'completed' }));
        
        await completeSession(nextSession.id, bookingId);
        // loadSessions and fetchSessionLogs will now use the local updates
        await loadSessions();
        if (selectedBooking?.id === bookingId) {
          await fetchSessionLogs(bookingId);
        }
      }
      
      setToastMessage('Cập nhật tiến độ thành công!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (selectedSessionLog) {
      setCurrentNote(selectedSessionLog.notes || '');
      setSelectedDate(selectedSessionLog.assigned_date || '');
      setSelectedTime(selectedSessionLog.assigned_time || '');
      setSelectedStatus(selectedSessionLog.status || 'scheduled');
    }
  }, [selectedSessionLog]);

  const handleSaveFullUpdate = async () => {
    if (!selectedSessionLog || !selectedBooking) return;
    
    setIsSavingNote(true);
    try {
      const updates = {
        notes: currentNote,
        assigned_date: selectedDate,
        assigned_time: selectedTime,
        status: selectedStatus,
        completed_date: selectedStatus === 'completed' ? (selectedSessionLog.completed_date || new Date().toISOString()) : null
      };

      const result = await updateSessionLog(selectedSessionLog.id, updates);
      
      if (result.data) {
        setToastMessage('Đã cập nhật thông tin buổi tập!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        
        // Update local state for booking count if status changed
        if (selectedSessionLog.status !== selectedStatus) {
          const diff = selectedStatus === 'completed' ? 1 : (selectedSessionLog.status === 'completed' ? -1 : 0);
          if (diff !== 0) {
            const newCount = Math.max(0, (selectedBooking.completed_sessions || 0) + diff);
            setLocalBookingUpdates(prev => ({ ...prev, [selectedBooking.id]: newCount }));
          }
        }

        // Update session logs locally
        setSessionLogs(prev => prev.map(log => 
          log.id === selectedSessionLog.id ? { ...log, ...updates } : log
        ));
        
        await loadSessions();
      }
    } catch (error) {
      console.error('Update failed:', error);
      setToastMessage('Lỗi khi cập nhật');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSavingNote(false);
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
            Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 21), 0)) > 0.5 
              ? "bg-emerald-50 border-emerald-100" 
              : "bg-amber-50 border-amber-100"
          )}>
            <TrendingUp className={cn(
              "w-5 h-5",
              sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
              Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 21), 0)) > 0.5 
                ? "text-emerald-500" 
                : "text-amber-500"
            )} />
            <span className={cn(
              "font-black text-sm uppercase tracking-tighter",
              sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
              Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 21), 0)) > 0.5 
                ? "text-emerald-700" 
                : "text-amber-700"
            )}>
              Hiệu suất: {Math.round((sessions.reduce((acc, s) => acc + (s.completed_sessions || 0), 0) / 
                Math.max(1, sessions.reduce((acc, s) => acc + (s.total_sessions || 21), 0))) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên khách hàng hoặc mã hợp đồng..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto relative">
          <div className="relative min-w-[200px]">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
              className="w-full flex items-center justify-between px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:border-primary/30 transition-all font-black text-slate-600 text-sm outline-none uppercase tracking-widest"
            >
              <span>{statusFilter}</span>
              <motion.div animate={{ rotate: isFilterOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden p-1.5"
                >
                  {statusOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => { setStatusFilter(option); setIsFilterOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl text-sm font-black transition-all uppercase tracking-widest",
                        statusFilter === option ? "bg-primary text-white shadow-lg shadow-pink-100" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy kết quả</h3>
          <p className="text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredSessions.map((booking: any, idx: number) => {
            const progress = ((booking.completed_sessions || 0) / (booking.total_sessions || 21)) * 100;
            const isUpdating = updatingId === booking.id;
            const isFullyCompleted = (booking.completed_sessions || 0) >= (booking.total_sessions || 21);
            const alreadyDoneToday = isUpdatedToday(booking);

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
                      {booking.customers?.name_mother}
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                      {booking.booking_number}
                    </span>
                    <span className={cn(
                      "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                      isFullyCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-primary/5 text-primary border-primary/10'
                    )}>
                      {isFullyCompleted ? 'Hoàn thành' : 'Đang chăm sóc'}
                    </span>
                    {alreadyDoneToday && !isFullyCompleted && (
                      <span className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter">
                        Đã cập nhật hôm nay
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm font-bold text-slate-500 mb-5">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-primary/60" />
                      Tiến độ: <span className="text-slate-900 font-black">{booking.completed_sessions || 0}/{booking.total_sessions || 21} buổi</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-primary/60" />
                      Bắt đầu: <span className="text-slate-900 font-black tracking-tighter">{booking.start_date || '---'}</span>
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

                <div className="flex items-center gap-4 md:border-l md:pl-8 border-slate-100 min-w-[200px] justify-center relative z-10">
                  {!isFullyCompleted ? (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (alreadyDoneToday && userRole !== 'ADMIN') {
                            setToastMessage('Bạn đã cập nhật buổi tập hôm nay rồi!');
                            setShowToast(true);
                            setTimeout(() => setShowToast(false), 3000);
                            return;
                          }
                          handleUpdateProgress(booking.id); 
                        }}
                        disabled={isUpdating}
                        className={cn(
                          "w-full flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all text-[10px] uppercase tracking-widest justify-center shadow-lg active:scale-95",
                          alreadyDoneToday && userRole !== 'ADMIN' 
                            ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed" 
                            : "bg-primary text-white shadow-pink-100 hover:bg-primary-hover"
                        )}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : alreadyDoneToday && userRole !== 'ADMIN' ? (
                          <><CheckCircle2 className="w-4 h-4" /> Đã xong hôm nay</>
                        ) : (
                          <><ChevronRight className="w-4 h-4" /> Cập nhật buổi {(booking.completed_sessions || 0) + 1}</>
                        )}
                      </button>
                  ) : (
                    <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-widest text-[10px] bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" /> Đã hoàn tất
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
              onClick={() => setSelectedBooking(null)}
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
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Chi tiết liệu trình: {selectedBooking.customers?.name_mother}</h2>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">{selectedBooking.package_name} • {selectedBooking.booking_number}</p>
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
                  <button 
                    onClick={() => setSelectedBooking(null)}
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
                        {selectedSessionLog ? `Cập nhật buổi ${selectedSessionLog.session_number}` : 'Chọn một buổi để cập nhật'}
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Ngày dự kiến</label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                disabled={!selectedSessionLog}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
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
                                disabled={!selectedSessionLog}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-xs disabled:opacity-50"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Trạng thái</label>
                          <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            disabled={!selectedSessionLog}
                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 text-xs disabled:opacity-50 appearance-none"
                          >
                            <option value="scheduled">Đã lên lịch</option>
                            <option value="completed">Đã hoàn thành</option>
                            <option value="canceled">Đã hủy</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Ghi chú chăm sóc</label>
                          <textarea 
                            placeholder="Nhập ghi chú quan sát mẹ và bé..."
                            value={currentNote}
                            onChange={(e) => setCurrentNote(e.target.value)}
                            disabled={!selectedSessionLog}
                            className="w-full h-24 p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 placeholder:text-slate-300 resize-none transition-all disabled:opacity-50 text-xs"
                          />
                        </div>

                        <button 
                          onClick={handleSaveFullUpdate}
                          disabled={isSavingNote || !selectedSessionLog}
                          className="w-full mt-2 bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-pink-100 flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                          Cập nhật thông tin
                        </button>
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
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4 relative z-10">Tóm tắt tiến độ</h3>
                      <div className="grid grid-cols-2 gap-6 relative z-10">
                        <div>
                          <p className="text-xs opacity-60 font-bold uppercase">Hoàn thành</p>
                          <p className="text-2xl font-black">{selectedBooking.completed_sessions}</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-60 font-bold uppercase">Còn lại</p>
                          <p className="text-2xl font-black">{(selectedBooking.total_sessions || 21) - (selectedBooking.completed_sessions || 0)}</p>
                        </div>
                      </div>
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
                            const status = localSessionLogUpdates[log.id] ?? log.status;
                            const isUpdating = updatingId === log.id;
                            const currentLogsStatus = sessionLogs.map(l => ({ ...l, status: localSessionLogUpdates[l.id] ?? l.status }));
                            const nextScheduledIndex = currentLogsStatus.findIndex(l => l.status === 'scheduled');
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
                                  status === 'canceled' ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 shadow-sm' :
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
