'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  DollarSign,
  Link as LinkIcon,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRightLeft,
  X,
  CheckCircle2,
  RefreshCw,
  Wallet,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  getInterBranchClearingRecords,
  simulateInterBranchClearing,
  type InterBranchClearingRecord,
} from '@/services/clearing-actions';
import { allocateOrphanedRevenue, collectDebtPayment } from '@/services/reconciliation-actions';

type Numberish = string | number | null | undefined;
type ProfileRow = {
  tenant_id: string | null;
  role: string | null;
};

type DebtAlert = {
  booking_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  package_name?: string | null;
  full_price?: Numberish;
  total_paid?: Numberish;
  debt?: Numberish;
};

type OrphanedRevenue = {
  revenue_id: string;
  revenue_type?: string | null;
  received_date?: string | null;
  notes?: string | null;
  amount?: Numberish;
};

type MismatchAlert = DebtAlert & {
  mismatch?: Numberish;
};

type CollectionHistory = {
  revenue_id: string;
  amount: Numberish;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  customer_name: string;
};

type FinancialAnomaliesData = {
  debt_alerts: DebtAlert[];
  orphaned_revenue: OrphanedRevenue[];
  mismatch_alerts: MismatchAlert[];
  collection_history: CollectionHistory[];
};

type FinancialAnomaliesRpcData = Partial<Omit<FinancialAnomaliesData, 'collection_history'>>;

type RevenueHistoryRow = {
  id: string;
  amount: Numberish;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  bookings?: {
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
    } | null;
  } | null;
};

type LegacyProfilesClient = {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: ProfileRow | null; error: unknown }>;
      };
    };
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return fallback;
}

const formatNumberishCurrency = (value: Numberish) => formatCurrency(Number(value || 0));

