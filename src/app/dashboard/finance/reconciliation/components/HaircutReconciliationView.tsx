'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  RefreshCw,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Download,
  Filter,
  FileSpreadsheet,
  X,
  Building2,
  CreditCard,
  QrCode,
  ShieldCheck,
  UserCheck,
  Phone,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatCurrency } from '@bella/shared';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '../types';

interface GroupedCustomerDebt {
  id: string;
  customerName: string;
  phone: string;
  avatarBg: string;
  avatarText: string;
  lastVisit: string;
  itemCount: number;
  totalPrice: number;
  totalPaid: number;
  remainingDebt: number;
  maxAgeDays: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
  branch: string;
  items: Array<{
    id: string;
    serviceName: string;
    price: number;
    paid: number;
    debt: number;
    date: string;
    ageDays: number;
    lifecycleState: 'delivered' | 'invoiced';
  }>;
}

const MOCK_CUSTOMER_DEBTS: GroupedCustomerDebt[] = [
  {
    id: 'cust-19',
    customerName: 'Nguyễn Hoàng Anh',
    phone: '0909 123 456',
    avatarBg: 'bg-emerald-100 text-emerald-700',
    avatarText: 'NH',
    lastVisit: '20/09/2026',
    itemCount: 3,
    totalPrice: 850000,
    totalPaid: 300000,
    remainingDebt: 550000,
    maxAgeDays: 18,
    status: 'overdue',
    branch: 'Chi nhánh Quận 1 - Nguyễn Trãi',
    items: [
      { id: 'b-101', serviceName: 'Uốn tóc nam Texture Powder', price: 300000, paid: 0, debt: 300000, date: '07/09/2026', ageDays: 18, lifecycleState: 'delivered' },
      { id: 'b-102', serviceName: 'Nhuộm tóc nam Hàn Quốc', price: 250000, paid: 0, debt: 250000, date: '12/09/2026', ageDays: 13, lifecycleState: 'delivered' },
      { id: 'b-103', serviceName: 'Combo Cắt + Styling Pomade', price: 300000, paid: 300000, debt: 0, date: '20/09/2026', ageDays: 5, lifecycleState: 'delivered' }
    ]
  },
  {
    id: 'cust-20',
    customerName: 'Trần Thị Mai',
    phone: '0912 345 678',
    avatarBg: 'bg-amber-100 text-amber-700',
    avatarText: 'TM',
    lastVisit: '18/09/2026',
    itemCount: 2,
    totalPrice: 600000,
    totalPaid: 0,
    remainingDebt: 600000,
    maxAgeDays: 12,
    status: 'overdue',
    branch: 'Chi nhánh Quận 3 - Võ Văn Tần',
    items: [
      { id: 'b-104', serviceName: 'Tẩy + Nhuộm bạch kim', price: 400000, paid: 0, debt: 400000, date: '13/09/2026', ageDays: 12, lifecycleState: 'delivered' },
      { id: 'b-105', serviceName: 'Phục hồi Keratin cao cấp', price: 200000, paid: 0, debt: 200000, date: '18/09/2026', ageDays: 7, lifecycleState: 'delivered' }
    ]
  },
  {
    id: 'cust-21',
    customerName: 'Lê Quốc Trung',
    phone: '0987 654 321',
    avatarBg: 'bg-indigo-100 text-indigo-700',
    avatarText: 'LT',
    lastVisit: '15/09/2026',
    itemCount: 1,
    totalPrice: 300000,
    totalPaid: 0,
    remainingDebt: 300000,
    maxAgeDays: 8,
    status: 'due_soon',
    branch: 'Chi nhánh Quận 1 - Nguyễn Trãi',
    items: [
      { id: 'b-106', serviceName: 'Combo Cắt Tóc + Gội Massage Headspa', price: 300000, paid: 0, debt: 300000, date: '17/09/2026', ageDays: 8, lifecycleState: 'delivered' }
    ]
  },
  {
    id: 'cust-22',
    customerName: 'Phạm Thu Hà',
    phone: '0966 111 222',
    avatarBg: 'bg-teal-100 text-teal-700',
    avatarText: 'PH',
    lastVisit: '12/09/2026',
    itemCount: 4,
    totalPrice: 1200000,
    totalPaid: 400000,
    remainingDebt: 800000,
    maxAgeDays: 5,
    status: 'upcoming',
    branch: 'Chi nhánh Bình Thạnh - Điện Biên Phủ',
    items: [
      { id: 'b-107', serviceName: 'Duỗi uốn máy Ombre', price: 500000, paid: 200000, debt: 300000, date: '20/09/2026', ageDays: 5, lifecycleState: 'delivered' },
      { id: 'b-108', serviceName: 'Hấp dầu Collagen sinh học', price: 300000, paid: 100000, debt: 200000, date: '21/09/2026', ageDays: 4, lifecycleState: 'delivered' },
      { id: 'b-109', serviceName: 'Bộ gội xả dưỡng phục hồi', price: 400000, paid: 100000, debt: 300000, date: '22/09/2026', ageDays: 3, lifecycleState: 'delivered' }
    ]
  },
  {
    id: 'cust-23',
    customerName: 'Vũ Minh Quân',
    phone: '0933 222 444',
    avatarBg: 'bg-rose-100 text-rose-700',
    avatarText: 'VQ',
    lastVisit: '10/09/2026',
    itemCount: 1,
    totalPrice: 250000,
    totalPaid: 0,
    remainingDebt: 250000,
    maxAgeDays: 3,
    status: 'upcoming',
    branch: 'Chi nhánh Quận 1 - Nguyễn Trãi',
    items: [
      { id: 'b-110', serviceName: 'Cắt tóc nam Fade + Cạo râu Pro', price: 250000, paid: 0, debt: 250000, date: '22/09/2026', ageDays: 3, lifecycleState: 'delivered' }
    ]
  },
  {
    id: 'cust-24',
    customerName: 'Đỗ Thị Nga',
    phone: '0901 888 999',
    avatarBg: 'bg-purple-100 text-purple-700',
    avatarText: 'DN',
    lastVisit: '05/09/2026',
    itemCount: 2,
    totalPrice: 700000,
    totalPaid: 200000,
    remainingDebt: 500000,
    maxAgeDays: 1,
    status: 'upcoming',
    branch: 'Chi nhánh Quận 3 - Võ Văn Tần',
    items: [
      { id: 'b-111', serviceName: 'Nhuộm nếp phủ bạc thảo dược', price: 400000, paid: 100000, debt: 300000, date: '24/09/2026', ageDays: 1, lifecycleState: 'delivered' },
      { id: 'b-112', serviceName: 'Gói dưỡng da đầu Detox Scalp', price: 300000, paid: 100000, debt: 200000, date: '24/09/2026', ageDays: 1, lifecycleState: 'delivered' }
    ]
  }
];

