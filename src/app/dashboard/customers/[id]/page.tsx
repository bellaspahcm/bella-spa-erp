'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  PlusCircle,
  Sparkles,
  User,
  CheckCircle2,
  Image as ImageIcon,
  CreditCard as CreditCardIcon,
  DollarSign as DollarIcon,
  Camera,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { getCustomerById, updateCustomer } from '@/services/customer-actions';
import { getBookingsByCustomerId, updateBooking, completeSession, reusePackage, recordRemainingPayment } from '@/services/booking-actions';
import { getUsers, getCurrentUser } from '@/services/user-actions';
import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { BookingModal } from '@/components/features/BookingModal';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

export const dynamic = 'force-dynamic';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const targetBookingId = searchParams.get('bookingId');
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [ktvs, setKtvs] = useState<any[]>([]);
  const [isUpdatingKTV, setIsUpdatingKTV] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'bank_transfer',
    notes: '',
    receipt_url: '',
    status: 'confirmed'
  });

  const [userRole, setUserRole] = useState<'admin' | 'ktv'>('ktv');

  useEffect(() => {
    async function checkRole() {
      const user = await getCurrentUser();
      if (user?.role) {
        setUserRole(user.role as any);
      }
    }
    checkRole();
  }, []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [editData, setEditData] = useState({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    dob_baby: '',
    address: '',
    notes: '',
    gender_baby: 'unknown'
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCustomerById(id);
      const bookings = await getBookingsByCustomerId(id);
      
      if (data) {
        setCustomer({
          ...data,
          baby: { 
            name: data.name_baby || 'Chưa có', 
            dob: data.dob_baby || data.dob_expected || 'Chưa cập nhật',
            gender: data.gender_baby === 'boy' ? 'Bé Trai' : 
                    data.gender_baby === 'girl' ? 'Bé Gái' : 
                    'Chưa xác định'
          },
          sessions: data.sessions || [],
          allBookings: bookings || []
        });
        
        if (bookings && bookings.length > 0) {
          // 1. If targetBookingId exists in URL, try to find it first
          if (targetBookingId) {
            const found = bookings.find(b => b.id === targetBookingId);
            if (found) {
              setActiveBooking(found);
              return;
            }
          }

          // 2. Default Sort to get the most relevant one
          const sorted = [...bookings].sort((a, b) => {
            // Prioritize active/booked/in_progress over others
            const priority = (s: string) => {
              if (s === 'active' || s === 'in_progress') return 0;
              if (s === 'booked') return 1;
              if (s === 'deposit_pending') return 2;
              if (s === 'completed') return 3;
              return 4;
            };

            const pA = priority(a.status);
            const pB = priority(b.status);

            if (pA !== pB) return pA - pB;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setActiveBooking(sorted[0]);
        } else {
          setActiveBooking(null);
        }
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [id, targetBookingId]);

  async function fetchKtvs() {
    try {
      const data = await getUsers();
      setKtvs(data.filter((u: any) => u.role === 'ktv'));
    } catch (error) {
      console.error('Error fetching KTVs:', error);
    }
  }

  useEffect(() => {
    loadData();
    fetchKtvs();

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${id}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadData]);

  const handleUpdateKTV = async (ktvId: string) => {
    if (!activeBooking) return;
    setIsUpdatingKTV(true);
    try {
      const result = await updateBooking(activeBooking.id, { assigned_ktv_id: ktvId });
      if (result.error) throw new Error(result.error);
      toast.success('Đã cập nhật KTV phụ trách');
      loadData();
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setIsUpdatingKTV(false);
    }
  };

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

  const handleUpdateCustomer = async () => {
    setIsUpdatingCustomer(true);
    try {
      const result = await updateCustomer(id as string, editData);
      if (result.error) throw new Error(result.error);
      
      if (result.warning) {
        toast.success('Cập nhật thành công các thông tin khác!');
        toast.warning(result.warning, { duration: 10000 });
      } else {
        toast.success('Cập nhật hồ sơ thành công!');
      }
      
      setIsEditModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setIsUpdatingCustomer(false);
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

  const handleRecordPayment = async () => {
    if (!activeBooking) return;
    if (paymentData.amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsRecordingPayment(true);
    try {
      let finalReceiptUrl = paymentData.receipt_url;

      // Upload file if selected
      if (paymentFile) {
        const supabase = createClient();
        const fileExt = paymentFile.name.split('.').pop();
        const fileName = `${activeBooking.id}-${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('receipts')
          .upload(filePath, paymentFile);

        if (uploadError) {
          // If bucket doesn't exist, try to inform but proceed if possible
          console.error('Upload error:', uploadError);
          if (uploadError.message.includes('bucket not found')) {
            toast.error('Hệ thống Storage chưa được cấu hình. Vui lòng tạo bucket "receipts".');
          }
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          finalReceiptUrl = publicUrl;
        }
      }

      const result = await recordRemainingPayment({
        booking_id: activeBooking.id,
        customer_id: id,
        amount: paymentData.amount,
        payment_method: paymentData.method,
        notes: paymentData.notes,
        receipt_url: finalReceiptUrl,
        status: paymentData.status // Pass status
      });

      if (result.error) throw new Error(result.error);
      
      toast.success('Đã ghi nhận thanh toán thành công!');
      setIsPaymentModalOpen(false);
      setPaymentFile(null);
      loadData();
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message);
    } finally {
      setIsRecordingPayment(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50/30">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
    </div>
  );

  if (!customer) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Không tìm thấy khách hàng</h2>
      <button onClick={() => router.back()} className="text-rose-500 font-bold hover:underline">Quay lại danh sách</button>
    </div>
  );

  const isDepositOnly = activeBooking && activeBooking.status === 'deposit_pending' && !activeBooking.package_name;
  const nextSession = customer.sessions?.find((s: any) => s.status === 'scheduled');
  const isCompleted = activeBooking && activeBooking.completed_sessions >= (activeBooking.total_sessions || 15);

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold mb-8 group">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </div>
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-32 h-32 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-100 border-4 border-white">
                <Heart className="text-primary w-14 h-14" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">{customer.name_mother}</h1>
              {userRole === 'admin' && (
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8",
                  customer.is_fully_paid ? 'bg-blue-50 text-blue-600' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'bg-emerald-50 text-emerald-600' : 
                  customer.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  customer.status === 'deposit_pending' ? 'bg-amber-50 text-amber-600' : 
                  'bg-slate-50 text-slate-500'
                )}>
                  {customer.is_fully_paid ? 'Đã thanh toán thành công' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'Đang chăm sóc' : 
                  customer.status === 'completed' ? 'Đã hoàn tất' :
                  customer.status === 'deposit_pending' ? 'Chờ sinh (Đã cọc)' : 
                  'Khách mới (Lead)'}
                </span>
              )}

              <div className="w-full space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Điện thoại</p>
                    <p className="font-bold text-slate-700">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
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
                onClick={() => {
                  setEditData({
                    name_mother: customer.name_mother,
                    phone: customer.phone,
                    name_baby: customer.name_baby || '',
                    dob_expected: customer.dob_expected || '',
                    dob_baby: customer.dob_baby || '',
                    address: customer.address || '',
                    notes: customer.notes || '',
                    gender_baby: customer.gender_baby || 'unknown'
                  });
                  setIsEditModalOpen(true);
                }}
                className="w-full mt-8 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95"
              >
                <PlusCircle className="w-5 h-5" />
                <span>CẬP NHẬT THÔNG TIN</span>
              </button>

              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="w-full mt-4 flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-rose-200 active:scale-95"
              >
                <TrendingUp className="w-5 h-5" />
                <span>ĐẶT LỊCH NGAY</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
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
          </div>
        </div>

        <div className="xl:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Tiến độ', value: activeBooking ? `${activeBooking.completed_sessions || 0}/${activeBooking.total_sessions || 0}` : '0/0', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              ...(userRole === 'admin' ? [{ 
                label: activeBooking && activeBooking.deposit_amount >= activeBooking.full_price ? 'Đã thanh toán thành công' : 'Đã cọc', 
                value: activeBooking ? formatNumberWithSeparator(activeBooking.deposit_amount || 0) + 'đ' : '0đ', 
                icon: DollarSign, 
                color: 'text-primary', 
                bg: 'bg-rose-50' 
              }] : []),
              { label: 'Ngày bắt đầu', value: activeBooking?.start_date || 'Chưa có', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map((stat, i) => (
              <div 
                key={i}
                className="bg-white p-6 rounded-[2.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-5"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", stat.bg)}>
                  <stat.icon className={cn("w-7 h-7", stat.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-black text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {customer.allBookings?.length > 1 && (
            <div className="bg-white rounded-[2.5rem] p-6 shadow-lg border border-primary/10 mb-8">
              <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Chọn gói liệu trình đang xem</p>
                <span className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black rounded-full uppercase">
                  Có {customer.allBookings.length} gói dịch vụ
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.allBookings.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBooking(b)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                      activeBooking?.id === b.id 
                        ? "bg-primary text-white border-primary shadow-lg shadow-pink-100" 
                        : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30"
                    )}
                  >
                    {b.package_name || (b.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Gói lẻ')} 
                    <span className="ml-2 opacity-60">({b.status})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="luxury-card-pink rounded-[3rem] p-8 relative shadow-2xl group">
            {/* Background Decorative Layer - Clipped */}
            <div className="absolute inset-0 overflow-hidden rounded-[3rem] pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div>
                        <p className="text-rose-200 text-[10px] font-black uppercase tracking-[0.3em] mb-1">
                          {isDepositOnly ? 'Trạng thái: Chờ chọn gói' : 'Gói dịch vụ hiện tại'}
                        </p>
                        <h2 className="text-3xl font-black text-white">
                          {isDepositOnly ? 'Đã đặt cọc (Chưa chọn gói)' : (activeBooking?.package_name || 'Chưa có gói liệu trình')}
                        </h2>
                      </div>
                      
                      {!isDepositOnly && activeBooking?.preferred_time && (
                        <div className="bg-white px-5 py-2.5 rounded-2xl shadow-xl shadow-rose-900/20 border border-white flex flex-col items-center justify-center min-w-[120px] self-start md:self-center mt-2 md:mt-0">
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">GIỜ MẶC ĐỊNH</span>
                          <span className="text-2xl font-black text-slate-900 leading-none">{activeBooking.preferred_time}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    {userRole === 'admin' && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                        <p className="text-[10px] text-rose-100/60 font-bold uppercase mb-1">Tổng cộng</p>
                        <p className="font-black text-lg text-white">
                          {isDepositOnly ? '---' : formatNumberWithSeparator(activeBooking?.full_price || 0) + 'đ'}
                        </p>
                      </div>
                    )}

                    {userRole === 'admin' && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                        <div>
                          <p className="text-[10px] text-rose-100/60 font-bold uppercase mb-1">Còn lại</p>
                          <p className="font-black text-xl text-white">
                            {isDepositOnly ? '---' : formatNumberWithSeparator(Math.max(0, (activeBooking?.full_price || 0) - (activeBooking?.deposit_amount || 0))) + 'đ'}
                          </p>
                        </div>
                        {!isDepositOnly && (activeBooking?.full_price || 0) - (activeBooking?.deposit_amount || 0) > 0 && (
                          <button 
                            onClick={() => {
                              setPaymentData({
                                ...paymentData,
                                amount: (activeBooking?.full_price || 0) - (activeBooking?.deposit_amount || 0)
                              });
                              setIsPaymentModalOpen(true);
                            }}
                            className="bg-white text-rose-500 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-lg active:scale-95"
                          >
                            Thanh toán nốt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3 min-w-[200px]">
                  {isDepositOnly ? (
                    <button 
                      onClick={() => setIsBookingModalOpen(true)}
                      className="w-full flex items-center justify-center gap-3 bg-white text-rose-500 px-8 py-4 rounded-2xl font-black transition-all hover:scale-105 shadow-xl"
                    >
                      CHỌN GÓI NGAY
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          const cleanPhone = customer.phone.replace(/[^\d]/g, '');
                          window.open(`https://zalo.me/${cleanPhone}`, '_blank');
                        }}
                        className="flex items-center justify-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black transition-all hover:bg-rose-50 uppercase tracking-widest text-xs shadow-lg"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Gửi báo cáo Zalo
                      </button>
                      {userRole === 'admin' && (
                        <button 
                          disabled={activeBooking?.deposit_amount < activeBooking?.full_price}
                          onClick={() => toast.success('Đang khởi tạo tệp hợp đồng...')}
                          className={cn(
                            "flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black transition-all uppercase tracking-widest text-xs",
                            activeBooking?.deposit_amount >= activeBooking?.full_price
                              ? "bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
                              : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
                          )}
                        >
                          <FileText className="w-4 h-4" />
                          Xuất hợp đồng
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {activeBooking && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-white/10">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/60">
                      <User className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">KTV Phụ trách chính</span>
                    </div>
                    <div className="relative">
                      <PremiumSelect 
                        value={activeBooking.assigned_ktv_id || ''}
                        options={[
                          { value: '', label: 'Chưa phân công' },
                          ...ktvs.map(k => ({ value: k.id, label: k.full_name }))
                        ]}
                        onChange={(val) => handleUpdateKTV(val)}
                        disabled={isUpdatingKTV}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-3xl p-5 border border-white/10 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tiến độ buổi</span>
                      <span className="text-white font-black text-sm">{activeBooking.completed_sessions || 0}/{activeBooking.total_sessions || 0}</span>
                      <button 
                        onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking.id}`)}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors group/btn"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover/btn:text-primary transition-colors" />
                      </button>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${((activeBooking.completed_sessions || 0) / Math.max(1, activeBooking.total_sessions || 15)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <History className="text-primary w-6 h-6" />
                Lịch sử chăm sóc ({activeBooking?.completed_sessions || 0}/{activeBooking?.total_sessions || 15})
              </h3>
              <button 
                onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}`)}
                className="text-[10px] font-black text-primary hover:text-rose-600 uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                Xem tất cả <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              {nextSession ? (
                <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-1">Buổi tiếp theo</p>
                      <h4 className="text-xl font-black text-slate-900">Buổi số {nextSession.session_number}</h4>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        Ngày {nextSession.assigned_date || 'Chưa đặt'} • {nextSession.assigned_time || activeBooking?.preferred_time || '--:--'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}`)}
                    className="w-full md:w-auto bg-primary hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-rose-200 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <ClipboardList className="w-5 h-5" />
                    XEM THẺ LIỆU TRÌNH
                  </button>
                </div>
              ) : isCompleted ? (
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
                    onClick={() => handleReusePackage(activeBooking?.id)}
                    disabled={isReusing}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isReusing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    TÁI SỬ DỤNG GÓI NHANH
                  </button>
                </div>
              ) : null}

              {customer.sessions?.filter((s: any) => s.status === 'completed').length > 0 ? (
                customer.sessions.filter((s: any) => s.status === 'completed').map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{session.type || 'Chăm sóc liệu trình'} - Buổi {session.session_number}/{activeBooking?.total_sessions || 15}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          KTV: {activeBooking?.assigned_ktv?.full_name || 'Chưa phân công'} • {session.completed_date || session.assigned_date || 'Chưa cập nhật'}
                        </p>
                        {session.notes && (
                          <p className="text-[11px] font-medium text-slate-500 mt-1 line-clamp-1">{session.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Hoàn thành</span>
                      <button 
                        onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking.id}`)}
                        className="p-2 hover:bg-white rounded-xl transition-all shadow-sm group/btn active:scale-90"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover/btn:text-primary transition-colors" />
                      </button>
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
          </div>
        </div>
      </div>

      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={() => { setIsBookingModalOpen(false); loadData(); }}
        preselectedCustomer={customer}
      />

      <EditCustomerModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={handleUpdateCustomer}
        isSubmitting={isUpdatingCustomer}
        data={editData}
        setData={setEditData}
      />

      <BookingPaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleRecordPayment}
        isSubmitting={isRecordingPayment}
        data={paymentData}
        setData={setPaymentData}
        file={paymentFile}
        setFile={setPaymentFile}
        customerName={customer?.name_mother}
      />
    </div>
  );
}

function EditCustomerModal({ isOpen, onClose, onConfirm, isSubmitting, data, setData }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/80 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cập nhật thông tin</h2>
              <p className="text-xs text-slate-500 font-bold italic">Chỉnh sửa hồ sơ mẹ và bé</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
            <PlusCircle className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ tên Mẹ</label>
              <input 
                type="text" 
                value={data.name_mother}
                onChange={(e) => setData({ ...data, name_mother: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại</label>
              <input 
                type="text" 
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ tên Bé</label>
              <input 
                type="text" 
                value={data.name_baby}
                onChange={(e) => setData({ ...data, name_baby: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày sinh Bé / Dự sinh</label>
              <input 
                type="date" 
                value={data.dob_baby || data.dob_expected || ''}
                onChange={(e) => setData({ ...data, dob_baby: e.target.value, dob_expected: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Giới tính của Bé</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'boy', label: 'Bé Trai', color: 'blue' },
                { id: 'girl', label: 'Bé Gái', color: 'rose' },
                { id: 'unknown', label: 'Chưa biết', color: 'slate' }
              ].map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setData({ ...data, gender_baby: g.id })}
                  className={cn(
                    "py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border",
                    data.gender_baby === g.id 
                      ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-[1.02]" 
                      : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Địa chỉ</label>
            <textarea 
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-slate-700 h-24 resize-none"
            />
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Hủy</button>
          <button 
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function BookingPaymentModal({ isOpen, onClose, onConfirm, isSubmitting, data, setData, file, setFile, customerName }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#1A0A0E]/80 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Xác nhận thanh toán</h2>
            <p className="text-sm font-bold text-primary flex items-center gap-2">
              <User className="w-4 h-4" />
              Khách hàng: {customerName}
            </p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
            <PlusCircle className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <DollarIcon className="w-3.5 h-3.5" /> Số tiền thanh toán
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={formatNumberWithSeparator(data.amount)}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, '');
                  setData({ ...data, amount: val ? parseInt(val) : 0 });
                }}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-black text-lg text-primary"
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">VNĐ</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCardIcon className="w-3.5 h-3.5" /> Phương thức
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'bank_transfer', label: 'Chuyển khoản' },
                { id: 'cash', label: 'Tiền mặt' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setData({ ...data, method: m.id })}
                  className={cn(
                    "py-3 px-4 rounded-xl font-bold text-sm transition-all border",
                    data.method === m.id 
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                      : "bg-slate-50 text-slate-500 border-slate-100 hover:border-primary/30"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Minh chứng thanh toán (Bill)
            </label>
            
            <div className="relative group">
              {file ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 group">
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => setFile(null)}
                      className="bg-white text-rose-500 p-2 rounded-xl font-black text-xs uppercase"
                    >
                      Thay đổi ảnh
                    </button>
                  </div>
                </div>
              ) : (
                <label className="w-full h-32 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 hover:border-primary/30 transition-all">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-primary">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tải lên ảnh Bill</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {!file && (
              <div className="relative group mt-3">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Hoặc dán link ảnh trực tiếp..."
                  value={data.receipt_url}
                  onChange={(e) => setData({ ...data, receipt_url: e.target.value })}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-xs"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Ghi chú
            </label>
            <textarea 
              placeholder="Nhập ghi chú thanh toán..."
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm h-24 resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi nhận tài chính</label>
            <div 
              onClick={() => setData({ ...data, status: data.status === 'confirmed' ? 'pending' : 'confirmed' })}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                data.status === 'confirmed' 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                  : "bg-slate-50 border-transparent text-slate-500"
              )}
            >
              <div className="flex items-center gap-2">
                {data.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-wider">{data.status === 'confirmed' ? 'Xác nhận ngay (Vào báo cáo)' : 'Chờ phê duyệt'}</span>
              </div>
              <div className={cn(
                "w-10 h-5 rounded-full relative transition-all",
                data.status === 'confirmed' ? "bg-emerald-500" : "bg-slate-300"
              )}>
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                  data.status === 'confirmed' ? "left-6" : "left-1"
                )} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Hủy</button>
          <button 
            disabled={isSubmitting || data.amount <= 0}
            onClick={onConfirm}
            className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Xác nhận thu tiền
          </button>
        </div>
      </motion.div>
    </div>
  );
}
