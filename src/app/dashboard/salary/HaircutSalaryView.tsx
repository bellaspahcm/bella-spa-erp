'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  Banknote,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Plus,
  RefreshCw,
  Clock,
  FileSpreadsheet,
  Settings,
  Calendar,
  Layers,
  ArrowUpRight,
  Check,
  AlertCircle,
  HelpCircle,
  X,
  FileText
} from 'lucide-react';

export interface HaircutSalaryDetail {
  id?: string;
  name: string;
  role?: string;
  daysWorked?: string;
  totalSessions?: number;
  baseSalary?: string;
  commission?: string;
  kpiBonus?: string;
  totalIncome?: string;
  totalIncomeNum?: number;
  status?: string;
  statusLabel?: string;
  hasIssue?: boolean;
}

interface HaircutSalaryViewProps {
  onPublishAll?: () => void;
  onFinalizeAll?: () => void;
  onEditKtv?: (ktv: HaircutSalaryDetail) => void;
  onFixAttendance?: (ktv: HaircutSalaryDetail) => void;
}

const KTV_AVATARS: Record<string, string> = {
  'Nguyễn Minh': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'Trần Thị Linh': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'Lê Quốc Nam': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  'Phạm Thu Hà': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'Vũ Hoàng Anh': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
  'Đỗ Thị Nga': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
};

