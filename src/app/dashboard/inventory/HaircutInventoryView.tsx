'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Wallet,
  Search,
  Filter,
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  Box,
  Truck,
  ClipboardCheck,
  Building2
} from 'lucide-react';

interface HaircutInventoryViewProps {
  onRestock?: () => void;
  onAdjust?: (item: any) => void;
  onTransferRequest?: () => void;
  onReconciliation?: () => void;
}

const PRODUCT_IMAGES: Record<string, string> = {
  'CLR-061': 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=120&auto=format&fit=crop&q=80',
  'OXY-09': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=120&auto=format&fit=crop&q=80',
  'SHP-023': 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=120&auto=format&fit=crop&q=80',
  'GLV-001': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&auto=format&fit=crop&q=80',
  'TWL-001': 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=120&auto=format&fit=crop&q=80',
  'WAX-005': 'https://images.unsplash.com/photo-1608248597261-833258657640?w=120&auto=format&fit=crop&q=80',
  'SRM-002': 'https://images.unsplash.com/photo-1608248597261-833258657640?w=120&auto=format&fit=crop&q=80',
  'PRM-011': 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=120&auto=format&fit=crop&q=80',
};

const USER_AVATARS: Record<string, string> = {
  'Nguyễn Văn A': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'Trần Thị B': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'Lê Minh C': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  'Phạm Thu D': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
};

