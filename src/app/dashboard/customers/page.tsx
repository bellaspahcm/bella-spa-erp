'use client';

import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { isHaircutProductPresentation } from '@/lib/business-rules/product-presentation-routing';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import { useUser } from '@/lib/user-context';
import { calculateBookingPaymentState, type PaymentRevenueLike } from '@/lib/business-rules/payment';
import {
  getCustomerGenderPresentation,
  getCustomerSecondarySummary,
  getTenantModulePresentationOrNeutral,
} from '@/lib/business-rules/tenant-module-presentation';
import { getLocalDateString } from '@bella/shared';
import { cn } from '@/lib/utils';

import {
  Activity,
  Award,
  Baby,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit2,
  Filter,
  LayoutGrid,
  List,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react';

import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '@/services/customer-actions';
import type { Database } from '@/types/database.types';
import {
  calculateCustomerBookingProgress,
  isActiveCareBooking,
  selectCustomerDisplayBooking,
} from './customer-list-rules';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerBookingSummary = Pick<
  Database['public']['Tables']['bookings']['Row'],
  | 'deposit_amount'
  | 'package_name'
  | 'full_price'
  | 'discount_percent'
  | 'created_at'
  | 'is_in_care'
  | 'status'
  | 'total_sessions'
  | 'completed_sessions'
> & {
  revenue?: PaymentRevenueLike[] | null;
};
type CustomerListItem = CustomerRow & {
  bookings?: CustomerBookingSummary[] | null;
  deposit_amount?: number | '';
  package_name?: string;
  package_progress_percent?: number;
  is_in_care?: boolean;
  is_fully_paid?: boolean;
};
type CustomerActionResult =
  | Awaited<ReturnType<typeof createCustomer>>
  | Awaited<ReturnType<typeof updateCustomer>>;

const INITIAL_CUSTOMER_LOAD_LIMIT = 80;
const BACKGROUND_CUSTOMER_LOAD_LIMIT = 120;
const BACKGROUND_CUSTOMER_LOAD_DELAY_MS = 1200;
const ALL_STATUS_FILTER = 'Tất cả trạng thái';
const ACTIVE_CARE_PACKAGE_FILTER = 'Đang có gói liệu trình';
const SOFT_INPUT_CLASS =
  'border-transparent bg-white/90 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.03)] focus:ring-2 focus:ring-primary/15 dark:bg-slate-800/70 dark:shadow-none';
const SOFT_SELECT_BUTTON_CLASS =
  '!border-transparent bg-white/90 !shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.03)] hover:!shadow-[inset_0_1px_4px_rgba(15,23,42,0.1),0_3px_10px_rgba(15,23,42,0.05)] dark:bg-slate-800/70 dark:!shadow-none';

function getErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra') {
  return error instanceof Error ? error.message : fallback;
}

import { HaircutCustomerView } from './HaircutCustomerView';

