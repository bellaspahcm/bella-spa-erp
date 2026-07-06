'use client';

import type { ReceiptData } from '@/components/common/PaymentReceiptTemplate';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { calculateBookingPaymentState, normalizeDiscountPercent } from '@/lib/business-rules/payment';
import {
  getCustomerGenderPresentation,
  getTenantModulePresentationOrNeutral,
} from '@/lib/business-rules/tenant-module-presentation';
import {
  getDefaultTenantModuleKey,
  resolveTenantBrandIdentity,
  type ResolvedTenantBrandIdentity,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';
import { createClient } from '@/lib/supabase-client';
import { parseMoneyInput } from '@bella/shared';
import { parseIntegerInput } from '@/lib/utils';;
import { generateShareToken, getBookingsByCustomerId, recordRemainingPayment, reusePackage, updateBooking } from '@/core/services/order';
import { getCustomerById, updateCustomer } from '@/services/customer-actions';
import { getTenantSettings } from '@/services/tenant-actions';
import { getCurrentUser, getUsers } from '@/services/user-actions';
import { toPng } from 'html-to-image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CustomerDetailBooking, CustomerDetailRecord, EditBookingData, EditCustomerData, KtvOption, PaymentData } from './types';

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  return error instanceof Error ? error.message : fallback;
}

function toCustomerDetailRecord(
  data: Awaited<ReturnType<typeof getCustomerById>>,
  bookings: CustomerDetailBooking[],
  moduleKey: TenantModuleKey | null,
): CustomerDetailRecord | null {
  if (!data) return null;
  const labels = getTenantModulePresentationOrNeutral(moduleKey);
  const gender = getCustomerGenderPresentation(data.gender_baby, moduleKey);

  return {
    ...data,
    baby: {
      name: data.name_baby || labels.secondaryFallback,
      dob: data.dob_baby || data.dob_expected || 'Chưa cập nhật',
      gender: gender.label,
    },
    sessions: (data as { sessions?: unknown[] }).sessions || [],
    allBookings: bookings || [],
  };
}

function pickDefaultBooking(bookings: CustomerDetailBooking[], targetBookingId: string | null) {
  if (targetBookingId) {
    const found = bookings.find((booking) => booking.id === targetBookingId);
    if (found) return found;
  }

  const priority = (status: string) => {
    if (status === 'active' || status === 'in_progress') return 0;
    if (status === 'booked') return 1;
    if (status === 'deposit_pending') return 2;
    if (status === 'completed') return 3;
    return 4;
  };

  return [...bookings].sort((a, b) => {
    const pA = priority(a.status || '');
    const pB = priority(b.status || '');

    if (pA !== pB) return pA - pB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  })[0];
}