export function HaircutInventoryView({
  onRestock,
  onAdjust,
  onTransferRequest,
  onReconciliation,
}: HaircutInventoryViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stock' | 'logs' | 'requests' | 'recon' | 'limits'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả danh mục');
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [supplierFilter, setSupplierFilter] = useState('Tất cả nhà cung cấp');
  const [branchFilter, setBranchFilter] = useState('Quận 1');
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const branchOptions = [
    { value: 'Quận 1', label: 'Chi nhánh: Quận 1' },
    { value: 'Quận 2', label: 'Chi nhánh: Quận 2' },
    { value: 'Quận 7', label: 'Chi nhánh: Quận 7' },
  ];

  const categoryOptions = [
    { value: 'Tất cả danh mục', label: 'Tất cả danh mục' },
    { value: 'Thuốc nhuộm', label: 'Thuốc nhuộm' },
    { value: 'Hóa chất', label: 'Hóa chất' },
    { value: 'Chăm sóc tóc', label: 'Chăm sóc tóc' },
    { value: 'Vật tư tiêu hao', label: 'Vật tư tiêu hao' },
    { value: 'Sản phẩm bán', label: 'Sản phẩm bán' },
  ];

  const statusOptions = [
    { value: 'Tất cả trạng thái', label: 'Tất cả trạng thái' },
    { value: 'Bình thường', label: 'Bình thường' },
    { value: 'Sắp hết', label: 'Sắp hết' },
    { value: 'Thiếu hàng', label: 'Thiếu hàng' },
  ];

  const supplierOptions = [
    { value: 'Tất cả nhà cung cấp', label: 'Tất cả nhà cung cấp' },
    { value: "L'Oréal Professionnel", label: "L'Oréal Professionnel" },
    { value: 'Olaplex', label: 'Olaplex' },
    { value: 'CleanPro', label: 'CleanPro' },
  ];

  // Inventory Table Mock Data matching target UI screenshot
  const inventoryList = [
    {
      id: 'inv-1',
      name: "Thuốc nhuộm L'Oréal 6.1",
      brand: "L'Oréal Professionnel",
      sku: 'CLR-061',
      category: 'Thuốc nhuộm',
      categoryTone: 'blue',
      qty: 12,
      minQty: 8,
      unit: 'Tuýp',
      totalValue: '2.160.000đ',
      status: 'normal',
      statusLabel: 'Bình thường',
      percent: 80,
    },
    {
      id: 'inv-2',
      name: 'Oxy 9% (1L)',
      brand: "L'Oréal Professionnel",
      sku: 'OXY-09',
      category: 'Hóa chất',
      categoryTone: 'blue',
      qty: 5,
      minQty: 10,
      unit: 'Chai',
      totalValue: '750.000đ',
      status: 'low',
      statusLabel: 'Sắp hết',
      percent: 45,
    },
    {
      id: 'inv-3',
      name: 'Dầu gội phục hồi Olaplex',
      brand: 'Olaplex',
      sku: 'SHP-023',
      category: 'Chăm sóc tóc',
      categoryTone: 'blue',
      qty: 2,
      minQty: 8,
      unit: 'Chai',
      totalValue: '420.000đ',
      status: 'critical',
      statusLabel: 'Thiếu hàng',
      percent: 20,
    },
    {
      id: 'inv-4',
      name: 'Găng tay nitrile (hộp)',
      brand: 'Medicare',
      sku: 'GLV-001',
      category: 'Vật tư tiêu hao',
      categoryTone: 'cyan',
      qty: 50,
      minQty: 30,
      unit: 'Hộp',
      totalValue: '250.000đ',
      status: 'normal',
      statusLabel: 'Bình thường',
      percent: 85,
    },
    {
      id: 'inv-5',
      name: 'Khăn dùng một lần',
      brand: 'CleanPro',
      sku: 'TWL-001',
      category: 'Vật tư tiêu hao',
      categoryTone: 'cyan',
      qty: 120,
      minQty: 50,
      unit: 'Cái',
      totalValue: '360.000đ',
      status: 'normal',
      statusLabel: 'Bình thường',
      percent: 90,
    },
    {
      id: 'inv-6',
      name: 'Wax tạo kiểu For Men',
      brand: 'Hanz de Fuko',
      sku: 'WAX-005',
      category: 'Sản phẩm bán',
      categoryTone: 'rose',
      qty: 8,
      minQty: 15,
      unit: 'Hộp',
      totalValue: '1.600.000đ',
      status: 'low',
      statusLabel: 'Sắp hết',
      percent: 48,
    },
    {
      id: 'inv-7',
      name: 'Serum phục hồi tóc',
      brand: 'Moroccanoil',
      sku: 'SRM-002',
      category: 'Chăm sóc tóc',
      categoryTone: 'blue',
      qty: 25,
      minQty: 10,
      unit: 'Chai',
      totalValue: '3.750.000đ',
      status: 'normal',
      statusLabel: 'Bình thường',
      percent: 80,
    },
    {
      id: 'inv-8',
      name: 'Thuốc uốn cold wave',
      brand: 'Mise en scène',
      sku: 'PRM-011',
      category: 'Hóa chất',
      categoryTone: 'blue',
      qty: 1,
      minQty: 5,
      unit: 'Hộp',
      totalValue: '320.000đ',
      status: 'critical',
      statusLabel: 'Thiếu hàng',
      percent: 15,
    },
  ];

  // Recent Activity Log Items matching screenshot
  const recentLogs = [
    {
      id: 'log-1',
      type: 'Nhập kho',
      change: '+20 tuýp',
      changeTone: 'green',
      item: "Thuốc nhuộm L'Oréal 6.1",
      time: 'Hôm nay, 10:24',
      user: 'Nguyễn Văn A',
      avatar: USER_AVATARS['Nguyễn Văn A'],
    },
    {
      id: 'log-2',
      type: 'Xuất kho (dịch vụ)',
      change: '-2 chai',
      changeTone: 'red',
      item: 'Oxy 9%',
      time: 'Hôm nay, 09:15',
      user: 'Trần Thị B',
      avatar: USER_AVATARS['Trần Thị B'],
    },
    {
      id: 'log-3',
      type: 'Điều chỉnh tồn kho',
      change: '+50 cái',
      changeTone: 'green',
      item: 'Khăn dùng một lần',
      time: 'Hôm qua, 17:30',
      user: 'Lê Minh C',
      avatar: USER_AVATARS['Lê Minh C'],
    },
    {
      id: 'log-4',
      type: 'Xuất kho (POS)',
      change: '-1 hộp',
      changeTone: 'red',
      item: 'Wax tạo kiểu For Men',
      time: 'Hôm qua, 14:22',
      user: 'Phạm Thu D',
      avatar: USER_AVATARS['Phạm Thu D'],
    },
    {
      id: 'log-5',
      type: 'Nhập kho',
      change: '+15 chai',
      changeTone: 'green',
      item: 'Serum phục hồi tóc',
      time: '25/09/2026, 16:10',
      user: 'Nguyễn Văn A',
      avatar: USER_AVATARS['Nguyễn Văn A'],
    },
    {
      id: 'log-6',
      type: 'Kiểm kê',
      change: 'Chênh lệch -2',
      changeTone: 'red',
      item: '25/09/2026, 09:00',
      time: '25/09/2026, 09:00',
      user: 'Trần Thị B',
      avatar: USER_AVATARS['Trần Thị B'],
    },
    {
      id: 'log-7',
      type: 'Yêu cầu cấp hàng',
      change: 'Đang chờ duyệt',
      changeTone: 'amber',
      item: '24/09/2026, 11:05',
      time: '24/09/2026, 11:05',
      user: 'Lê Minh C',
      avatar: USER_AVATARS['Lê Minh C'],
    },
  ];

  const filteredItems = useMemo(() => {
    return inventoryList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        [item.name, item.brand, item.sku, item.category].some((field) =>
          field.toLowerCase().includes(q)
        );

      let matchesCategory = true;
      if (categoryFilter !== 'Tất cả danh mục') {
        matchesCategory = item.category === categoryFilter;
      }

      let matchesStatus = true;
      if (statusFilter !== 'Tất cả trạng thái') {
        if (statusFilter === 'Bình thường') matchesStatus = item.status === 'normal';
        else if (statusFilter === 'Sắp hết') matchesStatus = item.status === 'low';
        else if (statusFilter === 'Thiếu hàng') matchesStatus = item.status === 'critical';
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, categoryFilter, statusFilter]);

  const totalCount = 248;
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div
      id="haircut-inventory-container"
      className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 relative min-h-screen text-slate-800"
      onClick={() => setActiveMenuId(null)}
    >
      {/* Header Section */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-serif">
            Kho & Vật tư
          </h1>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
            Quản lý tồn kho, vật tư tiêu hao và cấp hàng chi nhánh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <PremiumSelect
              value={branchFilter}
              options={branchOptions}
              onChange={(val) => setBranchFilter(val)}
              placeholder="Chi nhánh..."
            />
          </div>

          <PremiumExportButton />

          {/* CTA Restock Button */}
          <button
            onClick={onRestock}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-xs sm:text-sm text-white shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Nhập kho</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Tổng mặt hàng (SKU) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Tổng mặt hàng (SKU)</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                {totalCount}
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                ↑ 12%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">+18 SKU so với tháng trước</p>
          </div>
        </div>

        {/* Card 2: Sắp hết hàng */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Sắp hết hàng</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                12
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                ↑ 3
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Cần nhập trong 7 ngày tới</p>
          </div>
        </div>

        {/* Card 3: Dự báo thiếu (30 ngày) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Dự báo thiếu (30 ngày)</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                3
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                ↑ 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo kế hoạch sử dụng</p>
          </div>
        </div>

        {/* Card 4: Giá trị tồn kho */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 transition hover:shadow-md">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 mb-0.5">Giá trị tồn kho</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900 tracking-tight font-sans">
                42.500.000đ
              </span>
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                ↑ 8%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo giá vốn</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'stock'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Box className="w-4 h-4" />
          <span>Tồn kho chi nhánh</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'logs'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Giao dịch kho</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('requests');
            onTransferRequest?.();
          }}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'requests'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <Truck className="w-4 h-4" />
          <span>Yêu cầu cấp từ HQ</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('recon');
            onReconciliation?.();
          }}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'recon'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Kiểm kê kho</span>
        </button>
        <button
          onClick={() => setActiveTab('limits')}
          className={cn(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
            activeTab === 'limits'
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Định mức tiêu hao</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Tìm vật tư, SKU, danh mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl outline-none text-xs font-medium text-slate-700 focus:border-primary"
            />
          </div>

          <div className="w-40">
            <PremiumSelect
              value={categoryFilter}
              options={categoryOptions}
              onChange={(val) => setCategoryFilter(val)}
              placeholder="Tất cả danh mục"
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
          <div className="w-44">
            <PremiumSelect
              value={supplierFilter}
              options={supplierOptions}
              onChange={(val) => setSupplierFilter(val)}
              placeholder="Tất cả nhà cung cấp"
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

      {/* Operational Exception Alert Banner */}
      <div className="bg-amber-500/10 border border-amber-200/80 rounded-2xl p-3 mb-5 flex items-center justify-between text-xs font-bold text-amber-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            15 mặt hàng cần chú ý: 12 sắp hết hàng · 3 dự báo thiếu trong 30 ngày.
          </span>
        </div>
        <button className="text-amber-800 font-extrabold hover:underline flex items-center gap-1">
          <span>Xem danh sách</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Grid Section: Table (Left ~80%) + Recent Logs Sidebar (Right ~20%) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-6">
        {/* Inventory Table (Left 3 cols) */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-3 pl-4">Vật tư / Sản phẩm</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Danh mục</th>
                  <th className="p-3">Tồn kho ↓</th>
                  <th className="p-3">Mức tối thiểu</th>
                  <th className="p-3">Đơn vị</th>
                  <th className="p-3">Giá trị tồn</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right pr-4">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedItems.map((item) => {
                  const isLow = item.status === 'low';
                  const isCritical = item.status === 'critical';
                  const isNormal = item.status === 'normal';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <img
                              src={
                                PRODUCT_IMAGES[item.sku] ||
                                'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=120&auto=format&fit=crop&q=80'
                              }
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 text-xs truncate">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">{item.brand}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-500">{item.sku}</td>

                      <td className="p-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-extrabold border',
                            item.categoryTone === 'cyan'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : item.categoryTone === 'rose'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          )}
                        >
                          {item.category}
                        </span>
                      </td>

                      <td className="p-3 min-w-[100px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {item.qty}
                          </span>
                        </div>
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              isCritical
                                ? 'bg-rose-500'
                                : isLow
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            )}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={cn(
                            'font-bold',
                            isCritical ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-500'
                          )}
                        >
                          {item.minQty}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500 font-semibold">{item.unit}</td>

                      <td className="p-3 font-extrabold text-slate-900">{item.totalValue}</td>

                      <td className="p-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-bold text-[11px]',
                            isNormal && 'text-emerald-600',
                            isLow && 'text-amber-600',
                            isCritical && 'text-rose-600'
                          )}
                        >
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              isNormal && 'bg-emerald-500',
                              isLow && 'bg-amber-500',
                              isCritical && 'bg-rose-500'
                            )}
                          />
                          {item.statusLabel}
                        </span>
                      </td>

                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onAdjust?.(item)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-[11px] text-slate-700 transition"
                          >
                            Điều chỉnh
                          </button>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            <AnimatePresence>
                              {activeMenuId === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                                  className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden p-1.5 text-xs font-bold text-slate-700"
                                >
                                  <button
                                    onClick={() => onRestock?.()}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition"
                                  >
                                    Nhập hàng
                                  </button>
                                  <button
                                    onClick={() => onTransferRequest?.()}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition"
                                  >
                                    Cấp từ HQ
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
            </table>
          </div>
        </div>

        {/* Recent Inventory Logs Sidebar (Right 1 col) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Lịch sử kho gần đây
              </h3>
              <button className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                <span>Xem tất cả</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 mt-0.5">
                    <img src={log.avatar} alt={log.user} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-[11px] truncate">
                        {log.type}
                      </h4>
                      <span
                        className={cn(
                          'font-extrabold text-[10px]',
                          log.changeTone === 'green' && 'text-emerald-600',
                          log.changeTone === 'red' && 'text-rose-600',
                          log.changeTone === 'amber' && 'text-amber-600 px-1.5 py-0.2 bg-amber-50 rounded-md border border-amber-200'
                        )}
                      >
                        {log.change}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-500 truncate">{log.item}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>{log.time}</span>
                      <span>{log.user}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs text-slate-500 font-medium">
        <div>
          Hiển thị <span className="font-bold text-slate-800">1 - 8</span> trong{' '}
          <span className="font-bold text-slate-800">{totalCount}</span> mặt hàng
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
            onClick={() => setCurrentPage(31)}
            className="w-8 h-8 rounded-xl font-bold transition text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            31
          </button>

          <button
            onClick={() => setCurrentPage((p) => Math.min(31, p + 1))}
            disabled={currentPage === 31}
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
            <option value={8}>8 / trang</option>
            <option value={15}>15 / trang</option>
            <option value={30}>30 / trang</option>
          </select>
        </div>
      </div>
    </div>
  );
}
