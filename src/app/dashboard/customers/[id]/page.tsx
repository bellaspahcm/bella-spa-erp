'use client';

import { PaymentReceiptTemplate,ReceiptData } from '@/components/common/PaymentReceiptTemplate';
import { createClient } from '@/lib/supabase-client';
import { cn,formatNumberWithSeparator } from '@/lib/utils';
import { generateShareToken,getBookingsByCustomerId,recordRemainingPayment,reusePackage,updateBooking } from '@/modules/booking/actions/lifecycle-actions';
import { getCustomerById,updateCustomer } from '@/services/customer-actions';
import { getCurrentUser,getUsers } from '@/services/user-actions';
import { toPng } from 'html-to-image';
import {
ChevronLeft,
Clock,
DollarSign,
TrendingUp,
} from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { useParams,useRouter,useSearchParams } from 'next/navigation';
import { useCallback,useEffect,useRef,useState } from 'react';
import { toast } from 'sonner';
import { BookingPaymentModal, EditBookingModal, EditCustomerModal } from './components/CustomerDetailModals';
import { CustomerProfilePanel } from './components/CustomerProfilePanel';
import { BookingSelectorPanel } from './components/BookingSelectorPanel';
import { ActiveBookingPanel } from './components/ActiveBookingPanel';
import { PaymentHistoryPanel } from './components/PaymentHistoryPanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import type { CustomerDetailBooking, CustomerDetailRecord, KtvOption } from './types';

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

  const isDepositOnly = Boolean(activeBooking && activeBooking.status === 'deposit_pending' && !activeBooking.package_id);
  const sortedSessions = activeBooking?.session_logs
    ? [...activeBooking.session_logs].sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
    : [];
  const nextSession = sortedSessions.find((s) => s.status === 'scheduled');
  const activeDepositAmount = activeBooking?.deposit_amount || 0;
  const activeFullPrice = activeBooking?.full_price || 0;
  const activeDiscountPercent = activeBooking?.discount_percent || 0;
  const activeNetPrice = Math.round(activeFullPrice * (1 - activeDiscountPercent / 100));
  const isCompleted = Boolean(activeBooking && (activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 15));

  const handlePayRemaining = (amount: number) => {
    setPaymentData(prev => ({
      ...prev,
      amount,
    }));
    setIsPaymentModalOpen(true);
  };

  const handleOpenZalo = () => {
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
  };

  const handleSharePortal = async () => {
    if (!activeBooking) return;
    let token = activeBooking.share_token;

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
  };

  const handleExportContract = () => {
    toast.success('Đang khởi tạo tệp hợp đồng...');
  };

  const handleOpenEditBooking = () => {
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
      status: activeBooking.status || 'in_progress',
    });
    setIsEditBookingModalOpen(true);
  };

  const handleOpenBookingSessions = () => {
    router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`);
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold mb-8 group">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </div>
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <CustomerProfilePanel
          customer={customer}
          userRole={userRole}
          onEditCustomer={() => {
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
          onOpenBooking={() => setIsBookingModalOpen(true)}
        />

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

          <BookingSelectorPanel
            bookings={customer.allBookings || []}
            activeBooking={activeBooking}
            onSelectBooking={setActiveBooking}
          />

          <ActiveBookingPanel
            activeBooking={activeBooking}
            ktvs={ktvs}
            userRole={userRole}
            isDepositOnly={isDepositOnly}
            activeDepositAmount={activeDepositAmount}
            activeNetPrice={activeNetPrice}
            isExportingQuotation={isExportingQuotation}
            isUpdatingKtv={isUpdatingKTV}
            onOpenBooking={() => setIsBookingModalOpen(true)}
            onPayRemaining={handlePayRemaining}
            onOpenZalo={handleOpenZalo}
            onSharePortal={handleSharePortal}
            onExportQuotation={handleExportQuotation}
            onExportContract={handleExportContract}
            onEditBooking={handleOpenEditBooking}
            onUpdateKtv={handleUpdateKTV}
            onOpenBookingSessions={handleOpenBookingSessions}
          />

          <SessionHistoryPanel
            activeBooking={activeBooking}
            sortedSessions={sortedSessions}
            nextSession={nextSession}
            isCompleted={isCompleted}
            isReusing={isReusing}
            onOpenSessions={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}`)}
            onOpenBookingSessions={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`)}
            onReusePackage={() => activeBooking && handleReusePackage(activeBooking.id)}
          />

          <PaymentHistoryPanel activeBooking={activeBooking} userRole={userRole} />
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
