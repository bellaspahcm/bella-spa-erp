'use client';

import { PaymentReceiptTemplate,ReceiptData } from '@/components/common/PaymentReceiptTemplate';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { createClient } from '@/lib/supabase-client';
import { cn,formatNumberWithSeparator } from '@/lib/utils';
import { generateShareToken,getBookingsByCustomerId,recordRemainingPayment,reusePackage,updateBooking } from '@/modules/booking/actions/lifecycle-actions';
import { getCustomerById,updateCustomer } from '@/services/customer-actions';
import { getCurrentUser,getUsers } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { motion } from 'framer-motion';
import { toPng } from 'html-to-image';
import {
Baby,
ChevronLeft,
ChevronRight,
ClipboardList,
Clock,
CreditCard as CreditCardIcon,
DollarSign as DollarIcon,
DollarSign,
FileText,
Heart,
History,
Image as ImageIcon,
Loader2,
MapPin,
MessageCircle,
Phone,
PlusCircle,
Share2,
Sparkles,
TrendingUp,
User
} from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { useParams,useRouter,useSearchParams } from 'next/navigation';
import { useCallback,useEffect,useRef,useState } from 'react';
import { toast } from 'sonner';
import { BookingPaymentModal, EditBookingModal, EditCustomerModal } from './components/CustomerDetailModals';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type RevenueRow = Database['public']['Tables']['revenue']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

type CustomerDetailSession = SessionLogRow & {
  completed_by_ktv?: { full_name: string | null; phone?: string | null } | null;
  type?: string | null;
};
type CustomerDetailRevenue = RevenueRow & {
  recorded_by?: { full_name: string | null } | null;
};
type CustomerDetailBooking = BookingRow & {
  packages?: { name?: string | null } | null;
  assigned_ktv?: { full_name: string | null; phone?: string | null } | null;
  session_logs?: CustomerDetailSession[];
  revenue?: CustomerDetailRevenue[];
};
type CustomerDetailRecord = CustomerRow & {
  baby: {
    name: string;
    dob: string;
    gender: string;
  };
  sessions: unknown[];
  allBookings: CustomerDetailBooking[];
  is_fully_paid?: boolean;
};
type KtvOption = Pick<UserRow, 'id' | 'full_name' | 'role'>;
function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  return error instanceof Error ? error.message : fallback;
}

// Lazy-load: only opens on user action, keeps customer detail page light.
// Aliased to nextDynamic to avoid colliding with `export const dynamic` segment config below.
const BookingModal = nextDynamic(
  () => import('@/components/features/BookingModal').then(m => ({ default: m.BookingModal })),
  { ssr: false }
);