export function HaircutSalaryView({
  onPublishAll,
  onFinalizeAll,
  onEditKtv,
  onFixAttendance,
}: HaircutSalaryViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'payroll' | 'matrix' | 'attendance' | 'history' | 'rules'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedKtvDetail, setSelectedKtvDetail] = useState<HaircutSalaryDetail | null>(null);

  const statusOptions = [
    { value: 'Tất cả trạng thái', label: 'Tất cả trạng thái' },
    { value: 'Đủ dữ liệu', label: 'Đủ dữ liệu' },
    { value: 'Thiếu dữ liệu', label: 'Thiếu dữ liệu' },
  ];

  // Payroll Table Data matching target screenshot
  const salaryList = [
    {
      id: 'sal-1',
      name: 'Nguyễn Minh',
      role: 'Thợ Chính 1',
      daysWorked: '26/26',
      totalSessions: 68,
      baseSalary: '8.000.000đ',
      commission: '6.800.000đ',
      kpiBonus: '1.500.000đ',
      totalIncome: '16.300.000đ',
      totalIncomeNum: 16300000,
      status: 'ready',
      statusLabel: 'Đủ dữ liệu',
      hasIssue: false,
    },
    {
      id: 'sal-2',
      name: 'Trần Thị Linh',
      role: 'Thợ Chính 2',
      daysWorked: '25/26',
      totalSessions: 61,
      baseSalary: '8.000.000đ',
      commission: '6.100.000đ',
      kpiBonus: '1.200.000đ',
      totalIncome: '15.300.000đ',
      totalIncomeNum: 15300000,
      status: 'ready',
      statusLabel: 'Đủ dữ liệu',
      hasIssue: false,
    },
    {
      id: 'sal-3',
      name: 'Lê Quốc Nam',
      role: 'Thợ Phụ 1',
      daysWorked: '24/26',
      totalSessions: 57,
      baseSalary: '7.500.000đ',
      commission: '5.700.000đ',
      kpiBonus: '900.000đ',
      totalIncome: '14.100.000đ',
      totalIncomeNum: 14100000,
      status: 'ready',
      statusLabel: 'Đủ dữ liệu',
      hasIssue: false,
    },
    {
      id: 'sal-4',
      name: 'Phạm Thu Hà',
      role: 'Thợ Phụ 2',
      daysWorked: '0/26',
      totalSessions: 0,
      baseSalary: '7.000.000đ',
      commission: '0đ',
      kpiBonus: '0đ',
      totalIncome: '0đ',
      totalIncomeNum: 0,
      status: 'issue',
      statusLabel: 'Thiếu dữ liệu',
      issueNote: 'Không có dữ liệu chấm công tháng 09/2026',
      hasIssue: true,
    },
    {
      id: 'sal-5',
      name: 'Vũ Hoàng Anh',
      role: 'Thợ Chính 3',
      daysWorked: '0/26',
      totalSessions: 0,
      baseSalary: '8.000.000đ',
      commission: '0đ',
      kpiBonus: '0đ',
      totalIncome: '0đ',
      totalIncomeNum: 0,
      status: 'issue',
      statusLabel: 'Thiếu dữ liệu',
      issueNote: 'Không có dữ liệu chấm công tháng 09/2026',
      hasIssue: true,
    },
    {
      id: 'sal-6',
      name: 'Đỗ Thị Nga',
      role: 'Thợ Phụ 3',
      daysWorked: '0/26',
      totalSessions: 0,
      baseSalary: '6.500.000đ',
      commission: '0đ',
      kpiBonus: '0đ',
      totalIncome: '0đ',
      totalIncomeNum: 0,
      status: 'issue',
      statusLabel: 'Thiếu dữ liệu',
      issueNote: 'Không có dữ liệu chấm công tháng 09/2026',
      hasIssue: true,
    },
  ];

  // Action Issues Sidebar List
  const pendingIssues = [
    {
      id: 'issue-1',
      name: 'Phạm Thu Hà',
      note: 'Không có dữ liệu chấm công tháng 09/2026',
      avatar: KTV_AVATARS['Phạm Thu Hà'],
    },
    {
      id: 'issue-2',
      name: 'Vũ Hoàng Anh',
      note: 'Không có dữ liệu chấm công tháng 09/2026',
      avatar: KTV_AVATARS['Vũ Hoàng Anh'],
    },
    {
      id: 'issue-3',
      name: 'Đỗ Thị Nga',
      note: 'Không có dữ liệu chấm công tháng 09/2026',
      avatar: KTV_AVATARS['Đỗ Thị Nga'],
    },
  ];

  // Audit Logs Sidebar List
  const activityLogs = [
    {
      id: 'log-1',
      title: 'Tính lương tạm tính',
      sub: 'Kỳ 09/2026 • Haircut Shop Admin',
      time: '10 phút trước',
      tone: 'emerald',
    },
    {
      id: 'log-2',
      title: 'Cập nhật chấm công',
      sub: 'Nguyễn Minh • Trần Thị Mai',
      time: '2 giờ trước',
      tone: 'blue',
    },
    {
      id: 'log-3',
      title: 'Xuất báo cáo lương',
      sub: 'Kỳ 08/2026 • Haircut Shop Admin',
      time: '1 ngày trước',
      tone: 'emerald',
    },
    {
      id: 'log-4',
      title: 'Chốt lương',
      sub: 'Kỳ 08/2026 • Haircut Shop Admin',
      time: '05/08/2026 10:24',
      tone: 'purple',
    },
  ];

  const filteredSalaries = useMemo(() => {
    return salaryList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        [item.name, item.role].some((field) =>
          field.toLowerCase().includes(q)
        );

      let matchesStatus = true;
      if (statusFilter !== 'Tất cả trạng thái') {
        if (statusFilter === 'Đủ dữ liệu') matchesStatus = item.status === 'ready';
        else if (statusFilter === 'Thiếu dữ liệu') matchesStatus = item.status === 'issue';
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const totalCount = 12;
  const paginatedSalaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSalaries.slice(start, start + pageSize);
  }, [filteredSalaries, currentPage, pageSize]);

  return (
    <div
      id="haircut-salary-container"
      className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 relative min-h-screen text-slate-800"
      onClick={() => setActiveMenuId(null)}
    >
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-serif">
              Lương Kỹ thuật viên
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200/80 text-slate-700 border border-slate-300/60">
              Kỳ lương: 09/2026
            </span>
          </div>
          <p className="text-slate-500 font-medium text-xs sm:text-sm">
            Quản lý thu nhập, hiệu suất và chốt lương của kỹ thuật viên
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PremiumExportButton />

          <button
            onClick={() => onPublishAll?.()}
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 font-bold text-xs sm:text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <Send className="w-4 h-4 shrink-0 text-slate-500" />
            <span>Gửi đối soát</span>
          </button>

          <button
            onClick={() => onFinalizeAll?.()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-xs sm:text-sm text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Chốt lương</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Tổng quỹ lương */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Tổng quỹ lương</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                86.500.000đ
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                ↑ 12%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">So với kỳ 08/2026</p>
          </div>
        </div>

        {/* Card 2: Kỹ thuật viên */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Kỹ thuật viên</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                12
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                ↑ 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Đang làm việc</p>
          </div>
        </div>

        {/* Card 3: Đủ dữ liệu */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Đủ dữ liệu</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                9
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                75%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Sẵn sàng đối soát</p>
          </div>
        </div>

        {/* Card 4: Cần xử lý */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Cần xử lý</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                3
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                25%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Chưa đủ dữ liệu</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'overview'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Tổng quan</span>
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'payroll'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Bảng lương</span>
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'matrix'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Đối soát dịch vụ</span>
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'attendance'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>Chấm công</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'history'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Lịch sử kỳ lương</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'rules'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Settings className="w-4 h-4" />
          <span>Thiết lập công thức</span>
        </button>
      </div>

      {/* Streamlined Operational Alert Banner */}
      <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 mb-5 flex items-center justify-between text-xs font-bold text-rose-900">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0 font-black text-xs">
            !
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs">
              3 kỹ thuật viên chưa đủ dữ liệu để tính lương
            </h4>
            <p className="text-slate-500 font-medium text-[11px] mt-0.5">
              Vui lòng bổ sung dữ liệu chấm công hoặc kiểm tra lịch dịch vụ trước khi chốt lương.
            </p>
          </div>
        </div>
        <button className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 font-extrabold text-xs hover:bg-rose-50 transition flex items-center gap-1 shadow-xs">
          <span>Xem chi tiết</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Grid Section: Table (Left ~75%) + Right Sidebars (~25%) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-6">
        {/* Left Column (3 cols): Payroll Table Panel */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          {/* Subheader & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Bảng lương tạm tính</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Đang chờ xử lý
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Dữ liệu được tính dựa trên công thức lương hiện hành. Vui lòng đối soát trước khi chốt lương.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Tìm kỹ thuật viên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl outline-none text-xs font-medium text-slate-700 focus:border-primary"
                />
              </div>
              <div className="w-40">
                <PremiumSelect
                  value={statusFilter}
                  options={statusOptions}
                  onChange={(val) => setStatusFilter(val)}
                  placeholder="Tất cả trạng thái"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap">
                  <th className="p-3 pl-4 whitespace-nowrap min-w-[170px]">Kỹ thuật viên</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[100px]">Ngày công (/ 26)</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[80px]">Tổng buổi</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[110px]">Lương cứng</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[130px]">Hoa hồng dịch vụ</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[130px]">Thưởng hiệu suất</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[130px]">Tổng thu nhập</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[110px]">Trạng thái</th>
                  <th className="p-3 text-right pr-4 whitespace-nowrap min-w-[110px]">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 whitespace-nowrap">
                {paginatedSalaries.map((item) => {
                  const isReady = item.status === 'ready';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      {/* KTV Name & Avatar */}
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5 min-w-[170px]">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <img
                              src={
                                KTV_AVATARS[item.name] ||
                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
                              }
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 text-xs truncate">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">{item.role}</p>
                          </div>
                        </div>
                      </td>

                      {/* Ngày công */}
                      <td className="p-3 text-center font-bold font-mono whitespace-nowrap">
                        <span className={cn(isReady ? 'text-emerald-600' : 'text-rose-600')}>
                          {item.daysWorked}
                        </span>
                      </td>

                      {/* Tổng buổi */}
                      <td className="p-3 text-center font-extrabold text-slate-900 whitespace-nowrap">
                        {item.totalSessions}
                      </td>

                      {/* Lương cứng */}
                      <td className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        {item.baseSalary}
                      </td>

                      {/* Hoa hồng dịch vụ */}
                      <td className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        {item.commission}
                      </td>

                      {/* Thưởng hiệu suất */}
                      <td className="p-3 text-right font-medium text-slate-600 whitespace-nowrap">
                        {item.kpiBonus}
                      </td>

                      {/* TỔNG THU NHẬP (Nổi bật) */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="font-black text-emerald-600 text-sm">
                          {item.totalIncome}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0',
                            isReady
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              isReady ? 'bg-emerald-500' : 'bg-rose-500'
                            )}
                          />
                          {item.statusLabel}
                        </span>
                      </td>

                      {/* Hành động */}
                      <td className="p-3 text-right pr-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isReady ? (
                            <button
                              onClick={() => setSelectedKtvDetail(item)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-[11px] text-slate-700 transition whitespace-nowrap"
                            >
                              Chi tiết
                            </button>
                          ) : (
                            <button
                              onClick={() => onFixAttendance?.(item)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-[11px] hover:opacity-90 transition shadow-xs whitespace-nowrap"
                            >
                              Xử lý
                            </button>
                          )}

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            <AnimatePresence>
                              {activeMenuId === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                                  className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden p-1 text-xs font-bold text-slate-700"
                                >
                                  <button
                                    onClick={() => onEditKtv?.(item)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg transition"
                                  >
                                    Sửa thông tin
                                  </button>
                                  <button
                                    onClick={() => setSelectedKtvDetail(item)}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg transition"
                                  >
                                    Xem bảng lương
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Summary Total Row Footer */}
              <tfoot>
                <tr className="bg-emerald-50/50 border-t-2 border-emerald-100 font-extrabold text-slate-900 text-xs whitespace-nowrap">
                  <td className="p-3 pl-4 text-emerald-800 whitespace-nowrap font-bold">Tổng cộng (tạm tính)</td>
                  <td className="p-3 text-center text-emerald-800 font-mono whitespace-nowrap">75/156</td>
                  <td className="p-3 text-center text-emerald-800 font-mono whitespace-nowrap">186</td>
                  <td className="p-3 text-right whitespace-nowrap">39.000.000đ</td>
                  <td className="p-3 text-right whitespace-nowrap">18.600.000đ</td>
                  <td className="p-3 text-right whitespace-nowrap">3.600.000đ</td>
                  <td className="p-3 text-right text-emerald-700 text-sm font-black whitespace-nowrap">
                    61.200.000đ
                  </td>
                  <td className="p-3 whitespace-nowrap" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold">
            <span>Hiển thị 1 - 6 trong 12 kỹ thuật viên</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-7 h-7 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center">
                1
              </button>
              <button className="w-7 h-7 rounded-lg hover:bg-slate-100 font-bold text-xs flex items-center justify-center text-slate-600">
                2
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Vấn đề cần xử lý + Lịch sử thao tác */}
        <div className="space-y-5">
          {/* Panel 1: Vấn đề cần xử lý (3) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Vấn đề cần xử lý ({pendingIssues.length})
                </h3>
              </div>
              <button className="text-[11px] font-bold text-primary hover:underline">
                Xem tất cả &gt;
              </button>
            </div>

            <div className="space-y-3">
              {pendingIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                      <img
                        src={issue.avatar}
                        alt={issue.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-[11px] truncate">
                        {issue.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">{issue.note}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onFixAttendance?.(issue)}
                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-[10px] text-slate-700 shrink-0 shadow-xs"
                  >
                    Bổ sung
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: Lịch sử thao tác */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Lịch sử thao tác
              </h3>
              <button className="text-[11px] font-bold text-primary hover:underline">
                Xem tất cả &gt;
              </button>
            </div>

            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 font-bold',
                      log.tone === 'emerald' && 'bg-emerald-500',
                      log.tone === 'blue' && 'bg-blue-500',
                      log.tone === 'purple' && 'bg-purple-500'
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-[11px] truncate">
                        {log.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">{log.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{log.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal for Selected KTV */}
      <AnimatePresence>
        {selectedKtvDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedKtvDetail(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden p-6 z-10"
            >
              <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
                    <img
                      src={KTV_AVATARS[selectedKtvDetail.name]}
                      alt={selectedKtvDetail.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {selectedKtvDetail.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedKtvDetail.role} • Kỳ lương 09/2026
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedKtvDetail(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Số ngày công thực tế:</span>
                  <span className="font-bold text-slate-900">{selectedKtvDetail.daysWorked}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Số lượt dịch vụ hoàn thành:</span>
                  <span className="font-bold text-slate-900">{selectedKtvDetail.totalSessions} lượt</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Lương cứng hợp đồng:</span>
                  <span className="font-bold text-slate-900">{selectedKtvDetail.baseSalary}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Hoa hồng dịch vụ (POS):</span>
                  <span className="font-bold text-slate-900">{selectedKtvDetail.commission}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Thưởng hiệu suất KPI:</span>
                  <span className="font-bold text-slate-900">{selectedKtvDetail.kpiBonus}</span>
                </div>
                <div className="flex justify-between py-2 bg-emerald-50 rounded-xl px-3 mt-2">
                  <span className="font-extrabold text-emerald-900">Tổng thu nhập tạm tính:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {selectedKtvDetail.totalIncome}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedKtvDetail(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setSelectedKtvDetail(null);
                    onEditKtv?.(selectedKtvDetail);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:opacity-90 shadow-xs"
                >
                  Điều chỉnh lương
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
