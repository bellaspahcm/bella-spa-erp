/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  Package,
  Hourglass,
  Calendar,
  Clock,
  Search,
  Filter,
  Plus,
  Crown,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  RotateCw,
  CheckCircle2,
  CalendarCheck,
  UserCheck,
  Scissors
} from 'lucide-react';
import type { SessionBooking } from './types';

interface HaircutPackagesViewProps {
  sessions: SessionBooking[];
  isLoading?: boolean;
  isSyncing?: boolean;
}

const HAIRCUT_PACKAGES_WRITE_GAP_MESSAGE =
  'Gói Haircut đang hiển thị dữ liệu tạm. Chưa thể sử dụng lượt, đặt lại gói hoặc mở chi tiết cho đến khi mỗi dòng có booking_id canonical.';

const CUSTOMER_AVATARS: Record<string, string> = {
  'Nguyễn Hoàng Anh': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
  'Trần Thị Mai': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
  'Lê Quốc Bảo': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
  'Phạm Thu Hà': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'Vũ Minh Đức': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
};

// Hardcoded package list data matching the target UI screenshot (Image 4)
const PACKAGES_LIST = [
  {
    id: 'pkg-1',
    customerName: 'Nguyễn Hoàng Anh',
    customerTag: 'VIP',
    phone: '0909 123 456',
    demographics: 'Nam • 28 tuổi • Quận 2',
    packageName: 'Gói Chăm Sóc Tóc Cao Cấp',
    packageServices: 'Cắt + Gội + Styling',
    totalSessions: 10,
    completedSessions: 4,
    status: 'active',
    statusLabel: 'ĐANG HOẠT ĐỘNG',
    purchaseDate: '24/08/2026',
    expiryDate: '24/12/2026',
    daysLeft: 'Còn 102 ngày',
    progressPercent: 40,
    avatar: CUSTOMER_AVATARS['Nguyễn Hoàng Anh'],
  },
  {
    id: 'pkg-2',
    customerName: 'Trần Thị Mai',
    customerTag: 'Khách thân thiết',
    phone: '0988 456 789',
    demographics: 'Nữ • 26 tuổi • Quận 7',
    packageName: 'Gói Phục Hồi Tóc',
    packageServices: 'Phục hồi + Dưỡng',
    totalSessions: 8,
    completedSessions: 6,
    status: 'active',
    statusLabel: 'ĐANG HOẠT ĐỘNG',
    purchaseDate: '12/07/2026',
    expiryDate: '12/11/2026',
    daysLeft: 'Còn 52 ngày',
    progressPercent: 75,
    avatar: CUSTOMER_AVATARS['Trần Thị Mai'],
  },
  {
    id: 'pkg-3',
    customerName: 'Lê Quốc Bảo',
    customerTag: 'Sắp hết lượt',
    phone: '0903 789 456',
    demographics: 'Nam • 24 tuổi • Thủ Đức',
    packageName: 'Gói Nhuộm Tóc Nam',
    packageServices: 'Nhuộm + Chăm sóc',
    totalSessions: 5,
    completedSessions: 4,
    status: 'active',
    statusLabel: 'ĐANG HOẠT ĐỘNG',
    purchaseDate: '05/08/2026',
    expiryDate: '05/11/2026',
    daysLeft: 'Còn 45 ngày',
    progressPercent: 80,
    avatar: CUSTOMER_AVATARS['Lê Quốc Bảo'],
  },
  {
    id: 'pkg-4',
    customerName: 'Phạm Thu Hà',
    customerTag: 'Khách mới',
    phone: '0908 111 222',
    demographics: 'Nam • 21 tuổi • Quận 1',
    packageName: 'Gói Cắt Gội Massage',
    packageServices: 'Cắt + Gội + Massage',
    totalSessions: 5,
    completedSessions: 5,
    status: 'completed',
    statusLabel: 'ĐÃ HOÀN THÀNH',
    purchaseDate: '10/06/2026',
    expiryDate: '10/10/2026',
    daysLeft: 'Đã hết hạn',
    progressPercent: 100,
    avatar: CUSTOMER_AVATARS['Phạm Thu Hà'],
  },
  {
    id: 'pkg-5',
    customerName: 'Vũ Minh Đức',
    customerTag: 'VIP',
    phone: '0906 334 455',
    demographics: 'Nam • 27 tuổi • Bình Thạnh',
    packageName: 'Gói Uốn & Tạo Kiểu',
    packageServices: 'Uốn + Styling',
    totalSessions: 6,
    completedSessions: 2,
    status: 'active',
    statusLabel: 'ĐANG HOẠT ĐỘNG',
    purchaseDate: '18/09/2026',
    expiryDate: '18/03/2027',
    daysLeft: 'Còn 175 ngày',
    progressPercent: 33,
    avatar: CUSTOMER_AVATARS['Vũ Minh Đức'],
  },
];

