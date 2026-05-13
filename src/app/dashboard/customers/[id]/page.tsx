'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight,
  Phone, 
  MapPin, 
  Baby, 
  Calendar, 
  ClipboardList, 
  DollarSign, 
  Clock, 
  MessageCircle,
  Heart,
  History,
  TrendingUp,
  FileText,
  PlusCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getCustomerById } from '@/services/customer-actions';
import { completeSession, reusePackage } from '@/services/booking-actions';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BookingModal } from '@/components/features/BookingModal';
import { createClient } from '@/lib/supabase-client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const dynamic = 'force-dynamic';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCompleteSession = async (sessionId: string, bookingId: string) => {
    if (!sessionId || !bookingId) return;
    
    setIsUpdating(true);
    try {
      const result = await completeSession(sessionId, bookingId);
      if (result.success) {
        toast.success('Cập nhật tiến độ thành công!');
        await loadData();
      } else {
        toast.error(result.error || 'Lỗi khi cập nhật tiến độ');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsUpdating(false);
    }
  };

  const [isReusing, setIsReusing] = useState(false);
  const handleReusePackage = async (bookingId: string) => {
    if (!bookingId) return;

    const confirm = window.confirm(`Bạn có chắc chắn muốn tái sử dụng gói dịch vụ nhanh cho khách hàng ${customer.name_mother}?`);
    if (!confirm) return;
    
    setIsReusing(true);
    try {
      const result = await reusePackage(bookingId);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else if ('data' in result && result.data) {
        toast.success('Đã tái sử dụng gói dịch vụ thành công!');
        await loadData();
      }
    } catch (error) {
      console.error('Reuse failed:', error);
      toast.error('Có lỗi xảy ra khi xử lý');
    } finally {
      setIsReusing(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCustomerById(id);
      if (data) {
        // Map database structure to UI structure
        setCustomer({
          ...data,
          baby: { 
            name: data.name_baby || 'Chưa có', 
            dob: data.dob_baby || data.dob_expected || 'Chưa cập nhật',
            gender: 'Chưa xác định'
          },
          booking: {
            package: data.package_name,
            total_sessions: data.bookings?.[0]?.total_sessions || 0,
            completed_sessions: data.bookings?.[0]?.completed_sessions || 0,
            start_date: data.bookings?.[0]?.start_date || (data.status === 'deposit' ? 'Dự kiến sau sinh' : 'Chưa có'),
            deposit: data.deposit_amount || '0đ',
            full_price: data.bookings?.[0]?.full_price || 0,
            remaining: data.bookings?.[0]?.full_price ? `${(data.bookings[0].full_price - (data.bookings[0].deposit_amount || 0)).toLocaleString()}đ` : '0đ'
          },
          sessions: data.sessions || []
        });
      } else {
        toast.error(`Không tìm thấy dữ liệu cho ID: ${id}`);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${id}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        // We can't easily filter session_logs by customer_id directly in the subscription without joins, 
        // but we can refresh when anything changes or use booking_id if we want to be more specific.
        // For simplicity and correctness, we refresh the whole customer state.
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/30">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Không tìm thấy khách hàng</h2>
        <button onClick={() => router.back()} className="text-rose-500 font-bold hover:underline">Quay lại danh sách</button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Back Button */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold transition-all mb-8 group"
      >
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </div>
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="xl:col-span-1 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
          >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-32 h-32 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-100 border-4 border-white">
                <Heart className="text-primary w-14 h-14" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">{customer.name_mother}</h1>
              <span className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8",
                customer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              )}>
                {customer.status === 'active' ? 'Đang chăm sóc' : 'Chờ sinh (Đã cọc)'}
              </span>

              <div className="w-full space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Điện thoại</p>
                    <p className="font-bold text-slate-700">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ</p>
                    <p className="font-bold text-slate-700 truncate max-w-[150px]">{customer.address}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="w-full mt-8 flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-rose-200 active:scale-95"
              >
                <PlusCircle className="w-5 h-5" />
                <span>ĐẶT LỊCH NGAY</span>
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
          >
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <Baby className="text-primary w-6 h-6" />
              Thông tin Bé
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                <span className="text-sm font-bold text-slate-500">Tên của bé</span>
                <span className="font-black text-slate-900">{customer.baby.name}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Ngày sinh / Dự sinh</span>
                <span className="font-black text-slate-900">{customer.baby.dob}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Giới tính</span>
                <span className="font-black text-slate-900">{customer.baby.gender}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Dashboard Details */}
        <div className="xl:col-span-2 space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Tiến độ', value: `${customer.booking.completed_sessions}/${customer.booking.total_sessions}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Đã thanh toán', value: customer.booking.deposit, icon: DollarSign, color: 'text-primary', bg: 'bg-rose-50' },
              { label: 'Ngày bắt đầu', value: customer.booking.start_date, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white p-6 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-5"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", stat.bg)}>
                  <stat.icon className={cn("w-7 h-7", stat.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Package Details */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="luxury-card-pink rounded-[3rem] p-8 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-rose-200 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Gói dịch vụ hiện tại</p>
                  <h2 className="text-3xl font-black text-white">{customer.booking.package}</h2>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] text-rose-100/60 font-bold uppercase mb-1">Tổng cộng</p>
                    <p className="font-black text-lg text-white">{(customer.booking.full_price || 0).toLocaleString()}đ</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] text-rose-100/60 font-bold uppercase mb-1">Còn lại</p>
                    <p className="font-black text-lg text-rose-200">{customer.booking.remaining}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <button 
                  onClick={() => {
                    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
                    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black transition-all hover:bg-rose-50 uppercase tracking-widest text-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  Gửi báo cáo Zalo
                </button>
                <button 
                  onClick={() => toast.success('Đang khởi tạo tệp hợp đồng...')}
                  className="flex items-center justify-center gap-3 bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-2xl font-black transition-all hover:bg-white/20 uppercase tracking-widest text-xs"
                >
                  <FileText className="w-4 h-4" />
                  Xuất hợp đồng
                </button>
              </div>
            </div>
          </motion.div>

          {/* Session History */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <History className="text-primary w-6 h-6" />
                Lịch sử chăm sóc ({customer.bookings?.[0]?.completed_sessions || 0}/{customer.bookings?.[0]?.total_sessions || 21})
              </h3>
              <button className="text-sm font-bold text-primary hover:underline">Xem tất cả</button>
            </div>

            <div className="space-y-4">
              {/* Next Session Action */}
              {customer.sessions.find((s: any) => s.status === 'scheduled') ? (() => {
                const nextSession = customer.sessions.find((s: any) => s.status === 'scheduled');
                return (
                <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-1">Buổi tiếp theo</p>
                      <h4 className="text-xl font-black text-slate-900">Buổi số {nextSession.session_number}</h4>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push('/dashboard/sessions')}
                    className="w-full md:w-auto bg-primary hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-rose-200 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <ClipboardList className="w-5 h-5" />
                    XEM THẺ LIỆU TRÌNH
                  </button>
                </div>
                );
              })()
              ) : customer.booking.completed_sessions >= (customer.booking.total_sessions || 21) && customer.booking.total_sessions > 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                      <Heart className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Liệu trình đã hoàn tất</p>
                      <h4 className="text-xl font-black text-slate-900">Mẹ đã xong gói liệu trình</h4>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleReusePackage(customer.bookings?.[0]?.id)}
                    disabled={isReusing}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isReusing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    TÁI SỬ DỤNG GÓI NHANH
                  </button>
                </div>
              ) : null}

              {customer.sessions.filter((s: any) => s.status === 'completed').length > 0 ? (
                customer.sessions.filter((s: any) => s.status === 'completed').map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{session.type || 'Chăm sóc liệu trình'} - Buổi {session.session_number}/{customer.bookings?.[0]?.total_sessions || 21}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">KTV: {customer.bookings?.[0]?.assigned_ktv?.full_name || 'Chưa phân công'} • {session.completed_date || session.assigned_date || 'Chưa cập nhật'}</p>
                        {session.notes && (
                          <p className="text-[11px] font-medium text-slate-500 mt-1 line-clamp-1">{session.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Hoàn thành</span>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic">Chưa có dữ liệu liệu trình hoàn thành</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">Khách hàng chưa thực hiện buổi nào</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)}
        preselectedCustomer={customer}
      />
    </div>
  );
}
