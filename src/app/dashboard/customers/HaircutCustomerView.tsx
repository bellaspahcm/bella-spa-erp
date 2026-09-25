/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  Users,
  UserCheck,
  RotateCw,
  Heart,
  Search,
  Filter,
  Calendar,
  Wallet,
  Star,
  Scissors,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  MessageCircle,
  ClipboardList,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronLeft,
  Crown
} from 'lucide-react';
import type { Database } from '@/types/database.types';

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
>;

export type CustomerListItem = CustomerRow & {
  bookings?: CustomerBookingSummary[] | null;
  deposit_amount?: number | '';
  package_name?: string;
  is_in_care?: boolean;
  is_fully_paid?: boolean;
};

interface HaircutCustomerViewProps {
  customers: CustomerListItem[];
  isLoading: boolean;
  isSyncing: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  monthFilter: string;
  setMonthFilter: (val: string) => void;
  yearFilter: string;
  setYearFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  handleAddNew: () => void;
  handleEdit: (customer: CustomerListItem) => void;
  handleDelete: (id: string) => void;
  handleZalo: (phone: string) => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  toggleMenu: (e: React.MouseEvent, id: string) => void;
}

const AVATAR_SEEDS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
];

const getCustomerBookingCount = (customer: CustomerListItem) => customer.bookings?.length ?? 0;
const isNewCustomer = (customer: CustomerListItem) =>
  customer.status === 'lead' || getCustomerBookingCount(customer) <= 1;
const isLoyalCustomer = (customer: CustomerListItem) =>
  Boolean(customer.is_in_care) || getCustomerBookingCount(customer) >= 3;
const isVipCustomer = (customer: CustomerListItem) =>
  (customer.loyalty_points ?? 0) >= 400 || getCustomerBookingCount(customer) >= 8;
const isCareCustomer = (customer: CustomerListItem) => customer.status === 'deposit';

const getCustomerSpendAmount = (customer: CustomerListItem) => {
  if (typeof customer.deposit_amount === 'number') {
    return customer.deposit_amount;
  }

  const bookingPayments = customer.bookings
    ?.map((booking) => booking.deposit_amount)
    .filter((amount): amount is number => typeof amount === 'number') ?? [];

  if (bookingPayments.length === 0) {
    return null;
  }

  return bookingPayments.reduce((total, amount) => total + amount, 0);
};