export default function FinancialReconciliationPage() {
  const [data, setData] = useState<FinancialAnomaliesData>({
    debt_alerts: [],
    orphaned_revenue: [],
    mismatch_alerts: [],
    collection_history: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'debt' | 'orphan' | 'mismatch' | 'history' | 'clearing'>('debt');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);

  // Inter-branch clearing state
  const [clearingRecords, setClearingRecords] = useState<InterBranchClearingRecord[]>([]);
  const [isPayingClearing, setIsPayingClearing] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string>('');

  // Modal Allocation State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedOrphan, setSelectedOrphan] = useState<OrphanedRevenue | null>(null);
  const [targetBookingId, setTargetBookingId] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);

  // Debt Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtAlert | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash'>('bank_transfer');
  const [isPaying, setIsPaying] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Get current user and tenant from Supabase Auth server validation.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!user) throw new Error('Không tìm thấy phiên đăng nhập');
      
      // First try users table
      const { data: userData, error: profileErr } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();
      let profile: ProfileRow | null = userData;
        
      if (profileErr || !profile?.tenant_id) {
         // Fallback to legacy `profiles` table (not in current Database schema).
         const legacyProfilesClient = supabase as unknown as LegacyProfilesClient;
         const { data: fallbackProfile } = await legacyProfilesClient
           .from('profiles')
           .select('tenant_id, role')
           .eq('id', user.id)
           .single();
         profile = fallbackProfile;
      }
        
      if (!profile?.tenant_id) throw new Error('Không tìm thấy thông tin cơ sở');

      setCurrentTenantId(profile.tenant_id);

      // Fetch anomalies via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_financial_anomalies', {
        p_tenant_id: profile.tenant_id
      });

      if (rpcError) throw rpcError;

      // Fetch debt collection history
      const { data: historyData, error: historyError } = await supabase
        .from('revenue')
        .select(`
          id, amount, received_date, notes, payment_method, booking_id,
          bookings (
            customers (
              name_mother, name_baby
            )
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('revenue_type', 'additional')
        .order('received_date', { ascending: false });

      if (historyError) throw historyError;

      const historyRows = (historyData || []) as unknown as RevenueHistoryRow[];
      const historyFormatted: CollectionHistory[] = historyRows.map((item) => ({
        revenue_id: item.id,
        amount: item.amount,
        received_date: item.received_date,
        notes: item.notes,
        payment_method: item.payment_method,
        booking_id: item.booking_id,
        customer_name: item.bookings?.customers?.name_mother || item.bookings?.customers?.name_baby || 'Khách hàng'
      })) || [];

      if (rpcData) {
        const anomalies = rpcData as FinancialAnomaliesRpcData;
        setData({
          debt_alerts: anomalies.debt_alerts ?? [],
          orphaned_revenue: anomalies.orphaned_revenue ?? [],
          mismatch_alerts: anomalies.mismatch_alerts ?? [],
          collection_history: historyFormatted
        });
      }

      // Fetch clearing records
      const clearingData = await getInterBranchClearingRecords(profile.tenant_id);
      setClearingRecords(clearingData || []);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, 'Lỗi khi tải dữ liệu đối soát'));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const handleAllocate = async () => {
    if (!targetBookingId.trim() || !selectedOrphan) {
      toast.error('Vui lòng nhập Booking ID hợp lệ');
      return;
    }

    setIsAllocating(true);
    try {
      const res = await allocateOrphanedRevenue(selectedOrphan.revenue_id, targetBookingId.trim());
      if (!res.success) throw new Error(res.error || 'Không thể phân bổ khoản tiền');

      toast.success('Đã phân bổ khoản tiền thành công!');
      setShowAllocateModal(false);
      setSelectedOrphan(null);
      setTargetBookingId('');
      fetchData();
    } catch (error: unknown) {
      toast.error('Lỗi phân bổ: ' + getErrorMessage(error, 'Không thể phân bổ khoản tiền'));
    } finally {
      setIsAllocating(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || !selectedDebt) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsPaying(true);
    try {
      const cleanAmount = Number(paymentAmount.replace(/\D/g, ''));
      if (!cleanAmount) throw new Error('Số tiền không hợp lệ');

      const res = await collectDebtPayment({
        bookingId: selectedDebt.booking_id,
        amount: cleanAmount,
        paymentMethod,
        customerName: selectedDebt.customer_name,
        packageName: selectedDebt.package_name,
      });
      if (!res.success) throw new Error(res.error || 'Không thể thu tiền');

      toast.success('Thu tiền thành công!');
      setShowPaymentModal(false);
      setSelectedDebt(null);
      setPaymentAmount('');
      fetchData();
    } catch (error: unknown) {
      toast.error('Lỗi thu tiền: ' + getErrorMessage(error, 'Không thể thu tiền'));
    } finally {
      setIsPaying(false);
    }
  };

  const handlePayClearing = async (recordId: string) => {
    setIsPayingClearing(recordId);
    try {
      const res = await simulateInterBranchClearing(recordId);
      if (res.success) {
        toast.success('Bù trừ công nợ liên chi nhánh thành công via VietQR Sandbox!');
        fetchData();
      } else {
        toast.error('Lỗi khi đối soát: ' + res.error);
      }
    } catch (e: unknown) {
      toast.error('Lỗi: ' + getErrorMessage(e, 'Không thể bù trừ công nợ'));
    } finally {
      setIsPayingClearing(null);
    }
  };

  const totalDebt = data.debt_alerts.reduce((acc, item) => acc + Number(item.debt || 0), 0);
  const totalOrphaned = data.orphaned_revenue.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const totalMismatches = data.mismatch_alerts.length;

  const filteredDebt = data.debt_alerts.filter(d => 
    d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrphan = data.orphaned_revenue.filter(o => {
    const matchSearch = o.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.revenue_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate ? o.received_date === filterDate : true;
    return matchSearch && matchDate;
  });

  const filteredMismatch = data.mismatch_alerts.filter(m => 
    m.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = data.collection_history.filter(h => {
    const matchSearch = h.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        h.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate ? h.received_date === filterDate : true;
    return matchSearch && matchDate;
  });

  const filteredClearing = clearingRecords.filter(c => {
    const matchSearch = 
      c.clearing_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.debtor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.creditor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDate = filterDate ? c.month_year === filterDate.substring(0, 7) : true;
    return matchSearch && matchDate;
  });

  const payables = filteredClearing.filter(c => c.debtor_tenant_id === currentTenantId);
  const receivables = filteredClearing.filter(c => c.creditor_tenant_id === currentTenantId);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-24 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary/80 mb-2">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-widest">Trung tâm Giám sát</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Đối soát Tài chính</h1>
          <p className="text-slate-500 mt-2 font-medium">Tự động phát hiện công nợ, tiền treo và chênh lệch doanh thu</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm w-full sm:w-auto transition-all hover:border-slate-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">LỌC NGÀY:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent border-none p-0 text-sm font-black text-slate-700 focus:ring-0 outline-none cursor-pointer w-full sm:w-auto"
            />
          </div>
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="flex w-full sm:w-auto justify-center items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            QUÉT LẠI
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-rose-200 dark:shadow-none relative overflow-hidden w-full">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{data.debt_alerts.length} khách</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Cần thu hồi nợ</p>
            <h3 className="text-2xl sm:text-3xl font-black break-words">{formatCurrency(totalDebt)}</h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-amber-200 relative overflow-hidden w-full">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <LinkIcon className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">{data.orphaned_revenue.length} khoản</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Tiền thu bị treo</p>
            <h3 className="text-2xl sm:text-3xl font-black break-words">{formatCurrency(totalOrphaned)}</h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 text-white shadow-lg shadow-purple-200 relative overflow-hidden w-full">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black backdrop-blur-md">Xử lý ngay</span>
            </div>
            <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">Booking lệch giá trị</p>
            <h3 className="text-2xl sm:text-3xl font-black break-words">{totalMismatches} <span className="text-lg opacity-80">vụ việc</span></h3>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-2 flex flex-col lg:flex-row justify-between items-center gap-4">
        {/* Mobile Tab Dropdown Select */}
        <div className="block lg:hidden w-full relative">
          <button
            type="button"
            onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] outline-none"
          >
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const tabsList = [
                  { id: 'debt', label: 'Công Nợ Khách Hàng', count: data.debt_alerts.length, color: 'text-rose-500', bg: 'bg-rose-50' },
                  { id: 'orphan', label: 'Tiền Treo (Chưa gán)', count: data.orphaned_revenue.length, color: 'text-amber-500', bg: 'bg-amber-50' },
                  { id: 'mismatch', label: 'Lệch Doanh Thu', count: data.mismatch_alerts.length, color: 'text-purple-500', bg: 'bg-purple-50' },
                  { id: 'clearing', label: 'Bù trừ Chi nhánh', count: clearingRecords.filter(c => c.status === 'pending').length, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  { id: 'history', label: 'Lịch Sử Thu Nợ', count: data.collection_history.length, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                ];
                const activeTabObj = tabsList.find(t => t.id === activeTab) || tabsList[0];
                return (
                  <>
                    <span className="text-xs font-black uppercase tracking-widest truncate">{activeTabObj.label}</span>
                    <span className={cn("px-2 py-0.5 rounded-lg text-[10px]", activeTabObj.bg + ' ' + activeTabObj.color)}>
                      {activeTabObj.count}
                    </span>
                  </>
                );
              })()}
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0",
              isTabDropdownOpen && "rotate-180 text-primary"
            )} />
          </button>

          <AnimatePresence>
            {isTabDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsTabDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden py-2"
                >
                  {(
                    [
                      { id: 'debt', label: 'Công Nợ Khách Hàng', count: data.debt_alerts.length, color: 'text-rose-500', bg: 'bg-rose-50' },
                      { id: 'orphan', label: 'Tiền Treo (Chưa gán)', count: data.orphaned_revenue.length, color: 'text-amber-500', bg: 'bg-amber-50' },
                      { id: 'mismatch', label: 'Lệch Doanh Thu', count: data.mismatch_alerts.length, color: 'text-purple-500', bg: 'bg-purple-50' },
                      { id: 'clearing', label: 'Bù trừ Chi nhánh', count: clearingRecords.filter(c => c.status === 'pending').length, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                      { id: 'history', label: 'Lịch Sử Thu Nợ', count: data.collection_history.length, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    ] as { id: 'debt' | 'orphan' | 'mismatch' | 'clearing' | 'history'; label: string; count: number; color: string; bg: string }[]
                  ).map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsTabDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors",
                          isActive
                            ? "bg-rose-50/50 text-primary font-black"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider truncate">{tab.label}</span>
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px]", isActive ? tab.bg + ' ' + tab.color : "bg-slate-100 text-slate-400")}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Tabs List */}
        <div className="hidden lg:flex gap-1 p-1 bg-slate-50 rounded-[24px] w-full md:w-auto">
          {(
            [
              { id: 'debt', label: 'Công Nợ Khách Hàng', count: data.debt_alerts.length, color: 'text-rose-500', bg: 'bg-rose-50' },
              { id: 'orphan', label: 'Tiền Treo (Chưa gán)', count: data.orphaned_revenue.length, color: 'text-amber-500', bg: 'bg-amber-50' },
              { id: 'mismatch', label: 'Lệch Doanh Thu', count: data.mismatch_alerts.length, color: 'text-purple-500', bg: 'bg-purple-50' },
              { id: 'clearing', label: 'Bù trừ Chi nhánh', count: clearingRecords.filter(c => c.status === 'pending').length, color: 'text-indigo-500', bg: 'bg-indigo-50' },
              { id: 'history', label: 'Lịch Sử Thu Nợ', count: data.collection_history.length, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            ] as { id: 'debt' | 'orphan' | 'mismatch' | 'clearing' | 'history'; label: string; count: number; color: string; bg: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-1 md:flex-none px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shrink-0 whitespace-nowrap",
                activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.label}
              <span className={cn("px-2 py-0.5 rounded-lg text-[10px]", activeTab === tab.id ? tab.bg + ' ' + tab.color : "bg-slate-100 text-slate-400")}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        <div className="w-full lg:w-auto px-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full lg:w-[250px] pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLES */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden w-full max-w-full">
        {isLoading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Đang quét hệ thống tài chính...</p>
          </div>
        ) : activeTab === 'clearing' ? (
          <div className="p-4 sm:p-8 space-y-8 bg-slate-50/10">
            {/* KHOẢN PHẢI TRẢ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-6 bg-rose-500 rounded-full" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Khoản phải trả (Nợ chi nhánh khác)</h2>
              </div>
              
              <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar w-full">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Mã đối soát</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Chi nhánh chủ nợ</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Tháng</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Số buổi</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Đơn giá</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-rose-500 uppercase tracking-wider whitespace-nowrap">Tổng tiền phải trả</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payables.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium whitespace-nowrap">
                            Không có khoản phải trả nào cần xử lý. Tuyệt vời! 🎉
                          </td>
                        </tr>
                      ) : (
                        payables.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600 whitespace-nowrap">
                              {rec.clearing_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-black text-sm text-slate-800">{rec.creditor?.name || 'Chi nhánh khác'}</span>
                            </td>
                            <td className="px-6 py-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">
                              {rec.month_year}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-700 whitespace-nowrap">
                              {rec.session_count} buổi
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-500 whitespace-nowrap">
                              {formatCurrency(rec.clearing_rate)}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                              {formatCurrency(rec.calculated_amount)}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className={cn(
                                "inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                rec.status === 'cleared' 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse"
                              )}>
                                {rec.status === 'cleared' ? 'Đã Bù Trừ' : 'Chờ Bù Trừ'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {rec.status === 'pending' ? (
                                <button
                                  onClick={() => handlePayClearing(rec.id)}
                                  disabled={isPayingClearing === rec.id}
                                  className="inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-rose-100 dark:shadow-none active:scale-95 disabled:opacity-50"
                                >
                                  {isPayingClearing === rec.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      Đang trả...
                                    </>
                                  ) : (
                                    <>
                                      <Wallet className="w-3 h-3" />
                                      Giả lập VietQR
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* KHOẢN PHẢI THU */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Khoản phải thu (Chi nhánh khác nợ ta)</h2>
              </div>
              
              <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar w-full">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Mã đối soát</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Chi nhánh con nợ</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Tháng</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Số buổi</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Đơn giá</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-600 uppercase tracking-wider whitespace-nowrap">Tổng tiền phải thu</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {receivables.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium whitespace-nowrap">
                            Không có khoản phải thu nào.
                          </td>
                        </tr>
                      ) : (
                        receivables.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600 whitespace-nowrap">
                              {rec.clearing_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-black text-sm text-slate-800">{rec.debtor?.name || 'Chi nhánh khác'}</span>
                            </td>
                            <td className="px-6 py-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">
                              {rec.month_year}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-700 whitespace-nowrap">
                              {rec.session_count} buổi
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-500 whitespace-nowrap">
                              {formatCurrency(rec.clearing_rate)}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                              {formatCurrency(rec.calculated_amount)}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className={cn(
                                "inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                rec.status === 'cleared' 
                                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                  : "bg-amber-50 text-amber-600 border border-amber-100"
                              )}>
                                {rec.status === 'cleared' ? 'Đã Thanh Toán' : 'Chờ Đối Tác Trả'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left text-xs text-slate-500 max-w-xs truncate whitespace-nowrap">
                              {rec.notes || <span className="italic text-slate-300">Không có ghi chú</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50">
                  {activeTab === 'debt' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Khách hàng & Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Giá trị Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Đã Thu</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] whitespace-nowrap">Còn Nợ</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'orphan' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">ID Khoản Thu & Loại</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Ghi Chú</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Số Tiền</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'mismatch' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Khách hàng & Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Giá trị Gói</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Tổng Đã Thu</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] whitespace-nowrap">Mức Lệch</th>
                      <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Thao tác</th>
                    </>
                  )}
                  {activeTab === 'history' && (
                    <>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Ngày Thu</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Khách Hàng</th>
                      <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Ghi Chú & Hình Thức</th>
                      <th className="px-8 py-6 text-right text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Số Tiền Đã Thu</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* DEBT TAB */}
                {activeTab === 'debt' && filteredDebt.map((item, i) => (
                  <tr key={item.booking_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{item.package_name || 'Gói Dịch Vụ'}</div>
                      <div className="text-[10px] text-slate-300 font-mono mt-1">ID: {item.booking_id?.split('-')[0]}...</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-500 whitespace-nowrap">{formatNumberishCurrency(item.full_price)}</td>
                    <td className="px-8 py-6 text-right font-black text-emerald-600 whitespace-nowrap">{formatNumberishCurrency(item.total_paid)}</td>
                    <td className="px-8 py-6 text-right whitespace-nowrap">
                      <span className="inline-block bg-rose-50 text-rose-600 font-black px-3 py-1.5 rounded-xl border border-rose-100">
                        {formatNumberishCurrency(item.debt)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center whitespace-nowrap">
                      <button 
                        onClick={() => {
                          setSelectedDebt(item);
                          setPaymentAmount(item.debt?.toString() || '');
                          setPaymentMethod('bank_transfer');
                          setShowPaymentModal(true);
                        }}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-primary hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <DollarSign className="w-3 h-3" />
                        Thu Nợ
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* ORPHAN TAB */}
                {activeTab === 'orphan' && filteredOrphan.map((item, i) => (
                  <tr key={item.revenue_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="font-mono text-xs text-slate-900 bg-slate-100 inline-block px-2 py-1 rounded-lg">
                        {item.revenue_id?.split('-')[0]}...
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mt-2">
                        {item.revenue_type || 'UNKNOWN TYPE'} • {item.received_date}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <p className="text-sm text-slate-600 font-medium max-w-xs truncate">{item.notes || <span className="italic text-slate-300">Không có ghi chú</span>}</p>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-amber-600 text-lg whitespace-nowrap">
                      {formatNumberishCurrency(item.amount)}
                    </td>
                    <td className="px-8 py-6 text-center whitespace-nowrap">
                      <button 
                        onClick={() => { setSelectedOrphan(item); setShowAllocateModal(true); }}
                        className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <ArrowRightLeft className="w-3 h-3" />
                        Phân bổ
                      </button>
                    </td>
                  </tr>
                ))}

                {/* MISMATCH TAB */}
                {activeTab === 'mismatch' && filteredMismatch.map((item, i) => (
                  <tr key={item.booking_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">{item.package_name || 'Gói Dịch Vụ'}</div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-500 whitespace-nowrap">{formatNumberishCurrency(item.full_price)}</td>
                    <td className="px-8 py-6 text-right font-black text-emerald-600 whitespace-nowrap">{formatNumberishCurrency(item.total_paid)}</td>
                    <td className="px-8 py-6 text-right whitespace-nowrap">
                      <span className="inline-block bg-purple-50 text-purple-600 font-black px-3 py-1.5 rounded-xl border border-purple-100">
                        + {formatNumberishCurrency(item.mismatch)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center whitespace-nowrap">
                      <Link href={`/dashboard/customers/${item.customer_id}?bookingId=${item.booking_id}`}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <ExternalLink className="w-3 h-3" />
                        Điều Tra
                      </Link>
                    </td>
                  </tr>
                ))}

                {/* HISTORY TAB */}
                {activeTab === 'history' && filteredHistory.map((item, i) => (
                  <tr key={item.revenue_id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6 align-top whitespace-nowrap">
                      <div className="font-black text-sm text-slate-900">{item.received_date}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">ID: {item.revenue_id?.split('-')[0]}</div>
                    </td>
                    <td className="px-8 py-6 align-top whitespace-nowrap">
                      <div className="font-black text-sm text-slate-900">{item.customer_name}</div>
                    </td>
                    <td className="px-8 py-6 align-top whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-600">{item.notes}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                        {item.payment_method?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right align-top whitespace-nowrap">
                      <div className="font-black text-emerald-600 text-base mt-[-1px]">
                        + {formatNumberishCurrency(item.amount)}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* EMPTY STATES */}
                {activeTab === 'debt' && filteredDebt.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium whitespace-nowrap">Không tìm thấy công nợ nào cần xử lý. Tuyệt vời! 🎉</td></tr>
                )}
                {activeTab === 'orphan' && filteredOrphan.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium whitespace-nowrap">Mọi khoản tiền đều đã được phân bổ rõ ràng. ✨</td></tr>
                )}
                {activeTab === 'mismatch' && filteredMismatch.length === 0 && (
                  <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium whitespace-nowrap">Không có sai lệch dữ liệu nào. Hệ thống an toàn! 🛡️</td></tr>
                )}
                {activeTab === 'history' && filteredHistory.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium whitespace-nowrap">Chưa có dữ liệu thu nợ nào trong bộ lọc này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PHÂN BỔ TIỀN TREO */}
      <AnimatePresence>
        {showAllocateModal && selectedOrphan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAllocateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900">Phân Bổ Tiền Treo</h3>
                </div>
                <button onClick={() => setShowAllocateModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền đang treo</p>
                  <p className="text-3xl font-black text-amber-600 mb-2">{formatNumberishCurrency(selectedOrphan.amount)}</p>
                  {selectedOrphan.notes && (
                    <p className="text-xs text-slate-600 font-medium italic border-l-2 border-amber-200 pl-2">
                      Ghi chú: {selectedOrphan.notes}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Nhập Booking ID cần phân bổ vào
                  </label>
                  <input
                    type="text"
                    value={targetBookingId}
                    onChange={(e) => setTargetBookingId(e.target.value)}
                    placeholder="VD: 123e4567-e89b-12d3..."
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Lưu ý: Bạn có thể vào màn hình Hồ sơ khách hàng hoặc Bookings để copy chính xác ID của Booking.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleAllocate}
                    disabled={isAllocating || !targetBookingId.trim()}
                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isAllocating ? 'Đang Xử Lý...' : 'Xác Nhận Phân Bổ'}
                    {!isAllocating && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: THU NỢ */}
      <AnimatePresence>
        {showPaymentModal && selectedDebt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900">Thu Nợ Khách Hàng</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Khách hàng</p>
                      <p className="text-sm font-black text-slate-900 mb-2">{selectedDebt.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mã Booking</p>
                      <p className="text-sm font-mono font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {selectedDebt.booking_id?.split('-')[0]?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-3">Gói Dịch Vụ</p>
                  <p className="text-sm font-black text-slate-600">{selectedDebt.package_name || 'Chưa cập nhật tên gói'}</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Số tiền thu (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={paymentAmount ? Number(paymentAmount.toString().replace(/\D/g, '')).toLocaleString() : ''}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="VD: 5,000,000"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all text-rose-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    Mặc định là số tiền khách còn nợ: <strong className="text-rose-500">{formatNumberishCurrency(selectedDebt.debt)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Phương thức thanh toán
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={cn(
                        "py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center",
                        paymentMethod === 'bank_transfer'
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      Chuyển khoản
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        "py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center",
                        paymentMethod === 'cash'
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      Tiền mặt
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePayment}
                    disabled={isPaying || !paymentAmount}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-rose-200 dark:shadow-none"
                  >
                    {isPaying ? 'Đang Xử Lý...' : 'Xác Nhận Thu Nợ'}
                    {!isPaying && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