export default function CustomersPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const customerLoadRequestRef = useRef(0);
  const backgroundCustomerLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const { product } = useUser();
  const isHaircut = isHaircutProductPresentation(product);
  const vocab = useModuleVocabulary(tenantModuleKey);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS_FILTER);
  const customerLabels = useMemo(
    () => {
      const labels = getTenantModulePresentationOrNeutral(tenantModuleKey);
      if (!isHaircut) return labels;

      return {
        ...labels,
        customerListSubtitle: 'Quản lý hồ sơ khách hàng Haircut Shop',
        customerSearchPlaceholder: 'Tìm khách, SĐT, dịch vụ cắt tóc...',
        editDescription: 'Chỉnh sửa hồ sơ khách hàng Haircut Shop',
        createDescription: 'Nhập thông tin cơ bản của khách hàng Haircut Shop',
        secondaryNamePlaceholder: 'VD: Khách cắt tóc định kỳ',
      };
    },
    [isHaircut, tenantModuleKey]
  );
  const SecondaryInfoIcon = tenantModuleKey === 'babycare' ? Baby : Sparkles;

  // Edit states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Form states
  const [formData, setFormData] = useState({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    address: '',
    notes: '',
    gender_baby: 'unknown'
  });

  const buildCustomerList = useCallback((data: CustomerListItem[]) => {
    return ((data || []) as CustomerListItem[]).map((c) => {
      const displayBooking = selectCustomerDisplayBooking(c.bookings);
      const displayPaymentState = displayBooking
        ? calculateBookingPaymentState({
            fullPrice: displayBooking.full_price,
            discountPercent: displayBooking.discount_percent,
            depositAmount: displayBooking.deposit_amount,
            bookingStatus: displayBooking.status,
            revenues: displayBooking.revenue,
          })
        : null;
      const displayDepositAmount: number | '' = displayPaymentState?.totalPaid ?? '';
      const displayPackageName = displayBooking?.package_name || '';
      const displayProgress = calculateCustomerBookingProgress(displayBooking);

      return {
        ...c,
        deposit_amount: displayDepositAmount,
        package_name: displayPackageName,
        package_progress_percent: displayProgress.percent,
        is_in_care: isActiveCareBooking(displayBooking),
        is_fully_paid: displayPaymentState ? !displayPaymentState.hasOutstandingDebt : false
      };
    });
  }, []);

  const clearBackgroundCustomerLoad = useCallback(() => {
    if (backgroundCustomerLoadTimerRef.current) {
      clearTimeout(backgroundCustomerLoadTimerRef.current);
      backgroundCustomerLoadTimerRef.current = null;
    }
  }, []);

  const loadRemainingCustomersInBackground = useCallback(async (
    requestId: number,
    initialData: CustomerListItem[],
  ) => {
    let mergedCustomers = [...initialData];
    let offset = initialData.length;

    try {
      while (customerLoadRequestRef.current === requestId) {
        const nextChunk = (await getCustomers({
          limit: BACKGROUND_CUSTOMER_LOAD_LIMIT,
          offset,
        })) as CustomerListItem[];

        if (customerLoadRequestRef.current !== requestId) return;
        if (!nextChunk.length) break;

        mergedCustomers = [...mergedCustomers, ...nextChunk];
        setCustomers(buildCustomerList(mergedCustomers));
        offset += nextChunk.length;

        if (nextChunk.length < BACKGROUND_CUSTOMER_LOAD_LIMIT) break;

        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch (error) {
      if (customerLoadRequestRef.current !== requestId) return;
      console.error('Error loading full customer list:', error);
      toast.error('Không thể đồng bộ đầy đủ danh sách khách hàng');
    } finally {
      if (customerLoadRequestRef.current === requestId) {
        setIsSyncing(false);
      }
    }
  }, [buildCustomerList]);

  const loadCustomers = useCallback(async () => {
    let keepSyncingInBackground = false;
    const requestId = customerLoadRequestRef.current + 1;
    customerLoadRequestRef.current = requestId;
    clearBackgroundCustomerLoad();
    setIsLoading(true);
    setIsSyncing(true);
    try {
      const initialData = (await getCustomers({ limit: INITIAL_CUSTOMER_LOAD_LIMIT })) as CustomerListItem[];
      if (customerLoadRequestRef.current !== requestId) return;

      setCustomers(buildCustomerList(initialData || []));
      setIsLoading(false);

      if ((initialData?.length || 0) >= INITIAL_CUSTOMER_LOAD_LIMIT) {
        keepSyncingInBackground = true;
        backgroundCustomerLoadTimerRef.current = setTimeout(() => {
          void loadRemainingCustomersInBackground(requestId, initialData || []);
        }, BACKGROUND_CUSTOMER_LOAD_DELAY_MS);
        return;
      }
    } catch (error) {
      if (customerLoadRequestRef.current !== requestId) return;
      console.error('Error loading customers:', error);
      toast.error(getErrorMessage(error, 'Không thể tải danh sách khách hàng'));
    } finally {
      if (customerLoadRequestRef.current === requestId) {
        setIsLoading(false);
      }
      if (customerLoadRequestRef.current === requestId && !keepSyncingInBackground) {
        setIsSyncing(false);
      }
    }
  }, [buildCustomerList, clearBackgroundCustomerLoad, loadRemainingCustomersInBackground]);

  const refreshCustomersPage = useCallback(async () => {
    await Promise.all([loadCustomers(), refreshTenantModuleKey()]);
  }, [loadCustomers, refreshTenantModuleKey]);

  useEffect(() => {
    void refreshCustomersPage();
  }, [refreshCustomersPage]);

  useEffect(() => {
    return () => {
      customerLoadRequestRef.current += 1;
      clearBackgroundCustomerLoad();
    };
  }, [clearBackgroundCustomerLoad]);

  usePageRefresh(refreshCustomersPage);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (e.target.type === 'date' && value) {
      const year = value.split('-')[0];
      if (year && year.length > 4) return;
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let result: CustomerActionResult;
      if (isEditMode && editingCustomerId) {
        result = await updateCustomer(editingCustomerId, {
          ...formData
        });
      } else {
        result = await createCustomer({
          ...formData
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.warning) {
          toast.success('Lưu thành công các thông tin khác!');
          toast.warning(result.warning, { duration: 10000 });
        } else {
          toast.success(isEditMode ? 'Cập nhật thành công!' : 'Thêm khách hàng thành công!');
        }
        setIsModalOpen(false);
        resetForm();
        loadCustomers();
      }
    } catch {
      toast.error('Có lỗi xảy ra khi lưu dữ liệu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name_mother: '',
      phone: '',
      name_baby: '',
      dob_expected: '',
      address: '',
      notes: '',
      gender_baby: 'unknown'
    });
    setIsEditMode(false);
    setEditingCustomerId(null);
  };

  const handleEdit = (customer: CustomerListItem) => {
    setFormData({
      name_mother: customer.name_mother || '',
      phone: customer.phone || '',
      name_baby: customer.name_baby || '',
      dob_expected: customer.dob_expected || '',
      address: customer.address || '',
      notes: customer.notes || '',
      gender_baby: customer.gender_baby || 'unknown'
    });
    setIsEditMode(true);
    setEditingCustomerId(customer.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ này? Hành động này không thể hoàn tác.')) return;
    
    try {
      const result = await deleteCustomer(id);
      if (result.success) {
        toast.success('Xóa hồ sơ thành công');
        loadCustomers();
      } else {
        toast.error(result.error || 'Lỗi khi xóa hồ sơ');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Có lỗi xảy ra'));
    }
    setActiveMenuId(null);
  };

  const handleZalo = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const zaloUrl = `https://zalo.me/${cleanPhone}`;
    window.open(zaloUrl, '_blank');
    setActiveMenuId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const today = getLocalDateString();

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const depositStatusFilterLabel = tenantModuleKey === 'babycare' ? 'Chờ sinh' : 'Đã đặt cọc';
  const statusOptions = [
    ALL_STATUS_FILTER,
    ACTIVE_CARE_PACKAGE_FILTER,
    'Đang chăm sóc',
    depositStatusFilterLabel,
    'Tiềm năng',
    'Đã kết thúc',
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter]  = useState('all');
  const [yearFilter,  setYearFilter]   = useState(String(new Date().getFullYear()));
  const [sortBy, setSortBy] = useState('active_package_desc');

  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: 'all', label: 'Tất cả tháng' },
    ...Array.from({length:12}, (_,i) => ({ value: String(i+1).padStart(2,'0'), label: `Tháng ${i+1}` }))
  ];
  const yearOptions = Array.from({length:4}, (_,i) => String(currentYear - i));
  const sortOptions = [
    { value: 'active_package_desc', label: 'Gói đang hoạt động trước' },
    { value: 'date_desc', label: 'Ngày tạo mới nhất' },
    { value: 'date_asc', label: 'Ngày tạo cũ nhất' },
    { value: 'name_asc', label: 'Tên A-Z' },
    { value: 'name_desc', label: 'Tên Z-A' },
  ];

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, monthFilter, yearFilter, sortBy]);

  const metrics = useMemo(() => {
    const currentYM = new Date().toISOString().slice(0, 7);
    return {
      total: customers.length,
      inCare: customers.filter(c => c.is_in_care).length,
      newThisMonth: customers.filter(c => c.created_at && c.created_at.slice(0, 7) === currentYM).length,
      needsCare: customers.filter(c => c.status === 'lead' || (!c.is_in_care && c.status !== 'paid')).length,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const result = customers.filter(customer => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || [
        customer.name_mother,
        customer.phone,
        customer.name_baby,
        customer.dob_expected,
        customer.dob_baby,
        customer.address,
        customer.notes,
        customer.zalo_oa_id,
        customer.package_name,
        getCustomerGenderPresentation(customer.gender_baby, tenantModuleKey).label,
      ].some(f => (f || '').toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter !== ALL_STATUS_FILTER) {
        if (statusFilter === ACTIVE_CARE_PACKAGE_FILTER) matchesStatus = customer.is_in_care === true;
        else if (statusFilter === 'Đang chăm sóc') matchesStatus = customer.status === 'active';
        else if (statusFilter === depositStatusFilterLabel)  matchesStatus = customer.status === 'deposit';
        else if (statusFilter === 'Tiềm năng') matchesStatus = customer.status === 'lead';
        else if (statusFilter === 'Đã kết thúc') matchesStatus = customer.status === 'paid';
      }

      let matchesDate = true;
      const ref = customer.dob_expected || customer.created_at || '';
      if (monthFilter !== 'all') matchesDate = matchesDate && ref.slice(5,7) === monthFilter;
      if (yearFilter)            matchesDate = matchesDate && ref.slice(0,4) === yearFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });

    result.sort((a, b) => {
      if (sortBy === 'active_package_desc') {
        const activeDiff = Number(b.is_in_care) - Number(a.is_in_care);
        if (activeDiff !== 0) return activeDiff;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      } else if (sortBy === 'name_asc') {
        return (a.name_mother || '').localeCompare(b.name_mother || '');
      } else if (sortBy === 'name_desc') {
        return (b.name_mother || '').localeCompare(a.name_mother || '');
      } else if (sortBy === 'date_asc') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      } else {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

    return result;
  }, [customers, searchQuery, statusFilter, monthFilter, yearFilter, sortBy, tenantModuleKey, depositStatusFilterLabel]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const container = document.getElementById('customers-list-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isHaircut) {
    return (
      <>
        <HaircutCustomerView
          customers={customers}
          isLoading={isLoading}
          isSyncing={isSyncing}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          handleAddNew={handleAddNew}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleZalo={handleZalo}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          toggleMenu={toggleMenu}
        />

        {/* Modal for Add / Edit Customer */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[40px]"
              >
                <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-8 lg:p-10">
                  <div className="mb-6 flex items-start justify-between gap-3 sm:mb-8">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                        <UserPlus className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{isEditMode ? 'Cập nhật thông tin' : 'Thêm khách hàng mới'}</h2>
                        <p className="text-slate-500 font-medium">{isEditMode ? customerLabels.editDescription : customerLabels.createDescription}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.primaryNameLabel}</label>
                        <input 
                          type="text" 
                          name="name_mother"
                          required
                          value={formData.name_mother}
                          onChange={handleInputChange}
                          data-testid="customer-name-input"
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none" 
                          placeholder={customerLabels.primaryNamePlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Số điện thoại</label>
                        <input 
                          type="text" 
                          name="phone"
                          required
                          value={formData.phone}
                          onChange={handleInputChange}
                          data-testid="customer-phone-input"
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none" 
                          placeholder="VD: 0901234567" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryNameLabel}</label>
                        <input 
                          type="text" 
                          name="name_baby"
                          value={formData.name_baby}
                          onChange={handleInputChange}
                          data-testid="customer-secondary-name-input"
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                          placeholder={customerLabels.secondaryNamePlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryDateLabel}</label>
                        <input 
                          type="date" 
                          name="dob_expected"
                          min={tenantModuleKey === 'babycare' ? today : undefined}
                          max="9999-12-31"
                          value={formData.dob_expected}
                          onChange={handleInputChange}
                          className="w-full px-3 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-bold" 
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryGenderLabel}</label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {customerLabels.genderOptions.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, gender_baby: g.id })}
                              className={cn(
                                "py-3 rounded-xl font-bold text-xs transition-all border",
                                formData.gender_baby === g.id 
                                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" 
                                  : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/20"
                              )}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Địa chỉ</label>
                      <textarea 
                        name="address"
                        required
                        value={formData.address}
                        onChange={handleInputChange}
                        data-testid="customer-address-input"
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none resize-none h-24" 
                        placeholder="Nhập địa chỉ chi tiết..."
                      ></textarea>
                    </div>
                    
                    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4 sm:pt-6">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
                        Hủy bỏ
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        data-testid="customer-submit-button"
                        className={cn(
                          "flex-1 py-4 text-primary-foreground font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2",
                          isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:opacity-90 shadow-primary/20"
                        )}
                      >
                        {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {isSubmitting ? (isEditMode ? 'Đang cập nhật...' : 'Đang lưu...') : (isEditMode ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ')}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div id="customers-list-container" className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-3 sm:p-6 md:p-8 relative" onClick={() => { setActiveMenuId(null); }}>
      {/* Non-intrusive loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30 origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Khách hàng</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">{customerLabels.customerListSubtitle}</p>
          </div>
        </div>
        <div className="bella-toolbar flex flex-wrap items-center gap-2 sm:gap-3">
          <PremiumExportButton />
          <button 
            onClick={handleAddNew}
            data-testid="customer-add-button"
            className="beauty-customer-add-cta flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95 text-sm sm:px-5"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* 4 Top Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric Card 1: Tổng khách hàng */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng khách hàng</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{metrics.total.toLocaleString('vi-VN')}</h3>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Hồ sơ trong hệ thống
            </p>
          </div>
        </div>

        {/* Metric Card 2: Đang sử dụng dịch vụ */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Đang sử dụng dịch vụ</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{metrics.inCare.toLocaleString('vi-VN')}</h3>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
              Đang có gói liệu trình
            </p>
          </div>
        </div>

        {/* Metric Card 3: Khách mới tháng này */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Khách mới tháng này</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{metrics.newThisMonth.toLocaleString('vi-VN')}</h3>
            <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-0.5">
              Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* Metric Card 4: Cần chăm sóc */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cần chăm sóc</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{metrics.needsCare.toLocaleString('vi-VN')}</h3>
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
              Khách tiềm năng & tư vấn
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Control Bar */}
      <div className="bella-toolbar mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Left Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder={customerLabels.customerSearchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-3.5 py-2 rounded-xl border outline-none font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm transition-shadow",
                SOFT_INPUT_CLASS
              )}
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-40 sm:w-44">
            <PremiumSelect
              value={statusFilter}
              options={statusOptions.map(opt => ({ value: opt, label: opt, icon: <Filter className="w-3.5 h-3.5" /> }))}
              onChange={val => setStatusFilter(val)}
              placeholder="Trạng thái..."
              buttonClassName={SOFT_SELECT_BUTTON_CLASS}
            />
          </div>

          {/* Month Dropdown */}
          <div className="w-32">
            <PremiumSelect
              value={monthFilter}
              options={monthOptions}
              onChange={val => setMonthFilter(val)}
              placeholder="Tháng..."
              buttonClassName={SOFT_SELECT_BUTTON_CLASS}
            />
          </div>

          {/* Year Dropdown */}
          <div className="w-28">
            <PremiumSelect
              value={yearFilter}
              options={yearOptions.map(y => ({ value: y, label: y }))}
              onChange={val => setYearFilter(val)}
              placeholder="Năm..."
              buttonClassName={SOFT_SELECT_BUTTON_CLASS}
            />
          </div>
        </div>

        {/* Right controls: View Switcher, Sort */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          {/* Sort */}
          <div className="w-44">
            <PremiumSelect
              value={sortBy}
              options={sortOptions}
              onChange={val => setSortBy(val)}
              placeholder="Sắp xếp..."
              buttonClassName={SOFT_SELECT_BUTTON_CLASS}
            />
          </div>

          {/* View Switcher Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'card'
                  ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              title="Xem dạng thẻ"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'table'
                  ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              title="Xem dạng bảng"
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer List Content */}
      {isLoading && customers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm sm:p-20">
          <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Đang tải dữ liệu khách hàng...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-200 dark:border-slate-800 sm:p-16">
          <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Không tìm thấy khách hàng nào khớp với bộ lọc</p>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 gap-4">
          {paginatedCustomers.map((customer, idx: number) => {
            const genderInfo = getCustomerGenderPresentation(customer.gender_baby, tenantModuleKey);
            const secondarySummary = getCustomerSecondarySummary({
              moduleKey: tenantModuleKey,
              status: customer.status,
              secondaryName: customer.name_baby,
              expectedDate: customer.dob_expected,
            });

            return (
              <motion.div 
                key={customer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                data-testid="customer-row"
                data-customer-id={customer.id}
                className="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 hover:shadow-lg hover:border-primary/30 transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4"
              >
                {/* Left Column: Avatar & Customer Identity */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 group-hover:scale-105 transition-transform">
                      {(customer.name_mother || 'K')[0].toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" title="Đang hoạt động" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/customers/${customer.id}`)}>
                        {customer.name_mother}
                      </h3>

                      {customer.is_in_care && tenantModuleKey !== 'industrial_cleaning' ? (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Sparkles className="w-3 h-3" />
                          {customerLabels.activeCareBadge}
                        </span>
                      ) : customer.status === 'lead' ? (
                        <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          Tiềm năng
                        </span>
                      ) : customer.status === 'deposit' ? (
                        <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          {customerLabels.depositStatusLabel}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          Mới
                        </span>
                      )}

                      {customer.gender_baby && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                          genderInfo.tone === 'blue' ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" :
                          genderInfo.tone === 'rose' ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {genderInfo.label}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{customer.phone}</span>
                      </div>
                      {secondarySummary && (
                        <div className="flex items-center gap-1.5">
                          <SecondaryInfoIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{secondarySummary}</span>
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-1.5 truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{customer.address}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5">
                      <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>{customer.loyalty_points ?? 0} điểm</span>
                      </div>
                      {customer.deposit_amount ? (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Đã thanh toán: {Number(customer.deposit_amount).toLocaleString('vi-VN')}đ</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Middle Column: Active Package Summary */}
                <div className="w-full xl:w-72 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-3 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {customer.package_name || 'Liệu trình chăm sóc'}
                    </span>
                    <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                      {customer.is_in_care ? 'Đang chạy' : 'Tiêu chuẩn'}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>Tiến độ buổi</span>
                      <span className="text-primary font-bold">{customer.package_progress_percent ?? 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${customer.package_progress_percent ?? 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex items-center justify-between xl:justify-end gap-2.5 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => router.push(`/dashboard/bookings?customer=${customer.name_mother}`)}
                    className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                    title="Xem lịch hẹn"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                    data-testid="customer-detail-button"
                    className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
                  >
                    <span>Chi tiết</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={(e) => toggleMenu(e, customer.id)}
                      className={cn(
                        "p-2.5 rounded-xl transition-all",
                        activeMenuId === customer.id ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === customer.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 5 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden p-1.5 space-y-1"
                        >
                          <button 
                            onClick={() => handleEdit(customer)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                            Chỉnh sửa
                          </button>
                          <button 
                            onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <ClipboardList className="w-3.5 h-3.5 text-primary" />
                            {vocab.booking.singular}
                          </button>
                          <button 
                            onClick={() => handleZalo(customer.phone)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                            Gửi Zalo
                          </button>
                          <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                          <button 
                            onClick={() => handleDelete(customer.id)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa hồ sơ
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3.5 px-4">Khách hàng</th>
                  <th className="py-3.5 px-4">Số điện thoại</th>
                  <th className="py-3.5 px-4">Thông tin phụ</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Gói dịch vụ</th>
                  <th className="py-3.5 px-4">Điểm tích lũy</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    data-testid="customer-row" 
                    data-customer-id={customer.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {(customer.name_mother || 'K')[0].toUpperCase()}
                        </div>
                        <span className="hover:text-primary cursor-pointer" onClick={() => router.push(`/dashboard/customers/${customer.id}`)}>
                          {customer.name_mother}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">{customer.phone}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {getCustomerSecondarySummary({
                        moduleKey: tenantModuleKey,
                        status: customer.status,
                        secondaryName: customer.name_baby,
                        expectedDate: customer.dob_expected,
                      }) || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {customer.is_in_care ? (
                        <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                          {customerLabels.activeCareBadge}
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                          Tiêu chuẩn
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {customer.package_name || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">
                      {customer.loyalty_points ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                          data-testid="customer-detail-button"
                          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold text-xs hover:opacity-90 transition-colors"
                        >
                          Chi tiết
                        </button>
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                          title="Sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 md:flex-row text-xs font-medium text-slate-500">
          <p>
            Hiển thị <span className="font-bold text-slate-900 dark:text-slate-100">{startIndex}-{endIndex}</span> trên tổng số <span className="font-bold text-slate-900 dark:text-slate-100">{filteredCustomers.length}</span> khách hàng
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-40 hover:border-primary hover:text-primary transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              if (totalPages > 7) {
                if (page > 1 && page < totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                  if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-400">...</span>;
                  return null;
                }
              }

              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    "w-8 h-8 rounded-xl font-bold text-xs transition-all",
                    currentPage === page
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                  )}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-40 hover:border-primary hover:text-primary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Spacer for bottom navigation */}
      <div className="h-20" />

      {/* Add / Edit Customer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[40px]"
            >
              <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-8 lg:p-10">
                <div className="mb-6 flex items-start justify-between gap-3 sm:mb-8">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{isEditMode ? 'Cập nhật thông tin' : 'Thêm khách hàng mới'}</h2>
                      <p className="text-slate-500 font-medium">{isEditMode ? customerLabels.editDescription : customerLabels.createDescription}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.primaryNameLabel}</label>
                      <input 
                        type="text" 
                        name="name_mother"
                        required
                        value={formData.name_mother}
                        onChange={handleInputChange}
                        data-testid="customer-name-input"
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none" 
                        placeholder={customerLabels.primaryNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Số điện thoại</label>
                      <input 
                        type="text" 
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        data-testid="customer-phone-input"
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none" 
                        placeholder="VD: 0901234567" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryNameLabel}</label>
                      <input 
                        type="text" 
                        name="name_baby"
                        value={formData.name_baby}
                        onChange={handleInputChange}
                        data-testid="customer-secondary-name-input"
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                        placeholder={customerLabels.secondaryNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryDateLabel}</label>
                      <input 
                        type="date" 
                        name="dob_expected"
                        min={tenantModuleKey === 'babycare' ? today : undefined}
                        max="9999-12-31"
                        value={formData.dob_expected}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-bold" 
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">{customerLabels.secondaryGenderLabel}</label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {customerLabels.genderOptions.map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender_baby: g.id })}
                            className={cn(
                              "py-3 rounded-xl font-bold text-xs transition-all border",
                              formData.gender_baby === g.id 
                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" 
                                : "bg-slate-50 text-slate-400 border-slate-100 hover:border-primary/20"
                            )}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Địa chỉ</label>
                    <textarea 
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      data-testid="customer-address-input"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none resize-none h-24" 
                      placeholder="Nhập địa chỉ chi tiết..."
                    ></textarea>
                  </div>
                  
                  <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4 sm:pt-6">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      data-testid="customer-submit-button"
                      className={cn(
                        "flex-1 py-4 text-primary-foreground font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:opacity-90 shadow-primary/20"
                      )}
                    >
                      {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                      {isSubmitting ? (isEditMode ? 'Đang cập nhật...' : 'Đang lưu...') : (isEditMode ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