export function HaircutReconciliationView() {
  const [activeSubTab, setActiveSubTab] = useState<'debt' | 'orphan' | 'mismatch' | 'clearing' | 'history'>('debt');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('10:42 • 25/09/2026');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<GroupedCustomerDebt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [targetAccount, setTargetAccount] = useState('vcb_1234');
  const [payFull, setPayFull] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      setLastUpdated(`${timeStr} • ${dateStr}`);
      toast.success('Đã cập nhật dữ liệu đối soát tài chính mới nhất');
    }, 600);
  };

  const openPaymentModal = (cust: GroupedCustomerDebt) => {
    setSelectedCustomer(cust);
    setPaymentAmount(cust.remainingDebt.toString());
    setPayFull(true);
    setNotes(`Thu công nợ khách hàng ${cust.customerName} - SĐT ${cust.phone}`);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedCustomer || !paymentAmount) return;
    setIsSubmittingPayment(true);
    setTimeout(() => {
      setIsSubmittingPayment(false);
      setShowPaymentModal(false);
      toast.success(
        `Đã thu thành công ${formatCurrency(Number(paymentAmount))} từ khách hàng ${selectedCustomer.customerName}! Sổ cái & Dòng tiền đã được cập nhật.`
      );
      setSelectedCustomer(null);
    }, 700);
  };

  const filteredCustomers = MOCK_CUSTOMER_DEBTS.filter((cust) => {
    const matchSearch =
      cust.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.phone.includes(searchTerm) ||
      cust.items.some((i) => i.serviceName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'overdue'
        ? cust.status === 'overdue'
        : statusFilter === 'due_soon'
        ? cust.status === 'due_soon'
        : cust.status === 'upcoming';

    const matchAging =
      agingFilter === 'all'
        ? true
        : agingFilter === '0-7'
        ? cust.maxAgeDays <= 7
        : agingFilter === '8-30'
        ? cust.maxAgeDays >= 8 && cust.maxAgeDays <= 30
        : agingFilter === '31-60'
        ? cust.maxAgeDays >= 31 && cust.maxAgeDays <= 60
        : cust.maxAgeDays > 60;

    return matchSearch && matchStatus && matchAging;
  });

  return (
    <div className="p-4 sm:p-8 space-y-8 pb-24 w-full overflow-x-hidden bg-slate-50/50 min-h-screen">
      {/* 1. Header & Top Bar Navigation */}
      <div className="flex flex-col gap-6">
        {/* Navigation Tabs Bar */}
        <div className="flex w-full overflow-x-auto items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm sm:w-fit">
          <Link
            href="/dashboard/finance"
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900"
          >
            Sổ nhật ký
          </Link>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Link
            href="/dashboard/finance/pnl"
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900"
          >
            Lãi/Lỗ Chi Tiết (P&L)
          </Link>
          <Link
            href="/dashboard/finance/cash-flow"
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900"
          >
            Dòng tiền & Dự báo
          </Link>
          <Link
            href="/dashboard/finance/budget"
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900"
          >
            Ngân sách
          </Link>
          <Link
            href="/dashboard/finance/reconciliation"
            className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all bg-slate-900 text-white shadow-sm"
          >
            Đối soát công nợ
          </Link>
        </div>

        {/* Header Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Đối soát Tài chính</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Theo dõi công nợ, tiền treo và chênh lệch doanh thu Haircut Shop
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-600 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>01/09/2026 – 30/09/2026</span>
            </div>

            <div className="text-right hidden md:block mr-2">
              <span className="block text-[11px] font-medium text-slate-400">Cập nhật lần cuối</span>
              <span className="text-xs font-bold text-slate-700">{lastUpdated}</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-primary text-white hover:bg-primary/90 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              <span>Đối soát lại</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top KPI Cards (Clean White Background Cards with Status Badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Công nợ phải thu */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Công nợ phải thu</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">17.480.000đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500">100 khoản nợ · 42 khách hàng</span>
            <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              18 khoản quá hạn
            </span>
          </div>
        </div>

        {/* Card 2: Tiền chưa đối soát */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Tiền chưa đối soát</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">0đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500">Không phát hiện khoản treo</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Bình thường
            </span>
          </div>
        </div>

        {/* Card 3: Lệch doanh thu */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Lệch doanh thu</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">0đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500">Không có chênh lệch</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Bình thường
            </span>
          </div>
        </div>

        {/* Card 4: Lịch sử thu nợ */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Lịch sử thu nợ (tháng này)</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">12.650.000đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500">28 giao dịch</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              ↑ 8% so với tháng trước
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub-tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'debt', label: 'Công nợ khách hàng', count: 100, color: 'bg-rose-50 text-rose-600' },
            { id: 'orphan', label: 'Tiền chưa đối soát', count: 0, color: 'bg-amber-50 text-amber-600' },
            { id: 'mismatch', label: 'Lệch doanh thu', count: 0, color: 'bg-purple-50 text-purple-600' },
            { id: 'clearing', label: 'Bù trừ chi nhánh', count: 0, color: 'bg-indigo-50 text-indigo-600' },
            { id: 'history', label: 'Lịch sử thu nợ', count: 50, color: 'bg-emerald-50 text-emerald-600' }
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-extrabold',
                    isActive ? 'bg-white/20 text-white' : tab.color
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Overdue Warning Alert Banner */}
      <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 font-bold">
            !
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-900">18 khoản công nợ đã quá hạn</h4>
            <p className="text-xs font-medium text-rose-700 mt-0.5">
              Tổng giá trị <span className="font-bold">4.480.000đ</span>. Vui lòng liên hệ khách hàng để đôn đốc thu hồi nợ.
            </p>
          </div>
        </div>
        <button
          onClick={() => setStatusFilter('overdue')}
          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap shadow-sm"
        >
          Xem danh sách →
        </button>
      </div>

      {/* 5. Main Content Grid (Left 75% Table, Right 25% Analytics Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column (3/4): Table & Filters */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm khách hàng, SĐT, mã hóa đơn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="overdue">Quá hạn (🔴)</option>
              <option value="due_soon">Đến hạn (🟡)</option>
              <option value="upcoming">Chưa đến hạn (🟢)</option>
            </select>

            {/* Debt Aging Filter */}
            <select
              value={agingFilter}
              onChange={(e) => setAgingFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Tuổi nợ: Tất cả</option>
              <option value="0-7">0 – 7 ngày</option>
              <option value="8-30">8 – 30 ngày</option>
              <option value="31-60">31 – 60 ngày</option>
              <option value=">60">&gt; 60 ngày</option>
            </select>

            {/* Branch Filter */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Chi nhánh: Tất cả</option>
              <option value="q1">Quận 1 - Nguyễn Trãi</option>
              <option value="q3">Quận 3 - Võ Văn Tần</option>
              <option value="bt">Bình Thạnh - Điện Biên Phủ</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAgingFilter('all');
                setBranchFilter('all');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-all"
            >
              Xóa bộ lọc
            </button>
          </div>

          {/* Customer Grouped Data Table (Issue #4) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Khách hàng</th>
                    <th className="py-3.5 px-4 text-center">Số khoản</th>
                    <th className="py-3.5 px-4 text-right">Tổng giá trị</th>
                    <th className="py-3.5 px-4 text-right">Đã thu</th>
                    <th className="py-3.5 px-4 text-right">Còn nợ</th>
                    <th className="py-3.5 px-4 text-center">Tuổi nợ</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        Không tìm thấy khoản công nợ phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust) => {
                      const isExpanded = expandedCustId === cust.id;
                      return (
                        <React.Fragment key={cust.id}>
                          <tr className="hover:bg-slate-50/60 transition-colors group">
                            {/* Khách hàng */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                                    cust.avatarBg
                                  )}
                                >
                                  {cust.avatarText}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{cust.customerName}</div>
                                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                    <span>{cust.phone}</span>
                                    <span>·</span>
                                    <span className="text-slate-400">Lần cuối: {cust.lastVisit}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Số khoản */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-extrabold text-slate-700 text-xs">
                                {cust.itemCount} khoản
                              </span>
                            </td>

                            {/* Tổng giá trị */}
                            <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                              {formatCurrency(cust.totalPrice)}
                            </td>

                            {/* Đã thu */}
                            <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                              {formatCurrency(cust.totalPaid)}
                            </td>

                            {/* Còn nợ */}
                            <td className="py-3.5 px-4 text-right font-black text-rose-600 text-sm">
                              {formatCurrency(cust.remainingDebt)}
                            </td>

                            {/* Tuổi nợ */}
                            <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                              {cust.maxAgeDays} ngày
                            </td>

                            {/* Trạng thái */}
                            <td className="py-3.5 px-4 text-center">
                              {cust.status === 'overdue' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Quá hạn
                                </span>
                              )}
                              {cust.status === 'due_soon' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Đến hạn
                                </span>
                              )}
                              {cust.status === 'upcoming' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Chưa đến hạn
                                </span>
                              )}
                            </td>

                            {/* Thao tác */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openPaymentModal(cust)}
                                  className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                >
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                  Thu nợ
                                </button>

                                <button
                                  onClick={() => setExpandedCustId(isExpanded ? null : cust.id)}
                                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                                >
                                  <span>Chi tiết</span>
                                  <ChevronDown
                                    className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Breakdown Row for Individual Services */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={8} className="p-4">
                                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-inner space-y-3">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                                    <span>Chi tiết các khoản nợ của {cust.customerName}</span>
                                    <span className="text-slate-400 text-[11px] font-normal">{cust.branch}</span>
                                  </div>

                                  <div className="space-y-2">
                                    {cust.items.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-50 rounded-xl text-xs gap-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <div>
                                            <span className="font-bold text-slate-900">{item.serviceName}</span>
                                            <div className="text-[11px] text-slate-400 font-medium">
                                              Ngày thực hiện: {item.date} · Đã hoàn thành dịch vụ (Receivable)
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                          <span className="text-slate-500 font-medium">
                                            Giá: {formatCurrency(item.price)}
                                          </span>
                                          <span className="font-bold text-rose-600">
                                            Nợ: {formatCurrency(item.debt)}
                                          </span>
                                          <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                            {item.ageDays} ngày
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium bg-slate-50/50">
              <div>
                Hiển thị <span className="font-bold text-slate-800">1 – {filteredCustomers.length}</span> trong{' '}
                <span className="font-bold text-slate-800">42 khách hàng</span> (100 khoản công nợ)
              </div>

              <div className="flex items-center gap-1">
                <button className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40">
                  ‹ Trước
                </button>
                <button className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  1
                </button>
                <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center">
                  2
                </button>
                <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center justify-center">
                  3
                </button>
                <button className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold">
                  Sau ›
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar (1/4): Debt Aging & Top Debtors Analytics (Issue #6) */}
        <div className="space-y-5">
          {/* Card 1: Phân bổ công nợ theo tuổi nợ */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Phân bổ công nợ theo tuổi nợ
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* 0 - 7 ngày */}
              <div>
                <div className="flex justify-between items-center font-bold text-slate-700 mb-1">
                  <span>0 – 7 ngày</span>
                  <span className="text-emerald-600">8.200.000đ (47%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '47%' }} />
                </div>
              </div>

              {/* 8 - 30 ngày */}
              <div>
                <div className="flex justify-between items-center font-bold text-slate-700 mb-1">
                  <span>8 – 30 ngày</span>
                  <span className="text-amber-600">6.480.000đ (37%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '37%' }} />
                </div>
              </div>

              {/* 31 - 60 ngày */}
              <div>
                <div className="flex justify-between items-center font-bold text-slate-700 mb-1">
                  <span>31 – 60 ngày</span>
                  <span className="text-orange-600">1.800.000đ (10%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: '10%' }} />
                </div>
              </div>

              {/* > 60 ngày */}
              <div>
                <div className="flex justify-between items-center font-bold text-slate-700 mb-1">
                  <span>&gt; 60 ngày</span>
                  <span className="text-rose-600">1.000.000đ (6%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '6%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Top khách hàng nợ nhiều nhất */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-rose-500" />
              Top khách hàng nợ nhiều nhất
            </h3>

            <div className="space-y-3 divide-y divide-slate-100">
              {[
                { rank: 1, name: 'Phạm Thu Hà', debt: 800000, items: 4, age: 'Còn 5 ngày', statusColor: 'text-emerald-600' },
                { rank: 2, name: 'Trần Thị Mai', debt: 600000, items: 2, age: 'Quá hạn 12 ngày', statusColor: 'text-rose-600' },
                { rank: 3, name: 'Nguyễn Hoàng Anh', debt: 550000, items: 3, age: 'Quá hạn 18 ngày', statusColor: 'text-rose-600' },
                { rank: 4, name: 'Đỗ Thị Nga', debt: 500000, items: 2, age: 'Còn 1 ngày', statusColor: 'text-emerald-600' },
                { rank: 5, name: 'Lê Quốc Trung', debt: 300000, items: 1, age: 'Còn 8 ngày', statusColor: 'text-amber-600' }
              ].map((debtor) => (
                <div key={debtor.rank} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px]',
                        debtor.rank === 1
                          ? 'bg-amber-100 text-amber-800'
                          : debtor.rank === 2
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {debtor.rank}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{debtor.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {debtor.items} khoản · <span className={debtor.statusColor}>{debtor.age}</span>
                      </div>
                    </div>
                  </div>

                  <span className="font-black text-slate-900">{formatCurrency(debtor.debt)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Xuất báo cáo công nợ */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Xuất báo cáo công nợ</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Định dạng Excel / PDF đầy đủ tuổi nợ & lịch sử
                </p>
              </div>
            </div>

            <button
              onClick={() => toast.success('Đang tạo và tải về file báo cáo công nợ Excel...')}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất file Excel
            </button>
          </div>
        </div>
      </div>

      {/* 6. Payment Workflow Modal ("Thu công nợ") (Issue #5) */}
      <AnimatePresence>
        {showPaymentModal && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPaymentModal(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] uppercase tracking-wider mb-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  Nghiệp vụ Thu Công Nợ Tài Chính
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">THU CÔNG NỢ KHÁCH HÀNG</h2>
              </div>

              {/* Customer Debt Summary Banner */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{selectedCustomer.customerName}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedCustomer.phone} · {selectedCustomer.itemCount} khoản dịch vụ chưa trả
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-medium block">Tổng công nợ</span>
                  <span className="text-lg font-black text-rose-600">{formatCurrency(selectedCustomer.remainingDebt)}</span>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="space-y-4 text-xs">
                {/* Số tiền thu */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiền thu (VND)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                {/* Phương thức thanh toán */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phương thức thanh toán</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="bank_transfer">Chuyển khoản Ngân hàng (VietQR)</option>
                    <option value="cash">Tiền mặt tại quầy</option>
                    <option value="mpos">Quẹt thẻ MPOS / POS Salon</option>
                  </select>
                </div>

                {/* Tài khoản nhận */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tài khoản ngân hàng / Quỹ nhận</label>
                  <select
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="vcb_1234">Vietcombank - 1012345678 (Chi nhánh HCM)</option>
                    <option value="tcb_5678">Techcombank - 1903456789 (Tài khoản Salon)</option>
                    <option value="cash_box">Tài khoản Quỹ Tiền Mặt Salon</option>
                  </select>
                </div>

                {/* Checkbox Thanh toán toàn bộ */}
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={payFull}
                    onChange={(e) => {
                      setPayFull(e.target.checked);
                      if (e.target.checked) {
                        setPaymentAmount(selectedCustomer.remainingDebt.toString());
                      }
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                  />
                  <span>Thanh toán toàn bộ công nợ ({formatCurrency(selectedCustomer.remainingDebt)})</span>
                </label>

                {/* Ghi chú */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ghi chú đối soát</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú thu nợ đối soát tài chính..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none"
                  />
                </div>

                {/* Audit Trail Note */}
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Hệ thống sẽ tự động tạo transaction: <strong className="font-bold">Receivable → Payment → Ledger → Cash/Bank</strong> có Audit Trail.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isSubmittingPayment}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Xác nhận thu {formatCurrency(Number(paymentAmount) || 0)}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