export function HaircutPackagesView({
  sessions,
  isLoading,
  isSyncing,
}: HaircutPackagesViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [packageTypeFilter, setPackageTypeFilter] = useState('Loại gói');
  const [timeFilter, setTimeFilter] = useState('Thời gian');
  const [ktvFilter, setKtvFilter] = useState('Kỹ thuật viên');
  const [branchFilter, setBranchFilter] = useState('Chi nhánh');
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleUnavailablePackageAction = () => {
    window.alert(HAIRCUT_PACKAGES_WRITE_GAP_MESSAGE);
  };

  const statusOptions = [
    { value: 'Tất cả trạng thái', label: 'Tất cả trạng thái' },
    { value: 'Đang hoạt động', label: 'Đang hoạt động' },
    { value: 'Sắp hết lượt', label: 'Sắp hết lượt' },
    { value: 'Sắp hết hạn', label: 'Sắp hết hạn' },
    { value: 'Đã hoàn thành', label: 'Đã hoàn thành' },
    { value: 'Đã hết hạn', label: 'Đã hết hạn' },
  ];

  const packageTypeOptions = [
    { value: 'Loại gói', label: 'Loại gói' },
    { value: 'Combo', label: 'Combo' },
    { value: 'Membership', label: 'Membership' },
    { value: 'Thẻ lượt', label: 'Thẻ lượt' },
  ];

  const timeOptions = [
    { value: 'Thời gian', label: 'Thời gian' },
    { value: 'Tháng này', label: 'Tháng này' },
    { value: 'Tháng trước', label: 'Tháng trước' },
    { value: '3 tháng tới', label: '3 tháng tới' },
  ];

  const ktvOptions = [
    { value: 'Kỹ thuật viên', label: 'Kỹ thuật viên' },
    { value: 'Minh Nguyễn', label: 'Minh Nguyễn' },
    { value: 'Linh Trần', label: 'Linh Trần' },
    { value: 'Nam Lê', label: 'Nam Lê' },
  ];

  const branchOptions = [
    { value: 'Chi nhánh', label: 'Chi nhánh' },
    { value: 'Haircut Shop HQ', label: 'Haircut Shop HQ' },
  ];



  const filteredPackages = useMemo(() => {
    return PACKAGES_LIST.filter((pkg) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        [pkg.customerName, pkg.phone, pkg.packageName, pkg.packageServices].some((field) =>
          field.toLowerCase().includes(q)
        );

      let matchesStatus = true;
      if (statusFilter !== 'Tất cả trạng thái') {
        if (statusFilter === 'Đang hoạt động') matchesStatus = pkg.status === 'active';
        else if (statusFilter === 'Sắp hết lượt') matchesStatus = pkg.customerTag === 'Sắp hết lượt';
        else if (statusFilter === 'Đã hoàn thành') matchesStatus = pkg.status === 'completed';
        else if (statusFilter === 'Đã hết hạn') matchesStatus = pkg.daysLeft === 'Đã hết hạn';
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const totalCount = 1284;
  const totalPages = Math.ceil(filteredPackages.length / pageSize) || 1;
  const paginatedPackages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPackages.slice(start, start + pageSize);
  }, [filteredPackages, currentPage, pageSize]);

  return (
    <div
      id="haircut-packages-container"
      className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 relative min-h-screen text-slate-800"
      onClick={() => setActiveMenuId(null)}
    >
      {/* Top Progress Line */}
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
            Gói & Membership
          </h1>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
            Quản lý gói dịch vụ, lượt sử dụng và quyền lợi khách hàng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box in Header */}
          <div className="relative w-64 hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm khách hàng, SĐT, tên gói..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-medium text-slate-700 focus:border-primary shadow-xs"
            />
          </div>

          <PremiumExportButton />

          {/* CTA Add Package Button */}
          <button
            onClick={handleUnavailablePackageAction}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-xs sm:text-sm text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Bán gói mới</span>
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm">
        {HAIRCUT_PACKAGES_WRITE_GAP_MESSAGE}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Gói đang hoạt động */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Gói đang hoạt động</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {totalCount.toLocaleString('vi-VN')}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                ↑ 12%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">+138 gói so với tháng trước</p>
          </div>
        </div>

        {/* Card 2: Sắp hết lượt */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Hourglass className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Sắp hết lượt</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                326
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                ↑ 8%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Dưới 20% lượt còn lại</p>
          </div>
        </div>

        {/* Card 3: Sắp hết hạn */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Sắp hết hạn</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                42
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                ↑ 16%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Trong 30 ngày tới</p>
          </div>
        </div>

        {/* Card 4: Đã hết hạn */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Đã hết hạn</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                18
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Cần liên hệ chăm sóc</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="w-44">
            <PremiumSelect
              value={statusFilter}
              options={statusOptions}
              onChange={(val) => setStatusFilter(val)}
              placeholder="Tất cả trạng thái"
            />
          </div>
          <div className="w-36">
            <PremiumSelect
              value={packageTypeFilter}
              options={packageTypeOptions}
              onChange={(val) => setPackageTypeFilter(val)}
              placeholder="Loại gói"
            />
          </div>
          <div className="w-36">
            <PremiumSelect
              value={timeFilter}
              options={timeOptions}
              onChange={(val) => setTimeFilter(val)}
              placeholder="Thời gian"
            />
          </div>
          <div className="w-40">
            <PremiumSelect
              value={ktvFilter}
              options={ktvOptions}
              onChange={(val) => setKtvFilter(val)}
              placeholder="Kỹ thuật viên"
            />
          </div>
          <div className="w-40">
            <PremiumSelect
              value={branchFilter}
              options={branchOptions}
              onChange={(val) => setBranchFilter(val)}
              placeholder="Chi nhánh"
            />
          </div>
        </div>

        {/* View Switcher Right */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition',
              viewMode === 'list' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Danh sách
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition',
              viewMode === 'stats' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Thống kê
          </button>
        </div>
      </div>

      {/* Package List Items */}
      <div className="space-y-3 mb-6">
        {paginatedPackages.map((pkg) => {
          const isVip = pkg.customerTag === 'VIP';
          const isLoyal = pkg.customerTag === 'Khách thân thiết';
          const isCompleted = pkg.status === 'completed';
          const isExpired = pkg.daysLeft === 'Đã hết hạn';

          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4"
            >
              {/* Customer Column */}
              <div className="flex items-center gap-3.5 min-w-[240px]">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img src={pkg.avatar} alt={pkg.customerName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{pkg.customerName}</h3>
                    {isVip ? (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                        <Crown className="w-3 h-3 text-amber-600 fill-amber-500" /> VIP
                      </span>
                    ) : isLoyal ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Khách thân thiết
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                        {pkg.customerTag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500">📞 {pkg.phone}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{pkg.demographics}</p>
                </div>
              </div>

              {/* Package Details & Progress Bar */}
              <div className="flex-1 min-w-[280px]">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">{pkg.packageName}</h4>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border',
                      isCompleted
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}
                  >
                    {pkg.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-1.5">
                  {pkg.packageServices} • {pkg.totalSessions} lượt
                </p>

                {/* Progress Bar */}
                <div className="w-full max-w-md">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all rounded-full',
                        isCompleted
                          ? 'bg-slate-400'
                          : pkg.progressPercent >= 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      )}
                      style={{ width: `${pkg.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-1">
                    <span>
                      Đã dùng {pkg.completedSessions}/{pkg.totalSessions} lượt
                    </span>
                    <span>{pkg.progressPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-6 text-xs min-w-[220px]">
                <div>
                  <div className="flex items-center gap-1 text-slate-400 text-[11px] mb-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Ngày mua</span>
                  </div>
                  <p className="font-bold text-slate-800">{pkg.purchaseDate}</p>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-slate-400 text-[11px] mb-0.5">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Hết hạn</span>
                  </div>
                  <p className="font-bold text-slate-800">{pkg.expiryDate}</p>
                  <p
                    className={cn(
                      'text-[11px] font-bold mt-0.5',
                      isExpired ? 'text-rose-600' : 'text-emerald-600'
                    )}
                  >
                    {pkg.daysLeft}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {isCompleted ? (
                  <button
                    onClick={handleUnavailablePackageAction}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Đặt lại gói</span>
                  </button>
                ) : (
                  <button
                    onClick={handleUnavailablePackageAction}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition border border-emerald-200/80"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Sử dụng lượt</span>
                  </button>
                )}

                <button
                  onClick={handleUnavailablePackageAction}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
                >
                  Chi tiết
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === pkg.id ? null : pkg.id);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {activeMenuId === pkg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden p-1.5 text-xs font-bold text-slate-700"
                      >
                        <button
                          onClick={handleUnavailablePackageAction}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition"
                        >
                          Đặt lịch hẹn
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/customers`)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition"
                        >
                          Xem hồ sơ khách
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

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs text-slate-500 font-medium">
        <div>
          Hiển thị <span className="font-bold text-slate-800">1 - 5</span> trong{' '}
          <span className="font-bold text-slate-800">{totalCount.toLocaleString('vi-VN')}</span> gói
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

          {[1, 2, 3, 4, 5].map((page) => (
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

          <span className="px-1 text-slate-400">...</span>
          <button
            onClick={() => setCurrentPage(257)}
            className="w-8 h-8 rounded-xl font-bold transition text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            257
          </button>

          <button
            onClick={() => setCurrentPage((p) => Math.min(257, p + 1))}
            disabled={currentPage === 257}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 text-xs outline-none focus:border-primary"
          >
            <option value={5}>5 / trang</option>
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
          </select>
        </div>
      </div>
    </div>
  );
}