export const dynamic = 'force-dynamic';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const targetBookingId = searchParams.get('bookingId');
  const [customer, setCustomer] = useState<CustomerDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<CustomerDetailBooking | null>(null);
  const [ktvs, setKtvs] = useState<KtvOption[]>([]);
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

  const quotationRef = useRef<HTMLDivElement>(null);
  const [isExportingQuotation, setIsExportingQuotation] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const user = await getCurrentUser();
      if (user?.role) {
        const r = user.role.toLowerCase();
        setUserRole(r === 'admin' ? 'admin' : 'ktv');
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
    gender_baby: 'unknown',
    latitude: null as number | null,
    longitude: null as number | null
  });

  const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [editBookingData, setEditBookingData] = useState({
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    discount_percent: 0,
    total_sessions: 0,
    completed_sessions: 0,
    preferred_time: '08:00',
    start_date: '',
    status: 'in_progress'
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCustomerById(id);
      const bookings = (await getBookingsByCustomerId(id)) as CustomerDetailBooking[];
      
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
          sessions: (data as { sessions?: unknown[] }).sessions || [],
          allBookings: bookings || []
        });
        
        if (bookings && bookings.length > 0) {
          // 1. If targetBookingId exists in URL, try to find it first
          if (targetBookingId) {
            const found = bookings.find((b) => b.id === targetBookingId);
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

            const pA = priority(a.status || '');
            const pB = priority(b.status || '');

            if (pA !== pB) return pA - pB;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
      router.refresh();
    }
  }, [id, router, targetBookingId]);

  async function fetchKtvs() {
    try {
      const data = await getUsers();
      setKtvs(data.filter((u) => u.role?.toLowerCase() === 'ktv'));
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
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsUpdatingKTV(false);
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
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  const handleSaveBooking = async () => {
    if (!activeBooking) return;
    setIsSavingBooking(true);
    try {
      const result = await updateBooking(activeBooking.id, {
        package_name: editBookingData.package_name || null,
        full_price: Number(editBookingData.full_price) || 0,
        deposit_amount: Number(editBookingData.deposit_amount) || 0,
        discount_percent: Number(editBookingData.discount_percent) || 0,
        total_sessions: Number(editBookingData.total_sessions) || 0,
        completed_sessions: Number(editBookingData.completed_sessions) || 0,
        preferred_time: editBookingData.preferred_time || '08:00',
        start_date: editBookingData.start_date || null,
        status: editBookingData.status
      });

      if (result.error) throw new Error(result.error);
      
      toast.success('Cập nhật gói dịch vụ thành công!');
      setIsEditBookingModalOpen(false);
      loadData();
    } catch (error: unknown) {
      toast.error('Lỗi cập nhật gói: ' + getErrorMessage(error));
    } finally {
      setIsSavingBooking(false);
    }
  };

  const [isReusing, setIsReusing] = useState(false);
  const handleReusePackage = async (bookingId: string) => {
    if (!bookingId || !customer) return;
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

        const { error: uploadError } = await supabase.storage
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
      await loadData();
      setIsPaymentModalOpen(false);
      setPaymentFile(null);
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const getReceiptData = (): ReceiptData | null => {
    if (!customer || !activeBooking) return null;
    return {
      customerName: customer.name_mother || 'Chưa cập nhật',
      phone: customer.phone || 'Chưa cập nhật',
      address: customer.address || 'Chưa cập nhật',
      serviceNote: `${activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ'} (Bắt đầu gói từ ${activeBooking.start_date || 'Chưa cập nhật'})`,
      items: [
        {
          id: 1,
          name: activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ',
          sessions: activeBooking.total_sessions || 15,
          unitPrice: Math.round((activeBooking.full_price || 0) / Math.max(1, activeBooking.total_sessions || 15)),
          total: activeBooking.full_price || 0,
          discountNote: activeBooking.discount_percent ? `Giảm ${activeBooking.discount_percent}%` : 'Không có',
          prepaid: activeBooking.deposit_amount || 0,
          finalPayment: Math.max(0, Math.round((activeBooking.full_price || 0) * (1 - (activeBooking.discount_percent || 0)/100)) - (activeBooking.deposit_amount || 0)),
        }
      ],
      totalAmount: Math.round((activeBooking.full_price || 0) * (1 - (activeBooking.discount_percent || 0)/100)),
      bankInfo: {
        ownerName: "Cao Thị Thúy Vân",
        accountNumber: "8832041471",
        bankName: "Ngân hàng BIDV",
      }
    };
  };

  const handleExportQuotation = async () => {
    if (!quotationRef.current || !customer) return;
    
    setIsExportingQuotation(true);
    toast.loading('Đang khởi tạo ảnh báo giá...', { id: 'quotation-export' });
    
    try {
      const dataUrl = await toPng(quotationRef.current, { 
        quality: 1, 
        pixelRatio: 2 
      });
      
      const link = document.createElement("a");
      link.download = `Bao_Gia_${(customer.name_mother || 'Khach').replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Đã xuất ảnh báo giá thành công!', { id: 'quotation-export' });
    } catch (err) {
      console.error("Failed to export image", err);
      toast.error('Lỗi khi xuất ảnh. Vui lòng thử lại!', { id: 'quotation-export' });
    } finally {
      setIsExportingQuotation(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-background/30">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
    </div>
  );

  if (!customer) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background/30">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Không tìm thấy khách hàng</h2>
      <button onClick={() => router.back()} className="text-rose-500 font-bold hover:underline">Quay lại danh sách</button>
    </div>
  );

  const isDepositOnly = activeBooking && activeBooking.status === 'deposit_pending' && !activeBooking.package_id;
  const sortedSessions = activeBooking?.session_logs
    ? [...activeBooking.session_logs].sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
    : [];
  const nextSession = sortedSessions.find((s) => s.status === 'scheduled');
  const activeDepositAmount = activeBooking?.deposit_amount || 0;
  const activeFullPrice = activeBooking?.full_price || 0;
  const activeDiscountPercent = activeBooking?.discount_percent || 0;
  const activeNetPrice = Math.round(activeFullPrice * (1 - activeDiscountPercent / 100));
  const isCompleted = Boolean(activeBooking && (activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 15));

  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto">
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
              <div className="w-32 h-32 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-100 dark:shadow-none border-4 border-white">
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
                    <p className="font-bold text-slate-700 truncate max-w-[150px]" title={customer.address || undefined}>{customer.address}</p>
                    {customer.latitude && customer.longitude && (
                      <p className="text-[9px] font-black text-rose-500 mt-0.5">
                        GPS: {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                      </p>
                    )}
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
                    gender_baby: customer.gender_baby || 'unknown',
                    latitude: customer.latitude || null,
                    longitude: customer.longitude || null
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
                className="w-full mt-4 flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-rose-200 dark:shadow-none active:scale-95"
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
                label: activeBooking && (activeFullPrice > 0 || activeDepositAmount > 0) && activeDepositAmount >= activeNetPrice ? 'Đã thanh toán đủ' : 'Đã cọc',
                value: activeBooking ? (
                  <div className="flex flex-col gap-1 leading-tight mt-0.5">
                    <span className="text-xl font-black text-slate-900">
                      {formatNumberWithSeparator(activeDepositAmount)}đ
                    </span>
                    {activeBooking.full_price && activeBooking.full_price > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400">
                          Giá gốc: <span className="line-through">{formatNumberWithSeparator(activeBooking.full_price)}đ</span>
                        </span>
                        {activeBooking.discount_percent && activeBooking.discount_percent > 0 ? (
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">
                            Đã giảm {activeBooking.discount_percent}%
                          </span>
                        ) : null}
                        {/* Remaining balance if not fully paid */}
                        {activeDepositAmount < activeNetPrice && (
                          <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">
                            Còn nợ: {formatNumberWithSeparator(Math.max(0, activeNetPrice - activeDepositAmount))}đ
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : '0đ', 
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
                  <div className="text-xl font-black text-slate-900 leading-tight">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-lg border border-primary/10 mb-8">
            <div className="flex items-center justify-between mb-2 px-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Chọn gói liệu trình đang xem</p>
              <span className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black rounded-full uppercase">
                Có {customer.allBookings?.length || 0} gói dịch vụ
              </span>
            </div>
            {activeBooking && (
              <p className="text-xs font-bold text-slate-500 mb-4 px-2">
                Hệ thống đang hiển thị thông tin và tiến độ của gói: <span className="text-primary font-black">{activeBooking.package_name || activeBooking.packages?.name || (activeBooking.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Dịch vụ lẻ')}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {customer.allBookings?.length > 0 ? (
                customer.allBookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBooking(b)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                      activeBooking?.id === b.id 
                        ? "bg-primary text-white border-primary shadow-lg shadow-pink-100 dark:shadow-none" 
                        : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/30"
                    )}
                  >
                    {b.package_name || (b.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Gói lẻ')} 
                    <span className="ml-2 opacity-60">({b.status})</span>
                  </button>
                ))
              ) : (
                <div className="w-full py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Khách hàng chưa có gói liệu trình nào</p>
                </div>
              )}
            </div>
          </div>

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
                          {isDepositOnly ? 'Đã đặt cọc (Chưa chọn gói)' : (activeBooking?.packages?.name || activeBooking?.package_name || 'Chưa có gói liệu trình')}
                        </h2>
                      </div>
                      
                      {!isDepositOnly && activeBooking?.preferred_time && (
                        <div className="bg-white px-5 py-2.5 rounded-2xl shadow-xl shadow-rose-900/20 dark:shadow-none border border-white flex flex-col items-center justify-center min-w-[120px] self-start md:self-center mt-2 md:mt-0">
                          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">GIỜ MẶC ĐỊNH</span>
                          <span className="text-2xl font-black text-slate-900 leading-none">{activeBooking.preferred_time}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 mt-4">
                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                      <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Tổng cộng (Giá gốc)</p>
                      <p className="font-black text-lg text-white">
                        {isDepositOnly ? '---' : formatNumberWithSeparator(activeBooking?.full_price || 0) + 'đ'}
                      </p>
                    </div>

                    {!isDepositOnly && (activeBooking?.discount_percent || 0) > 0 && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Khuyến mãi ({activeBooking?.discount_percent}%)</p>
                        <p className="font-black text-lg text-rose-200">
                          -{formatNumberWithSeparator((activeBooking?.full_price || 0) * (activeBooking?.discount_percent || 0) / 100)}đ
                        </p>
                      </div>
                    )}

                    {(!activeBooking || isDepositOnly || ((activeBooking.full_price || 0) * (1 - (activeBooking.discount_percent || 0)/100)) > (activeBooking.deposit_amount || 0)) && (
                      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20">
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Đã cọc</p>
                        <p className="font-black text-lg text-white">
                          {formatNumberWithSeparator(activeBooking?.deposit_amount || 0)}đ
                        </p>
                      </div>
                    )}

                    <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-[1.5rem] border border-white/20 flex items-center gap-4">
                      <div>
                        <p className="text-[9px] text-rose-100/80 font-bold uppercase tracking-[0.2em] mb-1">Còn lại</p>
                        <p className="font-black text-lg text-white">
                          {isDepositOnly ? '---' : (
                            ((activeBooking?.full_price || 0) > 0 || (activeBooking?.deposit_amount || 0) > 0) && Math.max(0, ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0)) === 0 
                              ? <span className="text-emerald-300">Đã thanh toán đủ</span>
                              : formatNumberWithSeparator(Math.max(0, ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0))) + 'đ'
                          )}
                        </p>
                      </div>
                      {!isDepositOnly && ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0) > 0 && (
                        <button 
                          onClick={() => {
                            setPaymentData({
                              ...paymentData,
                              amount: ((activeBooking?.full_price || 0) * (1 - (activeBooking?.discount_percent || 0)/100)) - (activeBooking?.deposit_amount || 0)
                            });
                            setIsPaymentModalOpen(true);
                          }}
                          className="bg-white text-rose-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all shadow-md active:scale-95 border border-white ml-2"
                        >
                          Thanh toán nốt
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 min-w-[200px]">
                  {isDepositOnly ? (
                    <button 
                      onClick={() => setIsBookingModalOpen(true)}
                      className="col-span-2 flex items-center justify-center gap-2 bg-white text-rose-500 px-4 py-2.5 rounded-xl font-bold transition-all hover:scale-105 shadow-md"
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
                        className="flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-slate-50 uppercase tracking-wider text-[9.5px] shadow-md border border-slate-100"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Zalo
                      </button>
                      
                      <button 
                        onClick={async () => {
                          if (!activeBooking) return;
                          let token = activeBooking?.share_token;
                          if (!token) {
                            toast.loading('Đang khởi tạo link...', { id: 'portal-link' });
                            const result = await generateShareToken(activeBooking.id);
                            if (result.error || !result.data) {
                              toast.error('Lỗi khởi tạo link: ' + (result.error || 'Unknown error'), { id: 'portal-link' });
                              return;
                            }
                            token = result.data.share_token;
                            setActiveBooking({ ...activeBooking, share_token: token });
                            toast.dismiss('portal-link');
                          }
                          const url = `${window.location.origin}/portal/${token}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Đã sao chép link Cổng thông tin khách hàng');
                        }}
                        className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-white/30 uppercase tracking-wider text-[9.5px] border border-white/20 shadow-md"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Link Portal
                      </button>
 
                      <button 
                        onClick={handleExportQuotation}
                        disabled={isExportingQuotation}
                        className={cn(
                          "flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-slate-50 uppercase tracking-wider text-[9.5px] shadow-md border border-slate-100 disabled:opacity-50",
                          userRole !== 'admin' ? "col-span-2" : ""
                        )}
                      >
                        {isExportingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        Xuất báo giá
                      </button>
 
                      {userRole === 'admin' && (
                        <>
                          <button 
                            disabled={activeDepositAmount < activeNetPrice}
                            onClick={() => toast.success('Đang khởi tạo tệp hợp đồng...')}
                            className={cn(
                              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all uppercase tracking-wider text-[9.5px]",
                              activeDepositAmount >= activeNetPrice
                                ? "bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 shadow-md"
                                : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
                            )}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Xuất hợp đồng
                          </button>
 
                          <button 
                            onClick={() => {
                              if (!activeBooking) return;
                              setEditBookingData({
                                package_name: activeBooking.package_name || activeBooking.packages?.name || '',
                                full_price: activeBooking.full_price || 0,
                                deposit_amount: activeBooking.deposit_amount || 0,
                                discount_percent: activeBooking.discount_percent || 0,
                                total_sessions: activeBooking.total_sessions || 0,
                                completed_sessions: activeBooking.completed_sessions || 0,
                                preferred_time: activeBooking.preferred_time || '08:00',
                                start_date: activeBooking.start_date || '',
                                status: activeBooking.status || 'in_progress'
                              });
                              setIsEditBookingModalOpen(true);
                            }}
                            className="col-span-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all uppercase tracking-wider text-[9.5px] shadow-lg shadow-amber-500/20 active:scale-95 hover:scale-105"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Sửa dịch vụ
                          </button>
                        </>
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
                        onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`)}
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
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 flex-wrap">
                <History className="text-primary w-6 h-6 flex-shrink-0" />
                <span>
                  Lịch sử chăm sóc: <span className="text-primary">{activeBooking?.package_name || activeBooking?.packages?.name || (activeBooking?.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Dịch vụ lẻ')}</span> ({activeBooking?.completed_sessions || 0}/{activeBooking?.total_sessions || 15})
                </span>
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
                    <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200 dark:shadow-none">
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
                    className="w-full md:w-auto bg-primary hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-rose-200 dark:shadow-none flex items-center justify-center gap-3 active:scale-95"
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
                    onClick={() => activeBooking && handleReusePackage(activeBooking.id)}
                    disabled={isReusing}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isReusing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    TÁI SỬ DỤNG GÓI NHANH
                  </button>
                </div>
              ) : null}

              {sortedSessions.filter((s) => s.status === 'completed').length > 0 ? (
                sortedSessions.filter((s) => s.status === 'completed').map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{session.type || 'Chăm sóc liệu trình'} - Buổi {session.session_number}/{activeBooking?.total_sessions || 15}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 flex-wrap mt-1">
                          <span>KTV: <strong className="text-slate-700">{session.completed_by_ktv?.full_name || activeBooking?.assigned_ktv?.full_name || 'Chưa phân công'}</strong>{session.completed_by_ktv?.phone || activeBooking?.assigned_ktv?.phone ? ` (${session.completed_by_ktv?.phone || activeBooking?.assigned_ktv?.phone})` : ''}</span>
                          <span>•</span>
                          <span>Hotline: <strong className="text-rose-500 font-black">0865 701 493</strong></span>
                          <span>•</span>
                          <span>{session.completed_date || session.assigned_date || 'Chưa cập nhật'}</span>
                        </p>
                        {session.notes && (
                          <p className="text-[11px] font-medium text-slate-500 mt-2 pl-3 border-l-2 border-slate-200">{session.notes}</p>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-4 bg-white border border-slate-100 rounded-2xl p-3 text-[10px] text-slate-500 font-medium max-w-sm">
                          <div className="space-y-1">
                            <p className="font-black text-slate-400 uppercase tracking-wider">📍 Check-in</p>
                            <p className="font-bold text-slate-700">
                              {session.start_time ? new Date(session.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">
                              {session.checkin_lat && session.checkin_lon 
                                ? `${Number(session.checkin_lat).toFixed(5)}, ${Number(session.checkin_lon).toFixed(5)}` 
                                : 'Không có GPS'}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-100 pl-4">
                            <p className="font-black text-slate-400 tracking-wider uppercase">🏁 Check-out</p>
                            <p className="font-bold text-slate-700">
                              {session.end_time ? new Date(session.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">
                              {session.checkout_lat && session.checkout_lon 
                                ? `${Number(session.checkout_lat).toFixed(5)}, ${Number(session.checkout_lon).toFixed(5)}` 
                                : 'Không có GPS'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Hoàn thành</span>
                      <button 
                        onClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`)}
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

          {/* LỊCH SỬ GIAO DỊCH / THANH TOÁN */}
          {userRole === 'admin' && activeBooking && (
            <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 mt-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 flex-wrap">
                  <CreditCardIcon className="text-primary w-6 h-6 flex-shrink-0" />
                  <span>Lịch sử Thanh toán & Đối soát</span>
                </h3>
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-primary">
                  Tổng thu: {formatNumberWithSeparator(activeBooking.deposit_amount || 0)}đ
                </span>
              </div>

              <div className="space-y-4">
                {activeBooking.revenue && activeBooking.revenue.length > 0 ? (
                  activeBooking.revenue.map((rev) => (
                    <div key={rev.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all gap-4">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                          <DollarIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-slate-800">
                              {rev.revenue_type === 'deposit' ? 'Đặt cọc gói' :
                               rev.revenue_type === 'remaining_payment' ? 'Thanh toán nốt' :
                               rev.revenue_type === 'package_payment' ? 'Thanh toán trọn gói' :
                               rev.revenue_type === 'session_completed' ? 'Thanh toán theo buổi' :
                               'Thu bổ sung'}
                            </p>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                              rev.payment_method === 'bank_transfer' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                            )}>
                              {rev.payment_method === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                            </span>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                              rev.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'
                            )}>
                              {rev.status === 'confirmed' ? 'Đã đối soát' : 'Chờ xác nhận'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400 mt-1">
                            Ngày thu: <strong className="text-slate-600">{rev.received_date}</strong> 
                            {rev.recorded_by?.full_name && (
                              <> • Người ghi nhận: <strong className="text-slate-600">{rev.recorded_by.full_name}</strong></>
                            )}
                          </p>
                          {rev.notes && (
                            <p className="text-[11px] font-medium text-slate-500 mt-2 pl-3 border-l-2 border-slate-200 italic">
                              &quot;{rev.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                        <span className="text-lg font-black text-emerald-600">
                          +{formatNumberWithSeparator(rev.amount)}đ
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <DollarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold italic">Chưa có giao dịch thanh toán nào được ghi nhận</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={async () => { 
          await loadData();
          setIsBookingModalOpen(false); 
        }}
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

      <EditBookingModal
        isOpen={isEditBookingModalOpen}
        onClose={() => setIsEditBookingModalOpen(false)}
        onConfirm={handleSaveBooking}
        isSubmitting={isSavingBooking}
        data={editBookingData}
        setData={setEditBookingData}
      />

      {activeBooking && customer && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <PaymentReceiptTemplate ref={quotationRef} data={getReceiptData()!} />
        </div>
      )}
    </div>
  );
}
