'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  X,
  FileText,
  Users,
  Package,
  CalendarDays,
  History,
  Briefcase,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';

import { getCalendarSessions, updateSessionLog, getBookings, createSessionLog } from '@/services/booking-actions';
import { getUsers } from '@/services/user-actions';
import { MOCK_BOOKINGS } from '@/constants/mock-data';
import { MOCK_SERVICES } from '@/constants/mock-data';

const mockBookings = MOCK_BOOKINGS.map(b => ({
  id: b.id,
  customer: b.customers?.name_mother || 'Khách hàng',
  package: b.package_name,
  time: '09:00 - 11:00', // Mock time
  ktv: 'Kỹ thuật viên',
  status: b.status === 'in_progress' ? 'in_progress' : b.status === 'booked' ? 'scheduled' : 'completed',
  location: 'Số 123, Đường ABC, Quận 1, TP.HCM',
  sessionCount: '10/12 buổi',
  contractId: 'HD-2024-001',
  contractDetail: 'Gói chăm sóc Mẹ & Bé chuyên sâu - 12 buổi'
}));

function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (customerName) {
      toast.info(`Đang mở biểu mẫu đặt lịch cho khách hàng: ${customerName}`);
    }
  }, [customerName]);

  const fetchAllBookings = async () => {
    const data = await getBookings();
    setAllBookings(data);
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const data = await getCalendarSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAllBookings();

    // REALTIME SUBSCRIPTION
    const supabase = createClient() as any;
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchAllBookings();
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the beginning of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End at the end of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const monthDays = getMonthDays(currentMonth);
  const today = new Date();
  
  const formatDateHeader = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', { 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  const isSameMonth = (d1: Date, d2: Date) => {
    return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const handleDayDoubleClick = (date: Date) => {
    const daySessions = sessions.filter(s => s.assigned_date && isSameDay(new Date(s.assigned_date), date));
    
    if (daySessions.length > 0) {
      const s = daySessions[0];
      const detail = {
        id: s.id,
        date,
        customer: s.bookings?.customers?.name_mother || 'Khách hàng',
        package: s.bookings?.package_name || 'Gói liệu trình',
        time: s.assigned_time || '09:00 - 11:00',
        ktv: s.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
        status: s.status,
        location: s.bookings?.customers?.address || 'Tại Spa',
        sessionCount: `${s.bookings?.completed_sessions || 0}/${s.bookings?.total_sessions || 21} buổi`,
        contractId: s.bookings?.booking_number || 'N/A',
        contractDetail: s.notes || 'Không có ghi chú'
      };
      setModalData(detail);
      setShowDetailModal(true);
    } else {
      toast.info(`Không có lịch hẹn vào ngày ${date.toLocaleDateString('vi-VN')}`);
    }
  };

  const handleUpdatePlan = async () => {
    setIsUpdating(true);
    try {
      // Logic to update the session log in Supabase
      const result = await updateSessionLog(modalData.id, {
        assigned_time: modalData.time,
        notes: modalData.contractDetail,
        status: modalData.status
      });

      if (result.error) {
        toast.error('Lỗi: ' + result.error);
      } else {
        toast.success('Đã cập nhật kế hoạch chăm sóc thành công!');
        fetchSessions();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Có lỗi xảy ra khi lưu dữ liệu');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch hẹn</h1>
          <p className="text-slate-500 font-medium mt-1">Điều phối và theo dõi lịch chăm sóc</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl border border-slate-200 flex">
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('calendar')}
              className={`p-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Tạo lịch mới</span>
          </button>
        </div>
      </div>

      {/* Date Selector (Google Calendar Style Box) */}
      <div className="luxury-card-white p-8 rounded-[40px] mb-8 overflow-hidden relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
              <button 
                onClick={() => {
                  const prev = new Date(currentMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setCurrentMonth(prev);
                }}
                className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button 
                onClick={() => {
                  const next = new Date(currentMonth);
                  next.setMonth(next.getMonth() + 1);
                  setCurrentMonth(next);
                }}
                className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
              {formatDateHeader(currentMonth)}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDate(new Date());
              }}
              className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
            >
              Hôm nay
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 mb-4">
          {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((day) => (
            <div key={day} className="text-center">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
            </div>
          ))}
        </div>

        {/* Grid Box */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
            </div>
          )}
          {monthDays.map((date, i) => {
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            
            const daySessions = sessions.filter(s => s.assigned_date && isSameDay(new Date(s.assigned_date), date));
            
            return (
              <div 
                key={i} 
                onClick={() => setSelectedDate(date)}
                onDoubleClick={() => handleDayDoubleClick(date)}
                className={`min-h-[100px] p-3 bg-white transition-all cursor-pointer group hover:bg-slate-50/80 relative select-none ${
                  !isCurrentMonth ? 'opacity-40' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`flex items-center justify-center w-8 h-8 text-sm font-bold rounded-xl transition-all ${
                    isSelected 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                      : isToday 
                        ? 'bg-rose-50 text-rose-500 border border-rose-100' 
                        : 'text-slate-600 group-hover:text-slate-900'
                  }`}>
                    {date.getDate()}
                  </span>
                  {isToday && (
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                  )}
                </div>
                
                {/* Event Indicator */}
                {daySessions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400" style={{ width: '100%' }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 truncate">
                      {daySessions.length} Lịch hẹn
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bookings Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
          </div>
        ) : sessions.filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate)).length > 0 ? (
          sessions
            .filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate))
            .map((session: any, idx: number) => (
              <motion.div 
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative pl-8 group"
              >
                {/* Timeline Line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-slate-100 group-last:bottom-1/2"></div>
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
                  session.status === 'completed' ? 'bg-emerald-500' : session.status === 'scheduled' ? 'bg-amber-500' : 'bg-slate-300'
                }`}></div>

                  <div 
                    onClick={() => {
                      const detail = {
                        id: session.id,
                        date: new Date(session.assigned_date),
                        customer: session.bookings?.customers?.name_mother || 'Khách hàng',
                        package: session.bookings?.package_name || 'Gói liệu trình',
                        time: session.assigned_time || '09:00 - 11:00',
                        ktv: session.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
                        status: session.status,
                        location: session.bookings?.customers?.address || 'Tại Spa',
                        sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 21} buổi`,
                        contractId: session.bookings?.booking_number || 'N/A',
                        contractDetail: session.notes || 'Không có ghi chú'
                      };
                      setModalData(detail);
                      setShowDetailModal(true);
                    }}
                    className="luxury-card-white p-6 rounded-3xl transition-all flex flex-col md:flex-row md:items-center gap-6 cursor-pointer hover:shadow-xl hover:border-primary/20"
                  >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5 text-slate-900 font-black">
                        <Clock className="w-4 h-4 text-rose-500" />
                        {session.assigned_time || '09:00 - 11:00'}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        session.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                        session.status === 'scheduled' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {session.status === 'completed' ? 'Hoàn thành' : 
                         session.status === 'scheduled' ? 'Sắp tới' : 'Khác'}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{session.bookings?.customers?.name_mother}</h3>
                    <p className="text-slate-500 font-bold text-sm flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-slate-300" />
                      {session.bookings?.package_name || 'Gói liệu trình'}
                    </p>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 md:border-l md:pl-8 border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Kỹ thuật viên</p>
                        <p className="font-bold text-slate-900">{session.bookings?.assigned_ktv?.full_name || 'Chưa phân công'}</p>
                      </div>
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                        {session.bookings?.assigned_ktv?.full_name?.[0] || 'K'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-600 transition-colors">
                        Dời lịch
                      </button>
                      <button className="px-4 py-2 bg-primary hover:bg-rose-600 text-white rounded-xl font-bold text-xs transition-colors">
                        Check-in
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
        ) : (
          <div className="bg-white/50 border border-dashed border-slate-200 rounded-[32px] p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Không có lịch hẹn nào cho ngày này</p>
          </div>
        )}
      </div>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {showDetailModal && modalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Chi tiết lịch hẹn</h3>
                    <p className="text-rose-500 font-bold mt-1">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(modalData.date)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                {/* Modal Content - Bento Style */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Customer & KTV */}
                  <div className="col-span-2 md:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-slate-400">
                      <Users className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Nhân sự & Khách hàng</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Khách hàng</p>
                        <p className="font-bold text-slate-900">{modalData.customer}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Kỹ thuật viên</p>
                        <input 
                          type="text" 
                          value={modalData.ktv}
                          onChange={(e) => setModalData({...modalData, ktv: e.target.value})}
                          className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time & Location */}
                  <div className="col-span-2 md:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-slate-400">
                      <Clock className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Thời gian & Địa điểm</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Giờ chăm sóc</p>
                        <input 
                          type="text" 
                          value={modalData.time}
                          onChange={(e) => setModalData({...modalData, time: e.target.value})}
                          className="w-full bg-white border-none rounded-xl px-4 py-2 font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Địa chỉ</p>
                        <p className="font-bold text-slate-900 text-sm leading-relaxed">{modalData.location}</p>
                      </div>
                    </div>
                  </div>

                  {/* Package & Progress */}
                  <div className="col-span-2 md:col-span-1 bg-rose-50/50 p-6 rounded-[32px] border border-rose-100">
                    <div className="flex items-center gap-3 mb-4 text-rose-400">
                      <Package className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Gói dịch vụ</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-rose-400 font-bold mb-1">Liệu trình</p>
                        <p className="font-bold text-slate-900">{modalData.package}</p>
                      </div>
                      <div>
                        <p className="text-xs text-rose-400 font-bold mb-1">Số lượng buổi</p>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-slate-900">{modalData.sessionCount}</p>
                          <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: '83%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contract Detail */}
                  <div className="col-span-2 md:col-span-1 luxury-card-pink p-6 rounded-[32px]">
                    <div className="flex items-center gap-3 mb-4 text-slate-500">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Ghi chú & Trạng thái</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">Trạng thái</p>
                        <select 
                          value={modalData.status}
                          onChange={(e) => setModalData({...modalData, status: e.target.value})}
                          className="w-full bg-white/20 border-none rounded-xl px-4 py-2 font-bold text-white shadow-sm focus:ring-2 focus:ring-white/20 transition-all outline-none"
                        >
                          <option value="scheduled" className="text-slate-900">Sắp tới</option>
                          <option value="completed" className="text-slate-900">Đã xong</option>
                          <option value="canceled" className="text-slate-900">Đã hủy</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">Ghi chú nhanh</p>
                        <textarea 
                          value={modalData.contractDetail}
                          onChange={(e) => setModalData({...modalData, contractDetail: e.target.value})}
                          className="w-full bg-white/20 border-none rounded-xl px-4 py-2 font-bold text-white shadow-sm focus:ring-2 focus:ring-white/20 transition-all outline-none text-sm h-20 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={handleUpdatePlan}
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-200 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Lưu thay đổi'}
                  </button>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create New Schedule Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900">Tạo lịch chăm sóc mới</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                setIsUpdating(true);
                const formData = new FormData(e.currentTarget);
                try {
                  const result = await createSessionLog({
                    booking_id: formData.get('booking_id'),
                    assigned_date: formData.get('date'),
                    assigned_time: formData.get('time'),
                    notes: formData.get('notes'),
                    status: 'scheduled'
                  });

                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success('Đã tạo lịch hẹn mới thành công!');
                    fetchSessions();
                    setShowCreateModal(false);
                  }
                } catch (error) {
                  toast.error('Có lỗi xảy ra');
                } finally {
                  setIsUpdating(false);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Chọn Hợp đồng / Khách hàng</label>
                    <select name="booking_id" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1">
                      {allBookings.length > 0 ? (
                        allBookings.map(b => (
                          <option key={b.id} value={b.id}>{b.customers?.name_mother} - {b.booking_number}</option>
                        ))
                      ) : (
                        <option disabled>Không có hợp đồng nào</option>
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ngày thực hiện</label>
                      <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Giờ thực hiện</label>
                      <input name="time" type="text" placeholder="09:00 - 11:00" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ghi chú</label>
                    <textarea name="notes" placeholder="Nhập yêu cầu đặc biệt..." className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1 h-24 resize-none" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-200 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Xác nhận lịch hẹn'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <BookingsContent />
    </Suspense>
  );
}