export function useCustomerDetailController() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
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
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: 0,
    method: 'bank_transfer',
    notes: '',
    receipt_url: '',
    status: 'confirmed',
  });
  const [userRole, setUserRole] = useState<'admin' | 'ktv'>('ktv');
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null);
  const [tenantBrand, setTenantBrand] = useState<ResolvedTenantBrandIdentity | null>(null);
  const [isExportingQuotation, setIsExportingQuotation] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [editData, setEditData] = useState<EditCustomerData>({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    dob_baby: '',
    address: '',
    notes: '',
    gender_baby: 'unknown',
    latitude: null,
    longitude: null,
  });
  const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [editBookingData, setEditBookingData] = useState<EditBookingData>({
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    discount_percent: 0,
    total_sessions: 0,
    completed_sessions: 0,
    preferred_time: '08:00',
    start_date: '',
    status: 'in_progress',
  });
  const [isReusing, setIsReusing] = useState(false);
  const quotationRef = useRef<HTMLDivElement>(null);
  const customerBookingIdsRef = useRef<Set<string>>(new Set());
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBookingIdRef = useRef<string | null>(null); // Track user-selected booking
  
  // Wrapper to update both state and ref when user manually changes booking
  const setActiveBookingWithTracking = useCallback((booking: CustomerDetailBooking | null) => {
    setActiveBooking(booking);
    activeBookingIdRef.current = booking?.id || null;
  }, []);

  const loadData = useCallback(async (options?: { preserveSelection?: boolean }) => {
    if (!id) return;

    try {
      const [tenant, data, bookings] = await Promise.all([
        getTenantSettings(),
        getCustomerById(id),
        getBookingsByCustomerId(id) as Promise<CustomerDetailBooking[]>,
      ]);
      const nextTenantModuleKey = getDefaultTenantModuleKey(tenant?.enabled_modules);
      setTenantModuleKey(nextTenantModuleKey);
      setTenantBrand(resolveTenantBrandIdentity({
        enabledModules: tenant?.enabled_modules,
        brandTheme: tenant?.brand_theme,
        logoUrl: tenant?.logo_url,
        tenantName: tenant?.name,
        surface: 'invoice',
      }));
      customerBookingIdsRef.current = new Set(bookings.map((booking) => booking.id));
      const customerRecord = toCustomerDetailRecord(data, bookings, nextTenantModuleKey);

      if (customerRecord) {
        setCustomer(customerRecord);
        
        // Preserve selection only during background reload
        if (options?.preserveSelection && activeBookingIdRef.current) {
          const currentBookingStillExists = bookings.some(b => b.id === activeBookingIdRef.current);
          
          if (currentBookingStillExists) {
            const updatedActiveBooking = bookings.find(b => b.id === activeBookingIdRef.current) || null;
            setActiveBooking(updatedActiveBooking);
          } else {
            // Current booking deleted, pick default
            const defaultBooking = bookings.length > 0 ? pickDefaultBooking(bookings, targetBookingId) : null;
            setActiveBooking(defaultBooking);
            activeBookingIdRef.current = defaultBooking?.id || null;
          }
        } else {
          // Initial load or user action - pick default
          const defaultBooking = bookings.length > 0 ? pickDefaultBooking(bookings, targetBookingId) : null;
          setActiveBooking(defaultBooking);
          activeBookingIdRef.current = defaultBooking?.id || null;
        }
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [id, targetBookingId]);

  const fetchKtvs = useCallback(async () => {
    try {
      const allUsers = await getUsers();
      const allKtvs = allUsers.filter((user) => user.role?.toLowerCase() === 'ktv');
      
      // Filter out KTVs already assigned to other active bookings
      if (customer?.allBookings) {
        const otherActiveBookings = customer.allBookings.filter((booking) => 
          booking.id !== activeBooking?.id && 
          (booking.status === 'in_progress' || booking.status === 'booked')
        );
        
        const assignedKtvIds = new Set(
          otherActiveBookings
            .map(b => b.assigned_ktv_id)
            .filter((id): id is string => Boolean(id))
        );
        
        // Only filter if there are assigned KTVs in other active bookings
        if (assignedKtvIds.size > 0) {
          const availableKtvs = allKtvs.filter(ktv => !assignedKtvIds.has(ktv.id));
          setKtvs(availableKtvs);
        } else {
          setKtvs(allKtvs);
        }
      } else {
        setKtvs(allKtvs);
      }
    } catch (error) {
      console.error('Error fetching KTVs:', error);
    }
  }, [customer?.allBookings, activeBooking?.id]);

  const scheduleDataReload = useCallback(() => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      void loadData({ preserveSelection: true }); // Preserve selection during background reload
    }, 400);
  }, [loadData]);

  useEffect(() => {
    async function checkRole() {
      const user = await getCurrentUser();
      if (user?.role) {
        const role = user.role.toLowerCase();
        setUserRole(role === 'admin' ? 'admin' : 'ktv');
      }
    }

    void checkRole();
  }, []);

  useEffect(() => {
    void loadData();
    void fetchKtvs();

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${id}` }, () => {
        scheduleDataReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, (payload) => {
        const record = (payload.new || payload.old || {}) as { booking_id?: string | null };

        if (!record.booking_id || customerBookingIdsRef.current.has(record.booking_id)) {
          scheduleDataReload();
        }
      })
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchKtvs, id, loadData, scheduleDataReload]);

  const refreshPageData = useCallback(async () => {
    await Promise.all([loadData(), fetchKtvs()]);
  }, [fetchKtvs, loadData]);

  usePageRefresh(refreshPageData);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenSessions = useCallback(() => {
    if (!customer) return;
    router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}`);
  }, [customer, router]);

  const handleOpenBookingSessions = useCallback(() => {
    if (!customer) return;
    router.push(`/dashboard/sessions?search=${encodeURIComponent(customer.name_mother)}&bookingId=${activeBooking?.id || ''}`);
  }, [activeBooking?.id, customer, router]);

  const handleOpenEditCustomer = useCallback(() => {
    if (!customer) return;

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
      longitude: customer.longitude || null,
    });
    setIsEditModalOpen(true);
  }, [customer]);

  const handleUpdateKTV = useCallback(async (ktvId: string) => {
    if (!activeBooking) return;

    setIsUpdatingKTV(true);
    try {
      const result = await updateBooking(activeBooking.id, { assigned_ktv_id: ktvId });
      if (result.error) throw new Error(result.error);
      toast.success('Đã cập nhật KTV phụ trách');
      await loadData();
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsUpdatingKTV(false);
    }
  }, [activeBooking, loadData]);

  const handleUpdateCustomer = useCallback(async () => {
    setIsUpdatingCustomer(true);
    try {
      const result = await updateCustomer(id, editData);
      if (result.error) throw new Error(result.error);

      if (result.warning) {
        toast.success('Cập nhật thành công các thông tin khác!');
        toast.warning(result.warning, { duration: 10000 });
      } else {
        toast.success('Cập nhật hồ sơ thành công!');
      }

      setIsEditModalOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(error));
    } finally {
      setIsUpdatingCustomer(false);
    }
  }, [editData, id, loadData]);

  const handleSaveBooking = useCallback(async () => {
    if (isSavingBooking) return;
    if (!activeBooking) return;

    setIsSavingBooking(true);
    try {
      const result = await updateBooking(activeBooking.id, {
        package_name: editBookingData.package_name || null,
        full_price: parseMoneyInput(editBookingData.full_price),
        deposit_amount: parseMoneyInput(editBookingData.deposit_amount),
        discount_percent: normalizeDiscountPercent(editBookingData.discount_percent),
        total_sessions: parseIntegerInput(editBookingData.total_sessions, { min: 0, max: 100 }),
        completed_sessions: parseIntegerInput(editBookingData.completed_sessions, { min: 0, max: 100 }),
        preferred_time: editBookingData.preferred_time || '08:00',
        start_date: editBookingData.start_date || null,
        status: editBookingData.status,
      });

      if (result.error) throw new Error(result.error);

      toast.success('Cập nhật gói dịch vụ thành công!');
      setIsEditBookingModalOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error('Lỗi cập nhật gói: ' + getErrorMessage(error));
    } finally {
      setIsSavingBooking(false);
    }
  }, [activeBooking, editBookingData, isSavingBooking, loadData]);

  const handleReusePackage = useCallback(async (bookingId: string) => {
    if (isReusing) return;
    if (!bookingId || !customer) return;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn tái sử dụng gói dịch vụ nhanh cho khách hàng ${customer.name_mother}?`);
    if (!confirmed) return;

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
  }, [customer, isReusing, loadData]);

  const handleReuseActivePackage = useCallback(() => {
    if (!activeBooking) return;
    void handleReusePackage(activeBooking.id);
  }, [activeBooking, handleReusePackage]);

  const handleRecordPayment = useCallback(async () => {
    if (isRecordingPayment) return;
    if (!activeBooking) return;
    if (paymentData.amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsRecordingPayment(true);
    try {
      let finalReceiptUrl = paymentData.receipt_url;

      if (paymentFile) {
        const supabase = createClient();
        const fileExt = paymentFile.name.split('.').pop();
        const fileName = `${activeBooking.id}-${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, paymentFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          if (uploadError.message.includes('bucket not found')) {
            toast.error('Hệ thống Storage chưa được cấu hình. Vui lòng tạo bucket "receipts".');
          }
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from('receipts').getPublicUrl(filePath);
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
        status: paymentData.status,
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
  }, [activeBooking, id, isRecordingPayment, loadData, paymentData, paymentFile]);

  const receiptData = useMemo<ReceiptData | null>(() => {
    if (!customer || !activeBooking || !tenantBrand) return null;
    const paymentState = calculateBookingPaymentState({
      fullPrice: activeBooking.full_price,
      discountPercent: activeBooking.discount_percent,
      depositAmount: activeBooking.deposit_amount,
      bookingStatus: activeBooking.status,
      revenues: activeBooking.revenue,
    });

    return {
      customerName: customer.name_mother || 'Chưa cập nhật',
      phone: customer.phone || 'Chưa cập nhật',
      address: customer.address || 'Chưa cập nhật',
      serviceNote: `${activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ'} (Bắt đầu gói từ ${activeBooking.start_date || 'Chưa cập nhật'})`,
      brand: {
        displayName: tenantBrand.invoiceDisplayName || tenantBrand.displayName,
        logoUrl: tenantBrand.logoUrl,
        primaryColor: tenantBrand.primaryColor,
        accentColor: tenantBrand.accentColor,
        monogram: tenantBrand.monogram,
      },
      items: [
        {
          id: 1,
          name: activeBooking.package_name || activeBooking.packages?.name || 'Gói dịch vụ',
          sessions: activeBooking.total_sessions || 15,
          unitPrice: Math.round((activeBooking.full_price || 0) / Math.max(1, activeBooking.total_sessions || 15)),
          total: activeBooking.full_price || 0,
          discountNote: activeBooking.discount_percent ? `Giảm ${activeBooking.discount_percent}%` : 'Không có',
          prepaid: paymentState.totalPaid,
          finalPayment: paymentState.remainingDebt,
        },
      ],
      totalAmount: Math.round(paymentState.priceAfterDiscount),
      bankInfo: {
        ownerName: 'Cao Thị Thúy Vân',
        accountNumber: '8832041471',
        bankName: 'Ngân hàng BIDV',
      },
    };
  }, [activeBooking, customer, tenantBrand]);

  const handleExportQuotation = useCallback(async () => {
    if (!quotationRef.current || !customer) return;

    setIsExportingQuotation(true);
    toast.loading('Đang khởi tạo ảnh báo giá...', { id: 'quotation-export' });

    try {
      const dataUrl = await toPng(quotationRef.current, {
        quality: 1,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `Bao_Gia_${(customer.name_mother || 'Khach').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Đã xuất ảnh báo giá thành công!', { id: 'quotation-export' });
    } catch (error) {
      console.error('Failed to export image', error);
      toast.error('Lỗi khi xuất ảnh. Vui lòng thử lại!', { id: 'quotation-export' });
    } finally {
      setIsExportingQuotation(false);
    }
  }, [customer]);

  const handleBookingSuccess = useCallback(async () => {
    await loadData();
    setIsBookingModalOpen(false);
  }, [loadData]);

  const handlePayRemaining = useCallback((amount: number) => {
    if (isRecordingPayment) return;
    setPaymentData((prev) => ({
      ...prev,
      amount,
    }));
    setIsPaymentModalOpen(true);
  }, [isRecordingPayment]);

  const handleOpenZalo = useCallback(() => {
    if (!customer) return;
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
  }, [customer]);

  const handleSharePortal = useCallback(async () => {
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
    void navigator.clipboard.writeText(url);
    toast.success('Đã sao chép link Cổng thông tin khách hàng');
  }, [activeBooking]);

  const handleExportContract = useCallback(() => {
    toast.success('Đang khởi tạo tệp hợp đồng...');
  }, []);

  const handleOpenEditBooking = useCallback(() => {
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
  }, [activeBooking]);

  const isDepositOnly = Boolean(activeBooking && activeBooking.status === 'deposit_pending' && !activeBooking.package_id);
  const sortedSessions = useMemo(
    () => (activeBooking?.session_logs ? [...activeBooking.session_logs].sort((a, b) => (a.session_number || 0) - (b.session_number || 0)) : []),
    [activeBooking]
  );
  const nextSession = sortedSessions.find((session) => session.status === 'scheduled');
  const activePaymentState = activeBooking
    ? calculateBookingPaymentState({
        fullPrice: activeBooking.full_price,
        discountPercent: activeBooking.discount_percent,
        depositAmount: activeBooking.deposit_amount,
        bookingStatus: activeBooking.status,
        revenues: activeBooking.revenue,
      })
    : null;
  const activeDepositAmount = activePaymentState?.totalPaid || 0;
  const activeNetPrice = Math.round(activePaymentState?.priceAfterDiscount || 0);
  const isCompleted = Boolean(activeBooking && (activeBooking.completed_sessions || 0) >= (activeBooking.total_sessions || 15));

  return {
    activeBooking,
    activeDepositAmount,
    activeNetPrice,
    customer,
    editBookingData,
    editData,
    handleBack,
    handleBookingSuccess,
    handleExportContract,
    handleExportQuotation,
    handleOpenBookingSessions,
    handleOpenEditBooking,
    handleOpenEditCustomer,
    handleOpenSessions,
    handleOpenZalo,
    handlePayRemaining,
    handleRecordPayment,
    handleReuseActivePackage,
    handleSaveBooking,
    handleSharePortal,
    handleUpdateCustomer,
    handleUpdateKTV,
    isBookingModalOpen,
    isCompleted,
    isDepositOnly,
    isEditBookingModalOpen,
    isEditModalOpen,
    isExportingQuotation,
    isPaymentModalOpen,
    isRecordingPayment,
    isReusing,
    isSavingBooking,
    isUpdatingCustomer,
    isUpdatingKTV,
    ktvs,
    loading,
    nextSession,
    paymentData,
    paymentFile,
    quotationRef,
    receiptData,
    setActiveBooking: setActiveBookingWithTracking, // Export wrapper instead of direct setter
    setEditBookingData,
    setEditData,
    setIsBookingModalOpen,
    setIsEditBookingModalOpen,
    setIsEditModalOpen,
    setIsPaymentModalOpen,
    setPaymentData,
    setPaymentFile,
    sortedSessions,
    tenantModuleKey,
    userRole,
  };
}