export function HaircutCustomerView({
  customers,
  isLoading,
  isSyncing,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  monthFilter,
  setMonthFilter,
  yearFilter,
  setYearFilter,
  sortBy,
  setSortBy,
  handleAddNew,
  handleEdit,
  handleDelete,
  handleZalo,
  activeMenuId,
  setActiveMenuId,
  toggleMenu,
}: HaircutCustomerViewProps) {
  const router = useRouter();
  const [activeTabPill, setActiveTabPill] = useState<'all' | 'new' | 'loyal' | 'vip' | 'care'>('all');
  const [groupFilter, setGroupFilter] = useState('Tất cả nhóm');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter options
  const groupOptions = [
    { value: 'Tất cả nhóm', label: 'Tất cả nhóm' },
    { value: 'VIP', label: 'VIP' },
    { value: 'Khách thân thiết', label: 'Khách thân thiết' },
    { value: 'Khách mới', label: 'Khách mới' },
    { value: 'Cần chăm sóc', label: 'Cần chăm sóc' },
  ];

  const statusOptions = [
    { value: 'Tất cả trạng thái', label: 'Tất cả trạng thái' },
    { value: 'Đang có gói liệu trình', label: 'Đang có gói liệu trình' },
    { value: 'Đang chăm sóc', label: 'Đang chăm sóc' },
    { value: 'Đã đặt cọc', label: 'Đã đặt cọc' },
    { value: 'Tiềm năng', label: 'Tiềm năng' },
    { value: 'Đã kết thúc', label: 'Đã kết thúc' },
  ];

  const monthOptions = [
    { value: 'all', label: 'Tháng 9' },
    { value: '01', label: 'Tháng 1' },
    { value: '02', label: 'Tháng 2' },
    { value: '03', label: 'Tháng 3' },
    { value: '04', label: 'Tháng 4' },
    { value: '05', label: 'Tháng 5' },
    { value: '06', label: 'Tháng 6' },
    { value: '07', label: 'Tháng 7' },
    { value: '08', label: 'Tháng 8' },
    { value: '09', label: 'Tháng 9' },
    { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' },
    { value: '12', label: 'Tháng 12' },
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));

  const sortOptions = [
    { value: 'date_desc', label: 'Mới nhất' },
    { value: 'active_package_desc', label: 'Gói đang hoạt động trước' },
    { value: 'name_asc', label: 'Tên A-Z' },
    { value: 'name_desc', label: 'Tên Z-A' },
  ];

  const customerStats = useMemo(() => {
    return customers.reduce(
      (stats, customer) => {
        stats.totalCount += 1;
        if (isNewCustomer(customer)) stats.newCount += 1;
        if (isLoyalCustomer(customer)) stats.loyalCount += 1;
        if (isVipCustomer(customer)) stats.vipCount += 1;
        if (isCareCustomer(customer)) stats.careCount += 1;
        if (getCustomerBookingCount(customer) >= 2) stats.returningCount += 1;
        return stats;
      },
      {
        totalCount: 0,
        newCount: 0,
        loyalCount: 0,
        vipCount: 0,
        careCount: 0,
        returningCount: 0,
      }
    );
  }, [customers]);

  const { totalCount, newCount, loyalCount, vipCount, careCount, returningCount } = customerStats;

  // Filter customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        [
          customer.name_mother,
          customer.phone,
          customer.address,
          customer.package_name,
          customer.notes,
        ].some((f) => (f || '').toLowerCase().includes(q));

      // Pill Tab filter
      let matchesPill = true;
      if (activeTabPill === 'new') {
        matchesPill = isNewCustomer(customer);
      } else if (activeTabPill === 'loyal') {
        matchesPill = isLoyalCustomer(customer);
      } else if (activeTabPill === 'vip') {
        matchesPill = isVipCustomer(customer);
      } else if (activeTabPill === 'care') {
        matchesPill = isCareCustomer(customer);
      }

      // Group Dropdown filter
      let matchesGroup = true;
      if (groupFilter !== 'Tất cả nhóm') {
        if (groupFilter === 'VIP') matchesGroup = isVipCustomer(customer);
        else if (groupFilter === 'Khách thân thiết') matchesGroup = isLoyalCustomer(customer);
        else if (groupFilter === 'Khách mới') matchesGroup = isNewCustomer(customer);
        else if (groupFilter === 'Cần chăm sóc') matchesGroup = isCareCustomer(customer);
      }

      return matchesSearch && matchesPill && matchesGroup;
    });
  }, [customers, searchQuery, activeTabPill, groupFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const startIndex = filteredCustomers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedCustomers.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div
      id="haircut-customers-container"
      className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 relative min-h-screen text-slate-800"
      onClick={() => setActiveMenuId(null)}
    >
      {/* Top Progress Bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-serif">
            Khách hàng
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Quản lý và chăm sóc khách hàng Haircut Shop
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-sm text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Tổng khách hàng */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Tổng khách hàng</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {totalCount.toLocaleString('vi-VN')}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                Real
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo danh sách khách hàng hiện có</p>
          </div>
        </div>

        {/* Card 2: Khách mới tháng này */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Khách mới tháng này</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {newCount.toLocaleString('vi-VN')}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                Real
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Lead hoặc có tối đa 1 booking</p>
          </div>
        </div>

        {/* Card 3: Khách quay lại */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <RotateCw className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Khách quay lại</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {returningCount.toLocaleString('vi-VN')}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                Real
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Có từ 2 booking trở lên</p>
          </div>
        </div>

        {/* Card 4: Cần chăm sóc */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Cần chăm sóc</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {careCount.toLocaleString('vi-VN')}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                Real
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Đang ở trạng thái đặt cọc</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm tên khách hàng, SĐT, dịch vụ, ghi chú..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl outline-none font-medium text-slate-700 text-sm focus:border-primary/50 focus:bg-white transition"
          />
        </div>

        {/* Dropdown 1: Tất cả nhóm */}
        <div className="w-44">
          <PremiumSelect
            value={groupFilter}
            options={groupOptions}
            onChange={(val) => setGroupFilter(val)}
            placeholder="Tất cả nhóm"
          />
        </div>

        {/* Dropdown 2: Tất cả trạng thái */}
        <div className="w-44">
          <PremiumSelect
            value={statusFilter}
            options={statusOptions}
            onChange={(val) => setStatusFilter(val)}
            placeholder="Tất cả trạng thái"
          />
        </div>

        {/* Dropdown 3: Tháng */}
        <div className="w-36">
          <PremiumSelect
            value={monthFilter}
            options={monthOptions}
            onChange={(val) => setMonthFilter(val)}
            placeholder="Tháng..."
          />
        </div>

        {/* Dropdown 4: Năm */}
        <div className="w-28">
          <PremiumSelect
            value={yearFilter}
            options={yearOptions}
            onChange={(val) => setYearFilter(val)}
            placeholder="Năm..."
          />
        </div>

        {/* Button 5: Bộ lọc nâng cao */}
        <button className="flex items-center gap-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Bộ lọc nâng cao</span>
        </button>
      </div>

      {/* Category Pills & View/Sort Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTabPill('all')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all',
              activeTabPill === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            )}
          >
            Tất cả ({totalCount.toLocaleString('vi-VN')})
          </button>
          <button
            onClick={() => setActiveTabPill('new')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTabPill === 'new'
                ? 'bg-primary text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            )}
          >
            Khách mới ({newCount.toLocaleString('vi-VN')})
          </button>
          <button
            onClick={() => setActiveTabPill('loyal')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTabPill === 'loyal'
                ? 'bg-primary text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            )}
          >
            Khách thân thiết ({loyalCount.toLocaleString('vi-VN')})
          </button>
          <button
            onClick={() => setActiveTabPill('vip')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTabPill === 'vip'
                ? 'bg-primary text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            )}
          >
            VIP ({vipCount.toLocaleString('vi-VN')})
          </button>
          <button
            onClick={() => setActiveTabPill('care')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTabPill === 'care'
                ? 'bg-primary text-white shadow-sm font-bold'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            )}
          >
            Cần chăm sóc ({careCount.toLocaleString('vi-VN')})
          </button>
        </div>

        {/* View Switcher & Sort */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-lg text-slate-600 transition',
                viewMode === 'list' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
              )}
              title="Danh sách"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-lg text-slate-600 transition',
                viewMode === 'grid' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
              )}
              title="Lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <div className="w-36">
            <PremiumSelect
              value={sortBy}
              options={sortOptions}
              onChange={(val) => setSortBy(val)}
              placeholder="Mới nhất"
            />
          </div>
        </div>
      </div>

      {/* Customer List Table / Cards */}
      <div className="space-y-3 mb-6">
        {isLoading && customers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
            <div
              className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-3"
            />
            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider">
              Đang tải danh sách khách hàng...
            </p>
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm">Không tìm thấy khách hàng phù hợp</p>
          </div>
        ) : (
          paginatedCustomers.map((customer, idx) => {
            const avatarUrl = AVATAR_SEEDS[idx % AVATAR_SEEDS.length];
            const isSelected = selectedIds.includes(customer.id);
            const isVip = isVipCustomer(customer);
            const isLoyal = isLoyalCustomer(customer);
            const isCare = isCareCustomer(customer);
            const bookingCount = getCustomerBookingCount(customer);
            const latestBooking = customer.bookings?.reduce<CustomerBookingSummary | null>(
              (latest, booking) => {
                if (!latest) return booking;
                return new Date(booking.created_at || 0).getTime() >
                  new Date(latest.created_at || 0).getTime()
                  ? booking
                  : latest;
              },
              null
            );
            const gender =
              customer.gender_baby === 'female'
                ? 'Nữ'
                : customer.gender_baby === 'male'
                  ? 'Nam'
                  : 'Chưa có giới tính';
            const location = customer.address || 'Chưa có địa chỉ';
            const serviceName =
              customer.package_name || latestBooking?.package_name || 'Chưa có dữ liệu';
            const lastVisitSource = latestBooking?.created_at ?? customer.created_at;
            const lastVisit = lastVisitSource
              ? new Date(lastVisitSource).toLocaleDateString('vi-VN')
              : 'Chưa có dữ liệu';
            const spendTotal = getCustomerSpendAmount(customer);
            const spendAmount =
              spendTotal === null
                ? 'Chưa có dữ liệu'
                : `${spendTotal.toLocaleString('vi-VN')}đ`;
            const points = customer.loyalty_points ?? null;
            const profileLabel = isVip
              ? 'VIP'
              : isLoyal
                ? 'Khách thân thiết'
                : isCare
                  ? 'Cần chăm sóc'
                  : isNewCustomer(customer)
                    ? 'Khách mới'
                    : 'Chưa phân nhóm';

            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={cn(
                  'group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                  isSelected && 'border-primary/40 bg-emerald-50/10'
                )}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(customer.id)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                  />

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    <img
                      src={avatarUrl}
                      alt={customer.name_mother || 'Khách hàng'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Customer Info */}
                  <div className="min-w-[180px] flex-1 lg:flex-initial">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {customer.name_mother || 'Khách hàng chưa đặt tên'}
                      </h3>
                      {isVip ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200/80">
                          <Crown className="w-3 h-3 text-amber-600 fill-amber-500" /> VIP
                        </span>
                      ) : isLoyal ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Khách thân thiết
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          Khách mới
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <span>{customer.phone || 'Chưa có SĐT'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {gender} · {location}
                    </p>
                  </div>

                  {/* Service Info */}
                  <div className="hidden md:block min-w-[170px]">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
                      <Scissors className="w-3.5 h-3.5 text-slate-400" />
                      <span>Dịch vụ thường dùng</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{serviceName}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400">Hồ sơ</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        {profileLabel}
                      </span>
                    </div>
                  </div>

                  {/* Last Visit */}
                  <div className="hidden xl:block min-w-[120px]">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Lần cuối</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{lastVisit}</p>
                    <p className="text-[11px] text-slate-400">
                      {bookingCount.toLocaleString('vi-VN')} booking
                    </p>
                  </div>

                  {/* Total Spend */}
                  <div className="hidden xl:block min-w-[130px]">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tổng chi tiêu</span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-900">{spendAmount}</p>
                  </div>

                  {/* Points */}
                  <div className="hidden lg:block min-w-[90px]">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>Điểm</span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-900">
                      {points === null ? 'Chưa có dữ liệu' : `${points} điểm`}
                    </p>
                  </div>
                </div>

                {/* Actions Right */}
                <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                  <button
                    onClick={() =>
                      router.push(`/dashboard/bookings?customer=${customer.name_mother}`)
                    }
                    className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Đặt lịch</span>
                  </button>

                  <button
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                    className="flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                  >
                    <span>Chi tiết</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(e, customer.id)}
                      className={cn(
                        'p-2 rounded-xl transition text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                        activeMenuId === customer.id && 'bg-slate-200 text-slate-900'
                      )}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === customer.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 6 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden p-1.5"
                        >
                          <button
                            onClick={() => handleEdit(customer)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-primary rounded-xl transition"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={() => handleZalo(customer.phone)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-primary rounded-xl transition"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-500" />
                            Gửi Zalo
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                            Xóa hồ sơ
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs text-slate-500 font-medium">
        <div>
          Hiển thị{' '}
          <span className="font-bold text-slate-800">
            {startIndex} - {endIndex}
          </span>{' '}
          trong <span className="font-bold text-slate-800">{totalCount.toLocaleString('vi-VN')}</span>{' '}
          khách hàng
        </div>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                'w-8 h-8 rounded-xl font-bold transition text-xs',
                currentPage === page
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              {page}
            </button>
          ))}

          {totalPages > 5 && <span className="px-1 text-slate-400">...</span>}
          {totalPages > 5 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={cn(
                'w-8 h-8 rounded-xl font-bold transition text-xs',
                currentPage === totalPages
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              {totalPages}
            </button>
          )}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 text-xs outline-none focus:border-primary"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
          </select>
        </div>
      </div>
    </div>
  );
}
